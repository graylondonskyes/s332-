const { readOrgState, saveOrgState, clean, mergeBundles, mergeRows } = require('./_lib/housecircle-cloud-store');
const { requireAuth, authErrorResponse, jsonResponse } = require('./_lib/housecircle-auth');
const { fetchLatestNeonSnapshot, getNeonHealth } = require('./_lib/housecircle-neon-store');
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
  if(event.httpMethod === 'OPTIONS') return jsonResponse(204, {});
  if(event.httpMethod !== 'POST') return jsonResponse(405, { ok:false, error:'Method not allowed.' });
  let body = {};
  try{ body = event.body ? JSON.parse(event.body) : {}; }catch(_){ return jsonResponse(400, { ok:false, error:'Invalid JSON body.' }); }
  const guard = requireAuth(event, { body, permission:'write:neon', requireTrustedDevice:true });
  if(!guard.ok) return authErrorResponse(guard);
  const orgId = clean(body.orgId || (guard.payload && guard.payload.orgId) || 'default-org');
  const mode = clean(body.mode || 'merge').toLowerCase();
  const latest = await fetchLatestNeonSnapshot(orgId);
  if(!latest.ok || !latest.latestSnapshot || !latest.latestSnapshot.payload){
    return jsonResponse( latest.configured === false ? 503 : 404, { ok:false, orgId, error: latest.reason || 'No Neon snapshot found.', neon: latest });
  }
  const current = readOrgState(orgId);
  const incomingState = latest.latestSnapshot.payload || {};
  const nextState = mode === 'replace' ? incomingState : mergeState(current, incomingState);
  const saved = saveOrgState(orgId, nextState);
  const health = await getNeonHealth(orgId);
  return jsonResponse(200, { ok:true, orgId, revision: saved.revision, mode, restoredFromRevision: latest.latestSnapshot.revision, neon: health });
};
