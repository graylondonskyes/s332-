import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn, spawnSync } from 'child_process';

const root = process.cwd();
const proofDir = path.join(root, 'proof');
fs.mkdirSync(proofDir, { recursive: true });

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skyeroutex-deploy-smoke-'));
const port = Number(process.env.DEPLOY_SMOKE_PORT || 5877);
const adminEmail = 'admin@deploy-smoke.internal.invalid';
const adminPassword = 'DeploySmoke123!';
const goodEnv = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: 'production',
  DATABASE_DRIVER: 'local-json',
  DATABASE_PATH: path.join(tmpRoot, 'skyeroutex-db.json'),
  STORAGE_DRIVER: 'local-json',
  MEDIA_ROOT: path.join(tmpRoot, 'proof-media'),
  EXPORT_ROOT: path.join(tmpRoot, 'exports'),
  SKYE_ADMIN_EMAIL: adminEmail,
  SKYE_ADMIN_PASSWORD: adminPassword,
  SKYE_REQUIRE_CSRF: '1',
  COOKIE_SECURE: '1',
  MAX_BODY_BYTES: '1048576',
  RATE_LIMIT_MAX: '120',
  RATE_LIMIT_WINDOW_MS: '60000',
  PAYMENT_PROVIDER: 'payment-webhook',
  PAYMENT_WEBHOOK_ENDPOINT: 'https://example.invalid/payment-webhook',
  PAYMENT_WEBHOOK_SIGNING_SECRET: 'deploy-smoke-payment-secret-12345',
  NOTIFICATION_PROVIDER: 'notification-webhook',
  NOTIFICATION_WEBHOOK_ENDPOINT: 'https://example.invalid/notification-webhook',
  NOTIFICATION_WEBHOOK_SIGNING_SECRET: 'deploy-smoke-notification-secret-12345',
  ROUTE_INTELLIGENCE_PROVIDER: 'mapbox',
  MAPBOX_ACCESS_TOKEN: 'deploy-smoke-mapbox-token',
  IDENTITY_COMPLIANCE_PROVIDER: 'checkr',
  CHECKR_API_KEY: 'deploy-smoke-checkr-key',
  CHECKR_PACKAGE: 'deploy-smoke-package',
  SKYEHANDS_RUNTIME_PROVIDER: 'skyehands-runtime-bus'
};

const proof = {
  started_at: new Date().toISOString(),
  smoke: 'deploy-readiness',
  production_port: port,
  checks: []
};

function pass(name, data = {}) {
  proof.checks.push({ status: 'PASS', name, data });
}

function assert(condition, message, data) {
  if (!condition) {
    const error = new Error(message);
    error.data = data;
    throw error;
  }
}

async function req(method, url, body, headers = {}) {
  const res = await fetch(`http://127.0.0.1:${port}${url}`, {
    method,
    headers: { 'content-type': 'application/json', connection: 'close', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), json };
}

async function waitForHealth() {
  let lastError = null;
  for (let i = 0; i < 80; i++) {
    try {
      const health = await req('GET', '/api/health');
      if (health.status === 200) return health;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 75));
  }
  throw lastError || new Error('Timed out waiting for production health endpoint.');
}

const serverOutput = [];
const server = spawn(process.execPath, ['src/server.js'], {
  cwd: root,
  env: goodEnv,
  stdio: ['ignore', 'pipe', 'pipe']
});
server.stdout.on('data', chunk => serverOutput.push(String(chunk)));
server.stderr.on('data', chunk => serverOutput.push(String(chunk)));

try {
  const health = await waitForHealth();
  assert(health.json.ok === true && health.json.production_mode === true, 'production health did not report ok production mode', health);
  assert(health.json.database_driver === 'local-json' && health.json.storage_driver === 'local-json', 'production health did not report expected local drivers', health);
  pass('production_server_boots_with_safe_env', { health: health.json });

  const readiness = await req('GET', '/api/readiness');
  const failedRequired = readiness.json.checks.filter(check => check.required && !check.ok);
  assert(readiness.status === 200 && readiness.json.ok === true && failedRequired.length === 0, 'production readiness failed required checks', readiness);
  pass('readiness_endpoint_passes_required_checks', {
    production_mode: readiness.json.production_mode,
    checks: readiness.json.checks.map(check => ({ name: check.name, ok: check.ok, required: check.required }))
  });

  const login = await req('POST', '/api/auth/login', { email: adminEmail, password: adminPassword });
  assert(login.status === 200, 'production admin login failed', login);
  const cookie = String(login.headers['set-cookie'] || '');
  assert(cookie.includes('Secure') && cookie.includes('SameSite=Strict') && !cookie.includes(adminPassword), 'production session cookie flags missing', login);
  pass('production_session_cookie_is_secure_and_strict');

  const unsafe = spawnSync(process.execPath, ['src/server.js'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: '5878',
      NODE_ENV: 'production',
      DATABASE_PATH: path.join(tmpRoot, 'unsafe-db.json'),
      SKYE_ADMIN_EMAIL: 'broken-admin@internal.invalid',
      SKYE_ADMIN_PASSWORD: 'UseStrongSecret123!',
      SKYE_REQUIRE_CSRF: '0',
      COOKIE_SECURE: '0',
      PAYMENT_PROVIDER: 'ledger-only',
      NOTIFICATION_PROVIDER: 'in-app-ledger',
      ROUTE_INTELLIGENCE_PROVIDER: 'route-structure-only',
      IDENTITY_COMPLIANCE_PROVIDER: 'local-attestation-ledger',
      SKYEHANDS_RUNTIME_PROVIDER: 'standalone-local-events'
    },
    encoding: 'utf8',
    timeout: 3000
  });
  const unsafeOutput = `${unsafe.stdout}\n${unsafe.stderr}`;
  assert(unsafe.status !== 0 && unsafeOutput.includes('Production safety gate failed'), 'unsafe production defaults were not rejected', { status: unsafe.status, output: unsafeOutput.slice(-1200) });
  pass('production_boot_gate_rejects_unsafe_defaults', { exit_status: unsafe.status });

  proof.completed_at = new Date().toISOString();
  proof.status = 'PASS';
} catch (error) {
  proof.failed_at = new Date().toISOString();
  proof.status = 'FAIL';
  proof.failure = error.message;
  proof.data = error.data || null;
  proof.server_output = serverOutput.join('').slice(-2000);
  console.error(error);
  process.exitCode = 1;
} finally {
  try { process.kill(server.pid, 'SIGKILL'); } catch {}
  const out = path.join(proofDir, `SMOKE_DEPLOY_READINESS_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(out, JSON.stringify(proof, null, 2));
  console.log(`Deploy readiness proof written: ${out}`);
  process.exit(process.exitCode || 0);
}
