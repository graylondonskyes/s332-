import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCarrierLabelGatewayRequest,
  buildChannelGatewayRequest,
  buildNativeProviderDispatch,
  buildNotificationGatewayRequest,
  buildPaymentGatewayRequest,
  buildProviderHealthSpec,
  normalizeProviderConnectionInput,
  providerConnectionRecord,
  requiredSecretsForProvider
} from '../src/lib/provider-adapters.js';

test('normalizeProviderConnectionInput sanitizes provider connection payload', () => {
  const payload = normalizeProviderConnectionInput({ name: 'Stripe Prod', provider: 'STRIPE', environment: 'Production', active: 'true', config: { accountId: 'acct_1' } });
  assert.equal(payload.provider, 'stripe');
  assert.equal(payload.environment, 'production');
  assert.equal(payload.active, true);
});

test('buildProviderHealthSpec returns stripe health request metadata', () => {
  const spec = buildProviderHealthSpec(providerConnectionRecord({ provider: 'stripe', environment: 'production' }));
  assert.equal(spec.url, 'https://api.stripe.com/v1/account');
  assert.deepEqual(requiredSecretsForProvider('stripe'), ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']);
});

test('buildPaymentGatewayRequest creates Stripe and PayPal request specs', () => {
  const stripe = buildPaymentGatewayRequest({ provider: 'stripe' }, { amountCents: 2500, currency: 'USD' }, { orderNumber: 'SKY-1', origin: 'https://example.com' });
  assert.equal(stripe.method, 'POST');
  assert.match(stripe.url, /checkout\/sessions$/);
  assert.match(stripe.body, /line_items/);

  const paypal = buildPaymentGatewayRequest({ provider: 'paypal', environment: 'production' }, { amountCents: 2500, currency: 'USD' }, { orderNumber: 'SKY-1', origin: 'https://example.com' });
  assert.match(paypal.url, /paypal\.com\/v2\/checkout\/orders$/);
  assert.equal(paypal.body.intent, 'CAPTURE');
});

test('buildCarrierLabelGatewayRequest creates UPS shipment request spec', () => {
  const spec = buildCarrierLabelGatewayRequest({ provider: 'ups', config: { accountNumber: '1AB234' } }, { serviceCode: 'ground', packages: [{ weightOz: 32 }] }, { orderNumber: 'SKY-2', shippingAddress: { AddressLine: ['123 Main'] } });
  assert.match(spec.url, /ship$/);
  assert.equal(spec.body.ShipmentRequest.Shipment.Service.Code, 'GROUND');
});

test('buildNotificationGatewayRequest creates Resend email request spec', () => {
  const spec = buildNotificationGatewayRequest({ provider: 'resend', config: { fromEmail: 'ops@example.com' } }, { recipient: 'buyer@example.com', subject: 'Ready', bodyText: 'Body' });
  assert.match(spec.url, /\/emails$/);
  assert.equal(spec.body.from, 'ops@example.com');
});

test('buildChannelGatewayRequest creates Google, Meta, and TikTok request specs', () => {
  const exportPayload = { merchant: { currency: 'USD' }, products: [{ id: 'prd_1', title: 'Alpha', shortDescription: 'Desc', priceCents: 1234, inventoryOnHand: 2, heroImageUrl: 'https://img.test/a.jpg' }] };
  const google = buildChannelGatewayRequest({ provider: 'google_merchant', config: { merchantId: '999' } }, exportPayload);
  assert.match(google.url, /products\/batch$/);
  assert.equal(google.body.entries[0].product.offerId, 'prd_1');

  const meta = buildChannelGatewayRequest({ provider: 'meta_catalog', config: { catalogId: '123' } }, exportPayload);
  assert.match(meta.url, /\/123\/batch$/);
  assert.equal(meta.body.requests[0].method, 'CREATE');

  const tiktok = buildChannelGatewayRequest({ provider: 'tiktok_catalog', config: { catalogId: 'cat_1' } }, exportPayload);
  assert.match(tiktok.url, /catalog\/product\/upload/);
  assert.equal(tiktok.body.catalog_id, 'cat_1');
});

test('buildNativeProviderDispatch chooses lane by provider', () => {
  const payment = buildNativeProviderDispatch({ provider: 'stripe' }, { amountCents: 1000, currency: 'USD', context: { orderNumber: 'SKY-3', origin: 'https://example.com' } });
  assert.match(payment.url, /checkout\/sessions$/);
  const notification = buildNativeProviderDispatch({ provider: 'resend' }, { recipient: 'buyer@example.com', subject: 'Hi', bodyText: 'Body' });
  assert.match(notification.url, /\/emails$/);
});
