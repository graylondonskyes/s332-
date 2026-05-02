import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const root = process.cwd();
const proofDir = path.join(root, 'proof');
fs.mkdirSync(proofDir, { recursive: true });
const dbPath = path.join(root, 'data', 'auth-control-smoke-db.json');
if (fs.existsSync(dbPath)) fs.rmSync(dbPath, { force: true });

const port = 5893;
const env = { ...process.env, PORT: String(port), DATABASE_PATH: dbPath, SKYE_ADMIN_EMAIL: 'admin@auth.internal.invalid', SKYE_ADMIN_PASSWORD: 'AdminAuth123!' };
const server = spawn('node', ['src/server.js'], { cwd: root, env, stdio: 'ignore' });

async function req(method, url, body, session) {
  const headers = { 'content-type': 'application/json', connection: 'close' };
  if (session) headers['x-skye-session'] = session;
  const res = await fetch(`http://localhost:${port}${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), json };
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

  const weak = await req('POST', '/api/auth/signup', { email: 'weak@auth.local', password: 'short', name: 'Weak User', role: 'contractor' });
  assert(weak.status === 400 && weak.json.error.includes('Password'), 'weak password accepted', weak);
  pass('rejects_weak_signup_password');

  const admin = await login('admin@auth.internal.invalid', 'AdminAuth123!');
  const created = await req('POST', '/api/auth/signup', { email: 'contractor-auth@example.test', password: 'Contractor123!', name: 'Auth Contractor', role: 'contractor', city: 'Phoenix', state: 'Arizona' });
  assert(created.status === 201, 'contractor signup failed', created);
  const contractorSession = await login('contractor-auth@example.test', 'Contractor123!');
  const meBefore = await req('GET', '/api/me', null, contractorSession);
  assert(meBefore.status === 200, 'contractor session not active before logout', meBefore);
  pass('contractor_session_active_before_logout');

  const logout = await req('POST', '/api/auth/logout', {}, contractorSession);
  assert(logout.status === 200 && logout.json.removed === 1, 'logout did not remove session', logout);
  const meAfterLogout = await req('GET', '/api/me', null, contractorSession);
  assert(meAfterLogout.status === 401, 'logged out session still works', meAfterLogout);
  pass('logout_revokes_session');

  const contractorSession2 = await login('contractor-auth@example.test', 'Contractor123!');
  const users = await req('GET', '/api/admin/users', null, admin);
  assert(users.status === 200 && users.json.users.some(u => u.email === 'contractor-auth@example.test' && !u.password_hash), 'admin users did not hide password hashes', users);
  pass('admin_users_hides_password_hashes');

  const status = await req('POST', `/api/admin/users/${created.json.id}/status`, { status: 'suspended' }, admin);
  assert(status.status === 200 && status.json.user.status === 'suspended', 'suspend failed', status);
  const meAfterSuspend = await req('GET', '/api/me', null, contractorSession2);
  assert(meAfterSuspend.status === 401, 'suspended user existing session still works', meAfterSuspend);
  const suspendedLogin = await req('POST', '/api/auth/login', { email: 'contractor-auth@example.test', password: 'Contractor123!' });
  assert(suspendedLogin.status === 403 && suspendedLogin.json.error.includes('suspended'), 'suspended user can still login', suspendedLogin);
  pass('suspension_revokes_sessions_and_blocks_login');

  const invalidStatus = await req('POST', `/api/admin/users/${created.json.id}/status`, { status: 'superuser' }, admin);
  assert(invalidStatus.status === 400, 'invalid user status accepted', invalidStatus);
  pass('rejects_invalid_user_status');

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
  const out = path.join(proofDir, `SMOKE_AUTH_CONTROL_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(out, JSON.stringify(proof, null, 2));
  console.log(`Auth control proof written: ${out}`);
  try { process.kill(server.pid, 'SIGKILL'); } catch {}
  process.exit(process.exitCode || 0);
}
