import { money } from './utils.js';

const PAYMENT_PROVIDERS = new Set(['stripe', 'paypal']);
const PAYMENT_STATUSES = new Set(['pending', 'authorized', 'paid', 'failed', 'voided', 'refunded']);

function normalizedText(value = '') {
  return String(value || '').trim();
}

function coerceProvider(value) {
  const normalized = normalizedText(value).toLowerCase();
  return PAYMENT_PROVIDERS.has(normalized) ? normalized : '';
}

function coerceStatus(value, fallback = 'pending') {
  const normalized = normalizedText(value).toLowerCase();
  return PAYMENT_STATUSES.has(normalized) ? normalized : fallback;
}

export function supportedPaymentProviders() {
  return [...PAYMENT_PROVIDERS];
}

export function paymentTransactionRecord(row = {}) {
  return {
    id: row.id || '',
    merchantId: row.merchant_id || row.merchantId || '',
    orderId: row.order_id || row.orderId || '',
    provider: coerceProvider(row.provider || ''),
    providerReference: row.provider_reference || row.providerReference || '',
    checkoutToken: row.checkout_token || row.checkoutToken || '',
    status: coerceStatus(row.status || 'pending'),
    amountCents: Number(row.amount_cents ?? row.amountCents ?? 0),
    currency: normalizedText(row.currency || 'USD').toUpperCase(),
    payload: (() => {
      try {
        return JSON.parse(row.payload_json || row.payloadJson || '{}');
      } catch {
        return {};
      }
    })(),
    authorizedAt: row.authorized_at || row.authorizedAt || '',
    capturedAt: row.captured_at || row.capturedAt || '',
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

export function normalizePaymentSessionInput(body = {}, order = {}) {
  return {
    provider: coerceProvider(body.provider || ''),
    providerConnectionId: normalizedText(body.providerConnectionId || body.provider_connection_id || ''),
    amountCents: Math.max(0, Number(body.amountCents ?? order.totalCents ?? 0) || 0),
    currency: normalizedText(body.currency || order.currency || 'USD').toUpperCase(),
    returnUrl: normalizedText(body.returnUrl || ''),
    cancelUrl: normalizedText(body.cancelUrl || ''),
    customerEmail: normalizedText(body.customerEmail || order.customerEmail || '').toLowerCase(),
    metadata: typeof body.metadata === 'object' && body.metadata ? body.metadata : {}
  };
}

export function buildHostedPaymentSession({ transactionId = '', checkoutToken = '', provider = '', amountCents = 0, currency = 'USD', merchantSlug = '', orderNumber = '', returnUrl = '', cancelUrl = '', externalCheckoutUrl = '', providerReference = '' } = {}) {
  const checkoutUrl = normalizedText(externalCheckoutUrl || '');
  return {
    transactionId,
    checkoutToken,
    provider: coerceProvider(provider),
    amountCents: Math.max(0, Number(amountCents || 0) || 0),
    currency: normalizedText(currency || 'USD').toUpperCase(),
    merchantSlug,
    orderNumber,
    checkoutUrl,
    displayTotal: money(amountCents, currency),
    external: Boolean(checkoutUrl),
    providerReference,
    returnUrl,
    cancelUrl
  };
}

export function normalizePaymentWebhookInput(body = {}) {
  return {
    provider: coerceProvider(body.provider || ''),
    checkoutToken: normalizedText(body.checkoutToken || body.checkout_token || ''),
    providerReference: normalizedText(body.providerReference || body.provider_reference || ''),
    status: coerceStatus(body.status || 'pending'),
    amountCents: Math.max(0, Number(body.amountCents ?? body.amount_cents ?? 0) || 0),
    currency: normalizedText(body.currency || 'USD').toUpperCase(),
    eventId: normalizedText(body.eventId || body.event_id || ''),
    note: normalizedText(body.note || ''),
    raw: body
  };
}

export function applyPaymentWebhook(current = {}, incoming = {}) {
  const existing = paymentTransactionRecord(current);
  const nextStatus = coerceStatus(incoming.status || existing.status || 'pending');
  const amountCents = Math.max(0, Number(incoming.amountCents ?? existing.amountCents ?? 0) || 0);
  const providerReference = normalizedText(incoming.providerReference || existing.providerReference || '');
  return {
    status: nextStatus,
    amountCents,
    currency: normalizedText(incoming.currency || existing.currency || 'USD').toUpperCase(),
    providerReference,
    authorizedAt: nextStatus === 'authorized' ? (existing.authorizedAt || new Date().toISOString()) : existing.authorizedAt,
    capturedAt: nextStatus === 'paid' ? (existing.capturedAt || new Date().toISOString()) : existing.capturedAt,
    orderPaymentStatus: nextStatus === 'paid'
      ? 'paid'
      : nextStatus === 'authorized'
        ? 'authorized'
        : nextStatus === 'refunded'
          ? 'refunded'
          : nextStatus === 'voided'
            ? 'voided'
            : nextStatus === 'failed'
              ? 'pending_provider_failure'
              : existing.orderPaymentStatus || 'pending_provider'
  };
}

export function buildPaymentTimelineEvent({ orderNumber = '', provider = '', status = 'pending', amountCents = 0, currency = 'USD', providerReference = '' } = {}) {
  const normalizedStatus = coerceStatus(status, 'pending');
  const label = normalizedStatus === 'paid'
    ? 'Payment captured'
    : normalizedStatus === 'authorized'
      ? 'Payment authorized'
      : normalizedStatus === 'failed'
        ? 'Payment failed'
        : normalizedStatus === 'refunded'
          ? 'Payment refunded'
          : normalizedStatus === 'voided'
            ? 'Payment voided'
            : 'Payment session created';
  return {
    kind: `payment_${normalizedStatus}`,
    summary: `${label} for ${orderNumber || 'order'}`,
    paymentStatus: normalizedStatus === 'pending' ? 'pending_provider' : normalizedStatus,
    detail: [provider, providerReference, money(amountCents, currency)].filter(Boolean).join(' · ')
  };
}

export function normalizeNativePaymentWebhookInput(provider = '', body = {}) {
  const normalizedProvider = coerceProvider(provider || body.provider || '');
  if (normalizedProvider === 'stripe') {
    const eventType = normalizedText(body.type || '');
    const object = body.data?.object || body.object || body;
    const status = eventType === 'checkout.session.completed' || eventType === 'payment_intent.succeeded' || object.payment_status === 'paid' ? 'paid' : eventType.includes('failed') ? 'failed' : 'pending';
    return normalizePaymentWebhookInput({
      provider: 'stripe',
      checkoutToken: object.client_reference_id || object.metadata?.checkoutToken || object.id || '',
      providerReference: object.payment_intent || object.id || body.id || '',
      status,
      amountCents: object.amount_total ?? object.amount_received ?? object.amount ?? 0,
      currency: object.currency || 'USD',
      eventId: body.id || '',
      raw: body
    });
  }
  if (normalizedProvider === 'paypal') {
    const resource = body.resource || body;
    const eventType = normalizedText(body.event_type || body.type || '');
    const amount = resource.amount?.value || resource.purchase_units?.[0]?.amount?.value || '0';
    const status = eventType.includes('COMPLETED') || resource.status === 'COMPLETED' || resource.status === 'APPROVED' ? 'paid' : eventType.includes('DENIED') || eventType.includes('FAILED') ? 'failed' : 'pending';
    return normalizePaymentWebhookInput({
      provider: 'paypal',
      checkoutToken: resource.custom_id || resource.invoice_id || resource.id || '',
      providerReference: resource.id || body.id || '',
      status,
      amountCents: Math.round(Number(amount || 0) * 100),
      currency: resource.amount?.currency_code || resource.purchase_units?.[0]?.amount?.currency_code || 'USD',
      eventId: body.id || '',
      raw: body
    });
  }
  return normalizePaymentWebhookInput({ ...body, provider: '' });
}
