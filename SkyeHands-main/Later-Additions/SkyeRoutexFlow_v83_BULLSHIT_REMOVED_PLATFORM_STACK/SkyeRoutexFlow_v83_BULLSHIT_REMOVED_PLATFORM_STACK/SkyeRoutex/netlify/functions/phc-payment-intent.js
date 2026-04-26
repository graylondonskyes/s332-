const { createPaymentIntent, appendPaymentLedger } = require('./_lib/housecircle-payment-providers');
const { persistOrgState } = require('./_lib/housecircle-persistence');
const { requireAuth, authErrorResponse, jsonResponse } = require('./_lib/housecircle-auth');
exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return jsonResponse(204, {});
  if(event.httpMethod !== 'POST') return jsonResponse(405, { ok:false, error:'Method not allowed.' });
  let body = {}; try{ body = event.body ? JSON.parse(event.body) : {}; }catch(_){ return jsonResponse(400, { ok:false, error:'Invalid JSON body.' }); }
  const guard = requireAuth(event, { body, permission:'write:pos', requireTrustedDevice:true });
  if(!guard.ok) return authErrorResponse(guard);
  const result = await createPaymentIntent({ ...body, orgId:guard.orgId }, { operatorId:guard.payload.operatorId });
  if(result.ledger){ appendPaymentLedger(guard.state, result.ledger); try{ await persistOrgState(guard.orgId, guard.state, { eventKind:'payment_intent', sourceLane:'v83-payment-provider', note:'Payment intent ledger persisted.' }); }catch(err){ return jsonResponse(503, { ok:false, error:'Payment ledger persistence failed.', detail:err.persistence || err.message }); } }
  return jsonResponse(result.statusCode || (result.ok ? 200 : 503), { ...result, orgId:guard.orgId, liveMoneyMoved: result.ok === true && result.execution && result.execution.ok === true });
};
