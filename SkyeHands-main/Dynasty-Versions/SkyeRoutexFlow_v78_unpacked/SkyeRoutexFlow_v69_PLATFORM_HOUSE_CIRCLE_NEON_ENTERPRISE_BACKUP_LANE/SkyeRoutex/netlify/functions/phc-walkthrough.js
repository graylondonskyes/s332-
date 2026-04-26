const { readOrgState, saveOrgState, clean, nowISO, addAudit } = require('./_lib/housecircle-cloud-store');
const { defaultWalkthroughRecord } = require('./_lib/housecircle-walkthrough');
const { verifySessionToken, extractBearer } = require('./_lib/housecircle-auth');

function auth(headers){ const token = extractBearer(headers || {}); return token ? verifySessionToken(token) : { ok:true, payload:null }; }

exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:{ 'access-control-allow-origin':'*', 'access-control-allow-headers':'content-type, authorization', 'access-control-allow-methods':'GET,POST,OPTIONS' }, body:'' };
  const guard = auth(event.headers || {});
  if(!guard.ok) return { statusCode:401, headers:{ 'content-type':'application/json', 'access-control-allow-origin':'*' }, body: JSON.stringify({ ok:false, error: guard.error }) };
  const q = event.queryStringParameters || {};
  const body = event.body ? JSON.parse(event.body) : {};
  const orgId = clean(q.orgId || body.orgId || (guard.payload && guard.payload.orgId) || 'default-org');
  const state = readOrgState(orgId);
  const existing = state.bundle && state.bundle.walkthroughCurrent ? state.bundle.walkthroughCurrent : null;
  if(event.httpMethod === 'GET'){
    const record = existing || defaultWalkthroughRecord({});
    return { statusCode:200, headers:{ 'content-type':'application/json', 'cache-control':'no-store', 'access-control-allow-origin':'*', 'access-control-allow-headers':'content-type, authorization' }, body: JSON.stringify({ ok:true, orgId: state.orgId, revision: state.revision, record }) };
  }
  if(event.httpMethod !== 'POST') return { statusCode:405, headers:{ 'content-type':'application/json', 'access-control-allow-origin':'*' }, body: JSON.stringify({ ok:false, error:'Method not allowed.' }) };
  const incoming = body.record && typeof body.record === 'object' ? body.record : {};
  const record = defaultWalkthroughRecord({ ...incoming, generatedAt: nowISO() });
  state.bundle.walkthroughCurrent = record;
  state.bundle.walkthroughRecords = [record].concat((state.bundle.walkthroughRecords || []).filter((row) => clean(row.generatedAt) !== clean(record.generatedAt))).slice(0, 24);
  addAudit(state.bundle, 'walkthrough-sync', body.reason || 'Walkthrough record synced.', { sectionCount: record.sectionCount, version: record.version, asOf: record.asOf });
  const saved = saveOrgState(orgId, state);
  return { statusCode:200, headers:{ 'content-type':'application/json', 'cache-control':'no-store', 'access-control-allow-origin':'*', 'access-control-allow-headers':'content-type, authorization' }, body: JSON.stringify({ ok:true, orgId: saved.orgId, revision: saved.revision, record }) };
};
