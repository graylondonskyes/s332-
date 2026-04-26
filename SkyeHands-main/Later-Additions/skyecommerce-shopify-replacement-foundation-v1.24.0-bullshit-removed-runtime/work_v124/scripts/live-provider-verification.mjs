import assert from 'node:assert/strict';

const required = [
  'STRIPE_SECRET_KEY',
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'UPS_CLIENT_ID',
  'UPS_CLIENT_SECRET',
  'UPS_ACCOUNT_NUMBER',
  'PUBLIC_BASE_URL'
];

function env(name) {
  return String(process.env[name] || '').trim();
}

function requireEnv() {
  const missing = required.filter((name) => !env(name));
  if (missing.length) {
    console.error(JSON.stringify({ ok: false, code: 'LIVE_ENV_MISSING', missing }, null, 2));
    process.exit(2);
  }
}

async function readJson(response) {
  const text = await response.text();
  try { return JSON.parse(text || '{}'); } catch { return { raw: text }; }
}

async function verifyStripe() {
  const body = new URLSearchParams();
  body.set('mode', 'payment');
  body.set('success_url', `${env('PUBLIC_BASE_URL').replace(/\/+$/, '')}/store/?provider=stripe&status=success`);
  body.set('cancel_url', `${env('PUBLIC_BASE_URL').replace(/\/+$/, '')}/store/?provider=stripe&status=cancelled`);
  body.set('line_items[0][price_data][currency]', 'usd');
  body.set('line_items[0][price_data][product_data][name]', 'SkyeCommerce live verification hold');
  body.set('line_items[0][price_data][unit_amount]', '100');
  body.set('line_items[0][quantity]', '1');
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { authorization: `Bearer ${env('STRIPE_SECRET_KEY')}`, 'content-type': 'application/x-www-form-urlencoded' },
    body
  });
  const data = await readJson(response);
  assert.equal(response.ok, true, `Stripe checkout verification failed: ${JSON.stringify(data)}`);
  assert.match(String(data.id || ''), /^cs_/);
  return { provider: 'stripe', ok: true, reference: data.id, urlCreated: Boolean(data.url) };
}

async function verifyPayPal() {
  const tokenResponse = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${env('PAYPAL_CLIENT_ID')}:${env('PAYPAL_CLIENT_SECRET')}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const tokenData = await readJson(tokenResponse);
  assert.equal(tokenResponse.ok, true, `PayPal token verification failed: ${JSON.stringify(tokenData)}`);
  const orderResponse = await fetch('https://api-m.paypal.com/v2/checkout/orders', {
    method: 'POST',
    headers: { authorization: `Bearer ${tokenData.access_token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ amount: { currency_code: 'USD', value: '1.00' } }] })
  });
  const orderData = await readJson(orderResponse);
  assert.equal(orderResponse.ok, true, `PayPal order verification failed: ${JSON.stringify(orderData)}`);
  return { provider: 'paypal', ok: true, reference: orderData.id };
}

async function verifyUps() {
  const tokenResponse = await fetch('https://onlinetools.ups.com/security/v1/oauth/token', {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${env('UPS_CLIENT_ID')}:${env('UPS_CLIENT_SECRET')}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const tokenData = await readJson(tokenResponse);
  assert.equal(tokenResponse.ok, true, `UPS token verification failed: ${JSON.stringify(tokenData)}`);
  const ratingResponse = await fetch('https://onlinetools.ups.com/api/rating/v1/Rate', {
    method: 'POST',
    headers: { authorization: `Bearer ${tokenData.access_token}`, 'content-type': 'application/json', transId: `skye-${Date.now()}`, transactionSrc: 'SkyeCommerce' },
    body: JSON.stringify({
      RateRequest: {
        Request: { RequestOption: 'Rate' },
        Shipment: {
          Shipper: { ShipperNumber: env('UPS_ACCOUNT_NUMBER'), Address: { PostalCode: '85001', CountryCode: 'US' } },
          ShipTo: { Address: { PostalCode: '85001', CountryCode: 'US' } },
          ShipFrom: { Address: { PostalCode: '85001', CountryCode: 'US' } },
          Service: { Code: '03' },
          Package: [{ PackagingType: { Code: '02' }, PackageWeight: { UnitOfMeasurement: { Code: 'LBS' }, Weight: '1' } }]
        }
      }
    })
  });
  const ratingData = await readJson(ratingResponse);
  assert.equal(ratingResponse.ok, true, `UPS rating verification failed: ${JSON.stringify(ratingData)}`);
  return { provider: 'ups', ok: true, rated: true };
}

requireEnv();
const startedAt = new Date().toISOString();
const results = [];
results.push(await verifyStripe());
results.push(await verifyPayPal());
results.push(await verifyUps());
console.log(JSON.stringify({ ok: true, startedAt, finishedAt: new Date().toISOString(), results }, null, 2));
