const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const runtimeRoot = path.resolve(__dirname, '..', '..', '.ae-runtime');
const sessionFile = path.join(runtimeRoot, 'sessions.json');

function ensureSessionStore() {
  fs.mkdirSync(runtimeRoot, { recursive: true });
  if (!fs.existsSync(sessionFile)) {
    fs.writeFileSync(sessionFile, `${JSON.stringify({ sessions: [] }, null, 2)}\n`, 'utf8');
  }
}

function loadSessions() {
  ensureSessionStore();
  try {
    return JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
  } catch {
    return { sessions: [] };
  }
}

function saveSessions(payload) {
  ensureSessionStore();
  fs.writeFileSync(sessionFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function timingSafeEqual(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function getAuthSecret() {
  return String(process.env.AE_AUTH_SECRET || process.env.OH_SECRET_KEY || 'ae-local-secret-change-me');
}

function toBase64url(input) {
  return Buffer.from(input).toString('base64url');
}

function fromBase64url(input) {
  return Buffer.from(String(input || ''), 'base64url').toString('utf8');
}

function signPayload(payload, secret = getAuthSecret()) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function mintSession(payload, secret = getAuthSecret()) {
  const body = JSON.stringify(payload || {});
  const encoded = toBase64url(body);
  const signature = signPayload(encoded, secret);
  return `${encoded}.${signature}`;
}

function verifySession(token, secret = getAuthSecret()) {
  const rawToken = String(token || '');
  const [encoded, signature] = rawToken.split('.');
  if (!encoded || !signature) return null;
  const expected = signPayload(encoded, secret);
  if (!timingSafeEqual(signature, expected)) return null;
  try {
    return JSON.parse(fromBase64url(encoded));
  } catch {
    return null;
  }
}

function requireRole(user, role) {
  return Boolean(user && (user.role === role || user.role === 'founder'));
}

function createSession({ userId, role, email, tenantId = 'default', ttlHours = 12 }) {
  const store = loadSessions();
  const sessionId = crypto.randomUUID();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + ttlHours * 60 * 60 * 1000);
  const payload = { sessionId, userId, role, email, tenantId, issuedAt: issuedAt.toISOString(), expiresAt: expiresAt.toISOString() };
  const token = mintSession(payload);
  store.sessions.push({ ...payload, revokedAt: null, tokenHash: signPayload(token) });
  saveSessions(store);
  return { token, payload };
}

function findActiveSessionFromToken(token) {
  const payload = verifySession(token);
  if (!payload) return null;
  const store = loadSessions();
  const tokenHash = signPayload(token);
  const row = store.sessions.find((item) => item.sessionId === payload.sessionId && item.tokenHash === tokenHash);
  if (!row || row.revokedAt) return null;
  if (new Date(row.expiresAt).getTime() <= Date.now()) return null;
  return row;
}

function revokeSession(token) {
  const store = loadSessions();
  const tokenHash = signPayload(token);
  let revoked = false;
  store.sessions = store.sessions.map((item) => {
    if (item.tokenHash !== tokenHash || item.revokedAt) return item;
    revoked = true;
    return { ...item, revokedAt: new Date().toISOString() };
  });
  saveSessions(store);
  return revoked;
}

function getSessionFromRequest(event = {}) {
  const header = event.headers || {};
  const authHeader = header.authorization || header.Authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;
  const row = findActiveSessionFromToken(token);
  if (!row) return null;
  return {
    token,
    user: {
      id: row.userId,
      role: row.role,
      email: row.email,
      tenantId: row.tenantId
    },
    sessionId: row.sessionId,
    expiresAt: row.expiresAt
  };
}

module.exports = {
  mintSession,
  verifySession,
  requireRole,
  createSession,
  revokeSession,
  getSessionFromRequest,
  findActiveSessionFromToken
};
