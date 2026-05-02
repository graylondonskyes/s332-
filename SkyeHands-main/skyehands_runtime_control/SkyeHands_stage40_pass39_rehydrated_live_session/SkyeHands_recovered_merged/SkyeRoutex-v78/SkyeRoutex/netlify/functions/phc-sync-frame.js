const { readOrgState, saveOrgState, applyFrameToState, bundlePushSummary, clean } = require('./_lib/housecircle-cloud-store');
const { verifySessionToken, extractBearer } = require('./_lib/housecircle-auth');
const { corsHeaders } = require('./_lib/housecircle-cors');

exports.handler = async function(event){
  const cors = (m) => corsHeaders(event, m || 'POST,OPTIONS');
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:cors(), body:'' };
  if(event.httpMethod !== 'POST') return { statusCode:405, headers:cors(), body: JSON.stringify({ ok:false, error:'Method not allowed.' }) };
  const token = extractBearer(event.headers || {});
  const guard = token ? verifySessionToken(token) : { ok:true, payload:null };
  if(!guard.ok) return { statusCode:401, headers:cors(), body: JSON.stringify({ ok:false, error:guard.error }) };
  const body = event.body ? JSON.parse(event.body) : {};
  const orgId = clean(body.orgId) || clean(guard.payload && guard.payload.orgId) || 'default-org';
  const state = readOrgState(orgId);
  const frame = applyFrameToState(state, body.frame || {});
  const saved = saveOrgState(orgId, state);
  return { statusCode:200, headers:cors(), body: JSON.stringify({ ok:true, orgId: saved.orgId, revision: saved.revision, frameId: frame.id, summary: bundlePushSummary(saved.bundle), queuedJobs: saved.jobs.filter((row) => row.status !== 'completed').length }) };
};
