import fs from 'fs';
import path from 'path';
import { spawn, spawnSync } from 'child_process';

const root = process.cwd();
const proofDir = path.join(root, 'proof');
fs.mkdirSync(proofDir, { recursive: true });
const dbPath = path.join(root, 'data', 'security-smoke-db.json');
if (fs.existsSync(dbPath)) fs.rmSync(dbPath, { force: true });

const port = 5859;
const baseUrl = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  PORT: String(port),
  DATABASE_PATH: dbPath,
  SKYE_ADMIN_EMAIL: 'admin@security.internal.invalid',
  SKYE_ADMIN_PASSWORD: 'AdminSecurity123!',
  SKYE_ALLOW_LOCAL_PROOF_SERVICES: '1',
  SKYE_REQUIRE_CSRF: '1',
  RATE_LIMIT_MAX: '50',
  RATE_LIMIT_WINDOW_MS: '60000',
  MAX_BODY_BYTES: '4096'
};
const serverOutput = [];
const server = spawn('node', ['src/server.js'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
server.stdout.on('data', chunk => serverOutput.push(String(chunk)));
server.stderr.on('data', chunk => serverOutput.push(String(chunk)));

async function req(method, url, body, headers = {}) {
  const res = await fetch(`${baseUrl}${url}`, { method, headers: { 'content-type': 'application/json', connection: 'close', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), json };
}
function assert(cond, msg, data) { if (!cond) { const e = new Error(msg); e.data = data; throw e; } }

const proof = { started_at: new Date().toISOString(), checks: [] };
const pass = (name, data = {}) => proof.checks.push({ status: 'PASS', name, data });

try {
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`${baseUrl}/api/health`); if (r.ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  const health = await req('GET', '/api/health');
  assert(health.status === 200 && health.headers['x-content-type-options'] === 'nosniff' && health.headers['x-frame-options'] === 'DENY', 'security headers missing', health);
  pass('api_security_headers_present');

  const html = await fetch(`${baseUrl}/`).then(async res => ({ status: res.status, headers: Object.fromEntries(res.headers.entries()), text: await res.text() }));
  assert(html.status === 200 && html.headers['content-security-policy'] && html.headers['content-security-policy'].includes("default-src 'self'"), 'html CSP missing', html);
  pass('html_content_security_policy_present');

  const readiness = await req('GET', '/api/readiness');
  assert(readiness.status === 200 && readiness.json.ok === true && readiness.json.checks.some(c => c.name === 'rate_limit_configured'), 'readiness failed', readiness);
  pass('readiness_reports_security_checks');

  const login = await req('POST', '/api/auth/login', { email: 'admin@security.internal.invalid', password: 'AdminSecurity123!' });
  assert(login.status === 200 && String(login.headers['set-cookie']).includes('SameSite=Strict'), 'strict session cookie missing', login);
  pass('session_cookie_is_strict');

  const blocked = await req('POST', '/api/markets', { city: 'Phoenix', state: 'Arizona' }, { cookie: login.headers['set-cookie'] });
  assert(blocked.status === 403 && blocked.json.error.includes('CSRF'), 'cookie csrf guard failed', blocked);
  pass('cookie_state_change_requires_csrf');

  const allowed = await req('POST', '/api/markets', { city: 'Phoenix', state: 'Arizona' }, { 'x-skye-session': login.json.session });
  assert(allowed.status === 201, 'header session state change should pass', allowed);
  pass('header_session_state_change_allowed');

  const tooLarge = await fetch(`${baseUrl}/api/auth/signup`, { method: 'POST', headers: { 'content-type': 'application/json', connection: 'close' }, body: JSON.stringify({ email: 'large@security.local', password: 'Password123!', name: 'x'.repeat(5000), role: 'contractor' }) }).then(async res => ({ status: res.status, json: await res.json() }));
  assert(tooLarge.status === 500 && tooLarge.json.error.includes('Request body exceeds'), 'body size guard failed', tooLarge);
  pass('request_body_limit_enforced');

  const prod = spawnSync(process.execPath, ['-e', "import('./src/security.js').then(({createSecurity})=>createSecurity().assertProductionReady())"], {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'production', SKYE_ADMIN_EMAIL: 'unsafe-admin@internal.invalid', SKYE_ADMIN_PASSWORD: 'UseStrongSecret123!', COOKIE_SECURE: '0', PAYMENT_PROVIDER: 'ledger-only', NOTIFICATION_PROVIDER: 'in-app-ledger', ROUTE_INTELLIGENCE_PROVIDER: 'route-structure-only', IDENTITY_COMPLIANCE_PROVIDER: 'local-attestation-ledger', SKYEHANDS_RUNTIME_PROVIDER: 'standalone-local-events' },
    encoding: 'utf8',
    timeout: 3000
  });
  assert(prod.status !== 0 && `${prod.stdout}\n${prod.stderr}`.includes('Production safety gate failed'), 'production safety boot gate failed', prod);
  pass('production_mode_refuses_unsafe_defaults');

  proof.completed_at = new Date().toISOString();
  proof.status = 'PASS';
} catch (err) {
  proof.failed_at = new Date().toISOString();
  proof.status = 'FAIL';
  proof.failure = err.message;
  proof.data = err.data || null;
  proof.server_output = serverOutput.join('').slice(-2000);
  console.error(err);
  process.exitCode = 1;
} finally {
  const out = path.join(proofDir, `SMOKE_SECURITY_READINESS_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(out, JSON.stringify(proof, null, 2));
  console.log(`Security/readiness proof written: ${out}`);
  try { process.kill(server.pid, 'SIGKILL'); } catch {}
  process.exit(process.exitCode || 0);
}
