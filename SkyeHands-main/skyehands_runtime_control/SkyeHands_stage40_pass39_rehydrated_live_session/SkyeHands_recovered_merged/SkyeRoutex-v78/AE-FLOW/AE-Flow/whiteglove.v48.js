/* V48 AE FLOW white-glove financial control board + compliance visibility */
(function(){
  if(window.__AEFLOW_WHITEGLOVE_V48__) return;
  window.__AEFLOW_WHITEGLOVE_V48__ = true;

  const SHARED = { profiles:'skye_whiteglove_service_profiles_v39', bookings:'skye_whiteglove_bookings_v39', memberships:'skye_whiteglove_memberships_v39' };
  const ROUTEX = {
    adjustments:'skye_whiteglove_adjustments_v48', adjustmentOutbox:'skye_whiteglove_adjustment_outbox_v48',
    compliance:'skye_whiteglove_compliance_ack_v48', complianceOutbox:'skye_whiteglove_compliance_outbox_v48',
    command:'skye_whiteglove_command_snapshots_v48', commandOutbox:'skye_whiteglove_command_outbox_v48',
    disputes:'skye_whiteglove_dispute_packets_v48'
  };
  const KEYS = {
    adjustmentInbox:'ae_whiteglove_adjustment_inbox_v48',
    complianceInbox:'ae_whiteglove_compliance_inbox_v48',
    commandInbox:'ae_whiteglove_command_inbox_v48',
    syncLog:'ae_whiteglove_sync_log_v48'
  };
  const clean = (v)=> String(v == null ? '' : v).trim();
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const uid = (p)=> (p || 'id') + '_' + Math.random().toString(36).slice(2,9) + '_' + Date.now().toString(36);
  const dayISO = ()=> new Date().toISOString().slice(0,10);
  const toast = window.toast || function(){};
  const downloadText = window.downloadText || function(content, filename, type){
    const blob = new Blob([content], { type: type || 'text/plain' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename || 'download.txt'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=> URL.revokeObjectURL(url), 1200);
  };
  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){ } return value; }
  const readProfiles = ()=> readJSON(SHARED.profiles, []);
  const readBookings = ()=> readJSON(SHARED.bookings, []);
  const readMemberships = ()=> readJSON(SHARED.memberships, []);
  const readAdjustmentInbox = ()=> readJSON(KEYS.adjustmentInbox, []);
  const readComplianceInbox = ()=> readJSON(KEYS.complianceInbox, []);
  const readCommandInbox = ()=> readJSON(KEYS.commandInbox, []);
  const readSyncLog = ()=> readJSON(KEYS.syncLog, []);
  const writeAdjustmentInbox = (rows)=> writeJSON(KEYS.adjustmentInbox, rows);
  const writeComplianceInbox = (rows)=> writeJSON(KEYS.complianceInbox, rows);
  const writeCommandInbox = (rows)=> writeJSON(KEYS.commandInbox, rows);
  const writeSyncLog = (rows)=> writeJSON(KEYS.syncLog, rows);

  function sync(){
    const adjSource = readJSON(ROUTEX.adjustmentOutbox, []);
    const cmpSource = readJSON(ROUTEX.complianceOutbox, []);
    const cmdSource = readJSON(ROUTEX.commandOutbox, []);
    const adjInbox = readAdjustmentInbox(); const cmpInbox = readComplianceInbox(); const cmdInbox = readCommandInbox();
    const seenAdj = new Set(adjInbox.map(row => row.id)); const seenCmp = new Set(cmpInbox.map(row => row.id)); const seenCmd = new Set(cmdInbox.map(row => row.id));
    const addAdj = adjSource.filter(row => !seenAdj.has(row.id));
    const addCmp = cmpSource.filter(row => !seenCmp.has(row.id));
    const addCmd = cmdSource.filter(row => !seenCmd.has(row.id));
    if(addAdj.length) writeAdjustmentInbox(addAdj.concat(adjInbox).slice(0, 400));
    if(addCmp.length) writeComplianceInbox(addCmp.concat(cmpInbox).slice(0, 400));
    if(addCmd.length) writeCommandInbox(addCmd.concat(cmdInbox).slice(0, 400));
    const logs = readSyncLog(); logs.unshift({ id: uid('ae_wg48_sync'), adjustments:addAdj.length, compliance:addCmp.length, commands:addCmd.length, syncedAt:new Date().toISOString() }); writeSyncLog(logs.slice(0, 400));
    return { adjustments:addAdj.length, compliance:addCmp.length, commands:addCmd.length };
  }

  function latestSummary(){
    const latestCommandRef = readCommandInbox()[0] || null;
    const command = latestCommandRef ? readJSON(ROUTEX.command, []).find(row => clean(row.id) === clean(latestCommandRef.commandId)) : readJSON(ROUTEX.command, [])[0] || null;
    return {
      profiles: readProfiles().length,
      bookings: readBookings().length,
      memberships: readMemberships().length,
      adjustmentInbox: readAdjustmentInbox().length,
      complianceInbox: readComplianceInbox().length,
      command
    };
  }
  function buildHtml(summary){
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AE FLOW white-glove finance/compliance inbox</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.wrap{max-width:1100px;margin:0 auto}.card{border:1px solid #ddd;border-radius:18px;padding:16px;margin:0 0 16px}.badge{display:inline-block;padding:4px 8px;border:1px solid #bbb;border-radius:999px;margin:0 6px 6px 0}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px">AE FLOW • White-glove finance/compliance inbox</h1><div><span class="badge">Profiles '+esc(String(summary.profiles))+'</span><span class="badge">Bookings '+esc(String(summary.bookings))+'</span><span class="badge">Memberships '+esc(String(summary.memberships))+'</span><span class="badge">Adjustments '+esc(String(summary.adjustmentInbox))+'</span><span class="badge">Compliance '+esc(String(summary.complianceInbox))+'</span></div></div>'+(summary.command ? '<div class="card"><span class="badge">Latest net $'+esc(Number(summary.command.estimatedNet || 0).toFixed(2))+'</span><span class="badge">Conflicts '+esc(String(summary.command.severeConflicts || 0))+'</span><span class="badge">Favorite matched '+esc(String(summary.command.favoriteMatched || 0))+'</span></div>' : '<div class="card">No command snapshot visible yet.</div>')+'</div></body></html>';
  }
  function inject(){
    const existing = document.getElementById('aeWhiteGloveV48Card'); if(existing) existing.remove();
    const s = latestSummary();
    const host = document.querySelector('#aeWhiteGloveV47Card')?.parentElement || document.querySelector('#app') || document.body;
    const card = document.createElement('div');
    card.className = 'card'; card.id = 'aeWhiteGloveV48Card';
    card.innerHTML = ''+
      '<h2 style="margin:0 0 10px">White-glove financial control + compliance visibility</h2>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><button class="btn small" id="aeWg48SyncBtn">Sync finance/compliance lanes</button><button class="btn small" id="aeWg48ExportBtn">Export inbox HTML</button></div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">'+
        '<section style="border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;background:rgba(255,255,255,.03)">'+
          '<div><span class="badge">Adjustments '+esc(String(s.adjustmentInbox))+'</span><span class="badge">Compliance '+esc(String(s.complianceInbox))+'</span></div>'+
          '<div style="margin-top:8px"><span class="badge">Profiles '+esc(String(s.profiles))+'</span><span class="badge">Bookings '+esc(String(s.bookings))+'</span><span class="badge">Memberships '+esc(String(s.memberships))+'</span></div>'+
        '</section>'+
        '<section style="border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;background:rgba(255,255,255,.03)">'+
          (s.command ? '<div><span class="badge">Latest net $'+esc(Number(s.command.estimatedNet || 0).toFixed(2))+'</span><span class="badge">Conflicts '+esc(String(s.command.severeConflicts || 0))+'</span><span class="badge">Active members '+esc(String(s.command.activeMemberships || 0))+'</span></div>' : '<div>No command snapshot visible yet.</div>')+
        '</section>'+
      '</div>';
    host.appendChild(card);
    const bind=(id,fn)=>{ const el=document.getElementById(id); if(el) el.onclick=fn; };
    bind('aeWg48SyncBtn', ()=>{ const res = sync(); toast('Finance/compliance synced. Adj ' + res.adjustments + ', compliance ' + res.compliance + ', commands ' + res.commands + '.', (res.adjustments || res.compliance || res.commands) ? 'good' : 'warn'); inject(); });
    bind('aeWg48ExportBtn', ()=> downloadText(buildHtml(latestSummary()), 'ae_whiteglove_finance_compliance_inbox_' + dayISO() + '.html', 'text/html'));
  }
  const observer = new MutationObserver(()=> inject()); observer.observe(document.body, { childList:true, subtree:true });
  const prevRender = window.renderAll; if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(inject, 0); return out; };
})();
