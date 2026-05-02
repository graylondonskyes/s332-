/* V45 AE FLOW white-glove acceptance + compliance inboxes */
(function(){
  if(window.__AEFLOW_WHITEGLOVE_V45__) return;
  window.__AEFLOW_WHITEGLOVE_V45__ = true;

  const ROUTEX = {
    acceptanceOutbox: 'skye_whiteglove_acceptance_outbox_v45',
    complianceOutbox: 'skye_whiteglove_compliance_outbox_v45'
  };
  const SHARED = {
    profiles: 'skye_whiteglove_service_profiles_v39',
    bookings: 'skye_whiteglove_bookings_v39',
    memberships: 'skye_whiteglove_memberships_v39',
    docs: 'skye_whiteglove_docs_v39'
  };
  const KEYS = {
    acceptanceInbox: 'ae_whiteglove_acceptance_inbox_v45',
    acceptanceLog: 'ae_whiteglove_acceptance_log_v45',
    complianceInbox: 'ae_whiteglove_compliance_inbox_v45',
    complianceLog: 'ae_whiteglove_compliance_log_v45'
  };

  const clean = (v)=> String(v == null ? '' : v).trim();
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const nowISO = ()=> new Date().toISOString();
  const dayISO = ()=> nowISO().slice(0,10);
  const uid = (p)=> (p || 'id') + '_' + Math.random().toString(36).slice(2,9) + '_' + Date.now().toString(36);
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
  const readAcceptanceInbox = ()=> readJSON(KEYS.acceptanceInbox, []);
  const readAcceptanceLog = ()=> readJSON(KEYS.acceptanceLog, []);
  const readComplianceInbox = ()=> readJSON(KEYS.complianceInbox, []);
  const readComplianceLog = ()=> readJSON(KEYS.complianceLog, []);
  const writeAcceptanceInbox = (rows)=> writeJSON(KEYS.acceptanceInbox, rows);
  const writeAcceptanceLog = (rows)=> writeJSON(KEYS.acceptanceLog, rows);
  const writeComplianceInbox = (rows)=> writeJSON(KEYS.complianceInbox, rows);
  const writeComplianceLog = (rows)=> writeJSON(KEYS.complianceLog, rows);
  const readProfiles = ()=> readJSON(SHARED.profiles, []);
  const readBookings = ()=> readJSON(SHARED.bookings, []);
  const readMemberships = ()=> readJSON(SHARED.memberships, []);
  const readDocs = ()=> readJSON(SHARED.docs, []);

  function syncRows(sourceKey, inboxReader, inboxWriter, logReader, logWriter, kind){
    const source = readJSON(sourceKey, []);
    const inbox = inboxReader();
    const seen = new Set(inbox.map(row => row.id));
    const additions = source.filter(row => !seen.has(row.id));
    if(additions.length) inboxWriter(additions.concat(inbox).slice(0, 200));
    const logs = logReader();
    logs.unshift({ id: uid('ae_wg45_sync'), kind, added: additions.length, sourceCount: source.length, syncedAt: nowISO() });
    logWriter(logs.slice(0, 200));
    return { added: additions.length, total: source.length };
  }
  function syncAcceptance(){ return syncRows(ROUTEX.acceptanceOutbox, readAcceptanceInbox, writeAcceptanceInbox, readAcceptanceLog, writeAcceptanceLog, 'whiteglove_acceptance'); }
  function syncCompliance(){ return syncRows(ROUTEX.complianceOutbox, readComplianceInbox, writeComplianceInbox, readComplianceLog, writeComplianceLog, 'whiteglove_compliance'); }

  function buildAcceptanceHtml(){
    const rows = readAcceptanceInbox();
    const body = rows.map(row => '<tr><td>'+esc(row.label || 'Acceptance harness')+'</td><td>'+(row.ok ? 'GREEN' : 'ACTION REQUIRED')+'</td><td>'+esc(String(row.blockerCount || 0))+'</td><td>'+esc((row.scenarios || []).map(s => s.label).join(' • '))+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AE FLOW white-glove acceptance inbox</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.wrap{max-width:1100px;margin:0 auto}.card{border:1px solid #ddd;border-radius:16px;padding:16px;margin:0 0 16px}.badge{display:inline-block;padding:4px 8px;border:1px solid #ccc;border-radius:999px;margin:0 6px 6px 0}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px">AE FLOW • White-glove acceptance inbox</h1><div><span class="badge">Runs '+esc(String(rows.length))+'</span><span class="badge">Sync logs '+esc(String(readAcceptanceLog().length))+'</span></div></div><div class="card"><table><thead><tr><th>Run</th><th>Status</th><th>Blockers</th><th>Scenarios</th></tr></thead><tbody>'+(body || '<tr><td colspan="4">No acceptance harness imported yet.</td></tr>')+'</tbody></table></div></div></body></html>';
  }
  function buildComplianceHtml(){
    const rows = readComplianceInbox();
    const body = rows.map(row => '<tr><td>'+esc(row.label || 'Compliance pack')+'</td><td>'+esc(row.bookingId || '—')+'</td><td>'+esc(String((row.counts || {}).docs || 0))+'</td><td>'+esc(String((row.counts || {}).execution || 0))+'</td><td>'+esc(String((row.counts || {}).payout || 0))+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AE FLOW white-glove compliance inbox</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.wrap{max-width:1100px;margin:0 auto}.card{border:1px solid #ddd;border-radius:16px;padding:16px;margin:0 0 16px}.badge{display:inline-block;padding:4px 8px;border:1px solid #ccc;border-radius:999px;margin:0 6px 6px 0}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px">AE FLOW • White-glove compliance inbox</h1><div><span class="badge">Packs '+esc(String(rows.length))+'</span><span class="badge">Sync logs '+esc(String(readComplianceLog().length))+'</span></div></div><div class="card"><table><thead><tr><th>Pack</th><th>Booking</th><th>Docs</th><th>Execution</th><th>Payout</th></tr></thead><tbody>'+(body || '<tr><td colspan="5">No compliance packs imported yet.</td></tr>')+'</tbody></table></div></div></body></html>';
  }

  function continuitySummary(){
    const profiles = readProfiles();
    const bookings = readBookings();
    const memberships = readMemberships();
    return {
      profiles: profiles.length,
      bookings: bookings.length,
      memberships: memberships.length,
      docs: readDocs().length,
      acceptanceRuns: readAcceptanceInbox().length,
      compliancePacks: readComplianceInbox().length
    };
  }

  function inject(){
    const existing = document.getElementById('aeWhiteGloveV45Card');
    if(existing) existing.remove();
    const latestAcceptance = readAcceptanceInbox()[0] || null;
    const latestCompliance = readComplianceInbox()[0] || null;
    const continuity = continuitySummary();
    const host = document.querySelector('#app') || document.body;
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'aeWhiteGloveV45Card';
    card.innerHTML = ''+
      '<h2 style="margin:0 0 10px">White-glove acceptance + compliance inbox</h2>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">'+
        '<button class="btn small" id="aeWg45SyncAcceptanceBtn">Sync acceptance harness</button>'+
        '<button class="btn small" id="aeWg45AcceptanceHtmlBtn">Export acceptance inbox HTML</button>'+
        '<button class="btn small" id="aeWg45SyncComplianceBtn">Sync compliance packs</button>'+
        '<button class="btn small" id="aeWg45ComplianceHtmlBtn">Export compliance inbox HTML</button>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px">'+
        '<section style="border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;background:rgba(255,255,255,.03)"><h3 style="margin:0 0 8px">Latest Routex acceptance harness</h3>'+
          (latestAcceptance ? ('<div><span class="badge">'+esc(latestAcceptance.fingerprint || '—')+'</span><span class="badge">Blockers '+esc(String(latestAcceptance.blockerCount || 0))+'</span><span class="badge">'+(latestAcceptance.ok ? 'GREEN' : 'ACTION REQUIRED')+'</span></div><div style="margin-top:8px">'+esc((latestAcceptance.blockers || [])[0] || 'All directive scenarios are passing in the current local harness.')+'</div>') : '<div>No acceptance harness imported yet.</div>')+
        '</section>'+
        '<section style="border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;background:rgba(255,255,255,.03)"><h3 style="margin:0 0 8px">Latest Routex compliance pack</h3>'+
          (latestCompliance ? ('<div><span class="badge">'+esc(latestCompliance.fingerprint || '—')+'</span><span class="badge">Docs '+esc(String((latestCompliance.counts || {}).docs || 0))+'</span><span class="badge">Execution '+esc(String((latestCompliance.counts || {}).execution || 0))+'</span></div><div style="margin-top:8px">Booking '+esc(latestCompliance.bookingId || '—')+'</div>') : '<div>No compliance pack imported yet.</div>')+
        '</section>'+
        '<section style="border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;background:rgba(255,255,255,.03)"><h3 style="margin:0 0 8px">Continuity summary</h3><div><span class="badge">Profiles '+esc(String(continuity.profiles))+'</span><span class="badge">Bookings '+esc(String(continuity.bookings))+'</span><span class="badge">Memberships '+esc(String(continuity.memberships))+'</span><span class="badge">Docs '+esc(String(continuity.docs))+'</span></div><div style="margin-top:8px">Acceptance runs '+esc(String(continuity.acceptanceRuns))+' • compliance packs '+esc(String(continuity.compliancePacks))+'</div></section>'+
      '</div>';
    host.appendChild(card);

    const bind = (id, fn)=> { const el = document.getElementById(id); if(el) el.onclick = fn; };
    bind('aeWg45SyncAcceptanceBtn', ()=>{ const res = syncAcceptance(); toast('Acceptance inbox synced. Added ' + res.added + '.', res.added ? 'good' : 'warn'); inject(); });
    bind('aeWg45AcceptanceHtmlBtn', ()=> downloadText(buildAcceptanceHtml(), 'ae_whiteglove_acceptance_inbox_' + dayISO() + '.html', 'text/html'));
    bind('aeWg45SyncComplianceBtn', ()=>{ const res = syncCompliance(); toast('Compliance inbox synced. Added ' + res.added + '.', res.added ? 'good' : 'warn'); inject(); });
    bind('aeWg45ComplianceHtmlBtn', ()=> downloadText(buildComplianceHtml(), 'ae_whiteglove_compliance_inbox_' + dayISO() + '.html', 'text/html'));
  }

  const observer = new MutationObserver(()=> inject());
  observer.observe(document.body, { childList:true, subtree:true });
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(inject, 0); return out; };

  window.readAEWhiteGloveAcceptanceInboxV45 = readAcceptanceInbox;
  window.readAEWhiteGloveComplianceInboxV45 = readComplianceInbox;
  window.syncAEWhiteGloveAcceptanceInboxV45 = syncAcceptance;
  window.syncAEWhiteGloveComplianceInboxV45 = syncCompliance;
})();
