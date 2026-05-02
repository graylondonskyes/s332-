(function(){
  if(window.__ROUTEX_HOUSECIRCLE_V63__) return;
  window.__ROUTEX_HOUSECIRCLE_V63__ = true;

  var KEY_SYNC_LOG = 'skye_routex_platform_house_circle_sync_log_v63';
  var KEY_SYNC_SIGNAL = 'skye_routex_platform_house_circle_sync_signal_v63';
  var KEY_SYNC_PEERS = 'skye_routex_platform_house_circle_sync_peers_v63';
  var KEY_SYNC_OUTBOX = 'skye_routex_platform_house_circle_sync_outbox_v63';
  var KEY_SCANNER_LOG = 'skye_routex_platform_house_circle_scanner_log_v63';
  var KEY_POS_ADAPTER_RUNS = 'skye_routex_platform_house_circle_pos_adapter_runs_v63';
  var KEY_WEBHOOK_INBOX = 'skye_routex_platform_house_circle_webhook_inbox_v63';
  var KEY_JOB_QUEUE = 'skye_routex_platform_house_circle_job_queue_v63';
  var KEY_JOB_DEAD = 'skye_routex_platform_house_circle_job_dead_v63';
  var KEY_PEER_ID = 'skye_routex_platform_house_circle_peer_id_v63';
  var LIMIT = 300;
  var MEDIA_CONSTRAINTS = { video: { facingMode: { ideal: 'environment' } }, audio: false };

  var clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  var esc = window.escapeHTML || function(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(m){ return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[m]; }); };
  var uidFn = (typeof uid === 'function') ? uid : function(){ return 'hc63-' + Math.random().toString(36).slice(2,10); };
  var nowFn = (typeof nowISO === 'function') ? nowISO : function(){ return new Date().toISOString(); };
  var dayFn = (typeof dayISO === 'function') ? dayISO : function(){ return new Date().toISOString().slice(0,10); };
  var fmtFn = (typeof fmt === 'function') ? fmt : function(v){ try{ return new Date(v || Date.now()).toLocaleString(); }catch(_){ return clean(v); } };
  var toastFn = (typeof toast === 'function') ? toast : function(){};
  var openModalFn = (typeof openModal === 'function') ? openModal : function(title){ try{ alert(title); }catch(_){} };
  var closeModalFn = (typeof closeModal === 'function') ? closeModal : function(){};
  var raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame.bind(window) : function(cb){ return setTimeout(cb, 0); };
  var bc = null;
  var scannerState = { stream:null, active:false, timer:null, videoEl:null, statusEl:null, detector:null, onCode:null };
  var suppressWatch = 0;
  var suppressBroadcast = 0;
  var seenFrames = {};
  var broadcastTimer = null;

  function compact(v){ return clean(v).replace(/\s+/g, ' ').trim(); }
  function lower(v){ return compact(v).toLowerCase(); }
  function num(v){ var n = Number(v || 0); return Number.isFinite(n) ? n : 0; }
  function listify(v){ return Array.isArray(v) ? v.filter(Boolean) : []; }
  function clone(v){ return JSON.parse(JSON.stringify(v)); }
  function attr(v){ return esc(String(v == null ? '' : v)).replace(/\n/g, '&#10;'); }
  function normalizeEmail(v){ return clean(v).toLowerCase(); }
  function normalizePhone(v){ return clean(v).replace(/[^0-9+]/g, ''); }
  function readJSON(key, fallback){ try{ var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); return value; }
  function sortByTs(rows){ return rows.slice().sort(function(a,b){ return tsOf(b) - tsOf(a); }); }
  function tsOf(row){ var value = row && (row.updatedAt || row.at || row.createdAt || row.startedAt || row.finishedAt || row.completedAt || row.lastSeen); var parsed = value ? Date.parse(value) : 0; return Number.isFinite(parsed) ? parsed : 0; }
  function rememberFrame(id){ if(id) seenFrames[id] = Date.now(); }
  function seenFrame(id){ return !!(id && seenFrames[id]); }
  function pruneSeenFrames(){ var now = Date.now(); Object.keys(seenFrames).forEach(function(id){ if(now - seenFrames[id] > 4 * 60 * 1000) delete seenFrames[id]; }); }

  function base(){ return window.RoutexPlatformHouseCircle || null; }
  function v60(){ return window.RoutexPlatformHouseCircleV60 || null; }
  function v61(){ return window.RoutexPlatformHouseCircleV61 || null; }
  function v62(){ return window.RoutexPlatformHouseCircleV62 || null; }
  function state(){ var api = base(); return api && typeof api.readState === 'function' ? api.readState() : { locations:[], guests:[] }; }
  function saveState(next){ var api = base(); return api && typeof api.saveState === 'function' ? api.saveState(next) : next; }
  function currentOperator(){ var api = v60(); return api && typeof api.currentOperator === 'function' ? api.currentOperator() : { id:'founder-admin', name:'Skyes Over London', role:'founder_admin' }; }
  function can(permission){ var api = v60(); return !permission || !(api && typeof api.can === 'function') ? true : api.can(permission); }
  function requirePermission(permission, message){ if(permission && !can(permission)) throw new Error(message || ('Current operator cannot perform ' + permission + '.')); }
  function findLocation(id){ return listify(state().locations).find(function(item){ return clean(item.id) === clean(id); }) || null; }
  function findLocationName(id){ var hit = findLocation(id); return hit ? hit.name : ''; }
  function readOperators(){ var api = v60(); return api && typeof api.readOperators === 'function' ? api.readOperators() : [currentOperator()]; }
  function buildBundle(){ var api = v62(); return api && typeof api.buildReplicaBundle === 'function' ? api.buildReplicaBundle() : { type:'skye-routex-platform-house-circle-v63-empty', builtAt:nowFn(), state:state() }; }

  function getPeerId(){
    var value = clean(readJSON(KEY_PEER_ID, ''));
    if(!value){ value = 'peer-' + uidFn(); writeJSON(KEY_PEER_ID, value); }
    return value;
  }
  var PEER_ID = getPeerId();

  function initChannel(){
    try{
      if(typeof BroadcastChannel === 'function'){
        bc = new BroadcastChannel('skye-routex-platform-house-circle-v63');
        bc.onmessage = function(evt){ try{ if(evt && evt.data) applySyncFrame(evt.data, { remote:true, via:'broadcast' }); }catch(_){ } };
      }
    }catch(_){ bc = null; }
  }

  function shouldTrackKey(key){
    key = clean(key);
    if(!key) return false;
    if(key === KEY_SYNC_SIGNAL || key === KEY_SYNC_LOG || key === KEY_SYNC_OUTBOX || key === KEY_SYNC_PEERS || key === KEY_SCANNER_LOG || key === KEY_PEER_ID) return false;
    if(key.indexOf('skye_routex_platform_house_circle_') === 0) return true;
    return key === 'routex_state' || key === 'skye_routex_route_tasks';
  }

  function patchLocalStorage(){
    if(window.__ROUTEX_HC_V63_STORAGE_PATCHED__) return;
    window.__ROUTEX_HC_V63_STORAGE_PATCHED__ = true;
    if(!localStorage || typeof localStorage.setItem !== 'function') return;
    var originalSet = localStorage.setItem.bind(localStorage);
    var originalRemove = typeof localStorage.removeItem === 'function' ? localStorage.removeItem.bind(localStorage) : null;
    localStorage.setItem = function(key, value){
      originalSet(key, value);
      if(!suppressWatch && shouldTrackKey(key)) scheduleBundleBroadcast('storage:' + key);
    };
    if(originalRemove){
      localStorage.removeItem = function(key){
        originalRemove(key);
        if(!suppressWatch && shouldTrackKey(key)) scheduleBundleBroadcast('remove:' + key);
      };
    }
  }

  function touchPresence(){
    var rows = listify(readJSON(KEY_SYNC_PEERS, []));
    var now = nowFn();
    var operator = currentOperator();
    var next = rows.filter(function(item){ return Date.now() - tsOf(item) < 45000 && clean(item.peerId) !== PEER_ID; });
    next.unshift({ peerId:PEER_ID, lastSeen:now, operatorId:clean(operator.id), operatorName:compact(operator.name), role:compact(operator.role), label:compact(operator.name || PEER_ID) });
    writeJSON(KEY_SYNC_PEERS, next.slice(0, 18));
    return next;
  }
  function readPeers(){ return listify(readJSON(KEY_SYNC_PEERS, [])).filter(function(item){ var age = Date.now() - tsOf(item); return !Number.isFinite(age) || age < 24 * 60 * 60 * 1000; }); }

  function appendSyncLog(direction, frame, result){
    var rows = listify(readJSON(KEY_SYNC_LOG, []));
    rows.unshift({
      id: uidFn(),
      at: nowFn(),
      direction: compact(direction) || 'out',
      frameId: clean(frame && frame.id),
      peerId: clean(frame && frame.peerId),
      type: compact(frame && frame.type),
      note: compact(result && result.note),
      status: compact(result && result.status) || 'ok'
    });
    writeJSON(KEY_SYNC_LOG, rows.slice(0, LIMIT));
    return rows[0];
  }
  function readSyncLog(){ return sortByTs(listify(readJSON(KEY_SYNC_LOG, []))).slice(0, LIMIT); }
  function readSyncOutbox(){ return sortByTs(listify(readJSON(KEY_SYNC_OUTBOX, []))).slice(0, LIMIT); }

  function createSyncFrame(type, payload){
    return {
      id: uidFn(),
      type: compact(type) || 'replica-bundle-delta',
      peerId: PEER_ID,
      at: nowFn(),
      version: 'v63',
      payload: payload && typeof payload === 'object' ? clone(payload) : {}
    };
  }

  function emitSyncFrame(type, payload){
    if(suppressBroadcast) return null;
    var frame = createSyncFrame(type, payload);
    var outbox = readSyncOutbox();
    outbox.unshift({ id: frame.id, at: frame.at, type: frame.type, peerId: frame.peerId, reason: compact(payload && payload.reason) });
    writeJSON(KEY_SYNC_OUTBOX, outbox.slice(0, LIMIT));
    rememberFrame(frame.id);
    appendSyncLog('out', frame, { status:'sent', note: compact(payload && payload.reason) || frame.type });
    try{ if(bc && typeof bc.postMessage === 'function') bc.postMessage(frame); }catch(_){ }
    try{
      suppressWatch++;
      localStorage.setItem(KEY_SYNC_SIGNAL, JSON.stringify(frame));
      suppressWatch--;
    }catch(_){ suppressWatch = Math.max(0, suppressWatch - 1); }
    return frame;
  }

  function scheduleBundleBroadcast(reason){
    if(suppressBroadcast) return;
    if(broadcastTimer) clearTimeout(broadcastTimer);
    broadcastTimer = setTimeout(function(){
      try{
        var bundle = buildBundle();
        emitSyncFrame('replica-bundle-delta', { reason: compact(reason) || 'state-change', bundle: bundle });
      }catch(_){ }
    }, 60);
  }

  function applySyncFrame(frame, opts){
    opts = opts || {};
    if(!frame || typeof frame !== 'object') return { status:'skipped', note:'Frame missing.' };
    if(seenFrame(frame.id)) return { status:'skipped', note:'Frame already applied.' };
    if(clean(frame.peerId) === PEER_ID && opts.remote) return { status:'skipped', note:'Own frame ignored.' };
    rememberFrame(frame.id);
    pruneSeenFrames();
    var result = { status:'ok', note:'Applied ' + compact(frame.type) };
    try{
      suppressBroadcast++;
      suppressWatch++;
      if(compact(frame.type) === 'replica-bundle-delta'){
        var api = v62();
        if(api && typeof api.importV62Bundle === 'function') api.importV62Bundle(frame.payload && frame.payload.bundle || {});
        result.note = 'Replica bundle merged.';
      } else if(compact(frame.type) === 'webhook-job'){
        enqueueWebhook((frame.payload || {}).source, (frame.payload || {}).eventType, (frame.payload || {}).payload || {});
        result.note = 'Webhook job imported.';
      } else if(compact(frame.type) === 'touch'){
        result.note = compact(frame.payload && frame.payload.reason) || 'Touch frame received.';
      } else {
        result.status = 'warn';
        result.note = 'Unknown frame type: ' + compact(frame.type);
      }
    }catch(err){
      result.status = 'bad';
      result.note = clean(err && err.message) || 'Frame apply failed.';
    }
    suppressWatch = Math.max(0, suppressWatch - 1);
    suppressBroadcast = Math.max(0, suppressBroadcast - 1);
    appendSyncLog('in', frame, result);
    return result;
  }

  function parsePacketCode(value){
    var text = clean(value);
    if(!text) return '';
    var match = text.match(/[?&#]phc=([^&#]+)/i);
    if(match && match[1]) return decodeURIComponent(match[1]);
    match = text.match(/\b(PHC-[A-Z0-9]{4}-[A-Z0-9]{4})\b/i);
    if(match && match[1]) return match[1].toUpperCase();
    match = text.match(/\b([A-Z0-9]{6,16})\b/i);
    return match && match[1] ? match[1].toUpperCase() : text.toUpperCase();
  }
  function logScannerEvent(kind, detail, meta){
    var rows = listify(readJSON(KEY_SCANNER_LOG, []));
    rows.unshift({ id:uidFn(), at:nowFn(), kind:compact(kind), detail:compact(detail), meta:meta && typeof meta === 'object' ? clone(meta) : {} });
    writeJSON(KEY_SCANNER_LOG, rows.slice(0, LIMIT));
    return rows[0];
  }
  function readScannerLog(){ return sortByTs(listify(readJSON(KEY_SCANNER_LOG, []))).slice(0, LIMIT); }

  function stopJoinScanner(){
    scannerState.active = false;
    if(scannerState.timer) clearTimeout(scannerState.timer);
    scannerState.timer = null;
    if(scannerState.stream && typeof scannerState.stream.getTracks === 'function'){
      scannerState.stream.getTracks().forEach(function(track){ try{ track.stop(); }catch(_){} });
    }
    if(scannerState.videoEl){ try{ scannerState.videoEl.srcObject = null; }catch(_){} }
    scannerState.stream = null;
    scannerState.detector = null;
    if(scannerState.statusEl) scannerState.statusEl.textContent = 'Scanner stopped.';
    logScannerEvent('scanner-stopped', 'Join scanner stopped.');
    return true;
  }

  function scanLoop(){
    if(!scannerState.active || !scannerState.videoEl || !scannerState.detector || typeof scannerState.detector.detect !== 'function') return;
    Promise.resolve(scannerState.detector.detect(scannerState.videoEl)).then(function(codes){
      if(!scannerState.active) return;
      if(Array.isArray(codes) && codes.length){
        var raw = clean(codes[0] && (codes[0].rawValue || codes[0].displayValue || ''));
        if(raw){
          var code = parsePacketCode(raw);
          logScannerEvent('scanner-hit', code, { raw:raw });
          if(scannerState.statusEl) scannerState.statusEl.textContent = 'Code detected: ' + code;
          if(typeof scannerState.onCode === 'function') scannerState.onCode(code, raw);
          stopJoinScanner();
          return;
        }
      }
      scannerState.timer = setTimeout(scanLoop, 280);
    }).catch(function(){ scannerState.timer = setTimeout(scanLoop, 600); });
  }

  function startJoinScanner(options){
    options = options || {};
    requirePermission('manage_qr', 'Current operator cannot use the join scanner.');
    stopJoinScanner();
    if(!(navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) throw new Error('Camera scanning is not available in this browser.');
    if(typeof BarcodeDetector !== 'function') throw new Error('BarcodeDetector is not available. Manual code entry is still available.');
    var videoEl = options.videoEl || null;
    var statusEl = options.statusEl || null;
    return navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS).then(function(stream){
      scannerState.stream = stream;
      scannerState.active = true;
      scannerState.videoEl = videoEl;
      scannerState.statusEl = statusEl;
      scannerState.onCode = typeof options.onCode === 'function' ? options.onCode : null;
      scannerState.detector = new BarcodeDetector({ formats:['qr_code'] });
      if(videoEl){
        try{ videoEl.srcObject = stream; }catch(_){ }
        if(typeof videoEl.play === 'function') try{ videoEl.play(); }catch(_){ }
      }
      if(statusEl) statusEl.textContent = 'Scanner live. Point the camera at a join packet QR code.';
      logScannerEvent('scanner-started', 'Join scanner started.');
      scannerState.timer = setTimeout(scanLoop, 240);
      return { ok:true, status:'live' };
    });
  }

  function redeemScanPayload(scanValue, guestPayload){
    requirePermission('manage_qr', 'Current operator cannot redeem join packets.');
    var code = parsePacketCode(scanValue);
    if(!code) throw new Error('No valid packet code detected.');
    var api = v60();
    if(!api || typeof api.redeemJoinPacket !== 'function') throw new Error('Join packet lane is unavailable.');
    var result = api.redeemJoinPacket(code, guestPayload || {});
    logScannerEvent('scanner-redeemed', code, { guestEmail: normalizeEmail(guestPayload && guestPayload.email), guestName: compact(guestPayload && guestPayload.name) });
    emitSyncFrame('touch', { reason:'join-packet-redeemed', code:code });
    return result;
  }

  function splitCsvLine(line){
    var out = [];
    var cur = '';
    var quoted = false;
    for(var i=0;i<line.length;i++){
      var ch = line[i];
      if(ch === '"'){
        if(quoted && line[i+1] === '"'){ cur += '"'; i++; }
        else quoted = !quoted;
      } else if(ch === ',' && !quoted){ out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out.map(function(item){ return clean(item); });
  }
  function parseCsv(text){
    var lines = String(text == null ? '' : text).replace(/\r/g, '').split('\n').filter(function(line){ return clean(line); });
    if(!lines.length) return [];
    var headers = splitCsvLine(lines[0]);
    return lines.slice(1).map(function(line){
      var cols = splitCsvLine(line);
      var row = {};
      headers.forEach(function(header, idx){ row[header] = cols[idx] == null ? '' : cols[idx]; });
      return row;
    });
  }
  function normalizeHeaderMap(row){
    var map = {};
    Object.keys(row || {}).forEach(function(key){ map[lower(key)] = row[key]; });
    return map;
  }
  function detectPosAdapter(rows){
    var first = rows && rows[0] || {};
    var keys = Object.keys(first).map(lower);
    if(keys.some(function(k){ return /square/.test(k); }) || keys.includes('gross sales') || keys.includes('total collected') || keys.includes('customer email')) return 'square';
    if(keys.includes('net sales') || keys.includes('check') || keys.includes('opened') || keys.includes('server')) return 'toast';
    if(keys.includes('order id') || keys.includes('employee') || keys.includes('card brand') || keys.includes('payment id')) return 'clover';
    return 'generic';
  }
  function firstDefined(map, candidates){
    for(var i=0;i<candidates.length;i++){
      var base = lower(candidates[i]);
      var tries = [base, base.replace(/\s+/g, '_'), base.replace(/\s+/g, ''), base.replace(/\s+/g, '-')];
      for(var j=0;j<tries.length;j++){
        var value = map[tries[j]];
        if(clean(value)) return value;
      }
    }
    return '';
  }
  function locateLocationIdByLabel(label, fallbackLocationId){
    if(clean(fallbackLocationId) && findLocation(fallbackLocationId)) return clean(fallbackLocationId);
    var value = lower(label);
    var rows = listify(state().locations);
    var hit = rows.find(function(item){ return lower(item.name) === value || lower(item.serviceArea || item.territory) === value; });
    return hit ? hit.id : clean(rows[0] && rows[0].id);
  }
  function normalizePosRow(row, adapter, defaults){
    defaults = defaults || {};
    var map = normalizeHeaderMap(row);
    var when = firstDefined(map, ['at','date','timestamp','opened','created at','created']);
    var locationLabel = firstDefined(map, ['location','location name','site']);
    var itemCount = firstDefined(map, ['items','item count','quantity','covers','guests']);
    var amountRaw = firstDefined(map, adapter === 'toast' ? ['net sales','total','amount'] : adapter === 'square' ? ['total collected','gross sales','amount','amount money','total'] : ['amount','total','net sales','gross sales']);
    var guestName = firstDefined(map, ['guest name','customer name','customer','name']);
    var guestEmail = firstDefined(map, ['guest email','customer email','email']);
    var guestPhone = firstDefined(map, ['guest phone','phone','phone number']);
    var channel = compact(firstDefined(map, ['channel','source'])) || (adapter === 'generic' ? 'imported-pos' : (adapter + '-adapter'));
    var note = compact(firstDefined(map, ['note','notes','details','items summary']));
    return {
      locationId: locateLocationIdByLabel(locationLabel, defaults.locationId),
      guestName: guestName,
      guestEmail: guestEmail,
      guestPhone: guestPhone,
      amount: num(String(amountRaw).replace(/[^0-9.-]/g, '')),
      items: Math.max(1, Math.round(num(itemCount || 1) || 1)),
      channel: channel,
      note: note,
      at: when ? new Date(when).toISOString ? new Date(when).toISOString() : nowFn() : nowFn()
    };
  }
  function readAdapterRuns(){ return sortByTs(listify(readJSON(KEY_POS_ADAPTER_RUNS, []))).slice(0, LIMIT); }
  function importPosAdapterData(payload){
    requirePermission('manage_pos', 'Current operator cannot run POS adapters.');
    payload = payload || {};
    var rows = [];
    if(Array.isArray(payload.rows)) rows = payload.rows;
    else if(compact(payload.text).charAt(0) === '[' || compact(payload.text).charAt(0) === '{'){
      var parsed = JSON.parse(payload.text);
      rows = Array.isArray(parsed) ? parsed : listify(parsed.rows);
    } else rows = parseCsv(payload.text || '');
    if(!rows.length) throw new Error('No import rows detected.');
    var adapter = compact(payload.adapter) && compact(payload.adapter) !== 'auto' ? compact(payload.adapter) : detectPosAdapter(rows);
    var normalized = rows.map(function(row){ return normalizePosRow(row, adapter, { locationId: payload.locationId }); }).filter(function(row){ return row.locationId && row.amount > 0; });
    if(!normalized.length) throw new Error('No valid POS rows were normalized.');
    var api = v60();
    if(!api || typeof api.importPosRows !== 'function') throw new Error('POS lane unavailable.');
    var created = api.importPosRows(normalized);
    var run = { id:uidFn(), at:nowFn(), adapter:adapter, source:compact(payload.source) || 'manual-import', count:normalized.length, created:created.length, locationId:clean(payload.locationId), headers:Object.keys(rows[0] || {}) };
    var runs = readAdapterRuns();
    runs.unshift(run);
    writeJSON(KEY_POS_ADAPTER_RUNS, runs.slice(0, LIMIT));
    emitSyncFrame('touch', { reason:'pos-adapter-import', adapter:adapter, created:created.length });
    return { adapter:adapter, normalized:normalized, created:created, run:run };
  }

  function normalizeWebhook(source, eventType, payload){
    return {
      id: uidFn(),
      at: nowFn(),
      source: compact(source) || 'manual',
      eventType: compact(eventType) || 'unknown',
      payload: payload && typeof payload === 'object' ? clone(payload) : {},
      status: 'queued'
    };
  }
  function readWebhookInbox(){ return sortByTs(listify(readJSON(KEY_WEBHOOK_INBOX, []))).slice(0, LIMIT); }
  function readJobs(){ return sortByTs(listify(readJSON(KEY_JOB_QUEUE, []))).slice(0, LIMIT); }
  function readDeadJobs(){ return sortByTs(listify(readJSON(KEY_JOB_DEAD, []))).slice(0, LIMIT); }
  function enqueueWebhook(source, eventType, payload){
    requirePermission('manage_bridge', 'Current operator cannot enqueue webhook jobs.');
    var webhook = normalizeWebhook(source, eventType, payload);
    var inbox = readWebhookInbox();
    inbox.unshift(webhook);
    writeJSON(KEY_WEBHOOK_INBOX, inbox.slice(0, LIMIT));
    var jobs = readJobs();
    jobs.unshift({ id:uidFn(), webhookId:webhook.id, source:webhook.source, eventType:webhook.eventType, payload:webhook.payload, status:'queued', createdAt:webhook.at, startedAt:'', finishedAt:'', error:'' });
    writeJSON(KEY_JOB_QUEUE, jobs.slice(0, LIMIT));
    emitSyncFrame('webhook-job', { source:webhook.source, eventType:webhook.eventType, payload:webhook.payload });
    return webhook;
  }
  function markWebhookStatus(webhookId, status){
    var rows = readWebhookInbox().map(function(item){ return clean(item.id) === clean(webhookId) ? Object.assign({}, item, { status:compact(status) || item.status }) : item; });
    writeJSON(KEY_WEBHOOK_INBOX, rows);
  }
  function runJob(job){
    var api60 = v60();
    var api62 = v62();
    if(!job) throw new Error('Job missing.');
    var payload = job.payload || {};
    if(/(square|toast|clover)\./i.test(job.eventType) || /pos\.sale/i.test(job.eventType)){
      var adapter = /toast/i.test(job.eventType) ? 'toast' : /clover/i.test(job.eventType) ? 'clover' : /square/i.test(job.eventType) ? 'square' : 'generic';
      return importPosAdapterData({ adapter:adapter, rows:[payload], locationId:payload.locationId, source:job.source + ':' + job.eventType });
    }
    if(job.eventType === 'phc.packet.redeem'){
      return redeemScanPayload(payload.code || payload.url || payload.scanValue, payload.guest || payload);
    }
    if(job.eventType === 'phc.replica.bundle'){
      if(!api62 || typeof api62.importV62Bundle !== 'function') throw new Error('Replica bundle lane unavailable.');
      return api62.importV62Bundle(payload.bundle || {});
    }
    if(job.eventType === 'phc.dispatch.wave'){
      if(!api62 || typeof api62.buildWaveFromOpenCases !== 'function') throw new Error('Dispatch wave lane unavailable.');
      return api62.buildWaveFromOpenCases(payload);
    }
    if(job.eventType === 'phc.readiness.run'){
      if(!api62 || typeof api62.createReadinessRun !== 'function') throw new Error('Readiness lane unavailable.');
      return api62.createReadinessRun(payload);
    }
    if(job.eventType === 'phc.pos.rows'){
      if(!api60 || typeof api60.importPosRows !== 'function') throw new Error('POS lane unavailable.');
      return api60.importPosRows(listify(payload.rows));
    }
    throw new Error('Unsupported event type ' + job.eventType);
  }
  function runNextJob(){
    requirePermission('manage_bridge', 'Current operator cannot run background jobs.');
    var jobs = readJobs();
    var index = jobs.findIndex(function(item){ return compact(item.status) === 'queued'; });
    if(index < 0) return null;
    var current = Object.assign({}, jobs[index], { status:'running', startedAt:nowFn() });
    jobs[index] = current;
    writeJSON(KEY_JOB_QUEUE, jobs);
    try{
      var result = runJob(current);
      current.status = 'completed';
      current.finishedAt = nowFn();
      current.error = '';
      jobs[index] = current;
      writeJSON(KEY_JOB_QUEUE, jobs);
      markWebhookStatus(current.webhookId, 'completed');
      emitSyncFrame('touch', { reason:'job-completed', eventType:current.eventType });
      return { job:current, result:result };
    }catch(err){
      current.status = 'dead';
      current.finishedAt = nowFn();
      current.error = clean(err && err.message) || 'Job failed.';
      jobs[index] = current;
      writeJSON(KEY_JOB_QUEUE, jobs);
      var dead = readDeadJobs();
      dead.unshift(current);
      writeJSON(KEY_JOB_DEAD, dead.slice(0, LIMIT));
      markWebhookStatus(current.webhookId, 'dead');
      return { job:current, error:current.error };
    }
  }
  function runJobQueue(limit){
    limit = Math.max(1, Math.min(25, Math.round(num(limit || 10))));
    var out = [];
    for(var i=0;i<limit;i++){
      var step = runNextJob();
      if(!step) break;
      out.push(step);
    }
    return out;
  }
  function replayDeadJob(jobId){
    requirePermission('manage_bridge', 'Current operator cannot replay dead jobs.');
    var dead = readDeadJobs();
    var hit = dead.find(function(item){ return clean(item.id) === clean(jobId); });
    if(!hit) throw new Error('Dead job not found.');
    var jobs = readJobs();
    jobs.unshift({ id:uidFn(), webhookId:hit.webhookId, source:hit.source, eventType:hit.eventType, payload:clone(hit.payload || {}), status:'queued', createdAt:nowFn(), startedAt:'', finishedAt:'', error:'' });
    writeJSON(KEY_JOB_QUEUE, jobs.slice(0, LIMIT));
    return jobs[0];
  }

  function buildV63Metrics(){
    var jobs = readJobs();
    return {
      peers: readPeers().length,
      syncFrames: readSyncLog().length,
      adapterRuns: readAdapterRuns().length,
      scannerEvents: readScannerLog().length,
      queuedJobs: jobs.filter(function(item){ return item.status === 'queued' || item.status === 'running'; }).length,
      completedJobs: jobs.filter(function(item){ return item.status === 'completed'; }).length,
      deadJobs: readDeadJobs().length
    };
  }

  function openScannerModal(){
    var stateValue = state();
    var locations = listify(stateValue.locations);
    var locationOptions = locations.map(function(item){ return '<option value="' + attr(item.id) + '">' + esc(item.name) + '</option>'; }).join('');
    openModalFn('Live QR scanner · V63', '<div class="hint">V63 adds a real camera-based join scanner where the browser supports BarcodeDetector, plus manual fallback entry.</div><div class="sep"></div><div class="fieldrow"><div class="field full"><label>Live scanner</label><video id="hc63_scan_video" autoplay playsinline muted style="width:100%;max-height:260px;border-radius:16px;background:#000"></video><div id="hc63_scan_status" class="hint" style="margin-top:8px;">Scanner idle.</div></div><div class="field"><label>Packet code / URL</label><input id="hc63_scan_code" placeholder="Paste code or let the camera fill this"/></div><div class="field"><label>Location hint</label><select id="hc63_scan_location"><option value="">Auto</option>' + locationOptions + '</select></div><div class="field"><label>Guest name</label><input id="hc63_scan_name" placeholder="Jordan Guest"/></div><div class="field"><label>Guest email</label><input id="hc63_scan_email" placeholder="guest@example.com"/></div><div class="field"><label>Guest phone</label><input id="hc63_scan_phone" placeholder="555-1111"/></div><div class="field full"><label>Note</label><textarea id="hc63_scan_note" placeholder="VIP table arrival, member redemption, concierge note."></textarea></div></div>', '<button class="btn" id="hc63_scan_start">Start camera</button><button class="btn" id="hc63_scan_stop">Stop</button><button class="btn primary" id="hc63_scan_redeem">Redeem</button>');
    var videoEl = document.getElementById('hc63_scan_video');
    var statusEl = document.getElementById('hc63_scan_status');
    var startBtn = document.getElementById('hc63_scan_start');
    var stopBtn = document.getElementById('hc63_scan_stop');
    var redeemBtn = document.getElementById('hc63_scan_redeem');
    if(startBtn) startBtn.onclick = function(){
      startJoinScanner({
        videoEl: videoEl,
        statusEl: statusEl,
        onCode: function(code){ var input = document.getElementById('hc63_scan_code'); if(input) input.value = code; }
      }).catch(function(err){ if(statusEl) statusEl.textContent = clean(err && err.message) || 'Scanner failed.'; });
    };
    if(stopBtn) stopBtn.onclick = stopJoinScanner;
    if(redeemBtn) redeemBtn.onclick = function(){
      try{
        var result = redeemScanPayload((document.getElementById('hc63_scan_code') || {}).value, {
          name: (document.getElementById('hc63_scan_name') || {}).value,
          email: (document.getElementById('hc63_scan_email') || {}).value,
          phone: (document.getElementById('hc63_scan_phone') || {}).value,
          note: (document.getElementById('hc63_scan_note') || {}).value,
          locationId: (document.getElementById('hc63_scan_location') || {}).value
        });
        stopJoinScanner();
        closeModalFn();
        toastFn('Packet redeemed for ' + compact(result && result.checkin && result.checkin.guestName || 'guest') + '.', 'good');
      }catch(err){ toastFn(clean(err && err.message) || 'Redeem failed.', 'bad'); }
    };
  }

  function openAdapterModal(){
    var locations = listify(state().locations);
    var locationOptions = locations.map(function(item){ return '<option value="' + attr(item.id) + '">' + esc(item.name) + '</option>'; }).join('');
    openModalFn('POS adapters · V63', '<div class="hint">Paste Square, Toast, Clover, generic CSV, or JSON rows. V63 normalizes them into the Platform House POS lane.</div><div class="sep"></div><div class="fieldrow"><div class="field"><label>Adapter</label><select id="hc63_adapter_kind"><option value="auto">Auto detect</option><option value="square">Square</option><option value="toast">Toast</option><option value="clover">Clover</option><option value="generic">Generic</option></select></div><div class="field"><label>Fallback location</label><select id="hc63_adapter_location"><option value="">Auto</option>' + locationOptions + '</select></div><div class="field full"><label>CSV or JSON rows</label><textarea id="hc63_adapter_text" style="min-height:220px" placeholder="Paste CSV or JSON array here"></textarea></div><div class="field full"><div id="hc63_adapter_preview" class="hint">No preview yet.</div></div></div>', '<button class="btn" id="hc63_adapter_preview_btn">Preview</button><button class="btn primary" id="hc63_adapter_import_btn">Import</button>');
    function previewOnly(doImport){
      try{
        var out = importPosAdapterData({
          adapter: (document.getElementById('hc63_adapter_kind') || {}).value,
          locationId: (document.getElementById('hc63_adapter_location') || {}).value,
          text: (document.getElementById('hc63_adapter_text') || {}).value,
          source: doImport ? 'modal-import' : 'modal-preview'
        });
        var host = document.getElementById('hc63_adapter_preview');
        if(host) host.innerHTML = 'Adapter <span class="badge">' + esc(out.adapter) + '</span> • Normalized <span class="mono">' + esc(String(out.normalized.length)) + '</span> • Created <span class="mono">' + esc(String(out.created.length)) + '</span>.';
        if(!doImport){
          writeJSON(KEY_POS_ADAPTER_RUNS, readAdapterRuns().filter(function(item){ return clean(item.id) !== clean(out.run.id); }));
        } else closeModalFn();
      }catch(err){
        var host2 = document.getElementById('hc63_adapter_preview');
        if(host2) host2.textContent = clean(err && err.message) || 'Preview failed.';
      }
    }
    var previewBtn = document.getElementById('hc63_adapter_preview_btn');
    var importBtn = document.getElementById('hc63_adapter_import_btn');
    if(previewBtn) previewBtn.onclick = function(){ previewOnly(false); };
    if(importBtn) importBtn.onclick = function(){ previewOnly(true); };
  }

  function renderWebhookRows(rows){
    return rows.length ? rows.map(function(item){ return '<div class="item"><div class="meta"><div class="name">' + esc(item.eventType) + ' <span class="badge">' + esc(item.status) + '</span></div><div class="sub">' + esc(item.source) + ' • ' + esc(fmtFn(item.at)) + '</div></div></div>'; }).join('') : '<div class="hint">No webhooks queued.</div>';
  }
  function renderJobRows(rows){
    return rows.length ? rows.map(function(item){ return '<div class="item"><div class="meta"><div class="name">' + esc(item.eventType) + ' <span class="badge">' + esc(item.status) + '</span></div><div class="sub">' + esc(item.source) + (item.error ? ' • ' + esc(item.error) : '') + '</div></div>' + (item.status === 'dead' ? '<div class="actions"><button class="btn small" data-hc63_replay_job="' + attr(item.id) + '">Replay</button></div>' : '') + '</div>'; }).join('') : '<div class="hint">No jobs yet.</div>';
  }
  function openJobsModal(){
    var inbox = readWebhookInbox().slice(0, 8);
    var jobs = readJobs().slice(0, 10);
    var dead = readDeadJobs().slice(0, 6);
    openModalFn('Jobs and webhooks · V63', '<div class="hint">V63 adds a local webhook inbox and background job queue so integrations can be staged, replayed, and dead-lettered inside the stack.</div><div class="sep"></div><div class="fieldrow"><div class="field"><label>Source</label><input id="hc63_job_source" value="manual"/></div><div class="field"><label>Event type</label><input id="hc63_job_event" value="phc.dispatch.wave"/></div><div class="field full"><label>Payload JSON</label><textarea id="hc63_job_payload" style="min-height:120px">{"count":2}</textarea></div><div class="field full"><div class="hint"><strong>Webhook inbox</strong></div>' + renderWebhookRows(inbox) + '</div><div class="field full"><div class="hint"><strong>Jobs</strong></div>' + renderJobRows(jobs) + '</div><div class="field full"><div class="hint"><strong>Dead letters</strong></div>' + renderJobRows(dead) + '</div></div>', '<button class="btn" id="hc63_job_enqueue">Enqueue</button><button class="btn" id="hc63_job_step">Run next</button><button class="btn primary" id="hc63_job_runall">Run queue</button>');
    var enqueueBtn = document.getElementById('hc63_job_enqueue');
    var stepBtn = document.getElementById('hc63_job_step');
    var allBtn = document.getElementById('hc63_job_runall');
    if(enqueueBtn) enqueueBtn.onclick = function(){
      try{
        enqueueWebhook((document.getElementById('hc63_job_source') || {}).value, (document.getElementById('hc63_job_event') || {}).value, JSON.parse((document.getElementById('hc63_job_payload') || {}).value || '{}'));
        openJobsModal();
      }catch(err){ toastFn(clean(err && err.message) || 'Enqueue failed.', 'bad'); }
    };
    if(stepBtn) stepBtn.onclick = function(){ try{ runNextJob(); openJobsModal(); }catch(err){ toastFn(clean(err && err.message) || 'Run next failed.', 'bad'); } };
    if(allBtn) allBtn.onclick = function(){ try{ runJobQueue(12); openJobsModal(); }catch(err){ toastFn(clean(err && err.message) || 'Run queue failed.', 'bad'); } };
    Array.from(document.querySelectorAll('[data-hc63_replay_job]')).forEach(function(btn){ btn.onclick = function(){ try{ replayDeadJob(btn.getAttribute('data-hc63_replay_job')); openJobsModal(); }catch(err){ toastFn(clean(err && err.message) || 'Replay failed.', 'bad'); } }; });
  }

  function renderSyncRows(rows){
    return rows.length ? rows.map(function(item){ return '<div class="item"><div class="meta"><div class="name">' + esc(item.type) + ' <span class="badge">' + esc(item.direction) + '</span></div><div class="sub">' + esc(item.peerId || '—') + ' • ' + esc(fmtFn(item.at)) + (item.note ? ' • ' + esc(item.note) : '') + '</div></div></div>'; }).join('') : '<div class="hint">No sync frames yet.</div>';
  }
  function openSyncModal(){
    var peers = readPeers();
    var frameText = JSON.stringify(createSyncFrame('replica-bundle-delta', { reason:'manual-export', bundle: buildBundle() }), null, 2);
    openModalFn('Realtime mesh · V63', '<div class="hint">V63 adds a local realtime mesh: peer heartbeat, replica-delta frames, BroadcastChannel sync, storage-signal sync, and manual frame paste/apply.</div><div class="sep"></div><div class="fieldrow"><div class="field full"><label>Peers</label><div class="row" style="flex-wrap:wrap;">' + (peers.length ? peers.map(function(item){ return '<div class="pill">' + esc(item.label || item.peerId) + ' • ' + esc(item.role || 'operator') + '</div>'; }).join('') : '<span class="hint">Only this tab is present right now.</span>') + '</div></div><div class="field full"><label>Latest replica frame</label><textarea id="hc63_sync_text" style="min-height:220px">' + esc(frameText) + '</textarea></div><div class="field full"><div class="hint"><strong>Recent sync log</strong></div>' + renderSyncRows(readSyncLog().slice(0, 8)) + '</div></div>', '<button class="btn" id="hc63_sync_push">Push local bundle</button><button class="btn primary" id="hc63_sync_apply">Apply frame</button>');
    var pushBtn = document.getElementById('hc63_sync_push');
    var applyBtn = document.getElementById('hc63_sync_apply');
    if(pushBtn) pushBtn.onclick = function(){ emitSyncFrame('replica-bundle-delta', { reason:'manual-push', bundle: buildBundle() }); openSyncModal(); };
    if(applyBtn) applyBtn.onclick = function(){ try{ var frame = JSON.parse((document.getElementById('hc63_sync_text') || {}).value || '{}'); applySyncFrame(frame, { remote:true, via:'manual' }); openSyncModal(); }catch(err){ toastFn(clean(err && err.message) || 'Apply frame failed.', 'bad'); } };
  }

  function injectStyles(){
    if(document.getElementById('hc_v63_styles')) return;
    var style = document.createElement('style');
    style.id = 'hc_v63_styles';
    style.textContent = '.hc-v63-kpi{min-width:140px;padding:14px 16px;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:rgba(255,255,255,.04)}.hc-v63-kpi .n{font-size:1.5rem;font-weight:700}.hc-v63-kpi .d{font-size:.82rem;opacity:.78}';
    (document.head || document.body).appendChild(style);
  }

  function renderV63Card(){
    if(!(typeof APP !== 'undefined' && APP && APP.view === 'platform-house')) return;
    var host = document.querySelector('#content') || document.querySelector('#app') || document.body;
    if(!host) return;
    var old = document.getElementById('hc_v63_card');
    if(old && old.remove) old.remove();
    var metrics = buildV63Metrics();
    var card = document.createElement('div');
    card.id = 'hc_v63_card';
    card.className = 'card';
    card.innerHTML = '<h2 style="margin:0 0 8px;">Platform House Live Ops Mesh · V63</h2><div class="hint">This pass lands the remaining implementation lanes still within local control: camera QR scanning, vendor POS adapters, background webhooks/jobs, and realtime local sync frames.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;">' +
      '<div class="hc-v63-kpi"><div class="n">' + esc(String(metrics.peers)) + '</div><div class="d">Live peers</div></div>' +
      '<div class="hc-v63-kpi"><div class="n">' + esc(String(metrics.adapterRuns)) + '</div><div class="d">Adapter runs</div></div>' +
      '<div class="hc-v63-kpi"><div class="n">' + esc(String(metrics.scannerEvents)) + '</div><div class="d">Scanner events</div></div>' +
      '<div class="hc-v63-kpi"><div class="n">' + esc(String(metrics.queuedJobs)) + '</div><div class="d">Queued jobs</div></div>' +
      '<div class="hc-v63-kpi"><div class="n">' + esc(String(metrics.deadJobs)) + '</div><div class="d">Dead letters</div></div>' +
      '</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;justify-content:flex-end;"><button class="btn" id="hc63_scan_open">Live QR scanner</button><button class="btn" id="hc63_adapter_open">POS adapters</button><button class="btn" id="hc63_jobs_open">Jobs & webhooks</button><button class="btn primary" id="hc63_sync_open">Realtime mesh</button></div>';
    host.appendChild(card);
    var scanBtn = document.getElementById('hc63_scan_open');
    var adapterBtn = document.getElementById('hc63_adapter_open');
    var jobsBtn = document.getElementById('hc63_jobs_open');
    var syncBtn = document.getElementById('hc63_sync_open');
    if(scanBtn) scanBtn.onclick = openScannerModal;
    if(adapterBtn) adapterBtn.onclick = openAdapterModal;
    if(jobsBtn) jobsBtn.onclick = openJobsModal;
    if(syncBtn) syncBtn.onclick = openSyncModal;
  }

  function injectDashboardCard(){
    if(!(typeof APP !== 'undefined' && APP && APP.view === 'dashboard')) return;
    var grid = document.querySelector('#content .grid');
    if(!grid) return;
    var old = document.getElementById('hc_v63_dash_card');
    if(old && old.remove) old.remove();
    var metrics = buildV63Metrics();
    var card = document.createElement('div');
    card.id = 'hc_v63_dash_card';
    card.className = 'card';
    card.style.gridColumn = 'span 12';
    card.innerHTML = '<h2>Platform House V63</h2><div class="hint">Live QR scanning, POS adapters, realtime local sync, and webhook/job execution now exist inside the same shell.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;"><div class="pill">Peers ' + esc(String(metrics.peers)) + '</div><div class="pill">Jobs ' + esc(String(metrics.queuedJobs)) + '</div><div class="pill">Adapter runs ' + esc(String(metrics.adapterRuns)) + '</div><button class="btn" id="hc_v63_dash_open">Open live ops mesh</button></div>';
    grid.insertBefore(card, grid.children[1] || null);
    var btn = document.getElementById('hc_v63_dash_open');
    if(btn) btn.onclick = function(){ APP.routeId = null; APP.view = 'platform-house'; window.location.hash = 'platform-house'; if(typeof render === 'function') render(); };
  }

  function patchRender(){
    if(window.__ROUTEX_HC_V63_RENDER__) return;
    window.__ROUTEX_HC_V63_RENDER__ = true;
    var prev = typeof render === 'function' ? render : null;
    if(!prev) return;
    render = async function(){
      var out = await prev.apply(this, arguments);
      raf(function(){ try{ renderV63Card(); injectDashboardCard(); }catch(_){ } });
      return out;
    };
  }

  function patchBaseApis(){
    if(window.__ROUTEX_HC_V63_API_PATCHED__) return;
    window.__ROUTEX_HC_V63_API_PATCHED__ = true;
    var api = base();
    if(api){
      api.startJoinScanner = startJoinScanner;
      api.stopJoinScanner = stopJoinScanner;
      api.redeemScanPayload = redeemScanPayload;
      api.importPosAdapterData = importPosAdapterData;
      api.enqueueWebhook = enqueueWebhook;
      api.runJobQueue = runJobQueue;
      api.buildV63Metrics = buildV63Metrics;
      api.createSyncFrame = createSyncFrame;
      api.applySyncFrame = applySyncFrame;
    }
  }

  function firstRunSeed(){
    touchPresence();
    if(!readSyncLog().length) appendSyncLog('local', { id:'seed', type:'v63-seeded', peerId:PEER_ID }, { status:'ok', note:'Live mesh seeded.' });
  }

  function installSignalListener(){
    if(window.__ROUTEX_HC_V63_SIGNAL_LISTENER__) return;
    window.__ROUTEX_HC_V63_SIGNAL_LISTENER__ = true;
    if(typeof window.addEventListener === 'function'){
      window.addEventListener('storage', function(evt){
        try{
          if(!evt || clean(evt.key) !== KEY_SYNC_SIGNAL || !evt.newValue) return;
          applySyncFrame(JSON.parse(evt.newValue), { remote:true, via:'storage' });
        }catch(_){ }
      });
    }
  }

  function init(){
    if(!base() || !v60() || !v61() || !v62()) return setTimeout(init, 40);
    initChannel();
    patchLocalStorage();
    installSignalListener();
    injectStyles();
    firstRunSeed();
    patchBaseApis();
    patchRender();
    touchPresence();
    raf(function(){ try{ renderV63Card(); injectDashboardCard(); }catch(_){ } });
    window.RoutexPlatformHouseCircleV63 = {
      createSyncFrame: createSyncFrame,
      emitSyncFrame: emitSyncFrame,
      applySyncFrame: applySyncFrame,
      readSyncLog: readSyncLog,
      readPeers: readPeers,
      touchPresence: touchPresence,
      parsePacketCode: parsePacketCode,
      startJoinScanner: startJoinScanner,
      stopJoinScanner: stopJoinScanner,
      redeemScanPayload: redeemScanPayload,
      readScannerLog: readScannerLog,
      parseCsv: parseCsv,
      detectPosAdapter: detectPosAdapter,
      importPosAdapterData: importPosAdapterData,
      readAdapterRuns: readAdapterRuns,
      enqueueWebhook: enqueueWebhook,
      readWebhookInbox: readWebhookInbox,
      readJobs: readJobs,
      readDeadJobs: readDeadJobs,
      runNextJob: runNextJob,
      runJobQueue: runJobQueue,
      replayDeadJob: replayDeadJob,
      buildV63Metrics: buildV63Metrics,
      openScannerModal: openScannerModal,
      openAdapterModal: openAdapterModal,
      openJobsModal: openJobsModal,
      openSyncModal: openSyncModal
    };
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
