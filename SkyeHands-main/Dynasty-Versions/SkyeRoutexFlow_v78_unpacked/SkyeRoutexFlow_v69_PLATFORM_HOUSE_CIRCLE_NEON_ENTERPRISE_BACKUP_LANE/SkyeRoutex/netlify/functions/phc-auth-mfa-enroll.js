const { readOrgState, saveOrgState, clean, compact, upsertDevice, pushEvent } = require('./_lib/housecircle-cloud-store');
const { verifySessionToken, extractBearer } = require('./_lib/housecircle-auth');
const { randomBase32, generateRecoveryCodes, buildOtpAuthUrl, upsertMfaRecord, sanitizeMfaRecord } = require('./_lib/housecircle-mfa');

function cors(){ return { 'content-type':'application/json', 'cache-control':'no-store', 'access-control-allow-origin':'*', 'access-control-allow-headers':'content-type, authorization', 'access-control-allow-methods':'POST,OPTIONS' }; }

exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:cors(), body:'' };
  if(event.httpMethod !== 'POST') return { statusCode:405, headers:cors(), body: JSON.stringify({ ok:false, error:'Method not allowed.' }) };
  const guard = verifySessionToken(extractBearer(event.headers || {}));
  if(!guard.ok) return { statusCode:401, headers:cors(), body: JSON.stringify({ ok:false, error: guard.error }) };
  const body = event.body ? JSON.parse(event.body) : {};
  const orgId = clean(body.orgId) || clean(guard.payload.orgId) || 'default-org';
  const operatorId = clean(body.operatorId) || clean(guard.payload.operatorId) || 'founder-admin';
  const operatorName = compact(body.operatorName) || compact(guard.payload.operatorName) || 'Skyes Over London';
  const state = readOrgState(orgId);
  const rotate = !!body.rotate;
  const existing = state.mfa && state.mfa[operatorId];
  const secret = rotate || !existing || !existing.secret ? randomBase32(32) : existing.secret;
  const recoveries = rotate || !existing || !existing.recoveryHashes ? generateRecoveryCodes(8) : { plain: [], hashes: existing.recoveryHashes };
  const record = upsertMfaRecord(state, {
    operatorId,
    operatorName,
    label: compact(body.label) || (operatorName + ' · ' + orgId),
    issuer: 'SkyeRoutexFlow',
    secret,
    recoveryHashes: recoveries.hashes,
    recoveryUsed: rotate ? [] : (existing && existing.recoveryUsed) || [],
    enabled: rotate ? false : !!(existing && existing.enabled),
    lastVerifiedAt: rotate ? '' : clean(existing && existing.lastVerifiedAt),
    enrolledAt: new Date().toISOString()
  });
  upsertDevice(state, {
    id: clean(body.deviceId) || clean(guard.payload.deviceId) || 'browser-device',
    operatorId,
    operatorName,
    trusted: !!(existing && existing.enabled),
    platform: compact(body.platform),
    userAgent: compact(body.userAgent)
  });
  pushEvent(state, { kind:'mfa_enroll', note:'MFA enrollment prepared.', detail:{ operatorId, rotate } });
  const saved = saveOrgState(orgId, state);
  return { statusCode:200, headers:cors(), body: JSON.stringify({ ok:true, orgId, operatorId, record: sanitizeMfaRecord(record), secret, otpAuthUrl: buildOtpAuthUrl({ issuer:'SkyeRoutexFlow', label: record.label, secret }), recoveryCodes: recoveries.plain, revision: saved.revision }) };
};
