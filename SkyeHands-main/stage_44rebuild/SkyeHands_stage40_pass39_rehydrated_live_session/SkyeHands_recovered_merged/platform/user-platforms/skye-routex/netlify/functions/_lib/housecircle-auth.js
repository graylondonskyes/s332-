const crypto = require('crypto');
const { readOrgState, saveOrgState, clean, compact, nowISO, num, uid, pushEvent } = require('./housecircle-cloud-store');

function b64url(value){ return Buffer.from(value).toString('base64url'); }
function isProductionMode(){ return ['1','true','yes','production'].includes(clean(process.env.PHC_PRODUCTION || process.env.NODE_ENV || '').toLowerCase()); }
function getSessionSecret(){
  const secret = clean(process.env.PHC_SESSION_SECRET || process.env.SKYEROUTEX_SESSION_SECRET || '');
  if(secret && isProductionMode() && secret.length < 32) throw new Error('PHC_SESSION_SECRET must be at least 32 characters in production.');
  return secret;
}
function authFailure(message, code){ return { ok:false, statusCode:code || 401, error: message || 'Unauthorized.' }; }
function timingSafeEqualString(a,b){
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if(aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}
function signWithSecret(value, secret){ return crypto.createHmac('sha256', secret).update(value).digest('base64url'); }
function sign(value){
  const secret = getSessionSecret();
  if(!secret) throw new Error('PHC_SESSION_SECRET is required. No bundled signing fallback is allowed.');
  return signWithSecret(value, secret);
}
function rolePermissions(role){
  const r = clean(role || 'viewer').toLowerCase();
  const base = ['view:org','view:app','read:sync','read:valuation','read:walkthrough'];
  if(r === 'founder_admin' || r === 'admin') return base.concat(['manage:org','manage:app','manage:app_fabric','write:sync','write:jobs','write:valuation','write:walkthrough','write:pos','write:neon','manage:auth']);
  if(r === 'operator') return base.concat(['write:sync','write:jobs','write:pos']);
  return base;
}
function issueSession(input){
  const secret = getSessionSecret();
  if(!secret) throw new Error('PHC_SESSION_SECRET is required. Refusing to issue unsigned/insecure session.');
  const ttlHours = Math.max(1, Math.min(24, num(process.env.PHC_SESSION_TTL_HOURS) || 12));
  const role = compact(input.role) || 'operator';
  const payload = {
    sid: uid('sess'),
    orgId: clean(input.orgId),
    operatorId: clean(input.operatorId) || 'founder-admin',
    operatorName: compact(input.operatorName) || 'Skyes Over London',
    role,
    permissions: rolePermissions(role),
    deviceId: clean(input.deviceId) || 'browser-device',
    issuedAt: nowISO(),
    expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString()
  };
  const encoded = b64url(JSON.stringify(payload));
  return { token: encoded + '.' + signWithSecret(encoded, secret), payload };
}
function verifySessionToken(token){
  const secret = getSessionSecret();
  if(!secret) return authFailure('PHC_SESSION_SECRET is not configured; route is locked.', 503);
  const raw = clean(token);
  if(!raw || raw.indexOf('.') < 0) return authFailure('Missing or malformed bearer token.', 401);
  const parts = raw.split('.');
  if(parts.length !== 2) return authFailure('Malformed bearer token.', 401);
  const [encoded, sig] = parts;
  const expected = signWithSecret(encoded, secret);
  if(!timingSafeEqualString(expected, sig)) return authFailure('Bad token signature.', 401);
  let payload;
  try{ payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); }
  catch(_){ return authFailure('Token decode failed.', 401); }
  if(Date.parse(payload.expiresAt || 0) <= Date.now()) return { ok:false, statusCode:401, error:'Token expired.', payload };
  return { ok:true, payload };
}
function extractBearer(headers){
  const raw = clean(headers && (headers.authorization || headers.Authorization));
  return raw.toLowerCase().startsWith('bearer ') ? raw.slice(7).trim() : '';
}
function passwordHash(password, salt){
  const p = clean(password);
  const s = clean(salt);
  if(!p || !s) return '';
  return crypto.pbkdf2Sync(p, s, 210000, 32, 'sha256').toString('hex');
}
function makePasswordRecord(password){
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, passwordHash: passwordHash(password, salt), algorithm:'pbkdf2-sha256', iterations:210000 };
}
function verifyPassword(password, record){
  if(!record) return false;
  const expected = clean(record.passwordHash || record.hash);
  const salt = clean(record.salt || process.env.PHC_OPERATOR_PASSWORD_SALT || '');
  if(!expected || !salt) return false;
  return timingSafeEqualString(passwordHash(password, salt), expected);
}
function configuredCredentialMode(){
  if(clean(process.env.PHC_BOOTSTRAP_ADMIN_CODE) && clean(process.env.PHC_ALLOW_BOOTSTRAP_LOGIN) === '1') return 'bootstrap-code';
  if(clean(process.env.PHC_OPERATOR_PASSWORD_HASH) && clean(process.env.PHC_OPERATOR_PASSWORD_SALT)) return 'env-password-hash';
  if(clean(process.env.PHC_OPERATOR_PASSWORD)) return 'env-password';
  return '';
}
function envPasswordRecord(){
  if(clean(process.env.PHC_OPERATOR_PASSWORD_HASH) && clean(process.env.PHC_OPERATOR_PASSWORD_SALT)){
    return { passwordHash: clean(process.env.PHC_OPERATOR_PASSWORD_HASH), salt: clean(process.env.PHC_OPERATOR_PASSWORD_SALT), algorithm:'pbkdf2-sha256', iterations:210000 };
  }
  if(clean(process.env.PHC_OPERATOR_PASSWORD)) return makePasswordRecord(process.env.PHC_OPERATOR_PASSWORD);
  return null;
}
function findOperator(state, operatorId){
  const oid = clean(operatorId || 'founder-admin');
  return (Array.isArray(state.operators) ? state.operators : []).find((row) => clean(row.operatorId || row.id) === oid) || null;
}
function upsertOperator(state, operator){
  const row = { ...(operator || {}) };
  row.operatorId = clean(row.operatorId || row.id || 'founder-admin');
  row.id = row.operatorId;
  row.operatorName = compact(row.operatorName || row.name || 'Skyes Over London');
  row.role = compact(row.role || 'admin');
  row.updatedAt = nowISO();
  if(!row.createdAt) row.createdAt = row.updatedAt;
  state.operators = [row].concat((Array.isArray(state.operators) ? state.operators : []).filter((item) => clean(item.operatorId || item.id) !== row.operatorId)).slice(0, 100);
  return row;
}
function authenticateOperator(input, state){
  const body = input || {};
  const operatorId = clean(body.operatorId) || clean(process.env.PHC_OPERATOR_ID) || 'founder-admin';
  const operatorName = compact(body.operatorName) || compact(process.env.PHC_OPERATOR_NAME) || 'Skyes Over London';
  const bootstrap = clean(body.bootstrapCode || body.adminCode);
  if(clean(process.env.PHC_BOOTSTRAP_ADMIN_CODE) && bootstrap && timingSafeEqualString(bootstrap, process.env.PHC_BOOTSTRAP_ADMIN_CODE)){
    const existingOperators = Array.isArray(state.operators) ? state.operators.length : 0;
    const allowBootstrap = clean(process.env.PHC_ALLOW_BOOTSTRAP_LOGIN) === '1' || existingOperators === 0;
    if(!allowBootstrap) return authFailure('Bootstrap login is locked after the first operator. Use a configured password hash.', 403);
    const seeded = upsertOperator(state, { operatorId, operatorName, role: compact(body.role || process.env.PHC_OPERATOR_ROLE || 'admin'), authSource:'bootstrap-code', passwordSet:false, bootstrapUsedAt: nowISO() });
    return { ok:true, operator:seeded, credentialMode:'bootstrap-code-first-use' };
  }
  const password = clean(body.password || body.operatorPassword || body.credential);
  if(!password) return authFailure('Missing operator credential.', 401);
  let operator = findOperator(state, operatorId);
  const envRecord = envPasswordRecord();
  if(operator && verifyPassword(password, operator)) return { ok:true, operator, credentialMode:'stored-password-hash' };
  if(envRecord && verifyPassword(password, envRecord)){
    operator = upsertOperator(state, { ...(operator || {}), operatorId, operatorName, role: compact(body.role || process.env.PHC_OPERATOR_ROLE || 'admin'), authSource:'env-password', passwordSet:!!(operator && operator.passwordHash) });
    return { ok:true, operator, credentialMode:configuredCredentialMode() };
  }
  if(!operator && !envRecord && !clean(process.env.PHC_BOOTSTRAP_ADMIN_CODE)) return authFailure('No operator credential is configured. Set PHC_OPERATOR_PASSWORD_HASH + PHC_OPERATOR_PASSWORD_SALT or PHC_BOOTSTRAP_ADMIN_CODE.', 503);
  return authFailure('Operator credential invalid.', 401);
}
function hasPermission(payload, permission){
  if(!permission) return true;
  const perms = Array.isArray(payload && payload.permissions) ? payload.permissions : rolePermissions(payload && payload.role);
  return perms.includes(permission) || perms.includes('manage:org');
}
function isRevoked(state, sid){
  const revoked = Array.isArray(state && state.revokedSessions) ? state.revokedSessions : [];
  return revoked.some((row) => clean(row.sid) === clean(sid));
}
function parseBody(event){
  try{ return event && event.body ? JSON.parse(event.body) : {}; }
  catch(_){ return { __invalidJson:true }; }
}
function tokenHash(token){ return crypto.createHash('sha256').update(clean(token)).digest('hex'); }
function activeSession(state, payload){
  const sid = clean(payload && payload.sid);
  if(!sid) return null;
  return (Array.isArray(state && state.sessions) ? state.sessions : []).find((row) => clean(row.sid) === sid) || null;
}
function requireAuth(event, options){
  options = options || {};
  const token = extractBearer((event && event.headers) || {});
  const verified = verifySessionToken(token);
  if(!verified.ok) return verified;
  const body = options.body || parseBody(event);
  if(body && body.__invalidJson) return authFailure('Invalid JSON body.', 400);
  const query = (event && event.queryStringParameters) || {};
  const requestedOrg = clean(body.orgId || query.orgId || verified.payload.orgId || 'default-org');
  if(clean(verified.payload.orgId) && clean(verified.payload.orgId) !== requestedOrg){
    if(!(options.allowCrossOrg === true && hasPermission(verified.payload, 'manage:org'))) return authFailure('Token org does not match requested org.', 403);
  }
  const state = readOrgState(requestedOrg);
  if(isRevoked(state, verified.payload.sid)) return authFailure('Session has been revoked.', 401);
  const active = activeSession(state, verified.payload);
  if(!active) return authFailure('Session is not active for this org. Re-login required.', 401);
  if(active.expiresAt && Date.parse(active.expiresAt) <= Date.now()) return authFailure('Stored session expired. Re-login required.', 401);
  verified.payload.permissions = Array.isArray(active.permissions) ? active.permissions : verified.payload.permissions;
  verified.payload.role = active.role || verified.payload.role;
  verified.payload.operatorId = active.operatorId || verified.payload.operatorId;
  verified.payload.deviceId = active.deviceId || verified.payload.deviceId;
  if(options.requireTrustedDevice && !active.trustedDevice) return authFailure('Trusted device is required for this action.', 403);
  if(options.permission && !hasPermission(verified.payload, options.permission)) return authFailure('Permission denied: ' + options.permission, 403);
  return { ok:true, payload:verified.payload, orgId:requestedOrg, state, body };
}
function revokeSession(state, payload, reason){
  state.revokedSessions = Array.isArray(state.revokedSessions) ? state.revokedSessions : [];
  const row = { id:uid('revoked'), sid:clean(payload && payload.sid), operatorId:clean(payload && payload.operatorId), reason:compact(reason || 'logout'), revokedAt:nowISO() };
  state.revokedSessions = [row].concat(state.revokedSessions.filter((item) => clean(item.sid) !== row.sid)).slice(0, 300);
  pushEvent(state, { kind:'session_revoked', note:'Session revoked.', detail:{ sid:row.sid, operatorId:row.operatorId, reason:row.reason } });
  return row;
}
function jsonResponse(statusCode, body, headers){
  return { statusCode, headers:{ 'content-type':'application/json', 'cache-control':'no-store', 'access-control-allow-origin':'*', 'access-control-allow-headers':'content-type, authorization, x-skyesol-token', 'access-control-allow-methods':'GET,POST,OPTIONS', ...(headers || {}) }, body: JSON.stringify(body) };
}
function authErrorResponse(guard){ return jsonResponse(guard.statusCode || 401, { ok:false, error:guard.error || 'Unauthorized.' }); }

module.exports = { issueSession, verifySessionToken, extractBearer, passwordHash, makePasswordRecord, verifyPassword, authenticateOperator, upsertOperator, findOperator, rolePermissions, hasPermission, requireAuth, revokeSession, configuredCredentialMode, jsonResponse, authErrorResponse, isProductionMode, tokenHash };
