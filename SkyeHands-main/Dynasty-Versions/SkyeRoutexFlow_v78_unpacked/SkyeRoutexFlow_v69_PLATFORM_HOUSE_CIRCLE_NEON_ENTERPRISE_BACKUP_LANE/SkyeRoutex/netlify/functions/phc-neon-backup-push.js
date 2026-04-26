const { readOrgState, clean } = require('./_lib/housecircle-cloud-store');
const { extractBearer, verifySessionToken } = require('./_lib/housecircle-auth');
const { mirrorOrgStateToNeon, getNeonHealth } = require('./_lib/housecircle-neon-store');
function auth(headers){ const token = extractBearer(headers || {}); return token ? verifySessionToken(token) : { ok:true, payload:null }; }
exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:{ 'access-control-allow-origin':'*', 'access-control-allow-headers':'content-type, authorization', 'access-control-allow-methods':'POST,OPTIONS' }, body:'' };
  if(event.httpMethod !== 'POST') return { statusCode:405, headers:{ 'content-type':'application/json', 'access-control-allow-origin':'*' }, body: JSON.stringify({ ok:false, error:'Method not allowed.' }) };
  const guard = auth(event.headers || {});
  if(!guard.ok) return { statusCode:401, headers:{ 'content-type':'application/json', 'access-control-allow-origin':'*' }, body: JSON.stringify({ ok:false, error:guard.error }) };
  const body = event.body ? JSON.parse(event.body) : {};
  const orgId = clean(body.orgId || (guard.payload && guard.payload.orgId) || 'default-org');
  const state = readOrgState(orgId);
  const mirrored = await mirrorOrgStateToNeon(orgId, state, { sourceLane:'file-backed-server-state', eventKind:'neon_backup_push', note: body.reason || 'Manual or automatic Neon backup push.' });
  const health = await getNeonHealth(orgId);
  return { statusCode: mirrored.ok ? 200 : 503, headers:{ 'content-type':'application/json', 'cache-control':'no-store', 'access-control-allow-origin':'*', 'access-control-allow-headers':'content-type, authorization' }, body: JSON.stringify({ ok: !!mirrored.ok, orgId, mirrored, neon: health }) };
};
