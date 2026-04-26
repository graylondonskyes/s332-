import assert from 'node:assert/strict';
import {
  buildFulfillmentSyncPayload,
  buildRoutexHandoffPayload,
  extractDonorVisualsFromHtml,
  requireHttpsUrl
} from '../src/lib/full-platform.js';

const donor = extractDonorVisualsFromHtml('<title>Item</title><meta property="og:image" content="/item.jpg"><img src="https://cdn.example.com/extra.jpg">', 'https://merchant.example.com/item');
assert.equal(donor.images.length, 2);
assert.equal(donor.images.every((item) => item.url.startsWith('https://')), true);

const fulfillment = buildFulfillmentSyncPayload({
  merchant: { id: 'm1', slug: 'skye-store', brandName: 'Skye Store', currency: 'USD' },
  order: { id: 'ord_1', orderNumber: 'SKY-1001', customerName: 'Buyer', customerEmail: 'buyer@example.com', totalCents: 7500, items: [{ productId: 'p1', quantity: 1 }] },
  fulfillments: [{ id: 'ful_1', carrier: 'ups', trackingNumber: '1Z' }],
  shippingLabels: [{ id: 'lbl_1', provider: 'ups', labelUrl: 'https://ups.example.com/label.pdf' }]
});
assert.equal(fulfillment.order.orderNumber, 'SKY-1001');
assert.equal(fulfillment.fulfillments[0].trackingNumber, '1Z');

const routex = buildRoutexHandoffPayload({
  merchant: { id: 'm1', slug: 'skye-store', brandName: 'Skye Store' },
  order: { id: 'ord_1', orderNumber: 'SKY-1001', customerName: 'Buyer', shippingAddress: { city: 'Phoenix', region: 'AZ' }, items: [] },
  routeDate: '2026-04-20'
});
assert.equal(routex.stop.address.city, 'Phoenix');
assert.equal(requireHttpsUrl('https://warehouse.example.com/ingest'), 'https://warehouse.example.com/ingest');

console.log(JSON.stringify({ ok: true, checks: ['donor_visual_extraction', 'fulfillment_sync_payload', 'routex_payload', 'https_enforcement'] }, null, 2));
