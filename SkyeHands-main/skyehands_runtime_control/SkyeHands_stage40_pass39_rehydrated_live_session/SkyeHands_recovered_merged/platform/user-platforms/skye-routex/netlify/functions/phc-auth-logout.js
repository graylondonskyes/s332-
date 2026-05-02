const { saveOrgState, clean } = require('./_lib/housecircle-cloud-store');
const { requireAuth, revokeSession, jsonResponse, authErrorResponse } = require('./_lib/housecircle-auth');
const { persistOrgState } = require('./_lib/housecircle-persistence');
exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return jsonResponse(204, {});
  if(event.httpMethod !== 'POST') return jsonResponse(405, { ok:false, error:'Method not allowed.' });
  const guard = requireAuth(event, {});
  if(!guard.ok) return authErrorResponse(guard);
  const row = revokeSession(guard.state, guard.payload, clean(guard.body && guard.body.reason) || 'operator logout');
  const { saved } = await persistOrgState(guard.orgId, guard.state, { eventKind:'auth_logout', sourceLane:'v83-auth', note:'Session revocation persisted.' });
  return jsonResponse(200, { ok:true, orgId:guard.orgId, revision:saved.revision, revoked:row });
};
