import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const root = process.cwd();
const proofDir = path.join(root, 'proof');
fs.mkdirSync(proofDir, { recursive: true });
const dbPath = path.join(root, 'data', 'integrity-smoke-db.json');
if (fs.existsSync(dbPath)) fs.rmSync(dbPath, { force: true });

const port = 5879;
const env = { ...process.env, PORT: String(port), DATABASE_PATH: dbPath, SKYE_ADMIN_EMAIL: 'admin@integrity.internal.invalid', SKYE_ADMIN_PASSWORD: 'AdminIntegrity123!' };
const server = spawn('node', ['src/server.js'], { cwd: root, env, stdio: 'ignore' });

async function req(method, url, body, session) {
  const headers = { 'content-type': 'application/json', connection: 'close' };
  if (session) headers['x-skye-session'] = session;
  const res = await fetch(`http://localhost:${port}${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}
function assert(cond, msg, data) { if (!cond) { const e = new Error(msg); e.data = data; throw e; } }
async function login(email, password) {
  const r = await req('POST', '/api/auth/login', { email, password });
  assert(r.status === 200, 'login failed ' + email, r);
  return r.json.session;
}

const proof = { started_at: new Date().toISOString(), checks: [] };
const pass = (name, data = {}) => proof.checks.push({ status: 'PASS', name, data });

try {
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`http://localhost:${port}/api/health`); if (r.ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  const admin = await login('admin@integrity.internal.invalid', 'AdminIntegrity123!');
  const badSignup = await req('POST', '/api/auth/signup', { email: 'bad-email', password: 'x', name: 'Bad', role: 'contractor' });
  assert(badSignup.status === 400, 'bad email accepted', badSignup); pass('rejects_bad_email');

  const market = await req('POST', '/api/markets', { city: 'Phoenix', state: 'Arizona', status: 'open' }, admin);
  assert(market.status === 201, 'market failed', market);
  const provider = await req('POST', '/api/auth/signup', { email: 'provider-integrity@example.test', password: 'Provider123!', name: 'Integrity Provider', role: 'provider', city: 'Phoenix', state: 'Arizona', company_name: 'Integrity Co' });
  assert(provider.status === 201, 'provider signup failed', provider);
  const contractor = await req('POST', '/api/auth/signup', { email: 'contractor-integrity@example.test', password: 'Contractor123!', name: 'Integrity Contractor', role: 'contractor', city: 'Phoenix', state: 'Arizona', skills: ['event'] });
  assert(contractor.status === 201, 'contractor signup failed', contractor);
  const providerSession = await login('provider-integrity@example.test', 'Provider123!');
  const contractorSession = await login('contractor-integrity@example.test', 'Contractor123!');

  const baseJob = { market_id: market.json.market.id, title: 'Integrity Job', category: 'event', description: 'Valid job.', location: 'Phoenix Yard', starts_at: '2026-05-06T12:00:00.000Z', pay_type: 'fixed', pay_amount_cents: 10000, slots: 1, acceptance_mode: 'single', proof_required: true };
  const badPay = await req('POST', '/api/jobs', { ...baseJob, pay_amount_cents: -5 }, providerSession);
  assert(badPay.status === 400, 'bad pay accepted', badPay); pass('rejects_bad_pay');
  const badSlots = await req('POST', '/api/jobs', { ...baseJob, slots: 2 }, providerSession);
  assert(badSlots.status === 400, 'bad single slots accepted', badSlots); pass('rejects_bad_single_slots');
  const badMode = await req('POST', '/api/jobs', { ...baseJob, acceptance_mode: 'anything' }, providerSession);
  assert(badMode.status === 400, 'bad acceptance mode accepted', badMode); pass('rejects_bad_acceptance_mode');

  const job = await req('POST', '/api/jobs', baseJob, providerSession);
  assert(job.status === 201, 'valid job failed', job);
  const app = await req('POST', `/api/jobs/${job.json.job.id}/apply`, { note: 'Ready.' }, contractorSession);
  assert(app.status === 201, 'apply failed', app);
  const accept = await req('POST', `/api/jobs/${job.json.job.id}/accept-applicant`, { application_id: app.json.application.id }, providerSession);
  assert(accept.status === 201, 'accept failed', accept);
  const assignmentId = accept.json.assignment.id;

  const badProofJump = await req('POST', `/api/assignments/${assignmentId}/proof`, { proof_type: 'text', body: 'Too early.' }, contractorSession);
  assert(badProofJump.status === 400, 'proof jump accepted', badProofJump); pass('rejects_proof_before_checkout');
  const badCheckinJump = await req('POST', `/api/assignments/${assignmentId}/check-in`, {}, contractorSession);
  assert(badCheckinJump.status === 400, 'check-in jump accepted', badCheckinJump); pass('rejects_checkin_before_confirm_onway');

  await req('POST', `/api/assignments/${assignmentId}/confirm`, {}, contractorSession);
  const duplicateConfirm = await req('POST', `/api/assignments/${assignmentId}/confirm`, {}, contractorSession);
  assert(duplicateConfirm.status === 400, 'duplicate confirm accepted', duplicateConfirm); pass('rejects_duplicate_transition');
  await req('POST', `/api/assignments/${assignmentId}/on-the-way`, {}, contractorSession);
  await req('POST', `/api/assignments/${assignmentId}/check-in`, {}, contractorSession);
  await req('POST', `/api/assignments/${assignmentId}/check-out`, {}, contractorSession);
  const proofSubmit = await req('POST', `/api/assignments/${assignmentId}/proof`, { proof_type: 'text', body: 'Valid proof.' }, contractorSession);
  assert(proofSubmit.status === 201, 'valid proof failed', proofSubmit);
  const approve = await req('POST', `/api/assignments/${assignmentId}/approve`, {}, providerSession);
  assert(approve.status === 200 && approve.json.payment.status === 'payout_eligible', 'valid approval failed', approve); pass('valid_ordered_assignment_flow_still_passes');

  const badRating = await req('POST', '/api/ratings', { job_id: job.json.job.id, to_user_id: contractor.json.id, score: 7 }, providerSession);
  assert(badRating.status === 400, 'bad rating accepted', badRating); pass('rejects_bad_rating');
  const badPaymentStatus = await req('POST', '/api/house-command/resolve-dispute', { dispute_id: 'missing', payment_status: 'wire_money_now' }, admin);
  assert([400, 404].includes(badPaymentStatus.status), 'bad payment status path accepted', badPaymentStatus); pass('guards_dispute_resolution_inputs');

  proof.completed_at = new Date().toISOString();
  proof.status = 'PASS';
} catch (err) {
  proof.failed_at = new Date().toISOString();
  proof.status = 'FAIL';
  proof.failure = err.message;
  proof.data = err.data || null;
  console.error(err);
  process.exitCode = 1;
} finally {
  const out = path.join(proofDir, `SMOKE_INTEGRITY_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(out, JSON.stringify(proof, null, 2));
  console.log(`Integrity proof written: ${out}`);
  try { process.kill(server.pid, 'SIGKILL'); } catch {}
  process.exit(process.exitCode || 0);
}
