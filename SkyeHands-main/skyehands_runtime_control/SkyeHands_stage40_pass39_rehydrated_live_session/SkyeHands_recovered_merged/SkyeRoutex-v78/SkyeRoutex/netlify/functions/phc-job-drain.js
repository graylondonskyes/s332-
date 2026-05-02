const { drainJobs, clean } = require('./_lib/housecircle-cloud-store');
const { verifySessionToken, extractBearer } = require('./_lib/housecircle-auth');
const { corsHeaders } = require('./_lib/housecircle-cors');

exports.handler = async function(event){
  const cors = (m) => corsHeaders(event, m || 'GET,POST,OPTIONS');
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:cors(), body:'' };
  const token = extractBearer(event.headers || {});
  const guard = token ? verifySessionToken(token) : { ok:true, payload:null };
  if(!guard.ok) return { statusCode:401, headers:cors(), body: JSON.stringify({ ok:false, error:guard.error }) };
  const body = event.httpMethod === 'POST' && event.body ? JSON.parse(event.body) : {};
  const orgId = clean((event.queryStringParameters && event.queryStringParameters.orgId) || body.orgId) || clean(guard.payload && guard.payload.orgId) || 'default-org';
  const limit = Number((event.queryStringParameters && event.queryStringParameters.limit) || body.limit || 10);
  const result = drainJobs(orgId, limit);
  return { statusCode:200, headers:cors(), body: JSON.stringify({ ok:true, orgId, revision: result.revision, completed: result.completed.length, pending: result.pending, jobs: result.completed }) };
};
