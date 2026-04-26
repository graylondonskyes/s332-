function safeJson(value, fallback) {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(value || ''); } catch { return fallback; }
}

function cleanPath(value = '/') {
  let path = String(value || '/').trim();
  if (!path.startsWith('/')) path = `/${path}`;
  return path.replace(/\/+/g, '/').slice(0, 300) || '/';
}

export function normalizeCustomDomainInput(input = {}) {
  const hostname = String(input.hostname || input.domain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .slice(0, 253);
  return {
    hostname,
    mode: ['primary', 'alias'].includes(String(input.mode || '').toLowerCase()) ? String(input.mode).toLowerCase() : 'primary',
    status: ['pending', 'verified', 'failed', 'disabled'].includes(String(input.status || '').toLowerCase()) ? String(input.status).toLowerCase() : 'pending',
    tlsMode: ['auto', 'custom', 'disabled'].includes(String(input.tlsMode || input.tls_mode || '').toLowerCase()) ? String(input.tlsMode || input.tls_mode).toLowerCase() : 'auto'
  };
}

export function buildDomainVerification(hostname = '', token = '', cnameTarget = '') {
  const cleanHost = String(hostname || '').toLowerCase();
  return {
    type: 'TXT',
    name: `_skyecommerce.${cleanHost}`,
    value: `skyecommerce-verification=${token}`,
    cnameTarget: String(cnameTarget || 'commerce.skyesoverlondon.workers.dev').trim()
  };
}

export function customDomainRecord(row = {}) {
  return {
    id: row.id,
    merchantId: row.merchant_id || row.merchantId || '',
    hostname: row.hostname || '',
    mode: row.mode || 'primary',
    status: row.status || 'pending',
    verificationToken: row.verification_token || row.verificationToken || '',
    verificationRecordName: row.verification_record_name || row.verificationRecordName || '',
    verificationRecordValue: row.verification_record_value || row.verificationRecordValue || '',
    tlsMode: row.tls_mode || row.tlsMode || 'auto',
    lastCheckedAt: row.last_checked_at || row.lastCheckedAt || null,
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

export function normalizeRedirectRuleInput(input = {}) {
  return {
    fromPath: cleanPath(input.fromPath || input.from_path || '/old'),
    toPath: cleanPath(input.toPath || input.to_path || '/'),
    statusCode: [301, 302, 307, 308].includes(Number(input.statusCode || input.status_code)) ? Number(input.statusCode || input.status_code) : 301,
    active: input.active === false || input.active === 'false' ? false : true
  };
}

export function redirectRuleRecord(row = {}) {
  return {
    id: row.id,
    merchantId: row.merchant_id || row.merchantId || '',
    fromPath: row.from_path || row.fromPath || '/',
    toPath: row.to_path || row.toPath || '/',
    statusCode: Number(row.status_code || row.statusCode || 301),
    active: Boolean(Number(row.active ?? 1)),
    hitCount: Number(row.hit_count || row.hitCount || 0),
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

export function normalizeSeoEntryInput(input = {}) {
  const resourceType = String(input.resourceType || input.resource_type || 'custom').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'custom';
  return {
    resourceType,
    resourceId: String(input.resourceId || input.resource_id || '').trim().slice(0, 120),
    path: cleanPath(input.path || '/'),
    title: String(input.title || '').trim().slice(0, 160),
    description: String(input.description || '').trim().slice(0, 320),
    imageUrl: String(input.imageUrl || input.image_url || '').trim().slice(0, 500),
    canonicalUrl: String(input.canonicalUrl || input.canonical_url || '').trim().slice(0, 500),
    robots: String(input.robots || 'index,follow').trim().slice(0, 80),
    schema: input.schema && typeof input.schema === 'object' ? input.schema : safeJson(input.schemaJson || input.schema_json, {})
  };
}

export function seoEntryRecord(row = {}) {
  return {
    id: row.id,
    merchantId: row.merchant_id || row.merchantId || '',
    resourceType: row.resource_type || row.resourceType || 'custom',
    resourceId: row.resource_id || row.resourceId || '',
    path: row.path || '/',
    title: row.title || '',
    description: row.description || '',
    imageUrl: row.image_url || row.imageUrl || '',
    canonicalUrl: row.canonical_url || row.canonicalUrl || '',
    robots: row.robots || 'index,follow',
    schema: safeJson(row.schema_json || row.schemaJson, {}),
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

export function buildSitemapEntries({ origin = '', merchant = {}, products = [], pages = [], collections = [], seoEntries = [] } = {}) {
  const base = String(origin || '').replace(/\/+$/, '');
  const slug = merchant.slug || merchant.merchantSlug || '';
  const entries = [];
  const add = (path, priority = '0.7', lastmod = '') => {
    const clean = cleanPath(path);
    if (!entries.some((entry) => entry.path === clean)) entries.push({ path: clean, loc: `${base}${clean}`, priority, lastmod: lastmod || new Date().toISOString().slice(0, 10) });
  };
  add(slug ? `/s/${slug}` : '/', '1.0', merchant.updatedAt || merchant.createdAt || '');
  for (const product of products || []) add(slug ? `/s/${slug}/products/${product.slug || product.id}` : `/products/${product.slug || product.id}`, '0.8', product.updatedAt || product.createdAt || '');
  for (const collection of collections || []) add(slug ? `/s/${slug}/collections/${collection.slug || collection.id}` : `/collections/${collection.slug || collection.id}`, '0.7', collection.updatedAt || collection.createdAt || '');
  for (const page of pages || []) add(slug ? `/s/${slug}/pages/${page.slug || page.id}` : `/pages/${page.slug || page.id}`, '0.6', page.updatedAt || page.createdAt || '');
  for (const seo of seoEntries || []) add(seo.path, seo.resourceType === 'home' ? '1.0' : '0.6', seo.updatedAt || seo.createdAt || '');
  return entries;
}

export function renderSitemapXml(entries = []) {
  const body = entries.map((entry) => `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>\n    <priority>${escapeXml(entry.priority)}</priority>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
}

function escapeXml(value = '') {
  return String(value || '').replace(/[<>&'"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' }[char]));
}
