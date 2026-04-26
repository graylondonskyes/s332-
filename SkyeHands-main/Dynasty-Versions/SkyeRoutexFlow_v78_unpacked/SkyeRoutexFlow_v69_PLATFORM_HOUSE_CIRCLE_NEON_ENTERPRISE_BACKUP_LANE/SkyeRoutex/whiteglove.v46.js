/* V46 Routex white-glove advanced conflict depth + special-doc lane */
(function(){
  if(window.__ROUTEX_WHITEGLOVE_V46__) return;
  window.__ROUTEX_WHITEGLOVE_V46__ = true;

  const SHARED = {
    profiles: 'skye_whiteglove_service_profiles_v39',
    drivers: 'skye_whiteglove_driver_profiles_v39',
    vehicles: 'skye_whiteglove_vehicle_profiles_v39',
    memberships: 'skye_whiteglove_memberships_v39',
    bookings: 'skye_whiteglove_bookings_v39',
    events: 'skye_whiteglove_events_v39',
    docs: 'skye_whiteglove_docs_v39'
  };
  const V41 = {
    execution: 'skye_whiteglove_execution_rows_v41',
    payoutLedger: 'skye_whiteglove_payout_ledger_v41'
  };
  const KEYS = {
    conflictSnapshots: 'skye_whiteglove_conflict_snapshots_v46',
    conflictOutbox: 'skye_whiteglove_conflict_outbox_v46',
    bookingMetaLog: 'skye_whiteglove_booking_meta_log_v46',
    ui: 'skye_whiteglove_v46_ui'
  };

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
    const a = document.createElement('a');
    a.href = url; a.download = filename || 'download.txt'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 1200);
  };

  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){ } return value; }
  const readProfiles = ()=> (window.readWhiteGloveServiceProfiles ? window.readWhiteGloveServiceProfiles() : readJSON(SHARED.profiles, []));
  const readDrivers = ()=> (window.readWhiteGloveDriverProfiles ? window.readWhiteGloveDriverProfiles() : readJSON(SHARED.drivers, []));
  const readVehicles = ()=> (window.readWhiteGloveVehicleProfiles ? window.readWhiteGloveVehicleProfiles() : readJSON(SHARED.vehicles, []));
  const readMemberships = ()=> (window.readWhiteGloveMemberships ? window.readWhiteGloveMemberships() : readJSON(SHARED.memberships, []));
  const readBookings = ()=> (window.readWhiteGloveBookings ? window.readWhiteGloveBookings() : readJSON(SHARED.bookings, []));
  const readDocs = ()=> (window.readWhiteGloveDocs ? window.readWhiteGloveDocs() : readJSON(SHARED.docs, []));
  const readExecution = ()=> (window.readWhiteGloveExecutionRowsV41 ? window.readWhiteGloveExecutionRowsV41() : readJSON(V41.execution, []));
  const readPayout = ()=> readJSON(V41.payoutLedger, []);
  const readConflictSnapshots = ()=> readJSON(KEYS.conflictSnapshots, []);
  const readConflictOutbox = ()=> readJSON(KEYS.conflictOutbox, []);
  const readMetaLog = ()=> readJSON(KEYS.bookingMetaLog, []);
  const readUI = ()=> readJSON(KEYS.ui, { bookingId:'' });
  const writeConflictSnapshots = (rows)=> writeJSON(KEYS.conflictSnapshots, rows);
  const writeConflictOutbox = (rows)=> writeJSON(KEYS.conflictOutbox, rows);
  const writeMetaLog = (rows)=> writeJSON(KEYS.bookingMetaLog, rows);
  const writeUI = (patch)=> writeJSON(KEYS.ui, Object.assign({}, readUI(), patch || {}));

  function hash(str){
    let h = 2166136261;
    const s = String(str || '');
    for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h += (h<<1) + (h<<4) + (h<<7) + (h<<8) + (h<<24); }
    return (h >>> 0).toString(16);
  }
  function getById(rows, id){ return rows.find(row => clean(row.id) === clean(id)) || null; }
  function getProfile(id){ return getById(readProfiles(), id); }
  function getDriver(id){ return getById(readDrivers(), id); }
  function getVehicle(id){ return getById(readVehicles(), id); }
  function getMembership(id){ return getById(readMemberships(), id); }
  function getBooking(id){ return getById(readBookings(), id); }
  function pushSharedEvent(type, refs, note, extra){
    const rows = readJSON(SHARED.events, []);
    rows.unshift(Object.assign({ id: uid('wg_evt46'), type: clean(type), refs: refs || {}, note: clean(note), createdAt: nowISO() }, extra || {}));
    writeJSON(SHARED.events, rows.slice(0, 2600));
  }
  function patchBookings(mutator){
    const rows = readBookings();
    const next = mutator(rows.slice()) || rows;
    writeJSON(SHARED.bookings, next);
    return next;
  }
  function patchBooking(bookingId, mutator){
    let found = null;
    const rows = patchBookings(rows => rows.map(row => {
      if(clean(row.id) !== clean(bookingId)) return row;
      found = Object.assign({}, row);
      const next = mutator ? mutator(found) : found;
      next.updatedAt = nowISO();
      return next;
    }));
    if(!found) return null;
    return getById(rows, bookingId);
  }
  function pushOutboxRow(key, row, limit){
    const rows = readJSON(key, []);
    rows.unshift(row);
    writeJSON(key, rows.slice(0, limit || 300));
    return row;
  }
  function upsertDoc(type, title, html, meta){
    const rows = readDocs();
    const row = { id: uid('wg_doc46'), type: clean(type), title: clean(title), html: html || '', meta: meta || {}, createdAt: nowISO() };
    rows.unshift(row);
    writeJSON(SHARED.docs, rows.slice(0, 2400));
    return row;
  }

  function normalizeWindow(row){
    const raw = clean(row.etaWindow || row.serviceWindow || row.window || '');
    if(!raw){
      const startMs = Date.parse(row.createdAt || nowISO());
      return { raw:'', date:new Date(startMs).toISOString().slice(0,10), startMs, endMs:startMs + (Number(row.bookedHours || row.pricingSnapshot?.bookedHours || 1) * 3600000), startLabel:new Date(startMs).toISOString().slice(11,16), endLabel:new Date(startMs + (Number(row.bookedHours || row.pricingSnapshot?.bookedHours || 1) * 3600000)).toISOString().slice(11,16) };
    }
    let date = '';
    let startLabel = '';
    let endLabel = '';
    const dt = raw.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})/);
    const dt2 = raw.match(/(\d{4}-\d{2}-\d{2})T?(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})/);
    const timesOnly = raw.match(/(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})/);
    if(dt){ date = dt[1]; startLabel = dt[2]; endLabel = dt[3]; }
    if(dt2){ date = dt2[1]; startLabel = dt2[2]; endLabel = dt2[3]; }
    if(timesOnly && !date){ date = (row.createdAt || nowISO()).slice(0,10); startLabel = timesOnly[1]; endLabel = timesOnly[2]; }
    const startMs = Date.parse(date + 'T' + (startLabel || '09:00') + ':00');
    let endMs = Date.parse(date + 'T' + (endLabel || '10:00') + ':00');
    if(!(endMs > startMs)) endMs = startMs + (Number(row.bookedHours || row.pricingSnapshot?.bookedHours || 1) * 3600000);
    return { raw, date, startMs, endMs, startLabel: startLabel || new Date(startMs).toISOString().slice(11,16), endLabel: endLabel || new Date(endMs).toISOString().slice(11,16) };
  }
  function activeBooking(row){
    return !['completed','cancelled','no_show'].includes(clean(row.dispatchStatus));
  }
  function multiStops(row){
    return clean(row.multiStopText).split(/\n+/).map(clean).filter(Boolean);
  }
  function decorateBooking(row){
    const norm = normalizeWindow(row);
    const stops = multiStops(row);
    const standby = !!row.standbyPlanned || clean(row.serviceType) === 'hourly_standby' || Number(row.standbyMinutesPlanned || 0) > 0;
    const airport = !!row.airportMeetGreet || clean(row.serviceType) === 'airport';
    const returnLeg = !!row.returnLeg;
    return Object.assign({}, row, {
      _window: norm,
      _multiStops: stops,
      _multiStopCount: stops.length,
      _standby: standby,
      _airport: airport,
      _returnLeg: returnLeg,
      _effectiveDriverId: clean(row.assignedDriverId || row.favoriteDriverId || ''),
      _effectiveVehicleId: clean(row.assignedVehicleId || '')
    });
  }
  function overlap(a, b){
    return a._window.startMs < b._window.endMs && b._window.startMs < a._window.endMs;
  }
  function scoreConflict(a, b){
    const reasons = [];
    let score = 18;
    if(a.serviceProfileId && a.serviceProfileId === b.serviceProfileId){ score += 22; reasons.push('same rider/household continuity clash'); }
    if(a._effectiveDriverId && a._effectiveDriverId === b._effectiveDriverId){ score += 28; reasons.push('same driver overlap'); }
    if(a._effectiveVehicleId && a._effectiveVehicleId === b._effectiveVehicleId){ score += 24; reasons.push('same vehicle overlap'); }
    if(a._airport || b._airport){ score += 10; reasons.push('airport timing buffer required'); }
    if(a._standby || b._standby){ score += 9; reasons.push('standby window can consume dispatch time'); }
    if(a._returnLeg || b._returnLeg){ score += 8; reasons.push('return-leg doubles service exposure'); }
    if(a._multiStopCount || b._multiStopCount){ score += Math.min(16, (a._multiStopCount + b._multiStopCount) * 4); reasons.push('multi-stop path depth increases delay risk'); }
    if(clean(a.market) && clean(b.market) && clean(a.market) !== clean(b.market)){ score += 5; reasons.push('cross-market movement risk'); }
    const durationHours = Math.max(0.5, (Math.min(a._window.endMs, b._window.endMs) - Math.max(a._window.startMs, b._window.startMs)) / 3600000);
    score += Math.round(durationHours * 6);
    let severity = 'low';
    if(score >= 75) severity = 'critical'; else if(score >= 58) severity = 'high'; else if(score >= 38) severity = 'medium';
    const suggestion = a._effectiveDriverId && a._effectiveDriverId === b._effectiveDriverId
      ? 'Reassign one booking or widen the promised window before dispatch.'
      : a._effectiveVehicleId && a._effectiveVehicleId === b._effectiveVehicleId
      ? 'Swap vehicle class or reserve a backup unit.'
      : 'Review rider continuity, promised window, and standby expectations.';
    return { score, severity, reasons, suggestion };
  }
  function buildConflictRows(){
    const rows = readBookings().filter(activeBooking).map(decorateBooking).sort((a,b)=> a._window.startMs - b._window.startMs);
    const conflicts = [];
    for(let i=0;i<rows.length;i++){
      for(let j=i+1;j<rows.length;j++){
        const a = rows[i], b = rows[j];
        if(!overlap(a,b)) continue;
        const meta = scoreConflict(a,b);
        conflicts.push({
          id: uid('wg_conflict'),
          bookingA: a.id,
          bookingB: b.id,
          label: (a.serviceProfileName || getProfile(a.serviceProfileId)?.displayName || a.id) + ' ↔ ' + (b.serviceProfileName || getProfile(b.serviceProfileId)?.displayName || b.id),
          window: a._window.date + ' ' + a._window.startLabel + '-' + a._window.endLabel + ' / ' + b._window.startLabel + '-' + b._window.endLabel,
          driver: a._effectiveDriverId && a._effectiveDriverId === b._effectiveDriverId ? (getDriver(a._effectiveDriverId)?.displayName || a._effectiveDriverId) : '',
          vehicle: a._effectiveVehicleId && a._effectiveVehicleId === b._effectiveVehicleId ? (getVehicle(a._effectiveVehicleId)?.displayName || a._effectiveVehicleId) : '',
          score: meta.score,
          severity: meta.severity,
          reasons: meta.reasons,
          suggestion: meta.suggestion,
          multiStopDepth: (a._multiStopCount || 0) + (b._multiStopCount || 0),
          returnLeg: !!(a._returnLeg || b._returnLeg),
          standby: !!(a._standby || b._standby),
          airport: !!(a._airport || b._airport),
          createdAt: nowISO()
        });
      }
    }
    return conflicts.sort((a,b)=> b.score - a.score);
  }
  function buildConflictSnapshot(){
    const conflicts = buildConflictRows();
    const counts = {
      total: conflicts.length,
      critical: conflicts.filter(r => r.severity === 'critical').length,
      high: conflicts.filter(r => r.severity === 'high').length,
      medium: conflicts.filter(r => r.severity === 'medium').length,
      low: conflicts.filter(r => r.severity === 'low').length,
      airport: conflicts.filter(r => r.airport).length,
      standby: conflicts.filter(r => r.standby).length,
      returnLeg: conflicts.filter(r => r.returnLeg).length
    };
    const digest = JSON.stringify({ counts, sample: conflicts.slice(0,20).map(r => [r.bookingA, r.bookingB, r.score, r.severity]) });
    const blockers = [];
    if(counts.critical) blockers.push(counts.critical + ' critical dispatch conflicts require reassignment or wider windows.');
    if(conflicts.some(r => r.airport && r.severity !== 'low')) blockers.push('Airport meet/greet windows are colliding with other active bookings.');
    if(conflicts.some(r => r.standby && r.severity !== 'low')) blockers.push('Standby/hybrid waits are consuming driver or vehicle capacity.');
    return {
      id: uid('wg_conflict_snapshot'),
      label: 'White-glove conflict snapshot • ' + dayISO(),
      source: 'routex-whiteglove-conflict-v46',
      fingerprint: 'wg-conflict-' + dayISO() + '-' + hash(digest),
      createdAt: nowISO(),
      ok: blockers.length === 0,
      blockerCount: blockers.length,
      blockers,
      counts,
      topSuggestion: conflicts[0] ? conflicts[0].suggestion : 'No active overlap conflicts.',
      rows: conflicts.slice(0,80)
    };
  }
  function saveConflictSnapshot(){
    const row = buildConflictSnapshot();
    const rows = readConflictSnapshots();
    rows.unshift(row);
    writeConflictSnapshots(rows.slice(0, 240));
    pushOutboxRow(KEYS.conflictOutbox, row, 240);
    pushSharedEvent('whiteglove_conflict_snapshot_saved', { conflictSnapshotId: row.id }, 'White-glove conflict snapshot saved', { fingerprint: row.fingerprint, blockerCount: row.blockerCount });
    return row;
  }
  function conflictHtml(row){
    const counts = row.counts || {};
    const body = (row.rows || []).map(item => '<tr><td>'+esc(item.label)+'</td><td>'+esc(item.window)+'</td><td>'+esc(item.severity.toUpperCase())+'</td><td>'+esc(String(item.score))+'</td><td>'+esc(item.reasons.join(' • '))+'</td><td>'+esc(item.suggestion)+'</td></tr>').join('');
    const blockers = (row.blockers || []).map(item => '<li>'+esc(item)+'</li>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>White-glove conflict snapshot</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.wrap{max-width:1200px;margin:0 auto}.card{border:1px solid #ddd;border-radius:18px;padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid #bbb;border-radius:999px;margin:0 6px 6px 0}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}ul{padding-left:18px}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px">Skye Routex • White-glove conflict snapshot</h1><div><span class="badge">'+esc(row.fingerprint || '—')+'</span><span class="badge">Critical '+esc(String(counts.critical || 0))+'</span><span class="badge">High '+esc(String(counts.high || 0))+'</span><span class="badge">Airport '+esc(String(counts.airport || 0))+'</span><span class="badge">Standby '+esc(String(counts.standby || 0))+'</span></div><p style="margin:12px 0 0">'+esc(row.topSuggestion || '')+'</p></div><div class="card"><h2 style="margin:0 0 8px">Blockers</h2>'+(blockers ? '<ul>'+blockers+'</ul>' : '<div>No blockers.</div>')+'</div><div class="card"><h2 style="margin:0 0 8px">Conflicts</h2><table><thead><tr><th>Pair</th><th>Window</th><th>Severity</th><th>Score</th><th>Reasons</th><th>Suggested action</th></tr></thead><tbody>'+(body || '<tr><td colspan="6">No active overlap conflicts.</td></tr>')+'</tbody></table></div></div></body></html>';
  }
  function exportConflictHtml(){ const row = readConflictSnapshots()[0] || saveConflictSnapshot(); downloadText(conflictHtml(row), 'whiteglove_conflict_snapshot_' + dayISO() + '.html', 'text/html'); }
  function exportConflictJson(){ const row = readConflictSnapshots()[0] || saveConflictSnapshot(); downloadText(JSON.stringify(row, null, 2), 'whiteglove_conflict_snapshot_' + dayISO() + '.json', 'application/json'); }

  function saveBookingMeta(payload){
    const booking = patchBooking(payload.bookingId, row => {
      row.multiStopText = clean(payload.multiStopText);
      row.returnLeg = !!payload.returnLeg;
      row.standbyPlanned = !!payload.standbyPlanned;
      row.standbyMinutesPlanned = Number(payload.standbyMinutesPlanned || 0) || 0;
      row.airportMeetGreet = !!payload.airportMeetGreet;
      row.flightCode = clean(payload.flightCode);
      row.signageName = clean(payload.signageName);
      row.meetGreetNotes = clean(payload.meetGreetNotes);
      row.cancellationReason = clean(payload.cancellationReason);
      row.noShowReason = clean(payload.noShowReason);
      row.specialAssistNotes = clean(payload.specialAssistNotes);
      row.timeline = Array.isArray(row.timeline) ? row.timeline : [];
      row.timeline.push({ status:'metadata_enriched_v46', at: nowISO(), note:'Advanced white-glove meta updated.' });
      return row;
    });
    if(!booking) return null;
    const logs = readMetaLog();
    logs.unshift({ id: uid('wg_meta46'), bookingId: booking.id, updatedAt: nowISO(), summary: { multiStopCount: multiStops(booking).length, returnLeg: !!booking.returnLeg, standbyPlanned: !!booking.standbyPlanned, airportMeetGreet: !!booking.airportMeetGreet } });
    writeMetaLog(logs.slice(0, 400));
    pushSharedEvent('whiteglove_booking_meta_saved', { bookingId: booking.id }, 'Advanced white-glove booking metadata saved', { multiStopCount: multiStops(booking).length, returnLeg: !!booking.returnLeg, standbyPlanned: !!booking.standbyPlanned, airportMeetGreet: !!booking.airportMeetGreet });
    return booking;
  }

  function buildAirportMeetGreetHtml(booking){
    const profile = getProfile(booking.serviceProfileId);
    const driver = getDriver(booking.assignedDriverId);
    const vehicle = getVehicle(booking.assignedVehicleId);
    const stopList = multiStops(booking);
    return '<!doctype html><html><head><meta charset="utf-8"><title>Airport meet & greet card</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#111}.hero{border:2px solid #111;border-radius:24px;padding:28px}.badge{display:inline-block;padding:6px 10px;border:1px solid #666;border-radius:999px;margin:0 8px 8px 0}h1{font-size:2.2rem;margin:0 0 10px}table{border-collapse:collapse;width:100%;margin-top:14px}td,th{border:1px solid #ccc;padding:8px;text-align:left}</style></head><body><div class="hero"><div><span class="badge">Airport meet / greet</span><span class="badge">Booking '+esc(booking.id)+'</span><span class="badge">Flight '+esc(booking.flightCode || 'TBD')+'</span></div><h1>'+esc(booking.signageName || (profile && profile.displayName) || booking.serviceProfileName || 'Guest')+'</h1><p><strong>Pickup zone:</strong> '+esc(booking.pickupAddress || 'Airport pickup')+'<br><strong>Dropoff:</strong> '+esc(booking.dropoffAddress || '—')+'<br><strong>Window:</strong> '+esc(booking.etaWindow || '—')+'</p><table><tbody><tr><th>Driver</th><td>'+esc((driver && driver.displayName) || 'Unassigned')+'</td></tr><tr><th>Vehicle</th><td>'+esc((vehicle && vehicle.displayName) || 'Unassigned')+'</td></tr><tr><th>Meet/greet notes</th><td>'+esc(booking.meetGreetNotes || booking.whiteGloveNotes || 'No additional meet/greet note.')+'</td></tr><tr><th>Special assistance</th><td>'+esc(booking.specialAssistNotes || 'None recorded')+'</td></tr><tr><th>Intermediate stops</th><td>'+esc(stopList.join(' • ') || 'None')+'</td></tr></tbody></table></div></body></html>';
  }
  function buildCancellationProofHtml(booking){
    const profile = getProfile(booking.serviceProfileId);
    const membership = getMembership(booking.membershipId);
    const execution = readExecution().find(row => clean(row.bookingId) === clean(booking.id));
    const payout = readPayout().find(row => clean(row.bookingId) === clean(booking.id));
    const docs = readDocs().filter(row => clean((row.meta || {}).bookingId) === clean(booking.id));
    const timeline = (booking.timeline || []).map(item => '<li><strong>'+esc(item.status || 'event')+'</strong> — '+esc(item.at || '—')+' — '+esc(item.note || '')+'</li>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"><title>Cancellation / no-show proof</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.wrap{max-width:1100px;margin:0 auto}.card{border:1px solid #ddd;border-radius:18px;padding:16px;margin:0 0 16px}.badge{display:inline-block;padding:4px 8px;border:1px solid #bbb;border-radius:999px;margin:0 6px 6px 0}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}ul{padding-left:18px}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px">Skye Routex • Cancellation / no-show proof</h1><div><span class="badge">Booking '+esc(booking.id)+'</span><span class="badge">Status '+esc(booking.dispatchStatus || '—')+'</span><span class="badge">Source '+esc(booking.requestSource || '—')+'</span></div><p style="margin:12px 0 0"><strong>Client:</strong> '+esc((profile && profile.displayName) || booking.serviceProfileName || '—')+'<br><strong>Window:</strong> '+esc(booking.etaWindow || '—')+'<br><strong>Pickup:</strong> '+esc(booking.pickupAddress || '—')+'<br><strong>Dropoff:</strong> '+esc(booking.dropoffAddress || '—')+'</p></div><div class="card"><h2 style="margin:0 0 8px">Disposition</h2><table><tbody><tr><th>Cancellation reason</th><td>'+esc(booking.cancellationReason || '—')+'</td></tr><tr><th>No-show reason</th><td>'+esc(booking.noShowReason || '—')+'</td></tr><tr><th>Favorite-driver state</th><td>'+esc(booking.favoriteDriverState || '—')+'</td></tr><tr><th>Membership</th><td>'+esc((membership && membership.memberTierLabel) || booking.billingMode || 'retail')+'</td></tr><tr><th>Execution row present</th><td>'+esc(execution ? 'yes' : 'no')+'</td></tr><tr><th>Payout row present</th><td>'+esc(payout ? 'yes' : 'no')+'</td></tr><tr><th>Booking-linked docs</th><td>'+esc(String(docs.length))+'</td></tr></tbody></table></div><div class="card"><h2 style="margin:0 0 8px">Timeline</h2>'+(timeline ? '<ul>'+timeline+'</ul>' : '<div>No timeline events stored.</div>')+'</div></div></body></html>';
  }
  function exportAirportDoc(bookingId){
    const booking = getBooking(bookingId);
    if(!booking) return null;
    const html = buildAirportMeetGreetHtml(booking);
    const doc = upsertDoc('airport_meet_greet_card_v46', 'whiteglove_airport_meet_greet_' + booking.id, html, { bookingId: booking.id, type:'airport_meet_greet' });
    pushSharedEvent('whiteglove_airport_doc_saved', { bookingId: booking.id, docId: doc.id }, 'Airport meet / greet card saved', { flightCode: booking.flightCode || '', signageName: booking.signageName || '' });
    return { booking, doc, html };
  }
  function exportCancellationDoc(bookingId){
    const booking = getBooking(bookingId);
    if(!booking) return null;
    const html = buildCancellationProofHtml(booking);
    const doc = upsertDoc('cancellation_no_show_proof_v46', 'whiteglove_cancellation_proof_' + booking.id, html, { bookingId: booking.id, type:'cancellation_proof' });
    pushSharedEvent('whiteglove_cancellation_doc_saved', { bookingId: booking.id, docId: doc.id }, 'Cancellation / no-show proof saved', { status: booking.dispatchStatus || '', cancellationReason: booking.cancellationReason || '', noShowReason: booking.noShowReason || '' });
    return { booking, doc, html };
  }

  function bookingOptionsHtml(selectedId){
    return readBookings().map(row => '<option value="'+esc(row.id)+'"'+(clean(row.id) === clean(selectedId) ? ' selected' : '')+'>'+esc((row.serviceProfileName || getProfile(row.serviceProfileId)?.displayName || row.id) + ' • ' + (row.dispatchStatus || '—'))+'</option>').join('');
  }
  function latestSummary(){
    const conflict = readConflictSnapshots()[0] || null;
    const docs = readDocs();
    return {
      conflict,
      airportDocs: docs.filter(row => clean(row.type) === 'airport_meet_greet_card_v46').length,
      cancelDocs: docs.filter(row => clean(row.type) === 'cancellation_no_show_proof_v46').length,
      metaRows: readMetaLog().length
    };
  }
  function currentBooking(){
    const ui = readUI();
    const booking = getBooking(ui.bookingId) || readBookings()[0] || null;
    if(booking && clean(ui.bookingId) !== clean(booking.id)) writeUI({ bookingId: booking.id });
    return booking;
  }
  function inject(){
    const existing = document.getElementById('routexWhiteGloveV46Card');
    if(existing) existing.remove();
    const host = document.querySelector('#app') || document.body;
    const summary = latestSummary();
    const booking = currentBooking();
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'routexWhiteGloveV46Card';
    card.innerHTML = ''+
      '<h2 style="margin:0 0 10px">White-glove conflict + special docs center</h2>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">'+
        '<button class="btn small" id="wg46SaveConflictBtn">Save conflict snapshot</button>'+
        '<button class="btn small" id="wg46ConflictHtmlBtn">Export conflict HTML</button>'+
        '<button class="btn small" id="wg46ConflictJsonBtn">Export conflict JSON</button>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">'+
        '<section style="border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;background:rgba(255,255,255,.03)">'+
          '<h3 style="margin:0 0 8px">Latest conflict depth</h3>'+
          (summary.conflict ? ('<div><span class="badge">'+esc(summary.conflict.fingerprint || '—')+'</span><span class="badge">Critical '+esc(String((summary.conflict.counts || {}).critical || 0))+'</span><span class="badge">High '+esc(String((summary.conflict.counts || {}).high || 0))+'</span><span class="badge">'+(summary.conflict.ok ? 'GREEN' : 'ACTION REQUIRED')+'</span></div><div style="margin-top:8px">'+esc(summary.conflict.topSuggestion || '—')+'</div>') : '<div>No conflict snapshot saved yet.</div>')+
          '<div style="margin-top:10px;color:#a6adbb">Airport docs '+esc(String(summary.airportDocs))+' • cancellation docs '+esc(String(summary.cancelDocs))+' • booking meta rows '+esc(String(summary.metaRows))+'</div>'+
        '</section>'+
        '<section style="border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;background:rgba(255,255,255,.03)">'+
          '<h3 style="margin:0 0 8px">Selected booking enhancer</h3>'+
          (booking ? ('<div style="margin-bottom:8px"><span class="badge">'+esc(booking.id)+'</span><span class="badge">'+esc(booking.dispatchStatus || '—')+'</span><span class="badge">'+esc(booking.serviceType || '—')+'</span></div>') : '<div>No booking available.</div>')+
          '<form id="wg46MetaForm" style="display:grid;gap:8px">'+
            '<label>Booking<select name="bookingId" style="width:100%;margin-top:4px"><option value="">Select booking</option>'+bookingOptionsHtml(booking && booking.id)+'</select></label>'+
            '<label>Intermediate stops<textarea name="multiStopText" rows="3" style="width:100%;margin-top:4px">'+esc((booking && booking.multiStopText) || '')+'</textarea></label>'+
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label><input type="checkbox" name="returnLeg" '+((booking && booking.returnLeg) ? 'checked' : '')+'> Return leg</label><label><input type="checkbox" name="standbyPlanned" '+((booking && booking.standbyPlanned) ? 'checked' : '')+'> Standby planned</label></div>'+
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label>Planned standby minutes<input name="standbyMinutesPlanned" value="'+esc((booking && booking.standbyMinutesPlanned) || '0')+'" style="width:100%;margin-top:4px"></label><label><input type="checkbox" name="airportMeetGreet" '+((booking && booking.airportMeetGreet) ? 'checked' : '')+'> Airport meet/greet</label></div>'+
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label>Flight code<input name="flightCode" value="'+esc((booking && booking.flightCode) || '')+'" style="width:100%;margin-top:4px"></label><label>Signage name<input name="signageName" value="'+esc((booking && booking.signageName) || '')+'" style="width:100%;margin-top:4px"></label></div>'+
            '<label>Meet/greet notes<textarea name="meetGreetNotes" rows="2" style="width:100%;margin-top:4px">'+esc((booking && booking.meetGreetNotes) || '')+'</textarea></label>'+
            '<label>Special assistance notes<textarea name="specialAssistNotes" rows="2" style="width:100%;margin-top:4px">'+esc((booking && booking.specialAssistNotes) || '')+'</textarea></label>'+
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label>Cancellation reason<input name="cancellationReason" value="'+esc((booking && booking.cancellationReason) || '')+'" style="width:100%;margin-top:4px"></label><label>No-show reason<input name="noShowReason" value="'+esc((booking && booking.noShowReason) || '')+'" style="width:100%;margin-top:4px"></label></div>'+
            '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn small" type="submit">Save booking meta</button><button class="btn small" id="wg46AirportBtn" type="button">Export airport card</button><button class="btn small" id="wg46CancelDocBtn" type="button">Export cancellation proof</button></div>'+
          '</form>'+
        '</section>'+
      '</div>';
    host.appendChild(card);

    const bind = (id, fn)=> { const el = document.getElementById(id); if(el) el.onclick = fn; };
    bind('wg46SaveConflictBtn', ()=>{ const row = saveConflictSnapshot(); toast(row.ok ? 'Conflict snapshot saved.' : 'Conflict snapshot saved with blockers.', row.ok ? 'good' : 'warn'); inject(); });
    bind('wg46ConflictHtmlBtn', ()=> exportConflictHtml());
    bind('wg46ConflictJsonBtn', ()=> exportConflictJson());
    bind('wg46AirportBtn', ()=>{
      const form = document.getElementById('wg46MetaForm');
      const values = Object.fromEntries(new FormData(form).entries());
      values.returnLeg = form.querySelector('[name="returnLeg"]').checked;
      values.standbyPlanned = form.querySelector('[name="standbyPlanned"]').checked;
      values.airportMeetGreet = form.querySelector('[name="airportMeetGreet"]').checked;
      const booking = saveBookingMeta(values);
      if(!booking) return toast('Select a booking first.', 'warn');
      const pack = exportAirportDoc(booking.id);
      downloadText(pack.html, 'whiteglove_airport_meet_greet_' + booking.id + '.html', 'text/html');
      toast('Airport meet/greet card exported.', 'good');
      inject();
    });
    bind('wg46CancelDocBtn', ()=>{
      const form = document.getElementById('wg46MetaForm');
      const values = Object.fromEntries(new FormData(form).entries());
      values.returnLeg = form.querySelector('[name="returnLeg"]').checked;
      values.standbyPlanned = form.querySelector('[name="standbyPlanned"]').checked;
      values.airportMeetGreet = form.querySelector('[name="airportMeetGreet"]').checked;
      const booking = saveBookingMeta(values);
      if(!booking) return toast('Select a booking first.', 'warn');
      const pack = exportCancellationDoc(booking.id);
      downloadText(pack.html, 'whiteglove_cancellation_proof_' + booking.id + '.html', 'text/html');
      toast('Cancellation / no-show proof exported.', 'good');
      inject();
    });
    const form = document.getElementById('wg46MetaForm');
    if(form){
      form.onsubmit = (e)=>{
        e.preventDefault();
        const values = Object.fromEntries(new FormData(form).entries());
        values.returnLeg = form.querySelector('[name="returnLeg"]').checked;
        values.standbyPlanned = form.querySelector('[name="standbyPlanned"]').checked;
        values.airportMeetGreet = form.querySelector('[name="airportMeetGreet"]').checked;
        const booking = saveBookingMeta(values);
        if(!booking) return toast('Select a booking first.', 'warn');
        writeUI({ bookingId: booking.id });
        toast('Advanced booking meta saved.', 'good');
        inject();
      };
      const sel = form.querySelector('[name="bookingId"]');
      if(sel){ sel.onchange = ()=>{ writeUI({ bookingId: sel.value }); setTimeout(inject, 0); }; }
    }
  }

  const observer = new MutationObserver(()=> inject());
  observer.observe(document.body, { childList:true, subtree:true });
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(inject, 0); return out; };

  window.readWhiteGloveConflictSnapshotsV46 = readConflictSnapshots;
  window.readWhiteGloveConflictOutboxV46 = readConflictOutbox;
  window.saveWhiteGloveConflictSnapshotV46 = saveConflictSnapshot;
  window.saveWhiteGloveBookingMetaV46 = saveBookingMeta;
  window.exportWhiteGloveAirportDocV46 = exportAirportDoc;
  window.exportWhiteGloveCancellationDocV46 = exportCancellationDoc;
})();
