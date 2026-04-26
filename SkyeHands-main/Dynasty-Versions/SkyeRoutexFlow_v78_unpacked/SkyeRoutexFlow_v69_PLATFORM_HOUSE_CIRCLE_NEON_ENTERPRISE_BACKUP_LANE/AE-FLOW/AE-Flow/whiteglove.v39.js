/* V39 AE FLOW white-glove dossier and continuity bridge */
(function(){
  if(window.__AEFLOW_WHITEGLOVE_V39__) return;
  window.__AEFLOW_WHITEGLOVE_V39__ = true;

  const SHARED_KEYS = {
    profiles: 'skye_whiteglove_service_profiles_v39',
    drivers: 'skye_whiteglove_driver_profiles_v39',
    vehicles: 'skye_whiteglove_vehicle_profiles_v39',
    memberships: 'skye_whiteglove_memberships_v39',
    bookings: 'skye_whiteglove_bookings_v39',
    events: 'skye_whiteglove_events_v39',
    outbox: 'skye_whiteglove_sync_outbox_v39',
    docs: 'skye_whiteglove_docs_v39'
  };
  const LOCAL_KEYS = {
    snapshots: 'skye_aeflow_whiteglove_snapshots_v39',
    ui: 'skye_aeflow_whiteglove_ui_v39'
  };

  const clean = (v)=> String(v == null ? '' : v).trim();
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  const downloadText = window.downloadText || function(content, filename, type){
    const blob = new Blob([content], { type:type || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename || 'download.txt'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=> URL.revokeObjectURL(url), 1200);
  };
  const toast = window.toast || function(){};
  const nowISO = ()=> new Date().toISOString();
  const dayISO = ()=> nowISO().slice(0,10);
  const uid = (p)=> (p || 'id') + '_' + Math.random().toString(36).slice(2,10) + '_' + Date.now().toString(36);
  const money = (n)=> '$' + Number(n || 0).toFixed(2);

  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){ } return value; }
  const readProfiles = ()=> readJSON(SHARED_KEYS.profiles, []);
  const readDrivers = ()=> readJSON(SHARED_KEYS.drivers, []);
  const readVehicles = ()=> readJSON(SHARED_KEYS.vehicles, []);
  const readMemberships = ()=> readJSON(SHARED_KEYS.memberships, []);
  const readBookings = ()=> readJSON(SHARED_KEYS.bookings, []);
  const readEvents = ()=> readJSON(SHARED_KEYS.events, []);
  const readOutbox = ()=> readJSON(SHARED_KEYS.outbox, []);
  const readDocs = ()=> readJSON(SHARED_KEYS.docs, []);
  const readSnapshots = ()=> readJSON(LOCAL_KEYS.snapshots, []);
  const readUI = ()=> readJSON(LOCAL_KEYS.ui, { tab:'overview', selectedProfileId:'' });
  const writeSnapshots = (rows)=> writeJSON(LOCAL_KEYS.snapshots, rows);
  const writeUI = (patch)=> writeJSON(LOCAL_KEYS.ui, Object.assign({}, readUI(), patch || {}));

  function getProfile(id){ return readProfiles().find(row => row.id === id) || null; }
  function getMembership(id){ return readMemberships().find(row => row.id === id) || null; }
  function getBooking(id){ return readBookings().find(row => row.id === id) || null; }
  function getDriver(id){ return readDrivers().find(row => row.id === id) || null; }
  function getVehicle(id){ return readVehicles().find(row => row.id === id) || null; }

  function snapshotWhiteGloveState(){
    const payload = {
      id: uid('aef_wg_snap'),
      createdAt: nowISO(),
      profiles: readProfiles(),
      drivers: readDrivers(),
      vehicles: readVehicles(),
      memberships: readMemberships(),
      bookings: readBookings(),
      outbox: readOutbox(),
      docs: readDocs(),
      eventCount: readEvents().length
    };
    const rows = readSnapshots();
    rows.unshift(payload);
    writeSnapshots(rows.slice(0, 60));
    return payload;
  }

  function exportSnapshotJson(){
    const snap = snapshotWhiteGloveState();
    downloadText(JSON.stringify(snap, null, 2), 'aeflow_whiteglove_snapshot_' + dayISO() + '.json', 'application/json');
  }

  function exportSnapshotHtml(){
    const snap = snapshotWhiteGloveState();
    const html = '<!doctype html><html><head><meta charset="utf-8"><title>AE FLOW white-glove dossier snapshot</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111} table{width:100%;border-collapse:collapse;margin:12px 0} td,th{border:1px solid #ccc;padding:8px;text-align:left} .badge{display:inline-block;padding:4px 8px;border:1px solid #999;border-radius:999px;margin-right:8px}</style></head><body><h1>AE FLOW White-Glove Dossier Snapshot</h1><p><span class="badge">Profiles '+esc(String(snap.profiles.length))+'</span><span class="badge">Bookings '+esc(String(snap.bookings.length))+'</span><span class="badge">Memberships '+esc(String(snap.memberships.length))+'</span><span class="badge">Outbox '+esc(String(snap.outbox.length))+'</span></p><table><thead><tr><th>Profile</th><th>Type</th><th>Membership</th><th>Favorites</th><th>Recent bookings</th></tr></thead><tbody>'+snap.profiles.map(profile => {
      const bookings = snap.bookings.filter(row => row.serviceProfileId === profile.id).length;
      return '<tr><td>'+esc(profile.displayName)+'</td><td>'+esc(profile.profileType)+'</td><td>'+esc(profile.membershipId || '—')+'</td><td>'+esc((profile.favoriteDriverIds || []).join(', ') || '—')+'</td><td>'+esc(String(bookings))+'</td></tr>';
    }).join('')+'</tbody></table></body></html>';
    downloadText(html, 'aeflow_whiteglove_snapshot_' + dayISO() + '.html', 'text/html');
  }

  function summary(){
    const profiles = readProfiles();
    const memberships = readMemberships();
    const bookings = readBookings();
    const recent = bookings.slice().sort((a,b)=> String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))).slice(0,5);
    return {
      profiles: profiles.length,
      households: profiles.filter(row => row.profileType === 'household').length,
      vip: profiles.filter(row => row.profileType === 'vip' || row.profileType === 'executive').length,
      memberships: memberships.filter(row => row.status === 'active').length,
      bookings: bookings.length,
      websiteOrigin: bookings.filter(row => row.requestSource === 'website').length,
      memberBookings: bookings.filter(row => row.billingMode === 'included_block' || row.billingMode === 'member_rate').length,
      favoriteMatched: bookings.filter(row => row.favoriteDriverState === 'matched').length,
      recent
    };
  }

  function profileOptions(){
    return readProfiles().map(row => '<option value="'+esc(row.id)+'">'+esc(row.displayName + ' • ' + row.profileType)+'</option>').join('');
  }
  function driverOptions(){
    return readDrivers().map(row => '<option value="'+esc(row.id)+'">'+esc(row.displayName)+'</option>').join('');
  }

  function dossierHtml(profileId){
    const profile = getProfile(profileId) || readProfiles()[0] || null;
    if(!profile) return '<div>No white-glove service profiles saved yet.</div>';
    const membership = profile.membershipId ? getMembership(profile.membershipId) : null;
    const bookings = readBookings().filter(row => row.serviceProfileId === profile.id).slice(0, 8);
    return '<div><label style="display:grid;gap:6px;font-size:.9rem;margin-bottom:12px"><span>Select service profile</span><select id="aefV39ProfileSelect" style="border:1px solid rgba(255,255,255,.12);background:#0b1120;color:#fff;border-radius:10px;padding:10px">'+profileOptions()+'</select></label>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><div style="background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0 0 8px">Service profile dossier</h3><div><strong>'+esc(profile.displayName)+'</strong> • '+esc(profile.profileType)+'</div><div style="margin-top:8px">'+esc(profile.primaryPhone || '—')+' • '+esc(profile.email || '—')+'</div><div style="margin-top:8px">Preferred zone '+esc(profile.preferredZone || '—')+' • market '+esc(profile.serviceArea || '—')+'</div><div style="margin-top:8px">Favorite drivers '+esc((profile.favoriteDriverIds || []).join(', ') || '—')+'</div><div style="margin-top:8px">Authorized riders '+esc((profile.householdAuthorizedRiders || []).join(' | ') || '—')+'</div><div style="margin-top:8px">White-glove preferences '+esc(JSON.stringify(profile.riderPreferences || {}))+'</div><div style="margin-top:8px">Access notes '+esc(profile.accessNotes || '—')+'</div></div>'
      + '<div style="background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0 0 8px">Membership + continuity</h3><div>Membership '+esc((membership && membership.planType) || '—')+'</div><div style="margin-top:8px">Remaining '+esc(membership ? (String(membership.remainingHours) + 'h / ' + String(membership.remainingMiles) + 'mi') : '—')+'</div><div style="margin-top:8px">Favorite-match rate '+esc(String(bookings.filter(row => row.favoriteDriverState === 'matched').length))+' / '+esc(String(bookings.length))+'</div><div style="margin-top:8px">Recent preferred drivers '+esc(bookings.map(row => (getDriver(row.assignedDriverId) || {}).displayName || row.favoriteDriverState || '—').slice(0,4).join(' • ') || '—')+'</div></div></div>'
      + '<div style="margin-top:16px;background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0 0 8px">Recent ride history</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Booking</th><th>Status</th><th>Source</th><th>Favorite</th><th>Driver</th><th>Recognized</th></tr></thead><tbody>'+bookings.map(row => '<tr><td>'+esc(row.id)+'</td><td>'+esc(row.dispatchStatus)+'</td><td>'+esc(row.requestSource)+'</td><td>'+esc(row.favoriteDriverState || '—')+'</td><td>'+esc(((getDriver(row.assignedDriverId) || {}).displayName) || '—')+'</td><td>'+money((row.finalEconomics && row.finalEconomics.recognizedRevenue) || (row.pricingSnapshot && row.pricingSnapshot.quotedTotal) || 0)+'</td></tr>').join('')+'</tbody></table></div></div>';
  }

  function createQuickProfile(payload){
    if(typeof window.saveWhiteGloveServiceProfile !== 'function') return null;
    return window.saveWhiteGloveServiceProfile(payload);
  }
  function createQuickMembership(payload){
    if(typeof window.saveWhiteGloveMembership !== 'function') return null;
    return window.saveWhiteGloveMembership(payload);
  }

  function openModal(title, bodyHtml, onReady){
    const existing = document.getElementById('aefWgV39Modal');
    if(existing) existing.remove();
    const wrap = document.createElement('div');
    wrap.id = 'aefWgV39Modal';
    wrap.style.cssText = 'position:fixed;inset:0;background:rgba(4,6,10,.72);z-index:999999;display:flex;align-items:center;justify-content:center;padding:18px;';
    wrap.innerHTML = '<div style="width:min(1200px,96vw);max-height:92vh;overflow:auto;background:#0d1220;color:#f5f7fb;border:1px solid rgba(255,255,255,.12);border-radius:18px;box-shadow:0 20px 80px rgba(0,0,0,.55)"><div style="display:flex;justify-content:space-between;align-items:center;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.08)"><h2 style="margin:0;font-size:1.1rem">'+esc(title)+'</h2><button id="aefWgV39CloseBtn" style="border:0;background:#1f2a44;color:#fff;border-radius:10px;padding:10px 12px;cursor:pointer">Close</button></div><div id="aefWgV39Body" style="padding:18px">'+bodyHtml+'</div></div>';
    document.body.appendChild(wrap);
    wrap.querySelector('#aefWgV39CloseBtn').onclick = ()=> wrap.remove();
    wrap.addEventListener('click', (e)=>{ if(e.target === wrap) wrap.remove(); });
    if(typeof onReady === 'function') onReady(wrap.querySelector('#aefWgV39Body'));
  }

  function controlCenterHtml(){
    const ui = readUI();
    const tab = ui.tab || 'overview';
    const s = summary();
    const tabs = [['overview','Overview'],['dossiers','Service dossiers'],['quick-create','Quick create'],['continuity','Continuity + memberships'],['sync','Snapshot + sync']];
    const nav = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">'+tabs.map(([id,label]) => '<button class="aef-v39-tab" data-tab="'+id+'" style="border:1px solid rgba(255,255,255,.12);background:'+(tab===id?'#7c3aed':'#162036')+';color:#fff;border-radius:999px;padding:8px 12px;cursor:pointer">'+esc(label)+'</button>').join('')+'</div>';
    let content = '';
    if(tab === 'overview'){
      content = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px">'
        + metric('Profiles', s.profiles)
        + metric('Households', s.households)
        + metric('VIP / executive', s.vip)
        + metric('Active memberships', s.memberships)
        + metric('Bookings', s.bookings)
        + metric('Website-origin', s.websiteOrigin)
        + metric('Member bookings', s.memberBookings)
        + metric('Favorite matched', s.favoriteMatched)
        + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px"><div style="background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0 0 8px">AE FLOW continuity role</h3><ul style="margin:0;padding-left:18px;line-height:1.7"><li>Show rider, household, and business service context</li><li>Track favorite-driver continuity without lying</li><li>Show membership balance and renewal posture</li><li>Keep recent ride history inside the dossier view</li></ul></div><div style="background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0 0 8px">Recent bookings</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Booking</th><th>Status</th><th>Client</th></tr></thead><tbody>'+s.recent.map(row => '<tr><td>'+esc(row.id)+'</td><td>'+esc(row.dispatchStatus)+'</td><td>'+esc(row.serviceProfileName || '—')+'</td></tr>').join('')+'</tbody></table></div></div>';
    }
    if(tab === 'dossiers') content = dossierHtml(ui.selectedProfileId);
    if(tab === 'quick-create'){
      content = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><form id="aefV39QuickProfileForm" style="display:grid;gap:8px;background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0">Quick service profile</h3>'+input('Display name','displayName')+select('Profile type','profileType',['individual','household','business','vip','medical','executive'])+input('Primary phone','primaryPhone')+input('Email','email')+textarea('Addresses (one per line)','addresses')+input('Preferred zone','preferredZone')+input('Service area / market','serviceArea','phoenix')+input('Favorite driver IDs (comma separated)','favoriteDriverIds')+textarea('Authorized riders (one per line)','householdAuthorizedRiders')+textarea('Access notes','accessNotes')+input('Billing preference','billingPreference')+input('Receipt destination','receiptDestination')+'<button style="border:0;background:#7c3aed;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Save service profile</button></form>'
        + '<form id="aefV39QuickMembershipForm" style="display:grid;gap:8px;background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0">Quick membership</h3>'+selectFromRows('Service profile','serviceProfileId', readProfiles(), row => row.displayName + ' • ' + row.profileType)+select('Plan type','planType',['access_only','monthly_included_hours','monthly_included_hours_and_miles','corporate_retainer'])+input('Active window start','activeStart', dayISO())+input('Active window end','activeEnd')+input('Included hours','includedHours','4')+input('Included miles','includedMiles','120')+input('Tier label','memberTierLabel','White Glove Member')+input('Cadence','cadence','monthly')+input('Status','status','active')+'<button style="border:0;background:#7c3aed;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Save membership</button></form></div>';
    }
    if(tab === 'continuity'){
      const profiles = readProfiles();
      content = '<div style="background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0 0 10px">Continuity board</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Profile</th><th>Membership</th><th>Favorite drivers</th><th>Matched bookings</th><th>Recent assigned driver</th></tr></thead><tbody>'+profiles.map(profile => {
        const bookings = readBookings().filter(row => row.serviceProfileId === profile.id);
        const matched = bookings.filter(row => row.favoriteDriverState === 'matched').length;
        const lastDriver = bookings[0] ? ((getDriver(bookings[0].assignedDriverId) || {}).displayName || '—') : '—';
        const membership = profile.membershipId ? getMembership(profile.membershipId) : null;
        return '<tr><td>'+esc(profile.displayName)+'</td><td>'+esc(membership ? membership.planType : '—')+'</td><td>'+esc((profile.favoriteDriverIds || []).join(', ') || '—')+'</td><td>'+esc(String(matched))+' / '+esc(String(bookings.length))+'</td><td>'+esc(lastDriver)+'</td></tr>';
      }).join('')+'</tbody></table></div>';
    }
    if(tab === 'sync'){
      const snapshots = readSnapshots();
      content = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><div style="background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0 0 10px">Snapshot + export</h3><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="aefV39SyncSnapshotBtn" style="border:0;background:#7c3aed;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Sync white-glove snapshot</button><button id="aefV39ExportJsonBtn" style="border:0;background:#1e293b;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Export snapshot JSON</button><button id="aefV39ExportHtmlBtn" style="border:0;background:#1e293b;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Export snapshot HTML</button></div><div style="margin-top:12px">Website outbox rows visible from Routex: '+esc(String(readOutbox().length))+'</div><div style="margin-top:8px">Generated docs visible from Routex: '+esc(String(readDocs().length))+'</div></div><div style="background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0 0 10px">Recent snapshots</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Snapshot</th><th>Profiles</th><th>Bookings</th><th>Outbox</th></tr></thead><tbody>'+snapshots.map(row => '<tr><td>'+esc(row.createdAt)+'</td><td>'+esc(String(row.profiles.length))+'</td><td>'+esc(String(row.bookings.length))+'</td><td>'+esc(String(row.outbox.length))+'</td></tr>').join('')+'</tbody></table></div></div>';
    }
    return nav + content;
  }

  function metric(label, value){ return '<div style="background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><div style="font-size:.8rem;color:#a6adbb">'+esc(label)+'</div><div style="font-size:1.2rem;font-weight:700;margin-top:6px">'+esc(String(value))+'</div></div>'; }
  function input(label,name,value){ return '<label style="display:grid;gap:6px;font-size:.9rem"><span>'+esc(label)+'</span><input name="'+esc(name)+'" value="'+esc(value || '')+'" style="border:1px solid rgba(255,255,255,.12);background:#0b1120;color:#fff;border-radius:10px;padding:10px"></label>'; }
  function textarea(label,name,value){ return '<label style="display:grid;gap:6px;font-size:.9rem"><span>'+esc(label)+'</span><textarea name="'+esc(name)+'" rows="3" style="border:1px solid rgba(255,255,255,.12);background:#0b1120;color:#fff;border-radius:10px;padding:10px">'+esc(value || '')+'</textarea></label>'; }
  function select(label,name,options){ return '<label style="display:grid;gap:6px;font-size:.9rem"><span>'+esc(label)+'</span><select name="'+esc(name)+'" style="border:1px solid rgba(255,255,255,.12);background:#0b1120;color:#fff;border-radius:10px;padding:10px">'+options.map(v => '<option value="'+esc(v)+'">'+esc(v)+'</option>').join('')+'</select></label>'; }
  function selectFromRows(label,name,rows,labelFn){ return '<label style="display:grid;gap:6px;font-size:.9rem"><span>'+esc(label)+'</span><select name="'+esc(name)+'" style="border:1px solid rgba(255,255,255,.12);background:#0b1120;color:#fff;border-radius:10px;padding:10px"><option value="">Select</option>'+rows.map(row => '<option value="'+esc(row.id)+'">'+esc(labelFn(row))+'</option>').join('')+'</select></label>'; }

  function attachHandlers(body){
    body.addEventListener('click', (e)=>{
      const tab = e.target.closest('.aef-v39-tab');
      if(tab){ writeUI({ tab: tab.dataset.tab }); openControlCenter(); return; }
      if(e.target.id === 'aefV39SyncSnapshotBtn'){ snapshotWhiteGloveState(); toast('White-glove snapshot synced into AE FLOW.', 'good'); openControlCenter('sync'); return; }
      if(e.target.id === 'aefV39ExportJsonBtn'){ exportSnapshotJson(); return; }
      if(e.target.id === 'aefV39ExportHtmlBtn'){ exportSnapshotHtml(); return; }
    });
    const profileSelect = body.querySelector('#aefV39ProfileSelect');
    if(profileSelect){
      profileSelect.value = readUI().selectedProfileId || profileSelect.value;
      profileSelect.onchange = ()=>{ writeUI({ selectedProfileId: profileSelect.value, tab:'dossiers' }); openControlCenter('dossiers'); };
    }
    const quickProfile = body.querySelector('#aefV39QuickProfileForm');
    if(quickProfile) quickProfile.onsubmit = (e)=>{
      e.preventDefault();
      const row = createQuickProfile(Object.fromEntries(new FormData(quickProfile).entries()));
      toast(row ? 'Service profile saved into shared white-glove store.' : 'Shared save function unavailable.', row ? 'good' : 'warn');
      if(row) writeUI({ selectedProfileId: row.id, tab:'dossiers' });
      openControlCenter(row ? 'dossiers' : 'quick-create');
    };
    const quickMembership = body.querySelector('#aefV39QuickMembershipForm');
    if(quickMembership) quickMembership.onsubmit = (e)=>{
      e.preventDefault();
      const row = createQuickMembership(Object.fromEntries(new FormData(quickMembership).entries()));
      toast(row ? 'Membership saved into shared white-glove store.' : 'Shared membership save unavailable.', row ? 'good' : 'warn');
      openControlCenter(row ? 'continuity' : 'quick-create');
    };
  }

  function openControlCenter(forceTab){
    if(forceTab) writeUI({ tab: forceTab });
    openModal('AE FLOW white-glove continuity center', controlCenterHtml(), attachHandlers);
  }

  function inject(){
    const existing = document.getElementById('aefV39WhiteGloveCard');
    if(existing) existing.remove();
    const host = document.querySelector('#app') || document.body;
    const s = summary();
    const card = document.createElement('div');
    card.id = 'aefV39WhiteGloveCard';
    card.className = 'card';
    card.innerHTML = '<h2 style="margin:0 0 10px">White-glove continuity layer</h2><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><span class="badge">Profiles '+esc(String(s.profiles))+'</span><span class="badge">Memberships '+esc(String(s.memberships))+'</span><span class="badge">Website-origin '+esc(String(s.websiteOrigin))+'</span><span class="badge">Favorite matched '+esc(String(s.favoriteMatched))+'</span></div><div style="margin-bottom:12px">AE FLOW now reads and extends the white-glove rider, household, membership, and recent ride continuity chain instead of splitting it into a second CRM.</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="aefV39OpenBtn" class="btn small">White-glove dossiers</button><button id="aefV39SnapshotBtn" class="btn small">Sync white-glove snapshot</button><button id="aefV39ExportBtn" class="btn small">Export dossier HTML</button></div>';
    host.appendChild(card);
    const bar = document.querySelector('.toolbar') || document.querySelector('.row');
    if(bar && !document.getElementById('aefV39ToolbarBtn')){
      const btn = document.createElement('button'); btn.id = 'aefV39ToolbarBtn'; btn.className = 'btn small'; btn.textContent = 'White-glove dossiers'; btn.onclick = ()=> openControlCenter();
      bar.appendChild(btn);
    }
    const openBtn = document.getElementById('aefV39OpenBtn'); if(openBtn) openBtn.onclick = ()=> openControlCenter();
    const snapBtn = document.getElementById('aefV39SnapshotBtn'); if(snapBtn) snapBtn.onclick = ()=>{ snapshotWhiteGloveState(); toast('White-glove snapshot synced into AE FLOW.', 'good'); };
    const exportBtn = document.getElementById('aefV39ExportBtn'); if(exportBtn) exportBtn.onclick = exportSnapshotHtml;
  }

  const observer = new MutationObserver(()=> inject());
  observer.observe(document.body, { childList:true, subtree:true });
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(inject, 0); return out; };

  window.openAEFlowWhiteGloveDossiers = openControlCenter;
  window.syncAEFlowWhiteGloveSnapshot = snapshotWhiteGloveState;
})();
