const { readOrgState, saveOrgState, clean, compact, nowISO, num, upsertDevice, pushEvent } = require('./_lib/housecircle-cloud-store');
const { issueSession } = require('./_lib/housecircle-auth');

exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:{ 'access-control-allow-origin':'*', 'access-control-allow-headers':'content-type, authorization', 'access-control-allow-methods':'POST,OPTIONS' }, body:'' };
  if(event.httpMethod !== 'POST') return { statusCode:405, headers:{ 'content-type':'application/json', 'access-control-allow-origin':'*' }, body: JSON.stringify({ ok:false, error:'Method not allowed.' }) };
  const body = event.body ? JSON.parse(event.body) : {};
  const orgId = clean(body.orgId) || 'default-org';
  const state = readOrgState(orgId);
  const issued = issueSession({ orgId, operatorId: body.operatorId, operatorName: body.operatorName, role: body.role, deviceId: body.deviceId });
  const mfaRecord = state.mfa && state.mfa[clean(issued.payload.operatorId)];
  const device = upsertDevice(state, { id: clean(body.deviceId) || clean(issued.payload.deviceId), operatorId: issued.payload.operatorId, operatorName: issued.payload.operatorName, trusted: !!(mfaRecord && mfaRecord.enabled), lastSeenAt: nowISO(), platform: compact(body.platform), userAgent: compact(body.userAgent), label: compact(body.deviceLabel) });
  const session = { ...issued.payload, tokenPreview: issued.token.slice(0, 16) + '…', updatedAt: nowISO(), mfaEnabled: !!(mfaRecord && mfaRecord.enabled), trustedDevice: !!device.trusted };
  state.sessions = [session].concat((state.sessions || []).filter((row) => clean(row.sid) !== clean(session.sid))).slice(0, 80);
  state.metrics.logins = num(state.metrics && state.metrics.logins) + 1;
  pushEvent(state, { kind:'login', note:'Cloud operator login issued.', detail:{ operatorId: session.operatorId, deviceId: device.id, mfaEnabled: session.mfaEnabled } });
  saveOrgState(orgId, state);
  return { statusCode:200, headers:{ 'content-type':'application/json', 'cache-control':'no-store', 'access-control-allow-origin':'*', 'access-control-allow-headers':'content-type, authorization' }, body: JSON.stringify({ ok:true, orgId, token: issued.token, session, mfaEnabled: session.mfaEnabled, trustedDevice: session.trustedDevice }) };
};
