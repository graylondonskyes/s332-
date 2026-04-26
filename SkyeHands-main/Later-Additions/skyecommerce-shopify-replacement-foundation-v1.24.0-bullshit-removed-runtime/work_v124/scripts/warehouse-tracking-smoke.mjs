import assert from 'node:assert/strict';
import {
  buildWarehouseWorkOrderPayload,
  executeWarehouseWorkOrder,
  nextFulfillmentStatusFromShipment,
  normalizeShipmentTrackingEvent,
  verifySignedJsonWebhook
} from '../src/lib/warehouse-ops.js';
import { hmacHex } from '../src/lib/utils.js';

const merchant = { id: 'm1', slug: 'merchant', brandName: 'Merchant' };
const order = { id: 'ord_1', orderNumber: 'SKY-1001', paymentStatus: 'paid', items: [{ productId: 'prd_1', title: 'Jacket', quantity: 1 }] };
const payload = buildWarehouseWorkOrderPayload({ merchant, order, workOrder: { id: 'whwo_1', priority: 'standard' }, shippingLabels: [{ id: 'lbl_1', provider: 'ups', trackingNumber: '1Z999' }] });
assert.equal(payload.eventType, 'warehouse.work_order.submit');
assert.equal(payload.carrierLabels[0].trackingNumber, '1Z999');

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => new Response(JSON.stringify({ workOrderId: 'wh_ext_1' }), { status: 202, headers: { 'content-type': 'application/json' } });
try {
  const result = await executeWarehouseWorkOrder({ WAREHOUSE_INGEST_URL: 'https://warehouse.example.com/ingest', WAREHOUSE_SIGNING_SECRET: 'warehouse_secret_123456' }, payload);
  assert.equal(result.status, 'submitted');
  assert.equal(result.externalRef, 'wh_ext_1');
} finally {
  globalThis.fetch = originalFetch;
}

const rawBody = JSON.stringify({ trackingNumber: '1Z999', status: 'delivered', eventTime: '2026-04-20T12:00:00.000Z' });
const secret = 'shipment_secret_123456';
const signature = await hmacHex(secret, rawBody);
assert.equal(await verifySignedJsonWebhook({ rawBody, secret, signatureHeader: `sha256=${signature}` }), true);
const event = normalizeShipmentTrackingEvent(JSON.parse(rawBody));
assert.equal(nextFulfillmentStatusFromShipment(event.status).orderStatus, 'fulfilled');

console.log(JSON.stringify({ ok: true, warehouseWorkOrder: payload.workOrder.id, shipmentStatus: event.status }, null, 2));
