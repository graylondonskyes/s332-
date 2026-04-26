/* V40 Routex white-glove booking intake + dispatch board */
(function(){
  if(window.__ROUTEX_WHITEGLOVE_V40__) return;
  window.__ROUTEX_WHITEGLOVE_V40__ = true;

  const SHARED = {
    profiles: 'skye_whiteglove_service_profiles_v39',
    drivers: 'skye_whiteglove_driver_profiles_v39',
    vehicles: 'skye_whiteglove_vehicle_profiles_v39',
    memberships: 'skye_whiteglove_memberships_v39',
    bookings: 'skye_whiteglove_bookings_v39',
    events: 'skye_whiteglove_events_v39',
    pricing: 'skye_whiteglove_pricing_catalog_v39',
    outbox: 'skye_whiteglove_sync_outbox_v39',
    docs: 'skye_whiteglove_docs_v39'
  };
  const KEYS = {
    templates: 'skye_whiteglove_recurring_templates_v40',
    board: 'skye_whiteglove_dispatch_boards_v40',
    inbox: 'skye_whiteglove_dispatch_inbox_v40',
    ui: 'skye_whiteglove_dispatch_ui_v40',
    materialized: 'skye_whiteglove_materialized_routes_v40'
  };
  const CANON = window.SkyeWhiteGloveCanon || {
    bookingStatus: ['requested','quoted','confirmed','assigned','en_route','arrived','rider_boarded','in_service','completed','cancelled','no_show'],
    requestSource: ['website','operator','imported','phone','returning_member','concierge'],
    serviceType: ['now','reserve','airport','errand','hourly_standby','recurring']
  };
  const DEFAULT_SCHEDULE_HOURS = 2;

  const clean = (v)=> String(v == null ? '' : v).trim();
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const uid = (p)=> (p || 'id') + '_' + Math.random().toString(36).slice(2,9) + '_' + Date.now().toString(36);
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
  const readDrivers = ()=> (window.readWhiteGloveDriverProfiles ? window.readWhiteGloveDriverProfiles() : readJSON(SHARED.drivers, []));
  const readVehicles = ()=> (window.readWhiteGloveVehicleProfiles ? window.readWhiteGloveVehicleProfiles() : readJSON(SHARED.vehicles, []));
  const readMemberships = ()=> (window.readWhiteGloveMemberships ? window.readWhiteGloveMemberships() : readJSON(SHARED.memberships, []));
  const readBookings = ()=> (window.readWhiteGloveBookings ? window.readWhiteGloveBookings() : readJSON(SHARED.bookings, []));
  const readOutbox = ()=> (window.readWhiteGloveOutbox ? window.readWhiteGloveOutbox() : readJSON(SHARED.outbox, []));
  const readPricing = ()=> readJSON(SHARED.pricing, []);
  const readDocs = ()=> (window.readWhiteGloveDocs ? window.readWhiteGloveDocs() : readJSON(SHARED.docs, []));

  const readTemplates = ()=> readJSON(KEYS.templates, []);
  const readBoards = ()=> readJSON(KEYS.board, []);
  const readInbox = ()=> readJSON(KEYS.inbox, []);
  const readMaterialized = ()=> readJSON(KEYS.materialized, []);
  const readUI = ()=> readJSON(KEYS.ui, { tab:'overview', selectedBookingId:'', preview:null });
  const writeTemplates = (rows)=> writeJSON(KEYS.templates, rows);
  const writeBoards = (rows)=> writeJSON(KEYS.board, rows);
  const writeInbox = (rows)=> writeJSON(KEYS.inbox, rows);
  const writeMaterialized = (rows)=> writeJSON(KEYS.materialized, rows);
  const writeUI = (patch)=> writeJSON(KEYS.ui, Object.assign({}, readUI(), patch || {}));

  function writeSharedBookings(rows){ return writeJSON(SHARED.bookings, rows); }
  function writeSharedEvents(rows){ return writeJSON(SHARED.events, rows); }
  function writeSharedOutbox(rows){ return writeJSON(SHARED.outbox, rows); }

  function writeEvent(type, refs, note, extra){
    const rows = readJSON(SHARED.events, []);
    rows.unshift(Object.assign({ id: uid('wg_evt'), type: clean(type), refs: refs || {}, note: clean(note), createdAt: nowISO() }, extra || {}));
    writeSharedEvents(rows.slice(0, 800));
  }

  function queueOutbox(kind, payload){
    const rows = readOutbox();
    const row = { id: uid('wg_sync'), kind: clean(kind), status:'queued', payload: payload || {}, createdAt: nowISO(), updatedAt: nowISO(), retryCount:0, note:'' };
    rows.unshift(row);
    writeSharedOutbox(rows.slice(0, 600));
    return row;
  }

  function updateOutbox(id, patch){
    const rows = readOutbox().map(row => row.id === id ? Object.assign({}, row, patch || {}, { updatedAt: nowISO() }) : row);
    writeSharedOutbox(rows);
    return rows.find(row => row.id === id) || null;
  }

  function getProfile(id){ return readProfiles().find(row => row.id === id) || null; }
  function getDriver(id){ return readDrivers().find(row => row.id === id) || null; }
  function getVehicle(id){ return readVehicles().find(row => row.id === id) || null; }
  function getMembership(id){ return readMemberships().find(row => row.id === id) || null; }
  function getBooking(id){ return readBookings().find(row => row.id === id) || null; }

  function updateBooking(id, mutator){
    const rows = readBookings();
    const idx = rows.findIndex(row => row.id === id);
    if(idx === -1) return null;
    const next = mutator ? mutator(Object.assign({}, rows[idx])) : rows[idx];
    next.updatedAt = nowISO();
    rows[idx] = next;
    writeSharedBookings(rows);
    return next;
  }

  function scheduleParts(row){
    const raw = clean(row.etaWindow || row.serviceWindow || row.window || '');
    if(!raw){
      const startMs = Date.parse(row.createdAt || nowISO());
      const endMs = startMs + (DEFAULT_SCHEDULE_HOURS * 60 * 60 * 1000);
      return { raw:'', date:new Date(startMs).toISOString().slice(0,10), startMs, endMs, startLabel:new Date(startMs).toISOString().slice(11,16), endLabel:new Date(endMs).toISOString().slice(11,16) };
    }
    let date = '';
    let startLabel = '';
    let endLabel = '';
    const normalized = raw.replace(/\s+to\s+/ig, '-').replace(/\//g, '-');
    const dt = normalized.match(/(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if(dt){ date = dt[1]; startLabel = dt[2]; endLabel = dt[3]; }
    const dt2 = !dt && normalized.match(/(\d{4}-\d{2}-\d{2})T(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/);
    if(dt2){ date = dt2[1]; startLabel = dt2[2]; endLabel = dt2[3]; }
    const timesOnly = !dt && !dt2 && normalized.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if(timesOnly){ date = (row.createdAt || nowISO()).slice(0,10); startLabel = timesOnly[1]; endLabel = timesOnly[2]; }
    if(!date){
      const startMs = Date.parse(row.createdAt || nowISO());
      const endMs = startMs + (DEFAULT_SCHEDULE_HOURS * 60 * 60 * 1000);
      return { raw, date:new Date(startMs).toISOString().slice(0,10), startMs, endMs, startLabel:new Date(startMs).toISOString().slice(11,16), endLabel:new Date(endMs).toISOString().slice(11,16) };
    }
    const startMs = Date.parse(date + 'T' + startLabel + ':00');
    let endMs = Date.parse(date + 'T' + endLabel + ':00');
    if(!(endMs > startMs)) endMs = startMs + (DEFAULT_SCHEDULE_HOURS * 60 * 60 * 1000);
    return { raw, date, startMs, endMs, startLabel, endLabel };
  }

  function overlaps(a, b){ return a.startMs < b.endMs && b.startMs < a.endMs; }

  function activeBookings(){
    return readBookings().filter(row => !['completed','cancelled','no_show'].includes(row.dispatchStatus));
  }

  function conflictReport(){
    const rows = activeBookings();
    const rider = [], driver = [], vehicle = [];
    for(let i = 0; i < rows.length; i++){
      for(let j = i + 1; j < rows.length; j++){
        const a = rows[i], b = rows[j];
        const sa = scheduleParts(a), sb = scheduleParts(b);
        if(!overlaps(sa, sb)) continue;
        if(a.serviceProfileId && a.serviceProfileId === b.serviceProfileId){ rider.push({ kind:'rider', a:a.id, b:b.id, serviceProfileId:a.serviceProfileId, label:(a.serviceProfileName || getProfile(a.serviceProfileId)?.displayName || 'Client') + ' overlap', window: sa.date + ' ' + sa.startLabel + '-' + sa.endLabel }); }
        if(a.assignedDriverId && a.assignedDriverId === b.assignedDriverId){ driver.push({ kind:'driver', a:a.id, b:b.id, driverId:a.assignedDriverId, label:(getDriver(a.assignedDriverId)?.displayName || 'Driver') + ' overlap', window: sa.date + ' ' + sa.startLabel + '-' + sa.endLabel }); }
        if(a.assignedVehicleId && a.assignedVehicleId === b.assignedVehicleId){ vehicle.push({ kind:'vehicle', a:a.id, b:b.id, vehicleId:a.assignedVehicleId, label:(getVehicle(a.assignedVehicleId)?.displayName || 'Vehicle') + ' overlap', window: sa.date + ' ' + sa.startLabel + '-' + sa.endLabel }); }
      }
    }
    return { rider, driver, vehicle, total: rider.length + driver.length + vehicle.length };
  }

  function profileMemberState(profile){
    const membership = profile && profile.membershipId ? getMembership(profile.membershipId) : null;
    return membership ? membership.planType + ' • ' + (membership.status || 'active') : 'retail';
  }

  function previewQuote(input){
    const pricing = readPricing();
    const serviceType = clean(input.serviceType) || 'reserve';
    const vehicleClass = clean(input.vehicleClass) || 'sedan';
    const market = clean(input.market).toLowerCase() || 'phoenix';
    const factorMap = { phoenix:1, glendale:0.98, scottsdale:1.16, mesa:1.01, valley_wide:1.12 };
    const entry = pricing.find(row => row.serviceType === serviceType && row.vehicleClass === vehicleClass) || pricing.find(row => row.serviceType === serviceType) || pricing[0] || { label:'Unconfigured', baseRate:0, includedMilesPerHour:0, extraMileRate:0, waitPerHour:0, rushFee:0, hourlyMinimum:1 };
    const bookedHours = Math.max(Number(input.bookedHours || 1), Number(entry.hourlyMinimum || 1));
    const miles = Math.max(Number(input.requestedMiles || 0), 0);
    const includedMiles = bookedHours * Number(entry.includedMilesPerHour || 0);
    const extraMiles = Math.max(0, miles - includedMiles);
    const factor = factorMap[market] || 1;
    const baseRate = Number(entry.baseRate || 0) * factor;
    const extraMileRate = Number(entry.extraMileRate || 0) * factor;
    const waitPerHour = Number(entry.waitPerHour || 0) * factor;
    const rushFee = input.sameDay ? Number(entry.rushFee || 0) : 0;
    const subtotal = (bookedHours * baseRate) + (extraMiles * extraMileRate) + rushFee;
    return {
      catalogLabel: entry.label,
      bookedHours,
      requestedMiles: miles,
      includedMiles,
      extraMiles,
      baseRate: Number(baseRate.toFixed(2)),
      extraMileRate: Number(extraMileRate.toFixed(2)),
      waitPerHour: Number(waitPerHour.toFixed(2)),
      rushFee: Number(rushFee.toFixed(2)),
      quotedTotal: Number(subtotal.toFixed(2))
    };
  }

  function saveTemplateFromBooking(bookingId, label){
    const booking = getBooking(bookingId);
    if(!booking) return null;
    const row = {
      id: uid('wg_tpl'),
      label: clean(label) || ((booking.serviceProfileName || 'Service') + ' • ' + booking.serviceType),
      bookingId: booking.id,
      serviceProfileId: booking.serviceProfileId,
      serviceType: booking.serviceType,
      market: booking.market,
      zone: booking.zone,
      pickupAddress: booking.pickupAddress,
      dropoffAddress: booking.dropoffAddress,
      riderNotes: booking.riderNotes,
      operatorNotes: booking.operatorNotes,
      whiteGloveNotes: booking.whiteGloveNotes,
      bookedHours: booking.pricingSnapshot && booking.pricingSnapshot.bookedHours,
      requestedMiles: booking.pricingSnapshot && booking.pricingSnapshot.requestedMiles,
      vehicleClass: (getVehicle(booking.assignedVehicleId) || {}).vehicleClass || (booking.pricingSnapshot && booking.pricingSnapshot.vehicleClass) || 'sedan',
      sourceBookingStatus: booking.dispatchStatus,
      createdAt: nowISO()
    };
    const rows = readTemplates();
    rows.unshift(row);
    writeTemplates(rows.slice(0, 200));
    writeEvent('recurring_template_saved', { bookingId: booking.id, templateId: row.id }, 'Recurring template saved from booking', { label: row.label });
    return row;
  }

  function createBookingFromTemplate(templateId, date, start, end){
    const tpl = readTemplates().find(row => row.id === templateId);
    if(!tpl || typeof window.saveWhiteGloveBooking !== 'function') return null;
    const etaWindow = clean(date) && clean(start) && clean(end) ? (clean(date) + ' ' + clean(start) + '-' + clean(end)) : '';
    const booking = window.saveWhiteGloveBooking({
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
      etaWindow: etaWindow
    });
    if(booking){
      writeEvent('recurring_template_instantiated', { templateId: tpl.id, bookingId: booking.id }, 'Recurring template instantiated', { etaWindow });
    }
    return booking;
  }

  function materializeRoute(bookingId){
    const booking = updateBooking(bookingId, row => {
      const multiStops = clean(row.multiStopText || '').split('\n').map(v => clean(v)).filter(Boolean);
      row.routeMaterialized = true;
      row.routeMaterializedAt = nowISO();
      row.routeStopSequence = [row.pickupAddress].concat(multiStops).concat([row.dropoffAddress]).filter(Boolean);
      row.dispatchStatus = ['requested','quoted'].includes(row.dispatchStatus) ? 'confirmed' : row.dispatchStatus;
      row.timeline = Array.isArray(row.timeline) ? row.timeline : [];
      row.timeline.push({ status: row.dispatchStatus, at: nowISO(), note:'Route materialized from booking', routeLink: row.routeLink, routeStopLink: row.routeStopLink, stopCount: row.routeStopSequence.length });
      return row;
    });
    if(!booking) return null;
    const rows = readMaterialized();
    const materialized = {
      id: uid('wg_mat'),
      bookingId: booking.id,
      routeLink: booking.routeLink,
      routeStopLink: booking.routeStopLink,
      stopSequence: booking.routeStopSequence || [booking.pickupAddress, booking.dropoffAddress].filter(Boolean),
      standby: booking.serviceType === 'hourly_standby',
      returnLeg: !!booking.returnLeg,
      createdAt: nowISO()
    };
    rows.unshift(materialized);
    writeMaterialized(rows.slice(0, 300));
    writeEvent('booking_route_materialized', { bookingId: booking.id }, 'Booking route materialized', { stopCount: materialized.stopSequence.length });
    queueOutbox('whiteglove_dispatch_materialized', { bookingId: booking.id, routeLink: booking.routeLink, stopCount: materialized.stopSequence.length });
    return materialized;
  }

  function saveDispatchBoard(){
    const bookings = readBookings();
    const conflicts = conflictReport();
    const board = {
      id: uid('wg_board'),
      createdAt: nowISO(),
      label: 'White-glove dispatch board',
      summary: {
        totalBookings: bookings.length,
        requested: bookings.filter(row => row.dispatchStatus === 'requested').length,
        quoted: bookings.filter(row => row.dispatchStatus === 'quoted').length,
        confirmed: bookings.filter(row => row.dispatchStatus === 'confirmed').length,
        assigned: bookings.filter(row => row.dispatchStatus === 'assigned').length,
        live: bookings.filter(row => ['en_route','arrived','rider_boarded','in_service'].includes(row.dispatchStatus)).length,
        websiteOrigin: bookings.filter(row => row.requestSource === 'website').length,
        memberTrips: bookings.filter(row => row.membershipId).length,
        conflicts: conflicts.total,
        templates: readTemplates().length,
        outbox: readOutbox().length,
        docs: readDocs().length
      },
      conflicts,
      bookings: bookings.slice(0, 40).map(row => ({ id: row.id, client: row.serviceProfileName || (getProfile(row.serviceProfileId)||{}).displayName || '—', status: row.dispatchStatus, source: row.requestSource, favoriteDriverState: row.favoriteDriverState || '', assignedDriverId: row.assignedDriverId || '', assignedVehicleId: row.assignedVehicleId || '', etaWindow: row.etaWindow || '', quotedTotal: row.pricingSnapshot && row.pricingSnapshot.quotedTotal })),
      outboxRows: readOutbox().slice(0, 40).map(row => ({ id: row.id, kind: row.kind, status: row.status, createdAt: row.createdAt, retryCount: row.retryCount || 0 })),
      templates: readTemplates().slice(0, 20).map(row => ({ id: row.id, label: row.label, serviceType: row.serviceType, market: row.market }))
    };
    const rows = readBoards();
    rows.unshift(board);
    writeBoards(rows.slice(0, 100));
    const inbox = readInbox();
    inbox.unshift({ id: uid('wg_board_in'), importedAt: nowISO(), boardId: board.id, payload: board });
    writeInbox(inbox.slice(0, 100));
    queueOutbox('whiteglove_dispatch_board', { boardId: board.id, summary: board.summary });
    writeEvent('dispatch_board_saved', { boardId: board.id }, 'White-glove dispatch board saved', board.summary);
    return board;
  }

  function exportBoardJson(){
    const board = readBoards()[0];
    if(!board){ toast('No white-glove dispatch board saved yet.', 'warn'); return; }
    downloadText(JSON.stringify(board, null, 2), 'whiteglove_dispatch_board_' + (board.createdAt || nowISO()).replace(/[:.]/g,'-') + '.json', 'application/json');
  }

  function buildBoardHtml(board){
    const bookingRows = (board.bookings || []).map(row => '<tr><td>'+esc(row.id)+'</td><td>'+esc(row.client)+'</td><td>'+esc(row.status)+'</td><td>'+esc(row.source)+'</td><td>'+esc(row.favoriteDriverState || '—')+'</td><td>'+money(row.quotedTotal || 0)+'</td><td>'+esc(row.etaWindow || '—')+'</td></tr>').join('') || '<tr><td colspan="7">No bookings.</td></tr>';
    const conflictRows = ['rider','driver','vehicle'].map(kind => (board.conflicts[kind] || []).map(row => '<tr><td>'+esc(kind)+'</td><td>'+esc(row.label)+'</td><td>'+esc(row.a)+'</td><td>'+esc(row.b)+'</td><td>'+esc(row.window || '—')+'</td></tr>').join('')).join('') || '<tr><td colspan="5">No active conflicts.</td></tr>';
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>White-glove dispatch board</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.wrap{max-width:1180px;margin:0 auto}.card{border:1px solid #ddd;border-radius:16px;padding:16px;margin:0 0 16px}.badge{display:inline-block;padding:4px 8px;border:1px solid #ccc;border-radius:999px;margin:0 8px 8px 0}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px">White-glove dispatch board</h1><div><span class="badge">Bookings '+esc(String(board.summary.totalBookings || 0))+'</span><span class="badge">Requested '+esc(String(board.summary.requested || 0))+'</span><span class="badge">Assigned '+esc(String(board.summary.assigned || 0))+'</span><span class="badge">Live '+esc(String(board.summary.live || 0))+'</span><span class="badge">Conflicts '+esc(String(board.summary.conflicts || 0))+'</span></div></div><div class="card"><h2 style="margin:0 0 8px">Booking pipeline</h2><table><thead><tr><th>ID</th><th>Client</th><th>Status</th><th>Source</th><th>Favorite state</th><th>Quote</th><th>Window</th></tr></thead><tbody>'+bookingRows+'</tbody></table></div><div class="card"><h2 style="margin:0 0 8px">Conflict report</h2><table><thead><tr><th>Type</th><th>Label</th><th>A</th><th>B</th><th>Window</th></tr></thead><tbody>'+conflictRows+'</tbody></table></div></div></body></html>';
  }

  function exportBoardHtml(){
    const board = readBoards()[0];
    if(!board){ toast('No white-glove dispatch board saved yet.', 'warn'); return; }
    downloadText(buildBoardHtml(board), 'whiteglove_dispatch_board_' + (board.createdAt || nowISO()).replace(/[:.]/g,'-') + '.html', 'text/html');
  }

  function retryQueueRow(id){
    const row = readOutbox().find(item => item.id === id);
    if(!row) return null;
    updateOutbox(id, { status:'retrying', retryCount: Number(row.retryCount || 0) + 1, note:'Manual retry from dispatch board' });
    const final = updateOutbox(id, { status:'synced', note:'Manual retry marked synced from dispatch board' });
    writeEvent('dispatch_sync_retried', { outboxId: id }, 'Website/sync queue row retried', { kind: row.kind });
    return final;
  }

  function openModal(title, html, onReady){
    const existing = document.getElementById('wgV40Modal');
    if(existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'wgV40Modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(3,8,20,.78);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto';
    overlay.innerHTML = '<div style="width:min(1280px,96vw);background:#07111f;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:22px;box-shadow:0 30px 80px rgba(0,0,0,.45);overflow:hidden"><div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.08)"><div style="font-size:1.05rem;font-weight:700">'+esc(title)+'</div><button id="wgV40ModalClose" style="border:0;background:#1e293b;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Close</button></div><div id="wgV40ModalBody" style="padding:18px">'+html+'</div></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#wgV40ModalClose').onclick = ()=> overlay.remove();
    overlay.addEventListener('click', (e)=>{ if(e.target === overlay) overlay.remove(); });
    if(typeof onReady === 'function') onReady(overlay.querySelector('#wgV40ModalBody'));
  }

  function metric(label, value){ return '<div style="background:#0f172a;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><div style="font-size:.8rem;color:#94a3b8">'+esc(label)+'</div><div style="font-size:1.2rem;font-weight:700;margin-top:6px">'+esc(String(value))+'</div></div>'; }
  function input(label,name,value,type){ return '<label style="display:grid;gap:6px;font-size:.9rem"><span>'+esc(label)+'</span><input type="'+esc(type || 'text')+'" name="'+esc(name)+'" value="'+esc(value || '')+'" style="border:1px solid rgba(255,255,255,.12);background:#020617;color:#fff;border-radius:10px;padding:10px"></label>'; }
  function textarea(label,name,value){ return '<label style="display:grid;gap:6px;font-size:.9rem"><span>'+esc(label)+'</span><textarea name="'+esc(name)+'" rows="3" style="border:1px solid rgba(255,255,255,.12);background:#020617;color:#fff;border-radius:10px;padding:10px">'+esc(value || '')+'</textarea></label>'; }
  function select(label,name,options,current){ return '<label style="display:grid;gap:6px;font-size:.9rem"><span>'+esc(label)+'</span><select name="'+esc(name)+'" style="border:1px solid rgba(255,255,255,.12);background:#020617;color:#fff;border-radius:10px;padding:10px">'+options.map(v => '<option value="'+esc(v)+'"'+(String(current || '') === String(v) ? ' selected' : '')+'>'+esc(v)+'</option>').join('')+'</select></label>'; }
  function selectRows(label,name,rows,labelFn,current){ return '<label style="display:grid;gap:6px;font-size:.9rem"><span>'+esc(label)+'</span><select name="'+esc(name)+'" style="border:1px solid rgba(255,255,255,.12);background:#020617;color:#fff;border-radius:10px;padding:10px"><option value="">Select</option>'+rows.map(row => '<option value="'+esc(row.id)+'"'+(String(current || '') === String(row.id) ? ' selected' : '')+'>'+esc(labelFn(row))+'</option>').join('')+'</select></label>'; }

  function buildHtml(){
    const ui = readUI();
    const tab = ui.tab || 'overview';
    const bookings = readBookings();
    const drivers = readDrivers();
    const vehicles = readVehicles();
    const profiles = readProfiles();
    const templates = readTemplates();
    const outbox = readOutbox();
    const conflicts = conflictReport();
    const summary = {
      total: bookings.length,
      requested: bookings.filter(row => row.dispatchStatus === 'requested').length,
      assigned: bookings.filter(row => row.dispatchStatus === 'assigned').length,
      live: bookings.filter(row => ['en_route','arrived','rider_boarded','in_service'].includes(row.dispatchStatus)).length,
      website: bookings.filter(row => row.requestSource === 'website').length,
      members: bookings.filter(row => row.membershipId).length,
      conflicts: conflicts.total
    };
    const nav = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">'+['overview','intake','dispatch','templates','sync','conflicts'].map(name => '<button class="wg40-tab" data-tab="'+name+'" style="border:0;border-radius:999px;padding:10px 14px;cursor:pointer;background:'+(tab === name ? '#7c3aed' : '#172033')+';color:#fff">'+esc(name.replace('_',' '))+'</button>').join('')+'</div>';
    if(tab === 'overview'){
      const latestBoard = readBoards()[0];
      return nav + '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">'+metric('Bookings', summary.total)+metric('Requested', summary.requested)+metric('Assigned', summary.assigned)+metric('Live', summary.live)+metric('Website-origin', summary.website)+metric('Member rides', summary.members)+metric('Conflicts', summary.conflicts)+metric('Templates', templates.length)+'</div>'
      + '<div style="display:grid;grid-template-columns:1.2fr .8fr;gap:16px;margin-top:16px"><div style="background:#0f172a;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0 0 10px">Dispatch focus</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Client</th><th>Status</th><th>Source</th><th>Window</th><th>Favorite</th></tr></thead><tbody>'+bookings.slice(0,10).map(row => '<tr><td style="padding:8px 0">'+esc(row.serviceProfileName || getProfile(row.serviceProfileId)?.displayName || '—')+'</td><td>'+esc(row.dispatchStatus)+'</td><td>'+esc(row.requestSource)+'</td><td>'+esc(row.etaWindow || '—')+'</td><td>'+esc(row.favoriteDriverState || '—')+'</td></tr>').join('')+'</tbody></table></div>'
      + '<div style="background:#0f172a;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0 0 10px">Board export</h3><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="wg40SaveBoardBtn" style="border:0;background:#7c3aed;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Save dispatch board</button><button id="wg40ExportBoardHtmlBtn" style="border:0;background:#1e293b;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Export board HTML</button><button id="wg40ExportBoardJsonBtn" style="border:0;background:#1e293b;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Export board JSON</button></div><div style="margin-top:12px">'+(latestBoard ? ('Latest board: '+esc(latestBoard.createdAt)+' • conflicts '+esc(String(latestBoard.summary.conflicts || 0))) : 'No board saved yet.')+'</div></div></div>';
    }
    if(tab === 'intake'){
      const preview = ui.preview;
      return nav + '<div style="display:grid;grid-template-columns:1.15fr .85fr;gap:16px"><form id="wg40IntakeForm" style="display:grid;gap:10px;background:#0f172a;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:16px">'
      + '<h3 style="margin:0">Premium booking intake</h3>'
      + selectRows('Service profile','serviceProfileId', profiles, row => row.displayName + ' • ' + row.profileType, '')
      + select('Request source','requestSource', CANON.requestSource, 'operator')
      + select('Service type','serviceType', CANON.serviceType, 'reserve')
      + select('Vehicle class','vehicleClass', ['sedan','suv','xl','specialty'], 'sedan')
      + input('Market','market','phoenix')
      + input('Zone','zone','')
      + input('Booked hours','bookedHours','1','number')
      + input('Requested miles','requestedMiles','29','number')
      + input('ETA window','etaWindow', dayISO() + ' 09:00-11:00')
      + input('Pickup address','pickupAddress','')
      + input('Dropoff address','dropoffAddress','')
      + textarea('Multi-stop addresses (one per line)','multiStopText','')
      + textarea('Rider notes','riderNotes','')
      + textarea('Operator notes','operatorNotes','')
      + textarea('White-glove notes','whiteGloveNotes','')
      + '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="sameDay" value="1"> <span>Same-day / rush fee</span></label>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" id="wg40PreviewBtn" style="border:0;background:#1e293b;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Preview quote</button><button type="submit" style="border:0;background:#7c3aed;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Create booking</button></div>'
      + '</form>'
      + '<div style="display:grid;gap:16px"><div style="background:#0f172a;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:16px"><h3 style="margin:0 0 10px">Quote preview</h3>'
      + (preview ? ('<div><div><strong>Tier:</strong> '+esc(preview.catalogLabel)+'</div><div><strong>Included miles:</strong> '+esc(String(preview.includedMiles))+'</div><div><strong>Extra miles:</strong> '+esc(String(preview.extraMiles))+'</div><div><strong>Wait rate:</strong> '+money(preview.waitPerHour)+'/hr</div><div><strong>Quote:</strong> '+money(preview.quotedTotal)+'</div></div>') : '<div>No quote preview yet.</div>')
      + '</div><div style="background:#0f172a;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:16px"><h3 style="margin:0 0 10px">Profile continuity</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Profile</th><th>Member state</th><th>Favorite drivers</th></tr></thead><tbody>'
      + profiles.slice(0,8).map(row => '<tr><td style="padding:8px 0">'+esc(row.displayName)+'</td><td>'+esc(profileMemberState(row))+'</td><td>'+esc((row.favoriteDriverIds || []).join(', ') || '—')+'</td></tr>').join('')
      + '</tbody></table></div></div></div>';
    }
    if(tab === 'dispatch'){
      const rows = bookings.filter(row => ['requested','quoted','confirmed','assigned','en_route','arrived','rider_boarded','in_service'].includes(row.dispatchStatus));
      return nav + '<div style="display:grid;gap:16px">'+rows.map(row => {
        const driverSelect = '<select data-driver-select="'+esc(row.id)+'" style="border:1px solid rgba(255,255,255,.12);background:#020617;color:#fff;border-radius:10px;padding:8px;min-width:180px"><option value="">Driver</option>'+drivers.map(driver => '<option value="'+esc(driver.id)+'"'+(row.assignedDriverId === driver.id ? ' selected' : '')+'>'+esc(driver.displayName)+' • '+esc(driver.status)+'</option>').join('')+'</select>';
        const vehicleSelect = '<select data-vehicle-select="'+esc(row.id)+'" style="border:1px solid rgba(255,255,255,.12);background:#020617;color:#fff;border-radius:10px;padding:8px;min-width:180px"><option value="">Vehicle</option>'+vehicles.map(vehicle => '<option value="'+esc(vehicle.id)+'"'+(row.assignedVehicleId === vehicle.id ? ' selected' : '')+'>'+esc(vehicle.displayName)+' • '+esc(vehicle.vehicleClass)+'</option>').join('')+'</select>';
        const timeline = (row.timeline || []).slice(-3).map(item => '<span style="display:inline-block;border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:4px 8px;margin:0 8px 8px 0">'+esc(item.status)+' • '+esc((item.at || '').slice(11,16) || '')+'</span>').join('');
        return '<div style="background:#0f172a;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:16px"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><h3 style="margin:0 0 6px">'+esc(row.serviceProfileName || getProfile(row.serviceProfileId)?.displayName || row.id)+'</h3><div style="color:#94a3b8">'+esc(row.requestSource)+' • '+esc(row.dispatchStatus)+' • '+esc(row.serviceType)+' • '+esc(row.etaWindow || 'No window')+'</div><div style="margin-top:8px">'+timeline+'</div></div><div style="text-align:right"><div><strong>'+money((row.pricingSnapshot && row.pricingSnapshot.quotedTotal) || 0)+'</strong></div><div style="color:#94a3b8">Favorite: '+esc(row.favoriteDriverState || '—')+'</div></div></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">'+driverSelect+vehicleSelect+'<button class="wg40AssignBtn" data-booking-id="'+esc(row.id)+'" style="border:0;background:#7c3aed;color:#fff;border-radius:12px;padding:9px 12px;cursor:pointer">Assign</button><button class="wg40QuoteBtn" data-booking-id="'+esc(row.id)+'" style="border:0;background:#1e293b;color:#fff;border-radius:12px;padding:9px 12px;cursor:pointer">Quote</button><button class="wg40ConfirmBtn" data-booking-id="'+esc(row.id)+'" style="border:0;background:#1e293b;color:#fff;border-radius:12px;padding:9px 12px;cursor:pointer">Confirm</button><button class="wg40AdvanceBtn" data-booking-id="'+esc(row.id)+'" style="border:0;background:#1e293b;color:#fff;border-radius:12px;padding:9px 12px;cursor:pointer">Advance</button><button class="wg40MaterializeBtn" data-booking-id="'+esc(row.id)+'" style="border:0;background:#0f766e;color:#fff;border-radius:12px;padding:9px 12px;cursor:pointer">Materialize route</button><button class="wg40TemplateBtn" data-booking-id="'+esc(row.id)+'" style="border:0;background:#334155;color:#fff;border-radius:12px;padding:9px 12px;cursor:pointer">Save template</button></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px"><div><strong>Pickup:</strong> '+esc(row.pickupAddress || '—')+'<br><strong>Dropoff:</strong> '+esc(row.dropoffAddress || '—')+'</div><div><strong>Route link:</strong> '+esc(row.routeLink || '—')+'<br><strong>Stop link:</strong> '+esc(row.routeStopLink || '—')+'<br><strong>Materialized:</strong> '+esc(row.routeMaterialized ? 'yes' : 'no')+'</div></div></div>';
      }).join('') + (rows.length ? '' : '<div style="background:#0f172a;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:16px">No active dispatch rows.</div>') + '</div>';
    }
    if(tab === 'templates'){
      return nav + '<div style="display:grid;grid-template-columns:.9fr 1.1fr;gap:16px"><form id="wg40TemplateInstantiateForm" style="display:grid;gap:10px;background:#0f172a;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:16px"><h3 style="margin:0">Instantiate recurring template</h3>'
      + selectRows('Template','templateId', templates, row => row.label + ' • ' + row.serviceType, '')
      + input('Date','date', dayISO())
      + input('Start time','start','09:00')
      + input('End time','end','11:00')
      + '<button style="border:0;background:#7c3aed;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Create booking from template</button></form>'
      + '<div style="background:#0f172a;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:16px"><h3 style="margin:0 0 10px">Saved recurring templates</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Label</th><th>Client</th><th>Type</th><th>Market</th><th>Window source</th></tr></thead><tbody>'
      + templates.map(row => '<tr><td style="padding:8px 0">'+esc(row.label)+'</td><td>'+esc(getProfile(row.serviceProfileId)?.displayName || '—')+'</td><td>'+esc(row.serviceType)+'</td><td>'+esc(row.market)+'</td><td>'+esc(row.sourceBookingStatus || '—')+'</td></tr>').join('')
      + (templates.length ? '' : '<tr><td colspan="5">No recurring templates saved yet.</td></tr>')
      + '</tbody></table></div></div>';
    }
    if(tab === 'sync'){
      const websiteBookings = bookings.filter(row => row.requestSource === 'website' || row.requestSource === 'returning_member');
      return nav + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><div style="background:#0f172a;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:16px"><h3 style="margin:0 0 10px">Website-origin bookings</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Client</th><th>Status</th><th>Window</th><th>Membership</th></tr></thead><tbody>'+websiteBookings.map(row => '<tr><td style="padding:8px 0">'+esc(row.serviceProfileName || getProfile(row.serviceProfileId)?.displayName || '—')+'</td><td>'+esc(row.dispatchStatus)+'</td><td>'+esc(row.etaWindow || '—')+'</td><td>'+esc(row.membershipName || 'retail')+'</td></tr>').join('')+(websiteBookings.length ? '' : '<tr><td colspan="4">No website-origin bookings yet.</td></tr>')+'</tbody></table></div><div style="background:#0f172a;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:16px"><h3 style="margin:0 0 10px">Visible sync queue</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Kind</th><th>Status</th><th>Retry</th><th>Action</th></tr></thead><tbody>'+outbox.slice(0,30).map(row => '<tr><td style="padding:8px 0">'+esc(row.kind)+'</td><td>'+esc(row.status)+'</td><td>'+esc(String(row.retryCount || 0))+'</td><td><button class="wg40RetryQueueBtn" data-outbox-id="'+esc(row.id)+'" style="border:0;background:#334155;color:#fff;border-radius:10px;padding:6px 10px;cursor:pointer">Retry</button></td></tr>').join('')+(outbox.length ? '' : '<tr><td colspan="4">No sync queue rows visible.</td></tr>')+'</tbody></table></div></div>';
    }
    return nav + '<div style="display:grid;gap:14px">' + ['rider','driver','vehicle'].map(kind => {
      const rows = conflicts[kind] || [];
      return '<div style="background:#0f172a;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:16px"><h3 style="margin:0 0 10px;text-transform:capitalize">'+esc(kind)+' conflicts</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Label</th><th>A</th><th>B</th><th>Window</th></tr></thead><tbody>'+rows.map(row => '<tr><td style="padding:8px 0">'+esc(row.label)+'</td><td>'+esc(row.a)+'</td><td>'+esc(row.b)+'</td><td>'+esc(row.window || '—')+'</td></tr>').join('')+(rows.length ? '' : '<tr><td colspan="4">No '+esc(kind)+' conflicts.</td></tr>')+'</tbody></table></div>';
    }).join('') + '</div>';
  }

  function openCenter(forceTab){ if(forceTab) writeUI({ tab: forceTab }); openModal('Routex white-glove dispatch board', buildHtml(), bindHandlers); }

  function bindHandlers(body){
    body.addEventListener('click', (e)=>{
      const tab = e.target.closest('.wg40-tab');
      if(tab){ writeUI({ tab: tab.dataset.tab }); openCenter(); return; }
      if(e.target.id === 'wg40SaveBoardBtn'){ saveDispatchBoard(); toast('White-glove dispatch board saved.', 'good'); openCenter('overview'); return; }
      if(e.target.id === 'wg40ExportBoardHtmlBtn'){ exportBoardHtml(); return; }
      if(e.target.id === 'wg40ExportBoardJsonBtn'){ exportBoardJson(); return; }
      const assignBtn = e.target.closest('.wg40AssignBtn');
      if(assignBtn){
        const id = assignBtn.dataset.bookingId;
        const driverId = body.querySelector('[data-driver-select="'+id+'"]')?.value || '';
        const vehicleId = body.querySelector('[data-vehicle-select="'+id+'"]')?.value || '';
        if(typeof window.assignWhiteGloveBooking === 'function'){ window.assignWhiteGloveBooking(id, driverId, vehicleId); toast('Booking assigned / reassigned.', 'good'); }
        openCenter('dispatch'); return;
      }
      const quoteBtn = e.target.closest('.wg40QuoteBtn');
      if(quoteBtn){ updateBooking(quoteBtn.dataset.bookingId, row => { row.dispatchStatus = 'quoted'; row.timeline = Array.isArray(row.timeline) ? row.timeline : []; row.timeline.push({ status:'quoted', at: nowISO(), note:'Operator quote prepared' }); return row; }); writeEvent('booking_quoted', { bookingId: quoteBtn.dataset.bookingId }, 'Booking quoted'); toast('Booking moved to quoted.', 'good'); openCenter('dispatch'); return; }
      const confirmBtn = e.target.closest('.wg40ConfirmBtn');
      if(confirmBtn){ updateBooking(confirmBtn.dataset.bookingId, row => { row.dispatchStatus = 'confirmed'; row.quoteConfirmedAt = nowISO(); row.timeline = Array.isArray(row.timeline) ? row.timeline : []; row.timeline.push({ status:'confirmed', at: nowISO(), note:'Operator confirmed booking' }); return row; }); writeEvent('booking_confirmed', { bookingId: confirmBtn.dataset.bookingId }, 'Booking confirmed'); toast('Booking confirmed.', 'good'); openCenter('dispatch'); return; }
      const advanceBtn = e.target.closest('.wg40AdvanceBtn');
      if(advanceBtn){ if(typeof window.advanceWhiteGloveBookingStatus === 'function'){ window.advanceWhiteGloveBookingStatus(advanceBtn.dataset.bookingId); toast('Booking advanced.', 'good'); } openCenter('dispatch'); return; }
      const materializeBtn = e.target.closest('.wg40MaterializeBtn');
      if(materializeBtn){ materializeRoute(materializeBtn.dataset.bookingId); toast('Route materialized from booking.', 'good'); openCenter('dispatch'); return; }
      const tplBtn = e.target.closest('.wg40TemplateBtn');
      if(tplBtn){ saveTemplateFromBooking(tplBtn.dataset.bookingId); toast('Recurring template saved.', 'good'); openCenter('templates'); return; }
      const retryBtn = e.target.closest('.wg40RetryQueueBtn');
      if(retryBtn){ retryQueueRow(retryBtn.dataset.outboxId); toast('Queue row retried.', 'good'); openCenter('sync'); return; }
    });

    const intake = body.querySelector('#wg40IntakeForm');
    if(intake){
      intake.onsubmit = (e)=>{
        e.preventDefault();
        const values = Object.fromEntries(new FormData(intake).entries());
        values.sameDay = intake.querySelector('[name="sameDay"]')?.checked;
        if(typeof window.saveWhiteGloveBooking === 'function'){
          const booking = window.saveWhiteGloveBooking(values);
          if(booking){ toast('Premium booking created.', 'good'); writeUI({ selectedBookingId: booking.id, preview: previewQuote(values) }); }
        }
        openCenter('dispatch');
      };
      const previewBtn = body.querySelector('#wg40PreviewBtn');
      if(previewBtn) previewBtn.onclick = ()=>{ const values = Object.fromEntries(new FormData(intake).entries()); values.sameDay = intake.querySelector('[name="sameDay"]')?.checked; writeUI({ preview: previewQuote(values) }); openCenter('intake'); };
    }
    const instantiate = body.querySelector('#wg40TemplateInstantiateForm');
    if(instantiate){
      instantiate.onsubmit = (e)=>{ e.preventDefault(); const values = Object.fromEntries(new FormData(instantiate).entries()); const booking = createBookingFromTemplate(values.templateId, values.date, values.start, values.end); toast(booking ? 'Recurring booking created from template.' : 'Template creation unavailable.', booking ? 'good' : 'warn'); openCenter(booking ? 'dispatch' : 'templates'); };
    }
  }

  function inject(){
    const existing = document.getElementById('wg40DispatchCard');
    if(existing) existing.remove();
    const summary = {
      bookings: readBookings().length,
      requested: readBookings().filter(row => row.dispatchStatus === 'requested').length,
      live: readBookings().filter(row => ['en_route','arrived','rider_boarded','in_service'].includes(row.dispatchStatus)).length,
      conflicts: conflictReport().total
    };
    const host = document.querySelector('#app') || document.body;
    const card = document.createElement('div');
    card.id = 'wg40DispatchCard';
    card.className = 'card';
    card.innerHTML = '<h2 style="margin:0 0 10px">White-glove dispatch board</h2><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><span class="badge">Bookings '+esc(String(summary.bookings))+'</span><span class="badge">Requested '+esc(String(summary.requested))+'</span><span class="badge">Live '+esc(String(summary.live))+'</span><span class="badge">Conflicts '+esc(String(summary.conflicts))+'</span></div><div style="margin-bottom:12px">Routex now has a real booking intake, dispatch board, recurring template lane, materialization lane, and visible sync queue for white-glove operations.</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="wg40OpenBoardBtn" class="btn small">White-glove dispatch</button><button id="wg40SaveBoardCardBtn" class="btn small">Save dispatch board</button><button id="wg40ExportBoardCardBtn" class="btn small">Export board HTML</button></div>';
    host.appendChild(card);
    card.querySelector('#wg40OpenBoardBtn').onclick = ()=> openCenter('overview');
    card.querySelector('#wg40SaveBoardCardBtn').onclick = ()=>{ saveDispatchBoard(); toast('White-glove dispatch board saved.', 'good'); };
    card.querySelector('#wg40ExportBoardCardBtn').onclick = ()=> exportBoardHtml();

    const toolbar = document.querySelector('.toolbar') || document.querySelector('.row');
    if(toolbar && !document.getElementById('wg40ToolbarBtn')){
      const btn = document.createElement('button');
      btn.id = 'wg40ToolbarBtn';
      btn.className = 'btn small';
      btn.textContent = 'Dispatch board';
      btn.onclick = ()=> openCenter('overview');
      toolbar.appendChild(btn);
    }
  }

  const observer = new MutationObserver(()=> inject());
  observer.observe(document.body, { childList:true, subtree:true });
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(inject, 0); return out; };

  window.openWhiteGloveDispatchBoardV40 = openCenter;
  window.saveWhiteGloveDispatchBoardV40 = saveDispatchBoard;
  window.exportWhiteGloveDispatchBoardHtmlV40 = exportBoardHtml;
  window.exportWhiteGloveDispatchBoardJsonV40 = exportBoardJson;
})();
