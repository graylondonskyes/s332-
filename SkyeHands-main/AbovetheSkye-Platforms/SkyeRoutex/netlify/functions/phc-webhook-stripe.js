const { clean, queueJob, readOrgState, hasReplayEvent, recordReplayEvent, pushEvent } = require('./_lib/housecircle-cloud-store');
const { persistOrgState } = require('./_lib/housecircle-persistence');
const { jsonResponse } = require('./_lib/housecircle-auth');
const { verifyStripeSignature } = require('./_lib/housecircle-payment-providers');
exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return jsonResponse(204, {});
  if(event.httpMethod !== 'POST') return jsonResponse(405, { ok:false, error:'Method not allowed.' });
  const verified = verifyStripeSignature(event);
  if(!verified.ok) return jsonResponse(verified.statusCode || 401, { ok:false, error:verified.error });
  let body = {}; try{ body = event.body ? JSON.parse(event.body) : {}; }catch(_){ return jsonResponse(400, { ok:false, error:'Invalid JSON body.' }); }
  const orgId = clean(body.data && body.data.object && body.data.object.metadata && body.data.object.metadata.orgId) || clean(body.orgId) || 'default-org';
  const eventId = clean(body.id); if(!eventId) return jsonResponse(400, { ok:false, error:'Stripe event id is required for replay protection.' });
  const state = readOrgState(orgId); if(hasReplayEvent(state, 'stripe', eventId)) return jsonResponse(409, { ok:false, error:'Duplicate Stripe webhook event denied.', eventId });
  recordReplayEvent(state, 'stripe', eventId, { type:clean(body.type), signatureMode:verified.mode }); pushEvent(state, { kind:'stripe_webhook_accepted', note:'Stripe webhook accepted after signature/replay checks.', detail:{ eventId, type:clean(body.type) } });
  const job = queueJob(state, { type:'webhook-job', source:'stripe', eventType:clean(body.type || 'stripe.webhook'), eventId, payload:body, signatureMode:verified.mode, status:'queued' });
  const { saved } = await persistOrgState(orgId, state, { eventKind:'stripe_webhook', sourceLane:'v83-webhook-stripe', note:'Signed Stripe webhook queued and persisted.' }); return jsonResponse(200, { ok:true, orgId:saved.orgId, revision:saved.revision, jobId:job.id, signatureMode:verified.mode });
};
