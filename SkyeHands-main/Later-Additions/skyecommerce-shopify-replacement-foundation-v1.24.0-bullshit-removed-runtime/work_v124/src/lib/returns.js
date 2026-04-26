export const RETURN_STATUSES = ['requested', 'approved', 'denied', 'received', 'refunded', 'closed'];
export const RETURN_RESOLUTIONS = ['refund', 'exchange', 'store_credit', 'none'];

function normalizedText(value = '') {
  return String(value || '').trim();
}

function boolish(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return value === true || value === 'true' || value === '1' || value === 1;
}

function coerceEnum(value, allowed, fallback) {
  const normalized = normalizedText(value).toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

export function returnRecord(row) {
  let items = [];
  try { items = JSON.parse(row.items_json || '[]'); } catch { items = []; }
  return {
    id: row.id,
    merchantId: row.merchant_id,
    orderId: row.order_id,
    customerId: row.customer_id || '',
    status: row.status || 'requested',
    reason: row.reason || '',
    customerNote: row.customer_note || '',
    merchantNote: row.merchant_note || '',
    resolutionType: row.resolution_type || 'refund',
    requestedCents: Number(row.requested_cents || 0),
    approvedCents: Number(row.approved_cents || 0),
    refundReference: row.refund_reference || '',
    restockItems: Boolean(Number(row.restock_items || 0)),
    restockedAt: row.restocked_at || '',
    items,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

export function computeRequestedReturnCents(orderItems = [], requestedItems = []) {
  const map = new Map((Array.isArray(orderItems) ? orderItems : []).map((item) => [String(item.productId || ''), item]));
  return (Array.isArray(requestedItems) ? requestedItems : []).reduce((sum, item) => {
    const source = map.get(String(item.productId || ''));
    if (!source) return sum;
    return sum + (Number(source.unitPriceCents || 0) * Math.max(0, Number(item.quantity || 0)));
  }, 0);
}

export function normalizeReturnRequestInput(body = {}, order = null) {
  const orderItems = Array.isArray(order?.items) ? order.items : [];
  const items = (Array.isArray(body.items) ? body.items : [])
    .map((item) => ({
      productId: normalizedText(item.productId || ''),
      title: normalizedText(item.title || ''),
      quantity: Math.max(0, Number(item.quantity || 0) || 0)
    }))
    .filter((item) => item.productId && item.quantity > 0)
    .map((item) => {
      const source = orderItems.find((orderItem) => String(orderItem.productId || '') === item.productId);
      return {
        productId: item.productId,
        title: item.title || source?.title || '',
        quantity: Math.min(item.quantity, Math.max(1, Number(source?.quantity || item.quantity || 1)))
      };
    });
  return {
    reason: normalizedText(body.reason || ''),
    customerNote: normalizedText(body.customerNote || body.note || ''),
    resolutionType: coerceEnum(body.resolutionType, RETURN_RESOLUTIONS, 'refund'),
    restockItems: boolish(body.restockItems, true),
    items,
    requestedCents: Math.max(0, Number(body.requestedCents || 0) || 0) || computeRequestedReturnCents(orderItems, items)
  };
}

export function normalizeReturnPatch(body = {}, existing = {}) {
  return {
    status: coerceEnum(body.status, RETURN_STATUSES, existing.status || 'requested'),
    approvedCents: Math.max(0, Number(body.approvedCents ?? existing.approvedCents ?? 0) || 0),
    merchantNote: normalizedText(body.merchantNote || existing.merchantNote || ''),
    refundReference: normalizedText(body.refundReference || existing.refundReference || ''),
    resolutionType: coerceEnum(body.resolutionType, RETURN_RESOLUTIONS, existing.resolutionType || 'refund'),
    restockItems: boolish(body.restockItems, existing.restockItems ?? true)
  };
}

export function shouldRestockReturn(updated = {}) {
  return Boolean(updated.restockItems) && !updated.restockedAt && ['received', 'refunded', 'closed'].includes(updated.status);
}
