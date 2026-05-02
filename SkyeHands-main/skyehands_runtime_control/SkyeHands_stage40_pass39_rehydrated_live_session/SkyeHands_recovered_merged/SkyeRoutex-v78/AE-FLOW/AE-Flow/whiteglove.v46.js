/* V46 AE FLOW white-glove conflict inbox + special-doc visibility */
(function(){
  if(window.__AEFLOW_WHITEGLOVE_V46__) return;
  window.__AEFLOW_WHITEGLOVE_V46__ = true;

  const SHARED = {
    profiles: 'skye_whiteglove_service_profiles_v39',
    bookings: 'skye_whiteglove_bookings_v39',
    memberships: 'skye_whiteglove_memberships_v39',
    docs: 'skye_whiteglove_docs_v39'
  };
  const ROUTEX = {
    conflictOutbox: 'skye_whiteglove_conflict_outbox_v46',
    conflictSnapshots: 'skye_whiteglove_conflict_snapshots_v46',
    metaLog: 'skye_whiteglove_booking_meta_log_v46'
  };
  const KEYS = {
    conflictInbox: 'ae_whiteglove_conflict_inbox_v46',
    conflictLog: 'ae_whiteglove_conflict_sync_log_v46'
  };

  const clean = (v)=> String(v == null ? '' : v).trim();
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const uid = (p)=> (p || 'id') + '_' + Math.random().toString(36).slice(2,9) + '_' + Date.now().toString(36);
  const dayISO = ()=> new Date().toISOString().slice(0,10);
  const toast = window.toast || function(){};
  const downloadText = window.downloadText || function(content, filename, type){
    const blob = new Blob([content], { type: type || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename || 'download.txt'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 1200);
  };

  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){ } return value; }
  const readConflictInbox = ()=> readJSON(KEYS.conflictInbox, []);
  const readConflictLog = ()=> readJSON(KEYS.conflictLog, []);
  const writeConflictInbox = (rows)=> writeJSON(KEYS.conflictInbox, rows);
  const writeConflictLog = (rows)=> writeJSON(KEYS.conflictLog, rows);
  const readProfiles = ()=> readJSON(SHARED.profiles, []);
  const readBookings = ()=> readJSON(SHARED.bookings, []);
  const readMemberships = ()=> readJSON(SHARED.memberships, []);
  const readDocs = ()=> readJSON(SHARED.docs, []);
  const readMetaLog = ()=> readJSON(ROUTEX.metaLog, []);

  function syncConflictInbox(){
    const source = readJSON(ROUTEX.conflictOutbox, []);
    const inbox = readConflictInbox();
    const seen = new Set(inbox.map(row => row.id));
    const additions = source.filter(row => !seen.has(row.id));
    if(additions.length) writeConflictInbox(additions.concat(inbox).slice(0, 220));
    const logs = readConflictLog();
    logs.unshift({ id: uid('ae_wg46_sync'), kind:'whiteglove_conflict', added:additions.length, sourceCount:source.length, syncedAt:new Date().toISOString() });
    writeConflictLog(logs.slice(0, 220));
    return { added: additions.length, total: source.length };
  }

  function buildConflictHtml(){
    const rows = readConflictInbox();
    const body = rows.map(row => '<tr><td>'+esc(row.label || 'Conflict snapshot')+'</td><td>'+esc(row.fingerprint || '—')+'</td><td>'+esc(String((row.counts || {}).critical || 0))+'</td><td>'+esc(String((row.counts || {}).high || 0))+'</td><td>'+esc(String(row.blockerCount || 0))+'</td><td>'+esc(row.topSuggestion || '—')+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AE FLOW white-glove conflict inbox</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.wrap{max-width:1180px;margin:0 auto}.card{border:1px solid #ddd;border-radius:18px;padding:16px;margin:0 0 16px}.badge{display:inline-block;padding:4px 8px;border:1px solid #bbb;border-radius:999px;margin:0 6px 6px 0}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px">AE FLOW • White-glove conflict inbox</h1><div><span class="badge">Snapshots '+esc(String(rows.length))+'</span><span class="badge">Sync logs '+esc(String(readConflictLog().length))+'</span></div></div><div class="card"><table><thead><tr><th>Run</th><th>Fingerprint</th><th>Critical</th><th>High</th><th>Blockers</th><th>Top suggestion</th></tr></thead><tbody>'+(body || '<tr><td colspan="6">No conflict snapshots imported yet.</td></tr>')+'</tbody></table></div></div></body></html>';
  }

  function visibilitySummary(){
    const docs = readDocs();
    const bookings = readBookings();
    const profiles = readProfiles();
    return {
      profiles: profiles.length,
      bookings: bookings.length,
      memberships: readMemberships().length,
      airportDocs: docs.filter(row => clean(row.type) === 'airport_meet_greet_card_v46').length,
      cancelDocs: docs.filter(row => clean(row.type) === 'cancellation_no_show_proof_v46').length,
      metaRows: readMetaLog().length,
      latestConflict: readConflictInbox()[0] || readJSON(ROUTEX.conflictSnapshots, [])[0] || null
    };
  }

  function inject(){
    const existing = document.getElementById('aeWhiteGloveV46Card');
    if(existing) existing.remove();
    const summary = visibilitySummary();
    const host = document.querySelector('#routexWorkbenchHost') || document.querySelector('#app') || document.body;
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'aeWhiteGloveV46Card';
    card.innerHTML = ''+
      '<h2 style="margin:0 0 10px">White-glove conflict + special-doc visibility</h2>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">'+
        '<button class="btn small" id="aeWg46SyncConflictBtn">Sync conflict snapshots</button>'+
        '<button class="btn small" id="aeWg46ConflictHtmlBtn">Export conflict inbox HTML</button>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">'+
        '<section style="border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;background:rgba(255,255,255,.03)">'+
          '<h3 style="margin:0 0 8px">Latest Routex conflict snapshot</h3>'+
          (summary.latestConflict ? ('<div><span class="badge">'+esc(summary.latestConflict.fingerprint || '—')+'</span><span class="badge">Critical '+esc(String((summary.latestConflict.counts || {}).critical || 0))+'</span><span class="badge">High '+esc(String((summary.latestConflict.counts || {}).high || 0))+'</span><span class="badge">'+(summary.latestConflict.ok ? 'GREEN' : 'ACTION REQUIRED')+'</span></div><div style="margin-top:8px">'+esc(summary.latestConflict.topSuggestion || '—')+'</div>') : '<div>No conflict snapshot visible yet.</div>')+
        '</section>'+
        '<section style="border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;background:rgba(255,255,255,.03)">'+
          '<h3 style="margin:0 0 8px">Special doc + continuity visibility</h3>'+
          '<div><span class="badge">Profiles '+esc(String(summary.profiles))+'</span><span class="badge">Bookings '+esc(String(summary.bookings))+'</span><span class="badge">Memberships '+esc(String(summary.memberships))+'</span></div>'+
          '<div style="margin-top:8px"><span class="badge">Airport docs '+esc(String(summary.airportDocs))+'</span><span class="badge">Cancellation docs '+esc(String(summary.cancelDocs))+'</span><span class="badge">Meta rows '+esc(String(summary.metaRows))+'</span></div>'+
          '<div style="margin-top:8px">AE FLOW can now see conflict depth and the special white-glove doc trail without leaving the operator surface.</div>'+
        '</section>'+
      '</div>';
    host.appendChild(card);

    const bind = (id, fn)=> { const el = document.getElementById(id); if(el) el.onclick = fn; };
    bind('aeWg46SyncConflictBtn', ()=>{ const res = syncConflictInbox(); toast('Conflict inbox synced. Added ' + res.added + '.', res.added ? 'good' : 'warn'); inject(); });
    bind('aeWg46ConflictHtmlBtn', ()=> downloadText(buildConflictHtml(), 'ae_whiteglove_conflict_inbox_' + dayISO() + '.html', 'text/html'));
  }

  const observer = new MutationObserver(()=> inject());
  observer.observe(document.body, { childList:true, subtree:true });
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(inject, 0); return out; };

  window.readAEWhiteGloveConflictInboxV46 = readConflictInbox;
  window.syncAEWhiteGloveConflictInboxV46 = syncConflictInbox;
})();
