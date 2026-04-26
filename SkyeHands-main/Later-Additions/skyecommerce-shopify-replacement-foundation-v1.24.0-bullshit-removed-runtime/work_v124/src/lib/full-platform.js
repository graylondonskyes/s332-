import { hmacHex, slugify, uid } from './utils.js';

const HTTPS_URL_RE = /^https:\/\//i;

export function requireHttpsUrl(value = '', field = 'url') {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${field} is required.`);
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    throw new Error(`${field} must be a valid URL.`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`${field} must use HTTPS for production execution.`);
  return parsed.toString();
}

export function parseJsonSafe(value, fallback) {
  try {
    return JSON.parse(value || '');
  } catch {
    return fallback;
  }
}

export function absoluteUrl(value = '', baseUrl = '') {
  const raw = String(value || '').trim();
  if (!raw || raw.startsWith('data:') || raw.startsWith('javascript:')) return '';
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return '';
  }
}

function decodeHtmlEntities(value = '') {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function firstSrcsetUrl(value = '') {
  const first = String(value || '').split(',').map((item) => item.trim()).find(Boolean) || '';
  return first.split(/\s+/)[0] || '';
}

function pushCandidate(candidates, url, kind, source = '', baseUrl = '') {
  const resolved = absoluteUrl(decodeHtmlEntities(url), baseUrl);
  if (!resolved || !HTTPS_URL_RE.test(resolved)) return;
  if (candidates.some((item) => item.url === resolved)) return;
  candidates.push({ url: resolved, kind, source });
}

export function extractDonorVisualsFromHtml(html = '', sourceUrl = '') {
  const text = String(html || '');
  const baseHref = text.match(/<base[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] || sourceUrl;
  const candidates = [];

  const metaRe = /<meta\s+[^>]*(?:property|name)=["']([^"']+)["'][^>]*content=["']([^"']+)["'][^>]*>|<meta\s+[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = metaRe.exec(text))) {
    const property = String(match[1] || match[4] || '').toLowerCase();
    const content = match[2] || match[3] || '';
    if (['og:image', 'og:image:secure_url', 'twitter:image', 'twitter:image:src'].includes(property)) {
      pushCandidate(candidates, content, property.includes('twitter') ? 'twitter_image' : 'open_graph_image', property, baseHref);
    }
  }

  const linkRe = /<link\s+[^>]*rel=["']([^"']+)["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  while ((match = linkRe.exec(text))) {
    const rel = String(match[1] || '').toLowerCase();
    if (rel.includes('image_src') || rel.includes('preload')) pushCandidate(candidates, match[2], 'linked_image', rel, baseHref);
  }

  const imgRe = /<img\s+[^>]*>/gi;
  while ((match = imgRe.exec(text))) {
    const tag = match[0];
    const src = tag.match(/\ssrc=["']([^"']+)["']/i)?.[1] || tag.match(/\sdata-src=["']([^"']+)["']/i)?.[1] || firstSrcsetUrl(tag.match(/\ssrcset=["']([^"']+)["']/i)?.[1] || '');
    const alt = tag.match(/\salt=["']([^"']*)["']/i)?.[1] || '';
    pushCandidate(candidates, src, 'img_tag', alt, baseHref);
  }

  const title = decodeHtmlEntities(text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim();
  const canonical = absoluteUrl(text.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i)?.[1] || sourceUrl, baseHref);
  return { title, canonicalUrl: canonical || sourceUrl, images: candidates.slice(0, 24) };
}

export function buildProductMediaRecord({ merchantId, productId, url, alt = '', source = 'donor_ingest', position = 0 }) {
  return {
    id: uid('pmedia'),
    merchantId,
    productId,
    url: requireHttpsUrl(url, 'image url'),
    alt: String(alt || '').slice(0, 220),
    source: String(source || 'donor_ingest').slice(0, 80),
    position: Math.max(0, Number(position || 0) || 0)
  };
}

export function productMediaRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    merchantId: row.merchant_id,
    productId: row.product_id,
    url: row.url,
    alt: row.alt || '',
    source: row.source || '',
    position: Number(row.position || 0),
    createdAt: row.created_at || ''
  };
}

export function donorVisualImportRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    merchantId: row.merchant_id,
    productId: row.product_id || '',
    sourceUrl: row.source_url,
    status: row.status,
    imageCount: Number(row.image_count || 0),
    selectedImageUrl: row.selected_image_url || '',
    result: parseJsonSafe(row.result_json, {}),
    createdAt: row.created_at || ''
  };
}

export function buildFulfillmentSyncPayload({ merchant, order, fulfillments = [], shippingLabels = [], returnRequests = [], eventType = 'order.fulfillment_sync' } = {}) {
  if (!merchant?.id) throw new Error('merchant is required for fulfillment sync.');
  if (!order?.id) throw new Error('order is required for fulfillment sync.');
  return {
    eventType,
    merchant: {
      id: merchant.id,
      slug: merchant.slug,
      brandName: merchant.brandName || merchant.brand_name || '',
      currency: merchant.currency || order.currency || 'USD'
    },
    order: {
      id: order.id,
      orderNumber: order.orderNumber || order.order_number || '',
      status: order.status || '',
      paymentStatus: order.paymentStatus || order.payment_status || '',
      customer: {
        id: order.customerId || order.customer_id || '',
        name: order.customerName || order.customer_name || '',
        email: order.customerEmail || order.customer_email || ''
      },
      shippingAddress: order.shippingAddress || parseJsonSafe(order.shipping_address_json, {}),
      totals: {
        subtotalCents: Number(order.subtotalCents ?? order.subtotal_cents ?? 0),
        shippingCents: Number(order.shippingCents ?? order.shipping_cents ?? 0),
        taxCents: Number(order.taxCents ?? order.tax_cents ?? 0),
        totalCents: Number(order.totalCents ?? order.total_cents ?? 0),
        currency: order.currency || merchant.currency || 'USD'
      },
      items: order.items || parseJsonSafe(order.items_json, [])
    },
    fulfillments: fulfillments.map((item) => ({
      id: item.id,
      carrier: item.carrier || '',
      service: item.service || '',
      trackingNumber: item.trackingNumber || item.tracking_number || '',
      trackingUrl: item.trackingUrl || item.tracking_url || '',
      status: item.status || '',
      note: item.note || ''
    })),
    shippingLabels: shippingLabels.map((item) => ({
      id: item.id,
      provider: item.provider || '',
      serviceCode: item.serviceCode || item.service_code || '',
      trackingNumber: item.trackingNumber || item.tracking_number || '',
      trackingUrl: item.trackingUrl || item.tracking_url || '',
      labelUrl: item.labelUrl || item.label_url || '',
      status: item.status || ''
    })),
    returns: returnRequests.map((item) => ({
      id: item.id,
      status: item.status || '',
      reason: item.reason || '',
      resolutionType: item.resolutionType || item.resolution_type || '',
      requestedCents: Number(item.requestedCents ?? item.requested_cents ?? 0),
      approvedCents: Number(item.approvedCents ?? item.approved_cents ?? 0),
      items: item.items || parseJsonSafe(item.items_json, [])
    })),
    generatedAt: new Date().toISOString()
  };
}

export function fulfillmentSyncJobRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    merchantId: row.merchant_id,
    orderId: row.order_id,
    target: row.target,
    status: row.status,
    httpStatus: Number(row.http_status || 0),
    request: parseJsonSafe(row.request_json, {}),
    response: parseJsonSafe(row.response_json, {}),
    error: row.error || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

export async function executeSignedJsonPost({ url, payload, secret, eventType = 'commerce.sync', headers = {} } = {}) {
  const endpoint = requireHttpsUrl(url, 'sync url');
  const body = JSON.stringify(payload || {});
  const signingSecret = String(secret || '').trim();
  if (!signingSecret || signingSecret.length < 16) throw new Error('A production signing secret with at least 16 characters is required.');
  const signature = await hmacHex(signingSecret, body);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'SkyeCommerce-FulfillmentSync/1.18.0',
      'x-skye-event': eventType,
      'x-skye-signature': `sha256=${signature}`,
      ...headers
    },
    body
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 2000) }; }
  return {
    status: response.ok ? 'delivered' : 'failed',
    httpStatus: response.status,
    providerReference: response.headers.get('x-request-id') || response.headers.get('x-skye-ref') || '',
    response: data || {},
    ok: response.ok
  };
}

export function buildRoutexHandoffPayload({ merchant, order = null, returnRequest = null, kind = 'delivery', routeDate = '', note = '' } = {}) {
  if (!merchant?.id) throw new Error('merchant is required for Routex handoff.');
  if (!order?.id && !returnRequest?.id) throw new Error('order or returnRequest is required for Routex handoff.');
  const shippingAddress = order?.shippingAddress || parseJsonSafe(order?.shipping_address_json, {}) || {};
  const customerName = order?.customerName || order?.customer_name || returnRequest?.customerName || returnRequest?.customer_name || '';
  const customerEmail = order?.customerEmail || order?.customer_email || returnRequest?.customerEmail || returnRequest?.customer_email || '';
  return {
    source: 'skyecommerce',
    kind: String(kind || 'delivery'),
    routeDate: String(routeDate || new Date().toISOString().slice(0, 10)),
    merchant: {
      id: merchant.id,
      slug: merchant.slug,
      brandName: merchant.brandName || merchant.brand_name || ''
    },
    order: order ? {
      id: order.id,
      orderNumber: order.orderNumber || order.order_number || '',
      status: order.status || '',
      paymentStatus: order.paymentStatus || order.payment_status || '',
      totalCents: Number(order.totalCents ?? order.total_cents ?? 0),
      currency: order.currency || merchant.currency || 'USD',
      items: order.items || parseJsonSafe(order.items_json, [])
    } : null,
    returnRequest: returnRequest ? {
      id: returnRequest.id,
      status: returnRequest.status || '',
      reason: returnRequest.reason || '',
      resolutionType: returnRequest.resolutionType || returnRequest.resolution_type || '',
      items: returnRequest.items || parseJsonSafe(returnRequest.items_json, [])
    } : null,
    contact: {
      name: customerName,
      email: customerEmail
    },
    stop: {
      label: customerName || order?.orderNumber || order?.order_number || returnRequest?.id || 'Commerce stop',
      address: shippingAddress,
      instructions: note || order?.notes || returnRequest?.merchantNote || returnRequest?.customerNote || ''
    },
    generatedAt: new Date().toISOString()
  };
}

export function routexHandoffRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    merchantId: row.merchant_id,
    orderId: row.order_id || '',
    returnId: row.return_id || '',
    kind: row.kind,
    status: row.status,
    routeDate: row.route_date || '',
    externalRef: row.external_ref || '',
    request: parseJsonSafe(row.request_json, {}),
    response: parseJsonSafe(row.response_json, {}),
    error: row.error || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

export async function executeRoutexHandoff(env, payload = {}) {
  const endpoint = requireHttpsUrl(env.ROUTEX_INGEST_URL || '', 'ROUTEX_INGEST_URL');
  const token = String(env.ROUTEX_INGEST_TOKEN || '').trim();
  if (!token || token.length < 16) throw new Error('ROUTEX_INGEST_TOKEN is required for production Routex handoff.');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${token}`,
      'user-agent': 'SkyeCommerce-RoutexHandoff/1.18.0'
    },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 2000) }; }
  const externalRef = data?.id || data?.routePacketId || data?.jobId || response.headers.get('x-request-id') || '';
  return { status: response.ok ? 'delivered' : 'failed', httpStatus: response.status, externalRef, response: data || {}, ok: response.ok };
}

export function buildProductDetailPath(product = {}) {
  return `/products/${encodeURIComponent(product.slug || slugify(product.title || product.id || 'product'))}`;
}
