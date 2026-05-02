const { readOrgState, saveOrgState, clean, compact, nowISO, num, upsertDevice, pushEvent } = require('./_lib/housecircle-cloud-store');
const { issueSession, authenticateOperator, jsonResponse, tokenHash } = require('./_lib/housecircle-auth');
const { persistOrgState } = require('./_lib/housecircle-persistence');

exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return jsonResponse(204, {});
  if(event.httpMethod !== 'POST') return jsonResponse(405, { ok:false, error:'Method not allowed.' });
  let body = {};
  try{ body = event.body ? JSON.parse(event.body) : {}; }catch(_){ return jsonResponse(400, { ok:false, error:'Invalid JSON body.' }); }
  const orgId = clean(body.orgId) || 'default-org';
  const state = readOrgState(orgId);
  const credential = authenticateOperator(body, state);
  if(!credential.ok) return jsonResponse(credential.statusCode || 401, { ok:false, error:credential.error });
  let issued;
  try{
    issued = issueSession({ orgId, operatorId: credential.operator.operatorId, operatorName: credential.operator.operatorName, role: credential.operator.role, deviceId: body.deviceId });
  }catch(err){
    return jsonResponse(503, { ok:false, error: clean(err && err.message) || 'Session signing is not configured.' });
  }
  const mfaRecord = state.mfa && state.mfa[clean(issued.payload.operatorId)];
  const existingDevice = (state.devices || []).find((row) => clean(row.id) === (clean(body.deviceId) || clean(issued.payload.deviceId)));
  const mfaEnabled = !!(mfaRecord && mfaRecord.enabled);
  const sessionTrusted = mfaEnabled ? !!(existingDevice && existingDevice.trusted) : true;
  const device = upsertDevice(state, { id: clean(body.deviceId) || clean(issued.payload.deviceId), operatorId: issued.payload.operatorId, operatorName: issued.payload.operatorName, trusted: sessionTrusted, lastSeenAt: nowISO(), platform: compact(body.platform), userAgent: compact(body.userAgent), label: compact(body.deviceLabel) });
  const session = { ...issued.payload, tokenHash: tokenHash(issued.token), tokenPreview: issued.token.slice(0, 16) + '…', updatedAt: nowISO(), mfaEnabled, mfaRequired: !!(mfaEnabled && !sessionTrusted), trustedDevice: !!sessionTrusted, credentialMode: credential.credentialMode };
  state.sessions = [session].concat((state.sessions || []).filter((row) => clean(row.sid) !== clean(session.sid))).slice(0, 80);
  state.metrics.logins = num(state.metrics && state.metrics.logins) + 1;
  pushEvent(state, { kind:'login', note:'Credential-verified operator login issued.', detail:{ operatorId: session.operatorId, deviceId: device.id, mfaEnabled: session.mfaEnabled, credentialMode: credential.credentialMode } });
  const { saved } = await persistOrgState(orgId, state, { eventKind:'v83_route_persist', sourceLane:'v83-route', note:'Route state persisted.' });
  return jsonResponse(200, { ok:true, orgId, revision:saved.revision, token: issued.token, session, mfaEnabled: session.mfaEnabled, mfaRequired: session.mfaRequired, trustedDevice: session.trustedDevice });
};
