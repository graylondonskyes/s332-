const { readOrgState, saveOrgState, clean } = require('./_lib/housecircle-cloud-store');
const { buildWalkthroughRecord } = require('./_lib/housecircle-walkthrough');
const { requireAuth, authErrorResponse, jsonResponse } = require('./_lib/housecircle-auth');
const { persistOrgState } = require('./_lib/housecircle-persistence');
exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return jsonResponse(204, {});
  if(!['GET','POST'].includes(event.httpMethod)) return jsonResponse(405, { ok:false, error:'Method not allowed.' });
  const body = event.httpMethod === 'POST' && event.body ? JSON.parse(event.body) : {};
  const guard = requireAuth(event, { body, permission:event.httpMethod === 'POST' ? 'write:walkthrough' : 'read:walkthrough' });
  if(!guard.ok) return authErrorResponse(guard);
  const state = readOrgState(guard.orgId);
  if(event.httpMethod === 'GET'){
    return jsonResponse(200, { ok:true, orgId:state.orgId, revision:state.revision, record:state.bundle.walkthroughCurrent || null });
  }
  const record = buildWalkthroughRecord(state.bundle, body);
  state.bundle.walkthroughCurrent = record;
  state.bundle.walkthroughRecords = [record].concat(state.bundle.walkthroughRecords || []).slice(0, 40);
  const { saved } = await persistOrgState(guard.orgId, state, { eventKind:'v83_route_persist', sourceLane:'v83-route', note:'Route state persisted.' });
  return jsonResponse(200, { ok:true, orgId:saved.orgId, revision:saved.revision, record });
};
