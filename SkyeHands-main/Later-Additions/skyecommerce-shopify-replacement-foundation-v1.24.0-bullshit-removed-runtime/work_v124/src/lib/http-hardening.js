import { dbFirst, dbRun, json, parseCookie, sha256Hex } from './utils.js';
import { clientIp, isMutatingMethod } from './security.js';

const encoder = new TextEncoder();

export function maxApiBodyBytes(env = {}) {
  const configured = Number(env.MAX_API_BODY_BYTES || env.API_MAX_BODY_BYTES || 1024 * 1024);
  return Number.isFinite(configured) && configured > 0 ? Math.min(configured, 10 * 1024 * 1024) : 1024 * 1024;
}

export async function enforceApiBodyLimit(request, env = {}) {
  if (!isMutatingMethod(request.method)) return null;
  const limit = maxApiBodyBytes(env);
  const length = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(length) && length > limit) {
    return json({ error: 'Request body too large.', code: 'request_body_too_large', limitBytes: limit }, 413);
  }
  const contentType = String(request.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('application/json') && !length) {
    const body = await request.clone().text().catch(() => '');
    if (encoder.encode(body).byteLength > limit) {
      return json({ error: 'Request body too large.', code: 'request_body_too_large', limitBytes: limit }, 413);
    }
  }
  return null;
}

export function parseAllowedOrigins(value = '') {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function resolveCorsOrigin(request, env = {}) {
  const origin = request.headers.get('origin') || '';
  if (!origin) return '';
  if (env.CORS_ALLOW_ALL === 'true') return origin;
  const url = new URL(request.url);
  if (origin === url.origin) return origin;
  const allowed = parseAllowedOrigins(env.ALLOWED_ORIGINS || env.CORS_ALLOWED_ORIGINS || '');
  return allowed.includes(origin) ? origin : '';
}

export function applySecurityHeaders(response) {
  response.headers.set('x-content-type-options', 'nosniff');
  response.headers.set('referrer-policy', 'no-referrer');
  response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  response.headers.set('cross-origin-opener-policy', 'same-origin');
  response.headers.set('x-frame-options', 'DENY');
  response.headers.append('vary', 'Origin');
  return response;
}

export function applyApiResponseHeaders(response, request, env = {}) {
  applySecurityHeaders(response);
  const origin = resolveCorsOrigin(request, env);
  if (origin) {
    response.headers.set('access-control-allow-origin', origin);
    response.headers.set('access-control-allow-credentials', 'true');
  }
  return response;
}

export function optionsResponse(request, env = {}) {
  const origin = request.headers.get('origin') || '';
  const allowedOrigin = resolveCorsOrigin(request, env);
  if (origin && !allowedOrigin) {
    return applySecurityHeaders(json({ error: 'CORS origin not allowed.', code: 'cors_origin_denied' }, 403));
  }
  const response = new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization,x-skye-csrf,idempotency-key',
      'access-control-max-age': '600'
    }
  });
  if (allowedOrigin) {
    response.headers.set('access-control-allow-origin', allowedOrigin);
    response.headers.set('access-control-allow-credentials', 'true');
  }
  return applySecurityHeaders(response);
}

function normalizedPath(pathname = '') {
  return String(pathname || '/').replace(/\/[a-z]{2,8}_[a-zA-Z0-9_-]{6,}/g, '/:id').replace(/\/[0-9a-f]{12,}/gi, '/:id');
}

function rateLimitPolicy(request, url, env = {}) {
  if (env.API_RATE_LIMIT_DISABLED === 'true') return null;
  const path = url.pathname;
  if (!path.startsWith('/api/')) return null;
  const method = String(request.method || 'GET').toUpperCase();
  if (method === 'OPTIONS') return null;
  if (path.includes('/webhook')) return null;
  if (!isMutatingMethod(method) && !path.startsWith('/api/headless/')) return null;
  if (path.includes('/login')) return { name: 'login', limit: Number(env.AUTH_ROUTE_RATE_LIMIT_PER_MINUTE || 20), windowSeconds: 60 };
  if (path.startsWith('/api/headless/')) return { name: 'headless', limit: Number(env.HEADLESS_RATE_LIMIT_PER_MINUTE || 600), windowSeconds: 60 };
  if (path === '/api/orders' || path.startsWith('/api/customers/')) return { name: 'public_storefront_write', limit: Number(env.PUBLIC_STORE_RATE_LIMIT_PER_MINUTE || 80), windowSeconds: 60 };
  return { name: 'api_mutation', limit: Number(env.API_MUTATION_RATE_LIMIT_PER_MINUTE || 240), windowSeconds: 60 };
}

async function rateLimitIdentity(request) {
  const cookies = parseCookie(request.headers.get('cookie') || '');
  const auth = request.headers.get('authorization') || '';
  if (auth) return `auth:${await sha256Hex(auth)}`;
  if (cookies.skye_session) return `session:${await sha256Hex(cookies.skye_session)}`;
  if (cookies.skye_customer_session) return `customer:${await sha256Hex(cookies.skye_customer_session)}`;
  return `ip:${clientIp(request)}`;
}

export async function enforceApiRateLimit(request, env = {}, url = new URL(request.url)) {
  const policy = rateLimitPolicy(request, url, env);
  if (!policy || !Number.isFinite(policy.limit) || policy.limit <= 0) return null;
  const windowMs = Math.max(1, Number(policy.windowSeconds || 60)) * 1000;
  const windowStartMs = Math.floor(Date.now() / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs).toISOString();
  const bucketMaterial = `${policy.name}:${await rateLimitIdentity(request)}:${request.method}:${normalizedPath(url.pathname)}:${windowStart}`;
  const bucketKey = await sha256Hex(bucketMaterial);
  try {
    const row = await dbFirst(env, `SELECT * FROM api_rate_limits WHERE bucket_key = ? LIMIT 1`, [bucketKey]);
    const nextCount = Number(row?.request_count || 0) + 1;
    if (nextCount > policy.limit) {
      const blocked = json({ error: 'Rate limit exceeded.', code: 'rate_limited', bucket: policy.name, limit: policy.limit, windowSeconds: policy.windowSeconds }, 429, { 'retry-after': String(policy.windowSeconds || 60) });
      blocked.headers.set('x-skye-rate-limit-limit', String(policy.limit));
      blocked.headers.set('x-skye-rate-limit-remaining', '0');
      return blocked;
    }
    if (row) {
      await dbRun(env, `UPDATE api_rate_limits SET request_count = ?, updated_at = CURRENT_TIMESTAMP WHERE bucket_key = ?`, [nextCount, bucketKey]);
    } else {
      await dbRun(env, `INSERT INTO api_rate_limits (bucket_key, bucket_name, identity_hash, method, path, window_start, window_seconds, request_count, limit_count, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+1 day'))`, [bucketKey, policy.name, await sha256Hex(await rateLimitIdentity(request)), request.method, normalizedPath(url.pathname), windowStart, policy.windowSeconds, 1, policy.limit]);
    }
    return null;
  } catch (error) {
    if (env.RATE_LIMIT_FAIL_CLOSED === 'true') return json({ error: 'Rate limiter unavailable.', code: 'rate_limiter_unavailable' }, 503);
    return null;
  }
}

export function runtimeSecurityReadiness(env = {}) {
  return {
    csrfEnforced: env.CSRF_ENFORCEMENT !== 'false',
    corsAllowAll: env.CORS_ALLOW_ALL === 'true',
    allowedOriginsConfigured: parseAllowedOrigins(env.ALLOWED_ORIGINS || env.CORS_ALLOWED_ORIGINS || '').length,
    apiRateLimitEnabled: env.API_RATE_LIMIT_DISABLED !== 'true',
    rateLimitFailClosed: env.RATE_LIMIT_FAIL_CLOSED === 'true',
    maxApiBodyBytes: maxApiBodyBytes(env)
  };
}
