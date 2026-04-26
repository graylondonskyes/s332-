const { readOrgState, saveOrgState, queueJob, normalizeSquareWebhook, bundlePushSummary, clean } = require('./_lib/housecircle-cloud-store');

exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:{ 'access-control-allow-origin':'*', 'access-control-allow-headers':'content-type, authorization', 'access-control-allow-methods':'POST,OPTIONS' }, body:'' };
  if(event.httpMethod !== 'POST') return { statusCode:405, headers:{ 'content-type':'application/json', 'access-control-allow-origin':'*' }, body: JSON.stringify({ ok:false, error:'Method not allowed.' }) };
  const body = event.body ? JSON.parse(event.body) : {};
  const orgId = clean(body.orgId) || 'default-org';
  const state = readOrgState(orgId);
  const rows = normalizeSquareWebhook(body.payload || body);
  const job = queueJob(state, { type:'webhook-job', source:'square', eventType: clean(body.eventType || body.type || 'square.webhook'), payload: body.payload || body, rowsPreview: rows.slice(0, 1), status:'queued' });
  const saved = saveOrgState(orgId, state);
  return { statusCode:200, headers:{ 'content-type':'application/json', 'cache-control':'no-store', 'access-control-allow-origin':'*', 'access-control-allow-headers':'content-type, authorization' }, body: JSON.stringify({ ok:true, jobId: job.id, orgId: saved.orgId, revision: saved.revision, queuedJobs: saved.jobs.filter((row) => row.status !== 'completed').length, summary: bundlePushSummary(saved.bundle) }) };
};
