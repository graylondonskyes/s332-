const crypto = require('crypto');

function clean(value){ return String(value == null ? '' : value).trim(); }
function splitScopes(value){
  if(Array.isArray(value)) return value.map(clean).filter(Boolean);
  return clean(value).split(/\s+/).map(clean).filter(Boolean);
}
function parseJsonB64url(value){
  return JSON.parse(Buffer.from(clean(value), 'base64url').toString('utf8'));
}
function timingSafeEqualString(a, b){
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if(aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}
function getJwk(header){
  const raw = clean(process.env.SKYGATE_JWKS_JSON || process.env.SKYGATEFS13_JWKS_JSON);
  if(!raw) return null;
  let jwks;
  try{ jwks = JSON.parse(raw); }catch(_){ return null; }
  const keys = Array.isArray(jwks.keys) ? jwks.keys : [];
  return keys.find((key) => clean(key.kid) === clean(header.kid)) || (keys.length === 1 ? keys[0] : null);
}
function getPublicKey(header){
  const pem = clean(process.env.SKYGATE_PUBLIC_KEY_PEM || process.env.SKYGATEFS13_PUBLIC_KEY_PEM);
  if(pem) return pem.replace(/\\n/g, '\n');
  const jwk = getJwk(header);
  if(jwk) return crypto.createPublicKey({ key:jwk, format:'jwk' });
  return null;
}
function expectedAudience(){
  return clean(process.env.SKYEROUTEX_SKYGATE_AUDIENCE || process.env.SKYGATE_EXPECTED_AUDIENCE || 'skygatefs13');
}
function expectedIssuer(){
  return clean(process.env.SKYEROUTEX_SKYGATE_ISSUER || process.env.SKYGATE_ISSUER || '');
}
function rolePermissions(role, scope){
  const scopes = splitScopes(scope);
  const r = clean(role || '').toLowerCase();
  const base = ['view:org','view:app','read:sync','read:valuation','read:walkthrough'];
  const hasAdminScope = scopes.some((item) => ['admin.write','gateway.admin','skyeroutex.admin','manage:org'].includes(item));
  if(hasAdminScope || r === 'admin' || r === 'founder_admin' || r === 'owner'){
    return base.concat(['manage:org','manage:app','manage:app_fabric','write:sync','write:jobs','write:valuation','write:walkthrough','write:pos','write:neon','manage:auth']);
  }
  if(scopes.includes('gateway.invoke') || scopes.includes('skyeroutex.write') || r === 'operator'){
    return base.concat(['write:sync','write:jobs','write:pos']);
  }
  return base;
}
function verifySkyGateToken(token){
  const parts = clean(token).split('.');
  if(parts.length !== 3) return { ok:false, statusCode:401, error:'Missing or malformed SkyGate bearer token.' };
  let header;
  let payload;
  try{
    header = parseJsonB64url(parts[0]);
    payload = parseJsonB64url(parts[1]);
  }catch(_){
    return { ok:false, statusCode:401, error:'SkyGate token decode failed.' };
  }
  if(header.alg !== 'RS256') return { ok:false, statusCode:401, error:'SkyGate token must use RS256.' };
  const key = getPublicKey(header);
  if(!key) return { ok:false, statusCode:503, error:'SkyGate public key/JWKS is not configured for SkyeRoutex.' };
  const valid = crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), key, Buffer.from(parts[2], 'base64url'));
  if(!valid) return { ok:false, statusCode:401, error:'SkyGate token signature invalid.' };
  const now = Math.floor(Date.now() / 1000);
  if(payload.exp && now > Number(payload.exp)) return { ok:false, statusCode:401, error:'SkyGate token expired.' };
  if(payload.nbf && now < Number(payload.nbf)) return { ok:false, statusCode:401, error:'SkyGate token not active yet.' };
  const aud = expectedAudience();
  if(aud){
    const audiences = Array.isArray(payload.aud) ? payload.aud.map(clean) : [clean(payload.aud)].filter(Boolean);
    if(!audiences.includes(aud)) return { ok:false, statusCode:401, error:'SkyGate token audience mismatch.' };
  }
  const iss = expectedIssuer();
  if(iss && clean(payload.iss) !== iss) return { ok:false, statusCode:401, error:'SkyGate token issuer mismatch.' };
  const role = clean(payload.role || payload.sub_role || 'operator');
  const permissions = rolePermissions(role, payload.scope || payload.scp);
  return {
    ok:true,
    payload:{
      sid: clean(payload.sid || payload.jti || payload.sub),
      orgId: clean(payload.org_id || payload.orgId || payload.customer_id || payload.tenant_id),
      operatorId: clean(payload.sub || payload.user_id || payload.email || 'skygate-user'),
      operatorName: clean(payload.display_name || payload.name || payload.email || payload.sub || 'SkyGate User'),
      role,
      permissions,
      deviceId: clean(payload.device_id || payload.install_id || 'skygate-device'),
      trustedDevice: payload.trusted_device === true || payload.device_trusted === true || permissions.includes('manage:org'),
      issuedAt: payload.iat ? new Date(Number(payload.iat) * 1000).toISOString() : null,
      expiresAt: payload.exp ? new Date(Number(payload.exp) * 1000).toISOString() : null,
      skygateClaims: payload,
      authSource:'skygatefs13'
    }
  };
}
function requireSkyGateOnly(){ return clean(process.env.SKYEROUTEX_REQUIRE_SKYGATE || process.env.PHC_REQUIRE_SKYGATE).toLowerCase() === '1'; }
function issueTestSkyGateToken(payload, privateKey, kid){
  const now = Math.floor(Date.now() / 1000);
  const header = { alg:'RS256', typ:'JWT', kid:kid || 'skyeroutex-smoke-key' };
  const claims = { iss:'https://skygatefs13.local', aud:expectedAudience(), iat:now, exp:now + 3600, type:'user_session', ...payload };
  const input = Buffer.from(JSON.stringify(header)).toString('base64url') + '.' + Buffer.from(JSON.stringify(claims)).toString('base64url');
  const sig = crypto.sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url');
  return input + '.' + sig;
}

module.exports = { verifySkyGateToken, requireSkyGateOnly, issueTestSkyGateToken };
