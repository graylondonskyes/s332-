import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWarehouseWorkOrderPayload,
  executeWarehouseWorkOrder,
  nextFulfillmentStatusFromShipment,
  normalizeShipmentTrackingEvent,
  verifySignedJsonWebhook
} from '../src/lib/warehouse-ops.js';
import { hmacHex } from '../src/lib/utils.js';

test('warehouse work order payload requires production carrier label unless explicitly disabled', () => {
  const merchant = { id: 'm1', slug: 'merchant', brandName: 'Merchant' };
  const order = { id: 'ord_1', orderNumber: 'SKY-1001', paymentStatus: 'paid', items: [{ productId: 'prd_1', title: 'Jacket', quantity: 2 }] };
  assert.throws(() => buildWarehouseWorkOrderPayload({ merchant, order, workOrder: { id: 'whwo_1' }, shippingLabels: [] }), /carrier label/);
  const payload = buildWarehouseWorkOrderPayload({
    merchant,
    order,
    workOrder: { id: 'whwo_1', priority: 'expedite' },
    shippingLabels: [{ id: 'lbl_1', provider: 'ups', trackingNumber: '1Z999' }],
    allocations: [{ id: 'alloc_1', productId: 'prd_1', locationCode: 'PHX', quantity: 2 }]
  });
  assert.equal(payload.eventType, 'warehouse.work_order.submit');
  assert.equal(payload.workOrder.priority, 'expedite');
  assert.equal(payload.items[0].quantity, 2);
  assert.equal(payload.carrierLabels[0].trackingNumber, '1Z999');
});

test('warehouse handoff requires HTTPS URL and production signing secret', async () => {
  await assert.rejects(() => executeWarehouseWorkOrder({ WAREHOUSE_INGEST_URL: 'http://warehouse.example/hook', WAREHOUSE_SIGNING_SECRET: 'warehouse_secret_123456' }, { order: { id: 'ord_1' } }), /HTTPS/);
  await assert.rejects(() => executeWarehouseWorkOrder({ WAREHOUSE_INGEST_URL: 'https://warehouse.example/hook', WAREHOUSE_SIGNING_SECRET: 'short' }, { order: { id: 'ord_1' } }), /WAREHOUSE_SIGNING_SECRET/);
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return new Response(JSON.stringify({ workOrderId: 'wo_ext_123' }), { status: 202, headers: { 'content-type': 'application/json' } });
  };
  try {
    const result = await executeWarehouseWorkOrder({ WAREHOUSE_INGEST_URL: 'https://warehouse.example/hook', WAREHOUSE_SIGNING_SECRET: 'warehouse_secret_123456' }, { eventType: 'warehouse.work_order.submit', workOrder: { id: 'whwo_1' } });
    assert.equal(result.ok, true);
    assert.equal(result.externalRef, 'wo_ext_123');
    assert.equal(captured.url, 'https://warehouse.example/hook');
    assert.match(captured.init.headers['x-skye-signature'], /^sha256=/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('shipment tracking webhook signature and status mapping are strict', async () => {
  const rawBody = JSON.stringify({ trackingNumber: '1Z999', status: 'delivered', eventTime: '2026-04-20T12:00:00.000Z' });
  const secret = 'shipment_secret_123456';
  const signature = await hmacHex(secret, rawBody);
  assert.equal(await verifySignedJsonWebhook({ rawBody, secret, signatureHeader: `sha256=${signature}` }), true);
  assert.equal(await verifySignedJsonWebhook({ rawBody, secret, signatureHeader: 'sha256=bad' }), false);
  const event = normalizeShipmentTrackingEvent(JSON.parse(rawBody));
  assert.equal(event.status, 'delivered');
  assert.equal(event.trackingNumber, '1Z999');
  assert.deepEqual(nextFulfillmentStatusFromShipment(event.status), { orderStatus: 'fulfilled', fulfillmentStatus: 'delivered', labelStatus: 'delivered' });
});
