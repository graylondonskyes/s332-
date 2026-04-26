(function(){
  if(window.__ROUTEX_HOUSECIRCLE_V65__) return;
  window.__ROUTEX_HOUSECIRCLE_V65__ = true;

  var KEY_CFG = 'skye_routex_platform_house_circle_cloud_config_v64';
  var KEY_SESSION = 'skye_routex_platform_house_circle_cloud_session_v64';
  var KEY_SUMMARY = 'skye_routex_platform_house_circle_v65_summary';
  var clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  var esc = window.escapeHTML || function(v){ return String(v == null ? '' : v); };
  var compact = function(v){ return clean(v).replace(/\s+/g, ' ').trim(); };
  var uidFn = (typeof uid === 'function') ? uid : function(){ return 'hc65-' + Math.random().toString(36).slice(2,10); };
  var nowFn = (typeof nowISO === 'function') ? nowISO : function(){ return new Date().toISOString(); };
  var toastFn = (typeof toast === 'function') ? toast : function(){};
  var openModalFn = (typeof openModal === 'function') ? openModal : function(title){ try{ alert(title); }catch(_){} };
  function readJSON(key, fallback){ try{ var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); return value; }
  function readCfg(){ return { enabled:false, orgId:'platform-house-main', deviceId:'device-' + uidFn(), basePath:'/.netlify/functions', ...(readJSON(KEY_CFG, {}) || {}) }; }
  function readSession(){ return readJSON(KEY_SESSION, null); }
  function summary(){ return readJSON(KEY_SUMMARY, {}) || {}; }
  function saveSummary(patch){ return writeJSON(KEY_SUMMARY, { ...(summary() || {}), ...(patch || {}), updatedAt: nowFn() }); }
  function authHeaders(){ var headers = { 'content-type':'application/json' }; var s = readSession(); if(s && s.token) headers.authorization = 'Bearer ' + s.token; return headers; }
  function endpoint(path){ var cfg = readCfg(); return compact(cfg.basePath || '/.netlify/functions').replace(/\/$/, '') + '/' + String(path || '').replace(/^\//, ''); }
  async function cloudFetch(path, opts){
    opts = opts || {};
    var res = await fetch(endpoint(path), { method: opts.method || 'GET', headers: { ...authHeaders(), ...(opts.headers || {}) }, body: opts.body == null ? undefined : JSON.stringify(opts.body) });
    var json = await res.json();
    if(!res.ok || json.ok === false) throw new Error(clean(json && json.error) || ('Request failed (' + res.status + ').'));
    return json;
  }
  function currentOperator(){
    var api = window.RoutexPlatformHouseCircleV60;
    return api && typeof api.currentOperator === 'function' ? api.currentOperator() : { id:'founder-admin', name:'Skyes Over London', role:'founder_admin' };
  }
  async function enrollMfa(input){
    var cfg = readCfg();
    var op = currentOperator();
    var json = await cloudFetch('phc-auth-mfa-enroll', { method:'POST', body:{ orgId: cfg.orgId, operatorId: op.id, operatorName: op.name, deviceId: cfg.deviceId, label: (input && input.label) || (op.name + ' · ' + cfg.orgId), platform: (input && input.platform) || '' } });
    saveSummary({ mfa: json.record, otpAuthUrl: json.otpAuthUrl, recoveryCodes: json.recoveryCodes || [] });
    return json;
  }
  async function verifyMfa(code, opts){
    opts = opts || {};
    var cfg = readCfg();
    var op = currentOperator();
    var body = { orgId: cfg.orgId, operatorId: op.id, deviceId: cfg.deviceId, trustDevice: opts.trustDevice !== false, platform: opts.platform || '', userAgent: opts.userAgent || '' };
    if(opts.recoveryCode) body.recoveryCode = opts.recoveryCode; else body.code = clean(code);
    var json = await cloudFetch('phc-auth-mfa-verify', { method:'POST', body: body });
    saveSummary({ mfa: json.record, mfaTrustedDevice: json.trustedDevice });
    return json;
  }
  async function registerDevice(input){
    input = input || {};
    var cfg = readCfg();
    var op = currentOperator();
    var json = await cloudFetch('phc-device-register', { method:'POST', body:{ orgId: cfg.orgId, operatorId: op.id, operatorName: op.name, deviceId: cfg.deviceId, label: input.label || 'Primary browser', platform: input.platform || 'web', userAgent: input.userAgent || '', fingerprint: input.fingerprint || '', trusted: input.trusted !== false } });
    saveSummary({ devices: json.devices || [] });
    return json;
  }
  async function acquireLock(resourceType, resourceId, ttlSec, note){
    var cfg = readCfg();
    var json = await cloudFetch('phc-lock-acquire', { method:'POST', body:{ orgId: cfg.orgId, deviceId: cfg.deviceId, resourceType: resourceType, resourceId: resourceId, ttlSec: ttlSec || 120, note: note || '' } });
    saveSummary({ locks: json.locks || [] });
    return json;
  }
  async function releaseLock(lockId, resourceType, resourceId){
    var cfg = readCfg();
    var json = await cloudFetch('phc-lock-release', { method:'POST', body:{ orgId: cfg.orgId, lockId: lockId || '', resourceType: resourceType || '', resourceId: resourceId || '' } });
    saveSummary({ locks: json.locks || [] });
    return json;
  }
  async function fetchEventFeed(limit){
    var cfg = readCfg();
    var json = await cloudFetch('phc-event-feed?orgId=' + encodeURIComponent(cfg.orgId) + '&limit=' + encodeURIComponent(limit || 24), { method:'GET' });
    saveSummary({ feed: json, locks: json.locks || [], devices: json.devices || [], mfaState: json.mfa || [] });
    return json;
  }
  function buildV65Metrics(){
    var feed = summary().feed || {};
    var mfa = summary().mfa || {};
    return {
      mfaEnabled: !!mfa.enabled,
      recoveryCodes: (summary().recoveryCodes || []).length,
      devices: (summary().devices || feed.devices || []).length,
      locks: (summary().locks || feed.locks || []).length,
      events: (feed.events || []).length,
      activeSessions: (feed.sessions || []).length,
      trustedDevice: !!summary().mfaTrustedDevice
    };
  }
  function rowHtml(rows, field){ return (rows || []).slice(0, 6).map(function(item){ return '<div class="item"><div class="meta"><div class="name">' + esc(item[field] || item.kind || item.id || 'row') + '</div><div class="sub">' + esc(item.updatedAt || item.at || item.leaseUntil || '') + '</div></div></div>'; }).join('') || '<div class="hint">Nothing yet.</div>'; }
  function openMfaOpsModal(){
    var s = summary();
    var m = buildV65Metrics();
    openModalFn('Platform House security + coordination · V65', '<div class="hint">V65 lands operator MFA, trusted device registry, lock leasing, and a server-side event feed so the stack can coordinate more safely across concurrent operators.</div><div class="sep"></div><div class="fieldrow"><div class="field"><label>MFA status</label><div class="hint">' + esc(m.mfaEnabled ? 'enabled' : 'not enabled') + '</div></div><div class="field"><label>Trusted device</label><div class="hint">' + esc(m.trustedDevice ? 'yes' : 'no') + '</div></div><div class="field"><label>Registered devices</label><div class="hint">' + esc(String(m.devices)) + '</div></div><div class="field"><label>Active locks</label><div class="hint">' + esc(String(m.locks)) + '</div></div><div class="field full"><label>Current one-time code</label><input id="hc65_code" placeholder="123456"/></div><div class="field full"><label>Recovery code</label><input id="hc65_recovery" placeholder="optional"/></div><div class="field full"><label>Latest recovery codes</label><div class="hint">' + esc((s.recoveryCodes || []).join(' • ') || 'not generated in this browser yet') + '</div></div><div class="field full"><label>Event feed</label>' + rowHtml((s.feed || {}).events, 'note') + '</div><div class="field full"><label>Locks</label>' + rowHtml((s.feed || {}).locks, 'resourceKey') + '</div></div>', '<button class="btn" id="hc65_feed">Refresh feed</button><button class="btn" id="hc65_device">Register device</button><button class="btn" id="hc65_enroll">Enroll MFA</button><button class="btn" id="hc65_verify">Verify code</button><button class="btn" id="hc65_recovery_btn">Use recovery</button><button class="btn" id="hc65_lock">Lock route</button><button class="btn primary" id="hc65_unlock">Unlock route</button>');
    var bind = function(id, fn){ var el = document.getElementById(id); if(el) el.onclick = fn; };
    bind('hc65_feed', async function(){ try{ await fetchEventFeed(24); openMfaOpsModal(); }catch(err){ toastFn(clean(err && err.message) || 'Feed failed.', 'bad'); } });
    bind('hc65_device', async function(){ try{ await registerDevice({ label:'Primary browser', platform:'web' }); await fetchEventFeed(24); openMfaOpsModal(); }catch(err){ toastFn(clean(err && err.message) || 'Device registration failed.', 'bad'); } });
    bind('hc65_enroll', async function(){ try{ await enrollMfa({}); openMfaOpsModal(); }catch(err){ toastFn(clean(err && err.message) || 'MFA enrollment failed.', 'bad'); } });
    bind('hc65_verify', async function(){ try{ var code = clean((document.getElementById('hc65_code') || {}).value); await verifyMfa(code, { trustDevice:true, platform:'web' }); await fetchEventFeed(24); openMfaOpsModal(); }catch(err){ toastFn(clean(err && err.message) || 'MFA verify failed.', 'bad'); } });
    bind('hc65_recovery_btn', async function(){ try{ var code = clean((document.getElementById('hc65_recovery') || {}).value); await verifyMfa('', { recoveryCode:code, trustDevice:true, platform:'web' }); await fetchEventFeed(24); openMfaOpsModal(); }catch(err){ toastFn(clean(err && err.message) || 'Recovery failed.', 'bad'); } });
    bind('hc65_lock', async function(){ try{ await acquireLock('route', (APP && APP.routeId) || 'route-1', 180, 'Editing route'); await fetchEventFeed(24); openMfaOpsModal(); }catch(err){ toastFn(clean(err && err.message) || 'Lock failed.', 'bad'); } });
    bind('hc65_unlock', async function(){ try{ var rows = ((summary().feed || {}).locks || []); var lock = rows[0]; await releaseLock(lock && lock.id, 'route', (APP && APP.routeId) || 'route-1'); await fetchEventFeed(24); openMfaOpsModal(); }catch(err){ toastFn(clean(err && err.message) || 'Unlock failed.', 'bad'); } });
  }
  function injectStyles(){ if(document.getElementById('hc_v65_styles')) return; var style = document.createElement('style'); style.id = 'hc_v65_styles'; style.textContent = '.hc-v65-kpi{min-width:140px;padding:14px 16px;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:rgba(255,211,106,.06)}.hc-v65-kpi .n{font-size:1.4rem;font-weight:700}.hc-v65-kpi .d{font-size:.82rem;opacity:.82}'; (document.head || document.body).appendChild(style); }
  function renderV65Card(){
    if(!(typeof APP !== 'undefined' && APP && APP.view === 'platform-house')) return;
    var host = document.querySelector('#content') || document.querySelector('#app') || document.body;
    if(!host) return;
    var old = document.getElementById('hc_v65_card'); if(old && old.remove) old.remove();
    var m = buildV65Metrics();
    var card = document.createElement('div');
    card.id = 'hc_v65_card';
    card.className = 'card';
    card.innerHTML = '<h2 style="margin:0 0 8px;">Platform House security + coordination · V65</h2><div class="hint">This pass adds operator MFA, trusted device registration, resource locking, and a cloud event feed so multi-operator work stops stepping on itself.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;">' +
      '<div class="hc-v65-kpi"><div class="n">' + esc(m.mfaEnabled ? 'ON' : 'OFF') + '</div><div class="d">MFA</div></div>' +
      '<div class="hc-v65-kpi"><div class="n">' + esc(String(m.devices)) + '</div><div class="d">Devices</div></div>' +
      '<div class="hc-v65-kpi"><div class="n">' + esc(String(m.locks)) + '</div><div class="d">Active locks</div></div>' +
      '<div class="hc-v65-kpi"><div class="n">' + esc(String(m.events)) + '</div><div class="d">Event rows</div></div>' +
      '</div><div class="sep"></div><div class="row" style="justify-content:flex-end;flex-wrap:wrap;"><button class="btn" id="hc65_refresh_feed">Refresh feed</button><button class="btn" id="hc65_lock_quick">Quick lock</button><button class="btn primary" id="hc65_open_ops">Security ops</button></div>';
    host.appendChild(card);
    var bind = function(id, fn){ var el = document.getElementById(id); if(el) el.onclick = fn; };
    bind('hc65_open_ops', openMfaOpsModal);
    bind('hc65_refresh_feed', async function(){ try{ await fetchEventFeed(24); if(typeof render === 'function') render(); }catch(err){ toastFn(clean(err && err.message) || 'Feed failed.', 'bad'); } });
    bind('hc65_lock_quick', async function(){ try{ await acquireLock('route', (APP && APP.routeId) || 'route-1', 180, 'Quick lock'); await fetchEventFeed(24); if(typeof render === 'function') render(); }catch(err){ toastFn(clean(err && err.message) || 'Quick lock failed.', 'bad'); } });
  }
  function patchRender(){
    if(window.__HC_V65_RENDER_PATCHED__) return;
    window.__HC_V65_RENDER_PATCHED__ = true;
    var prev = typeof render === 'function' ? render : null;
    if(prev){
      render = async function(){ var out = await prev.apply(this, arguments); try{ injectStyles(); renderV65Card(); }catch(_){} return out; };
    }
  }
  patchRender();
  injectStyles();
  setTimeout(function(){ try{ if(typeof render === 'function') render(); }catch(_){} }, 80);
  window.RoutexPlatformHouseCircleV65 = {
    enrollMfa: enrollMfa,
    verifyMfa: verifyMfa,
    registerDevice: registerDevice,
    acquireLock: acquireLock,
    releaseLock: releaseLock,
    fetchEventFeed: fetchEventFeed,
    buildV65Metrics: buildV65Metrics,
    openMfaOpsModal: openMfaOpsModal
  };
})();
