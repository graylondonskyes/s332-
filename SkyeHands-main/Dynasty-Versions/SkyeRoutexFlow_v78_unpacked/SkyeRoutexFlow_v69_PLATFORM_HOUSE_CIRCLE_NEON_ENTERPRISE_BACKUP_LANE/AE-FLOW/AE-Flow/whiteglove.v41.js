/* V41 AE FLOW white-glove live service + payout visibility */
(function(){
  if(window.__AEFLOW_WHITEGLOVE_V41__) return;
  window.__AEFLOW_WHITEGLOVE_V41__ = true;

  const SHARED = {
    profiles: 'skye_whiteglove_service_profiles_v39',
    bookings: 'skye_whiteglove_bookings_v39'
  };
  const ROUTEX = {
    execution: 'skye_whiteglove_execution_rows_v41',
    payoutLedger: 'skye_whiteglove_payout_ledger_v41',
    serviceBoard: 'skye_whiteglove_service_boards_v41',
    recovery: 'skye_whiteglove_service_recovery_v41'
  };
  const KEYS = {
    ui: 'aef_whiteglove_v41_ui',
    imports: 'aef_whiteglove_v41_imports',
    recoveryTasks: 'aef_whiteglove_recovery_tasks_v41'
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
    setTimeout(()=> URL.revokeObjectURL(url), 1500);
  };

  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){ } return value; }
  const readProfiles = ()=> (window.readWhiteGloveServiceProfiles ? window.readWhiteGloveServiceProfiles() : readJSON(SHARED.profiles, []));
  const readBookings = ()=> (window.readWhiteGloveBookings ? window.readWhiteGloveBookings() : readJSON(SHARED.bookings, []));
  const readExecution = ()=> readJSON(ROUTEX.execution, []);
  const readPayoutLedger = ()=> readJSON(ROUTEX.payoutLedger, []);
  const readBoards = ()=> readJSON(ROUTEX.serviceBoard, []);
  const readRecovery = ()=> readJSON(ROUTEX.recovery, []);
  const readImports = ()=> readJSON(KEYS.imports, []);
  const readRecoveryTasks = ()=> readJSON(KEYS.recoveryTasks, []);
  const readUI = ()=> readJSON(KEYS.ui, { tab:'live' });
  const writeImports = (rows)=> writeJSON(KEYS.imports, rows);
  const writeRecoveryTasks = (rows)=> writeJSON(KEYS.recoveryTasks, rows);
  const writeUI = (patch)=> writeJSON(KEYS.ui, Object.assign({}, readUI(), patch || {}));

  function getProfile(id){ return readProfiles().find(row => row.id === id) || null; }
  function getExec(bookingId){ return readExecution().find(row => row.bookingId === bookingId) || null; }
  function totalWaitMinutes(exec){ return ((exec && exec.waitSessions) || []).reduce((sum, item) => sum + Number(item.durationMinutes || 0), 0); }

  function syncRoutexState(){
    const latestBoard = readBoards()[0] || null;
    const row = { id: uid('aef_wg_sync'), importedAt: nowISO(), board: latestBoard, payoutRows: readPayoutLedger().slice(0, 100), recoveryRows: readRecovery().slice(0, 100) };
    const rows = readImports();
    rows.unshift(row);
    writeImports(rows.slice(0, 100));
    return row;
  }

  function addRecoveryTask(bookingId, label, owner){
    const rows = readRecoveryTasks();
    rows.unshift({ id: uid('aef_task'), bookingId, label: clean(label), owner: clean(owner), status:'open', createdAt: nowISO() });
    writeRecoveryTasks(rows.slice(0, 200));
    return rows[0];
  }

  function closeRecoveryTask(id){
    const rows = readRecoveryTasks().map(row => row.id === id ? Object.assign({}, row, { status:'closed', closedAt: nowISO() }) : row);
    writeRecoveryTasks(rows);
  }

  function input(label, name, value){ return '<label style="display:grid;gap:6px;font-size:.9rem"><span>'+esc(label)+'</span><input name="'+esc(name)+'" value="'+esc(value || '')+'" style="border:1px solid rgba(255,255,255,.12);background:#020617;color:#fff;border-radius:10px;padding:10px"></label>'; }
  function openModal(title, html, onReady){
    const existing = document.getElementById('aefWg41Modal');
    if(existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'aefWg41Modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(3,8,20,.78);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto';
    overlay.innerHTML = '<div style="width:min(1240px,96vw);background:#07111f;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:22px;box-shadow:0 30px 80px rgba(0,0,0,.45);overflow:hidden"><div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.08)"><div style="font-size:1.05rem;font-weight:700">'+esc(title)+'</div><button id="aefWg41Close" style="border:0;background:#1e293b;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Close</button></div><div id="aefWg41Body" style="padding:18px">'+html+'</div></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#aefWg41Close').onclick = ()=> overlay.remove();
    overlay.addEventListener('click', (e)=>{ if(e.target === overlay) overlay.remove(); });
    if(typeof onReady === 'function') onReady(overlay.querySelector('#aefWg41Body'));
  }

  function buildHtml(){
    const ui = readUI();
    const bookings = readBookings();
    const payoutRows = readPayoutLedger();
    const recoveries = readRecovery();
    const tasks = readRecoveryTasks();
    const board = readBoards()[0] || { activeBookings:0, waitActive:0, recoveryOpen:0, payoutToday:0, summary:[] };
    const nav = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px"><button class="aefwg41-tab btn small" data-tab="live">Live service</button><button class="aefwg41-tab btn small" data-tab="payout">Payout</button><button class="aefwg41-tab btn small" data-tab="recovery">Recovery</button><button class="aefwg41-tab btn small" data-tab="sync">Sync</button></div>';
    if(ui.tab === 'payout'){
      return nav + '<div class="card"><h2 style="margin:0 0 10px">Driver payout visibility</h2><table style="width:100%;border-collapse:collapse"><thead><tr><th>Created</th><th>Booking</th><th>Driver</th><th>Model</th><th>Revenue</th><th>Payout</th></tr></thead><tbody>'+(payoutRows.map(row => '<tr><td>'+esc(row.createdAt)+'</td><td>'+esc(row.bookingId)+'</td><td>'+esc(row.driverName)+'</td><td>'+esc(row.model)+'</td><td>'+money(row.recognizedRevenue)+'</td><td>'+money(row.amount)+'</td></tr>').join('') || '<tr><td colspan="6">No payout rows.</td></tr>')+'</tbody></table></div>';
    }
    if(ui.tab === 'recovery'){
      return nav + '<div style="display:grid;grid-template-columns:.9fr 1.1fr;gap:16px"><form id="aefwg41TaskForm" class="card" style="display:grid;gap:10px"><h2 style="margin:0">Recovery follow-up task</h2>'+input('Booking ID','bookingId','')+input('Task label','label','VIP callback / service recovery')+input('Owner','owner','Founder Ops')+'<button style="border:0;background:#7c3aed;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Create follow-up</button></form><div class="card"><h2 style="margin:0 0 10px">Recovery board</h2><div style="margin-bottom:10px">Open recovery notes: '+esc(String(recoveries.length))+'</div><table style="width:100%;border-collapse:collapse"><thead><tr><th>Booking</th><th>Severity</th><th>Note</th><th>Task</th></tr></thead><tbody>'+(recoveries.map(item => { const hasOpen = tasks.some(task => task.bookingId === item.bookingId && task.status === 'open'); return '<tr><td>'+esc(item.bookingId)+'</td><td>'+esc(item.severity)+'</td><td>'+esc(item.note)+'</td><td>'+(hasOpen ? 'Open task' : '<button class="btn small aefwg41-addtask" data-booking="'+esc(item.bookingId)+'">Create task</button>')+'</td></tr>'; }).join('') || '<tr><td colspan="4">No recovery notes.</td></tr>')+'</tbody></table><h3 style="margin:14px 0 8px">Recovery tasks</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th>Booking</th><th>Label</th><th>Owner</th><th>Status</th><th>Action</th></tr></thead><tbody>'+(tasks.map(task => '<tr><td>'+esc(task.bookingId)+'</td><td>'+esc(task.label)+'</td><td>'+esc(task.owner)+'</td><td>'+esc(task.status)+'</td><td>'+(task.status === 'open' ? '<button class="btn small aefwg41-close-task" data-task="'+esc(task.id)+'">Close</button>' : 'Closed')+'</td></tr>').join('') || '<tr><td colspan="5">No recovery tasks.</td></tr>')+'</tbody></table></div></div>';
    }
    if(ui.tab === 'sync'){
      const imports = readImports();
      return nav + '<div class="card"><h2 style="margin:0 0 10px">Routex live sync snapshots</h2><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><span class="badge">Active '+esc(String(board.activeBookings || 0))+'</span><span class="badge">Wait '+esc(String(board.waitActive || 0))+'</span><span class="badge">Recovery '+esc(String(board.recoveryOpen || 0))+'</span><span class="badge">Payout today '+money(board.payoutToday || 0)+'</span></div><table style="width:100%;border-collapse:collapse"><thead><tr><th>Imported</th><th>Active</th><th>Wait</th><th>Recovery</th><th>Payout today</th></tr></thead><tbody>'+(imports.map(row => '<tr><td>'+esc(row.importedAt)+'</td><td>'+esc(String((row.board && row.board.activeBookings) || 0))+'</td><td>'+esc(String((row.board && row.board.waitActive) || 0))+'</td><td>'+esc(String((row.board && row.board.recoveryOpen) || 0))+'</td><td>'+money((row.board && row.board.payoutToday) || 0)+'</td></tr>').join('') || '<tr><td colspan="5">No sync snapshots yet.</td></tr>')+'</tbody></table></div>';
    }
    return nav + '<div class="card"><h2 style="margin:0 0 10px">Live chauffeur execution visibility</h2><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><span class="badge">Active '+esc(String(board.activeBookings || 0))+'</span><span class="badge">Wait timers '+esc(String(board.waitActive || 0))+'</span><span class="badge">Recovery '+esc(String(board.recoveryOpen || 0))+'</span><span class="badge">Payout today '+money(board.payoutToday || 0)+'</span></div><table style="width:100%;border-collapse:collapse"><thead><tr><th>Booking</th><th>Client</th><th>Status</th><th>Wait min</th><th>Favorite</th><th>Recovery</th></tr></thead><tbody>'+(board.summary.map(item => { const booking = bookings.find(row => row.id === item.id) || null; const exec = booking ? getExec(booking.id) : null; const recoveryCount = exec && exec.serviceRecoveryNotes ? exec.serviceRecoveryNotes.length : 0; return '<tr><td>'+esc(item.id)+'</td><td>'+esc(item.client)+'</td><td>'+esc(item.status)+'</td><td>'+esc(String(totalWaitMinutes(exec)))+'</td><td>'+esc(item.favorite || '—')+'</td><td>'+esc(String(recoveryCount))+'</td></tr>'; }).join('') || '<tr><td colspan="6">No live bookings.</td></tr>')+'</tbody></table></div>';
  }

  function buildImportHtml(){
    const rows = readImports();
    const tableRows = rows.map(row => '<tr><td>'+esc(row.importedAt)+'</td><td>'+esc(String((row.board && row.board.activeBookings) || 0))+'</td><td>'+esc(String((row.board && row.board.waitActive) || 0))+'</td><td>'+esc(String((row.board && row.board.recoveryOpen) || 0))+'</td><td>'+money((row.board && row.board.payoutToday) || 0)+'</td></tr>').join('') || '<tr><td colspan="5">No sync snapshots.</td></tr>';
    return '<!doctype html><html><head><meta charset="utf-8"><title>AE FLOW white-glove sync</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}</style></head><body><h1>AE FLOW • White-glove live sync</h1><table><thead><tr><th>Imported</th><th>Active</th><th>Wait</th><th>Recovery</th><th>Payout today</th></tr></thead><tbody>'+tableRows+'</tbody></table></body></html>';
  }

  function openCenter(tab){ if(tab) writeUI({ tab }); openModal('AE FLOW white-glove live service center', buildHtml(), bindHandlers); }
  function bindHandlers(body){
    body.addEventListener('click', (e)=>{
      const tab = e.target.closest('.aefwg41-tab');
      if(tab){ writeUI({ tab: tab.dataset.tab }); openCenter(); return; }
      if(e.target.id === 'aefwg41SyncBtn'){ syncRoutexState(); toast('Routex live state imported.', 'good'); openCenter('sync'); return; }
      if(e.target.classList.contains('aefwg41-addtask')){ addRecoveryTask(e.target.dataset.booking, 'Service recovery follow-up', 'Founder Ops'); toast('Recovery task created.', 'good'); openCenter('recovery'); return; }
      if(e.target.classList.contains('aefwg41-close-task')){ closeRecoveryTask(e.target.dataset.task); toast('Recovery task closed.', 'good'); openCenter('recovery'); return; }
      if(e.target.id === 'aefwg41ExportBtn'){ downloadText(buildImportHtml(), 'aeflow_whiteglove_live_sync_' + dayISO() + '.html', 'text/html'); return; }
    });
    const form = body.querySelector('#aefwg41TaskForm');
    if(form){ form.onsubmit = (e)=>{ e.preventDefault(); const fd = Object.fromEntries(new FormData(form).entries()); addRecoveryTask(fd.bookingId, fd.label, fd.owner); toast('Recovery follow-up created.', 'good'); openCenter('recovery'); }; }
  }

  function inject(){
    const existing = document.getElementById('aefWg41Card');
    if(existing) existing.remove();
    const host = document.querySelector('#app') || document.body;
    const board = readBoards()[0] || { activeBookings:0, waitActive:0, recoveryOpen:0, payoutToday:0 };
    const card = document.createElement('div');
    card.id = 'aefWg41Card';
    card.className = 'card';
    card.innerHTML = '<h2 style="margin:0 0 10px">White-glove live service center</h2><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><span class="badge">Active '+esc(String(board.activeBookings || 0))+'</span><span class="badge">Wait '+esc(String(board.waitActive || 0))+'</span><span class="badge">Recovery '+esc(String(board.recoveryOpen || 0))+'</span><span class="badge">Payout today '+money(board.payoutToday || 0)+'</span></div><div style="margin-bottom:12px">AE FLOW can now see the live chauffeur service state, import Routex execution snapshots, and run service-recovery follow-up tasks without leaving the shared dossier layer.</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="aefWg41Open" class="btn small">Live service center</button><button id="aefWg41SyncBtn" class="btn small">Sync Routex state</button><button id="aefWg41ExportBtn" class="btn small">Export live sync HTML</button></div>';
    host.appendChild(card);
    card.querySelector('#aefWg41Open').onclick = ()=> openCenter('live');
    card.querySelector('#aefWg41SyncBtn').onclick = ()=>{ syncRoutexState(); toast('Routex live state imported.', 'good'); };
    card.querySelector('#aefWg41ExportBtn').onclick = ()=> downloadText(buildImportHtml(), 'aeflow_whiteglove_live_sync_' + dayISO() + '.html', 'text/html');

    const toolbar = document.querySelector('.toolbar') || document.querySelector('.row');
    if(toolbar && !document.getElementById('aefWg41ToolbarBtn')){
      const btn = document.createElement('button');
      btn.id = 'aefWg41ToolbarBtn';
      btn.className = 'btn small';
      btn.textContent = 'Live service';
      btn.onclick = ()=> openCenter('live');
      toolbar.appendChild(btn);
    }
  }

  const observer = new MutationObserver(()=> inject());
  observer.observe(document.body, { childList:true, subtree:true });
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(inject, 0); return out; };

  window.openAEFlowWhiteGloveLiveServiceCenterV41 = openCenter;
  window.syncAEFlowWhiteGloveLiveStateV41 = syncRoutexState;
})();
