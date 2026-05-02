import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { verifyAuditChain } from '../src/audit-chain.js';

const root = process.cwd();
const proofDir = path.join(root, 'proof');
fs.mkdirSync(proofDir, { recursive: true });
const dbPath = path.join(root, 'data', 'reset-smoke-db.json');
if (fs.existsSync(dbPath)) fs.rmSync(dbPath, { force: true });

function assert(cond, msg, data) {
  if (!cond) {
    const error = new Error(msg);
    error.data = data;
    throw error;
  }
}

const proof = { started_at: new Date().toISOString(), checks: [] };
const pass = (name, data = {}) => proof.checks.push({ status: 'PASS', name, data });

try {
  const env = {
    ...process.env,
    DATABASE_PATH: dbPath,
    DATABASE_DRIVER: 'local-json',
    SKYE_ADMIN_EMAIL: 'admin-reset-smoke@skyeroutex.local',
    SKYE_ADMIN_PASSWORD: 'AdminReset123!'
  };
  const reset = spawnSync('node', ['scripts/reset-db.mjs'], { cwd: root, env, encoding: 'utf8' });
  assert(reset.status === 0, 'reset-db failed', { status: reset.status, stdout: reset.stdout, stderr: reset.stderr });
  pass('reset_command_completed', { stdout: reset.stdout.trim() });

  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  assert(db.users.length === 1 && db.users[0].email === env.SKYE_ADMIN_EMAIL, 'reset admin user missing', db.users);
  pass('reset_seeded_admin_user');

  assert(db.audit_events.length === 1 && db.audit_events[0].event_type === 'admin_seeded', 'reset audit seed missing', db.audit_events);
  assert(db.audit_events[0].previous_hash === null && db.audit_events[0].event_hash, 'reset audit seed is not hash-chained', db.audit_events[0]);
  const chain = verifyAuditChain(db.audit_events);
  assert(chain.ok && chain.event_count === 1 && chain.head_hash === db.audit_events[0].event_hash, 'reset audit chain verification failed', chain);
  pass('reset_seed_audit_event_is_tamper_evident', chain);

  const external = spawnSync('node', ['scripts/reset-db.mjs'], {
    cwd: root,
    env: { ...process.env, DATABASE_DRIVER: 'postgres', DATABASE_PATH: dbPath },
    encoding: 'utf8'
  });
  assert(external.status !== 0 && external.stderr.includes('must provide its own migration/reset command'), 'external reset driver did not fail closed', { status: external.status, stderr: external.stderr });
  pass('reset_fails_closed_for_external_database_driver');

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
  const out = path.join(proofDir, `SMOKE_RESET_DB_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(out, JSON.stringify(proof, null, 2));
  console.log(`Reset DB proof written: ${out}`);
  process.exit(process.exitCode || 0);
}
