const { readOrgState, saveOrgState, clean, compact, upsertDevice, pushEvent } = require('./_lib/housecircle-cloud-store');
const { verifySessionToken, extractBearer } = require('./_lib/housecircle-auth');
const { verifyTotp, verifyRecoveryCode, upsertMfaRecord, sanitizeMfaRecord } = require('./_lib/housecircle-mfa');

function cors(){ return { 'content-type':'application/json', 'cache-control':'no-store', 'access-control-allow-origin':'*', 'access-control-allow-headers':'content-type, authorization', 'access-control-allow-methods':'POST,OPTIONS' }; }

exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:cors(), body:'' };
  if(event.httpMethod !== 'POST') return { statusCode:405, headers:cors(), body: JSON.stringify({ ok:false, error:'Method not allowed.' }) };
  const guard = verifySessionToken(extractBearer(event.headers || {}));
  if(!guard.ok) return { statusCode:401, headers:cors(), body: JSON.stringify({ ok:false, error: guard.error }) };
  const body = event.body ? JSON.parse(event.body) : {};
  const orgId = clean(body.orgId) || clean(guard.payload.orgId) || 'default-org';
  const operatorId = clean(body.operatorId) || clean(guard.payload.operatorId) || 'founder-admin';
  const state = readOrgState(orgId);
  const record = state.mfa && state.mfa[operatorId];
  if(!record || !record.secret) return { statusCode:404, headers:cors(), body: JSON.stringify({ ok:false, error:'No MFA enrollment found for this operator.' }) };
  const deviceId = clean(body.deviceId) || clean(guard.payload.deviceId) || 'browser-device';
  const trustDevice = !!body.trustDevice;
  let verified = false;
  let via = 'totp';
  if(clean(body.recoveryCode)){
    via = 'recovery';
    const recovery = verifyRecoveryCode(record, body.recoveryCode);
    if(!recovery.ok) return { statusCode:401, headers:cors(), body: JSON.stringify({ ok:false, error: recovery.used ? 'Recovery code already used.' : 'Recovery code invalid.' }) };
    record.recoveryUsed = (record.recoveryUsed || []).concat([recovery.hash]);
    verified = true;
  } else {
    const test = verifyTotp(record.secret, body.code, { window: 1 });
    if(!test.ok) return { statusCode:401, headers:cors(), body: JSON.stringify({ ok:false, error:'Verification code invalid.' }) };
    verified = true;
  }
  if(verified){
    const next = upsertMfaRecord(state, { ...record, enabled:true, lastVerifiedAt:new Date().toISOString() });
    const device = upsertDevice(state, {
      id: deviceId,
      operatorId,
      operatorName: compact(record.operatorName) || compact(guard.payload.operatorName),
      trusted: trustDevice || !!body.recoveryCode,
      trustSource: via,
      trustedAt: new Date().toISOString(),
      platform: compact(body.platform),
      userAgent: compact(body.userAgent)
    });
    pushEvent(state, { kind:'mfa_verify', note:'MFA verification completed.', detail:{ operatorId, via, trustDevice: device.trusted } });
    const saved = saveOrgState(orgId, state);
    return { statusCode:200, headers:cors(), body: JSON.stringify({ ok:true, orgId, operatorId, via, trustedDevice: !!device.trusted, record: sanitizeMfaRecord(next), revision: saved.revision }) };
  }
  return { statusCode:401, headers:cors(), body: JSON.stringify({ ok:false, error:'Verification failed.' }) };
};
