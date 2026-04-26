const { readOrgState, saveOrgState, mergeBundles, bundlePushSummary, clean, compact, addAudit, num } = require('./_lib/housecircle-cloud-store');
const { verifySessionToken, extractBearer } = require('./_lib/housecircle-auth');
const { corsHeaders } = require('./_lib/housecircle-cors');

function auth(headers){ const token = extractBearer(headers || {}); return token ? verifySessionToken(token) : { ok:true, payload:null }; }

exports.handler = async function(event){
  const cors = (m) => corsHeaders(event, m || 'GET,POST,OPTIONS');
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:cors(), body:'' };
  const guard = auth(event.headers || {});
  if(!guard.ok) return { statusCode:401, headers:cors(), body: JSON.stringify({ ok:false, error: guard.error }) };
  if(event.httpMethod === 'GET'){
    const orgId = clean(event.queryStringParameters && event.queryStringParameters.orgId) || clean(guard.payload && guard.payload.orgId) || 'default-org';
    const state = readOrgState(orgId);
    state.metrics.pulls = num(state.metrics && state.metrics.pulls) + 1;
    saveOrgState(orgId, state);
    return { statusCode:200, headers:cors(), body: JSON.stringify({ ok:true, orgId: state.orgId, revision: state.revision, updatedAt: state.updatedAt, bundle: state.bundle, summary: bundlePushSummary(state.bundle) }) };
  }
  if(event.httpMethod !== 'POST') return { statusCode:405, headers:cors(), body: JSON.stringify({ ok:false, error:'Method not allowed.' }) };
  const body = event.body ? JSON.parse(event.body) : {};
  const orgId = clean(body.orgId) || clean(guard.payload && guard.payload.orgId) || 'default-org';
  const state = readOrgState(orgId);
  const incoming = body.bundle && typeof body.bundle === 'object' ? body.bundle : {};
  const baseRevision = clean(body.baseRevision);
  const mergeMode = compact(body.mergeMode || 'auto');
  const conflict = !!baseRevision && baseRevision !== state.revision;
  state.bundle = (!conflict && mergeMode === 'replace') ? incoming : mergeBundles(state.bundle, incoming);
  addAudit(state.bundle, 'cloud-sync-push', body.reason || 'Snapshot pushed to server.', { baseRevision, previousRevision: state.revision, conflict, mergeMode });
  state.metrics.pushes = num(state.metrics && state.metrics.pushes) + 1;
  const saved = saveOrgState(orgId, state);
  return { statusCode:200, headers:cors(), body: JSON.stringify({ ok:true, orgId: saved.orgId, revision: saved.revision, previousRevision: state.revision, conflict, mergeMode, summary: bundlePushSummary(saved.bundle) }) };
};
