function normalizedText(value = '') {
  return String(value || '').trim();
}

const DUNNING_STAGES = new Set(['invoice_opened', 'payment_session_created', 'payment_failed', 'dunning_sent', 'payment_captured', 'invoice_closed']);
const INVOICE_STATUSES = new Set(['open', 'paid', 'failed', 'voided']);
const LIVE_PAYMENT_PROVIDERS = new Set(['stripe', 'paypal']);

function coerceStage(value = 'invoice_opened') {
  const normalized = normalizedText(value).toLowerCase();
  return DUNNING_STAGES.has(normalized) ? normalized : 'invoice_opened';
}

function coerceInvoiceStatus(value = 'open') {
  const normalized = normalizedText(value).toLowerCase();
  return INVOICE_STATUSES.has(normalized) ? normalized : 'open';
}

function coercePaymentProvider(value = '') {
  const normalized = normalizedText(value).toLowerCase();
  return LIVE_PAYMENT_PROVIDERS.has(normalized) ? normalized : '';
}

export function dunningEventRecord(row = {}) {
  return {
    id: row.id || '',
    merchantId: row.merchant_id || row.merchantId || '',
    subscriptionId: row.subscription_id || row.subscriptionId || '',
    invoiceId: row.invoice_id || row.invoiceId || '',
    stage: coerceStage(row.stage || 'invoice_opened'),
    note: row.note || '',
    createdAt: row.created_at || row.createdAt || ''
  };
}

export function normalizeInvoicePaymentSessionInput(body = {}, invoice = {}) {
  return {
    provider: coercePaymentProvider(body.provider || ''),
    providerConnectionId: normalizedText(body.providerConnectionId || body.provider_connection_id || ''),
    amountCents: Math.max(0, Number(body.amountCents ?? invoice.amountCents ?? 0) || 0),
    currency: normalizedText(body.currency || invoice.currency || 'USD').toUpperCase(),
    returnUrl: normalizedText(body.returnUrl || ''),
    cancelUrl: normalizedText(body.cancelUrl || ''),
    metadata: typeof body.metadata === 'object' && body.metadata ? body.metadata : {}
  };
}

export function buildDunningEvent({ stage = 'invoice_opened', note = '', subscriptionId = '', invoiceId = '' } = {}) {
  return {
    stage: coerceStage(stage),
    note: normalizedText(note || ''),
    subscriptionId: normalizedText(subscriptionId || ''),
    invoiceId: normalizedText(invoiceId || '')
  };
}

export function applyInvoicePaymentUpdate(invoice = {}, paymentUpdate = {}, subscription = {}) {
  const paymentStatus = normalizedText(paymentUpdate.orderPaymentStatus || paymentUpdate.status || '').toLowerCase();
  const nextInvoiceStatus = paymentStatus === 'paid'
    ? 'paid'
    : paymentStatus === 'failed'
      ? 'failed'
      : coerceInvoiceStatus(invoice.status || 'open');
  const nextSubscriptionStatus = paymentStatus === 'paid'
    ? 'active'
    : paymentStatus === 'failed'
      ? 'past_due'
      : normalizedText(subscription.status || 'active').toLowerCase();
  return {
    invoiceStatus: nextInvoiceStatus,
    subscriptionStatus: nextSubscriptionStatus,
    dunningStage: paymentStatus === 'paid' ? 'payment_captured' : paymentStatus === 'failed' ? 'payment_failed' : 'invoice_opened'
  };
}
