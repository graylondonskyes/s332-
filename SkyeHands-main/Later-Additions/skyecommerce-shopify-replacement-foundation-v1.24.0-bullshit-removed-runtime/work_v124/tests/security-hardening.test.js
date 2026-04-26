import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index.js';
import { createCsrfToken, CSRF_COOKIE } from '../src/lib/security.js';

const SESSION_SECRET = 'truth-hardening-secret';

function makeIdempotencyD1(state = {}) {
  state.idempotency ||= [];
  state.authEvents ||= [];
  state.lockouts ||= [];
  return {
    prepare(sql) {
      return {
        bind(...bindings) {
          return {
            all: async () => {
              if (/FROM auth_security_events/.test(sql)) return { results: state.authEvents };
              return { results: [] };
            },
            first: async () => {
              if (/FROM idempotency_records/.test(sql)) {
                return state.idempotency.find((row) => row.scope_hash === bindings[0] && row.idempotency_key === bindings[1] && row.method === bindings[2] && row.path === bindings[3]) || null;
              }
              if (/FROM auth_lockouts/.test(sql)) {
                return state.lockouts.find((row) => row.subject_hash === bindings[0] && row.active === 1) || null;
              }
              if (/COUNT\(\*\) AS count/.test(sql)) {
                return { count: state.authEvents.filter((row) => row.subject_hash === bindings[0] && row.success === 0).length };
              }
              if (/FROM merchants/.test(sql)) return null;
              return null;
            },
            run: async () => {
              if (/INSERT OR REPLACE INTO idempotency_records/.test(sql)) {
                const row = { scope_hash: bindings[0], idempotency_key: bindings[1], method: bindings[2], path: bindings[3], body_hash: bindings[4], status: bindings[5], response_headers_json: bindings[6], response_body: bindings[7] };
                const index = state.idempotency.findIndex((item) => item.scope_hash === row.scope_hash && item.idempotency_key === row.idempotency_key && item.method === row.method && item.path === row.path);
                if (index >= 0) state.idempotency[index] = row; else state.idempotency.push(row);
              }
              if (/INSERT INTO auth_security_events/.test(sql)) {
                state.authEvents.push({ id: bindings[0], subject_hash: bindings[1], kind: bindings[2], identity: bindings[3], ip: bindings[4], success: bindings[5], reason: bindings[6] });
              }
              if (/INSERT INTO auth_lockouts/.test(sql)) {
                state.lockouts.push({ id: bindings[0], subject_hash: bindings[1], kind: bindings[2], identity: bindings[3], ip: bindings[4], failure_count: bindings[5], locked_until: '2999-01-01T00:00:00.000Z', active: 1 });
              }
              if (/UPDATE auth_lockouts/.test(sql)) {
                state.lockouts.filter((row) => row.subject_hash === bindings[0]).forEach((row) => { row.active = 0; });
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

test('browser session mutations require CSRF token before routed mutation code runs', async () => {
  const env = { DB: makeIdempotencyD1(), SESSION_SECRET };
  const blocked = await app.fetch(new Request('https://commerce.test/api/products', {
    method: 'POST',
    headers: { cookie: 'skye_session=unsigned-browser-token', 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Blocked Product' })
  }), env);
  assert.equal(blocked.status, 403);
  assert.equal((await readJson(blocked)).code, 'csrf_required');

  const csrf = await createCsrfToken(env, 'test');
  const passedCsrf = await app.fetch(new Request('https://commerce.test/api/products', {
    method: 'POST',
    headers: { cookie: `skye_session=unsigned-browser-token; ${CSRF_COOKIE}=${encodeURIComponent(csrf)}`, 'x-skye-csrf': csrf, 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Still needs a real signed session' })
  }), env);
  assert.equal(passedCsrf.status, 401);
});

test('idempotency-key replays the first mutation response and rejects body reuse drift', async () => {
  const state = {};
  const env = { DB: makeIdempotencyD1(state), SESSION_SECRET, CSRF_ENFORCEMENT: 'false' };
  const first = await app.fetch(new Request('https://commerce.test/api/auth/logout', { method: 'POST', headers: { 'idempotency-key': 'logout-1' }, body: '{}' }), env);
  assert.equal(first.status, 200);
  assert.equal((await readJson(first)).ok, true);

  const second = await app.fetch(new Request('https://commerce.test/api/auth/logout', { method: 'POST', headers: { 'idempotency-key': 'logout-1' }, body: '{}' }), env);
  assert.equal(second.status, 200);
  assert.equal(second.headers.get('x-skye-idempotency-replay'), 'true');
  assert.equal((await readJson(second)).ok, true);

  const conflict = await app.fetch(new Request('https://commerce.test/api/auth/logout', { method: 'POST', headers: { 'idempotency-key': 'logout-1' }, body: '{"different":true}' }), env);
  assert.equal(conflict.status, 409);
  assert.equal((await readJson(conflict)).code, 'idempotency_conflict');
});

test('merchant login failures create auth events and then lock the subject', async () => {
  const state = {};
  const env = { DB: makeIdempotencyD1(state), SESSION_SECRET, AUTH_LOCKOUT_THRESHOLD: '3' };
  for (let index = 0; index < 3; index += 1) {
    const response = await app.fetch(new Request('https://commerce.test/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9' },
      body: JSON.stringify({ email: 'owner@example.test', password: 'bad' })
    }), env);
    assert.equal(response.status, 401);
  }
  const locked = await app.fetch(new Request('https://commerce.test/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9' },
    body: JSON.stringify({ email: 'owner@example.test', password: 'bad' })
  }), env);
  assert.equal(locked.status, 429);
  assert.equal((await readJson(locked)).code, 'auth_locked');
});
