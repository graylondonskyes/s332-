const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// SEC-04: AES-256-GCM encryption at rest for org state files.
// Encryption is active only when PHC_SESSION_SECRET is set and PHC_ENCRYPT_AT_REST is not 'false'.
// In dev (no secret), files are stored as plaintext JSON (same as before).
const ENCRYPT_AT_REST = process.env.PHC_SESSION_SECRET && process.env.PHC_ENCRYPT_AT_REST !== 'false';
const CIPHER_ALG = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const MAGIC = 'PHC_ENC_V1:';

function deriveEncKey(){
  // Derive a separate AES key from the session secret so they can be rotated independently.
  return crypto.createHash('sha256').update('phc-store-key:' + process.env.PHC_SESSION_SECRET).digest();
}

function encryptJSON(obj){
  if(!ENCRYPT_AT_REST) return JSON.stringify(obj, null, 2);
  const key = deriveEncKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(CIPHER_ALG, key, iv);
  const plain = Buffer.from(JSON.stringify(obj));
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: MAGIC + base64(iv) + '.' + base64(tag) + '.' + base64(ciphertext)
  return MAGIC + iv.toString('base64') + '.' + tag.toString('base64') + '.' + enc.toString('base64');
}

function decryptJSON(raw){
  if(!raw || !raw.startsWith(MAGIC)){
    // Legacy plaintext file or dev mode — parse as JSON directly
    return JSON.parse(raw);
  }
  const key = deriveEncKey();
  const parts = raw.slice(MAGIC.length).split('.');
  if(parts.length !== 3) throw new Error('Corrupt encrypted store format.');
  const iv = Buffer.from(parts[0], 'base64');
  const tag = Buffer.from(parts[1], 'base64');
  const enc = Buffer.from(parts[2], 'base64');
  const decipher = crypto.createDecipheriv(CIPHER_ALG, key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(enc), decipher.final()]);
  return JSON.parse(plain.toString('utf8'));
}

const DATA_ROOT = process.env.PHC_DATA_DIR || path.join(__dirname, '..', '..', '.phc_data');
const ARRAY_KEYS = [
  'operators','joinPackets','checkins','posTickets','audit','routeTasks','serviceCases','automationRules','playbooks','signalRuns','shifts','assignments','readinessTemplates','readinessRuns','valuationRecords','walkthroughRecords'
];
const STATE_ARRAY_KEYS = [
  'locations','guests','memberships','events','campaigns','drops','referrals','notes','tasks','timeline','accounts'
];

function clean(v){ return String(v == null ? '' : v).trim(); }
function compact(v){ return clean(v).replace(/\s+/g, ' '); }
function num(v){ const n = Number(v || 0); return Number.isFinite(n) ? n : 0; }
function listify(v){ return Array.isArray(v) ? v.filter(Boolean) : []; }
function clone(v){ return JSON.parse(JSON.stringify(v)); }
function nowISO(){ return new Date().toISOString(); }
function dayISO(){ return nowISO().slice(0,10); }
function uid(prefix){ return (prefix || 'phc') + '-' + crypto.randomBytes(6).toString('hex'); }
function safeOrgId(orgId){
  const cleaned = clean(orgId).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'default-org';
}
function ensureRoot(){
  try { fs.mkdirSync(DATA_ROOT, { recursive:true }); }
  catch(err) { console.error('[housecircle-cloud-store] ensureRoot failed:', err.message); throw err; }
}
function orgPath(orgId){ ensureRoot(); return path.join(DATA_ROOT, safeOrgId(orgId) + '.json'); }
function hashOf(value){ return crypto.createHash('sha256').update(JSON.stringify(value || {})).digest('hex'); }
function rowTs(row){
  const raw = row && (row.updatedAt || row.at || row.createdAt || row.lastSeen || row.completedAt || row.finishedAt || row.startedAt || row.date || row.exportedAt);
  const parsed = raw ? Date.parse(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}
function rowId(row){
  if(!row || typeof row !== 'object') return '';
  return clean(row.id)
    || clean(row.code)
    || clean(row.packetCode)
    || clean(row.eventId)
    || clean(row.operatorId && row.locationId ? row.operatorId + '::' + row.locationId : '')
    || clean(row.email && row.locationId ? row.email.toLowerCase() + '::' + row.locationId : '')
    || clean(row.business_email && row.business_name ? String(row.business_email).toLowerCase() + '::' + row.business_name.toLowerCase() : '');
}
function mergeRows(currentRows, incomingRows){
  const map = new Map();
  listify(currentRows).forEach((row) => {
    const next = clone(row);
    const id = rowId(next) || uid('row');
    if(!next.id) next.id = id;
    map.set(id, next);
  });
  listify(incomingRows).forEach((row) => {
    const next = clone(row);
    const id = rowId(next) || uid('row');
    if(!next.id) next.id = id;
    const existing = map.get(id);
    if(!existing){ map.set(id, next); return; }
    map.set(id, rowTs(next) >= rowTs(existing) ? { ...existing, ...next } : { ...next, ...existing });
  });
  return Array.from(map.values()).sort((a,b) => rowTs(b) - rowTs(a));
}
function mergeCoreState(currentState, incomingState){
  const out = { ...(currentState || {}), ...(incomingState || {}) };
  STATE_ARRAY_KEYS.forEach((key) => {
    out[key] = mergeRows((currentState || {})[key], (incomingState || {})[key]);
  });
  if(incomingState && incomingState.locationIndex) out.locationIndex = { ...((currentState || {}).locationIndex || {}), ...incomingState.locationIndex };
  if(incomingState && incomingState.meta) out.meta = { ...((currentState || {}).meta || {}), ...incomingState.meta };
  return out;
}
function mergeBundles(currentBundle, incomingBundle){
  const current = currentBundle && typeof currentBundle === 'object' ? clone(currentBundle) : defaultBundle('default-org');
  const incoming = incomingBundle && typeof incomingBundle === 'object' ? clone(incomingBundle) : {};
  const out = { ...current, ...incoming };
  out.state = mergeCoreState(current.state || {}, incoming.state || {});
  ARRAY_KEYS.forEach((key) => { out[key] = mergeRows(current[key], incoming[key]); });
  if(incoming.currentOperator){
    out.currentOperator = rowTs(incoming.currentOperator) >= rowTs(current.currentOperator || {}) ? incoming.currentOperator : (current.currentOperator || incoming.currentOperator);
  }
  if(incoming.liveOpsV63){
    const left = current.liveOpsV63 || {};
    const right = incoming.liveOpsV63 || {};
    out.liveOpsV63 = {
      scannerLog: mergeRows(left.scannerLog, right.scannerLog).slice(0, 300),
      adapterRuns: mergeRows(left.adapterRuns, right.adapterRuns).slice(0, 200),
      webhookInbox: mergeRows(left.webhookInbox, right.webhookInbox).slice(0, 200),
      jobs: mergeRows(left.jobs, right.jobs).slice(0, 200),
      deadJobs: mergeRows(left.deadJobs, right.deadJobs).slice(0, 200),
      syncLog: mergeRows(left.syncLog, right.syncLog).slice(0, 300),
      peers: mergeRows(left.peers, right.peers).slice(0, 30)
    };
  }
  out.version = compact(incoming.version || current.version || '66.0.0');
  out.exportedAt = nowISO();
  out.type = compact(incoming.type || current.type || 'skye-routex-platform-house-circle-v66');
  return out;
}
function defaultBundle(orgId){
  return {
    type: 'skye-routex-platform-house-circle-v66',
    version: '66.0.0',
    exportedAt: nowISO(),
    orgId: safeOrgId(orgId),
    state: { locations:[], guests:[], memberships:[], events:[], campaigns:[], drops:[], timeline:[], notes:[], tasks:[], meta:{ createdAt: nowISO() } },
    operators: [],
    currentOperator: null,
    joinPackets: [],
    checkins: [],
    posTickets: [],
    audit: [],
    routeTasks: [],
    serviceCases: [],
    automationRules: [],
    playbooks: [],
    signalRuns: [],
    shifts: [],
    assignments: [],
    readinessTemplates: [],
    readinessRuns: [],
    valuationRecords: [],
    valuationCurrent: null,
    walkthroughRecords: [],
    walkthroughCurrent: null,
    liveOpsV63: { scannerLog:[], adapterRuns:[], webhookInbox:[], jobs:[], deadJobs:[], syncLog:[], peers:[] }
  };
}
function defaultOrgState(orgId){
  return {
    orgId: safeOrgId(orgId),
    revision: 'rev-' + Date.now().toString(36),
    updatedAt: nowISO(),
    bundle: defaultBundle(orgId),
    frames: [],
    jobs: [],
    sessions: [],
    devices: [],
    locks: [],
    eventLog: [],
    mfa: {},
    valuation: null,
    metrics: { pushes:0, pulls:0, jobRuns:0, logins:0 }
  };
}
function readOrgState(orgId){
  const file = orgPath(orgId);
  if(!fs.existsSync(file)){
    const seed = defaultOrgState(orgId);
    try { fs.writeFileSync(file, encryptJSON(seed)); } catch(err) { console.error('[housecircle-cloud-store] readOrgState seed write failed:', err.message); }
    return seed;
  }
  try{
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = decryptJSON(raw);
    return { ...defaultOrgState(orgId), ...parsed, bundle: mergeBundles(defaultBundle(orgId), parsed.bundle || {}) };
  }catch(err){
    console.error('[housecircle-cloud-store] readOrgState parse failed for', safeOrgId(orgId), '— reinitializing:', err.message);
    const seed = defaultOrgState(orgId);
    try { fs.writeFileSync(file, encryptJSON(seed)); } catch(_) {}
    return seed;
  }
}
function saveOrgState(orgId, nextState){
  const file = orgPath(orgId);
  const state = { ...defaultOrgState(orgId), ...(nextState || {}) };
  state.orgId = safeOrgId(orgId);
  state.bundle = mergeBundles(defaultBundle(orgId), state.bundle || {});
  state.updatedAt = nowISO();
  state.revision = 'rev-' + Date.now().toString(36) + '-' + hashOf(state.bundle).slice(0, 10);
  state.frames = mergeRows([], state.frames).slice(0, 400);
  state.jobs = mergeRows([], state.jobs).slice(0, 400);
  state.sessions = mergeRows([], state.sessions).slice(0, num(process.env.PHC_SESSION_STORE_LIMIT) || 80);
  try { fs.writeFileSync(file, encryptJSON(state)); }
  catch(err) { console.error('[housecircle-cloud-store] saveOrgState write failed for', safeOrgId(orgId), ':', err.message); throw err; }
  return state;
}
function appendFrame(state, frame){
  const next = clone(frame || {});
  if(!next.id) next.id = uid('frame');
  if(!next.at) next.at = nowISO();
  state.frames = mergeRows([next].concat(listify(state.frames)), []).slice(0, 400);
  return next;
}
function queueJob(state, job){
  const next = clone(job || {});
  if(!next.id) next.id = uid('job');
  if(!next.at) next.at = nowISO();
  if(!next.createdAt) next.createdAt = next.at;
  if(!next.status) next.status = 'queued';
  next.attempts = num(next.attempts);
  state.jobs = mergeRows([next].concat(listify(state.jobs)), []).slice(0, 400);
  return next;
}
function bundlePushSummary(bundle){
  const b = bundle || {};
  return {
    locations: listify(b.state && b.state.locations).length,
    guests: listify(b.state && b.state.guests).length,
    posTickets: listify(b.posTickets).length,
    routeTasks: listify(b.routeTasks).length,
    serviceCases: listify(b.serviceCases).length,
    assignments: listify(b.assignments).length,
    valuationRecords: listify(b.valuationRecords).length,
    walkthroughRecords: listify(b.walkthroughRecords).length,
    latestValuation: num(b.valuationCurrent && b.valuationCurrent.totalValue || (listify(b.valuationRecords)[0] || {}).totalValue),
    latestWalkthroughSections: num(b.walkthroughCurrent && b.walkthroughCurrent.sectionCount || (listify(b.walkthroughRecords)[0] || {}).sectionCount)
  };
}
function addAudit(bundle, kind, note, detail){
  const row = { id: uid('audit'), at: nowISO(), kind: compact(kind), note: compact(note), detail: detail || null, updatedAt: nowISO() };
  bundle.audit = mergeRows([row].concat(listify(bundle.audit)), []).slice(0, 400);
  return row;
}
function ensureLocation(bundle, locationId, name){
  const locId = clean(locationId) || uid('loc');
  const existing = listify(bundle.state.locations).find((item) => clean(item.id) === locId || compact(item.name).toLowerCase() === compact(name).toLowerCase());
  if(existing){
    existing.updatedAt = nowISO();
    if(name && !existing.name) existing.name = compact(name);
    return existing;
  }
  const row = { id: locId, name: compact(name) || 'Unknown location', createdAt: nowISO(), updatedAt: nowISO(), revenueTotal:0, visitCount:0 };
  bundle.state.locations = mergeRows([row].concat(listify(bundle.state.locations)), []).slice(0, 300);
  return row;
}
function ensureGuest(bundle, input){
  const email = clean(input.customer_email || input.email).toLowerCase();
  const phone = clean(input.phone);
  const name = compact(input.customer_name || input.name || input.contact_name) || 'Guest';
  let existing = listify(bundle.state.guests).find((item) => (email && clean(item.email).toLowerCase() === email) || (phone && clean(item.phone) === phone));
  if(existing){
    existing.name = existing.name || name;
    if(email && !existing.email) existing.email = email;
    if(phone && !existing.phone) existing.phone = phone;
    existing.updatedAt = nowISO();
    return existing;
  }
  const row = { id: uid('guest'), name, email, phone, createdAt: nowISO(), updatedAt: nowISO(), spendTotal:0, visitCount:0, lastVisitAt:'' };
  bundle.state.guests = mergeRows([row].concat(listify(bundle.state.guests)), []).slice(0, 500);
  return row;
}
function applyPosRowsToBundle(bundle, rows, meta){
  meta = meta || {};
  let created = 0;
  listify(rows).forEach((raw) => {
    const location = ensureLocation(bundle, raw.locationId || meta.locationId, raw.location_name || raw.location || meta.locationName || 'Platform House');
    const guest = ensureGuest(bundle, raw);
    const ticket = {
      id: clean(raw.id) || uid('ticket'),
      locationId: location.id,
      locationName: location.name,
      guestId: guest.id,
      customer_name: guest.name,
      customer_email: guest.email,
      total_collected: num(raw.total_collected || raw.amount || raw.total || raw.ticket_total),
      items: num(raw.items || raw.item_count || 1),
      adapter: compact(meta.adapter || raw.adapter || 'generic'),
      source: compact(meta.source || raw.source || 'cloud-ingest'),
      at: clean(raw.date || raw.at || raw.created_at || nowISO()),
      updatedAt: nowISO(),
      raw
    };
    bundle.posTickets = mergeRows([ticket].concat(listify(bundle.posTickets)), []).slice(0, 600);
    guest.spendTotal = num(guest.spendTotal) + ticket.total_collected;
    guest.visitCount = num(guest.visitCount) + 1;
    guest.lastVisitAt = ticket.at;
    guest.updatedAt = nowISO();
    location.revenueTotal = num(location.revenueTotal) + ticket.total_collected;
    location.visitCount = num(location.visitCount) + 1;
    location.updatedAt = nowISO();
    const timeline = {
      id: uid('timeline'),
      guestId: guest.id,
      locationId: location.id,
      kind: 'pos_ticket',
      note: ticket.adapter + ' ticket ' + ticket.total_collected.toFixed(2),
      at: ticket.at,
      updatedAt: nowISO()
    };
    bundle.state.timeline = mergeRows([timeline].concat(listify(bundle.state.timeline)), []).slice(0, 800);
    if(ticket.total_collected >= 150){
      const task = {
        id: uid('task'),
        source: 'platform-house-cloud',
        title: 'VIP follow-up for ' + guest.name,
        routeHint: location.name,
        status: 'queued',
        priority: ticket.total_collected >= 250 ? 'urgent' : 'high',
        createdAt: nowISO(),
        updatedAt: nowISO(),
        meta: { ticketId: ticket.id, amount: ticket.total_collected, guestId: guest.id, locationId: location.id }
      };
      bundle.routeTasks = mergeRows([task].concat(listify(bundle.routeTasks)), []).slice(0, 500);
    }
    created += 1;
  });
  addAudit(bundle, 'cloud-pos-ingest', 'Applied POS ingest rows.', { created, adapter: compact(meta.adapter), source: compact(meta.source) });
  return created;
}
function applyFrameToState(state, frame){
  const next = appendFrame(state, frame);
  const type = compact(next.type);
  if(type === 'replica-bundle-delta' && next.payload && next.payload.bundle){
    state.bundle = mergeBundles(state.bundle, next.payload.bundle);
    addAudit(state.bundle, 'cloud-frame-merge', next.payload.reason || 'Replica bundle merged on server.', { frameId: next.id });
  } else if(type === 'webhook-job'){
    queueJob(state, { type:'webhook-job', source: compact(next.payload && next.payload.source), eventType: compact(next.payload && next.payload.eventType), payload: clone(next.payload && next.payload.payload || {}), status:'queued', createdAt: nowISO(), updatedAt: nowISO() });
  } else if(type === 'pos-ingest'){
    queueJob(state, { type:'pos-ingest', source: compact(next.payload && next.payload.source) || 'cloud-client', adapter: compact(next.payload && next.payload.adapter) || 'generic', payload: { rows: listify(next.payload && next.payload.rows), locationId: clean(next.payload && next.payload.locationId), locationName: compact(next.payload && next.payload.locationName) }, status:'queued', createdAt: nowISO(), updatedAt: nowISO() });
  }
  return next;
}
function normalizeSquareWebhook(payload){
  const obj = payload && typeof payload === 'object' ? payload : {};
  const locationName = compact(obj.location_name || obj.locationName || obj.merchant_name || 'Square Location');
  const amountCents = num(obj.amount_money && obj.amount_money.amount || obj.total_money && obj.total_money.amount || obj.amount || obj.total_amount || 0);
  return [{
    id: clean(obj.event_id || obj.id) || uid('square'),
    location_name: locationName,
    customer_name: compact(obj.customer_name || obj.customer && obj.customer.name || 'Square Guest'),
    customer_email: clean(obj.customer_email || obj.customer && obj.customer.email),
    total_collected: amountCents > 1000 ? amountCents / 100 : amountCents,
    items: num(obj.items || obj.line_items && obj.line_items.length || 1),
    date: clean(obj.created_at || obj.occurred_at || nowISO()),
    source: 'square-webhook'
  }];
}
function drainJobs(orgId, limit){
  const state = readOrgState(orgId);
  const max = Math.max(1, Math.min(50, num(limit) || 10));
  const queue = listify(state.jobs).sort((a,b) => rowTs(a) - rowTs(b));
  const kept = [];
  const completed = [];
  let processed = 0;
  queue.forEach((job) => {
    if(processed >= max){ kept.push(job); return; }
    if(compact(job.status) !== 'queued' && compact(job.status) !== 'retry'){ kept.push(job); return; }
    processed += 1;
    const next = { ...job, attempts: num(job.attempts) + 1, updatedAt: nowISO() };
    try{
      if(compact(next.type) === 'pos-ingest'){
        const payload = next.payload || {};
        const count = applyPosRowsToBundle(state.bundle, payload.rows || [], { adapter: next.adapter || payload.adapter, locationId: payload.locationId, locationName: payload.locationName, source: next.source || 'job-pos-ingest' });
        next.status = 'completed';
        next.result = { count };
      } else if(compact(next.type) === 'webhook-job'){
        const rows = compact(next.source) === 'square' ? normalizeSquareWebhook(next.payload) : listify(next.payload && next.payload.rows);
        const count = applyPosRowsToBundle(state.bundle, rows, { adapter: compact(next.source) || 'webhook', source: compact(next.eventType) || 'webhook-job' });
        next.status = 'completed';
        next.result = { count };
      } else {
        next.status = 'completed';
        next.result = { noop:true };
      }
      completed.push(next);
    }catch(err){
      next.error = clean(err && err.message) || 'Job failed';
      next.status = next.attempts >= 3 ? 'dead' : 'retry';
      kept.push(next);
    }
  });
  state.jobs = mergeRows(kept.concat(completed.filter((row) => compact(row.status) !== 'completed')), []).slice(0, 400);
  state.metrics.jobRuns = num(state.metrics.jobRuns) + completed.length;
  addAudit(state.bundle, 'cloud-job-drain', 'Server job queue drained.', { completed: completed.length, pending: state.jobs.filter((row) => compact(row.status) !== 'completed').length });
  const saved = saveOrgState(orgId, state);
  return { completed, pending: saved.jobs.filter((row) => compact(row.status) !== 'completed').length, revision: saved.revision };
}


function listDevices(state){
  return mergeRows([], listify(state && state.devices)).slice(0, 200);
}
function saveDevices(state, devices){
  state.devices = mergeRows([], listify(devices)).slice(0, 200);
  return state.devices;
}
function upsertDevice(state, device){
  var row = clone(device || {});
  row.id = clean(row.id) || uid('device');
  row.updatedAt = nowISO();
  if(!row.createdAt) row.createdAt = row.updatedAt;
  state.devices = mergeRows([row].concat(listify(state.devices)), []).slice(0, 200);
  return listify(state.devices).find((item) => clean(item.id) === row.id) || row;
}
function purgeExpiredLocks(state){
  var now = Date.now();
  state.locks = listify(state.locks).filter(function(lock){
    var until = Date.parse(lock && lock.leaseUntil || 0);
    return Number.isFinite(until) && until > now;
  }).slice(0, 200);
  return state.locks;
}
function resourceKey(resourceType, resourceId){
  return compact(resourceType || 'resource') + ':' + clean(resourceId || 'unknown');
}
function acquireLock(state, input){
  purgeExpiredLocks(state);
  var type = compact(input && input.resourceType || 'resource');
  var rid = clean(input && input.resourceId || 'unknown');
  var key = resourceKey(type, rid);
  var ttlSec = Math.max(30, Math.min(900, num(input && input.ttlSec) || 120));
  var existing = listify(state.locks).find((lock) => clean(lock.resourceKey) === key);
  if(existing && !(clean(existing.operatorId) === clean(input && input.operatorId) && clean(existing.deviceId) === clean(input && input.deviceId)) && !input.force){
    return { ok:false, conflict:true, lock: existing };
  }
  var row = existing ? { ...existing } : { id: uid('lock'), createdAt: nowISO() };
  row.resourceType = type;
  row.resourceId = rid;
  row.resourceKey = key;
  row.operatorId = clean(input && input.operatorId);
  row.operatorName = compact(input && input.operatorName);
  row.deviceId = clean(input && input.deviceId);
  row.note = compact(input && input.note);
  row.updatedAt = nowISO();
  row.leaseUntil = new Date(Date.now() + ttlSec * 1000).toISOString();
  state.locks = mergeRows([row].concat(listify(state.locks).filter((lock) => clean(lock.id) !== clean(row.id))), []).slice(0, 200);
  return { ok:true, conflict:false, lock: row };
}
function releaseLock(state, input){
  purgeExpiredLocks(state);
  var lockId = clean(input && input.lockId);
  var key = clean(input && input.resourceKey) || resourceKey(input && input.resourceType, input && input.resourceId);
  var removed = null;
  state.locks = listify(state.locks).filter(function(lock){
    var match = (lockId && clean(lock.id) === lockId) || (!lockId && key && clean(lock.resourceKey) === key);
    if(match){ removed = lock; return false; }
    return true;
  }).slice(0, 200);
  return { ok: !!removed, lock: removed };
}
function pushEvent(state, event){
  var row = clone(event || {});
  row.id = clean(row.id) || uid('evt');
  row.at = clean(row.at) || nowISO();
  row.updatedAt = nowISO();
  state.eventLog = mergeRows([row].concat(listify(state.eventLog)), []).slice(0, 400);
  return row;
}
module.exports = {
  DATA_ROOT,
  uid,
  clean,
  compact,
  listify,
  clone,
  nowISO,
  dayISO,
  num,
  safeOrgId,
  defaultBundle,
  readOrgState,
  saveOrgState,
  mergeBundles,
  mergeRows,
  appendFrame,
  queueJob,
  bundlePushSummary,
  addAudit,
  applyFrameToState,
  applyPosRowsToBundle,
  normalizeSquareWebhook,
  drainJobs,
  hashOf,
  listDevices,
  saveDevices,
  upsertDevice,
  purgeExpiredLocks,
  resourceKey,
  acquireLock,
  releaseLock,
  pushEvent
};
