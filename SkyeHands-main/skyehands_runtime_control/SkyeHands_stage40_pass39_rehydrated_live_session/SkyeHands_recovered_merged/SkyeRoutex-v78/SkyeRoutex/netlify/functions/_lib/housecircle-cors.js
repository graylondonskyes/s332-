// SEC-02: Origin allowlist CORS helper — replaces wildcard '*' across all phc-* functions.
// Set PHC_ALLOWED_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com in production.
// In development (no PHC_ALLOWED_ORIGINS set) the request origin is echoed back so localhost works.
const ALLOWED_ORIGINS = (process.env.PHC_ALLOWED_ORIGINS || '')
  .split(',').map(o => o.trim()).filter(Boolean);

const IS_PROD = process.env.PHC_ENV === 'production' || process.env.NODE_ENV === 'production';

function resolveOrigin(requestOrigin) {
  const origin = (requestOrigin || '').trim();
  if (ALLOWED_ORIGINS.length > 0) {
    return ALLOWED_ORIGINS.includes(origin) ? origin : null;
  }
  if (IS_PROD) return null;
  // Dev fallback: echo the request origin (or allow any)
  return origin || '*';
}

function corsHeaders(event, methods) {
  const requestOrigin = event && event.headers && (event.headers.origin || event.headers.Origin);
  const allow = resolveOrigin(requestOrigin);
  const base = { 'content-type': 'application/json', 'cache-control': 'no-store' };
  if (!allow) return base;
  return {
    ...base,
    'access-control-allow-origin': allow,
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': methods || 'GET,POST,OPTIONS',
    'vary': 'Origin'
  };
}

module.exports = { corsHeaders };
