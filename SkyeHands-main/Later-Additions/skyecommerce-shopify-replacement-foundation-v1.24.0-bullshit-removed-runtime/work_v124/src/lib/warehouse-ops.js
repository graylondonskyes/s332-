import { hmacHex, uid } from './utils.js';
import { requireHttpsUrl, parseJsonSafe } from './full-platform.js';

const WORK_ORDER_STATUSES = new Set(['created', 'submitted', 'accepted', 'picking', 'packed', 'ready_for_carrier', 'completed', 'failed', 'cancelled']);
const PRIORITIES = new Set(['standard', 'expedite', 'hold_for_review']);
const SHIPMENT_STATUSES = new Set(['label_created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'returned', 'cancelled']);

function clean(value = '') {
  return String(value || '').trim();
}

function coerceWorkOrderStatus(value = 'created') {
  const normalized = clean(value).toLowerCase();
  return WORK_ORDER_STATUSES.has(normalized) ? normalized : 'created';
}

function coerceShipmentStatus(value = 'in_transit') {
  const normalized = clean(value).toLowerCase();
  return SHIPMENT_STATUSES.has(normalized) ? normalized : 'in_transit';
}

function coercePriority(value = 'standard') {
  const normalized = clean(value).toLowerCase();
  return PRIORITIES.has(normalized) ? normalized : 'standard';
}

export function normalizeWarehouseWorkOrderInput(body = {}, order = {}) {
  const dueAt = clean(body.dueAt || body.due_at || '');
  if (dueAt && Number.isNaN(Date.parse(dueAt))) throw new Error('dueAt must be an ISO-compatible datetime when provided.');
  const priority = coercePriority(body.priority || 'standard');
  const locationId = clean(body.locationId || body.location_id || '');
  const instructions = clean(body.instructions || body.note || '').slice(0, 1200);
  const items = Array.isArray(body.items) && body.items.length ? body.items : (Array.isArray(order.items) ? order.items : []);
  return {
    locationId,
    priority,
    dueAt,
    instructions,
    requireCarrierLabel: body.requireCarrierLabel === undefined ? true : Boolean(body.requireCarrierLabel),
    items: items.map((item) => ({
      productId: clean(item.productId || item.product_id || ''),
      variantId: clean(item.variantId || item.variant_id || ''),
      title: clean(item.title || item.name || '').slice(0, 240),
      sku: clean(item.sku || '').slice(0, 120),
      quantity: Math.max(1, Number(item.quantity || 1) || 1)
    })).filter((item) => item.productId || item.sku || item.title)
  };
}

export function buildWarehouseWorkOrderPayload({ merchant = {}, order = {}, workOrder = {}, allocations = [], shippingLabels = [], routexHandoffs = [] } = {}) {
  if (!merchant?.id) throw new Error('merchant is required for warehouse work order handoff.');
  if (!order?.id) throw new Error('order is required for warehouse work order handoff.');
  const input = normalizeWarehouseWorkOrderInput(workOrder, order);
  if (!input.items.length) throw new Error('Warehouse work order requires at least one order item.');
  if (input.requireCarrierLabel && !(shippingLabels || []).some((label) => label.trackingNumber || label.tracking_number)) {
    throw new Error('Warehouse work order requires a purchased carrier label or requireCarrierLabel=false.');
  }
  return {
    eventType: 'warehouse.work_order.submit',
    workOrder: {
      id: workOrder.id || uid('whwo'),
      status: coerceWorkOrderStatus(workOrder.status || 'submitted'),
      priority: input.priority,
      dueAt: input.dueAt,
      locationId: input.locationId,
      instructions: input.instructions
    },
    merchant: {
      id: merchant.id,
      slug: merchant.slug || '',
      brandName: merchant.brandName || merchant.brand_name || '',
      currency: merchant.currency || order.currency || 'USD'
    },
    order: {
      id: order.id,
      orderNumber: order.orderNumber || order.order_number || '',
      status: order.status || '',
      paymentStatus: order.paymentStatus || order.payment_status || '',
      customerName: order.customerName || order.customer_name || '',
      customerEmail: order.customerEmail || order.customer_email || '',
      shippingAddress: order.shippingAddress || parseJsonSafe(order.shipping_address_json, {}),
      totalCents: Number(order.totalCents ?? order.total_cents ?? 0),
      currency: order.currency || merchant.currency || 'USD'
    },
    items: input.items,
    allocations: (allocations || []).map((item) => ({
      id: item.id || '',
      productId: item.productId || item.product_id || '',
      locationId: item.locationId || item.location_id || '',
      locationCode: item.locationCode || item.location_code || '',
      quantity: Number(item.quantity || 0)
    })),
    carrierLabels: (shippingLabels || []).map((label) => ({
      id: label.id || '',
      provider: label.provider || '',
      serviceCode: label.serviceCode || label.service_code || '',
      trackingNumber: label.trackingNumber || label.tracking_number || '',
      trackingUrl: label.trackingUrl || label.tracking_url || '',
      labelUrl: label.labelUrl || label.label_url || '',
      status: label.status || ''
    })),
    routexHandoffs: (routexHandoffs || []).map((handoff) => ({
      id: handoff.id || '',
      kind: handoff.kind || '',
      status: handoff.status || '',
      routeDate: handoff.routeDate || handoff.route_date || '',
      externalRef: handoff.externalRef || handoff.external_ref || ''
    })),
    submittedAt: new Date().toISOString()
  };
}

export function warehouseWorkOrderRecord(row = {}) {
  return {
    id: row.id || '',
    merchantId: row.merchant_id || row.merchantId || '',
    orderId: row.order_id || row.orderId || '',
    locationId: row.location_id || row.locationId || '',
    priority: coercePriority(row.priority || 'standard'),
    status: coerceWorkOrderStatus(row.status || 'created'),
    dueAt: row.due_at || row.dueAt || '',
    externalRef: row.external_ref || row.externalRef || '',
    httpStatus: Number(row.http_status || row.httpStatus || 0),
    request: parseJsonSafe(row.request_json || row.request, {}),
    response: parseJsonSafe(row.response_json || row.response, {}),
    error: row.error || '',
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

export async function executeWarehouseWorkOrder(env = {}, payload = {}, options = {}) {
  const endpoint = requireHttpsUrl(options.url || env.WAREHOUSE_INGEST_URL || '', 'WAREHOUSE_INGEST_URL');
  const secret = clean(options.secret || env.WAREHOUSE_SIGNING_SECRET || '');
  if (!secret || secret.length < 16) throw new Error('WAREHOUSE_SIGNING_SECRET is required for production warehouse handoff.');
  const body = JSON.stringify(payload || {});
  const signature = await hmacHex(secret, body);
  const fetcher = options.fetcher || fetch;
  const response = await fetcher(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'SkyeCommerce-WarehouseOps/1.18.0',
      'x-skye-event': 'warehouse.work_order.submit',
      'x-skye-signature': `sha256=${signature}`
    },
    body
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 2000) }; }
  const externalRef = data?.id || data?.workOrderId || data?.jobId || response.headers.get('x-request-id') || '';
  return { ok: response.ok, status: response.ok ? 'submitted' : 'failed', httpStatus: response.status, externalRef, response: data || {} };
}

export function normalizeShipmentTrackingEvent(body = {}) {
  const payload = typeof body === 'object' && body ? body : {};
  const status = coerceShipmentStatus(payload.status || payload.eventType || payload.event_type || payload.currentStatus || 'in_transit');
  const eventTime = clean(payload.eventTime || payload.event_time || payload.timestamp || new Date().toISOString());
  if (eventTime && Number.isNaN(Date.parse(eventTime))) throw new Error('eventTime must be an ISO-compatible datetime.');
  return {
    provider: clean(payload.provider || 'ups').toLowerCase(),
    trackingNumber: clean(payload.trackingNumber || payload.tracking_number || payload.tracking || payload.track_no || ''),
    labelId: clean(payload.labelId || payload.label_id || ''),
    fulfillmentId: clean(payload.fulfillmentId || payload.fulfillment_id || ''),
    status,
    eventType: clean(payload.eventType || payload.event_type || status),
    eventTime,
    location: clean(payload.location || payload.city || '').slice(0, 240),
    detail: clean(payload.detail || payload.description || payload.message || '').slice(0, 1200),
    raw: payload
  };
}

export function shipmentTrackingEventRecord(row = {}) {
  return {
    id: row.id || '',
    merchantId: row.merchant_id || row.merchantId || '',
    orderId: row.order_id || row.orderId || '',
    labelId: row.label_id || row.labelId || '',
    fulfillmentId: row.fulfillment_id || row.fulfillmentId || '',
    provider: row.provider || 'ups',
    trackingNumber: row.tracking_number || row.trackingNumber || '',
    status: coerceShipmentStatus(row.status || 'in_transit'),
    eventType: row.event_type || row.eventType || '',
    eventTime: row.event_time || row.eventTime || '',
    location: row.location || '',
    detail: row.detail || '',
    raw: parseJsonSafe(row.raw_json || row.raw, {}),
    createdAt: row.created_at || row.createdAt || ''
  };
}

export async function verifySignedJsonWebhook({ rawBody = '', secret = '', signatureHeader = '' } = {}) {
  const signingSecret = clean(secret);
  if (!signingSecret || signingSecret.length < 16) throw new Error('Webhook signing secret with at least 16 characters is required.');
  const expected = await hmacHex(signingSecret, rawBody);
  const supplied = clean(signatureHeader).replace(/^sha256=/i, '');
  return supplied.length > 0 && supplied === expected;
}

export function nextFulfillmentStatusFromShipment(status = '') {
  const normalized = coerceShipmentStatus(status);
  if (normalized === 'delivered') return { orderStatus: 'fulfilled', fulfillmentStatus: 'delivered', labelStatus: 'delivered' };
  if (normalized === 'exception') return { orderStatus: 'fulfillment_exception', fulfillmentStatus: 'exception', labelStatus: 'exception' };
  if (normalized === 'returned') return { orderStatus: 'return_in_transit', fulfillmentStatus: 'returned', labelStatus: 'returned' };
  if (normalized === 'cancelled') return { orderStatus: '', fulfillmentStatus: 'cancelled', labelStatus: 'cancelled' };
  if (normalized === 'out_for_delivery') return { orderStatus: 'out_for_delivery', fulfillmentStatus: 'out_for_delivery', labelStatus: 'out_for_delivery' };
  if (normalized === 'picked_up' || normalized === 'in_transit') return { orderStatus: 'in_transit', fulfillmentStatus: normalized, labelStatus: normalized };
  return { orderStatus: '', fulfillmentStatus: normalized, labelStatus: normalized };
}
