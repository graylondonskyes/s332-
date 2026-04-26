import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index.js';
import {
  enforceCarrierProviderPolicy,
  enforceChannelProviderPolicy,
  enforcePaymentProviderPolicy,
  enforceProviderPreviewPolicy,
  productionRuntimeReadiness
} from '../src/lib/production-hardening.js';
import { sha256Hex, signToken } from '../src/lib/utils.js';

const SESSION_SECRET = 'production-hardening-secret';

async function merchantCookie() {
  const token = await signToken(SESSION_SECRET, { sid: 'sess_prod', role: 'merchant_owner', merchantId: 'm1', email: 'owner@test.local', exp: Date.now() + 60_000 });
  return { token, hash: await sha256Hex(token), cookie: `skye_session=${encodeURIComponent(token)}` };
}

function makeD1(state = {}) {
  state.sessions ||= [];
  state.rateLimits ||= [];
  state.validations ||= [];
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
              if (/FROM api_rate_limits/.test(sql)) return state.rateLimits.find((row) => row.bucket_key === bindings[0]) || null;
              if (/COUNT\(\*\) AS count/.test(sql)) return { count: 0 };
              return null;
            },
            run: async () => {
              if (/INSERT INTO api_rate_limits/.test(sql)) state.rateLimits.push({ bucket_key: bindings[0], request_count: bindings[7] });
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

test('production policies require live providers', () => {
  assert.equal(enforceProviderPreviewPolicy().code, 'PROVIDER_PREVIEW_REMOVED');
  assert.equal(enforcePaymentProviderPolicy('cash').code, 'LIVE_PAYMENT_PROVIDER_REQUIRED');
  assert.equal(enforcePaymentProviderPolicy('stripe').ok, true);
  assert.equal(enforcePaymentProviderPolicy('paypal').ok, true);
  assert.equal(enforceCarrierProviderPolicy('manual').code, 'LIVE_CARRIER_PROVIDER_REQUIRED');
  assert.equal(enforceCarrierProviderPolicy('ups').ok, true);
  assert.equal(enforceChannelProviderPolicy('file_export').code, 'LIVE_CHANNEL_PROVIDER_REQUIRED');
  assert.equal(enforceChannelProviderPolicy('google_merchant').ok, true);
});

test('production readiness fails closed until live controls are configured', () => {
  const readiness = productionRuntimeReadiness({ COMMERCE_PRODUCTION_ENFORCEMENT: 'true', SESSION_SECRET });
  assert.equal(readiness.ok, false);
  assert.ok(readiness.blockers.includes('provider_config_encryption_key_missing'));
  assert.ok(readiness.blockers.includes('cors_allowed_origins_missing'));

  const pass = productionRuntimeReadiness({
    COMMERCE_PRODUCTION_ENFORCEMENT: 'true',
    SESSION_SECRET,
    PROVIDER_CONFIG_ENCRYPTION_KEY: 'test-encryption-key',
    CORS_ALLOWED_ORIGINS: 'https://merchant.test'
  });
  assert.equal(pass.ok, true);
  assert.deepEqual(pass.controls.paymentProviders, ['stripe', 'paypal']);
});

test('provider preview route is gone from the production package', async () => {
  const cookie = await merchantCookie();
  const state = { sessions: [{ token_hash: cookie.hash, merchant_id: 'm1', email: 'owner@test.local', role: 'merchant_owner', expires_at: '2999-01-01T00:00:00.000Z', slug: 'store', brand_name: 'Store' }] };
  const env = {
    DB: makeD1(state),
    SESSION_SECRET,
    COMMERCE_PRODUCTION_ENFORCEMENT: 'true',
    PROVIDER_CONFIG_ENCRYPTION_KEY: 'test-encryption-key',
    CORS_ALLOWED_ORIGINS: 'https://commerce.test',
    CSRF_ENFORCEMENT: 'false'
  };
  const response = await app.fetch(new Request('https://commerce.test/api/provider-connections/preview', { method: 'POST', headers: { cookie: cookie.cookie, 'content-type': 'application/json', origin: 'https://commerce.test' }, body: JSON.stringify({ provider: 'stripe' }) }), env);
  const data = await response.json();
  assert.equal(response.status, 404);
  assert.match(String(data.error || ''), /removed/i);
});

test('production readiness route exposes blocking controls', async () => {
  const cookie = await merchantCookie();
  const state = { sessions: [{ token_hash: cookie.hash, merchant_id: 'm1', email: 'owner@test.local', role: 'merchant_owner', expires_at: '2999-01-01T00:00:00.000Z', slug: 'store', brand_name: 'Store' }] };
  const env = {
    DB: makeD1(state),
    SESSION_SECRET,
    COMMERCE_PRODUCTION_ENFORCEMENT: 'true',
    PROVIDER_CONFIG_ENCRYPTION_KEY: 'test-encryption-key',
    CORS_ALLOWED_ORIGINS: 'https://commerce.test',
    CSRF_ENFORCEMENT: 'false'
  };
  const response = await app.fetch(new Request('https://commerce.test/api/system/production-readiness', { method: 'GET', headers: { cookie: cookie.cookie, origin: 'https://commerce.test' } }), env);
  const data = await response.json();
  assert.equal(response.status, 409);
  assert.equal(data.production.enforced, true);
  assert.ok(data.production.blockers.includes('csrf_enforcement_disabled'));
  assert.equal(data.production.controls.providerPreviewRemoved, true);
});
