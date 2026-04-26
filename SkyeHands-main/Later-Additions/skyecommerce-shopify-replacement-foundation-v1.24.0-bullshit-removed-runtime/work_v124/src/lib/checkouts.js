export function normalizeCheckoutInput(input = {}) {
  const items = Array.isArray(input.items) ? input.items : [];
  return {
    slug: String(input.slug || '').trim().toLowerCase(),
    customerId: String(input.customerId || input.customer_id || '').trim(),
    customerEmail: String(input.customerEmail || input.customer_email || '').trim().toLowerCase(),
    customerName: String(input.customerName || input.customer_name || '').trim(),
    source: String(input.source || 'storefront').trim().slice(0, 60),
    status: ['open', 'converted', 'abandoned', 'recovered', 'expired'].includes(String(input.status || '').toLowerCase()) ? String(input.status).toLowerCase() : 'open',
    items: items.map((item) => ({
      productId: String(item.productId || item.product_id || '').trim(),
      variantId: String(item.variantId || item.variant_id || '').trim(),
      quantity: Math.max(1, Number(item.quantity || 1) || 1),
      title: String(item.title || '').trim(),
      sku: String(item.sku || '').trim(),
      unitPriceCents: Math.max(0, Number(item.unitPriceCents || item.unit_price_cents || 0) || 0)
    })).filter((item) => item.productId),
    shippingAddress: input.shippingAddress || input.shipping_address || {},
    shippingCode: String(input.shippingCode || input.shipping_code || '').trim(),
    discountCode: String(input.discountCode || input.discount_code || '').trim().toUpperCase(),
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {}
  };
}

export function checkoutSessionRecord(row = {}) {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    customerId: row.customer_id || '',
    customerEmail: row.customer_email || '',
    customerName: row.customer_name || '',
    source: row.source || 'storefront',
    status: row.status || 'open',
    subtotalCents: Number(row.subtotal_cents || 0),
    discountCents: Number(row.discount_cents || 0),
    shippingCents: Number(row.shipping_cents || 0),
    taxCents: Number(row.tax_cents || 0),
    totalCents: Number(row.total_cents || 0),
    recoveryCount: Number(row.recovery_count || 0),
    items: safeJson(row.items_json, []),
    shippingAddress: safeJson(row.shipping_address_json, {}),
    quote: safeJson(row.quote_json, {}),
    metadata: safeJson(row.meta_json, {}),
    lastRecoveredAt: row.last_recovered_at || '',
    convertedOrderId: row.converted_order_id || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function safeJson(raw, fallback) {
  try { return JSON.parse(raw || JSON.stringify(fallback)); } catch { return fallback; }
}

export function classifyCheckout(session = {}, nowMs = Date.now(), abandonAfterMinutes = 60) {
  if (!['open', 'abandoned'].includes(session.status)) return session.status || 'open';
  const updated = Date.parse(session.updatedAt || session.updated_at || session.createdAt || session.created_at || '') || nowMs;
  const ageMinutes = (nowMs - updated) / 60000;
  return ageMinutes >= abandonAfterMinutes ? 'abandoned' : 'open';
}

export function buildCheckoutRecoveryNotification({ merchant = {}, checkout = {}, storefrontUrl = '' } = {}) {
  const subject = `${merchant.brandName || 'Your store'} checkout reminder`;
  const amount = ((Number(checkout.totalCents || 0) || 0) / 100).toFixed(2);
  return {
    channel: 'email',
    templateKey: 'checkout_recovery',
    recipient: checkout.customerEmail || '',
    subject,
    bodyText: `Your cart at ${merchant.brandName || 'our store'} is still saved. Total: ${checkout.currency || merchant.currency || 'USD'} ${amount}. Complete checkout: ${storefrontUrl}`,
    meta: { checkoutId: checkout.id, checkoutStatus: checkout.status, storefrontUrl }
  };
}
