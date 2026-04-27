const crypto = require('crypto');
const { canonicalize } = require('./export-import');

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64urlJson(value) {
  return base64url(JSON.stringify(value));
}

function decodeBase64url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64').toString('utf8');
}

function stableHex(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(canonicalize(value))).digest('hex');
}

function hashPassphrase(passphrase, salt = crypto.randomBytes(16).toString('hex'), iterations = 120000) {
  if (typeof passphrase !== 'string' || passphrase.length < 12) throw new Error('Passphrase must be at least 12 characters.');
  const digest = crypto.pbkdf2Sync(passphrase, salt, iterations, 32, 'sha256').toString('hex');
  return canonicalize({ algorithm: 'pbkdf2-sha256', salt, iterations, digest });
}

function verifyPassphrase(passphrase, record) {
  if (!record || record.algorithm !== 'pbkdf2-sha256') return false;
  const recomputed = hashPassphrase(passphrase, record.salt, record.iterations);
  return crypto.timingSafeEqual(Buffer.from(recomputed.digest, 'hex'), Buffer.from(record.digest, 'hex'));
}

function issueAccessToken(claims, secret, ttlSeconds = 900, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!secret) throw new Error('Auth secret required.');
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    iss: 'skye-sovereign-author-system',
    aud: 'operator',
    typ: 'access',
    jti: stableHex(`${nowSeconds}:${Math.random()}:${claims.sub || 'operator'}`).slice(0, 24),
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
    ...claims
  };
  const encodedHeader = base64urlJson(header);
  const encodedPayload = base64urlJson(payload);
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', secret).update(unsigned).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `${unsigned}.${signature}`;
}

function verifyAccessToken(token, secret, nowSeconds = Math.floor(Date.now() / 1000), options = {}) {
  const issues = [];
  if (!token || typeof token !== 'string') issues.push('missing-token');
  const parts = token ? token.split('.') : [];
  if (parts.length !== 3) issues.push('shape');
  let payload = null;
  if (!issues.length) {
    const unsigned = `${parts[0]}.${parts[1]}`;
    const expected = crypto.createHmac('sha256', secret).update(unsigned).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts[2]))) issues.push('signature');
    try { payload = JSON.parse(decodeBase64url(parts[1])); } catch { issues.push('payload'); }
    if (payload && payload.iss !== 'skye-sovereign-author-system') issues.push('issuer');
    if (payload && payload.aud !== 'operator') issues.push('audience');
    if (payload && payload.typ !== 'access') issues.push('type');
    if (payload && typeof payload.exp === 'number' && nowSeconds >= payload.exp) issues.push('expired');
    if (payload && Array.isArray(options.revokedJtis) && options.revokedJtis.includes(payload.jti)) issues.push('revoked');
  }
  return canonicalize({ schema: 'skye.server.auth.verification', version: '3.2.0', ok: issues.length === 0, issues, payload });
}

function issueRefreshToken(secret, operator, nowMs = Date.now(), ttlMs = 1000 * 60 * 60 * 24 * 14) {
  const refresh_id = stableHex(`${operator}:${nowMs}:${Math.random()}`).slice(0, 24);
  const token = crypto.randomBytes(32).toString('hex');
  const token_hash = stableHex(`${secret}:${token}`);
  return canonicalize({ token, token_hash, refresh_id, operator, issued_at: nowMs, expires_at: nowMs + ttlMs, revoked: false });
}

function verifyRefreshToken(rawToken, storedRecord, secret, nowMs = Date.now()) {
  const issues = [];
  if (!rawToken || !storedRecord) issues.push('missing-refresh-token');
  if (!issues.length) {
    const expectedHash = stableHex(`${secret}:${rawToken}`);
    if (expectedHash !== storedRecord.token_hash) issues.push('refresh-signature');
    if (storedRecord.revoked === true) issues.push('refresh-revoked');
    if (typeof storedRecord.expires_at === 'number' && nowMs >= storedRecord.expires_at) issues.push('refresh-expired');
  }
  return canonicalize({ schema: 'skye.server.refresh.verification', version: '3.2.0', ok: issues.length === 0, issues, refresh_id: storedRecord ? storedRecord.refresh_id : null, operator: storedRecord ? storedRecord.operator : null });
}

function parseBearerToken(headerValue = '') {
  const match = /^Bearer\s+(.+)$/i.exec(headerValue.trim());
  return match ? match[1] : null;
}

module.exports = { stableHex, hashPassphrase, verifyPassphrase, issueAccessToken, verifyAccessToken, issueRefreshToken, verifyRefreshToken, parseBearerToken };
