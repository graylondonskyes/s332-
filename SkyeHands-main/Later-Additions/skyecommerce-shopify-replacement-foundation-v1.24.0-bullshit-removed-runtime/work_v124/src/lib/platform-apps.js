const encoder = new TextEncoder();

export const DEFAULT_APP_SCOPES = [
  'catalog:read',
  'catalog:write',
  'orders:read',
  'orders:write',
  'customers:read',
  'customers:write',
  'inventory:read',
  'inventory:write',
  'webhooks:write',
  'analytics:read'
];

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

function cleanScope(scope = '') {
  return String(scope || '').trim().toLowerCase().replace(/[^a-z0-9:*_-]/g, '');
}

export function normalizeScopes(scopes = []) {
  const values = asArray(scopes).map(cleanScope).filter(Boolean);
  return [...new Set(values)];
}

export function hasApiScope(grantedScopes = [], requiredScope = '') {
  const scopes = normalizeScopes(grantedScopes);
  const required = cleanScope(requiredScope);
  if (!required) return true;
  if (scopes.includes('*') || scopes.includes(required)) return true;
  const [resource] = required.split(':');
  return scopes.includes(`${resource}:*`);
}

export function normalizeCommerceAppInput(input = {}) {
  const name = String(input.name || input.title || '').trim().slice(0, 120);
  const key = String(input.key || input.slug || name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'private-app';
  return {
    key,
    name,
    developerName: String(input.developerName || input.developer || '').trim().slice(0, 120),
    appUrl: String(input.appUrl || input.url || '').trim().slice(0, 500),
    webhookUrl: String(input.webhookUrl || '').trim().slice(0, 500),
    requestedScopes: normalizeScopes(input.requestedScopes || input.scopes || DEFAULT_APP_SCOPES.slice(0, 3)),
    status: ['active', 'private', 'disabled'].includes(String(input.status || '').toLowerCase()) ? String(input.status).toLowerCase() : 'private',
    pricing: input.pricing && typeof input.pricing === 'object' ? input.pricing : {}
  };
}

export function commerceAppRecord(row = {}) {
  return {
    id: row.id,
    merchantId: row.merchant_id || row.merchantId || '',
    key: row.app_key || row.key || '',
    name: row.name || '',
    developerName: row.developer_name || row.developerName || '',
    appUrl: row.app_url || row.appUrl || '',
    webhookUrl: row.webhook_url || row.webhookUrl || '',
    requestedScopes: safeJson(row.requested_scopes_json || row.requestedScopesJson, []),
    status: row.status || 'private',
    pricing: safeJson(row.pricing_json || row.pricingJson, {}),
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

export function normalizeAppInstallationInput(input = {}, app = null) {
  const requested = normalizeScopes(input.scopes || input.grantedScopes || app?.requestedScopes || []);
  return {
    appId: String(input.appId || input.app_id || app?.id || '').trim(),
    grantedScopes: requested.length ? requested : normalizeScopes(app?.requestedScopes || []),
    status: ['installed', 'paused', 'revoked'].includes(String(input.status || '').toLowerCase()) ? String(input.status).toLowerCase() : 'installed',
    config: input.config && typeof input.config === 'object' ? input.config : {}
  };
}

export function appInstallationRecord(row = {}, app = null) {
  const appRecord = app ? commerceAppRecord(app) : null;
  return {
    id: row.id,
    merchantId: row.merchant_id || row.merchantId || '',
    appId: row.app_id || row.appId || appRecord?.id || '',
    app: appRecord,
    grantedScopes: safeJson(row.granted_scopes_json || row.grantedScopesJson, []),
    status: row.status || 'installed',
    config: safeJson(row.config_json || row.configJson, {}),
    installedAt: row.installed_at || row.installedAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

export function normalizeApiTokenInput(input = {}) {
  return {
    label: String(input.label || input.name || 'Private API token').trim().slice(0, 120),
    scopes: normalizeScopes(input.scopes || DEFAULT_APP_SCOPES.slice(0, 4)),
    expiresAt: input.expiresAt || input.expires_at || null,
    status: ['active', 'revoked'].includes(String(input.status || '').toLowerCase()) ? String(input.status).toLowerCase() : 'active'
  };
}

export function createRawApiToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  const body = btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `skct_${body}`;
}

export async function hashApiToken(secret = '', token = '') {
  const material = `${String(secret || 'dev-secret')}::${String(token || '')}`;
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(material));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function apiTokenRecord(row = {}, includeSensitive = false) {
  const record = {
    id: row.id,
    merchantId: row.merchant_id || row.merchantId || '',
    label: row.label || '',
    secretPreview: row.secret_preview || row.secretPreview || '',
    scopes: safeJson(row.scopes_json || row.scopesJson, []),
    status: row.status || 'active',
    expiresAt: row.expires_at || row.expiresAt || null,
    lastUsedAt: row.last_used_at || row.lastUsedAt || null,
    createdAt: row.created_at || row.createdAt || '',
    revokedAt: row.revoked_at || row.revokedAt || null
  };
  if (includeSensitive && row.rawToken) record.rawToken = row.rawToken;
  return record;
}

function safeJson(value, fallback) {
  if (Array.isArray(value) || (value && typeof value === 'object')) return value;
  try { return JSON.parse(value || ''); } catch { return fallback; }
}
