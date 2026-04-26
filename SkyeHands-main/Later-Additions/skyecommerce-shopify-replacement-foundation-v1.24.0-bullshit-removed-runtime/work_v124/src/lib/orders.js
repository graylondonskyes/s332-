export const ORDER_STATUSES = ['received', 'confirmed', 'packed', 'fulfilled', 'cancelled'];
export const PAYMENT_STATUSES = ['pending_manual', 'pending_provider', 'pending_provider_failure', 'authorized', 'paid', 'refunded', 'voided'];
export const FULFILLMENT_STATUSES = ['queued', 'label_created', 'in_transit', 'delivered', 'cancelled'];

export function coerceEnum(value, allowed, fallback) {
  const normalized = String(value || '').trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

export function normalizeOrderPatch(body = {}, existing = {}) {
  return {
    status: coerceEnum(body.status, ORDER_STATUSES, existing.status || 'received'),
    paymentStatus: coerceEnum(body.paymentStatus, PAYMENT_STATUSES, existing.paymentStatus || 'pending_manual'),
    note: String(body.note || '').trim(),
    paymentReference: String(body.paymentReference || '').trim()
  };
}

export function normalizeFulfillmentInput(body = {}) {
  return {
    carrier: String(body.carrier || '').trim(),
    service: String(body.service || '').trim(),
    trackingNumber: String(body.trackingNumber || '').trim(),
    trackingUrl: String(body.trackingUrl || '').trim(),
    status: coerceEnum(body.status, FULFILLMENT_STATUSES, 'queued'),
    note: String(body.note || '').trim()
  };
}

export function buildOrderEvent(kind, summary = {}, detail = '') {
  return {
    kind: String(kind || 'note').trim().toLowerCase(),
    summary: String(summary.summary || '').trim() || 'Order updated',
    status: String(summary.status || '').trim(),
    paymentStatus: String(summary.paymentStatus || '').trim(),
    fulfillmentStatus: String(summary.fulfillmentStatus || '').trim(),
    detail: String(detail || summary.detail || '').trim()
  };
}
