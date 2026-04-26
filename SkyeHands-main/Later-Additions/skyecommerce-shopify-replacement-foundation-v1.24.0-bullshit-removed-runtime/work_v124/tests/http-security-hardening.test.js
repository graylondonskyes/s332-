import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index.js';
import { enforceApiBodyLimit, optionsResponse, resolveCorsOrigin, runtimeSecurityReadiness } from '../src/lib/http-hardening.js';

const SESSION_SECRET = 'http-hardening-secret';

function makeRateLimitD1(state = {}) {
  state.rateLimits ||= [];
  state.idempotency ||= [];
  return {
    prepare(sql) {
      return {
        bind(...bindings) {
          return {
            all: async () => ({ results: [] }),
            first: async () => {
              if (/FROM api_rate_limits/.test(sql)) return state.rateLimits.find((row) => row.bucket_key === bindings[0]) || null;
              if (/FROM idempotency_records/.test(sql)) return state.idempotency.find((row) => row.scope_hash === bindings[0] && row.idempotency_key === bindings[1] && row.method === bindings[2] && row.path === bindings[3]) || null;
              return null;
            },
            run: async () => {
              if (/INSERT INTO api_rate_limits/.test(sql)) {
                state.rateLimits.push({ bucket_key: bindings[0], bucket_name: bindings[1], identity_hash: bindings[2], method: bindings[3], path: bindings[4], window_start: bindings[5], window_seconds: bindings[6], request_count: bindings[7], limit_count: bindings[8] });
              }
              if (/UPDATE api_rate_limits SET request_count/.test(sql)) {
                const row = state.rateLimits.find((item) => item.bucket_key === bindings[1]);
                if (row) row.request_count = bindings[0];
              }
              if (/INSERT OR REPLACE INTO idempotency_records/.test(sql)) {
                const row = { scope_hash: bindings[0], idempotency_key: bindings[1], method: bindings[2], path: bindings[3], body_hash: bindings[4], status: bindings[5], response_headers_json: bindings[6], response_body: bindings[7] };
                const index = state.idempotency.findIndex((item) => item.scope_hash === row.scope_hash && item.idempotency_key === row.idempotency_key && item.method === row.method && item.path === row.path);
                if (index >= 0) state.idempotency[index] = row; else state.idempotency.push(row);
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

test('CORS preflight denies unlisted origins and echoes allowed origins only', async () => {
  const env = { SESSION_SECRET, ALLOWED_ORIGINS: 'https://merchant.example' };
  assert.equal(resolveCorsOrigin(new Request('https://commerce.test/api/health', { headers: { origin: 'https://merchant.example' } }), env), 'https://merchant.example');
  assert.equal(resolveCorsOrigin(new Request('https://commerce.test/api/health', { headers: { origin: 'https://evil.example' } }), env), '');

  const allowed = optionsResponse(new Request('https://commerce.test/api/health', { method: 'OPTIONS', headers: { origin: 'https://merchant.example' } }), env);
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://merchant.example');

  const denied = optionsResponse(new Request('https://commerce.test/api/health', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }), env);
  assert.equal(denied.status, 403);
  assert.equal((await readJson(denied)).code, 'cors_origin_denied');
});

test('API body limit blocks oversized JSON before route execution', async () => {
  const env = { SESSION_SECRET, MAX_API_BODY_BYTES: '12' };
  const blocked = await enforceApiBodyLimit(new Request('https://commerce.test/api/products', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ value: 'this-is-too-large' })
  }), env);
  assert.equal(blocked.status, 413);
  assert.equal((await readJson(blocked)).code, 'request_body_too_large');
});

test('API mutation rate limiter blocks after configured bucket limit', async () => {
  const state = {};
  const env = { DB: makeRateLimitD1(state), SESSION_SECRET, API_MUTATION_RATE_LIMIT_PER_MINUTE: '2', CSRF_ENFORCEMENT: 'false' };
  for (let index = 0; index < 2; index += 1) {
    const response = await app.fetch(new Request('https://commerce.test/api/auth/logout', { method: 'POST', headers: { 'cf-connecting-ip': '198.51.100.1' }, body: '{}' }), env);
    assert.equal(response.status, 200);
  }
  const blocked = await app.fetch(new Request('https://commerce.test/api/auth/logout', { method: 'POST', headers: { 'cf-connecting-ip': '198.51.100.1' }, body: '{}' }), env);
  assert.equal(blocked.status, 429);
  assert.equal((await readJson(blocked)).code, 'rate_limited');
});

test('security readiness reflects hardened defaults', () => {
  const readiness = runtimeSecurityReadiness({ MAX_API_BODY_BYTES: '65536', ALLOWED_ORIGINS: 'https://merchant.example' });
  assert.equal(readiness.csrfEnforced, true);
  assert.equal(readiness.apiRateLimitEnabled, true);
  assert.equal(readiness.corsAllowAll, false);
  assert.equal(readiness.allowedOriginsConfigured, 1);
  assert.equal(readiness.maxApiBodyBytes, 65536);
});
