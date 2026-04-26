import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index.js';
import { sha256Hex, signToken } from '../src/lib/utils.js';

const SESSION_SECRET = 'runtime-bullshit-removal-secret';

async function merchantCookie() {
  const token = await signToken(SESSION_SECRET, { sid: 'sess_runtime', role: 'merchant_owner', merchantId: 'm1', email: 'owner@test.local', exp: Date.now() + 60_000 });
  return { token, hash: await sha256Hex(token), cookie: `skye_session=${encodeURIComponent(token)}` };
}

function makeD1(state = {}) {
  state.sessions ||= [];
  state.rateLimits ||= [];
  state.apps ||= [];
  state.installations ||= [];
  state.merchants ||= [];
  state.posCarts ||= [];
  state.posTerminalPayments ||= [];
  state.paymentTransactions ||= [];
  state.orders ||= [];
  state.orderEvents ||= [];
  state.auditEvents ||= [];
  state.receiptJobs ||= [];
  return {
    prepare(sql) {
      return {
        bind(...bindings) {
          return {
            all: async () => {
              if (/SELECT \* FROM order_events WHERE order_id = \? ORDER BY created_at DESC/.test(sql)) return { results: state.orderEvents.filter((row) => row.order_id === bindings[0]) };
              if (/SELECT \* FROM fulfillments WHERE order_id = \? ORDER BY created_at DESC/.test(sql)) return { results: [] };
              if (/SELECT \* FROM order_returns WHERE order_id = \? AND merchant_id = \? ORDER BY created_at DESC/.test(sql)) return { results: [] };
              if (/FROM order_allocations\s+LEFT JOIN inventory_locations/.test(sql)) return { results: [] };
              if (/SELECT \* FROM payment_transactions WHERE order_id = \? ORDER BY created_at DESC/.test(sql)) return { results: state.paymentTransactions.filter((row) => row.order_id === bindings[0]) };
              if (/SELECT \* FROM notification_messages WHERE order_id = \? ORDER BY created_at DESC/.test(sql)) return { results: [] };
              if (/SELECT \* FROM shipping_labels WHERE order_id = \? AND merchant_id = \? ORDER BY created_at DESC/.test(sql)) return { results: [] };
              if (/SELECT \* FROM risk_assessments WHERE order_id = \? AND merchant_id = \? ORDER BY created_at DESC/.test(sql)) return { results: [] };
              if (/SELECT \* FROM fulfillment_sync_jobs WHERE order_id = \? AND merchant_id = \? ORDER BY created_at DESC/.test(sql)) return { results: [] };
              if (/SELECT \* FROM routex_handoffs WHERE order_id = \? AND merchant_id = \? ORDER BY created_at DESC/.test(sql)) return { results: [] };
              if (/SELECT \* FROM pos_receipt_print_jobs WHERE merchant_id = \? ORDER BY created_at DESC/.test(sql)) return { results: state.receiptJobs.filter((row) => row.merchant_id === bindings[0]) };
              if (/SELECT id FROM order_allocations WHERE order_id = \? LIMIT 1/.test(sql)) return { results: [] };
              return { results: [] };
            },
            first: async () => {
              if (/FROM sessions/.test(sql)) return state.sessions.find((row) => row.token_hash === bindings[0]) || null;
              if (/FROM api_rate_limits/.test(sql)) return state.rateLimits.find((row) => row.bucket_key === bindings[0]) || null;
              if (/SELECT \* FROM commerce_apps WHERE id = \? AND merchant_id = \? LIMIT 1/.test(sql)) return state.apps.find((row) => row.id === bindings[0] && row.merchant_id === bindings[1]) || null;
              if (/SELECT \* FROM app_installations WHERE merchant_id = \? AND app_id = \? ORDER BY installed_at DESC LIMIT 1/.test(sql)) return state.installations.find((row) => row.merchant_id === bindings[0] && row.app_id === bindings[1]) || null;
              if (/SELECT \* FROM app_installations WHERE id = \? LIMIT 1/.test(sql)) return state.installations.find((row) => row.id === bindings[0]) || null;
              if (/SELECT \* FROM pos_carts WHERE id = \? AND merchant_id = \? LIMIT 1/.test(sql)) return state.posCarts.find((row) => row.id === bindings[0] && row.merchant_id === bindings[1]) || null;
              if (/SELECT \* FROM pos_terminal_payments WHERE cart_id = \? AND merchant_id = \? AND status IN/.test(sql)) return state.posTerminalPayments.find((row) => row.cart_id === bindings[0] && row.merchant_id === bindings[1] && ['processing', 'authorized', 'captured', 'pending'].includes(row.status)) || null;
              if (/SELECT \* FROM pos_terminal_payments WHERE id = \? AND merchant_id = \? LIMIT 1/.test(sql)) return state.posTerminalPayments.find((row) => row.id === bindings[0] && row.merchant_id === bindings[1]) || null;
              if (/SELECT \* FROM pos_terminal_payments WHERE id = \? LIMIT 1/.test(sql)) return state.posTerminalPayments.find((row) => row.id === bindings[0]) || null;
              if (/SELECT \* FROM merchants WHERE id = \? LIMIT 1/.test(sql)) return state.merchants.find((row) => row.id === bindings[0]) || null;
              if (/SELECT \* FROM orders WHERE id = \? AND merchant_id = \? LIMIT 1/.test(sql)) return state.orders.find((row) => row.id === bindings[0] && row.merchant_id === bindings[1]) || null;
              if (/SELECT \* FROM payment_transactions WHERE order_id = \? AND merchant_id = \? ORDER BY created_at DESC LIMIT 1/.test(sql)) return state.paymentTransactions.find((row) => row.order_id === bindings[0] && row.merchant_id === bindings[1]) || null;
              return null;
            },
            run: async () => {
              if (/INSERT INTO api_rate_limits/.test(sql)) {
                state.rateLimits.push({ bucket_key: bindings[0], request_count: bindings[7] });
                return { success: true };
              }
              if (/UPDATE api_rate_limits SET request_count/.test(sql)) {
                const row = state.rateLimits.find((item) => item.bucket_key === bindings[1]);
                if (row) row.request_count = bindings[0];
                return { success: true };
              }
              if (/UPDATE app_installations SET config_json = \?, updated_at = CURRENT_TIMESTAMP WHERE id = \? AND merchant_id = \?/.test(sql)) {
                const row = state.installations.find((item) => item.id === bindings[1] && item.merchant_id === bindings[2]);
                if (row) row.config_json = bindings[0];
                return { success: true };
              }
              if (/UPDATE app_installations SET status = \?, config_json = \?, updated_at = CURRENT_TIMESTAMP WHERE id = \?/.test(sql)) {
                const row = state.installations.find((item) => item.id === bindings[2]);
                if (row) {
                  row.status = bindings[0];
                  row.config_json = bindings[1];
                }
                return { success: true };
              }
              if (/INSERT INTO orders \(id, merchant_id, customer_id, order_number, status, payment_status, payment_reference, currency, customer_name, customer_email, shipping_address_json, subtotal_cents, discount_code, discount_cents, shipping_cents, tax_cents, total_cents, items_json, notes\) VALUES/.test(sql)) {
                state.orders.push({
                  id: bindings[0], merchant_id: bindings[1], customer_id: bindings[2], order_number: bindings[3], status: 'received', payment_status: 'pending_provider',
                  payment_reference: bindings[4], currency: bindings[5], customer_name: bindings[6], customer_email: bindings[7], shipping_address_json: '{}', subtotal_cents: bindings[8],
                  discount_code: '', discount_cents: bindings[9], shipping_cents: 0, tax_cents: bindings[10], total_cents: bindings[11], items_json: bindings[12], notes: bindings[13], created_at: 'now'
                });
                return { success: true };
              }
              if (/UPDATE pos_carts SET status = 'pending_provider', receipt_number = \?, order_id = \?, updated_at = CURRENT_TIMESTAMP WHERE id = \? AND merchant_id = \?/.test(sql)) {
                const row = state.posCarts.find((item) => item.id === bindings[2] && item.merchant_id === bindings[3]);
                if (row) {
                  row.status = 'pending_provider';
                  row.receipt_number = bindings[0];
                  row.order_id = bindings[1];
                }
                return { success: true };
              }
              if (/INSERT INTO payment_transactions/.test(sql)) {
                state.paymentTransactions.push({ id: bindings[0], merchant_id: bindings[1], order_id: bindings[2], provider: bindings[3], provider_reference: bindings[4], checkout_token: bindings[5], status: bindings[6], amount_cents: bindings[7], currency: bindings[8], payload_json: bindings[9], created_at: 'now', updated_at: 'now' });
                return { success: true };
              }
              if (/UPDATE pos_carts SET status = 'pending_provider', tenders_json = \?, updated_at = CURRENT_TIMESTAMP WHERE id = \? AND merchant_id = \?/.test(sql)) {
                const row = state.posCarts.find((item) => item.id === bindings[1] && item.merchant_id === bindings[2]);
                if (row) {
                  row.status = 'pending_provider';
                  row.tenders_json = bindings[0];
                }
                return { success: true };
              }
              if (/INSERT INTO pos_terminal_payments/.test(sql)) {
                state.posTerminalPayments.push({ id: bindings[0], merchant_id: bindings[1], cart_id: bindings[2], order_id: bindings[3], reader_id: bindings[4], provider_reference: bindings[5], status: bindings[6], amount_cents: bindings[7], currency: bindings[8], payload_json: bindings[9], created_at: 'now' });
                return { success: true };
              }
              if (/INSERT INTO order_events/.test(sql)) {
                state.orderEvents.push({ id: bindings[0], order_id: bindings[1], kind: bindings[2], summary: bindings[3], detail: bindings[4], status: bindings[5], payment_status: bindings[6], fulfillment_status: bindings[7], created_at: 'now' });
                return { success: true };
              }
              if (/INSERT INTO audit_events/.test(sql)) {
                state.auditEvents.push({ id: bindings[0], merchant_id: bindings[1], event_type: bindings[4], summary: bindings[5], target_id: bindings[7] });
                return { success: true };
              }
              if (/UPDATE payment_transactions SET provider_reference = \?, status = \?, payload_json = \?, authorized_at = COALESCE\(authorized_at, \?\), captured_at = \?, updated_at = CURRENT_TIMESTAMP WHERE id = \? AND merchant_id = \?/.test(sql)) {
                const row = state.paymentTransactions.find((item) => item.id === bindings[5] && item.merchant_id === bindings[6]);
                if (row) {
                  row.provider_reference = bindings[0];
                  row.status = bindings[1];
                  row.payload_json = bindings[2];
                  row.authorized_at = bindings[3];
                  row.captured_at = bindings[4];
                }
                return { success: true };
              }
              if (/UPDATE pos_terminal_payments SET order_id = \?, provider_reference = \?, status = \?, payload_json = \?, updated_at = CURRENT_TIMESTAMP WHERE id = \? AND merchant_id = \?/.test(sql)) {
                const row = state.posTerminalPayments.find((item) => item.id === bindings[4] && item.merchant_id === bindings[5]);
                if (row) {
                  row.order_id = bindings[0];
                  row.provider_reference = bindings[1];
                  row.status = bindings[2];
                  row.payload_json = bindings[3];
                }
                return { success: true };
              }
              if (/UPDATE orders SET status = \?, payment_status = \?, payment_reference = \? WHERE id = \? AND merchant_id = \?/.test(sql)) {
                const row = state.orders.find((item) => item.id === bindings[3] && item.merchant_id === bindings[4]);
                if (row) {
                  row.status = bindings[0];
                  row.payment_status = bindings[1];
                  row.payment_reference = bindings[2];
                }
                return { success: true };
              }
              if (/UPDATE pos_carts SET status = \?, tenders_json = \?, order_id = \?, updated_at = CURRENT_TIMESTAMP WHERE id = \? AND merchant_id = \?/.test(sql)) {
                const row = state.posCarts.find((item) => item.id === bindings[3] && item.merchant_id === bindings[4]);
                if (row) {
                  row.status = bindings[0];
                  row.tenders_json = bindings[1];
                  row.order_id = bindings[2];
                }
                return { success: true };
              }
              if (/INSERT INTO pos_receipt_print_jobs/.test(sql)) {
                state.receiptJobs.push({ id: bindings[0], merchant_id: bindings[1], order_id: bindings[2], cart_id: bindings[3], status: bindings[4], endpoint_url: bindings[5], result_json: bindings[6], created_at: 'now', updated_at: 'now' });
                return { success: true };
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

test('oauth install session persists state and callback finalizes installation state', async () => {
  const cookie = await merchantCookie();
  const state = {};
  state.sessions = [{ token_hash: cookie.hash, merchant_id: 'm1', email: 'owner@test.local', role: 'merchant_owner', expires_at: '2999-01-01T00:00:00.000Z', slug: 'store', brand_name: 'Store' }];
  state.apps = [{ id: 'app_1', merchant_id: 'm1', app_key: 'sample-app', name: 'Sample App', developer_name: 'Dev', app_url: 'https://app.vendor.test/install', webhook_url: '', requested_scopes_json: '[]', status: 'active', pricing_json: '{}' }];
  state.installations = [{ id: 'ins_1', merchant_id: 'm1', app_id: 'app_1', granted_scopes_json: '[]', status: 'installed', config_json: '{}', installed_at: 'now', updated_at: 'now' }];
  const env = { DB: makeD1(state), SESSION_SECRET, CSRF_ENFORCEMENT: 'false' };

  const createResponse = await app.fetch(new Request('https://commerce.test/api/apps/app_1/oauth/install-session', { method: 'POST', headers: { cookie: cookie.cookie, 'content-type': 'application/json' }, body: '{}' }), env);
  const createData = await readJson(createResponse);
  assert.equal(createResponse.status, 200);
  assert.match(createData.oauth.installUrl, /installation_id=ins_1/);
  const storedConfig = JSON.parse(state.installations[0].config_json);
  assert.equal(storedConfig.oauth.status, 'pending');
  assert.ok(storedConfig.oauth.state);

  const callbackResponse = await app.fetch(new Request(`https://commerce.test/api/app-installations/oauth/callback?installation_id=ins_1&state=${encodeURIComponent(storedConfig.oauth.state)}&code=abc123456789`, { method: 'GET' }), env);
  assert.equal(callbackResponse.status, 302);
  assert.match(String(callbackResponse.headers.get('location') || ''), /oauth_status=authorized/);
  const finalizedConfig = JSON.parse(state.installations[0].config_json);
  assert.equal(state.installations[0].status, 'installed');
  assert.equal(finalizedConfig.oauth.status, 'authorized');
  assert.match(finalizedConfig.oauth.authorizationCodePreview, /^abc123/);
});

test('pos terminal flow creates pending order shell and finalize closes it into a paid order', async () => {
  const cookie = await merchantCookie();
  const state = {};
  state.sessions = [{ token_hash: cookie.hash, merchant_id: 'm1', email: 'owner@test.local', role: 'merchant_owner', expires_at: '2999-01-01T00:00:00.000Z', slug: 'store', brand_name: 'Store' }];
  state.merchants = [{ id: 'm1', slug: 'store', brand_name: 'Store', email: 'owner@test.local', currency: 'USD', accent_color: '#7c3aed', surface_color: '#111827', background_color: '#050816', text_color: '#f8fafc', hero_title: 'Store', hero_tagline: '', checkout_note: '' }];
  state.posCarts = [{ id: 'cart_1', merchant_id: 'm1', register_id: 'reg_1', shift_id: 'shift_1', customer_id: '', status: 'open', currency: 'USD', subtotal_cents: 4299, discount_cents: 0, tax_cents: 0, total_cents: 4299, items_json: '[]', tenders_json: '[]', receipt_number: '', order_id: '', created_at: 'now', updated_at: 'now' }];
  const env = { DB: makeD1(state), SESSION_SECRET, STRIPE_SECRET_KEY: 'sk_live_terminal_test', CSRF_ENFORCEMENT: 'false' };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('/payment_intents')) return new Response(JSON.stringify({ id: 'pi_terminal_123', status: 'requires_payment_method' }), { status: 200, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify({ id: 'tmr_123', action: { status: 'in_progress' } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const startResponse = await app.fetch(new Request('https://commerce.test/api/pos/terminal-payments', { method: 'POST', headers: { cookie: cookie.cookie, 'content-type': 'application/json' }, body: JSON.stringify({ cartId: 'cart_1', readerId: 'tmr_123', customerName: 'Walk In', customerEmail: 'walkin@example.com' }) }), env);
    const startData = await readJson(startResponse);
    assert.equal(startResponse.status, 201);
    assert.equal(startData.order.paymentStatus, 'pending_provider');
    assert.equal(startData.cart.status, 'pending_provider');
    assert.equal(startData.payment.status, 'processing');

    const finalizeResponse = await app.fetch(new Request(`https://commerce.test/api/pos/terminal-payments/${encodeURIComponent(startData.payment.id)}/finalize`, { method: 'POST', headers: { cookie: cookie.cookie, 'content-type': 'application/json' }, body: JSON.stringify({ status: 'paid', providerReference: 'pi_terminal_123' }) }), env);
    const finalizeData = await readJson(finalizeResponse);
    assert.equal(finalizeResponse.status, 200);
    assert.equal(finalizeData.order.paymentStatus, 'paid');
    assert.equal(finalizeData.order.status, 'fulfilled');
    assert.equal(finalizeData.cart.status, 'paid');
    assert.equal(finalizeData.payment.status, 'captured');
    assert.equal(state.auditEvents.filter((row) => row.event_type === 'pos.terminal.started').length, 1);
    assert.equal(state.auditEvents.filter((row) => row.event_type === 'pos.terminal.finalized').length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
