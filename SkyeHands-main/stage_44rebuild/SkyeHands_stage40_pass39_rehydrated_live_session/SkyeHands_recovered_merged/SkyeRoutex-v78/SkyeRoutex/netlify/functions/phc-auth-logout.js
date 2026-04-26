// SEC-06: Token revocation endpoint.
// Adds the session ID to the org's revokedSessions list. verifySessionToken checks this list.
const { readOrgState, saveOrgState, clean, nowISO, pushEvent } = require('./_lib/housecircle-cloud-store');
const { verifySessionToken, extractBearer } = require('./_lib/housecircle-auth');
const { corsHeaders } = require('./_lib/housecircle-cors');

exports.handler = async function(event){
  const cors = (m) => corsHeaders(event, m || 'POST,OPTIONS');
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:cors(), body:'' };
  if(event.httpMethod !== 'POST') return { statusCode:405, headers:cors(), body: JSON.stringify({ ok:false, error:'Method not allowed.' }) };

  const token = extractBearer(event.headers || {});
  if(!token) return { statusCode:401, headers:cors(), body: JSON.stringify({ ok:false, error:'No token provided.' }) };

  const guard = verifySessionToken(token);
  // Allow revocation even of expired tokens — the caller may be cleaning up
  if(!guard.ok && guard.error !== 'Token expired.') {
    return { statusCode:401, headers:cors(), body: JSON.stringify({ ok:false, error: guard.error }) };
  }

  const payload = guard.payload;
  if(!payload || !payload.sid) return { statusCode:400, headers:cors(), body: JSON.stringify({ ok:false, error:'Token payload missing session ID.' }) };

  const orgId = clean(payload.orgId) || 'default-org';
  const state = readOrgState(orgId);

  // Add to revocation list; trim to last 500 entries
  state.revokedSessions = Array.from(new Set([payload.sid].concat(state.revokedSessions || []))).slice(0, 500);
  // Remove from active sessions list
  state.sessions = (state.sessions || []).filter((row) => clean(row.sid) !== payload.sid);

  pushEvent(state, { kind:'logout', note:'Session revoked.', detail:{ sid: payload.sid, operatorId: payload.operatorId, revokedAt: nowISO() } });
  saveOrgState(orgId, state);

  return { statusCode:200, headers:cors(), body: JSON.stringify({ ok:true, revoked: true, sid: payload.sid, orgId }) };
};
