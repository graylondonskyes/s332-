import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFulfillmentSyncPayload,
  buildRoutexHandoffPayload,
  executeRoutexHandoff,
  executeSignedJsonPost,
  extractDonorVisualsFromHtml,
  requireHttpsUrl
} from '../src/lib/full-platform.js';

test('donor visual ingestion extracts production HTTPS image candidates', () => {
  const html = `
    <html><head>
      <title>Premium Jacket</title>
      <meta property="og:image" content="/assets/jacket.jpg">
      <meta name="twitter:image" content="https://cdn.example.com/twitter.jpg">
    </head><body>
      <img src="https://cdn.example.com/gallery-1.webp" alt="Gallery one">
      <img src="data:image/png;base64,nope" alt="Inline skipped">
    </body></html>`;
  const result = extractDonorVisualsFromHtml(html, 'https://store.example.com/products/jacket');
  assert.equal(result.title, 'Premium Jacket');
  assert.equal(result.images.length, 3);
  assert.equal(result.images[0].url, 'https://store.example.com/assets/jacket.jpg');
  assert.equal(result.images.every((item) => item.url.startsWith('https://')), true);
});

test('fulfillment sync payload includes order, labels, fulfillments, and returns', () => {
  const payload = buildFulfillmentSyncPayload({
    merchant: { id: 'm1', slug: 'merchant', brandName: 'Merchant', currency: 'USD' },
    order: { id: 'ord_1', orderNumber: 'SKY-1001', paymentStatus: 'paid', totalCents: 4200, items: [{ productId: 'p1', quantity: 1 }] },
    fulfillments: [{ id: 'ful_1', carrier: 'ups', trackingNumber: '1Z999' }],
    shippingLabels: [{ id: 'lbl_1', provider: 'ups', labelUrl: 'https://ups.example/label.pdf' }],
    returnRequests: [{ id: 'ret_1', status: 'requested', items: [{ productId: 'p1', quantity: 1 }] }]
  });
  assert.equal(payload.merchant.slug, 'merchant');
  assert.equal(payload.order.orderNumber, 'SKY-1001');
  assert.equal(payload.fulfillments[0].trackingNumber, '1Z999');
  assert.equal(payload.shippingLabels[0].labelUrl, 'https://ups.example/label.pdf');
  assert.equal(payload.returns[0].id, 'ret_1');
});

test('signed fulfillment post rejects non-HTTPS targets and signs HTTPS JSON posts', async () => {
  assert.throws(() => requireHttpsUrl('http://warehouse.example/hook'), /HTTPS/);
  const originalFetch = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return new Response(JSON.stringify({ accepted: true }), { status: 202, headers: { 'x-request-id': 'req_123' } });
  };
  try {
    const result = await executeSignedJsonPost({ url: 'https://warehouse.example/hook', payload: { order: 'ord_1' }, secret: 'signing_secret_123456', eventType: 'order.fulfillment_sync' });
    assert.equal(result.status, 'delivered');
    assert.equal(result.httpStatus, 202);
    assert.equal(result.providerReference, 'req_123');
    assert.equal(captured.url, 'https://warehouse.example/hook');
    assert.equal(captured.init.headers['x-skye-event'], 'order.fulfillment_sync');
    assert.match(captured.init.headers['x-skye-signature'], /^sha256=/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Routex handoff requires live ingest configuration and posts a route payload', async () => {
  const payload = buildRoutexHandoffPayload({
    merchant: { id: 'm1', slug: 'merchant', brandName: 'Merchant' },
    order: { id: 'ord_1', orderNumber: 'SKY-1001', customerName: 'Buyer', customerEmail: 'buyer@example.com', shippingAddress: { city: 'Phoenix' }, items: [] },
    routeDate: '2026-04-20'
  });
  assert.equal(payload.kind, 'delivery');
  assert.equal(payload.stop.address.city, 'Phoenix');
  await assert.rejects(() => executeRoutexHandoff({}, payload), /ROUTEX_INGEST_URL/);
  const originalFetch = globalThis.fetch;
  let authHeader = '';
  globalThis.fetch = async (url, init) => {
    authHeader = init.headers.authorization;
    return new Response(JSON.stringify({ routePacketId: 'rtp_123' }), { status: 200 });
  };
  try {
    const result = await executeRoutexHandoff({ ROUTEX_INGEST_URL: 'https://routex.example.com/ingest', ROUTEX_INGEST_TOKEN: 'routex_token_123456789' }, payload);
    assert.equal(authHeader, 'Bearer routex_token_123456789');
    assert.equal(result.status, 'delivered');
    assert.equal(result.externalRef, 'rtp_123');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
