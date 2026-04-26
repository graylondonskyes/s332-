import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index.js';
import { encryptProviderConfig } from '../src/lib/secure-config.js';
import { sha256Hex, signToken } from '../src/lib/utils.js';

const SESSION_SECRET = 'provider-validation-secret';

async function merchantCookie() {
  const token = await signToken(SESSION_SECRET, { sid: 'sessraw_pval', role: 'merchant_owner', merchantId: 'm1', email: 'owner@test.local', exp: Date.now() + 60_000 });
  return { token, hash: await sha256Hex(token), cookie: `skye_session=${encodeURIComponent(token)}` };
}

function makeD1(state = {}) {
  state.sessions ||= [];
  state.providerConnections ||= [];
  state.validations ||= [];
  state.auditEvents ||= [];
  state.rateLimits ||= [];
  return {
    prepare(sql) {
      return {
        bind(...bindings) {
          return {
            all: async () => {
              if (/FROM provider_validation_runs/.test(sql)) return { results: state.validations };
              return { results: [] };
            },
            first: async () => {
              if (/FROM sessions/.test(sql)) return state.sessions.find((row) => row.token_hash === bindings[0]) || null;
              if (/FROM provider_connections/.test(sql)) return state.providerConnections.find((row) => row.merchant_id === bindings[0] && row.id === bindings[1]) || null;
              if (/FROM provider_validation_runs/.test(sql)) return state.validations.find((row) => row.id === bindings[0]) || null;
              if (/FROM api_rate_limits/.test(sql)) return state.rateLimits.find((row) => row.bucket_key === bindings[0]) || null;
              return null;
            },
            run: async () => {
              if (/INSERT INTO provider_validation_runs/.test(sql)) {
                state.validations.push({ id: bindings[0], merchant_id: bindings[1], connection_id: bindings[2], provider: bindings[3], mode: bindings[4], status: bindings[5], http_status: bindings[6], missing_json: bindings[7], result_json: bindings[8], error: bindings[9], created_at: 'now' });
              }
              if (/INSERT INTO audit_events/.test(sql)) {
                state.auditEvents.push({ id: bindings[0], merchant_id: bindings[1], event_type: bindings[4], summary: bindings[5], target_id: bindings[7], meta_json: bindings[8] });
              }
              if (/INSERT INTO api_rate_limits/.test(sql)) {
                state.rateLimits.push({ bucket_key: bindings[0], request_count: bindings[7] });
              }
              if (/UPDATE api_rate_limits SET request_count/.test(sql)) {
                const row = state.rateLimits.find((item) => item.bucket_key === bindings[1]);
                if (row) row.request_count = bindings[0];
              }
              return { success: true };
            }
          };
        }
      };
    }
  };
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

test('provider validation route executes live health and records proof run', async () => {
  const state = {};
  const cookie = await merchantCookie();
  const env = { DB: makeD1(state), SESSION_SECRET, STRIPE_SECRET_KEY: 'sk_test_validation', STRIPE_WEBHOOK_SECRET: 'whsec_validation', CSRF_ENFORCEMENT: 'false' };
  state.sessions.push({ token_hash: cookie.hash, merchant_id: 'm1', email: 'owner@test.local', role: 'merchant_owner', expires_at: '2999-01-01T00:00:00.000Z', slug: 'merchant-store', brand_name: 'Merchant Store' });
  state.providerConnections.push({ id: 'pcon_1', merchant_id: 'm1', name: 'Stripe', provider: 'stripe', environment: 'production', account_label: '', endpoint_base: 'https://api.stripe.test', config_json: JSON.stringify(await encryptProviderConfig(env, {})), config_encrypted: 1, active: 1, created_at: 'now', updated_at: 'now' });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ id: 'acct_validation', object: 'account' }), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    const response = await app.fetch(new Request('https://commerce.test/api/provider-connections/pcon_1/validate', { method: 'POST', headers: { cookie: cookie.cookie, 'content-type': 'application/json' }, body: '{}' }), env);
    const data = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(state.validations.length, 1);
    assert.equal(state.validations[0].status, 'passed');
    assert.equal(state.auditEvents[0].event_type, 'provider.validation');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('provider validation route records missing-secret failures instead of fake green', async () => {
  const state = {};
  const cookie = await merchantCookie();
  const env = { DB: makeD1(state), SESSION_SECRET, CSRF_ENFORCEMENT: 'false' };
  state.sessions.push({ token_hash: cookie.hash, merchant_id: 'm1', email: 'owner@test.local', role: 'merchant_owner', expires_at: '2999-01-01T00:00:00.000Z', slug: 'merchant-store', brand_name: 'Merchant Store' });
  state.providerConnections.push({ id: 'pcon_1', merchant_id: 'm1', name: 'Stripe', provider: 'stripe', environment: 'production', account_label: '', endpoint_base: 'https://api.stripe.test', config_json: JSON.stringify(await encryptProviderConfig(env, {})), config_encrypted: 1, active: 1, created_at: 'now', updated_at: 'now' });

  const response = await app.fetch(new Request('https://commerce.test/api/provider-connections/pcon_1/validate', { method: 'POST', headers: { cookie: cookie.cookie, 'content-type': 'application/json' }, body: '{}' }), env);
  const data = await readJson(response);
  assert.equal(response.status, 409);
  assert.equal(data.code, 'PROVIDER_SECRETS_MISSING');
  assert.equal(state.validations.length, 1);
  assert.equal(state.validations[0].status, 'missing_secrets');
  assert.deepEqual(JSON.parse(state.validations[0].missing_json), ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']);
});
