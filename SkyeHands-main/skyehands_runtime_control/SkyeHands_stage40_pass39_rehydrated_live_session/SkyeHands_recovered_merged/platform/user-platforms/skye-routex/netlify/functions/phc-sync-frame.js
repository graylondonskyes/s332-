const { readOrgState, saveOrgState, mergeBundles, bundlePushSummary, clean, compact, addAudit, appendFrame, queueJob } = require('./_lib/housecircle-cloud-store');
const { requireAuth, authErrorResponse, jsonResponse } = require('./_lib/housecircle-auth');
const { persistOrgState } = require('./_lib/housecircle-persistence');
exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return jsonResponse(204, {});
  if(event.httpMethod !== 'POST') return jsonResponse(405, { ok:false, error:'Method not allowed.' });
  const body = event.body ? JSON.parse(event.body) : {};
  const guard = requireAuth(event, { body, permission:'write:sync' });
  if(!guard.ok) return authErrorResponse(guard);
  const state = readOrgState(guard.orgId);
  const frame = appendFrame(state, { type: compact(body.type || 'sync-frame'), source: compact(body.source || 'operator'), payload: body.payload || {}, operatorId:guard.payload.operatorId });
  if(body.bundle && typeof body.bundle === 'object') state.bundle = mergeBundles(state.bundle, body.bundle);
  addAudit(state.bundle, 'sync-frame', body.reason || 'Sync frame accepted.', { frameId:frame.id, operatorId:guard.payload.operatorId });
  queueJob(state, { type:'frame-applied', frameId:frame.id, status:'completed', completedAt:new Date().toISOString() });
  const { saved } = await persistOrgState(guard.orgId, state, { eventKind:'v83_route_persist', sourceLane:'v83-route', note:'Route state persisted.' });
  return jsonResponse(200, { ok:true, orgId: saved.orgId, revision: saved.revision, frameId: frame.id, summary: bundlePushSummary(saved.bundle), queuedJobs: saved.jobs.filter((row) => row.status !== 'completed').length });
};
