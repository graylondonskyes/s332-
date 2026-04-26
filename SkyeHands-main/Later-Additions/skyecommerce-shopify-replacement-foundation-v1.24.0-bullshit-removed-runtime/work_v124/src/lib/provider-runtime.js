import { buildNativeProviderDispatch, buildProviderHealthSpec, providerConnectionRecord, requiredSecretsForProvider } from './provider-adapters.js';

function normalizedText(value = '') {
  return String(value || '').trim();
}

function jsonHeaders(extra = {}) {
  return { accept: 'application/json', 'content-type': 'application/json', ...extra };
}

function formHeaders(extra = {}) {
  return { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded', ...extra };
}

function envValue(env = {}, key = '') {
  return env?.[key] || env?.vars?.[key] || '';
}

export function missingProviderSecrets(env = {}, provider = '') {
  return requiredSecretsForProvider(provider).filter((key) => !normalizedText(envValue(env, key)));
}

export function assertProviderSecrets(env = {}, provider = '') {
  const missing = missingProviderSecrets(env, provider);
  if (missing.length) {
    const error = new Error(`Missing provider secret(s): ${missing.join(', ')}`);
    error.code = 'PROVIDER_SECRETS_MISSING';
    error.missing = missing;
    throw error;
  }
  return true;
}

async function parseProviderResponse(response) {
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  return { ok: response.ok, status: response.status, statusText: response.statusText, data };
}

function publicProviderResult({ provider, action, request, parsed, reference = '', checkoutUrl = '', trackingNumber = '', labelUrl = '' } = {}) {
  return {
    provider,
    action,
    status: parsed.ok ? 'executed' : 'failed',
    httpStatus: parsed.status,
    providerReference: reference || extractReference(provider, parsed.data),
    checkoutUrl,
    trackingNumber,
    labelUrl,
    response: parsed.data,
    request: {
      method: request.method,
      url: request.url,
      contentType: request.headers?.['content-type'] || request.headers?.['Content-Type'] || '',
      bodyKind: typeof request.body === 'string' ? 'encoded' : 'json'
    }
  };
}

function extractReference(provider, data = {}) {
  if (!data || typeof data !== 'object') return '';
  if (data.id) return String(data.id);
  if (data.name) return String(data.name);
  if (data.message_id) return String(data.message_id);
  if (data.ShipmentResponse?.ShipmentResults?.ShipmentIdentificationNumber) return String(data.ShipmentResponse.ShipmentResults.ShipmentIdentificationNumber);
  if (data.batch_id) return String(data.batch_id);
  if (data.request_id) return String(data.request_id);
  if (provider === 'google_merchant' && Array.isArray(data.entries)) return `google_batch_${data.entries.length}`;
  return '';
}

function extractCheckoutUrl(provider, data = {}) {
  if (provider === 'stripe') return data?.url || '';
  if (provider === 'paypal') {
    const link = Array.isArray(data?.links) ? data.links.find((item) => item.rel === 'approve') : null;
    return link?.href || '';
  }
  return '';
}

function extractUpsLabel(data = {}) {
  const results = data?.ShipmentResponse?.ShipmentResults || data?.shipmentResponse?.shipmentResults || data || {};
  const packageResults = Array.isArray(results.PackageResults) ? results.PackageResults[0] : results.PackageResults;
  const labelImage = packageResults?.ShippingLabel?.GraphicImage || packageResults?.shippingLabel?.graphicImage || '';
  return {
    trackingNumber: results.ShipmentIdentificationNumber || packageResults?.TrackingNumber || results.trackingNumber || '',
    labelUrl: labelImage ? `data:application/pdf;base64,${labelImage}` : (results.labelUrl || '')
  };
}

async function fetchPaypalAccessToken(connection, env, fetcher) {
  const spec = buildProviderHealthSpec(connection);
  const clientId = envValue(env, 'PAYPAL_CLIENT_ID');
  const clientSecret = envValue(env, 'PAYPAL_CLIENT_SECRET');
  const tokenUrl = `${spec.endpointBase}/v1/oauth2/token`;
  const auth = btoa(`${clientId}:${clientSecret}`);
  const response = await fetcher(tokenUrl, { method: 'POST', headers: formHeaders({ authorization: `Basic ${auth}` }), body: 'grant_type=client_credentials' });
  const parsed = await parseProviderResponse(response);
  if (!parsed.ok || !parsed.data?.access_token) throw new Error(`PayPal OAuth failed (${parsed.status})`);
  return parsed.data.access_token;
}

async function fetchUpsAccessToken(connection, env, fetcher) {
  const spec = buildProviderHealthSpec(connection);
  const clientId = envValue(env, 'UPS_CLIENT_ID');
  const clientSecret = envValue(env, 'UPS_CLIENT_SECRET');
  const tokenUrl = `${spec.endpointBase}/security/v1/oauth/token`;
  const auth = btoa(`${clientId}:${clientSecret}`);
  const response = await fetcher(tokenUrl, { method: 'POST', headers: formHeaders({ authorization: `Basic ${auth}` }), body: 'grant_type=client_credentials' });
  const parsed = await parseProviderResponse(response);
  if (!parsed.ok || !parsed.data?.access_token) throw new Error(`UPS OAuth failed (${parsed.status})`);
  return parsed.data.access_token;
}

function prepareStripeRequest(spec, env) {
  return { method: spec.method, headers: formHeaders({ authorization: `Bearer ${envValue(env, 'STRIPE_SECRET_KEY')}` }), body: spec.body };
}

function prepareJsonBearerRequest(spec, token) {
  return { method: spec.method, headers: jsonHeaders({ authorization: `Bearer ${token}` }), body: JSON.stringify(spec.body || {}) };
}

export async function executeProviderHealth(connection = {}, env = {}, options = {}) {
  const normalized = providerConnectionRecord(connection);
  assertProviderSecrets(env, normalized.provider);
  const fetcher = options.fetcher || fetch;
  const spec = buildProviderHealthSpec(normalized);
  let init = { method: spec.method || 'GET', headers: { accept: 'application/json' } };
  if (normalized.provider === 'stripe') init.headers.authorization = `Bearer ${envValue(env, 'STRIPE_SECRET_KEY')}`;
  if (normalized.provider === 'resend') init.headers.authorization = `Bearer ${envValue(env, 'RESEND_API_KEY')}`;
  if (normalized.provider === 'google_merchant') init.headers.authorization = `Bearer ${envValue(env, 'GOOGLE_MERCHANT_ACCESS_TOKEN')}`;
  if (normalized.provider === 'meta_catalog') init.headers.authorization = `Bearer ${envValue(env, 'META_CATALOG_ACCESS_TOKEN')}`;
  if (normalized.provider === 'tiktok_catalog') init.headers.authorization = `Bearer ${envValue(env, 'TIKTOK_CATALOG_ACCESS_TOKEN')}`;
  if (normalized.provider === 'paypal') {
    const token = await fetchPaypalAccessToken(normalized, env, fetcher);
    init.headers.authorization = `Bearer ${token}`;
    init.method = 'GET';
    spec.url = `${spec.endpointBase}/v1/identity/oauth2/userinfo?schema=paypalv1.1`;
  }
  if (normalized.provider === 'ups') {
    const token = await fetchUpsAccessToken(normalized, env, fetcher);
    init.headers.authorization = `Bearer ${token}`;
    spec.url = `${spec.endpointBase}/api/rating/v2403/Shop`;
    init.method = 'POST';
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify({ RateRequest: { Request: { TransactionReference: { CustomerContext: 'health-check' } } } });
  }
  const response = await fetcher(spec.url, init);
  const parsed = await parseProviderResponse(response);
  return publicProviderResult({ provider: normalized.provider, action: 'health', request: { url: spec.url, ...init }, parsed });
}

export async function executeNativeProviderDispatch(connection = {}, payload = {}, env = {}, options = {}) {
  const normalized = providerConnectionRecord(connection);
  assertProviderSecrets(env, normalized.provider);
  const fetcher = options.fetcher || fetch;
  const spec = buildNativeProviderDispatch(normalized, payload);

  if (normalized.provider === 'stripe') {
    const request = prepareStripeRequest(spec, env);
    const parsed = await parseProviderResponse(await fetcher(spec.url, request));
    return publicProviderResult({ provider: normalized.provider, action: 'payment_checkout', request: { url: spec.url, ...request }, parsed, checkoutUrl: extractCheckoutUrl('stripe', parsed.data) });
  }

  if (normalized.provider === 'paypal') {
    const token = await fetchPaypalAccessToken(normalized, env, fetcher);
    const request = prepareJsonBearerRequest(spec, token);
    const parsed = await parseProviderResponse(await fetcher(spec.url, request));
    return publicProviderResult({ provider: normalized.provider, action: 'payment_checkout', request: { url: spec.url, ...request }, parsed, checkoutUrl: extractCheckoutUrl('paypal', parsed.data) });
  }

  if (normalized.provider === 'ups') {
    const token = await fetchUpsAccessToken(normalized, env, fetcher);
    const request = prepareJsonBearerRequest(spec, token);
    const parsed = await parseProviderResponse(await fetcher(spec.url, request));
    const label = extractUpsLabel(parsed.data);
    return publicProviderResult({ provider: normalized.provider, action: 'shipping_label', request: { url: spec.url, ...request }, parsed, trackingNumber: label.trackingNumber, labelUrl: label.labelUrl });
  }

  if (normalized.provider === 'resend') {
    const request = prepareJsonBearerRequest(spec, envValue(env, 'RESEND_API_KEY'));
    const parsed = await parseProviderResponse(await fetcher(spec.url, request));
    return publicProviderResult({ provider: normalized.provider, action: 'notification_send', request: { url: spec.url, ...request }, parsed });
  }

  const tokenMap = {
    google_merchant: 'GOOGLE_MERCHANT_ACCESS_TOKEN',
    meta_catalog: 'META_CATALOG_ACCESS_TOKEN',
    tiktok_catalog: 'TIKTOK_CATALOG_ACCESS_TOKEN'
  };
  const request = prepareJsonBearerRequest(spec, envValue(env, tokenMap[normalized.provider]));
  const parsed = await parseProviderResponse(await fetcher(spec.url, request));
  return publicProviderResult({ provider: normalized.provider, action: 'channel_sync', request: { url: spec.url, ...request }, parsed });
}

function extractUpsRates(data = {}, fallbackCurrency = 'USD') {
  const ratedShipment = data?.RateResponse?.RatedShipment || data?.rateResponse?.ratedShipment || data?.RatedShipment || data?.ratedShipment || [];
  const list = Array.isArray(ratedShipment) ? ratedShipment : (ratedShipment ? [ratedShipment] : []);
  return list.map((entry, index) => {
    const total = entry.TotalCharges || entry.totalCharges || entry.NegotiatedRateCharges?.TotalCharge || entry.negotiatedRateCharges?.totalCharge || {};
    const cents = Math.round(Number(total.MonetaryValue || total.monetaryValue || total.value || 0) * 100);
    const service = entry.Service || entry.service || {};
    const code = String(service.Code || service.code || entry.serviceCode || `rate_${index + 1}`).toLowerCase();
    return {
      provider: 'ups',
      serviceCode: code,
      serviceLabel: service.Description || service.description || code.toUpperCase(),
      rateCents: cents,
      currency: String(total.CurrencyCode || total.currencyCode || fallbackCurrency || 'USD').toUpperCase(),
      estimatedDays: Number(entry.GuaranteedDelivery?.BusinessDaysInTransit || entry.guaranteedDelivery?.businessDaysInTransit || 0),
      packageCount: 0,
      source: 'ups_provider_rate'
    };
  }).filter((rate) => rate.rateCents > 0);
}

export async function executeProviderCarrierRates(connection = {}, payload = {}, env = {}, options = {}) {
  const normalized = providerConnectionRecord(connection);
  if (normalized.provider !== 'ups') {
    const error = new Error(`Provider ${normalized.provider} does not support carrier rates in this runtime.`);
    error.code = 'RATE_PROVIDER_UNSUPPORTED';
    throw error;
  }
  assertProviderSecrets(env, normalized.provider);
  const fetcher = options.fetcher || fetch;
  const token = await fetchUpsAccessToken(normalized, env, fetcher);
  const spec = buildNativeProviderDispatch(normalized, { action: 'carrier_rate', rateRequest: payload.rateRequest || payload, context: payload.context || {} });
  const request = prepareJsonBearerRequest(spec, token);
  const parsed = await parseProviderResponse(await fetcher(spec.url, request));
  const rates = parsed.ok ? extractUpsRates(parsed.data, payload.currency || payload.context?.currency || 'USD') : [];
  return { ...publicProviderResult({ provider: normalized.provider, action: 'carrier_rate', request: { url: spec.url, ...request }, parsed }), rates };
}
function stripeFormBody(data = {}) {
  return new URLSearchParams(Object.entries(data).filter(([, value]) => value !== undefined && value !== null && value !== '')).toString();
}

function paymentReferenceKind(reference = '') {
  const ref = String(reference || '');
  if (ref.startsWith('pi_')) return 'payment_intent';
  if (ref.startsWith('ch_')) return 'charge';
  if (ref.startsWith('cs_')) return 'checkout_session';
  return 'payment_intent';
}

export async function executeProviderRefund(connection = {}, payload = {}, env = {}, options = {}) {
  const normalized = providerConnectionRecord(connection);
  if (!['stripe', 'paypal'].includes(normalized.provider)) {
    const error = new Error(`Provider ${normalized.provider} does not support live refunds in this runtime.`);
    error.code = 'REFUND_PROVIDER_UNSUPPORTED';
    throw error;
  }
  assertProviderSecrets(env, normalized.provider);
  const fetcher = options.fetcher || fetch;
  const refund = payload.refund || payload;
  const payment = payload.payment || {};
  const amountCents = Math.max(0, Number(refund.amountCents ?? refund.amount_cents ?? 0) || 0);
  const currency = String(refund.currency || payment.currency || 'USD').toLowerCase();
  const providerReference = String(refund.providerRef || refund.provider_ref || payment.providerReference || payment.provider_reference || '');
  const endpointBase = buildProviderHealthSpec(normalized).endpointBase;

  if (normalized.provider === 'stripe') {
    const referenceKey = paymentReferenceKind(providerReference) === 'charge' ? 'charge' : 'payment_intent';
    const body = stripeFormBody({ [referenceKey]: providerReference, amount: String(amountCents), reason: refund.reason || 'requested_by_customer', metadata_order_id: refund.orderId || refund.order_id || payload.order?.id || '' });
    const request = { method: 'POST', headers: formHeaders({ authorization: `Bearer ${envValue(env, 'STRIPE_SECRET_KEY')}` }), body };
    const parsed = await parseProviderResponse(await fetcher(`${endpointBase}/v1/refunds`, request));
    return publicProviderResult({ provider: 'stripe', action: 'refund_submit', request: { url: `${endpointBase}/v1/refunds`, ...request }, parsed });
  }

  const token = await fetchPaypalAccessToken(normalized, env, fetcher);
  const captureId = providerReference;
  const body = { amount: { value: (amountCents / 100).toFixed(2), currency_code: currency.toUpperCase() }, note_to_payer: refund.note || refund.reason || 'Merchant refund' };
  const request = prepareJsonBearerRequest({ method: 'POST', body }, token);
  const parsed = await parseProviderResponse(await fetcher(`${endpointBase}/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, request));
  return publicProviderResult({ provider: 'paypal', action: 'refund_submit', request: { url: `${endpointBase}/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, ...request }, parsed });
}

export async function executeProviderDisputeEvidence(connection = {}, payload = {}, env = {}, options = {}) {
  const normalized = providerConnectionRecord(connection);
  if (!['stripe', 'paypal'].includes(normalized.provider)) {
    const error = new Error(`Provider ${normalized.provider} does not support live dispute evidence in this runtime.`);
    error.code = 'DISPUTE_PROVIDER_UNSUPPORTED';
    throw error;
  }
  assertProviderSecrets(env, normalized.provider);
  const fetcher = options.fetcher || fetch;
  const dispute = payload.dispute || {};
  const evidence = payload.evidence || payload.packet || {};
  const providerDisputeId = String(dispute.providerDisputeId || dispute.provider_dispute_id || dispute.id || '');
  const endpointBase = buildProviderHealthSpec(normalized).endpointBase;

  if (normalized.provider === 'stripe') {
    const fields = {
      'evidence[customer_communication]': evidence.sections?.customerCommunication || evidence.customerCommunication || '',
      'evidence[refund_policy]': evidence.sections?.refundPolicy || evidence.refundPolicy || '',
      'evidence[shipping_documentation]': JSON.stringify(evidence.sections?.fulfillmentProof || evidence.fulfillmentProof || []),
      'evidence[uncategorized_text]': evidence.summary || evidence.merchantStatement || 'Evidence packet submitted from SkyeCommerce.',
      submit: 'true'
    };
    const request = { method: 'POST', headers: formHeaders({ authorization: `Bearer ${envValue(env, 'STRIPE_SECRET_KEY')}` }), body: stripeFormBody(fields) };
    const parsed = await parseProviderResponse(await fetcher(`${endpointBase}/v1/disputes/${encodeURIComponent(providerDisputeId)}`, request));
    return publicProviderResult({ provider: 'stripe', action: 'dispute_evidence_submit', request: { url: `${endpointBase}/v1/disputes/${encodeURIComponent(providerDisputeId)}`, ...request }, parsed });
  }

  const token = await fetchPaypalAccessToken(normalized, env, fetcher);
  const body = {
    evidences: [{
      evidence_type: 'PROOF_OF_FULFILLMENT',
      evidence_info: {
        tracking_info: (evidence.sections?.fulfillmentProof || evidence.fulfillmentProof || []).map((item) => ({ carrier_name: item.carrier || item.carrierName || 'OTHER', tracking_number: item.trackingNumber || item.tracking_number || '' })).filter((item) => item.tracking_number),
        notes: evidence.summary || evidence.merchantStatement || 'Evidence packet submitted from SkyeCommerce.'
      }
    }]
  };
  const request = prepareJsonBearerRequest({ method: 'POST', body }, token);
  const parsed = await parseProviderResponse(await fetcher(`${endpointBase}/v1/customer/disputes/${encodeURIComponent(providerDisputeId)}/provide-evidence`, request));
  return publicProviderResult({ provider: 'paypal', action: 'dispute_evidence_submit', request: { url: `${endpointBase}/v1/customer/disputes/${encodeURIComponent(providerDisputeId)}/provide-evidence`, ...request }, parsed });
}

export async function verifyPaypalWebhookSignature(env = {}, rawBody = '', headers = {}, options = {}) {
  assertProviderSecrets(env, 'paypal');
  const webhookId = envValue(env, 'PAYPAL_WEBHOOK_ID');
  if (!normalizedText(webhookId)) {
    const error = new Error('PAYPAL_WEBHOOK_ID is required for native PayPal webhook verification.');
    error.code = 'PAYPAL_WEBHOOK_ID_REQUIRED';
    error.missing = ['PAYPAL_WEBHOOK_ID'];
    throw error;
  }
  const getHeader = (name) => typeof headers.get === 'function' ? headers.get(name) : headers[name] || headers[name.toLowerCase()] || '';
  const transmissionId = getHeader('paypal-transmission-id');
  const transmissionTime = getHeader('paypal-transmission-time');
  const certUrl = getHeader('paypal-cert-url');
  const authAlgo = getHeader('paypal-auth-algo');
  const transmissionSig = getHeader('paypal-transmission-sig');
  const missing = [
    ['paypal-transmission-id', transmissionId],
    ['paypal-transmission-time', transmissionTime],
    ['paypal-cert-url', certUrl],
    ['paypal-auth-algo', authAlgo],
    ['paypal-transmission-sig', transmissionSig]
  ].filter(([, value]) => !normalizedText(value)).map(([key]) => key);
  if (missing.length) {
    const error = new Error(`Missing PayPal webhook verification header(s): ${missing.join(', ')}`);
    error.code = 'PAYPAL_WEBHOOK_HEADERS_MISSING';
    error.missing = missing;
    throw error;
  }
  let webhookEvent = {};
  try { webhookEvent = JSON.parse(rawBody || '{}'); } catch {
    const error = new Error('Malformed PayPal webhook body.');
    error.code = 'PAYPAL_WEBHOOK_BODY_MALFORMED';
    throw error;
  }
  const connection = { provider: 'paypal', endpoint_base: envValue(env, 'PAYPAL_ENDPOINT_BASE') || 'https://api-m.paypal.com' };
  const fetcher = options.fetcher || fetch;
  const token = await fetchPaypalAccessToken(connection, env, fetcher);
  const spec = buildProviderHealthSpec(connection);
  const payload = {
    auth_algo: authAlgo,
    cert_url: certUrl,
    transmission_id: transmissionId,
    transmission_sig: transmissionSig,
    transmission_time: transmissionTime,
    webhook_id: webhookId,
    webhook_event: webhookEvent
  };
  const request = prepareJsonBearerRequest({ method: 'POST', body: payload }, token);
  const parsed = await parseProviderResponse(await fetcher(`${spec.endpointBase}/v1/notifications/verify-webhook-signature`, request));
  return {
    ok: parsed.ok && parsed.data?.verification_status === 'SUCCESS',
    status: parsed.ok && parsed.data?.verification_status === 'SUCCESS' ? 'verified' : 'failed',
    httpStatus: parsed.status,
    verificationStatus: parsed.data?.verification_status || '',
    response: parsed.data
  };
}
