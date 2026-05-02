import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
const root = process.cwd();
const proofDir = path.join(root, 'proof');
fs.mkdirSync(proofDir, { recursive: true });
const dbPath = path.join(root, 'data', 'storage-export-smoke-db.json');
const mediaRoot = path.join(root, 'data', 'storage-export-media');
const exportRoot = path.join(root, 'data', 'storage-export-packets');
for (const p of [dbPath, mediaRoot, exportRoot]) if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
const port = 5849;
const env = { ...process.env, PORT: String(port), DATABASE_PATH: dbPath, MEDIA_ROOT: mediaRoot, EXPORT_ROOT: exportRoot, SKYE_ADMIN_EMAIL: 'admin@storage.internal.invalid', SKYE_ADMIN_PASSWORD: 'AdminStorage123!' };
const server = spawn('node', ['src/server.js'], { cwd: root, env, stdio: 'ignore' });

let logs = 'server spawned with stdio ignored for deterministic smoke exit.';
async function req(method, url, body, session) { const headers = { 'content-type': 'application/json', connection: 'close' }; if (session) headers['x-skye-session'] = session; const res = await fetch(`http://localhost:${port}${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined }); const text = await res.text(); let json; try { json = JSON.parse(text); } catch { json = { raw: text }; } return { status: res.status, json }; }
function assert(cond, msg, data) { if (!cond) { const e = new Error(msg); e.data = data; throw e; } }
async function login(email, password) { const r = await req('POST', '/api/auth/login', { email, password }); assert(r.status === 200, 'login failed ' + email, r); return r.json.session; }
const proof = { started_at: new Date().toISOString(), checks: [] };
const pass = (name, data = {}) => proof.checks.push({ status: 'PASS', name, data });
try {
  for (let i=0; i<80; i++) { try { const r = await fetch('http://localhost:' + port + '/api/health'); if (r.ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 50)); }
  const health = await req('GET', '/api/health'); assert(health.status === 200 && health.json.version === '0.4.0', 'health/version failed', health); pass('health_version_0_4_0', health.json);
  const admin = await login('admin@storage.internal.invalid', 'AdminStorage123!'); pass('admin_login');
  const storage0 = await req('GET', '/api/storage/status', null, admin); assert(storage0.status === 200 && storage0.json.storage.driver === 'local-json', 'storage status failed', storage0); pass('storage_status_reports_local_driver');
  const market = await req('POST', '/api/markets', { city: 'Phoenix', state: 'Arizona', status: 'open' }, admin); assert(market.status === 201, 'market failed', market); const marketId = market.json.market.id;
  const provider = await req('POST', '/api/auth/signup', { email: 'provider-storage@example.test', password: 'Provider123!', name: 'Storage Provider', role: 'provider', city: 'Phoenix', state: 'Arizona', company_name: 'Storage Provider Co' }); assert(provider.status === 201, 'provider signup failed', provider);
  const contractor = await req('POST', '/api/auth/signup', { email: 'contractor-storage@example.test', password: 'Contractor123!', name: 'Storage Contractor', role: 'contractor', city: 'Phoenix', state: 'Arizona', skills: ['event', 'route'] }); assert(contractor.status === 201, 'contractor signup failed', contractor);
  const providerSession = await login('provider-storage@example.test', 'Provider123!'); const contractorSession = await login('contractor-storage@example.test', 'Contractor123!'); pass('provider_and_contractor_login');
  const job = await req('POST', '/api/jobs', { market_id: marketId, title: 'Proof media and export lane', category: 'event', description: 'Proves media persistence and export packets.', location: 'Phoenix Proof Yard', starts_at: '2026-05-04T12:00:00.000Z', pay_type: 'fixed', pay_amount_cents: 9900, slots: 1, acceptance_mode: 'single', proof_required: true }, providerSession); assert(job.status === 201, 'job create failed', job); const jobId = job.json.job.id; pass('job_created', { jobId });
  const app = await req('POST', `/api/jobs/${jobId}/apply`, { note: 'Ready with media proof.' }, contractorSession); assert(app.status === 201, 'apply failed', app);
  const accept = await req('POST', `/api/jobs/${jobId}/accept-applicant`, { application_id: app.json.application.id }, providerSession); assert(accept.status === 201, 'accept failed', accept); const assignmentId = accept.json.assignment.id; pass('assignment_created', { assignmentId });
  await req('POST', `/api/assignments/${assignmentId}/confirm`, {}, contractorSession);
  await req('POST', `/api/assignments/${assignmentId}/on-the-way`, {}, contractorSession);
  await req('POST', `/api/assignments/${assignmentId}/check-in`, {}, contractorSession);
  await req('POST', `/api/assignments/${assignmentId}/check-out`, {}, contractorSession);
  const mediaText = `skye proof media ${new Date().toISOString()}`;
  const proofSubmit = await req('POST', `/api/assignments/${assignmentId}/proof`, { proof_type: 'text_with_media', body: 'Media-backed proof note.', media_base64: Buffer.from(mediaText).toString('base64'), media_ext: 'txt', media_mime: 'text/plain' }, contractorSession);
  assert(proofSubmit.status === 201 && proofSubmit.json.media && proofSubmit.json.media.sha256 && fs.existsSync(proofSubmit.json.media.storage_path), 'proof media persistence failed', proofSubmit); pass('proof_media_persisted_with_sha256', { mediaId: proofSubmit.json.media.id, bytes: proofSubmit.json.media.byte_size, sha256: proofSubmit.json.media.sha256 });
  const integrity = await req('GET', '/api/storage/integrity', null, admin);
  assert(integrity.status === 200 && integrity.json.storage_integrity.ok && integrity.json.storage_integrity.media_count === 1, 'storage integrity verification failed', integrity);
  pass('storage_integrity_verifies_media_bytes_and_sha256', integrity.json.storage_integrity);
  const approve = await req('POST', `/api/assignments/${assignmentId}/approve`, {}, providerSession); assert(approve.status === 200 && approve.json.payment.status === 'payout_eligible', 'approval failed', approve); pass('payment_advanced_after_media_proof');
  const packet = await req('GET', `/api/jobs/${jobId}/export-packet`, null, providerSession); assert(packet.status === 200 && packet.json.packet.proof_media.length === 1 && packet.json.export.sha256 && packet.json.export.byte_size > 0 && fs.existsSync(packet.json.export.path), 'job packet export failed', packet); pass('job_packet_exported_with_sha256', { exportId: packet.json.export.id, mediaCount: packet.json.packet.proof_media.length, sha256: packet.json.export.sha256 });
  const report = await req('GET', '/api/house-command/market-report?city=Phoenix&state=Arizona', null, admin); assert(report.status === 200 && report.json.report.totals.jobs >= 1 && report.json.export.sha256 && report.json.export.byte_size > 0 && fs.existsSync(report.json.export.path), 'market report export failed', report); pass('market_report_exported_with_sha256', { exportId: report.json.export.id, jobs: report.json.report.totals.jobs, sha256: report.json.export.sha256 });
  const storage1 = await req('GET', '/api/storage/status', null, admin); assert(storage1.status === 200 && storage1.json.storage.proof_media_count === 1 && storage1.json.storage.export_packet_count >= 2, 'storage counters failed', storage1); pass('storage_counters_updated', storage1.json.storage);
  proof.completed_at = new Date().toISOString(); proof.status = 'PASS'; proof.server_log_excerpt = logs.slice(-2000);
} catch (err) {
  proof.failed_at = new Date().toISOString(); proof.status = 'FAIL'; proof.failure = err.message; proof.data = err.data || null; proof.server_log_excerpt = logs.slice(-4000); console.error(err); process.exitCode = 1;
} finally {
  const out = path.join(proofDir, `SMOKE_STORAGE_EXPORT_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(out, JSON.stringify(proof, null, 2));
  console.log(`Storage/export proof written: ${out}`);
  try { process.kill(server.pid, 'SIGKILL'); } catch {}
  process.exit(process.exitCode || 0);
}
