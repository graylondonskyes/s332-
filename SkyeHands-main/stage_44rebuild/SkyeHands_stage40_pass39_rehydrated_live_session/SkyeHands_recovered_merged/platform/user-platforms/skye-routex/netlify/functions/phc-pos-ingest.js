const { readOrgState, saveOrgState, bundlePushSummary, clean, compact, queueJob } = require('./_lib/housecircle-cloud-store');
const { requireAuth, authErrorResponse, jsonResponse } = require('./_lib/housecircle-auth');
const { persistOrgState } = require('./_lib/housecircle-persistence');
exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return jsonResponse(204, {});
  if(event.httpMethod !== 'POST') return jsonResponse(405, { ok:false, error:'Method not allowed.' });
  const body = event.body ? JSON.parse(event.body) : {};
  const guard = requireAuth(event, { body, permission:'write:pos' });
  if(!guard.ok) return authErrorResponse(guard);
  const rows = Array.isArray(body.rows) ? body.rows : [];
  const state = readOrgState(guard.orgId);
  const job = queueJob(state, { type:'pos-ingest', source:compact(body.source || 'operator-upload'), adapter:compact(body.adapter || 'generic'), rows, meta:{ operatorId:guard.payload.operatorId, locationId:clean(body.locationId), locationName:compact(body.locationName) }, status:'queued' });
  const { saved } = await persistOrgState(guard.orgId, state, { eventKind:'v83_route_persist', sourceLane:'v83-route', note:'Route state persisted.' });
  return jsonResponse(200, { ok:true, jobId: job.id, orgId: saved.orgId, revision: saved.revision, queuedRows: rows.length, queuedJobs: saved.jobs.filter((row) => row.status !== 'completed').length, summary: bundlePushSummary(saved.bundle) });
};
