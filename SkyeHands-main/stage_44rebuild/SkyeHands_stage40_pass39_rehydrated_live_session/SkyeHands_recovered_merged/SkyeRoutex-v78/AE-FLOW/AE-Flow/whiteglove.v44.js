/* V44 AE FLOW white-glove proof inbox + validation visibility + availability continuity */
(function(){
  if(window.__AEFLOW_WHITEGLOVE_V44__) return;
  window.__AEFLOW_WHITEGLOVE_V44__ = true;

  const ROUTEX = {
    proofOutbox: 'skye_whiteglove_proof_outbox_v44',
    validationOutbox: 'skye_whiteglove_validation_outbox_v44',
    availability: 'skye_whiteglove_driver_availability_v44',
    acceptance: 'skye_whiteglove_driver_acceptance_v44'
  };
  const SHARED = {
    profiles: 'skye_whiteglove_service_profiles_v39',
    drivers: 'skye_whiteglove_driver_profiles_v39',
    bookings: 'skye_whiteglove_bookings_v39',
    memberships: 'skye_whiteglove_memberships_v39'
  };
  const KEYS = {
    proofInbox: 'ae_whiteglove_proof_inbox_v44',
    proofLog: 'ae_whiteglove_proof_log_v44',
    validationInbox: 'ae_whiteglove_validation_inbox_v44',
    validationLog: 'ae_whiteglove_validation_log_v44',
    ui: 'ae_whiteglove_v44_ui'
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
  const readProfiles = ()=> readJSON(SHARED.profiles, []);
  const readDrivers = ()=> readJSON(SHARED.drivers, []);
  const readBookings = ()=> readJSON(SHARED.bookings, []);
  const readMemberships = ()=> readJSON(SHARED.memberships, []);
  const readProofInbox = ()=> readJSON(KEYS.proofInbox, []);
  const readProofLog = ()=> readJSON(KEYS.proofLog, []);
  const readValidationInbox = ()=> readJSON(KEYS.validationInbox, []);
  const readValidationLog = ()=> readJSON(KEYS.validationLog, []);
  const writeProofInbox = (rows)=> writeJSON(KEYS.proofInbox, rows);
  const writeProofLog = (rows)=> writeJSON(KEYS.proofLog, rows);
  const writeValidationInbox = (rows)=> writeJSON(KEYS.validationInbox, rows);
  const writeValidationLog = (rows)=> writeJSON(KEYS.validationLog, rows);

  function syncRows(routexKey, inboxReader, inboxWriter, logReader, logWriter, label){
    const source = readJSON(routexKey, []);
    const inbox = inboxReader();
    const known = new Set(inbox.map(row => row.id));
    const additions = source.filter(row => !known.has(row.id));
    if(additions.length){
      inboxWriter(additions.concat(inbox).slice(0, 400));
    }
    const logs = logReader();
    logs.unshift({ id: uid('ae_wg_sync'), kind: label, added: additions.length, sourceCount: source.length, syncedAt: nowISO() });
    logWriter(logs.slice(0, 300));
    return { added: additions.length, total: source.length };
  }

  function syncProof(){ return syncRows(ROUTEX.proofOutbox, readProofInbox, writeProofInbox, readProofLog, writeProofLog, 'whiteglove_proof'); }
  function syncValidation(){ return syncRows(ROUTEX.validationOutbox, readValidationInbox, writeValidationInbox, readValidationLog, writeValidationLog, 'whiteglove_validation'); }

  function latestProof(){ return readProofInbox()[0] || null; }
  function latestValidation(){ return readValidationInbox()[0] || null; }

  function continuitySummary(){
    const profiles = readProfiles();
    const drivers = readDrivers();
    const bookings = readBookings();
    const memberships = readMemberships();
    const availability = readJSON(ROUTEX.availability, []);
    const acceptance = readJSON(ROUTEX.acceptance, []);
    return {
      profiles: profiles.length,
      drivers: drivers.length,
      bookings: bookings.length,
      memberships: memberships.length,
      availabilityPlans: availability.length,
      acceptanceRows: acceptance.length,
      favoriteProfiles: profiles.filter(row => Array.isArray(row.favoriteDriverIds) && row.favoriteDriverIds.length).length,
      memberLinkedBookings: bookings.filter(row => clean(row.membershipId)).length
    };
  }

  function proofInboxHtml(){
    const rows = readProofInbox();
    const body = rows.map(row => '<tr><td>'+esc(row.label || 'White-glove proof pack')+'</td><td>'+esc(row.fingerprint || '—')+'</td><td>'+esc(String(row.blockerCount || 0))+'</td><td>'+(row.ok ? 'GREEN' : 'ACTION REQUIRED')+'</td><td>'+esc(((row.blockers || [])[0]) || 'None')+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>AE FLOW white-glove proof inbox</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1100px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.18);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">AE FLOW • White-glove proof inbox</h1><div><span class="badge">Imported proof packs '+esc(String(rows.length))+'</span><span class="badge">Sync runs '+esc(String(readProofLog().length))+'</span></div></div><div class="card"><table><thead><tr><th>Label</th><th>Fingerprint</th><th>Blockers</th><th>Status</th><th>Top blocker</th></tr></thead><tbody>'+(body || '<tr><td colspan="5">No white-glove proof packs imported yet.</td></tr>')+'</tbody></table></div></div></body></html>';
  }

  function validationInboxHtml(){
    const rows = readValidationInbox();
    const body = rows.map(row => '<tr><td>'+esc(row.label || 'White-glove validation snapshot')+'</td><td>'+esc(row.fingerprint || '—')+'</td><td>'+esc(row.syncHealth || '—')+'</td><td>'+esc(row.continuityHealth || '—')+'</td><td>'+esc((row.notes || '—'))+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>AE FLOW white-glove validation inbox</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1100px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.18);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">AE FLOW • White-glove validation inbox</h1><div><span class="badge">Imported snapshots '+esc(String(rows.length))+'</span><span class="badge">Sync runs '+esc(String(readValidationLog().length))+'</span></div></div><div class="card"><table><thead><tr><th>Label</th><th>Fingerprint</th><th>Sync health</th><th>Continuity health</th><th>Notes</th></tr></thead><tbody>'+(body || '<tr><td colspan="5">No white-glove validation snapshots imported yet.</td></tr>')+'</tbody></table></div></div></body></html>';
  }

  function inject(){
    const latestP = latestProof();
    const latestV = latestValidation();
    const continuity = continuitySummary();
    const existing = document.getElementById('aeWhiteGloveProofCenterV44');
    if(existing) existing.remove();
    const host = document.querySelector('#app') || document.body;
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'aeWhiteGloveProofCenterV44';
    card.innerHTML = ''+
      '<h2 style="margin:0 0 10px;">White-glove proof + continuity inbox</h2>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">'+
        '<button class="btn small" id="aeWgV44SyncProofBtn">Sync proof packs</button>'+
        '<button class="btn small" id="aeWgV44ProofHtmlBtn">Export proof inbox HTML</button>'+
        '<button class="btn small" id="aeWgV44SyncValidationBtn">Sync validation snapshots</button>'+
        '<button class="btn small" id="aeWgV44ValidationHtmlBtn">Export validation inbox HTML</button>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;">'+
        '<section style="border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;background:rgba(255,255,255,.03);">'+
          '<h3 style="margin:0 0 8px;">Latest Routex proof pack</h3>'+
          (latestP ? ('<div><span class="badge">'+esc(latestP.fingerprint || '—')+'</span><span class="badge">Blockers '+esc(String(latestP.blockerCount || 0))+'</span><span class="badge">'+(latestP.ok ? 'GREEN' : 'ACTION REQUIRED')+'</span></div><div style="margin-top:8px;">Top blocker: '+esc((latestP.blockers || [])[0] || 'None')+'</div>') : '<div>No Routex white-glove proof pack imported yet.</div>')+
        '</section>'+
        '<section style="border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;background:rgba(255,255,255,.03);">'+
          '<h3 style="margin:0 0 8px;">Latest Routex validation snapshot</h3>'+
          (latestV ? ('<div><span class="badge">'+esc(latestV.fingerprint || '—')+'</span><span class="badge">Sync '+esc(latestV.syncHealth || '—')+'</span><span class="badge">Continuity '+esc(latestV.continuityHealth || '—')+'</span></div><div style="margin-top:8px;">'+esc(latestV.notes || '')+'</div>') : '<div>No Routex validation snapshot imported yet.</div>')+
        '</section>'+
        '<section style="border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;background:rgba(255,255,255,.03);">'+
          '<h3 style="margin:0 0 8px;">Continuity visibility</h3>'+
          '<div><span class="badge">Profiles '+esc(String(continuity.profiles))+'</span><span class="badge">Drivers '+esc(String(continuity.drivers))+'</span><span class="badge">Bookings '+esc(String(continuity.bookings))+'</span></div>'+
          '<div style="margin-top:8px;">Favorites '+esc(String(continuity.favoriteProfiles))+' • memberships '+esc(String(continuity.memberships))+' • member-linked bookings '+esc(String(continuity.memberLinkedBookings))+'</div>'+
          '<div style="margin-top:8px;">Availability plans '+esc(String(continuity.availabilityPlans))+' • acceptance rows '+esc(String(continuity.acceptanceRows))+'</div>'+
        '</section>'+
      '</div>';
    host.appendChild(card);

    const bind = (id, fn)=> { const el = document.getElementById(id); if(el) el.onclick = fn; };
    bind('aeWgV44SyncProofBtn', ()=>{ const res = syncProof(); toast('White-glove proof inbox synced. Added ' + res.added + '.', res.added ? 'good' : 'warn'); inject(); });
    bind('aeWgV44ProofHtmlBtn', ()=> downloadText(proofInboxHtml(), 'ae_whiteglove_proof_inbox_' + dayISO() + '.html', 'text/html'));
    bind('aeWgV44SyncValidationBtn', ()=>{ const res = syncValidation(); toast('White-glove validation inbox synced. Added ' + res.added + '.', res.added ? 'good' : 'warn'); inject(); });
    bind('aeWgV44ValidationHtmlBtn', ()=> downloadText(validationInboxHtml(), 'ae_whiteglove_validation_inbox_' + dayISO() + '.html', 'text/html'));
  }

  const observer = new MutationObserver(()=> inject());
  observer.observe(document.body, { childList:true, subtree:true });
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(inject, 0); return out; };

  window.readAEWhiteGloveProofInboxV44 = readProofInbox;
  window.readAEWhiteGloveValidationInboxV44 = readValidationInbox;
  window.syncAEWhiteGloveProofInboxV44 = syncProof;
  window.syncAEWhiteGloveValidationInboxV44 = syncValidation;
})();
