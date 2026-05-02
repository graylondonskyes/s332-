const { saveOrgState, clean, compact, upsertDevice, pushEvent } = require('./_lib/housecircle-cloud-store');
const { requireAuth, authErrorResponse, jsonResponse } = require('./_lib/housecircle-auth');
const { persistOrgState } = require('./_lib/housecircle-persistence');
const { verifyTotp, verifyRecoveryCode, upsertMfaRecord, sanitizeMfaRecord } = require('./_lib/housecircle-mfa');

exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return jsonResponse(204, {});
  if(event.httpMethod !== 'POST') return jsonResponse(405, { ok:false, error:'Method not allowed.' });
  let body = {};
  try{ body = event.body ? JSON.parse(event.body) : {}; }catch(_){ return jsonResponse(400, { ok:false, error:'Invalid JSON body.' }); }
  const guard = requireAuth(event, { body, permission:'manage:auth' });
  if(!guard.ok) return authErrorResponse(guard);
  const orgId = guard.orgId;
  const operatorId = clean(body.operatorId) || clean(guard.payload.operatorId) || 'founder-admin';
  const state = guard.state;
  const record = state.mfa && state.mfa[operatorId];
  if(!record || !record.secret) return jsonResponse(404, { ok:false, error:'No MFA enrollment found for this operator.' });
  const deviceId = clean(body.deviceId) || clean(guard.payload.deviceId) || 'browser-device';
  const trustDevice = !!body.trustDevice;
  let via = 'totp';
  if(clean(body.recoveryCode)){
    via = 'recovery';
    const recovery = verifyRecoveryCode(record, body.recoveryCode);
    if(!recovery.ok) return jsonResponse(401, { ok:false, error: recovery.used ? 'Recovery code already used.' : 'Recovery code invalid.' });
    record.recoveryUsed = (record.recoveryUsed || []).concat([recovery.hash]);
  } else {
    const test = verifyTotp(record.secret, body.code, { window: 1 });
    if(!test.ok) return jsonResponse(401, { ok:false, error:'Verification code invalid.' });
  }
  const next = upsertMfaRecord(state, { ...record, enabled:true, lastVerifiedAt:new Date().toISOString() });
  const device = upsertDevice(state, { id: deviceId, operatorId, operatorName: compact(record.operatorName) || compact(guard.payload.operatorName), trusted: trustDevice || !!body.recoveryCode, trustSource: via, trustedAt: new Date().toISOString(), platform: compact(body.platform), userAgent: compact(body.userAgent) });
  pushEvent(state, { kind:'mfa_verify', note:'MFA verification completed.', detail:{ operatorId, via, trustDevice: device.trusted } });
  const { saved } = await persistOrgState(orgId, state, { eventKind:'v83_route_persist', sourceLane:'v83-route', note:'Route state persisted.' });
  return jsonResponse(200, { ok:true, orgId, operatorId, via, trustedDevice: !!device.trusted, record: sanitizeMfaRecord(next), revision: saved.revision });
};
