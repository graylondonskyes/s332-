const { readOrgState, clean } = require('./_lib/housecircle-cloud-store');
const { extractBearer, verifySessionToken } = require('./_lib/housecircle-auth');
const { mirrorOrgStateToNeon, getNeonHealth } = require('./_lib/housecircle-neon-store');
const { corsHeaders } = require('./_lib/housecircle-cors');

function auth(headers){ const token = extractBearer(headers || {}); return token ? verifySessionToken(token) : { ok:true, payload:null }; }
exports.handler = async function(event){
  const cors = (m) => corsHeaders(event, m || 'POST,OPTIONS');
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:cors(), body:'' };
  if(event.httpMethod !== 'POST') return { statusCode:405, headers:cors(), body: JSON.stringify({ ok:false, error:'Method not allowed.' }) };
  const guard = auth(event.headers || {});
  if(!guard.ok) return { statusCode:401, headers:cors(), body: JSON.stringify({ ok:false, error:guard.error }) };
  const body = event.body ? JSON.parse(event.body) : {};
  const orgId = clean(body.orgId || (guard.payload && guard.payload.orgId) || 'default-org');
  const state = readOrgState(orgId);
  const mirrored = await mirrorOrgStateToNeon(orgId, state, { sourceLane:'file-backed-server-state', eventKind:'neon_backup_push', note: body.reason || 'Manual or automatic Neon backup push.' });
  const health = await getNeonHealth(orgId);
  return { statusCode: mirrored.ok ? 200 : 503, headers:cors(), body: JSON.stringify({ ok: !!mirrored.ok, orgId, mirrored, neon: health }) };
};
