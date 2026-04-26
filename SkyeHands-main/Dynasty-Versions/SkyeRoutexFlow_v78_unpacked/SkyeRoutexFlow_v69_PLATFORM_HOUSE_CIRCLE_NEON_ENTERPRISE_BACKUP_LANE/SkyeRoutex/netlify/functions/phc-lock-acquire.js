const { readOrgState, saveOrgState, clean, compact, acquireLock, purgeExpiredLocks, pushEvent } = require('./_lib/housecircle-cloud-store');
const { verifySessionToken, extractBearer } = require('./_lib/housecircle-auth');

function cors(){ return { 'content-type':'application/json', 'cache-control':'no-store', 'access-control-allow-origin':'*', 'access-control-allow-headers':'content-type, authorization', 'access-control-allow-methods':'POST,OPTIONS' }; }

exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:cors(), body:'' };
  if(event.httpMethod !== 'POST') return { statusCode:405, headers:cors(), body: JSON.stringify({ ok:false, error:'Method not allowed.' }) };
  const guard = verifySessionToken(extractBearer(event.headers || {}));
  if(!guard.ok) return { statusCode:401, headers:cors(), body: JSON.stringify({ ok:false, error: guard.error }) };
  const body = event.body ? JSON.parse(event.body) : {};
  const orgId = clean(body.orgId) || clean(guard.payload.orgId) || 'default-org';
  const state = readOrgState(orgId);
  purgeExpiredLocks(state);
  const result = acquireLock(state, {
    resourceType: body.resourceType,
    resourceId: body.resourceId,
    ttlSec: body.ttlSec,
    note: body.note,
    force: body.force,
    operatorId: guard.payload.operatorId,
    operatorName: guard.payload.operatorName,
    deviceId: clean(body.deviceId) || clean(guard.payload.deviceId)
  });
  if(!result.ok) return { statusCode:409, headers:cors(), body: JSON.stringify({ ok:false, error:'Resource already locked.', conflict:true, lock: result.lock }) };
  pushEvent(state, { kind:'lock_acquire', note:'Resource lock acquired.', detail:{ resourceKey: result.lock.resourceKey, operatorId: result.lock.operatorId } });
  const saved = saveOrgState(orgId, state);
  return { statusCode:200, headers:cors(), body: JSON.stringify({ ok:true, orgId, lock: result.lock, locks: saved.locks, revision:saved.revision }) };
};
