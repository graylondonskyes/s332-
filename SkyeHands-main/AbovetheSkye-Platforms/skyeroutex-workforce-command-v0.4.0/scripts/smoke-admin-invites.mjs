import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const root = process.cwd();
const proofDir = path.join(root, 'proof');
fs.mkdirSync(proofDir, { recursive: true });
const dbPath = path.join(root, 'data', 'admin-invites-smoke-db.json');
if (fs.existsSync(dbPath)) fs.rmSync(dbPath, { force: true });

const port = 5897;
const base = `http://127.0.0.1:${port}`;
const env = { ...process.env, PORT: String(port), DATABASE_PATH: dbPath, SKYE_ADMIN_EMAIL: 'admin@invites.internal.invalid', SKYE_ADMIN_PASSWORD: 'AdminInvite123!' };
const server = spawn('node', ['src/server.js'], { cwd: root, env, stdio: 'ignore' });

async function req(method, url, body, session) {
  const headers = { 'content-type': 'application/json', connection: 'close' };
  if (session) headers['x-skye-session'] = session;
  const res = await fetch(`${base}${url}`, { method, headers, body: body == null ? undefined : JSON.stringify(body) });
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
    try { const r = await fetch(`${base}/api/health`); if (r.ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  const admin = await login('admin@invites.internal.invalid', 'AdminInvite123!');
  pass('admin_login');

  const contractor = await req('POST', '/api/auth/signup', { email: 'plain@invites.local', password: 'Contractor123!', name: 'Plain Contractor', role: 'contractor' });
  assert(contractor.status === 201, 'contractor signup failed', contractor);
  const contractorSession = await login('plain@invites.local', 'Contractor123!');
  const forbidden = await req('POST', '/api/admin/invites', { email: 'blocked@invites.local', role: 'contractor' }, contractorSession);
  assert(forbidden.status === 403, 'non-admin created invite', forbidden);
  pass('non_admin_cannot_create_invite');

  const invalidRole = await req('POST', '/api/admin/invites', { email: 'badrole@invites.local', role: 'admin' }, admin);
  assert(invalidRole.status === 400 && invalidRole.json.error.includes('Invite role'), 'invalid invite role accepted', invalidRole);
  pass('rejects_unapproved_invite_role');

  const created = await req('POST', '/api/admin/invites', { email: 'provider-invite@example.test', role: 'provider', name: 'Invited Provider', expires_in_hours: 24 }, admin);
  assert(created.status === 201 && created.json.token && !created.json.invite.token_hash, 'invite create failed or leaked token hash', created);
  pass('admin_created_single_use_invite', { inviteId: created.json.invite.id, role: created.json.invite.role });

  const listed = await req('GET', '/api/admin/invites', null, admin);
  assert(listed.status === 200 && listed.json.invites.some(i => i.id === created.json.invite.id) && listed.json.invites.every(i => !i.token_hash), 'invite list failed or leaked token hash', listed);
  pass('admin_lists_invites_without_token_hash');

  const acceptMissingProfile = await req('POST', '/api/auth/accept-invite', { token: created.json.token, password: 'ProviderInvite123!' });
  assert(acceptMissingProfile.status === 400 && acceptMissingProfile.json.error.includes('company_name'), 'provider invite accepted without company_name', acceptMissingProfile);
  pass('provider_invite_requires_company_profile');

  const accepted = await req('POST', '/api/auth/accept-invite', { token: created.json.token, password: 'ProviderInvite123!', company_name: 'Invited Provider Co', city: 'Phoenix', state: 'Arizona' });
  assert(accepted.status === 201 && accepted.json.user.email === 'provider-invite@example.test' && accepted.json.user.role === 'provider' && !accepted.json.user.password_hash, 'invite acceptance failed', accepted);
  pass('invite_acceptance_creates_provider_user', { userId: accepted.json.user.id });

  const acceptedLogin = await req('POST', '/api/auth/login', { email: 'provider-invite@example.test', password: 'ProviderInvite123!' });
  assert(acceptedLogin.status === 200 && acceptedLogin.json.user.role === 'provider', 'invited user cannot login', acceptedLogin);
  pass('invited_user_can_login');

  const reuse = await req('POST', '/api/auth/accept-invite', { token: created.json.token, password: 'ProviderInvite123!', company_name: 'Reuse Co' });
  assert(reuse.status === 409 && reuse.json.error.includes('already been used'), 'invite token reuse was not blocked', reuse);
  pass('invite_token_is_single_use');

  const duplicate = await req('POST', '/api/admin/invites', { email: 'provider-invite@example.test', role: 'provider' }, admin);
  assert(duplicate.status === 409, 'invite allowed for existing user email', duplicate);
  pass('cannot_invite_existing_email');

  const audit = await req('GET', '/api/admin/audit-events', null, admin);
  assert(audit.status === 200 && audit.json.audit_events.some(a => a.event_type === 'admin_invite_created') && audit.json.audit_events.some(a => a.event_type === 'invite_accepted'), 'invite audit events missing', audit);
  pass('invite_lifecycle_audited');

  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  assert(db.provider_profiles.some(p => p.user_id === accepted.json.user.id && p.company_name === 'Invited Provider Co'), 'provider profile missing', db.provider_profiles);
  assert(db.admin_invites.some(i => i.id === created.json.invite.id && i.used_by === accepted.json.user.id && i.token_hash && !i.token), 'stored invite metadata wrong', db.admin_invites);
  pass('local_db_persisted_profile_and_hashed_invite');

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
  const out = path.join(proofDir, `SMOKE_ADMIN_INVITES_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(out, JSON.stringify(proof, null, 2));
  console.log(`Admin invite proof written: ${out}`);
  try { process.kill(server.pid, 'SIGKILL'); } catch {}
  process.exit(process.exitCode || 0);
}
