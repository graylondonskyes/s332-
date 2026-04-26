const { readOrgState, clean, compact, purgeExpiredLocks, listDevices } = require('./_lib/housecircle-cloud-store');
const { verifySessionToken, extractBearer } = require('./_lib/housecircle-auth');

function cors(){ return { 'content-type':'application/json', 'cache-control':'no-store', 'access-control-allow-origin':'*', 'access-control-allow-headers':'content-type, authorization', 'access-control-allow-methods':'GET,OPTIONS' }; }
function limitRows(rows, n){ return Array.isArray(rows) ? rows.slice(0, Math.max(1, Math.min(100, Number(n) || 25))) : []; }

exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:cors(), body:'' };
  if(event.httpMethod !== 'GET') return { statusCode:405, headers:cors(), body: JSON.stringify({ ok:false, error:'Method not allowed.' }) };
  const guard = verifySessionToken(extractBearer(event.headers || {}));
  if(!guard.ok) return { statusCode:401, headers:cors(), body: JSON.stringify({ ok:false, error: guard.error }) };
  const orgId = clean(event.queryStringParameters && event.queryStringParameters.orgId) || clean(guard.payload.orgId) || 'default-org';
  const max = clean(event.queryStringParameters && event.queryStringParameters.limit) || 25;
  const state = readOrgState(orgId);
  purgeExpiredLocks(state);
  const events = limitRows(state.eventLog, max);
  const audit = limitRows(state.bundle && state.bundle.audit, max);
  const jobs = limitRows(state.jobs, max);
  const frames = limitRows(state.frames, max);
  return { statusCode:200, headers:cors(), body: JSON.stringify({ ok:true, orgId, revision: state.revision, events, audit, jobs, frames, locks: limitRows(state.locks, max), devices: limitRows(listDevices(state), max), sessions: limitRows(state.sessions, max), mfa: Object.values(state.mfa || {}).map((row) => ({ operatorId: row.operatorId, enabled: !!row.enabled, lastVerifiedAt: row.lastVerifiedAt || '', updatedAt: row.updatedAt || '' })) }) };
};
