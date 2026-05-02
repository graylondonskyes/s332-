const { clean, queueJob, readOrgState, hasReplayEvent, recordReplayEvent, pushEvent } = require('./_lib/housecircle-cloud-store');
const { persistOrgState } = require('./_lib/housecircle-persistence');
const { jsonResponse } = require('./_lib/housecircle-auth');
const { verifyPaypalWebhook } = require('./_lib/housecircle-payment-providers');
exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return jsonResponse(204, {});
  if(event.httpMethod !== 'POST') return jsonResponse(405, { ok:false, error:'Method not allowed.' });
  const verified = await verifyPaypalWebhook(event);
  if(!verified.ok) return jsonResponse(verified.statusCode || 401, { ok:false, error:verified.error, missing:verified.missing || [], verificationReady:!!verified.verificationReady });
  let body = {}; try{ body = event.body ? JSON.parse(event.body) : {}; }catch(_){ return jsonResponse(400, { ok:false, error:'Invalid JSON body.' }); }
  const orgId = clean(body.resource && body.resource.custom_id) || clean(body.orgId) || 'default-org';
  const eventId = clean(body.id); if(!eventId) return jsonResponse(400, { ok:false, error:'PayPal event id is required for replay protection.' });
  const state = readOrgState(orgId); if(hasReplayEvent(state, 'paypal', eventId)) return jsonResponse(409, { ok:false, error:'Duplicate PayPal webhook event denied.', eventId });
  recordReplayEvent(state, 'paypal', eventId, { type:clean(body.event_type), signatureMode:'paypal-server-verified' }); pushEvent(state, { kind:'paypal_webhook_accepted', note:'PayPal webhook accepted after server verification/replay checks.', detail:{ eventId, type:clean(body.event_type) } });
  const job = queueJob(state, { type:'webhook-job', source:'paypal', eventType:clean(body.event_type || 'paypal.webhook'), eventId, payload:body, signatureMode:'paypal-server-verified', status:'queued' });
  const { saved } = await persistOrgState(orgId, state, { eventKind:'paypal_webhook', sourceLane:'v83-webhook-paypal', note:'Server-verified PayPal webhook queued and persisted.' }); return jsonResponse(200, { ok:true, orgId:saved.orgId, revision:saved.revision, jobId:job.id, signatureMode:verified.mode || 'paypal-server-verified' });
};
