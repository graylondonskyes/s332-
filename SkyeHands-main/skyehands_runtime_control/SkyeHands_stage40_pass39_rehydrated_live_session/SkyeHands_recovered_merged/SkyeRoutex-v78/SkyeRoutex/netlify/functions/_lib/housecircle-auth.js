const crypto = require('crypto');
const { clean, compact, nowISO, num, uid } = require('./housecircle-cloud-store');

// SEC-01: Fail fast if session secret is not configured in production.
if (!process.env.PHC_SESSION_SECRET) {
  const isProd = process.env.PHC_ENV === 'production' || process.env.NODE_ENV === 'production';
  if (isProd) {
    throw new Error('PHC_SESSION_SECRET environment variable is required in production. Set a strong 256-bit random key.');
  }
  // Dev: use fallback with a loud warning so it is never silently deployed
  console.warn('[housecircle-auth] WARNING: PHC_SESSION_SECRET not set. Using insecure dev default. This MUST be set before deploying to production.');
}

const SECRET = process.env.PHC_SESSION_SECRET || 'skye-routex-platform-house-circle-v64-dev-secret';

// SEC-07: Maximum field lengths to prevent DoS via oversized inputs.
const MAX_ID_LEN = 128;
const MAX_NAME_LEN = 256;

function enforceLength(value, max) {
  const s = clean(value);
  return s.length > max ? s.slice(0, max) : s;
}

function b64url(value){ return Buffer.from(value).toString('base64url'); }
function sign(value){ return crypto.createHmac('sha256', SECRET).update(value).digest('base64url'); }
function issueSession(input){
  if (!input || !clean(input.orgId)) throw new Error('issueSession requires orgId.');
  const payload = {
    sid: uid('sess'),
    orgId: enforceLength(input.orgId, MAX_ID_LEN),
    operatorId: enforceLength(input.operatorId, MAX_ID_LEN) || 'founder-admin',
    operatorName: enforceLength(input.operatorName, MAX_NAME_LEN) || 'Operator',
    role: enforceLength(input.role, MAX_ID_LEN) || 'operator',
    deviceId: enforceLength(input.deviceId, MAX_NAME_LEN) || 'browser-device',
    issuedAt: nowISO(),
    expiresAt: new Date(Date.now() + (num(process.env.PHC_SESSION_TTL_HOURS) || 12) * 60 * 60 * 1000).toISOString()
  };
  const encoded = b64url(JSON.stringify(payload));
  return { token: encoded + '.' + sign(encoded), payload };
}
function verifySessionToken(token, revokedSessions){
  const raw = clean(token);
  if(!raw || raw.indexOf('.') < 0) return { ok:false, error:'Missing or malformed token.' };
  const parts = raw.split('.');
  if(parts.length !== 2) return { ok:false, error:'Malformed token.' };
  const [encoded, sig] = parts;
  if(sign(encoded) !== sig) return { ok:false, error:'Bad token signature.' };
  let payload;
  try{ payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); }
  catch(_){ return { ok:false, error:'Token decode failed.' }; }
  if(Date.parse(payload.expiresAt || 0) <= Date.now()) return { ok:false, error:'Token expired.', payload };
  // SEC-06: check revocation list if provided
  if(revokedSessions && Array.isArray(revokedSessions) && revokedSessions.includes(payload.sid)){
    return { ok:false, error:'Token has been revoked.', payload };
  }
  return { ok:true, payload };
}
function extractBearer(headers){
  const raw = clean(headers && (headers.authorization || headers.Authorization));
  return raw.toLowerCase().startsWith('bearer ') ? raw.slice(7).trim() : '';
}

module.exports = { issueSession, verifySessionToken, extractBearer };
