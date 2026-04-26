const { readOrgState, saveOrgState, clean, mergeBundles, mergeRows } = require('./_lib/housecircle-cloud-store');
const { extractBearer, verifySessionToken } = require('./_lib/housecircle-auth');
const { fetchLatestNeonSnapshot, getNeonHealth } = require('./_lib/housecircle-neon-store');
function auth(headers){ const token = extractBearer(headers || {}); return token ? verifySessionToken(token) : { ok:true, payload:null }; }
function mergeState(current, incoming){
  return {
    ...current,
    ...incoming,
    bundle: mergeBundles(current && current.bundle || {}, incoming && incoming.bundle || {}),
    frames: mergeRows(current && current.frames || [], incoming && incoming.frames || []).slice(0, 400),
    jobs: mergeRows(current && current.jobs || [], incoming && incoming.jobs || []).slice(0, 400),
    sessions: mergeRows(current && current.sessions || [], incoming && incoming.sessions || []).slice(0, 80),
    devices: mergeRows(current && current.devices || [], incoming && incoming.devices || []).slice(0, 200),
    locks: mergeRows(current && current.locks || [], incoming && incoming.locks || []).slice(0, 200),
    eventLog: mergeRows(current && current.eventLog || [], incoming && incoming.eventLog || []).slice(0, 400)
  };
}
exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:{ 'access-control-allow-origin':'*', 'access-control-allow-headers':'content-type, authorization', 'access-control-allow-methods':'POST,OPTIONS' }, body:'' };
  if(event.httpMethod !== 'POST') return { statusCode:405, headers:{ 'content-type':'application/json', 'access-control-allow-origin':'*' }, body: JSON.stringify({ ok:false, error:'Method not allowed.' }) };
  const guard = auth(event.headers || {});
  if(!guard.ok) return { statusCode:401, headers:{ 'content-type':'application/json', 'access-control-allow-origin':'*' }, body: JSON.stringify({ ok:false, error:guard.error }) };
  const body = event.body ? JSON.parse(event.body) : {};
  const orgId = clean(body.orgId || (guard.payload && guard.payload.orgId) || 'default-org');
  const mode = clean(body.mode || 'merge').toLowerCase();
  const latest = await fetchLatestNeonSnapshot(orgId);
  if(!latest.ok || !latest.latestSnapshot || !latest.latestSnapshot.payload){
    return { statusCode: latest.configured === false ? 503 : 404, headers:{ 'content-type':'application/json', 'access-control-allow-origin':'*' }, body: JSON.stringify({ ok:false, orgId, error: latest.reason || 'No Neon snapshot found.', neon: latest }) };
  }
  const current = readOrgState(orgId);
  const incomingState = latest.latestSnapshot.payload || {};
  const nextState = mode === 'replace' ? incomingState : mergeState(current, incomingState);
  const saved = saveOrgState(orgId, nextState);
  const health = await getNeonHealth(orgId);
  return { statusCode:200, headers:{ 'content-type':'application/json', 'cache-control':'no-store', 'access-control-allow-origin':'*', 'access-control-allow-headers':'content-type, authorization' }, body: JSON.stringify({ ok:true, orgId, revision: saved.revision, mode, restoredFromRevision: latest.latestSnapshot.revision, neon: health }) };
};
