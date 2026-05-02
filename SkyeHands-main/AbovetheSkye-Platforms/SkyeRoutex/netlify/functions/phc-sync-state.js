const { readOrgState, saveOrgState, mergeBundles, bundlePushSummary, clean, compact, addAudit, num } = require('./_lib/housecircle-cloud-store');
const { requireAuth, authErrorResponse, jsonResponse } = require('./_lib/housecircle-auth');
const { persistOrgState } = require('./_lib/housecircle-persistence');
exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return jsonResponse(204, {});
  if(!['GET','POST'].includes(event.httpMethod)) return jsonResponse(405, { ok:false, error:'Method not allowed.' });
  const body = event.httpMethod === 'POST' && event.body ? JSON.parse(event.body) : {};
  const guard = requireAuth(event, { body, permission:event.httpMethod === 'POST' ? 'write:sync' : 'read:sync' });
  if(!guard.ok) return authErrorResponse(guard);
  if(event.httpMethod === 'GET'){
    const state = readOrgState(guard.orgId);
    state.metrics.pulls = num(state.metrics && state.metrics.pulls) + 1;
    await persistOrgState(guard.orgId, state, { eventKind:'sync_pull_metric', sourceLane:'v83-sync-state' });
    return jsonResponse(200, { ok:true, orgId: state.orgId, revision: state.revision, updatedAt: state.updatedAt, bundle: state.bundle, summary: bundlePushSummary(state.bundle) });
  }
  const state = readOrgState(guard.orgId);
  const incoming = body.bundle && typeof body.bundle === 'object' ? body.bundle : {};
  const baseRevision = clean(body.baseRevision);
  const mergeMode = compact(body.mergeMode || 'auto');
  const conflict = !!baseRevision && baseRevision !== state.revision;
  state.bundle = (!conflict && mergeMode === 'replace') ? incoming : mergeBundles(state.bundle, incoming);
  addAudit(state.bundle, 'cloud-sync-push', body.reason || 'Snapshot pushed to server.', { baseRevision, previousRevision: state.revision, conflict, mergeMode, operatorId:guard.payload.operatorId });
  state.metrics.pushes = num(state.metrics && state.metrics.pushes) + 1;
  const previousRevision = state.revision;
  const { saved } = await persistOrgState(guard.orgId, state, { eventKind:'sync_state_push', sourceLane:'v83-sync-state', note:body.reason || 'State push persisted.' });
  return jsonResponse(200, { ok:true, orgId: saved.orgId, revision: saved.revision, previousRevision, conflict, mergeMode, summary: bundlePushSummary(saved.bundle) });
};
