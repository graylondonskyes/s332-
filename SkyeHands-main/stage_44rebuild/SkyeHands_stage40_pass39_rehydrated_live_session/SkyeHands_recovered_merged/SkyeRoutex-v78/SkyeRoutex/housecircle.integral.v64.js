(function(){
  if(window.__ROUTEX_HOUSECIRCLE_V64__) return;
  window.__ROUTEX_HOUSECIRCLE_V64__ = true;

  var KEY_CLOUD_CONFIG = 'skye_routex_platform_house_circle_cloud_config_v64';
  var KEY_CLOUD_SESSION = 'skye_routex_platform_house_circle_cloud_session_v64';
  var KEY_CLOUD_OUTBOX = 'skye_routex_platform_house_circle_cloud_outbox_v64';
  var KEY_CLOUD_LOG = 'skye_routex_platform_house_circle_cloud_log_v64';
  var KEY_CLOUD_LAST = 'skye_routex_platform_house_circle_cloud_last_v64';
  var LIMIT = 300;
  var timer = null;
  var inFlight = false;

  var clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  var esc = window.escapeHTML || function(v){ return String(v == null ? '' : v); };
  var uidFn = (typeof uid === 'function') ? uid : function(){ return 'hc64-' + Math.random().toString(36).slice(2,10); };
  var nowFn = (typeof nowISO === 'function') ? nowISO : function(){ return new Date().toISOString(); };
  var dayFn = (typeof dayISO === 'function') ? dayISO : function(){ return new Date().toISOString().slice(0,10); };
  var fmtFn = (typeof fmt === 'function') ? fmt : function(v){ return String(v); };
  var toastFn = (typeof toast === 'function') ? toast : function(){};
  var openModalFn = (typeof openModal === 'function') ? openModal : function(title){ try{ alert(title); }catch(_){} };
  var raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame.bind(window) : function(cb){ return setTimeout(cb, 0); };

  function compact(v){ return clean(v).replace(/\s+/g, ' ').trim(); }
  function clone(v){ return JSON.parse(JSON.stringify(v)); }
  function listify(v){ return Array.isArray(v) ? v.filter(Boolean) : []; }
  function num(v){ var n = Number(v || 0); return Number.isFinite(n) ? n : 0; }
  function readJSON(key, fallback){ try{ var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); return value; }
  function sortByTs(rows){ return listify(rows).slice().sort(function(a,b){ return tsOf(b) - tsOf(a); }); }
  function tsOf(row){ var value = row && (row.updatedAt || row.at || row.createdAt || row.syncedAt || row.issuedAt || row.pulledAt || row.pushedAt || row.lastSeen); var parsed = value ? Date.parse(value) : 0; return Number.isFinite(parsed) ? parsed : 0; }
  function base(){ return window.RoutexPlatformHouseCircle || null; }
  function v60(){ return window.RoutexPlatformHouseCircleV60 || null; }
  function v62(){ return window.RoutexPlatformHouseCircleV62 || null; }
  function v63(){ return window.RoutexPlatformHouseCircleV63 || null; }
  function currentOperator(){ var api = v60(); return api && typeof api.currentOperator === 'function' ? api.currentOperator() : { id:'founder-admin', name:'Skyes Over London', role:'founder_admin' }; }
  function defaultConfig(){ return { enabled:false, orgId:'platform-house-main', deviceId:'device-' + uidFn(), basePath:'/.netlify/functions', autoSync:true, autoIntervalMs:25000 }; }
  function readCloudConfig(){ return { ...defaultConfig(), ...(readJSON(KEY_CLOUD_CONFIG, {}) || {}) }; }
  function saveCloudConfig(input){ var next = { ...readCloudConfig(), ...(input || {}) }; writeJSON(KEY_CLOUD_CONFIG, next); scheduleCloudTick(); return next; }
  function readCloudSession(){ return readJSON(KEY_CLOUD_SESSION, null); }
  function saveCloudSession(session){ if(!session) localStorage.removeItem(KEY_CLOUD_SESSION); else writeJSON(KEY_CLOUD_SESSION, session); return session; }
  function readCloudOutbox(){ return sortByTs(readJSON(KEY_CLOUD_OUTBOX, [])).slice(0, LIMIT); }
  function writeCloudOutbox(rows){ return writeJSON(KEY_CLOUD_OUTBOX, listify(rows).slice(0, LIMIT)); }
  function appendCloudLog(kind, status, note, meta){ var rows = readJSON(KEY_CLOUD_LOG, []); rows.unshift({ id:uidFn(), at:nowFn(), kind:compact(kind), status:compact(status) || 'ok', note:compact(note), meta:meta || null }); writeJSON(KEY_CLOUD_LOG, rows.slice(0, LIMIT)); return rows[0]; }
  function readCloudLog(){ return sortByTs(readJSON(KEY_CLOUD_LOG, [])).slice(0, LIMIT); }
  function rememberCloudSummary(summary){ return writeJSON(KEY_CLOUD_LAST, { ...(readJSON(KEY_CLOUD_LAST, {}) || {}), ...(summary || {}), updatedAt: nowFn() }); }
  function readCloudSummary(){ return readJSON(KEY_CLOUD_LAST, {}); }
  function queueCloudAction(kind, payload){ var rows = readCloudOutbox(); rows.unshift({ id:uidFn(), at:nowFn(), kind:compact(kind), payload: payload && typeof payload === 'object' ? clone(payload) : payload, status:'queued', attempts:0 }); writeCloudOutbox(rows); return rows[0]; }
  function authHeaders(){ var headers = { 'content-type':'application/json' }; var session = readCloudSession(); if(session && session.token) headers.authorization = 'Bearer ' + session.token; return headers; }
  function endpoint(path){ var config = readCloudConfig(); var basePath = compact(config.basePath || '/.netlify/functions').replace(/\/$/, ''); return basePath + '/' + path.replace(/^\//, ''); }
  async function cloudFetch(path, opts){
    opts = opts || {};
    var config = readCloudConfig();
    if(!config.enabled && path !== 'phc-health' && path !== 'phc-auth-login') throw new Error('Cloud lane is disabled.');
    var res = await fetch(endpoint(path), { method: opts.method || 'GET', headers: { ...authHeaders(), ...(opts.headers || {}) }, body: opts.body == null ? undefined : JSON.stringify(opts.body) });
    var json = await res.json();
    if(!res.ok || json.ok === false) throw new Error(clean(json && json.error) || ('Cloud request failed (' + res.status + ').'));
    return json;
  }

  async function fetchCloudHealth(){
    var config = readCloudConfig();
    var json = await cloudFetch('phc-health?orgId=' + encodeURIComponent(config.orgId || 'platform-house-main'), { method:'GET' });
    rememberCloudSummary({ health: json, healthAt: nowFn(), serverRevision: json.revision });
    appendCloudLog('health', 'ok', 'Cloud health checked.', { revision: json.revision });
    return json;
  }
  async function loginCloud(input){
    var config = saveCloudConfig(input || {});
    var operator = currentOperator();
    var json = await cloudFetch('phc-auth-login', { method:'POST', body: { orgId: config.orgId, deviceId: config.deviceId, operatorId: operator.id, operatorName: operator.name, role: operator.role } });
    saveCloudSession({ token: json.token, session: json.session, orgId: json.orgId, issuedAt: nowFn() });
    rememberCloudSummary({ sessionActive:true, sessionAt: nowFn(), orgId: json.orgId });
    appendCloudLog('login', 'ok', 'Cloud operator session issued.', { orgId: json.orgId, operatorId: operator.id });
    return json;
  }
  function buildCloudBundle(){
    var bundle = v62() && typeof v62().buildReplicaBundle === 'function' ? v62().buildReplicaBundle() : (base() && typeof base().exportUnifiedBundle === 'function' ? base().exportUnifiedBundle() : { type:'skye-routex-platform-house-circle-v64', state:{} });
    bundle.type = 'skye-routex-platform-house-circle-v64';
    bundle.version = '64.0.0';
    bundle.exportedAt = nowFn();
    bundle.liveOpsV63 = {
      scannerLog: v63() && typeof v63().readScannerLog === 'function' ? v63().readScannerLog() : [],
      adapterRuns: v63() && typeof v63().readAdapterRuns === 'function' ? v63().readAdapterRuns() : [],
      webhookInbox: v63() && typeof v63().readWebhookInbox === 'function' ? v63().readWebhookInbox() : [],
      jobs: v63() && typeof v63().readJobs === 'function' ? v63().readJobs() : [],
      deadJobs: v63() && typeof v63().readDeadJobs === 'function' ? v63().readDeadJobs() : [],
      syncLog: v63() && typeof v63().readSyncLog === 'function' ? v63().readSyncLog() : [],
      peers: v63() && typeof v63().readPeers === 'function' ? v63().readPeers() : []
    };
    return bundle;
  }
  function applyCloudSnapshot(json){
    if(!json || !json.bundle) return json;
    if(v62() && typeof v62().importV62Bundle === 'function') v62().importV62Bundle(json.bundle);
    if(json.bundle.liveOpsV63){
      var live = json.bundle.liveOpsV63;
      if(live.scannerLog) localStorage.setItem('skye_routex_platform_house_circle_scanner_log_v63', JSON.stringify(live.scannerLog));
      if(live.adapterRuns) localStorage.setItem('skye_routex_platform_house_circle_pos_adapter_runs_v63', JSON.stringify(live.adapterRuns));
      if(live.webhookInbox) localStorage.setItem('skye_routex_platform_house_circle_webhook_inbox_v63', JSON.stringify(live.webhookInbox));
      if(live.jobs) localStorage.setItem('skye_routex_platform_house_circle_job_queue_v63', JSON.stringify(live.jobs));
      if(live.deadJobs) localStorage.setItem('skye_routex_platform_house_circle_job_dead_v63', JSON.stringify(live.deadJobs));
      if(live.syncLog) localStorage.setItem('skye_routex_platform_house_circle_sync_log_v63', JSON.stringify(live.syncLog));
      if(live.peers) localStorage.setItem('skye_routex_platform_house_circle_sync_peers_v63', JSON.stringify(live.peers));
    }
    rememberCloudSummary({ serverRevision: json.revision, pulledAt: nowFn(), orgId: json.orgId });
    return json;
  }
  async function pushCloudBundle(reason){
    var config = readCloudConfig();
    var bundle = buildCloudBundle();
    var summary = readCloudSummary();
    var json = await cloudFetch('phc-sync-state', { method:'POST', body:{ orgId: config.orgId, baseRevision: clean(summary.serverRevision), mergeMode:'auto', reason: compact(reason) || 'Manual cloud push', bundle: bundle } });
    rememberCloudSummary({ serverRevision: json.revision, pushedAt: nowFn(), lastPushSummary: json.summary });
    appendCloudLog('push', json.conflict ? 'merge' : 'ok', json.conflict ? 'Cloud push merged against newer revision.' : 'Cloud snapshot pushed.', { revision: json.revision });
    return json;
  }
  async function pullCloudBundle(){
    var config = readCloudConfig();
    var json = await cloudFetch('phc-sync-state?orgId=' + encodeURIComponent(config.orgId || 'platform-house-main'), { method:'GET' });
    applyCloudSnapshot(json);
    appendCloudLog('pull', 'ok', 'Cloud snapshot pulled.', { revision: json.revision });
    return json;
  }
  async function drainCloudJobs(limit){
    var config = readCloudConfig();
    var json = await cloudFetch('phc-job-drain', { method:'POST', body:{ orgId: config.orgId, limit: limit || 12 } });
    rememberCloudSummary({ serverRevision: json.revision, drainedAt: nowFn(), drainedJobs: json.completed });
    appendCloudLog('job-drain', 'ok', 'Server job queue drained.', { completed: json.completed, pending: json.pending });
    return json;
  }
  async function sendCloudAction(item){
    var config = readCloudConfig();
    if(item.kind === 'sync-frame') return cloudFetch('phc-sync-frame', { method:'POST', body:{ orgId: config.orgId, frame: item.payload && item.payload.frame || item.payload } });
    if(item.kind === 'webhook'){
      var payload = item.payload || {};
      if(compact(payload.source) === 'square') return cloudFetch('phc-webhook-square', { method:'POST', body:{ orgId: config.orgId, eventType: payload.eventType, payload: payload.payload || {} } });
      return cloudFetch('phc-sync-frame', { method:'POST', body:{ orgId: config.orgId, frame: { id:uidFn(), type:'webhook-job', at:nowFn(), peerId: config.deviceId, payload: payload } } });
    }
    if(item.kind === 'pos-ingest'){
      var pos = item.payload || {};
      return cloudFetch('phc-pos-ingest', { method:'POST', body:{ orgId: config.orgId, adapter: pos.adapter, locationId: pos.locationId, locationName: pos.locationName, rows: pos.rows || [] } });
    }
    if(item.kind === 'bundle-push') return pushCloudBundle(item.payload && item.payload.reason);
    throw new Error('Unknown cloud action ' + item.kind);
  }
  async function flushCloudActions(limit){
    var max = Math.max(1, Math.min(50, num(limit) || 12));
    var rows = readCloudOutbox();
    var next = [];
    var sent = [];
    for(var i=0;i<rows.length;i++){
      var item = rows[i];
      if(sent.length >= max || compact(item.status) === 'sending'){ next.push(item); continue; }
      if(compact(item.status) !== 'queued' && compact(item.status) !== 'retry'){ next.push(item); continue; }
      try{
        var res = await sendCloudAction(item);
        sent.push({ id:item.id, kind:item.kind, revision: res.revision || '' });
        appendCloudLog('outbox', 'ok', 'Cloud action sent: ' + item.kind, { revision: res.revision || '', actionId: item.id });
        if(res.revision) rememberCloudSummary({ serverRevision: res.revision, outboxAt: nowFn() });
      }catch(err){
        item.attempts = num(item.attempts) + 1;
        item.updatedAt = nowFn();
        item.error = clean(err && err.message) || 'Send failed';
        item.status = item.attempts >= 3 ? 'dead' : 'retry';
        next.push(item);
        appendCloudLog('outbox', item.status === 'dead' ? 'dead' : 'retry', item.error, { actionId: item.id, kind: item.kind });
      }
    }
    writeCloudOutbox(next.concat(rows.slice(sent.length + next.length)).slice(0, LIMIT));
    return { sent: sent.length, remaining: next.length, items: sent };
  }

  function buildV64Metrics(){
    var summary = readCloudSummary();
    var session = readCloudSession();
    var outbox = readCloudOutbox();
    var log = readCloudLog();
    return {
      sessionActive: !!(session && session.token),
      queuedActions: outbox.filter(function(item){ return compact(item.status) === 'queued' || compact(item.status) === 'retry'; }).length,
      deadActions: outbox.filter(function(item){ return compact(item.status) === 'dead'; }).length,
      pushed: log.filter(function(item){ return compact(item.kind) === 'push'; }).length,
      pulled: log.filter(function(item){ return compact(item.kind) === 'pull'; }).length,
      serverRevision: clean(summary.serverRevision),
      orgId: clean(summary.orgId || (session && session.orgId) || readCloudConfig().orgId),
      lastHealthAt: clean(summary.healthAt)
    };
  }

  async function autoSyncTick(){
    if(inFlight) return;
    var config = readCloudConfig();
    if(!config.enabled || !config.autoSync || (navigator && navigator.onLine === false)) return;
    inFlight = true;
    try{
      if(!(readCloudSession() && readCloudSession().token)) await loginCloud();
      await flushCloudActions(8);
      await pushCloudBundle('Auto cloud tick');
      await drainCloudJobs(8);
      await pullCloudBundle();
      await fetchCloudHealth();
      if(typeof render === 'function') render();
    }catch(err){ appendCloudLog('auto-sync', 'warn', clean(err && err.message) || 'Auto sync failed.'); }
    inFlight = false;
  }
  function scheduleCloudTick(){
    if(timer) clearInterval(timer);
    var config = readCloudConfig();
    if(config.enabled && config.autoSync){ timer = setInterval(autoSyncTick, Math.max(10000, num(config.autoIntervalMs) || 25000)); }
  }

  function renderCloudRows(rows){
    return rows.length ? rows.map(function(item){ return '<div class="item"><div class="meta"><div class="name">' + esc(item.kind || item.type) + ' <span class="badge">' + esc(item.status || item.direction || 'ok') + '</span></div><div class="sub">' + esc(fmtFn(item.at)) + (item.note ? ' • ' + esc(item.note) : '') + (item.error ? ' • ' + esc(item.error) : '') + '</div></div></div>'; }).join('') : '<div class="hint">Nothing queued.</div>';
  }
  function openCloudModal(){
    var config = readCloudConfig();
    var metrics = buildV64Metrics();
    openModalFn('Cloud sync mesh · V64', '<div class="hint">V64 lands the server-side lane: signed operator sessions, snapshot sync, server frame ingest, server job drain, and cloud-side POS/webhook processing.</div><div class="sep"></div><div class="fieldrow"><div class="field"><label>Org ID</label><input id="hc64_org" value="' + esc(config.orgId) + '"/></div><div class="field"><label>Device ID</label><input id="hc64_device" value="' + esc(config.deviceId) + '"/></div><div class="field"><label>Functions base path</label><input id="hc64_base" value="' + esc(config.basePath) + '"/></div><div class="field"><label><input type="checkbox" id="hc64_enabled" ' + (config.enabled ? 'checked' : '') + '/> Cloud enabled</label><div class="hint">Snapshot + frame sync uses Netlify functions shipped in this repo.</div></div><div class="field"><label><input type="checkbox" id="hc64_auto" ' + (config.autoSync ? 'checked' : '') + '/> Auto sync</label><div class="hint">Current server revision: ' + esc(metrics.serverRevision || 'not yet synced') + '</div></div><div class="field full"><div class="hint"><strong>Outbox</strong></div>' + renderCloudRows(readCloudOutbox().slice(0, 8)) + '</div><div class="field full"><div class="hint"><strong>Cloud log</strong></div>' + renderCloudRows(readCloudLog().slice(0, 8)) + '</div></div>', '<button class="btn" id="hc64_cfg">Save config</button><button class="btn" id="hc64_login">Login</button><button class="btn" id="hc64_push">Push snapshot</button><button class="btn" id="hc64_flush">Flush actions</button><button class="btn" id="hc64_drain">Drain jobs</button><button class="btn primary" id="hc64_pull">Pull snapshot</button>');
    function readForm(){ return { orgId: clean((document.getElementById('hc64_org') || {}).value), deviceId: clean((document.getElementById('hc64_device') || {}).value), basePath: clean((document.getElementById('hc64_base') || {}).value), enabled: !!((document.getElementById('hc64_enabled') || {}).checked), autoSync: !!((document.getElementById('hc64_auto') || {}).checked) }; }
    var cfg = document.getElementById('hc64_cfg'); if(cfg) cfg.onclick = function(){ saveCloudConfig(readForm()); openCloudModal(); };
    var login = document.getElementById('hc64_login'); if(login) login.onclick = async function(){ try{ saveCloudConfig(readForm()); await loginCloud(); openCloudModal(); }catch(err){ toastFn(clean(err && err.message) || 'Cloud login failed.', 'bad'); } };
    var push = document.getElementById('hc64_push'); if(push) push.onclick = async function(){ try{ saveCloudConfig(readForm()); await pushCloudBundle('Manual push from V64 modal'); openCloudModal(); }catch(err){ toastFn(clean(err && err.message) || 'Push failed.', 'bad'); } };
    var flush = document.getElementById('hc64_flush'); if(flush) flush.onclick = async function(){ try{ saveCloudConfig(readForm()); await flushCloudActions(12); openCloudModal(); }catch(err){ toastFn(clean(err && err.message) || 'Flush failed.', 'bad'); } };
    var drain = document.getElementById('hc64_drain'); if(drain) drain.onclick = async function(){ try{ saveCloudConfig(readForm()); await drainCloudJobs(12); openCloudModal(); }catch(err){ toastFn(clean(err && err.message) || 'Drain failed.', 'bad'); } };
    var pull = document.getElementById('hc64_pull'); if(pull) pull.onclick = async function(){ try{ saveCloudConfig(readForm()); await pullCloudBundle(); openCloudModal(); }catch(err){ toastFn(clean(err && err.message) || 'Pull failed.', 'bad'); } };
  }

  function injectStyles(){
    if(document.getElementById('hc_v64_styles')) return;
    var style = document.createElement('style');
    style.id = 'hc_v64_styles';
    style.textContent = '.hc-v64-kpi{min-width:140px;padding:14px 16px;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:rgba(39,242,255,.06)}.hc-v64-kpi .n{font-size:1.45rem;font-weight:700}.hc-v64-kpi .d{font-size:.82rem;opacity:.82}';
    (document.head || document.body).appendChild(style);
  }
  function renderV64Card(){
    if(!(typeof APP !== 'undefined' && APP && APP.view === 'platform-house')) return;
    var host = document.querySelector('#content') || document.querySelector('#app') || document.body;
    if(!host) return;
    var old = document.getElementById('hc_v64_card'); if(old && old.remove) old.remove();
    var m = buildV64Metrics();
    var card = document.createElement('div');
    card.id = 'hc_v64_card';
    card.className = 'card';
    card.innerHTML = '<h2 style="margin:0 0 8px;">Platform House Cloud Mesh · V64</h2><div class="hint">This pass adds signed operator cloud sessions, snapshot sync, cloud frame ingestion, cloud POS/webhook intake, and server job drain inside the shipped repo.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;">' +
      '<div class="hc-v64-kpi"><div class="n">' + esc(m.sessionActive ? 'ON' : 'OFF') + '</div><div class="d">Cloud session</div></div>' +
      '<div class="hc-v64-kpi"><div class="n">' + esc(String(m.queuedActions)) + '</div><div class="d">Queued actions</div></div>' +
      '<div class="hc-v64-kpi"><div class="n">' + esc(String(m.deadActions)) + '</div><div class="d">Dead actions</div></div>' +
      '<div class="hc-v64-kpi"><div class="n">' + esc(m.serverRevision ? m.serverRevision.slice(0,10) : '—') + '</div><div class="d">Server revision</div></div>' +
      '</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;justify-content:flex-end;"><button class="btn" id="hc64_open_cloud">Cloud control</button><button class="btn" id="hc64_push_quick">Quick push</button><button class="btn primary" id="hc64_pull_quick">Quick pull</button></div>';
    host.appendChild(card);
    var open = document.getElementById('hc64_open_cloud'); if(open) open.onclick = openCloudModal;
    var push = document.getElementById('hc64_push_quick'); if(push) push.onclick = async function(){ try{ await pushCloudBundle('Quick push from V64 card'); if(typeof render === 'function') render(); }catch(err){ toastFn(clean(err && err.message) || 'Quick push failed.', 'bad'); } };
    var pull = document.getElementById('hc64_pull_quick'); if(pull) pull.onclick = async function(){ try{ await pullCloudBundle(); if(typeof render === 'function') render(); }catch(err){ toastFn(clean(err && err.message) || 'Quick pull failed.', 'bad'); } };
  }
  function injectDashboardCard(){
    if(!(typeof APP !== 'undefined' && APP && APP.view === 'dashboard')) return;
    var grid = document.querySelector('#content .grid');
    if(!grid) return;
    var old = document.getElementById('hc_v64_dash_card'); if(old && old.remove) old.remove();
    var m = buildV64Metrics();
    var card = document.createElement('div');
    card.id = 'hc_v64_dash_card';
    card.className = 'card';
    card.style.gridColumn = 'span 12';
    card.innerHTML = '<h2>Platform House V64</h2><div class="hint">Server-side cloud sync now ships in this repo through Netlify functions. Snapshot push/pull, frame ingest, POS ingest, Square webhook intake, and server job drain are wired.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;"><div class="pill">Org ' + esc(m.orgId || 'platform-house-main') + '</div><div class="pill">Queued actions ' + esc(String(m.queuedActions)) + '</div><div class="pill">Cloud session ' + esc(m.sessionActive ? 'on' : 'off') + '</div><button class="btn" id="hc_v64_dash_open">Open cloud mesh</button></div>';
    grid.insertBefore(card, grid.children[1] || null);
    var btn = document.getElementById('hc_v64_dash_open'); if(btn) btn.onclick = function(){ APP.routeId = null; APP.view = 'platform-house'; window.location.hash = 'platform-house'; if(typeof render === 'function') render(); setTimeout(openCloudModal, 50); };
  }

  function patchUpstream(){
    var api63 = v63();
    if(!api63 || api63.__v64Patched) return;
    api63.__v64Patched = true;
    if(typeof api63.emitSyncFrame === 'function'){
      var emit = api63.emitSyncFrame;
      api63.emitSyncFrame = function(type, payload){ var frame = emit.apply(this, arguments); if(frame) queueCloudAction('sync-frame', { frame: frame }); return frame; };
    }
    if(typeof api63.enqueueWebhook === 'function'){
      var enqueue = api63.enqueueWebhook;
      api63.enqueueWebhook = function(source, eventType, payload){ var out = enqueue.apply(this, arguments); queueCloudAction('webhook', { source: source, eventType: eventType, payload: payload || {} }); return out; };
    }
    if(typeof api63.importPosAdapterData === 'function'){
      var importer = api63.importPosAdapterData;
      api63.importPosAdapterData = function(input){ var out = importer.apply(this, arguments); if(out && out.created && out.created.length){ queueCloudAction('pos-ingest', { adapter: out.adapter, rows: out.created, locationId: input && input.locationId, locationName: input && input.locationName }); } return out; };
    }
  }
  function patchApi(){
    var api = base();
    if(!api || api.__v64Patched) return;
    api.__v64Patched = true;
    api.readCloudConfig = readCloudConfig;
    api.saveCloudConfig = saveCloudConfig;
    api.loginCloud = loginCloud;
    api.pushCloudBundle = pushCloudBundle;
    api.pullCloudBundle = pullCloudBundle;
    api.flushCloudActions = flushCloudActions;
    api.drainCloudJobs = drainCloudJobs;
    api.fetchCloudHealth = fetchCloudHealth;
  }
  function patchRender(){
    if(window.__ROUTEX_HC_V64_RENDER__) return;
    window.__ROUTEX_HC_V64_RENDER__ = true;
    var prev = typeof render === 'function' ? render : null;
    if(!prev) return;
    render = async function(){ var out = await prev.apply(this, arguments); raf(function(){ try{ renderV64Card(); injectDashboardCard(); }catch(_){ } }); return out; };
  }
  function init(){
    if(!base() || !v60() || !v62() || !v63()) return setTimeout(init, 40);
    injectStyles();
    patchUpstream();
    patchApi();
    patchRender();
    scheduleCloudTick();
    raf(function(){ try{ renderV64Card(); injectDashboardCard(); }catch(_){ } });
    window.RoutexPlatformHouseCircleV64 = {
      readCloudConfig: readCloudConfig,
      saveCloudConfig: saveCloudConfig,
      readCloudSession: readCloudSession,
      readCloudOutbox: readCloudOutbox,
      readCloudLog: readCloudLog,
      queueCloudAction: queueCloudAction,
      buildCloudBundle: buildCloudBundle,
      applyCloudSnapshot: applyCloudSnapshot,
      loginCloud: loginCloud,
      fetchCloudHealth: fetchCloudHealth,
      pushCloudBundle: pushCloudBundle,
      pullCloudBundle: pullCloudBundle,
      flushCloudActions: flushCloudActions,
      drainCloudJobs: drainCloudJobs,
      buildV64Metrics: buildV64Metrics,
      openCloudModal: openCloudModal,
      autoSyncTick: autoSyncTick
    };
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
