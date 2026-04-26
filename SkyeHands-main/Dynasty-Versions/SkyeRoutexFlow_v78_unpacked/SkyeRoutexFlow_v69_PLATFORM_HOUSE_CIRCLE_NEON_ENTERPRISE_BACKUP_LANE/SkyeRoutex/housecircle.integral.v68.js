(function(){
  if(window.__ROUTEX_HOUSECIRCLE_V68__) return;
  window.__ROUTEX_HOUSECIRCLE_V68__ = true;

  var KEY = 'skye_routex_platform_house_circle_valuation_v68';
  var KEY_SYNC = 'skye_routex_platform_house_circle_valuation_sync_v68';
  var clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  var esc = window.escapeHTML || function(v){ return String(v == null ? '' : v); };
  var nowFn = typeof nowISO === 'function' ? nowISO : function(){ return new Date().toISOString(); };
  var toastFn = typeof toast === 'function' ? toast : function(){};
  var openModalFn = typeof openModal === 'function' ? openModal : function(title){ try{ alert(title); }catch(_){} };
  var downloadTextFn = typeof downloadText === 'function' ? downloadText : function(){};
  var raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame.bind(window) : function(cb){ return setTimeout(cb, 0); };

  function num(v){ var n = Number(v || 0); return Number.isFinite(n) ? n : 0; }
  function readJSON(key, fallback){ try{ var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); return value; }
  function fmtMoney(v){ return '$' + num(v).toLocaleString('en-US'); }

  function components(){
    return [
      { key:'core_dispatch', label:'Core route, dispatch, field execution, and offline operating spine', value:1350000, rationale:'Route creation, stop execution, proof capture, route economics, offline persistence, and operator dispatch behavior are already present.' },
      { key:'proof_stack', label:'Proof vault, exports, binders, handoff packets, and operator evidence surfaces', value:650000, rationale:'The codebase contains closure, proof, export, handoff, and launch-board lanes that turn work into auditable deliverables.' },
      { key:'crm_ae_ops', label:'AE/CRM, account intelligence, follow-up motion, and command workflow layers', value:600000, rationale:'The platform already contains sales/account intelligence behavior rather than stopping at route delivery mechanics.' },
      { key:'house_circle_domain', label:'Platform House Circle hospitality, guest/member, events, campaigns, packets, and POS domain', value:1050000, rationale:'Hospitality/member/event/readiness logic is now a native domain inside the same operating system.' },
      { key:'live_ops_mesh', label:'Live ops mesh: QR, adapter lanes, webhook inbox, job queue, cloud sync, and security coordination', value:1150000, rationale:'V63–V65 materially expanded the app into cloud-coordinated, multi-operator, security-aware infrastructure.' },
      { key:'productization', label:'Packaging, PWA shell, documentation, branding, investor discoverability, master walkthrough, and operator education polish', value:650000, rationale:'The app now ships with a much deeper operator/onboarding layer, walkthrough center, discoverable investor materials, smoke outputs, deploy guidance, and live-surface product education that materially increases enterprise readiness and handoff value.' }
    ];
  }
  function total(){ return components().reduce(function(sum, row){ return sum + num(row.value); }, 0); }

  function buildRecord(){
    return {
      type:'skye-routexflow-codebase-valuation-v68',
      version:'68.0.0',
      title:'SkyeRoutexFlow + Platform House Circle — 2026 Codebase Valuation',
      asOf:'2026-04-04 America/Phoenix',
      currency:'USD',
      totalValue:total(),
      generatedAt:nowFn(),
      status:'Current codebase enterprise valuation',
      valuationMethod:'Enterprise replacement-cost-plus productization premium',
      summary:'This valuation reflects the entire current codebase: route and dispatch operations, proof/export infrastructure, AE/CRM layers, integrated Platform House Circle hospitality domain, live-ops mesh, cloud sync, MFA/device trust, locking, event-feed coordination, valuation discoverability, and the new master walkthrough/operator enablement surfaces.',
      components:components(),
      includedModules:[
        'SkyeRoutexFlow core route and dispatch system',
        'Proof vault, exports, binders, receipts, and handoff surfaces',
        'AE/CRM account lanes and follow-up control surfaces',
        'Platform House Circle hospitality/member/event/campaign/POS domain',
        'Live ops mesh: QR, webhook, jobs, adapters, sync, and replay',
        'Cloud sync mesh, signed sessions, MFA, trusted devices, locks, and event feed',
        'Discoverable investor valuation center and exportable valuation artifacts',
        'Master walkthrough center, operator education surfaces, and synced product guidance artifacts'
      ],
      discoverability:{
        html:'./investor/SKYEROUTEXFLOW_V68_2026_ENTERPRISE_VALUATION.html',
        markdown:'./investor/SKYEROUTEXFLOW_V68_2026_ENTERPRISE_VALUATION.md',
        json:'./investor/SKYEROUTEXFLOW_V68_2026_ENTERPRISE_VALUATION.json'
      },
      notes:[
        'Value reflects the current shipped codebase and integrated architecture, not a stripped-down MVP reading.',
        'Number assumes enterprise-grade replacement cost, operational productization value, and the premium of a multi-domain stack already collapsed into one operator system.',
        'External live credentials and production deployment can increase realized commercial value, but are not required for this codebase-level valuation record.'
      ]
    };
  }

  function readRecord(){ return readJSON(KEY, null) || buildRecord(); }
  function saveRecord(record){ return writeJSON(KEY, record || buildRecord()); }

  function markdownOf(record){
    record = record || readRecord();
    var out = '# ' + record.title + '\n\n';
    out += '**As of:** ' + record.asOf + '  \\n';
    out += '**Current codebase valuation:** **' + fmtMoney(record.totalValue) + ' USD**  \\n';
    out += '**Method:** ' + record.valuationMethod + '\n\n';
    out += '## Summary\n\n' + record.summary + '\n\n';
    out += '## Component Breakdown\n\n';
    (record.components || []).forEach(function(item){
      out += '### ' + item.label + ' — ' + fmtMoney(item.value) + ' USD\n\n';
      out += item.rationale + '\n\n';
    });
    out += '## Included Modules\n\n' + (record.includedModules || []).map(function(item){ return '- ' + item; }).join('\n') + '\n\n';
    out += '## Notes\n\n' + (record.notes || []).map(function(item){ return '- ' + item; }).join('\n');
    return out;
  }

  function htmlOf(record){
    record = record || readRecord();
    var comp = (record.components || []).map(function(item){ return '<div class="comp"><h3>' + esc(item.label) + ' <span class="money">— ' + esc(fmtMoney(item.value)) + ' USD</span></h3><p>' + esc(item.rationale) + '</p></div>'; }).join('');
    var mods = (record.includedModules || []).map(function(item){ return '<li>' + esc(item) + '</li>'; }).join('');
    var notes = (record.notes || []).map(function(item){ return '<li>' + esc(item) + '</li>'; }).join('');
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(record.title) + '</title><style>:root{--bg:#05000a;--card:rgba(255,255,255,.05);--stroke:rgba(255,255,255,.12);--text:#f4edff;--muted:#b8afd2;--gold:#ffd36a;--cyan:#6fe9ff}*{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,system-ui;background:radial-gradient(circle at top,#170c29 0,#05000a 60%);color:var(--text)}.wrap{max-width:1100px;margin:0 auto;padding:28px}.hero,.card{border:1px solid var(--stroke);background:var(--card);border-radius:24px;padding:20px}.value{font-size:clamp(2.2rem,6vw,4rem);font-weight:900;color:var(--gold)}.sub,p,li{color:var(--muted);line-height:1.65}.grid{display:grid;grid-template-columns:repeat(12,1fr);gap:16px}.span-12{grid-column:span 12}.span-6{grid-column:span 6}@media(max-width:900px){.span-6{grid-column:span 12}}.comp{padding:14px 0;border-bottom:1px solid rgba(255,255,255,.08)}.comp:last-child{border-bottom:none}.money{color:var(--cyan);font-weight:800}</style></head><body><div class="wrap"><section class="hero"><div class="value">' + esc(fmtMoney(record.totalValue)) + '</div><div class="sub"><strong>' + esc(record.title) + '</strong><br/>As of ' + esc(record.asOf) + '</div><p>' + esc(record.summary) + '</p></section><div class="grid"><section class="card span-12"><h2>Component breakdown</h2>' + comp + '</section><section class="card span-6"><h2>Included modules</h2><ul>' + mods + '</ul></section><section class="card span-6"><h2>Notes</h2><ul>' + notes + '</ul></section></div></div></body></html>';
  }

  function exportJson(){ var record = readRecord(); downloadTextFn(JSON.stringify(record, null, 2), 'skyeroutexflow_v68_valuation.json', 'application/json'); }
  function exportMarkdown(){ var record = readRecord(); downloadTextFn(markdownOf(record), 'skyeroutexflow_v68_valuation.md', 'text/markdown'); }
  function exportHtml(){ var record = readRecord(); downloadTextFn(htmlOf(record), 'skyeroutexflow_v68_valuation.html', 'text/html'); }

  async function syncValuationCloud(reason){
    var api = window.RoutexPlatformHouseCircleV64;
    var record = saveRecord(buildRecord());
    if(!api || typeof api.saveCloudConfig !== 'function') return { ok:false, skipped:true, record:record };
    var cfg = api.readCloudConfig ? api.readCloudConfig() : (api.saveCloudConfig({}) || {});
    if(!cfg.enabled) return { ok:false, skipped:true, record:record };
    var headers = { 'content-type':'application/json' };
    var session = api.readCloudSession ? api.readCloudSession() : null;
    if(session && session.token) headers.authorization = 'Bearer ' + session.token;
    var basePath = clean(cfg.basePath || '/.netlify/functions').replace(/\/$/, '');
    var res = await fetch(basePath + '/phc-valuation', { method:'POST', headers: headers, body: JSON.stringify({ orgId: cfg.orgId, record: record, reason: reason || 'V68 valuation sync' }) });
    var json = await res.json();
    if(!res.ok || json.ok === false) throw new Error(clean(json && json.error) || ('Valuation sync failed (' + res.status + ').'));
    writeJSON(KEY_SYNC, { at:nowFn(), revision:json.revision, totalValue:record.totalValue, asOf:record.asOf });
    toastFn('Valuation synced.', 'good');
    return json;
  }

  async function fetchValuationCloud(){
    var api = window.RoutexPlatformHouseCircleV64;
    if(!api || typeof api.saveCloudConfig !== 'function') return { ok:false, skipped:true, record:readRecord() };
    var cfg = api.readCloudConfig ? api.readCloudConfig() : (api.saveCloudConfig({}) || {});
    var headers = { 'content-type':'application/json' };
    var session = api.readCloudSession ? api.readCloudSession() : null;
    if(session && session.token) headers.authorization = 'Bearer ' + session.token;
    var basePath = clean(cfg.basePath || '/.netlify/functions').replace(/\/$/, '');
    var res = await fetch(basePath + '/phc-valuation?orgId=' + encodeURIComponent(clean(cfg.orgId || 'default-org')), { method:'GET', headers: headers });
    var json = await res.json();
    if(!res.ok || json.ok === false) throw new Error(clean(json && json.error) || ('Valuation fetch failed (' + res.status + ').'));
    if(json.record) saveRecord(json.record);
    return json;
  }

  function metricSummary(){
    var record = readRecord();
    var synced = readJSON(KEY_SYNC, null);
    return { totalValue: record.totalValue, components: (record.components || []).length, asOf: record.asOf, syncedAt: synced && synced.at ? synced.at : '' };
  }

  function openValuationModal(){
    var record = saveRecord(buildRecord());
    var rows = (record.components || []).map(function(item){ return '<tr><td>' + esc(item.label) + '</td><td>' + esc(fmtMoney(item.value)) + ' USD</td><td>' + esc(item.rationale) + '</td></tr>'; }).join('');
    var synced = readJSON(KEY_SYNC, null);
    openModalFn(
      '2026 codebase valuation · V68',
      '<div class="hint">This valuation is now shipped with the repo and designed to stay discoverable from the live platform. The number reflects the full current codebase, not a thin MVP reading.</div>' +
      '<div class="sep"></div>' +
      '<div class="row" style="flex-wrap:wrap;gap:10px;">' +
        '<div class="pill">Value ' + esc(fmtMoney(record.totalValue)) + ' USD</div>' +
        '<div class="pill">As of ' + esc(record.asOf) + '</div>' +
        '<div class="pill">Components ' + esc(String((record.components || []).length)) + '</div>' +
        '<div class="pill">Cloud sync ' + esc(synced && synced.at ? 'completed' : 'not yet pushed') + '</div>' +
      '</div>' +
      '<div class="sep"></div>' +
      '<table style="width:100%;border-collapse:collapse;"><thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid rgba(255,255,255,.1);">Component</th><th style="text-align:left;padding:8px;border-bottom:1px solid rgba(255,255,255,.1);">Value</th><th style="text-align:left;padding:8px;border-bottom:1px solid rgba(255,255,255,.1);">Rationale</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="sep"></div><div class="hint"><strong>Included modules:</strong><br/>' + esc((record.includedModules || []).join(' • ')) + '</div>' +
      '<div class="sep"></div><div class="hint">Static report paths: ' + esc(record.discoverability.html) + ' • ' + esc(record.discoverability.markdown) + ' • ' + esc(record.discoverability.json) + '</div>',
      '<button class="btn" id="hc68_json">Export JSON</button><button class="btn" id="hc68_md">Export MD</button><button class="btn" id="hc68_html">Export HTML</button><button class="btn" id="hc68_open_static">Open static report</button><button class="btn primary" id="hc68_sync">Sync valuation</button>'
    );
    var bind = function(id, fn){ var el = document.getElementById(id); if(el) el.onclick = fn; };
    bind('hc68_json', exportJson);
    bind('hc68_md', exportMarkdown);
    bind('hc68_html', exportHtml);
    bind('hc68_open_static', function(){ try{ window.open(record.discoverability.html, '_blank'); }catch(_){ exportHtml(); } });
    bind('hc68_sync', async function(){ try{ await syncValuationCloud('Manual V68 modal sync'); openValuationModal(); }catch(err){ toastFn(clean(err && err.message) || 'Valuation sync failed.', 'bad'); } });
  }

  function injectStyles(){
    if(document.getElementById('hc_v68_styles')) return;
    var style = document.createElement('style');
    style.id = 'hc_v68_styles';
    style.textContent = '.hc-v68-kpi{min-width:160px;padding:14px 16px;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:rgba(255,211,106,.07)}.hc-v68-kpi .n{font-size:1.6rem;font-weight:800;color:#ffd36a}.hc-v68-kpi .d{font-size:.82rem;opacity:.82}.hc-v68-card .hint strong{color:#fff}';
    (document.head || document.body).appendChild(style);
  }

  function renderValuationCard(){
    if(!(typeof APP !== 'undefined' && APP && (APP.view === 'platform-house' || APP.view === 'dashboard' || APP.view === 'settings'))) return;
    var host = document.querySelector('#content') || document.querySelector('#app') || document.body;
    if(!host) return;
    var old = document.getElementById('hc_v66_card'); if(old && old.remove) old.remove();
    var m = metricSummary();
    var card = document.createElement('div');
    card.id = 'hc_v68_card';
    card.className = 'card hc-v68-card';
    card.innerHTML = '<h2 style="margin:0 0 8px;">2026 codebase valuation · V66</h2><div class="hint">The valuation is now shipped inside the repo and surfaced from the platform so the current build can expose its investor-facing number, walkthrough-linked guidance, and artifact paths when live.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;gap:12px;"><div class="hc-v68-kpi"><div class="n">' + esc(fmtMoney(m.totalValue)) + '</div><div class="d">Current codebase valuation</div></div><div class="hc-v68-kpi"><div class="n">' + esc(String(m.components)) + '</div><div class="d">Valuation components</div></div><div class="hc-v68-kpi"><div class="n">' + esc(m.asOf) + '</div><div class="d">As-of record</div></div></div><div class="sep"></div><div class="row" style="justify-content:flex-end;flex-wrap:wrap;"><button class="btn" id="hc68_card_open">Open valuation</button><button class="btn" id="hc68_card_sync">Sync valuation</button><button class="btn primary" id="hc68_card_static">Open static report</button></div>';
    host.appendChild(card);
    var btnOpen = document.getElementById('hc68_card_open'); if(btnOpen) btnOpen.onclick = openValuationModal;
    var btnSync = document.getElementById('hc68_card_sync'); if(btnSync) btnSync.onclick = async function(){ try{ await syncValuationCloud('Quick V68 card sync'); if(typeof render === 'function') render(); }catch(err){ toastFn(clean(err && err.message) || 'Valuation sync failed.', 'bad'); } };
    var btnStatic = document.getElementById('hc68_card_static'); if(btnStatic) btnStatic.onclick = function(){ try{ window.open('./investor/SKYEROUTEXFLOW_V68_2026_ENTERPRISE_VALUATION.html', '_blank'); }catch(_){ exportHtml(); } };
  }

  function injectToolbarButton(){
    if(document.getElementById('hc68_toolbar_btn')) return;
    var hosts = [];
    if(typeof document.querySelectorAll === 'function'){
      try{ hosts = Array.prototype.slice.call(document.querySelectorAll('.topbar .row, #nav')); }catch(_){ hosts = []; }
    }
    for(var i=0;i<hosts.length;i++){
      var host = hosts[i];
      if(!host) continue;
      var btn = document.createElement('button');
      btn.id = 'hc68_toolbar_btn';
      btn.className = host.id === 'nav' ? 'navbtn' : 'btn';
      btn.innerHTML = host.id === 'nav' ? '<span>📈</span><div class="l"><b>Valuation</b><span>Investor center</span></div>' : 'Valuation';
      btn.onclick = function(){ openValuationModal(); };
      host.appendChild(btn);
      break;
    }
  }

  function patchRender(){
    if(window.__HC_V68_RENDER_PATCHED__) return;
    window.__HC_V68_RENDER_PATCHED__ = true;
    var prev = typeof render === 'function' ? render : null;
    if(prev){
      render = async function(){ var out = await prev.apply(this, arguments); try{ injectStyles(); injectToolbarButton(); renderValuationCard(); }catch(_){} return out; };
    }
  }

  function bootstrap(){
    saveRecord(buildRecord());
    injectStyles();
    injectToolbarButton();
    patchRender();
    if(window.RoutexPlatformHouseCircleV64 && window.RoutexPlatformHouseCircleV64.readCloudConfig){
      try{
        var cfg = window.RoutexPlatformHouseCircleV64.readCloudConfig();
        var session = window.RoutexPlatformHouseCircleV64.readCloudSession ? window.RoutexPlatformHouseCircleV64.readCloudSession() : null;
        if(cfg && cfg.enabled && session && session.token){ syncValuationCloud('Auto V68 valuation sync').catch(function(){}); }
      }catch(_){ }
    }
    raf(function(){ try{ if(typeof render === 'function') render(); else renderValuationCard(); }catch(_){} });
  }

  bootstrap();

  window.RoutexPlatformHouseCircleV68 = {
    buildRecord: buildRecord,
    readRecord: readRecord,
    saveRecord: saveRecord,
    exportJson: exportJson,
    exportMarkdown: exportMarkdown,
    exportHtml: exportHtml,
    syncValuationCloud: syncValuationCloud,
    fetchValuationCloud: fetchValuationCloud,
    metricSummary: metricSummary,
    openValuationModal: openValuationModal
  };
})();
