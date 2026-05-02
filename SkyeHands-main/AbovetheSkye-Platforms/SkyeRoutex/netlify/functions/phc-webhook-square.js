const crypto = require('crypto');
const { readOrgState, saveOrgState, clean, queueJob, bundlePushSummary, normalizeSquareWebhook, hasReplayEvent, recordReplayEvent, pushEvent } = require('./_lib/housecircle-cloud-store');
const { jsonResponse, isProductionMode } = require('./_lib/housecircle-auth');
const { persistOrgState } = require('./_lib/housecircle-persistence');
function getHeader(headers, name){
  const target = String(name || '').toLowerCase();
  return clean(Object.keys(headers || {}).find((k) => k.toLowerCase() === target) ? headers[Object.keys(headers || {}).find((k) => k.toLowerCase() === target)] : '');
}
function verifySquareSignature(event){
  const key = clean(process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || process.env.PHC_SQUARE_WEBHOOK_SIGNATURE_KEY || '');
  if(!key){
    if(!isProductionMode() && clean(process.env.PHC_ALLOW_UNSIGNED_WEBHOOKS) === '1') return { ok:true, mode:'unsigned-dev-allow' };
    return { ok:false, statusCode:503, error:'Square webhook signature key is not configured.' };
  }
  const sig = getHeader(event.headers || {}, 'x-square-hmacsha256-signature');
  if(!sig) return { ok:false, statusCode:401, error:'Missing Square signature header.' };
  const url = clean(process.env.SQUARE_WEBHOOK_NOTIFICATION_URL || process.env.URL || '');
  const body = event.body || '';
  if(isProductionMode() && !url) return { ok:false, statusCode:503, error:'SQUARE_WEBHOOK_NOTIFICATION_URL or URL is required in production for Square signature verification.' };
  const payload = url ? url + body : body;
  const expected = crypto.createHmac('sha256', key).update(payload).digest('base64');
  const a = Buffer.from(sig); const b = Buffer.from(expected);
  if(a.length !== b.length || !crypto.timingSafeEqual(a,b)) return { ok:false, statusCode:401, error:'Invalid Square webhook signature.' };
  return { ok:true, mode:'square-hmacsha256' };
}
exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return jsonResponse(204, {});
  if(event.httpMethod !== 'POST') return jsonResponse(405, { ok:false, error:'Method not allowed.' });
  const verified = verifySquareSignature(event);
  if(!verified.ok) return jsonResponse(verified.statusCode || 401, { ok:false, error:verified.error });
  let body = {};
  try{ body = event.body ? JSON.parse(event.body) : {}; }catch(_){ return jsonResponse(400, { ok:false, error:'Invalid JSON body.' }); }
  const orgId = clean(body.orgId || body.merchant_id || body.merchantId) || 'default-org';
  const eventId = clean(body.event_id || body.eventId || body.id || body.payload && body.payload.id);
  if(!eventId) return jsonResponse(400, { ok:false, error:'Square webhook event id is required for replay protection.' });
  const state = readOrgState(orgId);
  if(hasReplayEvent(state, 'square', eventId)) return jsonResponse(409, { ok:false, error:'Duplicate Square webhook event denied.', eventId });
  const rows = normalizeSquareWebhook(body);
  recordReplayEvent(state, 'square', eventId, { type: clean(body.eventType || body.type || 'square.webhook'), signatureMode: verified.mode });
  pushEvent(state, { kind:'square_webhook_accepted', note:'Square webhook accepted after signature and replay checks.', detail:{ eventId, signatureMode:verified.mode } });
  const job = queueJob(state, { type:'webhook-job', source:'square', eventType: clean(body.eventType || body.type || 'square.webhook'), eventId, payload: body.payload || body, rowsPreview: rows.slice(0, 1), signatureMode:verified.mode, status:'queued' });
  const { saved } = await persistOrgState(orgId, state, { eventKind:'v83_route_persist', sourceLane:'v83-route', note:'Route state persisted.' });
  return jsonResponse(200, { ok:true, jobId: job.id, orgId: saved.orgId, revision: saved.revision, signatureMode:verified.mode, queuedJobs: saved.jobs.filter((row) => row.status !== 'completed').length, summary: bundlePushSummary(saved.bundle) });
};
