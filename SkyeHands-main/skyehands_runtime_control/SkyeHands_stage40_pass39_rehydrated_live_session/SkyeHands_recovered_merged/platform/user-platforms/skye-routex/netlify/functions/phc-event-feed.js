const { clean, purgeExpiredLocks, listDevices } = require('./_lib/housecircle-cloud-store');
const { requireAuth, authErrorResponse, jsonResponse } = require('./_lib/housecircle-auth');
function limitRows(rows, n){ return Array.isArray(rows) ? rows.slice(0, Math.max(1, Math.min(100, Number(n) || 25))) : []; }
exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return jsonResponse(204, {});
  if(event.httpMethod !== 'GET') return jsonResponse(405, { ok:false, error:'Method not allowed.' });
  const guard = requireAuth(event, { permission:'view:org' });
  if(!guard.ok) return authErrorResponse(guard);
  const max = clean(event.queryStringParameters && event.queryStringParameters.limit) || 25;
  const state = guard.state;
  purgeExpiredLocks(state);
  return jsonResponse(200, { ok:true, orgId:guard.orgId, revision: state.revision, events:limitRows(state.eventLog, max), audit:limitRows(state.bundle && state.bundle.audit, max), jobs:limitRows(state.jobs, max), frames:limitRows(state.frames, max), locks:limitRows(state.locks, max), devices:limitRows(listDevices(state), max), sessions:limitRows(state.sessions, max), mfa:Object.values(state.mfa || {}).map((row) => ({ operatorId: row.operatorId, enabled: !!row.enabled, lastVerifiedAt: row.lastVerifiedAt || '', updatedAt: row.updatedAt || '' })) });
};
