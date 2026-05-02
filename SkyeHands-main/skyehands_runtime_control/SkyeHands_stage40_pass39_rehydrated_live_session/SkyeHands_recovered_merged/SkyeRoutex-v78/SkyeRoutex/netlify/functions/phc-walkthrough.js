const { readOrgState, saveOrgState, clean, nowISO, addAudit } = require('./_lib/housecircle-cloud-store');
const { defaultWalkthroughRecord } = require('./_lib/housecircle-walkthrough');
const { verifySessionToken, extractBearer } = require('./_lib/housecircle-auth');
const { corsHeaders } = require('./_lib/housecircle-cors');

function auth(headers){ const token = extractBearer(headers || {}); return token ? verifySessionToken(token) : { ok:true, payload:null }; }

exports.handler = async function(event){
  const cors = (m) => corsHeaders(event, m || 'GET,POST,OPTIONS');
  if(event.httpMethod === 'OPTIONS') return { statusCode:204, headers:cors(), body:'' };
  const guard = auth(event.headers || {});
  if(!guard.ok) return { statusCode:401, headers:cors(), body: JSON.stringify({ ok:false, error: guard.error }) };
  const q = event.queryStringParameters || {};
  const body = event.body ? JSON.parse(event.body) : {};
  const orgId = clean(q.orgId || body.orgId || (guard.payload && guard.payload.orgId) || 'default-org');
  const state = readOrgState(orgId);
  const existing = state.bundle && state.bundle.walkthroughCurrent ? state.bundle.walkthroughCurrent : null;
  if(event.httpMethod === 'GET'){
    const record = existing || defaultWalkthroughRecord({});
    return { statusCode:200, headers:cors(), body: JSON.stringify({ ok:true, orgId: state.orgId, revision: state.revision, record }) };
  }
  if(event.httpMethod !== 'POST') return { statusCode:405, headers:cors(), body: JSON.stringify({ ok:false, error:'Method not allowed.' }) };
  const incoming = body.record && typeof body.record === 'object' ? body.record : {};
  const record = defaultWalkthroughRecord({ ...incoming, generatedAt: nowISO() });
  state.bundle.walkthroughCurrent = record;
  state.bundle.walkthroughRecords = [record].concat((state.bundle.walkthroughRecords || []).filter((row) => clean(row.generatedAt) !== clean(record.generatedAt))).slice(0, 24);
  addAudit(state.bundle, 'walkthrough-sync', body.reason || 'Walkthrough record synced.', { sectionCount: record.sectionCount, version: record.version, asOf: record.asOf });
  const saved = saveOrgState(orgId, state);
  return { statusCode:200, headers:cors(), body: JSON.stringify({ ok:true, orgId: saved.orgId, revision: saved.revision, record }) };
};
