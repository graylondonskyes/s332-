const CARRIER_PROVIDERS = new Set(['ups']);
const LABEL_STATUSES = new Set(['queued', 'purchased', 'voided']);

function normalizedText(value = '') {
  return String(value || '').trim();
}

function boolish(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  return value === true || value === 'true' || value === '1' || value === 1;
}

function numberish(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function coerceProvider(value = 'ups') {
  const normalized = normalizedText(value).toLowerCase();
  return CARRIER_PROVIDERS.has(normalized) ? normalized : '';
}

function coerceLabelStatus(value = 'queued') {
  const normalized = normalizedText(value).toLowerCase();
  return LABEL_STATUSES.has(normalized) ? normalized : 'queued';
}

function normalizeServices(value) {
  if (Array.isArray(value)) return value.map((entry) => normalizeService(entry)).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((entry) => normalizeService(entry)).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeService(entry = {}) {
  const code = normalizedText(entry.code || entry.service || '').toLowerCase();
  if (!code) return null;
  return {
    code,
    label: normalizedText(entry.label || entry.name || code.toUpperCase()),
    baseCents: Math.max(0, numberish(entry.baseCents, 0)),
    perPoundCents: Math.max(0, numberish(entry.perPoundCents, 0)),
    estimatedDays: Math.max(1, numberish(entry.estimatedDays, 3))
  };
}

export function carrierProfileRecord(row = {}) {
  return {
    id: row.id || '',
    merchantId: row.merchant_id || row.merchantId || '',
    name: row.name || '',
    provider: coerceProvider(row.provider || 'ups'),
    accountLabel: row.account_label || row.accountLabel || '',
    enabled: Boolean(Number(row.enabled ?? 1)),
    services: normalizeServices(row.services_json || row.services || '[]'),
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

export function shippingLabelRecord(row = {}) {
  return {
    id: row.id || '',
    merchantId: row.merchant_id || row.merchantId || '',
    orderId: row.order_id || row.orderId || '',
    fulfillmentId: row.fulfillment_id || row.fulfillmentId || '',
    provider: coerceProvider(row.provider || 'ups'),
    serviceCode: row.service_code || row.serviceCode || '',
    trackingNumber: row.tracking_number || row.trackingNumber || '',
    trackingUrl: row.tracking_url || row.trackingUrl || '',
    labelUrl: row.label_url || row.labelUrl || '',
    rateCents: Number(row.rate_cents ?? row.rateCents ?? 0),
    currency: normalizedText(row.currency || 'USD').toUpperCase(),
    status: coerceLabelStatus(row.status || 'queued'),
    packageSummary: row.package_summary || row.packageSummary || '',
    meta: (() => {
      try {
        return JSON.parse(row.meta_json || row.meta || '{}');
      } catch {
        return {};
      }
    })(),
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

export function normalizeCarrierProfileInput(body = {}) {
  return {
    name: normalizedText(body.name || ''),
    provider: coerceProvider(body.provider || 'ups'),
    accountLabel: normalizedText(body.accountLabel || body.account_label || ''),
    enabled: boolish(body.enabled, true),
    services: normalizeServices(body.services)
  };
}

export function normalizeRateRequest(body = {}, order = {}) {
  const shippingAddress = body.shippingAddress || order.shippingAddress || {};
  const packages = Array.isArray(body.packages) && body.packages.length
    ? body.packages.map((entry, index) => ({
        id: normalizedText(entry.id || `pkg_${index + 1}`),
        weightOz: Math.max(1, numberish(entry.weightOz, 16)),
        lengthIn: Math.max(1, numberish(entry.lengthIn, 8)),
        widthIn: Math.max(1, numberish(entry.widthIn, 6)),
        heightIn: Math.max(1, numberish(entry.heightIn, 4))
      }))
    : [{ id: 'pkg_1', weightOz: Math.max(1, (Array.isArray(order.items) ? order.items.reduce((sum, item) => sum + (Number(item.quantity || 0) * 16), 0) : 16)), lengthIn: 10, widthIn: 8, heightIn: 6 }];
  return {
    shippingAddress: {
      countryCode: normalizedText(shippingAddress.countryCode || 'US').toUpperCase(),
      stateCode: normalizedText(shippingAddress.stateCode || '').toUpperCase(),
      postalCode: normalizedText(shippingAddress.postalCode || '')
    },
    packages
  };
}

export function quoteCarrierRates(profile = {}, request = {}, order = {}) {
  const provider = coerceProvider(profile.provider || 'ups');
  if (provider !== 'ups') return [];
  const services = Array.isArray(profile.services) && profile.services.length ? profile.services : [];
  const totalWeightLb = (request.packages || []).reduce((sum, item) => sum + (Number(item.weightOz || 0) / 16), 0);
  return services.map((service) => {
    const rateCents = Math.round(Number(service.baseCents || 0) + (Math.max(1, totalWeightLb) * Number(service.perPoundCents || 0)));
    return {
      provider,
      profileId: profile.id || '',
      serviceCode: service.code,
      serviceLabel: service.label,
      rateCents,
      currency: normalizedText(order.currency || 'USD').toUpperCase(),
      estimatedDays: Number(service.estimatedDays || 3),
      packageCount: (request.packages || []).length,
      source: 'merchant_profile_rate_table'
    };
  }).sort((a, b) => a.rateCents - b.rateCents);
}

export function normalizeLabelPurchaseInput(body = {}, order = {}) {
  const packages = normalizeRateRequest(body, order).packages;
  return {
    carrierProfileId: normalizedText(body.carrierProfileId || body.profileId || ''),
    providerConnectionId: normalizedText(body.providerConnectionId || body.connectionId || body.provider_connection_id || ''),
    serviceCode: normalizedText(body.serviceCode || body.service_code || '').toLowerCase(),
    fulfillmentId: normalizedText(body.fulfillmentId || body.fulfillment_id || ''),
    packageSummary: `${packages.length} package${packages.length === 1 ? '' : 's'}`,
    packages,
    note: normalizedText(body.note || '')
  };
}

export function purchaseShippingLabel({ profile = {}, order = {}, input = {}, selectedRate = null, providerDispatch = null } = {}) {
  const provider = coerceProvider(profile.provider || 'ups');
  const serviceCode = normalizedText(input.serviceCode || selectedRate?.serviceCode || '').toLowerCase();
  const rateCents = Number(selectedRate?.rateCents || 0);
  const trackingNumber = normalizedText(providerDispatch?.trackingNumber || providerDispatch?.providerReference || '');
  const labelUrl = normalizedText(providerDispatch?.labelUrl || '');
  return {
    provider,
    serviceCode,
    trackingNumber,
    trackingUrl: trackingNumber ? `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}` : '',
    labelUrl,
    rateCents,
    currency: normalizedText(order.currency || selectedRate?.currency || 'USD').toUpperCase(),
    status: trackingNumber && labelUrl ? 'purchased' : 'queued',
    packageSummary: input.packageSummary || `${(input.packages || []).length} packages`,
    meta: {
      packageCount: (input.packages || []).length,
      serviceCode,
      provider,
      providerDispatch: providerDispatch || null
    }
  };
}
