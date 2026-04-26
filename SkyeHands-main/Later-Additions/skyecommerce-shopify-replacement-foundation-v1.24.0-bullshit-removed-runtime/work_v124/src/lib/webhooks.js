import { hmacHex } from './utils.js';

export function normalizeWebhookEndpointInput(input = {}) {
  const events = Array.isArray(input.events) ? input.events.map((event) => String(event).trim()).filter(Boolean) : ['order.created'];
  return {
    name: String(input.name || 'Commerce webhook').trim().slice(0, 120),
    url: String(input.url || '').trim(),
    events: events.length ? events : ['order.created'],
    secret: String(input.secret || '').trim(),
    active: input.active === undefined ? true : Boolean(input.active),
    headers: input.headers && typeof input.headers === 'object' ? input.headers : {}
  };
}

export function webhookEndpointRecord(row = {}) {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    name: row.name || '',
    url: row.url || '',
    events: safeJson(row.events_json, []),
    active: Boolean(Number(row.active || 0)),
    headers: safeJson(row.headers_json, {}),
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

export function webhookDeliveryRecord(row = {}) {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    endpointId: row.endpoint_id || '',
    eventType: row.event_type || '',
    status: row.status || 'queued',
    attemptCount: Number(row.attempt_count || 0),
    httpStatus: Number(row.http_status || 0),
    responseText: row.response_text || '',
    payload: safeJson(row.payload_json, {}),
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    deliveredAt: row.delivered_at || ''
  };
}

export async function buildSignedWebhookRequest(endpoint = {}, delivery = {}) {
  const payload = JSON.stringify(delivery.payload || delivery.payload_json || {});
  const timestamp = String(Math.floor(Date.now() / 1000));
  const secret = endpoint.secret || endpoint.webhook_secret || '';
  const signature = secret ? await hmacHex(secret, `${timestamp}.${payload}`) : '';
  const headers = {
    'content-type': 'application/json',
    'user-agent': 'SkyeCommerce-Webhooks/1.2',
    'x-skyecommerce-event': delivery.eventType || delivery.event_type || '',
    'x-skyecommerce-delivery': delivery.id || '',
    'x-skyecommerce-timestamp': timestamp,
    ...(endpoint.headers || {})
  };
  if (signature) headers['x-skyecommerce-signature'] = signature;
  return { url: endpoint.url, method: 'POST', headers, body: payload };
}

function safeJson(raw, fallback) {
  try { return JSON.parse(raw || JSON.stringify(fallback)); } catch { return fallback; }
}
