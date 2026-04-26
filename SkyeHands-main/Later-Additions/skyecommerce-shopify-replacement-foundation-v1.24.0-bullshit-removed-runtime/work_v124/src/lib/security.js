import { dbAll, dbFirst, dbRun, hmacHex, json, parseCookie, sha256Hex, signToken, uid, verifyToken } from './utils.js';

export const CSRF_COOKIE = 'skye_csrf';
export const IDEMPOTENCY_HEADER = 'idempotency-key';

export function clientIp(request) {
  return String(
    request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]
    || request.headers.get('x-real-ip')
    || 'unknown'
  ).trim().slice(0, 80) || 'unknown';
}

export function setCsrfCookie(token, maxAge = 60 * 60) {
  return `${CSRF_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearCsrfCookie() {
  return `${CSRF_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function createCsrfToken(env, scope = 'browser') {
  return signToken(env.SESSION_SECRET, {
    sid: uid('csrf'),
    scope,
    kind: 'csrf',
    exp: Date.now() + 1000 * 60 * 60
  });
}

export async function verifyCsrfToken(env, token = '') {
  const payload = await verifyToken(env.SESSION_SECRET, token);
  if (payload.kind !== 'csrf') throw new Error('Invalid CSRF token type');
  return payload;
}

export function isMutatingMethod(method = 'GET') {
  return !['GET', 'HEAD', 'OPTIONS'].includes(String(method || 'GET').toUpperCase());
}

export function isCsrfExemptPath(pathname = '', method = 'GET') {
  if (!isMutatingMethod(method)) return true;
  if (pathname === '/api/merchant/register') return true;
  if (pathname === '/api/auth/login') return true;
  if (pathname === '/api/auth/logout') return true;
  if (pathname === '/api/auth/csrf') return true;
  if (pathname === '/api/ae/login') return true;
  if (pathname === '/api/staff/login' || pathname === '/api/staff/invitations/accept') return true;
  if (pathname === '/api/customers/register' || pathname === '/api/customers/login' || pathname === '/api/customers/logout') return true;
  if (pathname.startsWith('/api/headless/')) return true;
  if (pathname.includes('/webhook')) return true;
  if (pathname === '/api/orders/quote') return true;
  if (pathname === '/api/orders' && method === 'POST') return true;
  return false;
}

export async function enforceCsrf(request, env, url) {
  if (env.CSRF_ENFORCEMENT === 'false') return null;
  if (isCsrfExemptPath(url.pathname, request.method)) return null;
  const cookies = parseCookie(request.headers.get('cookie') || '');
  const hasBrowserSession = Boolean(cookies.skye_session || cookies.skye_customer_session);
  const hasBearer = /^Bearer\s+/i.test(request.headers.get('authorization') || '');
  if (!hasBrowserSession || hasBearer) return null;
  const cookieToken = cookies[CSRF_COOKIE] || '';
  const headerToken = request.headers.get('x-skye-csrf') || '';
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return json({ error: 'CSRF token required.', code: 'csrf_required' }, 403);
  }
  try {
    await verifyCsrfToken(env, headerToken);
    return null;
  } catch {
    return json({ error: 'CSRF token invalid or expired.', code: 'csrf_invalid' }, 403);
  }
}

export function authSubject(kind = 'login', identity = '', ip = '') {
  return `${kind}:${String(identity || '').trim().toLowerCase()}:${String(ip || 'unknown').trim()}`.slice(0, 260);
}

export async function checkAuthLockout(env, subject) {
  const row = await dbFirst(env, `
    SELECT * FROM auth_lockouts
    WHERE subject_hash = ?
      AND active = 1
      AND datetime(locked_until) > datetime('now')
    ORDER BY locked_until DESC
    LIMIT 1
  `, [await sha256Hex(subject)]);
  if (!row) return null;
  return json({ error: 'Too many failed login attempts. Try again later.', code: 'auth_locked', lockedUntil: row.locked_until }, 429);
}

export async function recordAuthAttempt(env, { subject, kind = 'login', identity = '', ip = '', success = false, reason = '' }) {
  const subjectHash = await sha256Hex(subject);
  await dbRun(env, `
    INSERT INTO auth_security_events (id, subject_hash, kind, identity, ip, success, reason)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [uid('asec'), subjectHash, kind, identity.slice(0, 180), ip.slice(0, 80), success ? 1 : 0, String(reason || '').slice(0, 220)]);
  if (success) {
    await dbRun(env, `UPDATE auth_lockouts SET active = 0 WHERE subject_hash = ?`, [subjectHash]);
    return { locked: false, failureCount: 0 };
  }
  const failures = await dbFirst(env, `
    SELECT COUNT(*) AS count
    FROM auth_security_events
    WHERE subject_hash = ?
      AND success = 0
      AND datetime(created_at) >= datetime('now', '-15 minutes')
  `, [subjectHash]);
  const failureCount = Number(failures?.count || 0);
  if (failureCount >= Number(env.AUTH_LOCKOUT_THRESHOLD || 5)) {
    await dbRun(env, `
      INSERT INTO auth_lockouts (id, subject_hash, kind, identity, ip, failure_count, locked_until, active)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+15 minutes'), 1)
    `, [uid('lock'), subjectHash, kind, identity.slice(0, 180), ip.slice(0, 80), failureCount]);
    return { locked: true, failureCount };
  }
  return { locked: false, failureCount };
}

export function normalizeIdempotencyKey(value = '') {
  return String(value || '').trim().replace(/[^a-zA-Z0-9._:-]/g, '').slice(0, 160);
}

export async function idempotencyScopeForRequest(request, env) {
  const cookies = parseCookie(request.headers.get('cookie') || '');
  if (cookies.skye_session) return `session:${await sha256Hex(cookies.skye_session)}`;
  if (cookies.skye_customer_session) return `customer:${await sha256Hex(cookies.skye_customer_session)}`;
  const auth = request.headers.get('authorization') || '';
  if (auth) return `auth:${await sha256Hex(auth)}`;
  return `ip:${clientIp(request)}`;
}

export async function requestBodyHash(request) {
  const body = await request.clone().text().catch(() => '');
  return sha256Hex(body || '');
}

export async function findIdempotencyRecord(env, { scope, key, method, path, bodyHash }) {
  const row = await dbFirst(env, `
    SELECT * FROM idempotency_records
    WHERE scope_hash = ? AND idempotency_key = ? AND method = ? AND path = ?
    LIMIT 1
  `, [await sha256Hex(scope), key, method, path]);
  if (!row) return null;
  if (row.body_hash !== bodyHash) {
    return { conflict: true, response: json({ error: 'Idempotency key reused with a different request body.', code: 'idempotency_conflict' }, 409) };
  }
  return row;
}

export async function storeIdempotencyRecord(env, { scope, key, method, path, bodyHash, response }) {
  const responseText = await response.clone().text();
  const headers = {};
  response.headers.forEach((value, name) => {
    if (!['set-cookie'].includes(name.toLowerCase())) headers[name] = value;
  });
  await dbRun(env, `
    INSERT OR REPLACE INTO idempotency_records
      (scope_hash, idempotency_key, method, path, body_hash, status, response_headers_json, response_body, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `, [await sha256Hex(scope), key, method, path, bodyHash, response.status, JSON.stringify(headers), responseText]);
}

export function responseFromIdempotencyRecord(row) {
  let headers = {};
  try { headers = JSON.parse(row.response_headers_json || '{}'); } catch { headers = {}; }
  headers['x-skye-idempotency-replay'] = 'true';
  return new Response(row.response_body || '', { status: Number(row.status || 200), headers });
}

export function backoffMinutes(attemptCount = 0) {
  const attempt = Math.max(1, Number(attemptCount || 0));
  return Math.min(60, Math.pow(2, Math.min(attempt, 6)));
}

export async function computeWebhookSecretHash(secret = '') {
  const raw = String(secret || '');
  if (!raw) return '';
  return hmacHex('webhook-endpoint-secret', raw);
}
