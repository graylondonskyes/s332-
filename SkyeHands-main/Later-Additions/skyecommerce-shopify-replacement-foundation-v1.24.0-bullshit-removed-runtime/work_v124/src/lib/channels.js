const CHANNEL_TYPES = new Set(['google_merchant', 'meta_catalog', 'tiktok_catalog']);
const CHANNEL_FORMATS = new Set(['json', 'csv']);
const CHANNEL_JOB_STATUSES = new Set(['queued', 'dispatched', 'executed', 'failed']);

function normalizedText(value = '') {
  return String(value || '').trim();
}

function boolish(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  return value === true || value === 'true' || value === '1' || value === 1;
}

function coerceType(value = '') {
  const normalized = normalizedText(value).toLowerCase();
  return CHANNEL_TYPES.has(normalized) ? normalized : '';
}

function coerceFormat(value = 'json') {
  const normalized = normalizedText(value).toLowerCase();
  return CHANNEL_FORMATS.has(normalized) ? normalized : 'json';
}

function coerceJobStatus(value = 'queued') {
  const normalized = normalizedText(value).toLowerCase();
  return CHANNEL_JOB_STATUSES.has(normalized) ? normalized : 'queued';
}

export function salesChannelRecord(row = {}) {
  return {
    id: row.id || '',
    merchantId: row.merchant_id || row.merchantId || '',
    name: row.name || '',
    type: coerceType(row.type || ''),
    destinationUrl: row.destination_url || row.destinationUrl || '',
    format: coerceFormat(row.format || 'json'),
    config: (() => {
      try {
        return JSON.parse(row.config_json || row.config || '{}');
      } catch {
        return {};
      }
    })(),
    active: Boolean(Number(row.active ?? 1)),
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

export function channelSyncJobRecord(row = {}) {
  return {
    id: row.id || '',
    merchantId: row.merchant_id || row.merchantId || '',
    salesChannelId: row.sales_channel_id || row.salesChannelId || '',
    status: coerceJobStatus(row.status || 'queued'),
    exportPayload: (() => {
      try {
        return JSON.parse(row.export_json || row.exportPayload || '{}');
      } catch {
        return {};
      }
    })(),
    result: (() => {
      try {
        return JSON.parse(row.result_json || row.result || '{}');
      } catch {
        return {};
      }
    })(),
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

export function normalizeSalesChannelInput(body = {}) {
  return {
    name: normalizedText(body.name || ''),
    type: coerceType(body.type || ''),
    destinationUrl: normalizedText(body.destinationUrl || body.destination_url || ''),
    format: coerceFormat(body.format || 'json'),
    config: typeof body.config === 'object' && body.config ? body.config : {},
    active: boolish(body.active, true)
  };
}

function simplifiedProduct(product = {}) {
  return {
    id: product.id || '',
    slug: product.slug || '',
    title: product.title || '',
    descriptionHtml: product.descriptionHtml || '',
    priceCents: Number(product.priceCents || 0),
    currency: product.currency || 'USD',
    sku: product.sku || '',
    inventoryOnHand: Number(product.inventoryOnHand || 0),
    heroImageUrl: product.heroImageUrl || '',
    shortDescription: product.shortDescription || ''
  };
}

export function buildChannelCatalogExport({ merchant = {}, channel = {}, products = [], collections = [], pages = [], navigation = [], snapshot = null } = {}) {
  const normalizedChannel = salesChannelRecord({ ...channel, config: channel.config || channel.config_json || {} });
  const payload = {
    merchant: {
      id: merchant.id || '',
      slug: merchant.slug || '',
      brandName: merchant.brandName || merchant.brand_name || '',
      currency: merchant.currency || 'USD'
    },
    channel: {
      id: normalizedChannel.id,
      name: normalizedChannel.name,
      type: normalizedChannel.type,
      format: normalizedChannel.format,
      destinationUrl: normalizedChannel.destinationUrl
    },
    exportedAt: new Date().toISOString(),
    counts: {
      products: Array.isArray(products) ? products.length : 0,
      collections: Array.isArray(collections) ? collections.length : 0,
      pages: Array.isArray(pages) ? pages.length : 0,
      navigation: Array.isArray(navigation) ? navigation.length : 0
    },
    products: (products || []).map(simplifiedProduct),
    collections: (collections || []).map((item) => ({ id: item.id || '', slug: item.slug || '', title: item.title || '', productIds: item.productIds || [] })),
    pages: (pages || []).map((item) => ({ id: item.id || '', slug: item.slug || '', title: item.title || '', visible: Boolean(item.visible) })),
    navigation: (navigation || []).map((item) => ({ id: item.id || '', label: item.label || '', type: item.type || '', targetRef: item.targetRef || '', href: item.href || '', position: Number(item.position || 0) })),
    snapshotSummary: snapshot ? { productCount: Number(snapshot.productCount || 0), collectionCount: Number(snapshot.collections?.length || 0), pageCount: Number(snapshot.pages?.length || 0) } : null
  };
  if (normalizedChannel.format === 'csv') {
    payload.csv = ['id,slug,title,price_cents,sku,inventory_on_hand', ...payload.products.map((item) => [item.id, item.slug, item.title.replace(/,/g, ' '), item.priceCents, item.sku, item.inventoryOnHand].join(','))].join('\n');
  }
  return payload;
}

export function buildChannelSyncDispatch(channel = {}, exportPayload = {}) {
  const normalizedChannel = salesChannelRecord({ ...channel, config: channel.config || {} });
  const fileStem = `${normalizedChannel.type || 'channel'}-${normalizedChannel.id || 'channel'}-${(exportPayload.merchant?.slug || 'merchant')}`;
  return {
    status: 'dispatched',
    mode: normalizedChannel.format,
    destinationUrl: normalizedChannel.destinationUrl,
    artifactName: normalizedChannel.format === 'csv' ? `${fileStem}.csv` : `${fileStem}.json`,
    counts: exportPayload.counts || {},
    note: `Prepared ${normalizedChannel.format.toUpperCase()} export for ${normalizedChannel.destinationUrl || normalizedChannel.type || 'connected channel'}`
  };
}
