const crypto = require('crypto');
const { clean, compact, nowISO, num, uid } = require('./housecircle-cloud-store');

const SECRET = process.env.PHC_SESSION_SECRET || 'skye-routex-platform-house-circle-v64-dev-secret';

function b64url(value){ return Buffer.from(value).toString('base64url'); }
function sign(value){ return crypto.createHmac('sha256', SECRET).update(value).digest('base64url'); }
function issueSession(input){
  const payload = {
    sid: uid('sess'),
    orgId: clean(input.orgId),
    operatorId: clean(input.operatorId) || 'founder-admin',
    operatorName: compact(input.operatorName) || 'Skyes Over London',
    role: compact(input.role) || 'founder_admin',
    deviceId: clean(input.deviceId) || 'browser-device',
    issuedAt: nowISO(),
    expiresAt: new Date(Date.now() + (num(process.env.PHC_SESSION_TTL_HOURS) || 12) * 60 * 60 * 1000).toISOString()
  };
  const encoded = b64url(JSON.stringify(payload));
  return { token: encoded + '.' + sign(encoded), payload };
}
function verifySessionToken(token){
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
  return { ok:true, payload };
}
function extractBearer(headers){
  const raw = clean(headers && (headers.authorization || headers.Authorization));
  return raw.toLowerCase().startsWith('bearer ') ? raw.slice(7).trim() : '';
}

module.exports = { issueSession, verifySessionToken, extractBearer };
