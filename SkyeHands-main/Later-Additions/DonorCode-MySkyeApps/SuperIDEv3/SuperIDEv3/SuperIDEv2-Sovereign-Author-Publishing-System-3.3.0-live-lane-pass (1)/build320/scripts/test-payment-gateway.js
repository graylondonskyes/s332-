const { resolvePaymentProvider, createPaymentSession, retrieveStripeCheckoutSession, reconcileStripePaymentSession, signStripeWebhookPayload, verifyStripeWebhook, finalizePayment } = require('../platform/payment-gateways');
const { generateSkyeDocxPackage } = require('../platform/publishing');
const { emptyCommerceState } = require('../platform/commerce');
const { fail, ok, readJson, repoPath } = require('./lib');

(async () => {
  const resolved = resolvePaymentProvider({ provider:'stripe', secretKey:'sk_test_local', apiBase:'http://127.0.0.1:9999' });
  if (resolved.provider !== 'stripe' || resolved.mode !== 'test') fail('[payment-gateway] FAIL :: resolve');

  const fetchMap = new Map();
  fetchMap.set('POST /v1/checkout/sessions', { id:'cs_test_123', url:'https://checkout.stripe.test/session/cs_test_123', amount_total:4900, amount_subtotal:4900, currency:'usd', payment_status:'unpaid', status:'open', customer_email:'buyer@example.com', metadata:{ slug:'sovereign-author-publishing-os' }, livemode:false });
  fetchMap.set('GET /v1/checkout/sessions/cs_test_123', { id:'cs_test_123', amount_total:4900, amount_subtotal:4900, currency:'usd', payment_status:'paid', status:'complete', customer_details:{ email:'buyer@example.com' }, metadata:{ slug:'sovereign-author-publishing-os' }, livemode:false });
  fetchMap.set('GET /v1/checkout/sessions/cs_test_123/line_items', { object:'list', data:[{ description:'Sovereign Author Publishing OS', amount_total:4900, quantity:1 }] });
  const fakeFetch = async (url, init = {}) => {
    const pathname = new URL(url).pathname;
    const key = `${(init.method || 'GET').toUpperCase()} ${pathname}`;
    const body = fetchMap.get(key);
    if (!body) return { ok:false, status:404, async text(){ return JSON.stringify({ error:'missing' }); } };
    return { ok:true, status:200, async text(){ return JSON.stringify(body); } };
  };

  const session = await createPaymentSession({ title:'Sovereign Author Publishing OS', amount_usd:49, customer_email:'buyer@example.com', success_url:'https://example.com/success', cancel_url:'https://example.com/cancel', metadata:{ slug:'sovereign-author-publishing-os' } }, { provider:'stripe', secretKey:'sk_test_local', apiBase:'http://127.0.0.1:9999' }, fakeFetch);
  if (session.provider !== 'stripe' || !session.session_id || session.provider_mode !== 'test') fail('[payment-gateway] FAIL :: session');
  const retrieved = await retrieveStripeCheckoutSession(session.session_id, { provider:'stripe', secretKey:'sk_test_local', apiBase:'http://127.0.0.1:9999' }, fakeFetch);
  if (retrieved.payment_status !== 'paid' || !retrieved.line_items.length) fail('[payment-gateway] FAIL :: retrieve');

  const fixture = readJson(repoPath('fixtures','publishing','skydocx-workspace.json'));
  const authorPackage = generateSkyeDocxPackage(fixture, { runId:'payment-gateway' });
  const reconciled = await reconcileStripePaymentSession(session.session_id, { provider:'stripe', secretKey:'sk_test_local', apiBase:'http://127.0.0.1:9999' }, authorPackage, emptyCommerceState(), {}, fakeFetch);
  if (!reconciled.finalized || reconciled.commerce.orders.length !== 1) fail('[payment-gateway] FAIL :: reconcile');

  const event = { id:'evt_test_123', type:'checkout.session.completed', data:{ object:{ id:session.session_id, customer_email:'buyer@example.com' } } };
  const raw = JSON.stringify(event);
  const signature = signStripeWebhookPayload(raw, 'whsec_local');
  const verification = verifyStripeWebhook(raw, signature, 'whsec_local');
  if (!verification.ok) fail('[payment-gateway] FAIL :: webhook-verification');

  const next = finalizePayment(event, authorPackage, { name:'Buyer', email:'buyer@example.com' }, emptyCommerceState(), { sessionId:session.session_id });
  if (next.orders.length !== 1 || next.library.length !== 1) fail('[payment-gateway] FAIL :: finalize');
  ok('[payment-gateway] PASS');
})().catch((error) => fail(error.stack || error.message));
