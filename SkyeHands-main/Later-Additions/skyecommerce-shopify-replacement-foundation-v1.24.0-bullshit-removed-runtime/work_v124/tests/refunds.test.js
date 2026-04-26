import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRefundPreview, normalizeRefundRequestInput, refundRecord } from '../src/lib/refunds.js';

test('refund preview prevents over-refunding and records partial balances', () => {
  const order = { id: 'ord_1', totalCents: 10000, currency: 'USD' };
  const request = normalizeRefundRequestInput({ amountCents: 4000, reason: 'customer_request' }, order);
  const preview = buildRefundPreview(order, [{ amountCents: 2500, status: 'succeeded' }], request);
  assert.equal(preview.availableCents, 7500);
  assert.equal(preview.approvedCents, 4000);
  assert.equal(preview.valid, true);
});

test('refund record parses item payload and status', () => {
  const refund = refundRecord({ id: 'rf_1', merchant_id: 'm1', order_id: 'ord_1', refund_number: 'RF-1', amount_cents: 1200, currency: 'USD', status: 'succeeded', items_json: JSON.stringify([{ productId: 'p1', quantity: 1 }]) });
  assert.equal(refund.amountCents, 1200);
  assert.equal(refund.items[0].productId, 'p1');
});
