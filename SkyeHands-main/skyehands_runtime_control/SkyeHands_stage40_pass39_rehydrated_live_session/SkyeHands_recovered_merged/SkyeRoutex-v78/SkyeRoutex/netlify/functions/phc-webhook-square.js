const { readOrgState, saveOrgState, queueJob, normalizeSquareWebhook, bundlePushSummary, clean } = require('./_lib/housecircle-cloud-store');
const { corsHeaders } = require('./_lib/housecircle-cors');

exports.handler = async function(event){
  const cors = (m) => corsHeaders(event, m || 'POST,OPTIONS');
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:cors(), body:'' };
  if(event.httpMethod !== 'POST') return { statusCode:405, headers:cors(), body: JSON.stringify({ ok:false, error:'Method not allowed.' }) };
  const body = event.body ? JSON.parse(event.body) : {};
  const orgId = clean(body.orgId) || 'default-org';
  const state = readOrgState(orgId);
  const rows = normalizeSquareWebhook(body.payload || body);
  const job = queueJob(state, { type:'webhook-job', source:'square', eventType: clean(body.eventType || body.type || 'square.webhook'), payload: body.payload || body, rowsPreview: rows.slice(0, 1), status:'queued' });
  const saved = saveOrgState(orgId, state);
  return { statusCode:200, headers:cors(), body: JSON.stringify({ ok:true, jobId: job.id, orgId: saved.orgId, revision: saved.revision, queuedJobs: saved.jobs.filter((row) => row.status !== 'completed').length, summary: bundlePushSummary(saved.bundle) }) };
};
