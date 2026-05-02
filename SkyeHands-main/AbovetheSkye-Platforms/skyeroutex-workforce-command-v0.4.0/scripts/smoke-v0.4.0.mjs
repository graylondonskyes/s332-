import fs from 'fs';
import path from 'path';
const root = process.cwd();
const proofDir = path.join(root, 'proof');
fs.mkdirSync(proofDir, { recursive: true });
const dbPath = path.join(root, 'data', 'v040-combined-smoke-db.json');
const mediaRoot = path.join(root, 'data', 'v040-combined-media');
const exportRoot = path.join(root, 'data', 'v040-combined-exports');
for (const p of [dbPath, mediaRoot, exportRoot]) if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
const port = 5869;
process.env.PORT = String(port);
process.env.DATABASE_PATH = dbPath;
process.env.MEDIA_ROOT = mediaRoot;
process.env.EXPORT_ROOT = exportRoot;
process.env.SKYE_ADMIN_EMAIL = 'admin@combined.internal.invalid';
process.env.SKYE_ADMIN_PASSWORD = 'AdminCombined123!';
const { startServer } = await import('../src/server.js');
const server = await startServer(port);
async function req(method, url, body, session) { const headers = { 'content-type': 'application/json', connection: 'close' }; if (session) headers['x-skye-session'] = session; const res = await fetch(`http://localhost:${port}${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined }); const text = await res.text(); let json; try { json = JSON.parse(text); } catch { json = { raw: text }; } return { status: res.status, json }; }
function assert(cond, msg, data) { if (!cond) { const e = new Error(msg); e.data = data; throw e; } }
async function login(email, password) { const r = await req('POST', '/api/auth/login', { email, password }); assert(r.status === 200, 'login failed ' + email, r); return r.json.session; }
const proof = { started_at: new Date().toISOString(), checks: [] };
const pass = (name, data = {}) => proof.checks.push({ status: 'PASS', name, data });
try {
  const health = await req('GET', '/api/health'); assert(health.status === 200 && health.json.version === '0.4.0', 'health/version failed', health); pass('health_version_0_4_0');
  const html = await fetch(`http://localhost:${port}/`).then(r => r.text());
  const js = await fetch(`http://localhost:${port}/app.js`).then(r => r.text());
  for (const id of ['login-form','signup-form','market-form','job-form','feed-form','provider-jobs','applicant-pool','contractor-feed','assignments','routes','roster','ratings','operator-assign-form','rating-form','house-jobs','payments','audits','exports','btn-storage','btn-market-report']) assert(html.includes(`id="${id}"`), 'browser html missing ' + id);
  for (const token of ['/api/storage/status','/api/house-command/market-report','/api/jobs/${b.dataset.exportJob}/export-packet','/api/provider/jobs','/api/assignments','/api/route-jobs']) assert(js.includes(token), 'browser js missing ' + token);
  pass('browser_panels_include_storage_export_controls');
  const admin = await login('admin@combined.internal.invalid', 'AdminCombined123!'); pass('admin_login');
  const market = await req('POST', '/api/markets', { city: 'Phoenix', state: 'Arizona', status: 'open' }, admin); assert(market.status === 201, 'market failed', market); const marketId = market.json.market.id; pass('market_created', { marketId });
  const provider = await req('POST', '/api/auth/signup', { email: 'provider-combined@example.test', password: 'Provider123!', name: 'Combined Provider', role: 'provider', city: 'Phoenix', state: 'Arizona', company_name: 'Combined Provider Co' }); assert(provider.status === 201, 'provider signup failed', provider);
  const contractor = await req('POST', '/api/auth/signup', { email: 'contractor-combined@example.test', password: 'Contractor123!', name: 'Combined Contractor', role: 'contractor', city: 'Phoenix', state: 'Arizona', skills: ['event', 'route'] }); assert(contractor.status === 201, 'contractor signup failed', contractor);
  const contractor2 = await req('POST', '/api/auth/signup', { email: 'contractor2-combined@example.test', password: 'Contractor123!', name: 'Combined Contractor Two', role: 'contractor', city: 'Phoenix', state: 'Arizona', skills: ['event'] }); assert(contractor2.status === 201, 'second contractor signup failed', contractor2);
  const providerSession = await login('provider-combined@example.test', 'Provider123!'); const contractorSession = await login('contractor-combined@example.test', 'Contractor123!'); const contractor2Session = await login('contractor2-combined@example.test', 'Contractor123!'); pass('provider_and_contractors_login');
  const job = await req('POST', '/api/jobs', { market_id: marketId, title: 'v0.4 proof route lane', category: 'event', description: 'Proves one-person acceptance, route, media proof, payment, and exports.', location: 'Phoenix Yard', starts_at: '2026-05-04T12:00:00.000Z', pay_type: 'fixed', pay_amount_cents: 12000, slots: 1, acceptance_mode: 'single', proof_required: true, route_required: true, route_mode: 'field_route', vehicle_type: 'car_or_van', arrival_window: '30 minutes before start', pickup_location: 'Phoenix Yard', dropoff_location: 'Mesa Completion Site', route_stops: [{ label: 'Pickup', address: 'Phoenix Yard', proof_required: true }, { label: 'Complete', address: 'Mesa Completion Site', proof_required: true }] }, providerSession); assert(job.status === 201, 'route job create failed', job); const jobId = job.json.job.id; pass('route_job_created', { jobId });
  const app1 = await req('POST', `/api/jobs/${jobId}/apply`, { note: 'Primary applicant.' }, contractorSession); assert(app1.status === 201, 'primary apply failed', app1);
  const app2 = await req('POST', `/api/jobs/${jobId}/apply`, { note: 'Backup applicant.' }, contractor2Session); assert(app2.status === 201, 'backup apply failed', app2); pass('applicant_pool_created');
  const accept1 = await req('POST', `/api/jobs/${jobId}/accept-applicant`, { application_id: app1.json.application.id }, providerSession); assert(accept1.status === 201, 'primary accept failed', accept1); const assignmentId = accept1.json.assignment.id;
  const accept2 = await req('POST', `/api/jobs/${jobId}/accept-applicant`, { application_id: app2.json.application.id }, providerSession); assert(accept2.status === 409, 'single acceptance lock did not block second acceptance', accept2); pass('single_acceptance_lock_blocked_second_acceptance');
  for (const action of ['confirm','on-the-way','check-in','check-out']) { const r = await req('POST', `/api/assignments/${assignmentId}/${action}`, {}, contractorSession); assert(r.status === 200, 'assignment action failed ' + action, r); } pass('assignment_state_flow_completed');
  const routes = await req('GET', '/api/route-jobs', null, contractorSession); assert(routes.status === 200 && routes.json.routes.length === 1 && routes.json.routes[0].stops.length === 2, 'route read failed', routes); const routeId = routes.json.routes[0].id;
  for (const stop of routes.json.routes[0].stops) { const r = await req('POST', `/api/route-jobs/${routeId}/complete-stop`, { stop_id: stop.id, proof_note: 'Combined smoke stop proof.' }, contractorSession); assert(r.status === 200, 'stop completion failed', r); } pass('route_stops_completed');
  const proofText = `combined proof ${new Date().toISOString()}`;
  const proofSubmit = await req('POST', `/api/assignments/${assignmentId}/proof`, { proof_type: 'text_with_media', body: 'Media-backed proof note.', media_base64: Buffer.from(proofText).toString('base64'), media_ext: 'txt', media_mime: 'text/plain' }, contractorSession); assert(proofSubmit.status === 201 && proofSubmit.json.media && fs.existsSync(proofSubmit.json.media.storage_path), 'proof media persistence failed', proofSubmit); pass('proof_media_persisted', { mediaId: proofSubmit.json.media.id });
  const approve = await req('POST', `/api/assignments/${assignmentId}/approve`, {}, providerSession); assert(approve.status === 200 && approve.json.payment.status === 'payout_eligible', 'approval/payment failed', approve); pass('payment_state_payout_eligible');
  const roster = await req('POST', '/api/provider/roster', { contractor_id: contractor.json.id }, providerSession); assert([200,201].includes(roster.status), 'roster failed', roster); pass('provider_roster_added');
  const rating = await req('POST', '/api/ratings', { job_id: jobId, to_user_id: contractor.json.id, score: 5, note: 'Combined smoke rating.' }, providerSession); assert(rating.status === 201, 'rating failed', rating); pass('rating_submitted');
  const recommendations = await req('POST', `/api/autonomous/recommend/${jobId}`, {}, providerSession); assert(recommendations.status === 200 && recommendations.json.recommendations.length >= 2, 'recommendations failed', recommendations); pass('autonomous_recommendations_generated');
  const packet = await req('GET', `/api/jobs/${jobId}/export-packet`, null, providerSession); assert(packet.status === 200 && packet.json.packet.proof_media.length === 1 && fs.existsSync(packet.json.export.path), 'job packet export failed', packet); pass('job_packet_exported');
  const report = await req('GET', '/api/house-command/market-report?city=Phoenix&state=Arizona', null, admin); assert(report.status === 200 && report.json.report.totals.jobs >= 1 && fs.existsSync(report.json.export.path), 'market report failed', report); pass('market_report_exported');
  const storage = await req('GET', '/api/storage/status', null, admin); assert(storage.status === 200 && storage.json.storage.proof_media_count === 1 && storage.json.storage.export_packet_count >= 2, 'storage counters failed', storage); pass('storage_status_counters_updated');
  const audit = await req('GET', '/api/admin/audit-events', null, admin); assert(audit.status === 200 && audit.json.audit_events.some(a => a.event_type === 'job_packet_exported') && audit.json.audit_events.some(a => a.event_type === 'market_report_exported'), 'audit export events missing', audit); pass('audit_events_include_exports');
  proof.status = 'PASS'; proof.completed_at = new Date().toISOString();
} catch (err) {
  proof.status = 'FAIL'; proof.failed_at = new Date().toISOString(); proof.failure = err.message; proof.data = err.data || null; console.error(err); process.exitCode = 1;
} finally {
  const out = path.join(proofDir, `SMOKE_V0_4_0_COMBINED_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(out, JSON.stringify(proof, null, 2));
  console.log(`Combined v0.4.0 proof written: ${out}`);
  await new Promise(resolve => server.close(resolve));
  process.exit(process.exitCode || 0);
}
