/* V42 AE FLOW white-glove website / analytics / restore visibility */
(function(){
  if(window.__AEFLOW_WHITEGLOVE_V42__) return;
  window.__AEFLOW_WHITEGLOVE_V42__ = true;

  const SHARED = {
    websiteRequests: 'skye_whiteglove_website_requests_v42',
    syncLedger: 'skye_whiteglove_sync_ledger_v42',
    analytics: 'skye_whiteglove_analytics_snapshots_v42',
    backups: 'skye_whiteglove_backup_bundles_v42',
    restoreRuns: 'skye_whiteglove_restore_runs_v42',
    bookings: 'skye_whiteglove_bookings_v39',
    profiles: 'skye_whiteglove_service_profiles_v39',
    memberships: 'skye_whiteglove_memberships_v39'
  };
  const KEYS = {
    imports: 'aef_whiteglove_v42_imports',
    ui: 'aef_whiteglove_v42_ui'
  };

  const clean = (v)=> String(v == null ? '' : v).trim();
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const nowISO = ()=> new Date().toISOString();
  const dayISO = ()=> nowISO().slice(0,10);
  const uid = (p)=> (p || 'id') + '_' + Math.random().toString(36).slice(2,9) + '_' + Date.now().toString(36);
  const money = (n)=> '$' + Number(n || 0).toFixed(2);
  const toast = window.toast || function(){};
  const downloadText = window.downloadText || function(content, filename, type){
    const blob = new Blob([content], { type: type || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename || 'download.txt'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 1200);
  };

  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){ } return value; }
  const readRequests = ()=> readJSON(SHARED.websiteRequests, []);
  const readSync = ()=> readJSON(SHARED.syncLedger, []);
  const readAnalytics = ()=> readJSON(SHARED.analytics, []);
  const readBackups = ()=> readJSON(SHARED.backups, []);
  const readRestoreRuns = ()=> readJSON(SHARED.restoreRuns, []);
  const readBookings = ()=> (window.readWhiteGloveBookings ? window.readWhiteGloveBookings() : readJSON(SHARED.bookings, []));
  const readProfiles = ()=> (window.readWhiteGloveServiceProfiles ? window.readWhiteGloveServiceProfiles() : readJSON(SHARED.profiles, []));
  const readMemberships = ()=> (window.readWhiteGloveMemberships ? window.readWhiteGloveMemberships() : readJSON(SHARED.memberships, []));
  const readImports = ()=> readJSON(KEYS.imports, []);
  const readUI = ()=> readJSON(KEYS.ui, { tab:'overview' });
  const writeImports = (rows)=> writeJSON(KEYS.imports, rows);
  const writeUI = (patch)=> writeJSON(KEYS.ui, Object.assign({}, readUI(), patch || {}));

  function syncRoutexWhiteGlove42(){
    const snapshot = {
      id: uid('aef_wg42'),
      importedAt: nowISO(),
      latestAnalytics: readAnalytics()[0] || null,
      websiteRequests: readRequests().slice(0, 120),
      syncRows: readSync().slice(0, 120),
      latestBackup: readBackups()[0] || null,
      latestRestoreRun: readRestoreRuns()[0] || null,
      bookings: readBookings().slice(0, 120),
      profiles: readProfiles().slice(0, 120),
      memberships: readMemberships().slice(0, 120)
    };
    const rows = readImports();
    rows.unshift(snapshot);
    writeImports(rows.slice(0, 120));
    return snapshot;
  }

  function buildImportHtml(row){
    row = row || readImports()[0] || syncRoutexWhiteGlove42();
    const analytics = row.latestAnalytics || {};
    const requests = (row.websiteRequests || []).map(item => '<tr><td>'+esc(item.id)+'</td><td>'+esc(item.riderName || '—')+'</td><td>'+esc(item.market || '—')+'</td><td>'+esc(item.serviceType || '—')+'</td><td>'+esc(item.status || '—')+'</td><td>'+esc(item.syncState || '—')+'</td></tr>').join('') || '<tr><td colspan="6">No website requests.</td></tr>';
    const syncRows = (row.syncRows || []).map(item => '<tr><td>'+esc(item.createdAt)+'</td><td>'+esc(item.kind)+'</td><td>'+esc(item.status)+'</td><td>'+esc(String(item.retryCount || 0))+'</td><td>'+esc(item.note || '')+'</td></tr>').join('') || '<tr><td colspan="5">No sync rows.</td></tr>';
    return '<!doctype html><html><head><meta charset="utf-8"><title>AE FLOW white-glove command sync</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}table{width:100%;border-collapse:collapse;margin:10px 0 18px}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left}.badge{display:inline-block;padding:4px 8px;border:1px solid #999;border-radius:999px;margin:0 6px 6px 0}</style></head><body><h1>AE FLOW • White-glove command sync</h1><div><span class="badge">Imported '+esc(row.importedAt)+'</span><span class="badge">Requests '+esc(String((row.websiteRequests || []).length))+'</span><span class="badge">Sync rows '+esc(String((row.syncRows || []).length))+'</span><span class="badge">Revenue '+money((analytics && analytics.recognizedRevenue) || 0)+'</span><span class="badge">Net '+money((analytics && analytics.estimatedNet) || 0)+'</span></div><h2>Website booking queue</h2><table><thead><tr><th>Request</th><th>Rider</th><th>Market</th><th>Service</th><th>Status</th><th>Sync</th></tr></thead><tbody>'+requests+'</tbody></table><h2>Routex sync ledger</h2><table><thead><tr><th>Created</th><th>Kind</th><th>Status</th><th>Retries</th><th>Note</th></tr></thead><tbody>'+syncRows+'</tbody></table></body></html>';
  }

  function openModal(title, html, onReady){
    const existing = document.getElementById('aefWg42Modal');
    if(existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'aefWg42Modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(3,8,20,.78);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto';
    overlay.innerHTML = '<div style="width:min(1260px,96vw);background:#07111f;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:22px;box-shadow:0 30px 80px rgba(0,0,0,.45);overflow:hidden"><div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.08)"><div style="font-size:1.05rem;font-weight:700">'+esc(title)+'</div><button id="aefWg42Close" style="border:0;background:#1e293b;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Close</button></div><div id="aefWg42Body" style="padding:18px">'+html+'</div></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#aefWg42Close').onclick = ()=> overlay.remove();
    overlay.addEventListener('click', (e)=>{ if(e.target === overlay) overlay.remove(); });
    if(typeof onReady === 'function') onReady(overlay.querySelector('#aefWg42Body'));
  }

  function buildCenterHtml(){
    const ui = readUI();
    const latestImport = readImports()[0] || null;
    const analytics = latestImport && latestImport.latestAnalytics ? latestImport.latestAnalytics : (readAnalytics()[0] || null);
    const tabs = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px"><button class="btn small aefwg42-tab" data-tab="overview">Overview</button><button class="btn small aefwg42-tab" data-tab="queue">Queue</button><button class="btn small aefwg42-tab" data-tab="analytics">Analytics</button><button class="btn small aefwg42-tab" data-tab="restore">Restore</button></div>';
    if(ui.tab === 'queue'){
      const requests = (latestImport && latestImport.websiteRequests) || readRequests();
      const syncRows = (latestImport && latestImport.syncRows) || readSync();
      return tabs + '<div class="card"><h2 style="margin:0 0 10px">Website queue and sync visibility</h2><table style="width:100%;border-collapse:collapse;margin-bottom:12px"><thead><tr><th>Request</th><th>Rider</th><th>Market</th><th>Service</th><th>Status</th><th>Sync</th></tr></thead><tbody>'+(requests.map(item => '<tr><td>'+esc(item.id)+'</td><td>'+esc(item.riderName || '—')+'</td><td>'+esc(item.market || '—')+'</td><td>'+esc(item.serviceType || '—')+'</td><td>'+esc(item.status || '—')+'</td><td>'+esc(item.syncState || '—')+'</td></tr>').join('') || '<tr><td colspan="6">No website requests.</td></tr>')+'</tbody></table><table style="width:100%;border-collapse:collapse"><thead><tr><th>Created</th><th>Kind</th><th>Status</th><th>Retries</th><th>Note</th></tr></thead><tbody>'+(syncRows.map(item => '<tr><td>'+esc(item.createdAt)+'</td><td>'+esc(item.kind)+'</td><td>'+esc(item.status)+'</td><td>'+esc(String(item.retryCount || 0))+'</td><td>'+esc(item.note || '')+'</td></tr>').join('') || '<tr><td colspan="5">No sync rows.</td></tr>')+'</tbody></table></div>';
    }
    if(ui.tab === 'analytics'){
      return tabs + '<div class="card"><h2 style="margin:0 0 10px">White-glove analytics visibility</h2>' + (analytics ? '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><span class="badge">'+esc(analytics.fingerprint)+'</span><span class="badge">Revenue '+money(analytics.recognizedRevenue)+'</span><span class="badge">Net '+money(analytics.estimatedNet)+'</span><span class="badge">Favorite match '+esc(String(analytics.favoriteDriverMatchRate))+'%</span><span class="badge">Continuity '+esc(String(analytics.driverContinuityScore))+'%</span></div><table style="width:100%;border-collapse:collapse"><tbody><tr><td>Member rides</td><td>'+esc(String(analytics.memberVsRetail.member))+'</td></tr><tr><td>Retail rides</td><td>'+esc(String(analytics.memberVsRetail.retail))+'</td></tr><tr><td>Wait revenue</td><td>'+money(analytics.waitRevenue)+'</td></tr><tr><td>Overage revenue</td><td>'+money(analytics.overageRevenue)+'</td></tr><tr><td>Repeat-rider rate</td><td>'+esc(String(analytics.repeatRiderRate))+'%</td></tr><tr><td>Cancellation rate</td><td>'+esc(String(analytics.cancellationRate))+'%</td></tr><tr><td>No-show rate</td><td>'+esc(String(analytics.noShowRate))+'%</td></tr></tbody></table>' : '<div>No imported analytics snapshot yet.</div>') + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button id="aefWg42ExportImport" class="btn small">Export AE FLOW command sync HTML</button></div></div>';
    }
    if(ui.tab === 'restore'){
      const restore = (latestImport && latestImport.latestRestoreRun) || readRestoreRuns()[0] || null;
      const backup = (latestImport && latestImport.latestBackup) || readBackups()[0] || null;
      return tabs + '<div class="card"><h2 style="margin:0 0 10px">Restore / portability visibility</h2>' + (backup ? '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><span class="badge">Backup '+esc(backup.fingerprint)+'</span><span class="badge">Bookings '+esc(String((backup.counts && backup.counts.bookings) || 0))+'</span><span class="badge">Profiles '+esc(String((backup.counts && backup.counts.profiles) || 0))+'</span></div>' : '<div style="margin-bottom:12px">No backup bundle visible yet.</div>') + (restore ? '<table style="width:100%;border-collapse:collapse"><tbody><tr><td>Restore fingerprint</td><td>'+esc(restore.importedFingerprint || '—')+'</td></tr><tr><td>Mode</td><td>'+esc(restore.mode || '—')+'</td></tr><tr><td>Imported bookings</td><td>'+esc(String((restore.counts && restore.counts.bookings) || 0))+'</td></tr><tr><td>Booking duplicates</td><td>'+esc(String((restore.duplicates && restore.duplicates.bookings) || 0))+'</td></tr><tr><td>Final booking count</td><td>'+esc(String((restore.final && restore.final.bookings) || 0))+'</td></tr></tbody></table>' : '<div>No restore run visible yet.</div>') + '</div>';
    }
    return tabs + '<div class="card"><h2 style="margin:0 0 10px">White-glove command center</h2><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><span class="badge">Website requests '+esc(String(readRequests().length))+'</span><span class="badge">Sync rows '+esc(String(readSync().length))+'</span><span class="badge">Analytics '+esc(String(readAnalytics().length))+'</span><span class="badge">Backups '+esc(String(readBackups().length))+'</span></div><div style="margin-bottom:12px">AE FLOW can now import the Routex website queue, sync ledger, analytics snapshots, and restore history so the continuity layer can see the operational state without leaving the app.</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="aefWg42Sync" class="btn small">Sync Routex white-glove v42</button><button id="aefWg42ExportImport2" class="btn small">Export command sync HTML</button></div></div>';
  }

  function bindCenter(body){
    body.addEventListener('click', (e)=>{
      const tab = e.target.closest('.aefwg42-tab');
      if(tab){ writeUI({ tab: tab.dataset.tab }); openCenter(); return; }
      if(e.target.id === 'aefWg42Sync'){ const row = syncRoutexWhiteGlove42(); toast(row ? 'Routex white-glove v42 imported.' : 'Sync failed.', row ? 'good' : 'warn'); openCenter('overview'); return; }
      if(e.target.id === 'aefWg42ExportImport' || e.target.id === 'aefWg42ExportImport2'){ downloadText(buildImportHtml(readImports()[0] || syncRoutexWhiteGlove42()), 'aeflow_whiteglove_command_sync_' + dayISO() + '.html', 'text/html'); return; }
    });
  }

  function openCenter(tab){ if(tab) writeUI({ tab }); openModal('AE FLOW white-glove website / analytics / restore center', buildCenterHtml(), bindCenter); }

  function inject(){
    const existing = document.getElementById('aefWg42Card');
    if(existing) existing.remove();
    const latestImport = readImports()[0] || null;
    const analytics = latestImport && latestImport.latestAnalytics ? latestImport.latestAnalytics : (readAnalytics()[0] || null);
    const host = document.querySelector('#app') || document.body;
    const card = document.createElement('div');
    card.id = 'aefWg42Card';
    card.className = 'card';
    card.innerHTML = '<h2 style="margin:0 0 10px">White-glove command visibility</h2><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><span class="badge">Requests '+esc(String(readRequests().length))+'</span><span class="badge">Sync rows '+esc(String(readSync().length))+'</span><span class="badge">Analytics '+esc(String(readAnalytics().length))+'</span><span class="badge">Restore runs '+esc(String(readRestoreRuns().length))+'</span></div><div style="margin-bottom:12px">AE FLOW now has operator visibility into the Routex website queue, sync pressure, chauffeur analytics, and restore history.</div>' + (analytics ? '<div style="margin-bottom:12px">Latest analytics: revenue '+money(analytics.recognizedRevenue)+' • net '+money(analytics.estimatedNet)+' • continuity '+esc(String(analytics.driverContinuityScore))+'%</div>' : '') + '<div style="display:flex;gap:8px;flex-wrap:wrap"><button id="aefWg42Open" class="btn small">Open center</button><button id="aefWg42SyncBtn" class="btn small">Sync Routex v42</button><button id="aefWg42ExportBtn" class="btn small">Export command sync HTML</button></div>';
    host.appendChild(card);
    card.querySelector('#aefWg42Open').onclick = ()=> openCenter('overview');
    card.querySelector('#aefWg42SyncBtn').onclick = ()=>{ const row = syncRoutexWhiteGlove42(); toast(row ? 'Routex white-glove v42 imported.' : 'Sync failed.', row ? 'good' : 'warn'); };
    card.querySelector('#aefWg42ExportBtn').onclick = ()=> downloadText(buildImportHtml(readImports()[0] || syncRoutexWhiteGlove42()), 'aeflow_whiteglove_command_sync_' + dayISO() + '.html', 'text/html');

    const toolbar = document.querySelector('.toolbar') || document.querySelector('.row');
    if(toolbar && !document.getElementById('aefWg42ToolbarBtn')){
      const btn = document.createElement('button');
      btn.id = 'aefWg42ToolbarBtn';
      btn.className = 'btn small';
      btn.textContent = 'White-glove v42';
      btn.onclick = ()=> openCenter('overview');
      toolbar.appendChild(btn);
    }
  }

  const observer = new MutationObserver(()=> inject());
  observer.observe(document.body, { childList:true, subtree:true });
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(inject, 0); return out; };

  window.openAEFlowWhiteGloveV42Center = openCenter;
  window.syncAEFlowWhiteGloveV42 = syncRoutexWhiteGlove42;
})();
