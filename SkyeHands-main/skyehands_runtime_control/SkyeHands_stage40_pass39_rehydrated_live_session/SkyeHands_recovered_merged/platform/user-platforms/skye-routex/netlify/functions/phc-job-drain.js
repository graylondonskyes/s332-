const { drainJobs, clean } = require('./_lib/housecircle-cloud-store');
const { requireAuth, authErrorResponse, jsonResponse } = require('./_lib/housecircle-auth');
exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return jsonResponse(204, {});
  if(!['GET','POST'].includes(event.httpMethod)) return jsonResponse(405, { ok:false, error:'Method not allowed.' });
  const body = event.httpMethod === 'POST' && event.body ? JSON.parse(event.body) : {};
  const guard = requireAuth(event, { body, permission:'write:jobs' });
  if(!guard.ok) return authErrorResponse(guard);
  const limit = Number((event.queryStringParameters && event.queryStringParameters.limit) || body.limit || 10);
  const result = drainJobs(guard.orgId, limit);
  return jsonResponse(200, { ok:true, orgId:guard.orgId, revision: result.revision, completed: result.completed.length, pending: result.pending, jobs: result.completed });
};
