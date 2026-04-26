import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRequestedReturnCents, normalizeReturnPatch, normalizeReturnRequestInput, returnRecord, shouldRestockReturn } from '../src/lib/returns.js';

const order = {
  items: [
    { productId: 'prd_1', title: 'Alpha', quantity: 2, unitPriceCents: 1500 },
    { productId: 'prd_2', title: 'Beta', quantity: 1, unitPriceCents: 2500 }
  ]
};

test('normalizeReturnRequestInput constrains quantities and computes requested cents', () => {
  const payload = normalizeReturnRequestInput({
    reason: 'Damaged',
    items: [{ productId: 'prd_1', quantity: 3 }],
    resolutionType: 'refund',
    restockItems: 'true'
  }, order);
  assert.equal(payload.items[0].quantity, 2);
  assert.equal(payload.requestedCents, 3000);
  assert.equal(payload.restockItems, true);
});

test('computeRequestedReturnCents sums unit prices for requested lines', () => {
  assert.equal(computeRequestedReturnCents(order.items, [{ productId: 'prd_1', quantity: 1 }, { productId: 'prd_2', quantity: 1 }]), 4000);
});

test('normalizeReturnPatch and shouldRestockReturn support refund flow', () => {
  const patch = normalizeReturnPatch({ status: 'refunded', approvedCents: 2500, merchantNote: 'Approved', restockItems: 'true' }, { status: 'requested' });
  assert.equal(patch.status, 'refunded');
  const mapped = returnRecord({ id: 'ret_1', merchant_id: 'm1', order_id: 'ord_1', status: patch.status, approved_cents: patch.approvedCents, restock_items: 1, items_json: '[]' });
  assert.equal(shouldRestockReturn(mapped), true);
});
