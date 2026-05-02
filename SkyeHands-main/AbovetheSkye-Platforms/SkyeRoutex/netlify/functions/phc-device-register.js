const { saveOrgState, clean, compact, upsertDevice, listDevices, pushEvent } = require('./_lib/housecircle-cloud-store');
const { requireAuth, authErrorResponse, jsonResponse } = require('./_lib/housecircle-auth');
const { persistOrgState } = require('./_lib/housecircle-persistence');
exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return jsonResponse(204, {});
  let body = {};
  try{ body = event.body ? JSON.parse(event.body) : {}; }catch(_){ return jsonResponse(400, { ok:false, error:'Invalid JSON body.' }); }
  const guard = requireAuth(event, { body, permission:event.httpMethod === 'POST' ? 'manage:auth' : 'view:org' });
  if(!guard.ok) return authErrorResponse(guard);
  const orgId = guard.orgId;
  const state = guard.state;
  if(event.httpMethod === 'GET') return jsonResponse(200, { ok:true, orgId, devices: listDevices(state) });
  if(event.httpMethod !== 'POST') return jsonResponse(405, { ok:false, error:'Method not allowed.' });
  const device = upsertDevice(state, { id: clean(body.deviceId) || clean(guard.payload.deviceId), operatorId: clean(body.operatorId) || clean(guard.payload.operatorId), operatorName: compact(body.operatorName) || compact(guard.payload.operatorName), label: compact(body.label), platform: compact(body.platform), userAgent: compact(body.userAgent), fingerprint: compact(body.fingerprint), trusted: body.trusted === undefined ? false : !!body.trusted, lastSeenAt: new Date().toISOString() });
  pushEvent(state, { kind:'device_register', note:'Device registered or refreshed.', detail:{ deviceId: device.id, trusted: device.trusted } });
  const { saved } = await persistOrgState(orgId, state, { eventKind:'v83_route_persist', sourceLane:'v83-route', note:'Route state persisted.' });
  return jsonResponse(200, { ok:true, orgId, device, devices:listDevices(saved), revision:saved.revision });
};
