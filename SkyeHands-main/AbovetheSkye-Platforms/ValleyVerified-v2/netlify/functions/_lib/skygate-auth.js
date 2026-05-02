'use strict';

const crypto = require('node:crypto');

function clean(value) { return String(value == null ? '' : value).trim(); }
function json(statusCode, body) {
  return { statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) };
}
function parsePart(part) {
  return JSON.parse(Buffer.from(clean(part), 'base64url').toString('utf8'));
}
function publicKeyFor(header) {
  const pem = clean(process.env.SKYGATE_PUBLIC_KEY_PEM || process.env.SKYGATEFS13_PUBLIC_KEY_PEM);
  if (pem) return pem.replace(/\\n/g, '\n');
  const raw = clean(process.env.SKYGATE_JWKS_JSON || process.env.SKYGATEFS13_JWKS_JSON);
  if (!raw) return null;
  const jwks = JSON.parse(raw);
  const keys = Array.isArray(jwks.keys) ? jwks.keys : [];
  const jwk = keys.find((key) => clean(key.kid) === clean(header.kid)) || (keys.length === 1 ? keys[0] : null);
  return jwk ? crypto.createPublicKey({ key: jwk, format: 'jwk' }) : null;
}
function bearer(event) {
  const raw = clean(event && event.headers && (event.headers.authorization || event.headers.Authorization));
  return raw.toLowerCase().startsWith('bearer ') ? raw.slice(7).trim() : '';
}
function localOperatorSecret() {
  return clean(process.env.VALLEYVERIFIED_LOCAL_SESSION_SECRET);
}
function signLocalOperatorToken(payload) {
  const secret = localOperatorSecret();
  if (!secret) throw new Error('VALLEYVERIFIED_LOCAL_SESSION_SECRET is not configured.');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `localop.${body}.${sig}`;
}
function verifyLocalOperatorToken(token) {
  if (!token || !token.startsWith('localop.')) return null;
  const secret = localOperatorSecret();
  if (!secret) return { ok: false, statusCode: 503, error: 'Local operator session secret is not configured.' };
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, statusCode: 401, error: 'Malformed local operator token.' };
  const body = parts[1];
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  if (parts[2] !== expected) return { ok: false, statusCode: 401, error: 'Local operator token signature invalid.' };
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, statusCode: 401, error: 'Local operator token decode failed.' };
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > Number(payload.exp)) return { ok: false, statusCode: 401, error: 'Local operator token expired.' };
  return { ok: true, claims: payload, local: true };
}
function verifySkyGateBearer(event, options = {}) {
  const token = bearer(event);
  if (!token) return { ok: false, statusCode: 401, error: 'Missing SkyGate bearer token.' };
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, statusCode: 401, error: 'Malformed SkyGate bearer token.' };
  let header;
  let payload;
  try {
    header = parsePart(parts[0]);
    payload = parsePart(parts[1]);
  } catch {
    return { ok: false, statusCode: 401, error: 'SkyGate token decode failed.' };
  }
  if (header.alg !== 'RS256') return { ok: false, statusCode: 401, error: 'SkyGate token must use RS256.' };
  let key;
  try {
    key = publicKeyFor(header);
  } catch {
    return { ok: false, statusCode: 503, error: 'SkyGate JWKS is invalid.' };
  }
  if (!key) return { ok: false, statusCode: 503, error: 'SkyGate public key/JWKS is not configured.' };
  const valid = crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), key, Buffer.from(parts[2], 'base64url'));
  if (!valid) return { ok: false, statusCode: 401, error: 'SkyGate token signature invalid.' };
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > Number(payload.exp)) return { ok: false, statusCode: 401, error: 'SkyGate token expired.' };
  const audience = clean(options.audience || process.env.SKYGATE_EXPECTED_AUDIENCE || 'skygatefs13');
  const audiences = Array.isArray(payload.aud) ? payload.aud.map(clean) : [clean(payload.aud)].filter(Boolean);
  if (audience && !audiences.includes(audience)) return { ok: false, statusCode: 401, error: 'SkyGate token audience mismatch.' };
  return { ok: true, claims: payload };
}
function verifyOperatorBearer(event, options = {}) {
  const token = bearer(event);
  const local = verifyLocalOperatorToken(token);
  if (local) return local;
  return verifySkyGateBearer(event, options);
}
function requireSkyGate(event, options) {
  const guard = verifySkyGateBearer(event, options);
  return guard.ok ? null : json(guard.statusCode || 401, { ok: false, error: guard.error || 'Unauthorized.' });
}
function requireOperator(event, options) {
  const guard = verifyOperatorBearer(event, options);
  return guard.ok ? null : json(guard.statusCode || 401, { ok: false, error: guard.error || 'Unauthorized.' });
}
function issueTestSkyGateToken(payload, privateKey, kid = 'valleyverified-smoke-key') {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid };
  const claims = { iss: 'https://skygatefs13.local', aud: 'skygatefs13', iat: now, exp: now + 3600, ...payload };
  const input = Buffer.from(JSON.stringify(header)).toString('base64url') + '.' + Buffer.from(JSON.stringify(claims)).toString('base64url');
  return input + '.' + crypto.sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url');
}
function issueLocalOperatorToken(payload = {}) {
  const now = Math.floor(Date.now() / 1000);
  return signLocalOperatorToken({
    iss: 'valleyverified-v2/local-operator',
    aud: 'valleyverified-v2',
    role: 'operator',
    iat: now,
    exp: now + 3600,
    ...payload,
  });
}

module.exports = { requireSkyGate, verifySkyGateBearer, verifyOperatorBearer, requireOperator, issueTestSkyGateToken, issueLocalOperatorToken };
