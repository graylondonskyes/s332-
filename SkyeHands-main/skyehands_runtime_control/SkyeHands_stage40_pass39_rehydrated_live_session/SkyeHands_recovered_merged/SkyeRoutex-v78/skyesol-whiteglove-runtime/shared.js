
/* skyesol-whiteglove-runtime shared helpers v50 */
const DEFAULT_STORES = {
  serviceProfiles: [],
  bookings: [],
  bookingRequests: [],
  memberships: [],
  membershipLedger: [],
  dispatchAvailability: [],
  dispatchEvents: [],
  payments: [],
  payouts: [],
  incidents: [],
  syncQueue: []
};
const STATE = globalThis.__SKYESOL_WHITEGLOVE_RUNTIME__ || (globalThis.__SKYESOL_WHITEGLOVE_RUNTIME__ = {
  stores: clone(DEFAULT_STORES)
});
function iso(){ return new Date().toISOString(); }
function uid(prefix){ return String(prefix || 'id') + '_' + Math.random().toString(36).slice(2,9) + '_' + Date.now().toString(36); }
function json(body, status, extraHeaders){
  return { statusCode: status || 200, headers: Object.assign({ 'content-type':'application/json' }, extraHeaders || {}), body: JSON.stringify(body, null, 2) };
}
function html(body, status){
  return { statusCode: status || 200, headers: { 'content-type':'text/html; charset=utf-8' }, body };
}
function clean(v){ return String(v == null ? '' : v).trim(); }
function toNum(v, fallback){ const n = Number(v); return Number.isFinite(n) ? n : Number(fallback || 0); }
function clone(v){ return JSON.parse(JSON.stringify(v)); }
function parseBody(request){
  const raw = request && request.body;
  if(raw == null) return {};
  if(typeof raw === 'object') return raw;
  try{ return JSON.parse(String(raw)); }catch(_){ return {}; }
}
function getStore(name){ if(!STATE.stores[name]) STATE.stores[name] = []; return STATE.stores[name]; }
function replaceStore(name, rows){ STATE.stores[name] = Array.isArray(rows) ? rows : []; return STATE.stores[name]; }
function pushStore(name, row, limit){ const rows = getStore(name); rows.unshift(row); if(limit && rows.length > limit) rows.length = limit; return row; }
function findById(name, id){ return getStore(name).find(row => clean(row.id) === clean(id)) || null; }
function updateById(name, id, mutator){
  const rows = getStore(name);
  let found = null;
  const next = rows.map(row => {
    if(clean(row.id) !== clean(id)) return row;
    const draft = Object.assign({}, row);
    found = (mutator ? (mutator(draft) || draft) : draft);
    return found;
  });
  replaceStore(name, next);
  return found;
}
function pick(obj, keys){ const out = {}; keys.forEach(k => { if(obj && Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k]; }); return out; }
function requireFields(obj, fields){ return fields.filter(f => clean(obj && obj[f]) === ''); }
function methodNotAllowed(method, allowed){ return json({ ok:false, error:'method_not_allowed', method, allowed }, 405); }
function notFound(service, method, path){ return json({ ok:false, service, error:'not_found', method, path }, 404); }
function badRequest(service, message, extra){ return json(Object.assign({ ok:false, service, error:'bad_request', message }, extra || {}), 400); }
function unauthorized(service){ return json({ ok:false, service, error:'unauthorized' }, 401); }
function checkToken(request, service){
  const expected = clean((typeof process !== 'undefined' && process.env && process.env.SKY_WHITEGLOVE_SHARED_TOKEN) || '');
  if(!expected) return null;
  const headerToken = clean(request && request.headers && (request.headers['x-skyesol-token'] || request.headers['X-SkyeSol-Token']));
  if(headerToken && headerToken === expected) return null;
  return unauthorized(service);
}
function responseEnvelope(service, data){ return Object.assign({ ok:true, service, now:iso() }, data || {}); }
function listStoreNames(){ return Object.keys(DEFAULT_STORES); }
function resetStores(){ STATE.stores = clone(DEFAULT_STORES); return STATE.stores; }
function ensureArrayRows(value){ return Array.isArray(value) ? value.filter(Boolean).map(row => typeof row === 'object' && row ? row : {}) : []; }
function summarizeRows(rows){
  const ids = new Set();
  let duplicates = 0;
  ensureArrayRows(rows).forEach(row => {
    const id = clean(row.id);
    if(!id) return;
    if(ids.has(id)) duplicates += 1;
    ids.add(id);
  });
  return { rows: ensureArrayRows(rows).length, distinctIds: ids.size, duplicateIds: duplicates };
}
function mergeRowsById(existingRows, incomingRows, mode){
  const existing = ensureArrayRows(existingRows);
  const incoming = ensureArrayRows(incomingRows);
  if(mode === 'replace') return clone(incoming);
  const seen = new Map();
  existing.forEach(row => { const id = clean(row.id) || uid('anon'); seen.set(id, Object.assign({}, row, { id })); });
  incoming.forEach(row => {
    const id = clean(row.id) || uid('anon');
    const prior = seen.get(id) || { id };
    seen.set(id, Object.assign({}, prior, row, { id }));
  });
  return Array.from(seen.values());
}

function compareIso(a, b){ const aa = clean(a); const bb = clean(b); if(!aa && !bb) return 0; if(!aa) return -1; if(!bb) return 1; return aa === bb ? 0 : (aa > bb ? 1 : -1); }
function mergeRowsByPolicy(existingRows, incomingRows, policy){
  const existing = ensureArrayRows(existingRows); const incoming = ensureArrayRows(incomingRows);
  if(policy === 'replace') return clone(incoming);
  const seen = new Map();
  existing.forEach(row => { const id = clean(row.id) || uid('anon'); seen.set(id, Object.assign({}, row, { id })); });
  incoming.forEach(row => {
    const id = clean(row.id) || uid('anon');
    const prior = seen.get(id);
    if(!prior){ seen.set(id, Object.assign({}, row, { id })); return; }
    if(policy === 'keep_existing') return;
    if(policy === 'merge_newer'){
      const cmp = compareIso(row.updatedAt || row.createdAt || row.savedAt, prior.updatedAt || prior.createdAt || prior.savedAt);
      if(cmp >= 0) seen.set(id, Object.assign({}, prior, row, { id }));
      return;
    }
    seen.set(id, Object.assign({}, prior, row, { id }));
  });
  return Array.from(seen.values());
}

function resolveRowsByMergePlan(existingRows, planRows, idField){
  const rows = ensureArrayRows(existingRows).map(row => Object.assign({}, row));
  const plans = ensureArrayRows(planRows);
  plans.forEach(plan => {
    if(clean(plan.type) !== 'service_profile_merge') return;
    const survivorId = clean(plan.survivorId);
    const absorbIds = ensureArrayRows(plan.absorbIds || []).map(item => typeof item === 'string' ? item : clean(item));
    rows.forEach(row => {
      const key = clean(row[idField || 'serviceProfileId']);
      if(absorbIds.includes(key)) row[idField || 'serviceProfileId'] = survivorId;
    });
  });
  return rows;
}
module.exports = { STATE, DEFAULT_STORES, iso, uid, json, html, clean, toNum, clone, parseBody, getStore, replaceStore, pushStore, findById, updateById, pick, requireFields, methodNotAllowed, notFound, badRequest, unauthorized, checkToken, responseEnvelope, listStoreNames, resetStores, ensureArrayRows, summarizeRows, mergeRowsById, compareIso, mergeRowsByPolicy, resolveRowsByMergePlan };


