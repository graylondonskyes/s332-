import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOrderEvent, normalizeFulfillmentInput, normalizeOrderPatch } from '../src/lib/orders.js';

test('normalizeOrderPatch constrains lifecycle values', () => {
  const patch = normalizeOrderPatch({ status: 'FULFILLED', paymentStatus: 'PAID', note: 'Packed and shipped' }, { status: 'received', paymentStatus: 'pending_manual' });
  assert.equal(patch.status, 'fulfilled');
  assert.equal(patch.paymentStatus, 'paid');
  assert.equal(patch.note, 'Packed and shipped');
});

test('normalizeFulfillmentInput sets sane defaults', () => {
  const fulfillment = normalizeFulfillmentInput({ trackingNumber: '1Z999', carrier: 'UPS' });
  assert.equal(fulfillment.status, 'queued');
  assert.equal(fulfillment.trackingNumber, '1Z999');
});

test('buildOrderEvent creates structured timeline payload', () => {
  const event = buildOrderEvent('fulfillment_created', { summary: 'Tracking created', status: 'fulfilled', paymentStatus: 'paid', fulfillmentStatus: 'in_transit' }, 'UPS label created');
  assert.equal(event.kind, 'fulfillment_created');
  assert.equal(event.fulfillmentStatus, 'in_transit');
  assert.equal(event.detail, 'UPS label created');
});
