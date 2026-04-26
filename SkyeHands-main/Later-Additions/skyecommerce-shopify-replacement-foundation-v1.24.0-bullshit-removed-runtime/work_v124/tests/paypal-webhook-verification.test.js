import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyPaypalWebhookSignature } from '../src/lib/provider-runtime.js';

test('PayPal native webhook verification calls PayPal verification API and requires SUCCESS', async () => {
  const calls = [];
  const headers = new Headers({
    'paypal-transmission-id': 'tx_123',
    'paypal-transmission-time': '2026-04-20T00:00:00Z',
    'paypal-cert-url': 'https://api-m.paypal.com/certs/cert.pem',
    'paypal-auth-algo': 'SHA256withRSA',
    'paypal-transmission-sig': 'sig_123'
  });
  const result = await verifyPaypalWebhookSignature({
    PAYPAL_CLIENT_ID: 'client',
    PAYPAL_CLIENT_SECRET: 'secret',
    PAYPAL_WEBHOOK_ID: 'wh_123',
    PAYPAL_ENDPOINT_BASE: 'https://api-m.paypal.com'
  }, JSON.stringify({ id: 'WH-1', event_type: 'PAYMENT.CAPTURE.COMPLETED' }), headers, {
    fetcher: async (url, init) => {
      calls.push({ url, init });
      if (String(url).includes('/oauth2/token')) return new Response(JSON.stringify({ access_token: 'access_123' }), { status: 200 });
      return new Response(JSON.stringify({ verification_status: 'SUCCESS' }), { status: 200 });
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'verified');
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /verify-webhook-signature/);
});

test('PayPal native webhook verification rejects missing webhook id', async () => {
  await assert.rejects(() => verifyPaypalWebhookSignature({ PAYPAL_CLIENT_ID: 'client', PAYPAL_CLIENT_SECRET: 'secret' }, '{}', new Headers(), { fetcher: async () => new Response('{}') }), /PAYPAL_WEBHOOK_ID/);
});
