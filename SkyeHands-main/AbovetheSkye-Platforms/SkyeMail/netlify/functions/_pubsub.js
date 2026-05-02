const jwt = require('jsonwebtoken');
const { requireEnv } = require('./_utils');

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v1/certs';
let certCache = { expiresAt: 0, certs: null };

function getBearerToken(event) {
  const h = event.headers || {};
  const raw = h.authorization || h.Authorization || '';
  const m = String(raw).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : '';
}

async function getGoogleCerts() {
  if (certCache.certs && Date.now() < certCache.expiresAt) return certCache.certs;
  const res = await fetch(GOOGLE_CERTS_URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Failed to fetch Google Pub/Sub certs (${res.status}).`);
  const data = await res.json();
  const cacheControl = String(res.headers.get('cache-control') || '');
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const ttl = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 60 * 60 * 1000;
  certCache = { certs: data || {}, expiresAt: Date.now() + ttl };
  return certCache.certs;
}

async function verifyPubSubPushJwt(event) {
  const authRequired = String(process.env.GMAIL_PUBSUB_REQUIRE_AUTH || 'true').toLowerCase() !== 'false';
  if (!authRequired) return { ok: true, skipped: true, reason: 'auth disabled by env' };

  const token = getBearerToken(event);
  if (!token) {
    const err = new Error('Missing Pub/Sub Authorization Bearer token.');
    err.statusCode = 401;
    throw err;
  }

  const expectedAud = String(
    process.env.GMAIL_PUBSUB_AUDIENCE ||
    `${requireEnv('PUBLIC_BASE_URL').replace(/\/$/, '')}/.netlify/functions/gmail-push-webhook`
  ).trim();

  const decoded = jwt.decode(token, { complete: true }) || {};
  const kid = decoded?.header?.kid;
  if (!kid) {
    const err = new Error('Pub/Sub JWT missing key id.');
    err.statusCode = 401;
    throw err;
  }

  const certs = await getGoogleCerts();
  const cert = certs[kid];
  if (!cert) {
    const err = new Error('Unknown Pub/Sub signing certificate key id.');
    err.statusCode = 401;
    throw err;
  }

  const claims = jwt.verify(token, cert, {
    algorithms: ['RS256'],
    issuer: ['accounts.google.com', 'https://accounts.google.com'],
    audience: expectedAud,
  });

  if (!claims?.email_verified) {
    const err = new Error('Pub/Sub JWT email is not verified.');
    err.statusCode = 401;
    throw err;
  }

  const allowedEmail = String(process.env.GMAIL_PUBSUB_SERVICE_ACCOUNT_EMAIL || '').trim().toLowerCase();
  if (allowedEmail && String(claims.email || '').trim().toLowerCase() !== allowedEmail) {
    const err = new Error('Pub/Sub JWT service account email does not match the configured mailbox push identity.');
    err.statusCode = 401;
    throw err;
  }

  return { ok: true, claims };
}

module.exports = {
  verifyPubSubPushJwt,
};
