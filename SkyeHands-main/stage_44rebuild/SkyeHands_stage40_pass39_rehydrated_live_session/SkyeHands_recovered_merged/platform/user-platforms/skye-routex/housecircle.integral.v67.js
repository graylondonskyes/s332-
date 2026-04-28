(function(){
  if(window.__ROUTEX_HOUSECIRCLE_V67__) return;
  window.__ROUTEX_HOUSECIRCLE_V67__ = true;

  var KEY = 'skye_routex_platform_house_circle_walkthrough_v67';
  var KEY_SYNC = 'skye_routex_platform_house_circle_walkthrough_sync_v67';
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

  function sections(){
    return [
      { key:'shell_nav', icon:'🧭', title:'Platform shell and navigation spine', summary:'One shell now exposes Routex, Platform House Circle, valuation, walkthrough, sync, and operator-control surfaces instead of making them hidden side files.', where:['Top navigation buttons','Dashboard/platform-house cards','Modal launch surfaces'], actions:['Move between operational and hospitality lanes','Open valuation and walkthrough centers directly from the live shell','Keep investor/operator materials discoverable when live'], code:['index.html','housecircle.integral.v66.js','housecircle.integral.v67.js'] },
      { key:'routex_core', icon:'🚚', title:'Routex core route and field execution engine', summary:'The Routex core remains the operating spine: route creation, stop execution, proof motion, and task spillover from integrated domains.', where:['Main Routex surfaces','Task creation lanes','Proof and export flows'], actions:['Create route missions','Execute operational work','Write outcomes back into shared intelligence'], code:['whiteglove lineage','housecircle.integral.v59.js'] },
      { key:'proof_exports', icon:'🧾', title:'Proof vault, export, and handoff system', summary:'The stack turns activity into evidence with exports, handoff packets, receipts, proof lanes, and white-glove delivery artifacts.', where:['White-glove folders','Export helpers','Download surfaces'], actions:['Export operational evidence','Prepare handoff packets','Review smoke and proof receipts'], code:['WHITE_GLOVE folders','downloadText helpers'] },
      { key:'ae_crm', icon:'📇', title:'AE, CRM, and account intelligence lane', summary:'The platform also carries client/account motion and follow-up logic, so it is not only a route runner.', where:['AE FLOW lineage','Shared follow-up/task flows','Account intelligence lanes'], actions:['Track account motion','Route hospitality/ops intelligence into follow-up work','Keep relationship context near execution'], code:['academy.v38.js','tutorials.v35.js','AE-FLOW bundle lineage'] },
      { key:'house_circle_domain', icon:'🏠', title:'Platform House Circle hospitality domain', summary:'House Circle now lives inside the same stack as a first-class hospitality/member/event/campaign/POS domain.', where:['Platform House views','Shared state bundle','Integrated cards'], actions:['Run venue/member operations','Track guests, memberships, events, campaigns, drops','Share location intelligence with Routex'], code:['housecircle.integral.v59.js and later','housecircle-cloud-store.js'] },
      { key:'join_packets', icon:'🎟️', title:'Join packets, QR redemption, and check-in lane', summary:'The platform can issue join packets, redeem them through QR or manual flow, and write guest/member/timeline/audit updates.', where:['V60 command center','Scanner/manual redemption lanes','Audit/timeline state'], actions:['Create packets','Redeem packets','Turn entry motion into guest records'], code:['housecircle.integral.v60.js','housecircle.integral.v63.js'] },
      { key:'pos_sales', icon:'💳', title:'POS ingest and sales intelligence lane', summary:'Sales data can be logged or ingested, then used to update revenue, guest spend, service cases, and operational follow-through.', where:['POS controls','Adapter lanes','Cloud ingest functions'], actions:['Import tickets','Update revenue/spend intelligence','Escalate sales patterns into work'], code:['housecircle.integral.v60.js','housecircle.integral.v63.js','phc-pos-ingest.js'] },
      { key:'automation_cases', icon:'⚙️', title:'Service cases, automation rules, and playbooks', summary:'Signals can create service cases and Routex tasks through automation rules and playbooks instead of sitting idle in records.', where:['V61 automation surfaces','Case/task records','Signal run logs'], actions:['Create cases from signals','Run playbooks','Generate route tasks automatically'], code:['housecircle.integral.v61.js'] },
      { key:'execution_mesh', icon:'🗂️', title:'Dispatch shifts, assignments, and readiness execution mesh', summary:'V62 added shifts, assignments, readiness templates/runs, and escalation behavior, plus replica export/import and merge preview.', where:['Execution mesh panels','Readiness controls','Replica tools'], actions:['Build dispatch waves','Run readiness checks','Escalate failed readiness into work'], code:['housecircle.integral.v62.js'] },
      { key:'live_ops_mesh', icon:'📡', title:'Scanner, adapters, webhook inbox, jobs, and replay mesh', summary:'V63 moved the product into live-ops territory with scanning, adapters, webhooks, queues, dead-letter replay, and local realtime sync behavior.', where:['V63 live-ops panels','Webhook/job surfaces','Replay controls'], actions:['Scan QR codes where supported','Inspect webhook traffic','Replay failed jobs'], code:['housecircle.integral.v63.js','phc-webhook-square.js','phc-job-drain.js'] },
      { key:'cloud_sync', icon:'☁️', title:'Cloud sync mesh and server-side control plane', summary:'V64 introduced signed sessions, state push/pull, frame ingest, cloud sync, and outbox replay so the platform could coordinate beyond one device.', where:['Cloud sync panels','Netlify functions','Health surface'], actions:['Push/pull state','Run auto-sync ticks','Inspect server health and snapshot state'], code:['housecircle.integral.v64.js','phc-sync-state.js','phc-sync-frame.js','phc-health.js'] },
      { key:'security_coordination', icon:'🔐', title:'MFA, recovery, trusted devices, locks, and event feed', summary:'V65 added operator MFA, recovery codes, trusted devices, resource locks, release flow, and event-feed coordination.', where:['Security coordination panels','Device/lock controls','Event feed'], actions:['Enroll MFA','Register trusted devices','Acquire/release locks to protect concurrent work'], code:['housecircle.integral.v65.js','phc-auth-mfa-enroll.js','phc-device-register.js','phc-lock-acquire.js','phc-event-feed.js'] },
      { key:'valuation_center', icon:'📈', title:'Investor valuation center', summary:'V66 made the valuation a live product surface with HTML/MD/JSON exports, cloud sync, health reporting, and nav discoverability.', where:['Valuation nav button','Valuation card','Investor artifact folder'], actions:['Open current valuation','Export valuation artifacts','Keep the investor number synced and discoverable'], code:['housecircle.integral.v66.js','phc-valuation.js','investor artifacts'] },
      { key:'walkthrough_center', icon:'📘', title:'Master walkthrough center', summary:'V67 closes the “pieces not one whole” gap with one deep master walkthrough that explains the entire codebase lane by lane.', where:['Walkthrough nav button','Walkthrough card','Operator artifact folder'], actions:['Open one complete walkthrough','Export walkthrough artifacts','Sync the walkthrough record to cloud storage'], code:['housecircle.integral.v67.js','phc-walkthrough.js','operator artifacts'] },
      { key:'docs_guides', icon:'🧪', title:'Docs, deploy guides, directives, and smoke receipts', summary:'The repo ships layered implementation directives, deploy guides, status files, and smoke outputs across the upgrade passes.', where:['WHITE_GLOVE folders','Directive files','NEW-SHIT2 guidance corpus'], actions:['Read pass-by-pass status','Use deploy guides for live wiring','Review smoke receipts and proofs'], code:['PLATFORM_HOUSE_CIRCLE_INTEGRATION_DIRECTIVE_V59–V67','WHITE_GLOVE_V64–V67'] },
      { key:'imports_exports', icon:'🧳', title:'Import, export, replica, merge, and portability lanes', summary:'The stack supports portable bundles, replica previews, merge logic, and cross-environment carry instead of only one locked local state.', where:['Replica/export tools','State bundle logic','Execution-mesh tools'], actions:['Export portable state','Preview incoming replicas','Merge bundle changes safely'], code:['housecircle.integral.v62.js','housecircle-cloud-store.js'] },
      { key:'deployment_boundary', icon:'🧱', title:'What is finished versus what still needs live environment work', summary:'The remaining gap is mostly live deployment, real credentials, and final production storage choice, not missing major codebase architecture.', where:['Deploy guides','Health surface','Status docs'], actions:['Separate code completeness from env wiring','Plan the final live deploy honestly','See which remaining steps are outside the shipped code'], code:['DEPLOY_GUIDE_V64.md','DEPLOY_GUIDE_V65.md','IMPLEMENTATION_STATUS_V66.md','IMPLEMENTATION_STATUS_V67.md'] }
    ];
  }

  function buildRecord(){
    var rows = sections();
    return {
      type:'skye-routexflow-master-walkthrough-v67',
      version:'67.0.0',
      title:'SkyeRoutexFlow + Platform House Circle — Master Walkthrough',
      asOf:'2026-04-04 America/Phoenix',
      generatedAt:nowFn(),
      sectionCount:rows.length,
      summary:'This is the full end-to-end walkthrough for the current SkyeRoutexFlow codebase, covering shell navigation, Routex core operations, Platform House Circle hospitality, automation, execution mesh, live ops, cloud sync, security, valuation, walkthrough discoverability, docs, portability, and the remaining live-environment boundary.',
      discoverability:{
        html:'./operator/SKYEROUTEXFLOW_V67_MASTER_WALKTHROUGH.html',
        markdown:'./operator/SKYEROUTEXFLOW_V67_MASTER_WALKTHROUGH.md',
        json:'./operator/SKYEROUTEXFLOW_V67_MASTER_WALKTHROUGH.json'
      },
      sections: rows,
      notes:[
        'This master walkthrough exists to replace scattered explanation with one operator-readable record.',
        'It is shipped in the repo, surfaced in the live shell, and syncable to the platform cloud store.',
        'Live deployment, external credentials, and final permanent backend selection still sit outside the walkthrough itself.'
      ]
    };
  }

  function readRecord(){ return readJSON(KEY, null) || buildRecord(); }
  function saveRecord(record){ return writeJSON(KEY, record || buildRecord()); }

  function markdownOf(record){
    record = record || readRecord();
    var out = '# ' + record.title + '\n\n';
    out += '**As of:** ' + record.asOf + '  \\n';
    out += '**Sections:** ' + record.sectionCount + '  \\n';
    out += '**Static paths:** ' + record.discoverability.html + ' • ' + record.discoverability.markdown + ' • ' + record.discoverability.json + '\n\n';
    out += '## Summary\n\n' + record.summary + '\n\n';
    (record.sections || []).forEach(function(section, idx){
      out += '## ' + (idx + 1) + '. ' + section.title + '\n\n';
      out += '- **Purpose:** ' + section.summary + '\n';
      out += '- **Where it lives:** ' + (section.where || []).join(' • ') + '\n';
      out += '- **What you can do:** ' + (section.actions || []).join(' • ') + '\n';
      out += '- **Key code/files:** ' + (section.code || []).join(' • ') + '\n\n';
    });
    out += '## Notes\n\n' + (record.notes || []).map(function(item){ return '- ' + item; }).join('\n') + '\n';
    return out;
  }

  function htmlOf(record){
    record = record || readRecord();
    var cards = (record.sections || []).map(function(section, idx){
      return '<article class="card sec"><div class="eyebrow">Section ' + (idx + 1) + '</div><h2><span class="ic">' + esc(section.icon || '') + '</span>' + esc(section.title) + '</h2><p>' + esc(section.summary) + '</p><div class="mini"><strong>Where:</strong> ' + esc((section.where || []).join(' • ')) + '</div><div class="mini"><strong>Do:</strong> ' + esc((section.actions || []).join(' • ')) + '</div><div class="mini"><strong>Code:</strong> ' + esc((section.code || []).join(' • ')) + '</div></article>';
    }).join('');
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(record.title) + '</title><style>:root{--bg:#05000a;--card:rgba(255,255,255,.05);--stroke:rgba(255,255,255,.11);--text:#f6efff;--muted:#b8afd2;--gold:#ffd36a;--cyan:#6fe9ff}*{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,system-ui;background:radial-gradient(circle at top,#160a29 0,#05000a 60%);color:var(--text)}.wrap{max-width:1200px;margin:0 auto;padding:28px}.hero,.card{border:1px solid var(--stroke);background:var(--card);border-radius:24px;padding:20px}.eyebrow{font-size:.8rem;letter-spacing:.16em;text-transform:uppercase;color:var(--gold)}h1,h2{margin:.25rem 0 1rem}p,li,.mini{line-height:1.65;color:var(--muted)}.kpis{display:flex;flex-wrap:wrap;gap:12px;margin-top:12px}.pill{padding:10px 14px;border-radius:999px;border:1px solid var(--stroke);background:rgba(111,233,255,.06)}.grid{display:grid;grid-template-columns:repeat(12,1fr);gap:16px;margin-top:16px}.sec{grid-column:span 6}.ic{margin-right:10px}@media(max-width:920px){.sec{grid-column:span 12}}</style></head><body><div class="wrap"><section class="hero"><div class="eyebrow">Master walkthrough</div><h1>' + esc(record.title) + '</h1><p>' + esc(record.summary) + '</p><div class="kpis"><div class="pill">Sections ' + esc(String(record.sectionCount)) + '</div><div class="pill">As of ' + esc(record.asOf) + '</div><div class="pill">Shell-discoverable walkthrough center</div></div></section><section class="grid">' + cards + '</section></div></body></html>';
  }

  function exportJson(){ downloadTextFn(JSON.stringify(readRecord(), null, 2), 'skyeroutexflow_v67_master_walkthrough.json', 'application/json'); }
  function exportMarkdown(){ downloadTextFn(markdownOf(readRecord()), 'skyeroutexflow_v67_master_walkthrough.md', 'text/markdown'); }
  function exportHtml(){ downloadTextFn(htmlOf(readRecord()), 'skyeroutexflow_v67_master_walkthrough.html', 'text/html'); }

  async function syncWalkthroughCloud(reason){
    var api = window.RoutexPlatformHouseCircleV64;
    var record = saveRecord(buildRecord());
    if(!api || typeof api.saveCloudConfig !== 'function') return { ok:false, skipped:true, record:record };
    var cfg = api.readCloudConfig ? api.readCloudConfig() : (api.saveCloudConfig({}) || {});
    if(!cfg.enabled) return { ok:false, skipped:true, record:record };
    var headers = { 'content-type':'application/json' };
    var session = api.readCloudSession ? api.readCloudSession() : null;
    if(session && session.token) headers.authorization = 'Bearer ' + session.token;
    var basePath = clean(cfg.basePath || '/.netlify/functions').replace(/\/$/, '');
    var res = await fetch(basePath + '/phc-walkthrough', { method:'POST', headers: headers, body: JSON.stringify({ orgId: cfg.orgId, record: record, reason: reason || 'V67 walkthrough sync' }) });
    var json = await res.json();
    if(!res.ok || json.ok === false) throw new Error(clean(json && json.error) || ('Walkthrough sync failed (' + res.status + ').'));
    writeJSON(KEY_SYNC, { at:nowFn(), revision:json.revision, sectionCount:record.sectionCount });
    toastFn('Walkthrough synced.', 'good');
    return json;
  }

  async function fetchWalkthroughCloud(){
    var api = window.RoutexPlatformHouseCircleV64;
    if(!api || typeof api.saveCloudConfig !== 'function') return { ok:false, skipped:true, record:readRecord() };
    var cfg = api.readCloudConfig ? api.readCloudConfig() : (api.saveCloudConfig({}) || {});
    var headers = { 'content-type':'application/json' };
    var session = api.readCloudSession ? api.readCloudSession() : null;
    if(session && session.token) headers.authorization = 'Bearer ' + session.token;
    var basePath = clean(cfg.basePath || '/.netlify/functions').replace(/\/$/, '');
    var res = await fetch(basePath + '/phc-walkthrough?orgId=' + encodeURIComponent(clean(cfg.orgId || 'default-org')), { method:'GET', headers: headers });
    var json = await res.json();
    if(!res.ok || json.ok === false) throw new Error(clean(json && json.error) || ('Walkthrough fetch failed (' + res.status + ').'));
    if(json.record) saveRecord(json.record);
    return json;
  }

  function metricSummary(){
    var record = readRecord();
    var synced = readJSON(KEY_SYNC, null);
    return { sectionCount: record.sectionCount, asOf: record.asOf, syncedAt: synced && synced.at ? synced.at : '', staticPath: record.discoverability && record.discoverability.html };
  }

  function sectionHtml(section, idx){
    return '<div class="hc-v67-sec"><div class="hc-v67-eyebrow">Section ' + (idx + 1) + '</div><h3>' + esc(section.icon || '') + ' ' + esc(section.title) + '</h3><p>' + esc(section.summary) + '</p><div class="hint"><strong>Where:</strong> ' + esc((section.where || []).join(' • ')) + '</div><div class="hint"><strong>Do:</strong> ' + esc((section.actions || []).join(' • ')) + '</div><div class="hint"><strong>Code:</strong> ' + esc((section.code || []).join(' • ')) + '</div></div>';
  }

  function openWalkthroughModal(){
    var record = saveRecord(buildRecord());
    var synced = readJSON(KEY_SYNC, null);
    var html = '<div class="hint">This is the deep end-to-end walkthrough for the full current codebase. It closes the gap between many scattered guide files and one complete operator-readable record.</div>' +
      '<div class="sep"></div>' +
      '<div class="row" style="flex-wrap:wrap;gap:10px;">' +
        '<div class="pill">Sections ' + esc(String(record.sectionCount)) + '</div>' +
        '<div class="pill">As of ' + esc(record.asOf) + '</div>' +
        '<div class="pill">Cloud sync ' + esc(synced && synced.at ? 'completed' : 'not yet pushed') + '</div>' +
      '</div>' +
      '<div class="sep"></div>' +
      '<div class="hint"><strong>Static report paths:</strong> ' + esc(record.discoverability.html) + ' • ' + esc(record.discoverability.markdown) + ' • ' + esc(record.discoverability.json) + '</div>' +
      '<div class="sep"></div>' +
      '<div class="hc-v67-grid">' + record.sections.map(sectionHtml).join('') + '</div>';
    openModalFn('Master walkthrough · V67', html, '<button class="btn" id="hc67_json">Export JSON</button><button class="btn" id="hc67_md">Export MD</button><button class="btn" id="hc67_html">Export HTML</button><button class="btn" id="hc67_open_static">Open static report</button><button class="btn primary" id="hc67_sync">Sync walkthrough</button>');
    var bind = function(id, fn){ var el = document.getElementById(id); if(el) el.onclick = fn; };
    bind('hc67_json', exportJson);
    bind('hc67_md', exportMarkdown);
    bind('hc67_html', exportHtml);
    bind('hc67_open_static', function(){ try{ window.open(record.discoverability.html, '_blank'); }catch(_){ exportHtml(); } });
    bind('hc67_sync', async function(){ try{ await syncWalkthroughCloud('Manual V67 walkthrough sync'); openWalkthroughModal(); }catch(err){ toastFn(clean(err && err.message) || 'Walkthrough sync failed.', 'bad'); } });
  }

  function injectStyles(){
    if(document.getElementById('hc_v67_styles')) return;
    var style = document.createElement('style');
    style.id = 'hc_v67_styles';
    style.textContent = '.hc-v67-kpi{min-width:180px;padding:14px 16px;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:rgba(111,233,255,.07)}.hc-v67-kpi .n{font-size:1.6rem;font-weight:800;color:#6fe9ff}.hc-v67-kpi .d{font-size:.82rem;opacity:.82}.hc-v67-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.hc-v67-sec{border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:14px;background:rgba(255,255,255,.04)}.hc-v67-sec h3{margin:0 0 8px}.hc-v67-sec p{margin:0 0 10px;line-height:1.6;opacity:.92}.hc-v67-eyebrow{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:#ffd36a;margin-bottom:8px}.hc-v67-card .hint strong{color:#fff}@media(max-width:900px){.hc-v67-grid{grid-template-columns:1fr}}';
    (document.head || document.body).appendChild(style);
  }

  function renderWalkthroughCard(){
    if(!(typeof APP !== 'undefined' && APP && (APP.view === 'platform-house' || APP.view === 'dashboard' || APP.view === 'settings'))) return;
    var host = document.querySelector('#content') || document.querySelector('#app') || document.body;
    if(!host) return;
    var old = document.getElementById('hc_v67_card'); if(old && old.remove) old.remove();
    var m = metricSummary();
    var card = document.createElement('div');
    card.id = 'hc_v67_card';
    card.className = 'card hc-v67-card';
    card.innerHTML = '<h2 style="margin:0 0 8px;">Master walkthrough · V67</h2><div class="hint">One deep end-to-end walkthrough now ships with the repo and is surfaced from the live platform, so the full codebase can explain itself in one place instead of scattered fragments.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;gap:12px;"><div class="hc-v67-kpi"><div class="n">' + esc(String(m.sectionCount)) + '</div><div class="d">Walkthrough sections</div></div><div class="hc-v67-kpi"><div class="n">Live</div><div class="d">Shell discoverable</div></div><div class="hc-v67-kpi"><div class="n">HTML</div><div class="d">Static report shipped</div></div></div><div class="sep"></div><div class="row" style="justify-content:flex-end;flex-wrap:wrap;"><button class="btn" id="hc67_card_open">Open walkthrough</button><button class="btn" id="hc67_card_sync">Sync walkthrough</button><button class="btn primary" id="hc67_card_static">Open static report</button></div>';
    host.appendChild(card);
    var btnOpen = document.getElementById('hc67_card_open'); if(btnOpen) btnOpen.onclick = openWalkthroughModal;
    var btnSync = document.getElementById('hc67_card_sync'); if(btnSync) btnSync.onclick = async function(){ try{ await syncWalkthroughCloud('Quick card walkthrough sync'); if(typeof render === 'function') render(); }catch(err){ toastFn(clean(err && err.message) || 'Walkthrough sync failed.', 'bad'); } };
    var btnStatic = document.getElementById('hc67_card_static'); if(btnStatic) btnStatic.onclick = function(){ try{ window.open('./operator/SKYEROUTEXFLOW_V67_MASTER_WALKTHROUGH.html', '_blank'); }catch(_){ exportHtml(); } };
  }

  function injectToolbarButton(){
    if(document.getElementById('hc67_toolbar_btn')) return;
    var hosts = [];
    if(typeof document.querySelectorAll === 'function'){
      try{ hosts = Array.prototype.slice.call(document.querySelectorAll('.topbar .row, #nav')); }catch(_){ hosts = []; }
    }
    for(var i=0;i<hosts.length;i++){
      var host = hosts[i];
      if(!host) continue;
      var btn = document.createElement('button');
      btn.id = 'hc67_toolbar_btn';
      btn.className = host.id === 'nav' ? 'navbtn' : 'btn';
      btn.innerHTML = host.id === 'nav' ? '<span>📘</span><div class="l"><b>Walkthrough</b><span>Master guide</span></div>' : 'Walkthrough';
      btn.onclick = function(){ openWalkthroughModal(); };
      host.appendChild(btn);
      break;
    }
  }

  function patchRender(){
    if(window.__HC_V67_RENDER_PATCHED__) return;
    window.__HC_V67_RENDER_PATCHED__ = true;
    var prev = typeof render === 'function' ? render : null;
    if(prev){
      render = async function(){ var out = await prev.apply(this, arguments); try{ injectStyles(); injectToolbarButton(); renderWalkthroughCard(); }catch(_){} return out; };
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
        if(cfg && cfg.enabled && session && session.token){ syncWalkthroughCloud('Auto V67 walkthrough sync').catch(function(){}); }
      }catch(_){ }
    }
    raf(function(){ try{ if(typeof render === 'function') render(); else renderWalkthroughCard(); }catch(_){} });
  }

  bootstrap();

  window.RoutexPlatformHouseCircleV67 = {
    sections: sections,
    buildRecord: buildRecord,
    readRecord: readRecord,
    saveRecord: saveRecord,
    exportJson: exportJson,
    exportMarkdown: exportMarkdown,
    exportHtml: exportHtml,
    syncWalkthroughCloud: syncWalkthroughCloud,
    fetchWalkthroughCloud: fetchWalkthroughCloud,
    metricSummary: metricSummary,
    openWalkthroughModal: openWalkthroughModal
  };
})();
