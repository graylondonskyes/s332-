function normalizedText(value = '') {
  return String(value || '').trim();
}

function normalizedEmail(value = '') {
  return normalizedText(value).toLowerCase();
}

function parseAddress(value = {}) {
  if (!value || typeof value !== 'object') return {};
  return {
    countryCode: normalizedText(value.countryCode || value.country_code || '').toUpperCase(),
    stateCode: normalizedText(value.stateCode || value.state_code || '').toUpperCase(),
    address1: normalizedText(value.address1 || ''),
    address2: normalizedText(value.address2 || ''),
    city: normalizedText(value.city || ''),
    postalCode: normalizedText(value.postalCode || value.postal_code || '')
  };
}

export function customerRecord(row) {
  if (!row) return null;
  const addressRaw = row.default_address_json || row.defaultAddressJson || '{}';
  let address = {};
  try { address = parseAddress(JSON.parse(addressRaw)); } catch { address = {}; }
  return {
    id: row.id,
    merchantId: row.merchant_id || row.merchantId || '',
    merchantSlug: row.merchant_slug || row.merchantSlug || '',
    email: normalizedEmail(row.email || ''),
    firstName: normalizedText(row.first_name || row.firstName || ''),
    lastName: normalizedText(row.last_name || row.lastName || ''),
    phone: normalizedText(row.phone || ''),
    marketingOptIn: Boolean(Number(row.marketing_opt_in ?? row.marketingOptIn ?? 0)),
    defaultAddress: address,
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

export function buildCustomerDisplayName(customer = {}) {
  const first = normalizedText(customer.firstName || customer.first_name || '');
  const last = normalizedText(customer.lastName || customer.last_name || '');
  const joined = [first, last].filter(Boolean).join(' ').trim();
  return joined || normalizedText(customer.email || '');
}

export function normalizeCustomerRegistrationInput(body = {}) {
  return {
    slug: normalizedText(body.slug || ''),
    email: normalizedEmail(body.email || ''),
    password: String(body.password || ''),
    firstName: normalizedText(body.firstName || ''),
    lastName: normalizedText(body.lastName || ''),
    phone: normalizedText(body.phone || ''),
    marketingOptIn: body.marketingOptIn === true || body.marketingOptIn === 'true' || body.marketingOptIn === '1' || body.marketingOptIn === 1,
    defaultAddress: parseAddress(body.defaultAddress || body.location || {})
  };
}

export function normalizeCustomerProfileInput(body = {}) {
  return {
    firstName: normalizedText(body.firstName || ''),
    lastName: normalizedText(body.lastName || ''),
    phone: normalizedText(body.phone || ''),
    marketingOptIn: body.marketingOptIn === true || body.marketingOptIn === 'true' || body.marketingOptIn === '1' || body.marketingOptIn === 1,
    defaultAddress: parseAddress(body.defaultAddress || body.location || body)
  };
}

export function normalizeSavedCartInput(body = {}) {
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const items = rawItems
    .map((item) => ({
      productId: normalizedText(item.productId || item.id || ''),
      quantity: Math.max(1, Number(item.quantity || 1) || 1)
    }))
    .filter((item) => item.productId);
  return {
    note: normalizedText(body.note || ''),
    items,
    location: parseAddress(body.location || {}),
    shippingCode: normalizedText(body.shippingCode || ''),
    discountCode: normalizedText(body.discountCode || '').toUpperCase()
  };
}
