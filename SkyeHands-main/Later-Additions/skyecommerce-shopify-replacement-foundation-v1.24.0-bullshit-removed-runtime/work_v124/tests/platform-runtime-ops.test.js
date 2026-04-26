import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index.js';
import { applyPickScanToLines, normalizeAppSettlementPatch, normalizeRoutePlanPatch } from '../src/lib/platform-closure.js';
import { sha256Hex, signToken } from '../src/lib/utils.js';

const SESSION_SECRET = 'runtime-ops-secret';

async function merchantCookie() {
  const token = await signToken(SESSION_SECRET, { sid: 'sess_runtime_ops', role: 'merchant_owner', merchantId: 'm1', email: 'owner@test.local', exp: Date.now() + 60_000 });
  return { token, hash: await sha256Hex(token), cookie: `skye_session=${encodeURIComponent(token)}` };
}

function makeD1(state = {}) {
  state.sessions ||= [];
  state.rateLimits ||= [];
  state.pickLists ||= [];
  state.binInventory ||= [];
  state.auditEvents ||= [];
  state.settlements ||= [];
  return {
    prepare(sql) {
      return {
        bind(...bindings) {
          return {
            all: async () => {
              if (/FROM api_rate_limits/.test(sql)) return { results: state.rateLimits };
              return { results: [] };
            },
            first: async () => {
              if (/FROM sessions/.test(sql)) return state.sessions.find((row) => row.token_hash === bindings[0]) || null;
              if (/FROM api_rate_limits/.test(sql)) return state.rateLimits.find((row) => row.bucket_key === bindings[0]) || null;
              if (/FROM warehouse_pick_lists WHERE id = \? AND merchant_id = \? LIMIT 1/.test(sql)) return state.pickLists.find((row) => row.id === bindings[0] && row.merchant_id === bindings[1]) || null;
              if (/FROM warehouse_pick_lists WHERE id = \? LIMIT 1/.test(sql)) return state.pickLists.find((row) => row.id === bindings[0]) || null;
              if (/FROM warehouse_bin_inventory WHERE merchant_id = \? AND bin_id = \? AND product_id = \? AND variant_id = \? LIMIT 1/.test(sql)) return state.binInventory.find((row) => row.merchant_id === bindings[0] && row.bin_id === bindings[1] && row.product_id === bindings[2] && row.variant_id === bindings[3]) || null;
              if (/FROM app_revenue_settlements WHERE id = \? AND merchant_id = \? LIMIT 1/.test(sql)) return state.settlements.find((row) => row.id === bindings[0] && row.merchant_id === bindings[1]) || null;
              if (/FROM app_revenue_settlements WHERE id = \? LIMIT 1/.test(sql)) return state.settlements.find((row) => row.id === bindings[0]) || null;
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
              if (/UPDATE warehouse_bin_inventory SET quantity = \?, reserved_quantity = \?, updated_at = CURRENT_TIMESTAMP WHERE id = \?/.test(sql)) {
                const row = state.binInventory.find((item) => item.id === bindings[2]);
                if (row) {
                  row.quantity = bindings[0];
                  row.reserved_quantity = bindings[1];
                }
                return { success: true };
              }
              if (/UPDATE warehouse_pick_lists SET status = \?, lines_json = \?, updated_at = CURRENT_TIMESTAMP WHERE id = \? AND merchant_id = \?/.test(sql)) {
                const row = state.pickLists.find((item) => item.id === bindings[2] && item.merchant_id === bindings[3]);
                if (row) {
                  row.status = bindings[0];
                  row.lines_json = bindings[1];
                }
                return { success: true };
              }
              if (/UPDATE app_revenue_settlements SET status = \?, payout_reference = \?, paid_at = \? WHERE id = \? AND merchant_id = \?/.test(sql)) {
                const row = state.settlements.find((item) => item.id === bindings[3] && item.merchant_id === bindings[4]);
                if (row) {
                  row.status = bindings[0];
                  row.payout_reference = bindings[1];
                  row.paid_at = bindings[2];
                }
                return { success: true };
              }
              if (/INSERT INTO audit_events/.test(sql)) {
                state.auditEvents.push({ id: bindings[0], merchant_id: bindings[1], event_type: bindings[4], summary: bindings[5], target_id: bindings[7] });
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

test('applyPickScanToLines moves line state from open to picked/packed', () => {
  const lines = [{ id: 'pli_1', requestedQuantity: 2, remainingQuantity: 2, status: 'open', allocations: [{ binId: 'wbin_1', quantity: 2 }] }];
  const picked = applyPickScanToLines(lines, { lineId: 'pli_1', binId: 'wbin_1', quantity: 2, packed: false });
  assert.equal(picked.status, 'picked');
  assert.equal(picked.lines[0].remainingQuantity, 0);
  const packed = applyPickScanToLines([{ ...picked.lines[0], pickedQuantity: 0, remainingQuantity: 2, status: 'open', allocations: [{ binId: 'wbin_1', quantity: 2 }] }], { lineId: 'pli_1', binId: 'wbin_1', quantity: 2, packed: true });
  assert.equal(packed.status, 'packed');
  assert.equal(packed.lines[0].packedQuantity, 2);
});

test('route/app patch normalizers constrain statuses', () => {
  const plan = normalizeRoutePlanPatch({ status: 'COMPLETED', stops: [{ label: 'A' }] }, { route_date: '2026-04-24', status: 'planned' });
  assert.equal(plan.status, 'completed');
  const settlement = normalizeAppSettlementPatch({ status: 'PAID', payoutReference: 'po_123' }, { status: 'open' });
  assert.equal(settlement.status, 'paid');
  assert.equal(settlement.payoutReference, 'po_123');
});

test('warehouse pick scan route updates runtime pick list and bin inventory', async () => {
  const state = {};
  const cookie = await merchantCookie();
  const env = { DB: makeD1(state), SESSION_SECRET, CSRF_ENFORCEMENT: 'false' };
  state.sessions.push({ token_hash: cookie.hash, merchant_id: 'm1', email: 'owner@test.local', role: 'merchant_owner', expires_at: '2999-01-01T00:00:00.000Z', slug: 'merchant-store', brand_name: 'Merchant Store' });
  state.pickLists.push({ id: 'wpl_1', merchant_id: 'm1', order_id: 'ord_1', work_order_id: '', status: 'open', lines_json: JSON.stringify([{ id: 'pli_1', productId: 'prd_1', variantId: '', requestedQuantity: 2, remainingQuantity: 2, status: 'open', allocations: [{ binId: 'wbin_1', quantity: 2 }] }]) });
  state.binInventory.push({ id: 'wbi_1', merchant_id: 'm1', bin_id: 'wbin_1', product_id: 'prd_1', variant_id: '', quantity: 5, reserved_quantity: 0 });
  const response = await app.fetch(new Request('https://commerce.test/api/warehouse/pick-lists/wpl_1/scan', { method: 'POST', headers: { cookie: cookie.cookie, 'content-type': 'application/json' }, body: JSON.stringify({ lineId: 'pli_1', binId: 'wbin_1', quantity: 2 }) }), env);
  const data = await readJson(response);
  assert.equal(response.status, 200);
  assert.equal(data.pickList.status, 'picked');
  assert.equal(state.binInventory[0].quantity, 3);
  assert.equal(state.auditEvents[0].event_type, 'warehouse.pick_list.scanned');
});

test('app settlement patch route persists payout reference and paid timestamp', async () => {
  const state = {};
  const cookie = await merchantCookie();
  const env = { DB: makeD1(state), SESSION_SECRET, CSRF_ENFORCEMENT: 'false' };
  state.sessions.push({ token_hash: cookie.hash, merchant_id: 'm1', email: 'owner@test.local', role: 'merchant_owner', expires_at: '2999-01-01T00:00:00.000Z', slug: 'merchant-store', brand_name: 'Merchant Store' });
  state.settlements.push({ id: 'appset_1', merchant_id: 'm1', developer_id: 'dev_1', period_start: '2026-04-01', period_end: '2026-04-30', gross_cents: 10000, platform_fee_cents: 3000, developer_payout_cents: 7000, status: 'open', payout_reference: '', paid_at: '', created_at: 'now' });
  const response = await app.fetch(new Request('https://commerce.test/api/app-settlements/appset_1', { method: 'PATCH', headers: { cookie: cookie.cookie, 'content-type': 'application/json' }, body: JSON.stringify({ status: 'paid', payoutReference: 'payout_live_123' }) }), env);
  const data = await readJson(response);
  assert.equal(response.status, 200);
  assert.equal(data.settlement.status, 'paid');
  assert.equal(data.settlement.payoutReference, 'payout_live_123');
  assert.match(String(data.settlement.paidAt || ''), /^\d{4}-\d{2}-\d{2}T/);
});
