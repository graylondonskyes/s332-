const { saveOrgState, clean, acquireLock, purgeExpiredLocks, pushEvent } = require('./_lib/housecircle-cloud-store');
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
  const result = acquireLock(state, { resourceType:body.resourceType, resourceId:body.resourceId, ttlSec:body.ttlSec, note:body.note, force:body.force, operatorId:guard.payload.operatorId, operatorName:guard.payload.operatorName, deviceId: clean(body.deviceId) || clean(guard.payload.deviceId) });
  if(!result.ok) return jsonResponse(409, { ok:false, error:'Resource already locked.', conflict:true, lock: result.lock });
  pushEvent(state, { kind:'lock_acquire', note:'Resource lock acquired.', detail:{ resourceKey: result.lock.resourceKey, operatorId: result.lock.operatorId } });
  const { saved } = await persistOrgState(guard.orgId, state, { eventKind:'v83_route_persist', sourceLane:'v83-route', note:'Route state persisted.' });
  return jsonResponse(200, { ok:true, orgId:guard.orgId, lock: result.lock, locks: saved.locks, revision:saved.revision });
};
