const { readOrgState, clean } = require('./_lib/housecircle-cloud-store');
const { requireAuth, authErrorResponse, jsonResponse } = require('./_lib/housecircle-auth');
const { mirrorOrgStateToNeon, getNeonHealth } = require('./_lib/housecircle-neon-store');
exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return jsonResponse(204, {});
  if(event.httpMethod !== 'POST') return jsonResponse(405, { ok:false, error:'Method not allowed.' });
  let body = {};
  try{ body = event.body ? JSON.parse(event.body) : {}; }catch(_){ return jsonResponse(400, { ok:false, error:'Invalid JSON body.' }); }
  const guard = requireAuth(event, { body, permission:'write:neon', requireTrustedDevice:true });
  if(!guard.ok) return authErrorResponse(guard);
  const orgId = clean(body.orgId || (guard.payload && guard.payload.orgId) || 'default-org');
  const state = readOrgState(orgId);
  const mirrored = await mirrorOrgStateToNeon(orgId, state, { sourceLane:'file-backed-server-state', eventKind:'neon_backup_push', note: body.reason || 'Manual or automatic Neon backup push.' });
  const health = await getNeonHealth(orgId);
  return jsonResponse( mirrored.ok ? 200 : 503, { ok: !!mirrored.ok, orgId, mirrored, neon: health });
};
