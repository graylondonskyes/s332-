import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { verifyAuditChain } from '../src/audit-chain.js';

const root = process.cwd();
const proofDir = path.join(root, 'proof');
fs.mkdirSync(proofDir, { recursive: true });
const dbPath = path.join(root, 'data', 'audit-chain-smoke-db.json');
if (fs.existsSync(dbPath)) fs.rmSync(dbPath, { force: true });

const port = 5891;
const env = { ...process.env, PORT: String(port), DATABASE_PATH: dbPath, SKYE_ADMIN_EMAIL: 'admin@audit.internal.invalid', SKYE_ADMIN_PASSWORD: 'AdminAudit123!' };
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

const proof = { started_at: new Date().toISOString(), checks: [] };
const pass = (name, data = {}) => proof.checks.push({ status: 'PASS', name, data });

try {
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`http://localhost:${port}/api/health`); if (r.ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  const login = await req('POST', '/api/auth/login', { email: 'admin@audit.internal.invalid', password: 'AdminAudit123!' });
  assert(login.status === 200, 'admin login failed', login);
  const session = login.json.session;

  const market = await req('POST', '/api/markets', { city: 'Phoenix', state: 'Arizona', status: 'open' }, session);
  assert(market.status === 201, 'market failed', market);
  const provider = await req('POST', '/api/auth/signup', { email: 'provider-audit@example.test', password: 'Provider123!', name: 'Audit Provider', role: 'provider', company_name: 'Audit Co', city: 'Phoenix', state: 'Arizona' });
  assert(provider.status === 201, 'provider signup failed', provider);
  pass('generated_multiple_audit_events');

  const integrity = await req('GET', '/api/admin/audit-integrity', null, session);
  assert(integrity.status === 200 && integrity.json.audit_integrity.ok && integrity.json.audit_integrity.event_count >= 3 && integrity.json.audit_integrity.head_hash, 'audit integrity endpoint failed', integrity);
  pass('audit_integrity_endpoint_reports_valid_chain', integrity.json.audit_integrity);

  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const local = verifyAuditChain(db.audit_events);
  assert(local.ok && local.head_hash === integrity.json.audit_integrity.head_hash, 'local audit verification failed', local);
  pass('local_audit_verifier_matches_endpoint');

  const tampered = JSON.parse(JSON.stringify(db.audit_events));
  tampered[1].event_type = 'tampered_event_name';
  const tamperResult = verifyAuditChain(tampered);
  assert(!tamperResult.ok && tamperResult.failures.some(f => f.type === 'event_hash_mismatch'), 'tamper was not detected', tamperResult);
  pass('tamper_detection_catches_mutated_event', tamperResult);

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
  const out = path.join(proofDir, `SMOKE_AUDIT_CHAIN_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(out, JSON.stringify(proof, null, 2));
  console.log(`Audit chain proof written: ${out}`);
  try { process.kill(server.pid, 'SIGKILL'); } catch {}
  process.exit(process.exitCode || 0);
}
