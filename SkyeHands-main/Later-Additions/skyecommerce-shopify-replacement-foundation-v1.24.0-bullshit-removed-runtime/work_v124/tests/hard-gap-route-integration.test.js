import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index.js';
import { encryptProviderConfig } from '../src/lib/secure-config.js';
import { hashApiToken } from '../src/lib/platform-apps.js';
import { sha256Hex, signToken } from '../src/lib/utils.js';

const SESSION_SECRET = 'route-integration-secret';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

async function makeMerchantCookie() {
  const token = await signToken(SESSION_SECRET, {
    sid: 'sessraw_route',
    role: 'merchant_owner',
    merchantId: 'm1',
    email: 'owner@skyecommerce.test',
    exp: Date.now() + 60_000
  });
  return { token, hash: await sha256Hex(token), cookie: `skye_session=${encodeURIComponent(token)}` };
}

function baseRows() {
  return {
    sessions: [],
    providerConnections: [],
    apiTokens: [],
    domains: [],
    certificateJobs: [],
    products: [{ id: 'prd_1', merchant_id: 'm1', slug: 'route-product', title: 'Route Product', price_cents: 2500, inventory_on_hand: 4, track_inventory: 1, status: 'active' }],
    variants: [],
    orders: [{ id: 'ord_1', merchant_id: 'm1', order_number: 'SKY-1001', status: 'paid', payment_status: 'paid', payment_reference: 'pi_123', currency: 'USD', customer_name: 'Buyer One', customer_email: 'buyer@test.local', subtotal_cents: 5000, shipping_cents: 0, tax_cents: 0, total_cents: 5000, items_json: '[]', shipping_address_json: '{}' }],
    payments: [{ id: 'pay_1', merchant_id: 'm1', order_id: 'ord_1', provider: 'stripe', provider_reference: 'pi_123', status: 'succeeded', amount_cents: 5000, currency: 'USD', payload_json: '{}' }],
    refunds: [],
    disputes: [{ id: 'dsp_1', merchant_id: 'm1', order_id: 'ord_1', provider: 'stripe', provider_dispute_id: 'dp_123', amount_cents: 5000, currency: 'USD', reason: 'fraudulent', status: 'needs_response', due_at: '', evidence_due_by: '', provider_submission_json: '{}' }],
    evidence: [{ id: 'evd_1', merchant_id: 'm1', dispute_id: 'dsp_1', evidence_json: JSON.stringify({ summary: 'Customer received the product.', sections: { customerCommunication: 'Messages attached.', refundPolicy: 'All sales final after fulfillment.', fulfillmentProof: [{ carrier: 'UPS', trackingNumber: '1Z999' }] } }), evidence_score: 80, status: 'ready', provider_submission_json: '{}' }],
    apps: [{ id: 'app_1', merchant_id: 'm1', app_key: 'erp-bridge', name: 'ERP Bridge', developer_name: 'Ops', app_url: '', webhook_url: '', requested_scopes_json: '["orders:read"]', status: 'active', pricing_json: '{}' }],
    installations: [{ id: 'ins_1', merchant_id: 'm1', app_id: 'app_1', granted_scopes_json: '["orders:read"]', status: 'installed', config_json: '{}', installed_at: '2026-04-17T00:00:00.000Z' }],
    billingPlans: [],
    billingSubscriptions: [],
    usageEvents: [],
    billingInvoices: []
  };
}

function createFakeD1(state) {
  function allFor(sql) {
    if (/FROM products\b/.test(sql)) return state.products;
    if (/FROM product_variants\b/.test(sql)) return state.variants;
    if (/FROM orders\b/.test(sql)) return state.orders;
    if (/FROM customer_accounts\b/.test(sql)) return [];
    if (/FROM inventory_locations\b/.test(sql)) return [];
    if (/FROM inventory_levels\b/.test(sql)) return [];
    if (/FROM provider_connections\b/.test(sql)) return state.providerConnections;
    if (/FROM api_access_tokens\b/.test(sql)) return state.apiTokens;
    if (/FROM custom_domains\b/.test(sql)) return state.domains;
    if (/FROM domain_certificate_jobs\b/.test(sql)) return state.certificateJobs;
    if (/FROM payment_disputes\b/.test(sql)) return state.disputes;
    if (/FROM dispute_evidence\b/.test(sql)) return state.evidence;
    if (/FROM commerce_apps\b/.test(sql)) return state.apps;
    if (/FROM app_installations\b/.test(sql)) return state.installations;
    if (/FROM app_billing_plans\b/.test(sql)) return state.billingPlans;
    if (/FROM app_billing_subscriptions\b/.test(sql)) return state.billingSubscriptions;
    if (/FROM app_usage_events\b/.test(sql)) return state.usageEvents;
    if (/FROM app_billing_invoices\b/.test(sql)) return state.billingInvoices;
    if (/FROM payment_transactions\b/.test(sql)) return state.payments;
    if (/FROM refunds\b/.test(sql)) return state.refunds;
    return [];
  }

  function firstFor(sql, bindings) {
    if (/FROM sessions\b/.test(sql)) return state.sessions.find((row) => row.token_hash === bindings[0]) || null;
    if (/FROM provider_connections\b/.test(sql)) {
      if (/WHERE id = \? AND merchant_id = \?/.test(sql)) return state.providerConnections.find((row) => row.id === bindings[0] && row.merchant_id === bindings[1]) || null;
      if (/WHERE merchant_id = \? AND id = \?/.test(sql)) return state.providerConnections.find((row) => row.merchant_id === bindings[0] && row.id === bindings[1]) || null;
      return state.providerConnections.find((row) => row.merchant_id === bindings[0] && row.provider === bindings[1] && Number(row.active) === 1) || null;
    }
    if (/FROM api_access_tokens\b/.test(sql)) return state.apiTokens.find((row) => row.token_hash === bindings[0] && row.status === 'active') || null;
    if (/FROM custom_domains\b/.test(sql)) return state.domains.find((row) => row.id === bindings[0] && row.merchant_id === bindings[1]) || state.domains.find((row) => row.id === bindings[0]) || null;
    if (/FROM domain_certificate_jobs\b/.test(sql)) return state.certificateJobs.find((row) => row.id === bindings[0]) || state.certificateJobs.find((row) => row.domain_id === bindings[0] && row.merchant_id === bindings[1]) || null;
    if (/FROM payment_disputes\b/.test(sql)) return state.disputes.find((row) => row.id === bindings[0] && row.merchant_id === bindings[1]) || null;
    if (/FROM dispute_evidence\b/.test(sql)) return state.evidence.find((row) => row.id === bindings[0] && row.dispute_id === bindings[1] && row.merchant_id === bindings[2]) || state.evidence.find((row) => row.id === bindings[0]) || null;
    if (/FROM orders\b/.test(sql)) return state.orders.find((row) => row.id === bindings[0] && row.merchant_id === bindings[1]) || null;
    if (/FROM commerce_apps\b/.test(sql)) return state.apps.find((row) => row.id === bindings[0] && row.merchant_id === bindings[1]) || state.apps.find((row) => row.id === bindings[0]) || null;
    if (/FROM app_installations\b/.test(sql)) return state.installations.find((row) => row.id === bindings[0] && row.merchant_id === bindings[1]) || null;
    if (/FROM app_billing_plans\b/.test(sql)) return state.billingPlans.find((row) => row.id === bindings[0] && row.merchant_id === bindings[1]) || state.billingPlans.find((row) => row.id === bindings[0]) || null;
    if (/FROM app_billing_subscriptions\b/.test(sql)) return state.billingSubscriptions.find((row) => row.id === bindings[0] && row.merchant_id === bindings[1]) || null;
    if (/FROM refunds\b/.test(sql)) return state.refunds.find((row) => row.id === bindings[0]) || null;
    return allFor(sql)[0] || null;
  }

  function runFor(sql, bindings) {
    if (/INSERT INTO provider_connections\b/.test(sql)) state.providerConnections.push({ id: bindings[0], merchant_id: bindings[1], name: bindings[2], provider: bindings[3], environment: bindings[4], account_label: bindings[5], endpoint_base: bindings[6], config_json: bindings[7], config_encrypted: bindings[8], active: bindings[9], created_at: 'now', updated_at: 'now' });
    else if (/INSERT INTO domain_certificate_jobs\b/.test(sql)) state.certificateJobs.push({ id: bindings[0], merchant_id: bindings[1], domain_id: bindings[2], provider: bindings[3], external_hostname_id: bindings[4], status: bindings[5], validation_records_json: bindings[6], result_json: bindings[7], created_at: 'now', updated_at: 'now' });
    else if (/UPDATE domain_certificate_jobs\b/.test(sql)) { const job = state.certificateJobs.find((row) => row.id === bindings[3]); if (job) Object.assign(job, { status: bindings[0], validation_records_json: bindings[1], result_json: bindings[2], updated_at: 'now' }); }
    else if (/UPDATE custom_domains SET status/.test(sql)) { const domain = state.domains.find((row) => row.id === bindings[1] && row.merchant_id === bindings[2]); if (domain) Object.assign(domain, { status: bindings[0], last_checked_at: 'now', updated_at: 'now' }); }
    else if (/INSERT INTO refunds\b/.test(sql)) state.refunds.push({ id: bindings[0], merchant_id: bindings[1], order_id: bindings[2], refund_number: bindings[3], amount_cents: bindings[4], currency: bindings[5], provider: bindings[6], provider_ref: bindings[7], reason: bindings[8], status: bindings[9], note: bindings[10], restock: bindings[11], items_json: bindings[12], provider_dispatch_json: bindings[13], created_at: 'now' });
    else if (/UPDATE dispute_evidence\b/.test(sql)) { const evidence = state.evidence.find((row) => row.id === bindings[1]); if (evidence) Object.assign(evidence, { status: 'submitted', provider_submission_json: bindings[0], submitted_at: 'now' }); }
    else if (/UPDATE payment_disputes\b/.test(sql)) { const dispute = state.disputes.find((row) => row.id === bindings[1]); if (dispute) Object.assign(dispute, { status: 'submitted', provider_submission_json: bindings[0] }); }
    else if (/INSERT INTO app_billing_plans\b/.test(sql)) state.billingPlans.push({ id: bindings[0], merchant_id: bindings[1], app_id: bindings[2], code: bindings[3], name: bindings[4], billing_type: bindings[5], amount_cents: bindings[6], usage_unit: bindings[7], usage_cents: bindings[8], interval_unit: bindings[9], trial_days: bindings[10], active: bindings[11], created_at: 'now', updated_at: 'now' });
    else if (/INSERT INTO app_billing_subscriptions\b/.test(sql)) state.billingSubscriptions.push({ id: bindings[0], merchant_id: bindings[1], installation_id: bindings[2], plan_id: bindings[3], status: bindings[4], current_period_start: bindings[5], current_period_end: bindings[6], external_provider: bindings[7], external_ref: bindings[8], created_at: 'now', updated_at: 'now' });
    else if (/INSERT INTO app_usage_events\b/.test(sql)) state.usageEvents.push({ id: bindings[0], merchant_id: bindings[1], subscription_id: bindings[2], metric_key: bindings[3], quantity: bindings[4], unit_cents: bindings[5], total_cents: bindings[6], idempotency_key: bindings[7], meta_json: bindings[8], created_at: 'now' });
    else if (/INSERT INTO app_billing_invoices\b/.test(sql)) state.billingInvoices.push({ id: bindings[0], merchant_id: bindings[1], subscription_id: bindings[2], status: 'open', currency: bindings[3], base_cents: bindings[4], usage_cents: bindings[5], total_cents: bindings[6], line_items_json: bindings[7], created_at: 'now' });
    return { success: true };
  }

  return {
    prepare(sql) {
      return {
        bind(...bindings) {
          return {
            all: async () => ({ results: allFor(sql, bindings) }),
            first: async () => firstFor(sql, bindings),
            run: async () => runFor(sql, bindings)
          };
        }
      };
    }
  };
}

async function makeEnv(state) {
  const session = await makeMerchantCookie();
  state.sessions.push({ token_hash: session.hash, id: 'sess_1', merchant_id: 'm1', email: 'owner@skyecommerce.test', role: 'merchant_owner', expires_at: '2999-01-01T00:00:00.000Z', slug: 'route-store', brand_name: 'Route Store' });
  return { env: { DB: createFakeD1(state), SESSION_SECRET, STRIPE_SECRET_KEY: 'sk_test_route', STRIPE_WEBHOOK_SECRET: 'whsec_route', CLOUDFLARE_API_TOKEN: 'cf_route', CLOUDFLARE_ZONE_ID: 'zone_route', CSRF_ENFORCEMENT: 'false' }, cookie: session.cookie };
}

async function api(env, path, { method = 'GET', cookie = '', bearer = '', body = undefined } = {}) {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  if (bearer) headers.set('authorization', `Bearer ${bearer}`);
  if (body !== undefined) headers.set('content-type', 'application/json');
  const response = await app.fetch(new Request(`https://commerce.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env);
  return { response, data: await response.json() };
}

test('provider connection route encrypts stored config and returns masked config', async () => {
  const state = baseRows();
  const { env, cookie } = await makeEnv(state);
  const { response, data } = await api(env, '/api/provider-connections', { method: 'POST', cookie, body: { name: 'Stripe Live', provider: 'stripe', config: { secretKey: 'sk_live_secret_123456789', publicLabel: 'Main Account' } } });
  assert.equal(response.status, 201);
  assert.equal(data.ok, true);
  assert.equal(state.providerConnections.length, 1);
  const stored = JSON.parse(state.providerConnections[0].config_json);
  assert.equal(stored._encrypted, true);
  assert.notEqual(state.providerConnections[0].config_json.includes('sk_live_secret_123456789'), true);
  assert.equal(data.connection.config.secretKey.includes('…'), true);
});

test('bearer headless routes enforce token hash and scopes', async () => {
  const state = baseRows();
  const { env } = await makeEnv(state);
  const rawToken = 'skct_route_token_123';
  state.apiTokens.push({ id: 'tok_1', merchant_id: 'm1', label: 'Catalog API', token_hash: await hashApiToken(SESSION_SECRET, rawToken), secret_preview: 'skct_route…123', scopes_json: '["catalog:read"]', status: 'active', expires_at: '', created_at: 'now' });
  const allowed = await api(env, '/api/headless/products', { bearer: rawToken });
  assert.equal(allowed.response.status, 200);
  assert.equal(allowed.data.products[0].title, 'Route Product');
  const denied = await api(env, '/api/headless/orders', { bearer: rawToken });
  assert.equal(denied.response.status, 403);
});

test('refund route submits live Stripe refund before writing the refund ledger', async () => {
  const state = baseRows();
  const { env, cookie } = await makeEnv(state);
  state.providerConnections.push({ id: 'pcon_1', merchant_id: 'm1', name: 'Stripe', provider: 'stripe', environment: 'production', account_label: '', endpoint_base: '', config_json: JSON.stringify(await encryptProviderConfig(env, { account: 'acct_1' })), config_encrypted: 1, active: 1, created_at: 'now', updated_at: 'now' });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => jsonResponse({ id: 're_123', object: 'refund', status: 'succeeded', url, method: init.method });
  try {
    const { response, data } = await api(env, '/api/orders/ord_1/refunds', { method: 'POST', cookie, body: { provider: 'stripe', amountCents: 1200, providerConnectionId: 'pcon_1', restock: false } });
    assert.equal(response.status, 201);
    assert.equal(data.ok, true);
    assert.equal(state.refunds[0].status, 'succeeded');
    assert.equal(JSON.parse(state.refunds[0].provider_dispatch_json).action, 'refund_submit');
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test('refund route rejects non-live flags before writing the refund ledger', async () => {
  const state = baseRows();
  const { env, cookie } = await makeEnv(state);
  const { response, data } = await api(env, '/api/orders/ord_1/refunds', { method: 'POST', cookie, body: { provider: 'stripe', amountCents: 1200, simulate: true } });
  assert.equal(response.status, 400);
  assert.equal(data.code, 'REFUND_NONLIVE_FLAGS_REMOVED');
  assert.equal(state.refunds.length, 0);
});

test('dispute evidence submit route executes provider submission and stores result', async () => {
  const state = baseRows();
  const { env, cookie } = await makeEnv(state);
  state.providerConnections.push({ id: 'pcon_1', merchant_id: 'm1', name: 'Stripe', provider: 'stripe', environment: 'production', account_label: '', endpoint_base: '', config_json: JSON.stringify(await encryptProviderConfig(env, {})), config_encrypted: 1, active: 1, created_at: 'now', updated_at: 'now' });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({ id: 'dp_123', object: 'dispute', status: 'under_review' });
  try {
    const { response, data } = await api(env, '/api/payment-disputes/dsp_1/evidence/evd_1/submit', { method: 'POST', cookie, body: {} });
    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(state.evidence[0].status, 'submitted');
    assert.equal(JSON.parse(state.evidence[0].provider_submission_json).action, 'dispute_evidence_submit');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('domain certificate provision route calls Cloudflare and persists validation job', async () => {
  const state = baseRows();
  const { env, cookie } = await makeEnv(state);
  state.domains.push({ id: 'dom_1', merchant_id: 'm1', hostname: 'shop.example.com', mode: 'primary', status: 'verified', verification_token: 'abc', verification_record_name: '_skyecommerce.shop.example.com', verification_record_value: 'skyecommerce-verification=abc', tls_mode: 'auto', created_at: 'now', updated_at: 'now' });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({ result: { id: 'host_123', status: 'pending_validation', ssl: { status: 'pending_validation', validation_records: [{ txt_name: '_acme.shop.example.com', txt_value: 'token-123' }] } } });
  try {
    const { response, data } = await api(env, '/api/custom-domains/dom_1/certificate/provision', { method: 'POST', cookie, body: {} });
    assert.equal(response.status, 201);
    assert.equal(data.ok, true);
    assert.equal(state.certificateJobs.length, 1);
    assert.equal(state.certificateJobs[0].external_hostname_id, 'host_123');
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test('custom domain verify route requires live DNS TXT lookup instead of submitted values', async () => {
  const state = baseRows();
  const { env, cookie } = await makeEnv(state);
  state.domains.push({ id: 'dom_1', merchant_id: 'm1', hostname: 'shop.example.com', mode: 'primary', status: 'pending', verification_token: 'abc', verification_record_name: '_skyecommerce.shop.example.com', verification_record_value: 'skyecommerce-verification=abc', tls_mode: 'auto', created_at: 'now', updated_at: 'now' });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({ Answer: [{ type: 16, data: '"skyecommerce-verification=abc"' }] });
  try {
    const { response, data } = await api(env, '/api/custom-domains/dom_1/verify', { method: 'POST', cookie, body: { verificationRecordValue: 'wrong-submitted-value' } });
    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(state.domains[0].status, 'verified');
    assert.equal(data.dnsCheck.verified, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('app billing routes create plans, subscriptions, usage and invoice records', async () => {
  const state = baseRows();
  const { env, cookie } = await makeEnv(state);
  const plan = await api(env, '/api/app-billing/plans', { method: 'POST', cookie, body: { appId: 'app_1', name: 'Pro App', code: 'pro', billingType: 'hybrid', amountCents: 2900, usageCents: 25 } });
  assert.equal(plan.response.status, 201);
  const subscription = await api(env, '/api/app-installations/ins_1/billing/subscriptions', { method: 'POST', cookie, body: { planId: state.billingPlans[0].id } });
  assert.equal(subscription.response.status, 201);
  const usage = await api(env, `/api/app-billing/subscriptions/${state.billingSubscriptions[0].id}/usage`, { method: 'POST', cookie, body: { quantity: 4 } });
  assert.equal(usage.response.status, 201);
  const invoice = await api(env, `/api/app-billing/subscriptions/${state.billingSubscriptions[0].id}/invoices`, { method: 'POST', cookie, body: {} });
  assert.equal(invoice.response.status, 201);
  assert.equal(invoice.data.invoice.totalCents, 3000);
});
