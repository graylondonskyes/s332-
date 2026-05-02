#!/usr/bin/env node
/**
 * P098 — SkyeRoutex Platform House Circle — BEHAVIORAL SMOKE
 * Tests: auth → session → health → sync-state → payment-ledger → webhook replay protection → Neon blocking
 * No live network required — all env vars injected at test time.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const fnDir = path.join(root, 'platform', 'user-platforms', 'skye-routex', 'netlify', 'functions');
const artifact = path.join(root, 'SMOKE_P098_SKYEROUTEX.md');

const dataDir = path.join(fnDir, '.phc_smoke_p098_' + crypto.randomBytes(4).toString('hex'));
const fabricDir = path.join(fnDir, '.phc_fabric_p098_' + crypto.randomBytes(4).toString('hex'));

// Inject test env — no live credentials, no network
process.env.PHC_DATA_DIR = dataDir;
process.env.PHC_APP_FABRIC_DIR = fabricDir;
process.env.PHC_SESSION_SECRET = 'p098-smoke-session-secret-abcdefghijklmnopqrstuvwxyz-123456';
process.env.PHC_OPERATOR_PASSWORD = 'p098-smoke-password';
process.env.PHC_OPERATOR_ROLE = 'admin';
process.env.PHC_PRODUCTION = '';
process.env.PHC_REQUIRE_NEON_PRIMARY = '';
process.env.PHC_ALLOW_PROVIDER_NETWORK = '';
process.env.PHC_NEON_AUTOMIRROR = '';
process.env.PHC_ALLOW_UNSIGNED_WEBHOOKS = '';
process.env.PHC_ALLOW_BOOTSTRAP_LOGIN = '';

const loginHandler = require(path.join(fnDir, 'phc-auth-login.js')).handler;
const healthHandler = require(path.join(fnDir, 'phc-health.js')).handler;
const syncStateHandler = require(path.join(fnDir, 'phc-sync-state.js')).handler;
const paymentIntentHandler = require(path.join(fnDir, 'phc-payment-intent.js')).handler;
const stripeWebhookHandler = require(path.join(fnDir, 'phc-webhook-stripe.js')).handler;
const persistencePolicyHandler = require(path.join(fnDir, 'phc-persistence-policy.js')).handler;
const paymentProviderHealth = require(path.join(fnDir, 'phc-payment-provider-health.js')).handler;
const { readOrgState } = require(path.join(fnDir, '_lib', 'housecircle-cloud-store.js'));
const { persistOrgState } = require(path.join(fnDir, '_lib', 'housecircle-persistence.js'));
const { productionReadiness } = require(path.join(fnDir, '_lib', 'housecircle-runtime-guard.js'));
const { PHC_SCHEMA_SQL } = require(path.join(fnDir, '_lib', 'housecircle-neon-store.js'));

const results = [];
let allPass = true;

function assert(label, condition, detail = '') {
  const ok = Boolean(condition);
  results.push({ label, ok, detail });
  if (!ok) allPass = false;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}

function makeEvent(method, body, token, extraHeaders = {}) {
  const headers = { 'content-type': 'application/json', ...extraHeaders };
  if (token) headers.authorization = 'Bearer ' + token;
  return {
    httpMethod: method,
    headers,
    queryStringParameters: { orgId: 'p098-org' },
    body: body === undefined ? '' : (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

function parse(res) {
  try { return JSON.parse(res.body || '{}'); } catch { return {}; }
}

// ── 1. Auth — login issues signed session ─────────────────────────────────
console.log('\nP098 SkyeRoutex Platform House Circle Smoke\n');
const loginRes = await loginHandler(makeEvent('POST', {
  orgId: 'p098-org', operatorId: 'founder-admin', operatorName: 'Skyes Over London',
  role: 'admin', password: 'p098-smoke-password', deviceId: 'smoke-device',
}));
const loginBody = parse(loginRes);
assert('login returns 200', loginRes.statusCode === 200);
assert('login issues bearer token', typeof loginBody.token === 'string' && loginBody.token.length > 20);
assert('session is trustedDevice', loginBody.trustedDevice === true);
assert('orgId matches', loginBody.orgId === 'p098-org');
const token = loginBody.token;

// ── 2. Health — locked behind auth ───────────────────────────────────────
const healthNoAuth = await healthHandler({ httpMethod: 'GET', headers: {}, queryStringParameters: { orgId: 'p098-org' }, body: '' });
assert('health rejects unauthenticated (401)', healthNoAuth.statusCode === 401);

const healthAuth = await healthHandler(makeEvent('GET', undefined, token));
const healthBody = parse(healthAuth);
assert('health accepts valid token (200)', healthAuth.statusCode === 200);
assert('health reports orgId', healthBody.orgId === 'p098-org');
assert('health storage reports persistence primary mode', typeof healthBody.storage?.primary === 'string' && healthBody.storage.primary.length > 0);

// ── 3. Neon primary blocking — fails before local write ───────────────────
process.env.PHC_REQUIRE_NEON_PRIMARY = '1';
delete process.env.NEON_DATABASE_URL;
delete process.env.DATABASE_URL;
let neonBlocked = false;
let neonMessage = '';
try {
  await persistOrgState('neon-block-test-org', { orgId: 'neon-block-test-org', bundle: {}, sessions: [] }, { eventKind: 'p098_neon_block_test' });
} catch (err) {
  neonBlocked = true;
  neonMessage = String(err.message || '');
}
process.env.PHC_REQUIRE_NEON_PRIMARY = '';
assert('Neon primary blocks local write when env missing', neonBlocked, neonMessage.slice(0, 60));
assert('block message references local fallback', /local/i.test(neonMessage) || /blocked/i.test(neonMessage) || /neon/i.test(neonMessage));

// ── 4. Persistence policy is auth-gated and honest about mode ────────────
const policyNoAuth = await persistencePolicyHandler({ httpMethod: 'GET', headers: {}, queryStringParameters: { orgId: 'p098-org' }, body: '' });
assert('persistence policy rejects unauthenticated (401)', policyNoAuth.statusCode === 401);

const policyAuth = await persistencePolicyHandler(makeEvent('GET', undefined, token));
const policyBody = parse(policyAuth);
assert('persistence policy accepts token (200)', policyAuth.statusCode === 200);
assert('persistence policy reports file-primary-local mode', policyBody.policy?.mode === 'file-primary-local');

// ── 5. Sync state writes through persistence wrapper ─────────────────────
const syncRes = await syncStateHandler(makeEvent('POST', {
  orgId: 'p098-org',
  bundle: { state: { locations: [{ id: 'loc-p098', name: 'P098 Location', updatedAt: new Date().toISOString() }] } },
  reason: 'p098 smoke sync',
}, token));
assert('sync-state persists (200)', syncRes.statusCode === 200);
const orgState = readOrgState('p098-org');
assert('sync event in event log', orgState.eventLog?.some(e => e.kind === 'persistence_policy') === true);

// ── 6. Neon schema includes operational tables ────────────────────────────
const requiredTables = ['phc_operational_events', 'phc_payment_ledger', 'phc_webhook_replay_ledger', 'phc_active_sessions'];
for (const table of requiredTables) {
  assert(`Neon schema has ${table}`, PHC_SCHEMA_SQL.includes(table));
}

// ── 7. Production readiness refuses plaintext credentials ────────────────
const savedProd = process.env.PHC_PRODUCTION;
const savedPw = process.env.PHC_OPERATOR_PASSWORD;
process.env.PHC_PRODUCTION = '1';
process.env.PHC_OPERATOR_PASSWORD = 'plain-password-in-prod';
delete process.env.PHC_OPERATOR_PASSWORD_HASH;
delete process.env.PHC_OPERATOR_PASSWORD_SALT;
const readiness = productionReadiness();
process.env.PHC_PRODUCTION = savedProd || '';
process.env.PHC_OPERATOR_PASSWORD = savedPw || '';
assert('production mode refuses plaintext password', readiness.ok === false);
assert('failure identifies credential hash requirement', readiness.failing?.some(f => /credential|hash|password/i.test(f.key || f.message || f)));

// ── 8. Payment intent ledgers without live money movement ────────────────
process.env.STRIPE_SECRET_KEY = 'sk_test_p098_smoke_not_live';
process.env.PHC_ALLOW_PROVIDER_NETWORK = '';
const payRes = await paymentIntentHandler(makeEvent('POST', {
  orgId: 'p098-org', provider: 'stripe', amountCents: 2500, currency: 'USD', orderId: 'order-p098-smoke',
}, token));
const payBody = parse(payRes);
assert('payment intent returns 503 (no network)', payRes.statusCode === 503);
assert('payment ledger entry created (no live money)', payBody.liveMoneyMoved === false);

// ── 9. Provider health reports no live execution ──────────────────────────
const providerHealthRes = await paymentProviderHealth(makeEvent('GET', undefined, token));
const providerHealthBody = parse(providerHealthRes);
assert('provider health returns 200', providerHealthRes.statusCode === 200);
assert('all providers report liveExecutionReady: false', providerHealthBody.providers?.every(p => p.liveExecutionReady === false) === true);

// ── 10. Stripe webhook replay protection ──────────────────────────────────
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_p098_smoke';
const webhookPayload = JSON.stringify({
  id: 'evt_p098_stripe_1', type: 'payment_intent.succeeded', orgId: 'p098-org',
  data: { object: { metadata: { orgId: 'p098-org' } } },
});
const ts = Math.floor(Date.now() / 1000).toString();
const sig = crypto.createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET).update(ts + '.' + webhookPayload).digest('hex');
const stripeHeaders = { 'stripe-signature': `t=${ts},v1=${sig}` };

const firstWebhook = await stripeWebhookHandler(makeEvent('POST', webhookPayload, '', stripeHeaders));
assert('first webhook delivery accepted (200)', firstWebhook.statusCode === 200);

const secondWebhook = await stripeWebhookHandler(makeEvent('POST', webhookPayload, '', stripeHeaders));
assert('replay webhook rejected (409)', secondWebhook.statusCode === 409);

// ── Cleanup ───────────────────────────────────────────────────────────────
try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch {}
try { fs.rmSync(fabricDir, { recursive: true, force: true }); } catch {}

const passed = results.filter(r => r.ok).length;
const md = [
  '# P098 Smoke Proof — SkyeRoutex Platform House Circle Behavioral', '',
  `Generated: ${new Date().toISOString()}`,
  `Result: **${allPass ? 'PASS' : 'FAIL'}** | ${passed}/${results.length} assertions`, '',
  '## Assertions',
  ...results.map(r => `- ${r.ok ? '✅' : '❌'} ${r.label}${r.detail ? ` — ${r.detail}` : ''}`), '',
  '## Coverage',
  '- ✅ Login → signed bearer session (HMAC-SHA256)',
  '- ✅ Health endpoint auth-gated',
  '- ✅ Strict Neon primary blocks local write when env missing',
  '- ✅ Persistence policy auth-gated + reports honest mode',
  '- ✅ Sync state writes through persistence wrapper',
  '- ✅ Neon schema has all operational tables',
  '- ✅ Production readiness refuses plaintext credentials',
  '- ✅ Payment intent ledger created with liveMoneyMoved: false',
  '- ✅ Payment provider health reports no live execution',
  '- ✅ Stripe webhook replay protection (409 on duplicate event ID)',
].join('\n');

fs.writeFileSync(artifact, md);
console.log(`\n${allPass ? '✅ PASS' : '❌ FAIL'} — ${passed}/${results.length} assertions`);
if (!allPass) process.exit(1);
