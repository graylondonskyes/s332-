const { saveOrgState, clean, compact, upsertDevice, pushEvent } = require('./_lib/housecircle-cloud-store');
const { requireAuth, authErrorResponse, jsonResponse } = require('./_lib/housecircle-auth');
const { persistOrgState } = require('./_lib/housecircle-persistence');
const { randomBase32, generateRecoveryCodes, buildOtpAuthUrl, upsertMfaRecord, sanitizeMfaRecord } = require('./_lib/housecircle-mfa');

exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return jsonResponse(204, {});
  if(event.httpMethod !== 'POST') return jsonResponse(405, { ok:false, error:'Method not allowed.' });
  let body = {};
  try{ body = event.body ? JSON.parse(event.body) : {}; }catch(_){ return jsonResponse(400, { ok:false, error:'Invalid JSON body.' }); }
  const guard = requireAuth(event, { body, permission:'manage:auth' });
  if(!guard.ok) return authErrorResponse(guard);
  const orgId = guard.orgId;
  const operatorId = clean(body.operatorId) || clean(guard.payload.operatorId) || 'founder-admin';
  const operatorName = compact(body.operatorName) || compact(guard.payload.operatorName) || 'Skyes Over London';
  const state = guard.state;
  const rotate = !!body.rotate;
  const existing = state.mfa && state.mfa[operatorId];
  const secret = rotate || !existing || !existing.secret ? randomBase32(32) : existing.secret;
  const recoveries = rotate || !existing || !existing.recoveryHashes ? generateRecoveryCodes(8) : { plain: [], hashes: existing.recoveryHashes };
  const record = upsertMfaRecord(state, {
    operatorId, operatorName,
    label: compact(body.label) || (operatorName + ' · ' + orgId),
    issuer: 'SkyeRoutexFlow',
    secret,
    recoveryHashes: recoveries.hashes,
    recoveryUsed: rotate ? [] : (existing && existing.recoveryUsed) || [],
    enabled: rotate ? false : !!(existing && existing.enabled),
    lastVerifiedAt: rotate ? '' : clean(existing && existing.lastVerifiedAt),
    enrolledAt: new Date().toISOString()
  });
  upsertDevice(state, { id: clean(body.deviceId) || clean(guard.payload.deviceId) || 'browser-device', operatorId, operatorName, trusted: !!(existing && existing.enabled), platform: compact(body.platform), userAgent: compact(body.userAgent) });
  pushEvent(state, { kind:'mfa_enroll', note:'MFA enrollment prepared.', detail:{ operatorId, rotate } });
  const { saved } = await persistOrgState(orgId, state, { eventKind:'v83_route_persist', sourceLane:'v83-route', note:'Route state persisted.' });
  return jsonResponse(200, { ok:true, orgId, operatorId, record: sanitizeMfaRecord(record), secret, otpAuthUrl: buildOtpAuthUrl({ issuer:'SkyeRoutexFlow', label: record.label, secret }), recoveryCodes: recoveries.plain, revision: saved.revision });
};
