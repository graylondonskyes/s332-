const { saveOrgState, releaseLock, purgeExpiredLocks, pushEvent, clean } = require('./_lib/housecircle-cloud-store');
const { requireAuth, authErrorResponse, jsonResponse } = require('./_lib/housecircle-auth');
const { persistOrgState } = require('./_lib/housecircle-persistence');
exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return jsonResponse(204, {});
  if(event.httpMethod !== 'POST') return jsonResponse(405, { ok:false, error:'Method not allowed.' });
  let body = {};
  try{ body = event.body ? JSON.parse(event.body) : {}; }catch(_){ return jsonResponse(400, { ok:false, error:'Invalid JSON body.' }); }
  const guard = requireAuth(event, { body, permission:'write:sync' });
  if(!guard.ok) return authErrorResponse(guard);
  const state = guard.state;
  purgeExpiredLocks(state);
  const target = (state.locks || []).find((lock) => (body.lockId && clean(lock.id) === clean(body.lockId)) || (!body.lockId && clean(lock.resourceKey) === clean(body.resourceKey || ((body.resourceType || 'resource') + ':' + (body.resourceId || 'unknown')))));
  if(target && clean(target.operatorId) !== clean(guard.payload.operatorId) && !(guard.payload.permissions || []).includes('manage:org')){
    return jsonResponse(403, { ok:false, error:'Only the lock owner or org admin can release this lock.' });
  }
  const result = releaseLock(state, body);
  if(!result.ok) return jsonResponse(404, { ok:false, error:'Lock not found.' });
  pushEvent(state, { kind:'lock_release', note:'Resource lock released.', detail:{ resourceKey: result.lock.resourceKey, operatorId: guard.payload.operatorId } });
  const { saved } = await persistOrgState(guard.orgId, state, { eventKind:'v83_route_persist', sourceLane:'v83-route', note:'Route state persisted.' });
  return jsonResponse(200, { ok:true, orgId:guard.orgId, released: result.lock, locks: saved.locks, revision:saved.revision });
};
