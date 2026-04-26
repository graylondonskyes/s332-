import test from 'node:test';
import assert from 'node:assert/strict';
import { executeNativeProviderDispatch, executeProviderHealth, missingProviderSecrets } from '../src/lib/provider-runtime.js';

const env = {
  STRIPE_SECRET_KEY: 'sk_test_123',
  STRIPE_WEBHOOK_SECRET: 'whsec_123',
  PAYPAL_CLIENT_ID: 'paypal_client',
  PAYPAL_CLIENT_SECRET: 'paypal_secret',
  PAYPAL_WEBHOOK_ID: 'paypal_webhook',
  UPS_CLIENT_ID: 'ups_client',
  UPS_CLIENT_SECRET: 'ups_secret',
  UPS_ACCOUNT_NUMBER: 'A12345',
  RESEND_API_KEY: 're_123',
  GOOGLE_MERCHANT_ACCESS_TOKEN: 'ya29.token',
  GOOGLE_MERCHANT_ID: '999',
  META_CATALOG_ACCESS_TOKEN: 'meta_token',
  META_CATALOG_ID: 'cat_meta',
  TIKTOK_CATALOG_ACCESS_TOKEN: 'tt_token',
  TIKTOK_CATALOG_ID: 'cat_tiktok'
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

test('missingProviderSecrets reports unset provider envs', () => {
  assert.deepEqual(missingProviderSecrets({}, 'stripe'), ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']);
  assert.deepEqual(missingProviderSecrets(env, 'stripe'), []);
});

test('executeNativeProviderDispatch performs a Stripe checkout fetch', async () => {
  const calls = [];
  const result = await executeNativeProviderDispatch(
    { provider: 'stripe', environment: 'production' },
    { payment: { amountCents: 2500, currency: 'USD' }, context: { orderNumber: 'SKY-1', origin: 'https://merchant.test' } },
    env,
    { fetcher: async (url, init) => { calls.push({ url, init }); return jsonResponse({ id: 'cs_test_123', url: 'https://checkout.stripe.test/session' }); } }
  );
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /stripe\.com\/v1\/checkout\/sessions$/);
  assert.equal(calls[0].init.headers.authorization, 'Bearer sk_test_123');
  assert.equal(result.status, 'executed');
  assert.equal(result.providerReference, 'cs_test_123');
  assert.equal(result.checkoutUrl, 'https://checkout.stripe.test/session');
});

test('executeNativeProviderDispatch performs PayPal OAuth then order creation', async () => {
  const calls = [];
  const result = await executeNativeProviderDispatch(
    { provider: 'paypal', environment: 'production' },
    { payment: { amountCents: 5500, currency: 'USD' }, context: { orderNumber: 'SKY-2', origin: 'https://merchant.test' } },
    env,
    { fetcher: async (url, init) => {
      calls.push({ url, init });
      if (url.includes('/v1/oauth2/token')) return jsonResponse({ access_token: 'paypal_access' });
      return jsonResponse({ id: 'PAYPAL-ORDER-1', links: [{ rel: 'approve', href: 'https://paypal.test/approve' }] });
    } }
  );
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /oauth2\/token$/);
  assert.match(calls[1].url, /checkout\/orders$/);
  assert.equal(result.providerReference, 'PAYPAL-ORDER-1');
  assert.equal(result.checkoutUrl, 'https://paypal.test/approve');
});

test('executeNativeProviderDispatch performs UPS OAuth then label purchase', async () => {
  const calls = [];
  const result = await executeNativeProviderDispatch(
    { provider: 'ups', environment: 'production', config: { accountNumber: 'A12345' } },
    { label: { serviceCode: 'ground', packages: [{ weightOz: 32 }] }, context: { orderNumber: 'SKY-3', shippingAddress: { AddressLine: ['1 Main'] } } },
    env,
    { fetcher: async (url, init) => {
      calls.push({ url, init });
      if (url.includes('/security/v1/oauth/token')) return jsonResponse({ access_token: 'ups_access' });
      return jsonResponse({ ShipmentResponse: { ShipmentResults: { ShipmentIdentificationNumber: '1Z999', PackageResults: { TrackingNumber: '1Z999', ShippingLabel: { GraphicImage: 'JVBERi0x' } } } } });
    } }
  );
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /ship$/);
  assert.equal(result.trackingNumber, '1Z999');
  assert.match(result.labelUrl, /^data:application\/pdf;base64,/);
});

test('executeNativeProviderDispatch performs Resend and channel sync fetches', async () => {
  const resend = await executeNativeProviderDispatch(
    { provider: 'resend' },
    { message: { recipient: 'buyer@example.com', subject: 'Ready', bodyText: 'Body' } },
    env,
    { fetcher: async () => jsonResponse({ id: 'email_123' }) }
  );
  assert.equal(resend.providerReference, 'email_123');

  const google = await executeNativeProviderDispatch(
    { provider: 'google_merchant', config: { merchantId: '999' } },
    { exportPayload: { merchant: { currency: 'USD' }, products: [{ id: 'prd_1', title: 'Hat', priceCents: 1299, inventoryOnHand: 3 }] } },
    env,
    { fetcher: async (url, init) => {
      assert.match(url, /products\/batch$/);
      assert.equal(init.headers.authorization, 'Bearer ya29.token');
      return jsonResponse({ entries: [{ batchId: 1 }] });
    } }
  );
  assert.equal(google.status, 'executed');
});

test('executeProviderHealth uses provider auth without leaking secrets', async () => {
  const result = await executeProviderHealth(
    { provider: 'stripe' },
    env,
    { fetcher: async (url, init) => {
      assert.equal(init.headers.authorization, 'Bearer sk_test_123');
      return jsonResponse({ id: 'acct_123' });
    } }
  );
  assert.equal(result.providerReference, 'acct_123');
  assert.equal(result.request.bodyKind, 'json');
});
