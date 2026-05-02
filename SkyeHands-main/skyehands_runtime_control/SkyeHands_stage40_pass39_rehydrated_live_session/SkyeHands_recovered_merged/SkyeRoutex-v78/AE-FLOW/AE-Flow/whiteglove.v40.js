/* V40 AE FLOW white-glove continuity + booking command center */
(function(){
  if(window.__AEFLOW_WHITEGLOVE_V40__) return;
  window.__AEFLOW_WHITEGLOVE_V40__ = true;

  const SHARED = {
    profiles: 'skye_whiteglove_service_profiles_v39',
    drivers: 'skye_whiteglove_driver_profiles_v39',
    vehicles: 'skye_whiteglove_vehicle_profiles_v39',
    memberships: 'skye_whiteglove_memberships_v39',
    bookings: 'skye_whiteglove_bookings_v39',
    outbox: 'skye_whiteglove_sync_outbox_v39'
  };
  const ROUTEX_V40 = {
    templates: 'skye_whiteglove_recurring_templates_v40',
    board: 'skye_whiteglove_dispatch_boards_v40',
    inbox: 'skye_whiteglove_dispatch_inbox_v40'
  };
  const KEYS = {
    ui: 'aef_whiteglove_v40_ui',
    imported: 'aef_whiteglove_dispatch_imports_v40'
  };
  const CANON = window.SkyeWhiteGloveCanon || { requestSource:['website','operator','imported','phone','returning_member','concierge'], serviceType:['now','reserve','airport','errand','hourly_standby','recurring'] };

  const clean = (v)=> String(v == null ? '' : v).trim();
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const nowISO = ()=> new Date().toISOString();
  const dayISO = ()=> nowISO().slice(0,10);
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
  const readProfiles = ()=> (window.readWhiteGloveServiceProfiles ? window.readWhiteGloveServiceProfiles() : readJSON(SHARED.profiles, []));
  const readBookings = ()=> (window.readWhiteGloveBookings ? window.readWhiteGloveBookings() : readJSON(SHARED.bookings, []));
  const readMemberships = ()=> (window.readWhiteGloveMemberships ? window.readWhiteGloveMemberships() : readJSON(SHARED.memberships, []));
  const readOutbox = ()=> readJSON(SHARED.outbox, []);
  const readTemplates = ()=> readJSON(ROUTEX_V40.templates, []);
  const readRoutexBoards = ()=> readJSON(ROUTEX_V40.board, []);
  const readImports = ()=> readJSON(KEYS.imported, []);
  const readUI = ()=> readJSON(KEYS.ui, { tab:'overview', preview:null, selectedProfileId:'' });
  const writeImports = (rows)=> writeJSON(KEYS.imported, rows);
  const writeUI = (patch)=> writeJSON(KEYS.ui, Object.assign({}, readUI(), patch || {}));

  function getProfile(id){ return readProfiles().find(row => row.id === id) || null; }
  function getMembership(id){ return readMemberships().find(row => row.id === id) || null; }

  function syncDispatchBoard(){
    const latest = readRoutexBoards()[0];
    if(!latest) return null;
    const rows = readImports();
    rows.unshift({ id: 'aef_wg_import_' + Date.now().toString(36), importedAt: nowISO(), payload: latest });
    writeImports(rows.slice(0, 80));
    return latest;
  }

  function previewBooking(input){
    const pricing = readJSON('skye_whiteglove_pricing_catalog_v39', []);
    const serviceType = clean(input.serviceType) || 'reserve';
    const vehicleClass = clean(input.vehicleClass) || 'sedan';
    const market = clean(input.market).toLowerCase() || 'phoenix';
    const factorMap = { phoenix:1, glendale:0.98, scottsdale:1.16, mesa:1.01, valley_wide:1.12 };
    const entry = pricing.find(row => row.serviceType === serviceType && row.vehicleClass === vehicleClass) || pricing.find(row => row.serviceType === serviceType) || pricing[0] || { label:'Unconfigured', baseRate:0, includedMilesPerHour:0, extraMileRate:0, rushFee:0 };
    const bookedHours = Math.max(Number(input.bookedHours || 1), Number(entry.hourlyMinimum || 1));
    const miles = Math.max(Number(input.requestedMiles || 0), 0);
    const includedMiles = bookedHours * Number(entry.includedMilesPerHour || 0);
    const extraMiles = Math.max(0, miles - includedMiles);
    const factor = factorMap[market] || 1;
    const subtotal = (bookedHours * Number(entry.baseRate || 0) * factor) + (extraMiles * Number(entry.extraMileRate || 0) * factor) + (input.sameDay ? Number(entry.rushFee || 0) : 0);
    return { catalogLabel: entry.label, quotedTotal: Number(subtotal.toFixed(2)), includedMiles, extraMiles };
  }

  function createBooking(values){
    if(typeof window.saveWhiteGloveBooking !== 'function') return null;
    return window.saveWhiteGloveBooking(values);
  }

  function createFromTemplate(templateId, date, start, end){
    const tpl = readTemplates().find(row => row.id === templateId);
    if(!tpl || typeof window.saveWhiteGloveBooking !== 'function') return null;
    return window.saveWhiteGloveBooking({
      requestSource: 'operator',
      serviceType: tpl.serviceType,
      serviceProfileId: tpl.serviceProfileId,
      market: tpl.market,
      zone: tpl.zone,
      bookedHours: tpl.bookedHours,
      requestedMiles: tpl.requestedMiles,
      vehicleClass: tpl.vehicleClass,
      pickupAddress: tpl.pickupAddress,
      dropoffAddress: tpl.dropoffAddress,
      riderNotes: tpl.riderNotes,
      operatorNotes: tpl.operatorNotes,
      whiteGloveNotes: tpl.whiteGloveNotes,
      etaWindow: clean(date) && clean(start) && clean(end) ? (clean(date) + ' ' + clean(start) + '-' + clean(end)) : ''
    });
  }

  function metric(label, value){ return '<div style="background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><div style="font-size:.8rem;color:#94a3b8">'+esc(label)+'</div><div style="font-size:1.2rem;font-weight:700;margin-top:6px">'+esc(String(value))+'</div></div>'; }
  function input(label,name,value,type){ return '<label style="display:grid;gap:6px;font-size:.9rem"><span>'+esc(label)+'</span><input type="'+esc(type || 'text')+'" name="'+esc(name)+'" value="'+esc(value || '')+'" style="border:1px solid rgba(255,255,255,.12);background:#020617;color:#fff;border-radius:10px;padding:10px"></label>'; }
  function textarea(label,name,value){ return '<label style="display:grid;gap:6px;font-size:.9rem"><span>'+esc(label)+'</span><textarea name="'+esc(name)+'" rows="3" style="border:1px solid rgba(255,255,255,.12);background:#020617;color:#fff;border-radius:10px;padding:10px">'+esc(value || '')+'</textarea></label>'; }
  function select(label,name,options,current){ return '<label style="display:grid;gap:6px;font-size:.9rem"><span>'+esc(label)+'</span><select name="'+esc(name)+'" style="border:1px solid rgba(255,255,255,.12);background:#020617;color:#fff;border-radius:10px;padding:10px">'+options.map(v => '<option value="'+esc(v)+'"'+(String(current || '') === String(v) ? ' selected' : '')+'>'+esc(v)+'</option>').join('')+'</select></label>'; }
  function selectRows(label,name,rows,labelFn,current){ return '<label style="display:grid;gap:6px;font-size:.9rem"><span>'+esc(label)+'</span><select name="'+esc(name)+'" style="border:1px solid rgba(255,255,255,.12);background:#020617;color:#fff;border-radius:10px;padding:10px"><option value="">Select</option>'+rows.map(row => '<option value="'+esc(row.id)+'"'+(String(current || '') === String(row.id) ? ' selected' : '')+'>'+esc(labelFn(row))+'</option>').join('')+'</select></label>'; }

  function openModal(title, html, onReady){
    const existing = document.getElementById('aefWgV40Modal');
    if(existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'aefWgV40Modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(3,8,20,.78);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto';
    overlay.innerHTML = '<div style="width:min(1220px,96vw);background:#07111f;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:22px;box-shadow:0 30px 80px rgba(0,0,0,.45);overflow:hidden"><div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.08)"><div style="font-size:1.05rem;font-weight:700">'+esc(title)+'</div><button id="aefWgV40Close" style="border:0;background:#1e293b;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Close</button></div><div id="aefWgV40Body" style="padding:18px">'+html+'</div></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#aefWgV40Close').onclick = ()=> overlay.remove();
    overlay.addEventListener('click', (e)=>{ if(e.target === overlay) overlay.remove(); });
    if(typeof onReady === 'function') onReady(overlay.querySelector('#aefWgV40Body'));
  }

  function buildHtml(){
    const ui = readUI();
    const tab = ui.tab || 'overview';
    const profiles = readProfiles();
    const bookings = readBookings();
    const memberships = readMemberships();
    const imports = readImports();
    const templates = readTemplates();
    const nav = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">'+['overview','intake','continuity','templates','dispatch-sync'].map(name => '<button class="aefwg40-tab" data-tab="'+name+'" style="border:0;border-radius:999px;padding:10px 14px;cursor:pointer;background:'+(tab === name ? '#7c3aed' : '#172033')+';color:#fff">'+esc(name)+'</button>').join('')+'</div>';
    if(tab === 'overview'){
      const latestImport = imports[0] && imports[0].payload;
      return nav + '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">'+metric('Profiles', profiles.length)+metric('Memberships', memberships.length)+metric('Bookings', bookings.length)+metric('Templates', templates.length)+metric('Website-origin', bookings.filter(row => row.requestSource === 'website').length)+metric('Member rides', bookings.filter(row => row.membershipId).length)+metric('Dispatch imports', imports.length)+metric('Sync queue', readOutbox().length)+'</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px"><div style="background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0 0 10px">Continuity signal</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Profile</th><th>Member state</th><th>Recent rides</th><th>Favorites</th></tr></thead><tbody>'+profiles.slice(0,10).map(row => { const rides = bookings.filter(b => b.serviceProfileId === row.id).length; const membership = row.membershipId ? getMembership(row.membershipId) : null; return '<tr><td style="padding:8px 0">'+esc(row.displayName)+'</td><td>'+esc(membership ? membership.planType : 'retail')+'</td><td>'+esc(String(rides))+'</td><td>'+esc((row.favoriteDriverIds || []).join(', ') || '—')+'</td></tr>'; }).join('')+'</tbody></table></div>'
      + '<div style="background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0 0 10px">Dispatch import</h3><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="aefwg40SyncBoardBtn" style="border:0;background:#7c3aed;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Sync Routex dispatch board</button><button id="aefwg40ExportImportBtn" style="border:0;background:#1e293b;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Export import HTML</button></div><div style="margin-top:12px">'+(latestImport ? ('Latest board • bookings '+esc(String(latestImport.summary.totalBookings || 0))+' • conflicts '+esc(String(latestImport.summary.conflicts || 0))) : 'No Routex dispatch board imported yet.')+'</div></div></div>';
    }
    if(tab === 'intake'){
      const preview = ui.preview;
      return nav + '<div style="display:grid;grid-template-columns:1.1fr .9fr;gap:16px"><form id="aefwg40IntakeForm" style="display:grid;gap:10px;background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0">AE-side white-glove intake</h3>'+selectRows('Service profile','serviceProfileId', profiles, row => row.displayName + ' • ' + row.profileType, ui.selectedProfileId || '')+select('Request source','requestSource', CANON.requestSource, 'operator')+select('Service type','serviceType', CANON.serviceType, 'reserve')+select('Vehicle class','vehicleClass', ['sedan','suv','xl','specialty'], 'sedan')+input('Market','market','phoenix')+input('Booked hours','bookedHours','1','number')+input('Requested miles','requestedMiles','29','number')+input('ETA window','etaWindow', dayISO() + ' 10:00-12:00')+input('Pickup address','pickupAddress','')+input('Dropoff address','dropoffAddress','')+textarea('Rider notes','riderNotes','')+textarea('White-glove notes','whiteGloveNotes','')+'<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="sameDay" value="1"> <span>Same-day / rush</span></label><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" id="aefwg40PreviewBtn" style="border:0;background:#1e293b;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Preview</button><button style="border:0;background:#7c3aed;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Create booking</button></div></form>'
      + '<div style="display:grid;gap:16px"><div style="background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0 0 10px">Preview</h3>'+(preview ? ('<div><div><strong>Tier:</strong> '+esc(preview.catalogLabel)+'</div><div><strong>Included miles:</strong> '+esc(String(preview.includedMiles))+'</div><div><strong>Extra miles:</strong> '+esc(String(preview.extraMiles))+'</div><div><strong>Quote:</strong> '+money(preview.quotedTotal)+'</div></div>') : '<div>No quote preview yet.</div>')+'</div><div style="background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0 0 10px">Recent booking continuity</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Client</th><th>Status</th><th>Source</th><th>Value</th></tr></thead><tbody>'+bookings.slice(0,8).map(row => '<tr><td style="padding:8px 0">'+esc(row.serviceProfileName || getProfile(row.serviceProfileId)?.displayName || '—')+'</td><td>'+esc(row.dispatchStatus)+'</td><td>'+esc(row.requestSource)+'</td><td>'+money((row.pricingSnapshot && row.pricingSnapshot.quotedTotal) || 0)+'</td></tr>').join('')+'</tbody></table></div></div></div>';
    }
    if(tab === 'continuity'){
      return nav + '<div style="background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0 0 10px">Rider / household continuity board</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Profile</th><th>Type</th><th>Membership</th><th>Remaining</th><th>Recent bookings</th><th>Favorite state coverage</th></tr></thead><tbody>'+profiles.map(row => { const rides = bookings.filter(b => b.serviceProfileId === row.id); const membership = row.membershipId ? getMembership(row.membershipId) : null; const matched = rides.filter(b => b.favoriteDriverState === 'matched').length; return '<tr><td style="padding:8px 0">'+esc(row.displayName)+'</td><td>'+esc(row.profileType)+'</td><td>'+esc(membership ? membership.planType : 'retail')+'</td><td>'+esc(membership ? (String(membership.remainingHours || 0) + 'h / ' + String(membership.remainingMiles || 0) + 'mi') : '—')+'</td><td>'+esc(String(rides.length))+'</td><td>'+esc(String(matched))+' / '+esc(String(rides.length))+'</td></tr>'; }).join('')+'</tbody></table></div>';
    }
    return nav + '<div style="display:grid;grid-template-columns:.9fr 1.1fr;gap:16px">'+(tab === 'templates' ? ('<form id="aefwg40TemplateForm" style="display:grid;gap:10px;background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0">Instantiate Routex recurring template</h3>'+selectRows('Template','templateId', templates, row => row.label + ' • ' + row.serviceType, '')+input('Date','date', dayISO())+input('Start time','start','09:00')+input('End time','end','11:00')+'<button style="border:0;background:#7c3aed;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Create booking</button></form><div style="background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0 0 10px">Routex templates</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Label</th><th>Client</th><th>Type</th><th>Market</th></tr></thead><tbody>'+templates.map(row => '<tr><td style="padding:8px 0">'+esc(row.label)+'</td><td>'+esc(getProfile(row.serviceProfileId)?.displayName || '—')+'</td><td>'+esc(row.serviceType)+'</td><td>'+esc(row.market)+'</td></tr>').join('')+(templates.length ? '' : '<tr><td colspan="4">No templates available yet.</td></tr>')+'</tbody></table></div>') : ('<div style="background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0 0 10px">Imported dispatch boards</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Imported</th><th>Bookings</th><th>Conflicts</th><th>Website</th></tr></thead><tbody>'+imports.map(row => '<tr><td style="padding:8px 0">'+esc(row.importedAt)+'</td><td>'+esc(String((row.payload.summary && row.payload.summary.totalBookings) || 0))+'</td><td>'+esc(String((row.payload.summary && row.payload.summary.conflicts) || 0))+'</td><td>'+esc(String((row.payload.summary && row.payload.summary.websiteOrigin) || 0))+'</td></tr>').join('')+(imports.length ? '' : '<tr><td colspan="4">No imported boards yet.</td></tr>')+'</tbody></table></div><div style="background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0 0 10px">Shared queue visibility</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Kind</th><th>Status</th><th>Retry</th></tr></thead><tbody>'+readOutbox().slice(0,20).map(row => '<tr><td style="padding:8px 0">'+esc(row.kind)+'</td><td>'+esc(row.status)+'</td><td>'+esc(String(row.retryCount || 0))+'</td></tr>').join('')+'</tbody></table></div>'))+'</div>';
  }

  function buildImportHtml(){
    const rows = readImports();
    const tableRows = rows.map(row => '<tr><td>'+esc(row.importedAt)+'</td><td>'+esc(String((row.payload.summary && row.payload.summary.totalBookings) || 0))+'</td><td>'+esc(String((row.payload.summary && row.payload.summary.assigned) || 0))+'</td><td>'+esc(String((row.payload.summary && row.payload.summary.live) || 0))+'</td><td>'+esc(String((row.payload.summary && row.payload.summary.conflicts) || 0))+'</td></tr>').join('') || '<tr><td colspan="5">No dispatch imports yet.</td></tr>';
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AE FLOW white-glove dispatch imports</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left}</style></head><body><h1>AE FLOW • White-glove dispatch imports</h1><table><thead><tr><th>Imported</th><th>Bookings</th><th>Assigned</th><th>Live</th><th>Conflicts</th></tr></thead><tbody>'+tableRows+'</tbody></table></body></html>';
  }

  function openCenter(forceTab){ if(forceTab) writeUI({ tab: forceTab }); openModal('AE FLOW white-glove booking command center', buildHtml(), bindHandlers); }
  function bindHandlers(body){
    body.addEventListener('click', (e)=>{
      const tab = e.target.closest('.aefwg40-tab');
      if(tab){ writeUI({ tab: tab.dataset.tab }); openCenter(); return; }
      if(e.target.id === 'aefwg40SyncBoardBtn'){ const row = syncDispatchBoard(); toast(row ? 'Routex dispatch board imported.' : 'No Routex dispatch board available.', row ? 'good' : 'warn'); openCenter('dispatch-sync'); return; }
      if(e.target.id === 'aefwg40ExportImportBtn'){ downloadText(buildImportHtml(), 'aeflow_whiteglove_dispatch_imports_' + nowISO().replace(/[:.]/g,'-') + '.html', 'text/html'); return; }
    });
    const intake = body.querySelector('#aefwg40IntakeForm');
    if(intake){
      intake.onsubmit = (e)=>{ e.preventDefault(); const values = Object.fromEntries(new FormData(intake).entries()); values.sameDay = intake.querySelector('[name="sameDay"]')?.checked; const booking = createBooking(values); toast(booking ? 'White-glove booking created from AE FLOW.' : 'Shared booking save unavailable.', booking ? 'good' : 'warn'); openCenter(booking ? 'overview' : 'intake'); };
      const previewBtn = body.querySelector('#aefwg40PreviewBtn');
      if(previewBtn) previewBtn.onclick = ()=>{ const values = Object.fromEntries(new FormData(intake).entries()); values.sameDay = intake.querySelector('[name="sameDay"]')?.checked; writeUI({ preview: previewBooking(values), selectedProfileId: values.serviceProfileId || '' }); openCenter('intake'); };
    }
    const tpl = body.querySelector('#aefwg40TemplateForm');
    if(tpl){ tpl.onsubmit = (e)=>{ e.preventDefault(); const values = Object.fromEntries(new FormData(tpl).entries()); const booking = createFromTemplate(values.templateId, values.date, values.start, values.end); toast(booking ? 'Routex recurring template instantiated from AE FLOW.' : 'Template instantiate unavailable.', booking ? 'good' : 'warn'); openCenter(booking ? 'overview' : 'templates'); }; }
  }

  function inject(){
    const existing = document.getElementById('aefWg40Card');
    if(existing) existing.remove();
    const bookings = readBookings();
    const imports = readImports();
    const host = document.querySelector('#app') || document.body;
    const card = document.createElement('div');
    card.id = 'aefWg40Card';
    card.className = 'card';
    card.innerHTML = '<h2 style="margin:0 0 10px">White-glove booking command center</h2><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><span class="badge">Profiles '+esc(String(readProfiles().length))+'</span><span class="badge">Bookings '+esc(String(bookings.length))+'</span><span class="badge">Templates '+esc(String(readTemplates().length))+'</span><span class="badge">Dispatch imports '+esc(String(imports.length))+'</span></div><div style="margin-bottom:12px">AE FLOW can now create premium bookings, track rider continuity, instantiate recurring templates, and import the Routex dispatch board into one command surface.</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="aefWg40OpenBtn" class="btn small">White-glove command center</button><button id="aefWg40SyncBtn" class="btn small">Sync dispatch board</button><button id="aefWg40ExportBtn" class="btn small">Export imports HTML</button></div>';
    host.appendChild(card);
    card.querySelector('#aefWg40OpenBtn').onclick = ()=> openCenter('overview');
    card.querySelector('#aefWg40SyncBtn').onclick = ()=>{ const row = syncDispatchBoard(); toast(row ? 'Routex dispatch board imported.' : 'No Routex dispatch board available.', row ? 'good' : 'warn'); };
    card.querySelector('#aefWg40ExportBtn').onclick = ()=> downloadText(buildImportHtml(), 'aeflow_whiteglove_dispatch_imports_' + nowISO().replace(/[:.]/g,'-') + '.html', 'text/html');

    const toolbar = document.querySelector('.toolbar') || document.querySelector('.row');
    if(toolbar && !document.getElementById('aefWg40ToolbarBtn')){
      const btn = document.createElement('button');
      btn.id = 'aefWg40ToolbarBtn';
      btn.className = 'btn small';
      btn.textContent = 'White-glove command';
      btn.onclick = ()=> openCenter('overview');
      toolbar.appendChild(btn);
    }
  }

  const observer = new MutationObserver(()=> inject());
  observer.observe(document.body, { childList:true, subtree:true });
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(inject, 0); return out; };
  window.openAEFlowWhiteGloveCommandCenterV40 = openCenter;
  window.syncAEFlowWhiteGloveDispatchBoardV40 = syncDispatchBoard;
})();
