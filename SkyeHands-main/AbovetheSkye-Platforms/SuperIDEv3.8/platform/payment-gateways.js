const crypto = require('crypto');
const { canonicalize } = require('./export-import');
const { createCheckoutSession, appendPurchase, emptyCommerceState, locateExistingPurchase } = require('./commerce');

function encodeForm(data) {
  const params = new URLSearchParams();
  Object.entries(data).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((item, index) => params.append(`${key}[${index}]`, item));
    else if (value !== undefined && value !== null) params.append(key, String(value));
  });
  return params;
}

function resolvePaymentProvider(config = {}) {
  const provider = config.provider || 'stripe';
  if (provider !== 'stripe') throw new Error(`Unsupported payment provider (${provider}).`);
  const providerMode = config.providerMode || (String(config.secretKey || '').startsWith('sk_test_') ? 'test' : 'live');
  return canonicalize({ provider: 'stripe', mode: providerMode, api_base: config.apiBase || 'https://api.stripe.com' });
}

async function stripeRequest(config, pathname, init = {}, fetchImpl = fetch) {
  if (!config?.secretKey) throw new Error('Stripe secret key missing.');
  const apiBase = String(config.apiBase || 'https://api.stripe.com').replace(/\/+$/, '');
  const response = await fetchImpl(`${apiBase}${pathname}`, {
    ...init,
    headers: { authorization: `Bearer ${config.secretKey}`, ...(init.headers || {}) }
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text || '{}'); } catch { data = { raw: text }; }
  return { response, data, apiBase };
}

async function createStripeCheckoutSession(input, config, fetchImpl = fetch) {
  const body = encodeForm({
    mode: 'payment',
    success_url: input.success_url,
    cancel_url: input.cancel_url,
    'line_items[0][price_data][currency]': input.currency || 'usd',
    'line_items[0][price_data][product_data][name]': input.title,
    'line_items[0][price_data][unit_amount]': Math.round(Number(input.amount_usd || 0) * 100),
    'line_items[0][quantity]': 1,
    customer_email: input.customer_email,
    metadata: JSON.stringify(input.metadata || {})
  });
  const { response, data, apiBase } = await stripeRequest(config, '/v1/checkout/sessions', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body }, fetchImpl);
  if (!response.ok) throw new Error(`Stripe checkout failed (${response.status}).`);
  return canonicalize({
    schema: 'skye.payment.session',
    version: '3.3.0',
    provider: 'stripe',
    provider_mode: config.providerMode || (String(config.secretKey || '').startsWith('sk_test_') ? 'test' : 'live'),
    api_base: apiBase,
    session_id: data.id,
    checkout_url: data.url,
    amount_total: data.amount_total,
    amount_subtotal: data.amount_subtotal || data.amount_total,
    payment_status: data.payment_status || 'unpaid',
    status: data.status || 'open',
    currency: data.currency,
    title: input.title,
    customer_email: input.customer_email,
    metadata: input.metadata || {},
    raw: data
  });
}

async function retrieveStripeCheckoutSession(sessionId, config, fetchImpl = fetch) {
  const { response, data, apiBase } = await stripeRequest(config, `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, { method: 'GET' }, fetchImpl);
  if (!response.ok) throw new Error(`Stripe session lookup failed (${response.status}).`);
  let lineItems = [];
  try {
    const lineRes = await stripeRequest(config, `/v1/checkout/sessions/${encodeURIComponent(sessionId)}/line_items`, { method: 'GET' }, fetchImpl);
    if (lineRes.response.ok) lineItems = lineRes.data.data || [];
  } catch {
    lineItems = [];
  }
  return canonicalize({
    schema: 'skye.payment.session.status',
    version: '3.3.0',
    provider: 'stripe',
    api_base: apiBase,
    session_id: data.id,
    status: data.status || 'unknown',
    payment_status: data.payment_status || 'unknown',
    customer_email: data.customer_details?.email || data.customer_email || null,
    amount_total: data.amount_total,
    currency: data.currency,
    metadata: data.metadata || {},
    line_items: lineItems,
    raw: data
  });
}

async function reconcileStripePaymentSession(sessionId, config, authorPackage, existingState, options = {}, fetchImpl = fetch) {
  const status = await retrieveStripeCheckoutSession(sessionId, config, fetchImpl);
  const nextState = existingState && existingState.schema === 'skye.directsale.state' ? existingState : emptyCommerceState();
  const result = { status, commerce: nextState, finalized: false, reason: null };
  if (status.payment_status !== 'paid') {
    result.reason = 'not-paid';
    return canonicalize(result);
  }
  const event = { id: `reconcile_${sessionId}`, type:'checkout.session.reconciled', data:{ object:{ id:sessionId, customer_email: status.customer_email } } };
  const finalized = finalizePayment(event, authorPackage, { name: options.customer_name || 'Stripe Customer', email: status.customer_email || options.customer_email || 'buyer@internal.invalid' }, nextState, { sessionId });
  result.commerce = finalized;
  result.finalized = true;
  return canonicalize(result);
}

async function createPaymentSession(input, config = {}, fetchImpl = fetch) {
  const resolved = resolvePaymentProvider(config);
  return createStripeCheckoutSession(input, { ...config, providerMode: resolved.mode, apiBase: resolved.api_base }, fetchImpl);
}

function signStripeWebhookPayload(payload, signingSecret, timestamp = Math.floor(Date.now() / 1000)) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const signedPayload = `${timestamp}.${body}`;
  const signature = crypto.createHmac('sha256', signingSecret).update(signedPayload).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

function verifyStripeWebhook(rawBody, signatureHeader, signingSecret, toleranceSeconds = 300) {
  const issues = [];
  const header = String(signatureHeader || '');
  const timestampMatch = /t=(\d+)/.exec(header);
  const signatureMatch = /v1=([a-f0-9]+)/.exec(header);
  if (!timestampMatch || !signatureMatch) issues.push('malformed-signature');
  let event = null;
  if (!issues.length) {
    const expected = crypto.createHmac('sha256', signingSecret).update(`${timestampMatch[1]}.${rawBody}`).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureMatch[1]))) issues.push('signature');
    const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestampMatch[1]));
    if (age > toleranceSeconds) issues.push('timestamp-window');
    try { event = JSON.parse(rawBody); } catch { issues.push('payload'); }
  }
  return canonicalize({ schema: 'skye.payment.webhook.verification', version: '3.3.0', ok: issues.length === 0, issues, event });
}

function deriveCheckoutSessionFromEvent(event, authorPackage, buyer, options = {}) {
  const sessionId = event?.data?.object?.id || options.sessionId || `chk_${crypto.randomBytes(6).toString('hex')}`;
  return createCheckoutSession(authorPackage, buyer, { runId: event?.id || options.runId || 'payment-event', sessionId });
}

function finalizePayment(event, authorPackage, buyer, existingState, options = {}) {
  const state = existingState && existingState.schema === 'skye.directsale.state' ? existingState : emptyCommerceState();
  const checkoutSession = deriveCheckoutSessionFromEvent(event, authorPackage, buyer, options);
  const existing = locateExistingPurchase(state, checkoutSession);
  if (existing) return canonicalize(state);
  return appendPurchase(state, checkoutSession);
}

function paymentSummary(session) {
  if (!session) return canonicalize({ schema: 'skye.payment.summary', version: '3.3.0', ok: false });
  return canonicalize({
    schema: 'skye.payment.summary',
    version: '3.3.0',
    ok: true,
    provider: session.provider,
    provider_mode: session.provider_mode || null,
    session_id: session.session_id,
    amount_total: session.amount_total,
    currency: session.currency,
    customer_email: session.customer_email || null,
    title: session.title || null,
    payment_status: session.payment_status || null,
    status: session.status || null
  });
}

module.exports = {
  resolvePaymentProvider,
  createPaymentSession,
  retrieveStripeCheckoutSession,
  reconcileStripePaymentSession,
  signStripeWebhookPayload,
  verifyStripeWebhook,
  deriveCheckoutSessionFromEvent,
  finalizePayment,
  paymentSummary
};
