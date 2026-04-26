const { readOrgState, saveOrgState, clean, compact, nowISO, num, upsertDevice, pushEvent } = require('./_lib/housecircle-cloud-store');
const { issueSession } = require('./_lib/housecircle-auth');
const { corsHeaders } = require('./_lib/housecircle-cors');
const rateLimit = require('./_lib/housecircle-rate-limit');

exports.handler = async function(event){
  const cors = (methods) => corsHeaders(event, methods);
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:cors('POST,OPTIONS'), body:'' };
  if(event.httpMethod !== 'POST') return { statusCode:405, headers:cors(), body: JSON.stringify({ ok:false, error:'Method not allowed.' }) };

  let body;
  try { body = event.body ? JSON.parse(event.body) : {}; }
  catch(_) { return { statusCode:400, headers:cors(), body: JSON.stringify({ ok:false, error:'Invalid JSON body.' }) }; }

  const orgId = clean(body.orgId) || 'default-org';

  // SEC-03: rate limit by IP + orgId
  const rl = rateLimit.check(event, orgId);
  if(rl.limited) return { statusCode:429, headers:{ ...cors(), 'retry-after': String(rl.retryAfterSec) }, body: JSON.stringify({ ok:false, error:'Too many login attempts. Please wait before retrying.', retryAfterSec: rl.retryAfterSec }) };

  const state = readOrgState(orgId);
  let issued;
  try { issued = issueSession({ orgId, operatorId: body.operatorId, operatorName: body.operatorName, role: body.role, deviceId: body.deviceId }); }
  catch(err) { return { statusCode:400, headers:cors(), body: JSON.stringify({ ok:false, error: clean(err.message) || 'Session issue failed.' }) }; }

  const mfaRecord = state.mfa && state.mfa[clean(issued.payload.operatorId)];
  const device = upsertDevice(state, { id: clean(body.deviceId) || clean(issued.payload.deviceId), operatorId: issued.payload.operatorId, operatorName: issued.payload.operatorName, trusted: !!(mfaRecord && mfaRecord.enabled), lastSeenAt: nowISO(), platform: compact(body.platform), userAgent: compact(body.userAgent), label: compact(body.deviceLabel) });

  // SEC-08: tokenPreview removed — partial token fragments in stored state are a security anti-pattern.
  const session = { ...issued.payload, updatedAt: nowISO(), mfaEnabled: !!(mfaRecord && mfaRecord.enabled), trustedDevice: !!device.trusted };
  state.sessions = [session].concat((state.sessions || []).filter((row) => clean(row.sid) !== clean(session.sid))).slice(0, num(process.env.PHC_SESSION_STORE_LIMIT) || 80);
  state.metrics.logins = num(state.metrics && state.metrics.logins) + 1;
  pushEvent(state, { kind:'login', note:'Cloud operator login issued.', detail:{ operatorId: session.operatorId, deviceId: device.id, mfaEnabled: session.mfaEnabled } });
  saveOrgState(orgId, state);
  return { statusCode:200, headers:cors(), body: JSON.stringify({ ok:true, orgId, token: issued.token, session, mfaEnabled: session.mfaEnabled, trustedDevice: session.trustedDevice }) };
};
