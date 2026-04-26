import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index.js';
import { signToken, sha256Hex } from '../src/lib/utils.js';

const SESSION_SECRET = 'staff-rbac-secret';

async function staffCookie() {
  const token = await signToken(SESSION_SECRET, { sid: 'staffsess', role: 'merchant_staff', merchantId: 'm1', email: 'catalog@shop.test', exp: Date.now() + 60_000 });
  return { cookie: `skye_session=${encodeURIComponent(token)}`, hash: await sha256Hex(token) };
}

function fakeD1(state) {
  function allFor(sql) {
    if (/FROM products\b/.test(sql)) return state.products;
    if (/FROM product_variants\b/.test(sql)) return [];
    return [];
  }
  function firstFor(sql, bindings) {
    if (/FROM sessions\b/.test(sql)) return state.sessions.find((row) => row.token_hash === bindings[0]) || null;
    if (/FROM staff_members\b/.test(sql)) return state.staffMembers.find((row) => row.merchant_id === bindings[0] && row.email.toLowerCase() === String(bindings[1]).toLowerCase()) || null;
    return null;
  }
  function runFor() { return { success: true }; }
  return { prepare(sql) { return { bind(...bindings) { return { all: async () => ({ results: allFor(sql, bindings) }), first: async () => firstFor(sql, bindings), run: async () => runFor(sql, bindings) }; } }; } };
}

async function api(env, path, { method = 'GET', cookie = '', body } = {}) {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  if (body !== undefined) headers.set('content-type', 'application/json');
  const response = await app.fetch(new Request(`https://commerce.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env);
  let data = {};
  try { data = await response.json(); } catch {}
  return { response, data };
}

test('staff route RBAC allows scoped read and blocks missing write permission before mutation code runs', async () => {
  const session = await staffCookie();
  const state = {
    sessions: [{ token_hash: session.hash, id: 'sess_staff', merchant_id: 'm1', email: 'catalog@shop.test', role: 'merchant_staff', expires_at: '2999-01-01T00:00:00.000Z', slug: 'rbac-store', brand_name: 'RBAC Store' }],
    staffMembers: [{ id: 'stm_1', merchant_id: 'm1', role_id: 'role_1', email: 'catalog@shop.test', name: 'Catalog Reader', status: 'active', permissions_json: '[]', role_permissions_json: '["catalog:read"]' }],
    products: [{ id: 'prd_1', merchant_id: 'm1', slug: 'allowed', title: 'Allowed Product', short_description: '', description_html: '', price_cents: 1000, compare_at_cents: 0, sku: '', inventory_on_hand: 2, track_inventory: 1, status: 'active', hero_image_url: '', source_type: '', source_ref: '', created_at: 'now', updated_at: 'now' }]
  };
  const env = { DB: fakeD1(state), SESSION_SECRET, CSRF_ENFORCEMENT: 'false' };
  const read = await api(env, '/api/products', { cookie: session.cookie });
  assert.equal(read.response.status, 200);
  assert.equal(read.data.products[0].title, 'Allowed Product');
  const write = await api(env, '/api/products', { method: 'POST', cookie: session.cookie, body: { title: 'Blocked' } });
  assert.equal(write.response.status, 403);
  assert.equal(write.data.requiredPermission, 'catalog:write');
});
