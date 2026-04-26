const { readOrgState, saveOrgState, clean, releaseLock, purgeExpiredLocks, pushEvent } = require('./_lib/housecircle-cloud-store');
const { verifySessionToken, extractBearer } = require('./_lib/housecircle-auth');
const { corsHeaders } = require('./_lib/housecircle-cors');

exports.handler = async function(event){
  const cors = (m) => corsHeaders(event, m || 'POST,OPTIONS');
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:cors(), body:'' };
  if(event.httpMethod !== 'POST') return { statusCode:405, headers:cors(), body: JSON.stringify({ ok:false, error:'Method not allowed.' }) };
  const guard = verifySessionToken(extractBearer(event.headers || {}));
  if(!guard.ok) return { statusCode:401, headers:cors(), body: JSON.stringify({ ok:false, error: guard.error }) };
  const body = event.body ? JSON.parse(event.body) : {};
  const orgId = clean(body.orgId) || clean(guard.payload.orgId) || 'default-org';
  const state = readOrgState(orgId);
  purgeExpiredLocks(state);
  const result = releaseLock(state, body);
  if(!result.ok) return { statusCode:404, headers:cors(), body: JSON.stringify({ ok:false, error:'Lock not found.' }) };
  pushEvent(state, { kind:'lock_release', note:'Resource lock released.', detail:{ resourceKey: result.lock.resourceKey, operatorId: guard.payload.operatorId } });
  const saved = saveOrgState(orgId, state);
  return { statusCode:200, headers:cors(), body: JSON.stringify({ ok:true, orgId, released: result.lock, locks: saved.locks, revision:saved.revision }) };
};
