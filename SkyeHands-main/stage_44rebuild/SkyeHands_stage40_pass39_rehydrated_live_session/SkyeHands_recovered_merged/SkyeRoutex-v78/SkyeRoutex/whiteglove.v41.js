/* V41 Routex white-glove chauffeur execution + payout lane */
(function(){
  if(window.__ROUTEX_WHITEGLOVE_V41__) return;
  window.__ROUTEX_WHITEGLOVE_V41__ = true;

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
    execution: 'skye_whiteglove_execution_rows_v41',
    payoutLedger: 'skye_whiteglove_payout_ledger_v41',
    serviceBoard: 'skye_whiteglove_service_boards_v41',
    ui: 'skye_whiteglove_execution_ui_v41',
    recovery: 'skye_whiteglove_service_recovery_v41'
  };
  const WAIT_KINDS = ['wait','standby'];
  const ASSIST_TYPES = ['door_assist','luggage_assist','grocery_assist','elder_assist','child_seat','meet_greet','return_leg','executive_handoff'];
  const PAYMENT_METHODS = ['card','cash','invoice','member_draw','external'];
  const PAYOUT_MODELS = ['hourly','per_service','hybrid','guaranteed_minimum','bonus'];

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
    setTimeout(()=> URL.revokeObjectURL(url), 1500);
  };

  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){ } return value; }

  const readProfiles = ()=> (window.readWhiteGloveServiceProfiles ? window.readWhiteGloveServiceProfiles() : readJSON(SHARED.profiles, []));
  const readDrivers = ()=> (window.readWhiteGloveDriverProfiles ? window.readWhiteGloveDriverProfiles() : readJSON(SHARED.drivers, []));
  const readVehicles = ()=> (window.readWhiteGloveVehicleProfiles ? window.readWhiteGloveVehicleProfiles() : readJSON(SHARED.vehicles, []));
  const readMemberships = ()=> (window.readWhiteGloveMemberships ? window.readWhiteGloveMemberships() : readJSON(SHARED.memberships, []));
  const readBookings = ()=> (window.readWhiteGloveBookings ? window.readWhiteGloveBookings() : readJSON(SHARED.bookings, []));
  const readDocs = ()=> (window.readWhiteGloveDocs ? window.readWhiteGloveDocs() : readJSON(SHARED.docs, []));
  const readExecution = ()=> readJSON(KEYS.execution, []);
  const readPayoutLedger = ()=> readJSON(KEYS.payoutLedger, []);
  const readBoards = ()=> readJSON(KEYS.serviceBoard, []);
  const readRecovery = ()=> readJSON(KEYS.recovery, []);
  const readUI = ()=> readJSON(KEYS.ui, { tab:'live', selectedBookingId:'' });
  const writeExecution = (rows)=> writeJSON(KEYS.execution, rows);
  const writePayoutLedger = (rows)=> writeJSON(KEYS.payoutLedger, rows);
  const writeBoards = (rows)=> writeJSON(KEYS.serviceBoard, rows);
  const writeRecovery = (rows)=> writeJSON(KEYS.recovery, rows);
  const writeUI = (patch)=> writeJSON(KEYS.ui, Object.assign({}, readUI(), patch || {}));
  const writeSharedBookings = (rows)=> writeJSON(SHARED.bookings, rows);
  const writeSharedMemberships = (rows)=> writeJSON(SHARED.memberships, rows);
  const writeSharedDrivers = (rows)=> writeJSON(SHARED.drivers, rows);
  const writeSharedDocs = (rows)=> writeJSON(SHARED.docs, rows);
  const writeSharedEvents = (rows)=> writeJSON(SHARED.events, rows);
  const writeSharedOutbox = (rows)=> writeJSON(SHARED.outbox, rows);

  function getProfile(id){ return readProfiles().find(row => row.id === id) || null; }
  function getDriver(id){ return readDrivers().find(row => row.id === id) || null; }
  function getVehicle(id){ return readVehicles().find(row => row.id === id) || null; }
  function getMembership(id){ return readMemberships().find(row => row.id === id) || null; }
  function getBooking(id){ return readBookings().find(row => row.id === id) || null; }

  function updateBooking(id, mutator){
    const rows = readBookings();
    const idx = rows.findIndex(row => row.id === id);
    if(idx === -1) return null;
    const next = mutator(Object.assign({}, rows[idx]));
    next.updatedAt = nowISO();
    rows[idx] = next;
    writeSharedBookings(rows);
    return next;
  }

  function updateDriver(id, mutator){
    const rows = readDrivers();
    const idx = rows.findIndex(row => row.id === id);
    if(idx === -1) return null;
    const next = mutator(Object.assign({}, rows[idx]));
    next.updatedAt = nowISO();
    rows[idx] = next;
    writeSharedDrivers(rows);
    return next;
  }

  function writeEvent(type, refs, note, extra){
    const rows = readJSON(SHARED.events, []);
    rows.unshift(Object.assign({ id: uid('wg_evt'), type: clean(type), refs: refs || {}, note: clean(note), createdAt: nowISO() }, extra || {}));
    writeSharedEvents(rows.slice(0, 1000));
  }

  function queueOutbox(kind, payload){
    const rows = readJSON(SHARED.outbox, []);
    rows.unshift({ id: uid('wg_sync'), kind: clean(kind), status:'queued', payload: payload || {}, createdAt: nowISO(), updatedAt: nowISO(), retryCount:0, note:'' });
    writeSharedOutbox(rows.slice(0, 800));
  }

  function getExecutionRow(bookingId){ return readExecution().find(row => row.bookingId === bookingId) || null; }
  function upsertExecution(bookingId, mutator){
    const rows = readExecution();
    const idx = rows.findIndex(row => row.bookingId === bookingId);
    const base = idx === -1 ? {
      id: uid('wg_exec'),
      bookingId,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      currentStage: 'requested',
      waitSessions: [],
      assistanceEvents: [],
      serviceRecoveryNotes: [],
      returnLegs: [],
      handoffNotes: [],
      alerts: []
    } : Object.assign({}, rows[idx]);
    const next = mutator ? mutator(base) : base;
    next.updatedAt = nowISO();
    if(idx === -1) rows.unshift(next); else rows[idx] = next;
    writeExecution(rows.slice(0, 800));
    return next;
  }

  function durationMinutes(startIso, endIso){
    const a = Date.parse(startIso || nowISO());
    const b = Date.parse(endIso || nowISO());
    return Math.max(0, Math.round((b - a) / 60000));
  }

  function totalWaitMinutes(row){
    return (row.waitSessions || []).reduce((sum, session) => sum + Number(session.durationMinutes || 0), 0);
  }

  function activeWaitSession(row){
    return (row.waitSessions || []).find(session => !session.endedAt) || null;
  }

  function startWaitSession(bookingId, kind){
    kind = WAIT_KINDS.includes(kind) ? kind : 'wait';
    const row = upsertExecution(bookingId, base => {
      if(activeWaitSession(base)) return base;
      base.waitSessions = Array.isArray(base.waitSessions) ? base.waitSessions : [];
      base.waitSessions.unshift({ id: uid('wg_wait'), kind, startedAt: nowISO(), endedAt:'', durationMinutes:0 });
      base.alerts = (base.alerts || []).filter(Boolean);
      return base;
    });
    updateBooking(bookingId, booking => {
      booking.serviceExecution = Object.assign({}, booking.serviceExecution || {}, { activeWaitKind: kind, activeWaitStartedAt: nowISO() });
      booking.timeline = Array.isArray(booking.timeline) ? booking.timeline : [];
      booking.timeline.push({ status: booking.dispatchStatus, at: nowISO(), note: kind + ' timer started' });
      return booking;
    });
    writeEvent('whiteglove_wait_started', { bookingId }, kind + ' timer started');
    return row;
  }

  function stopWaitSession(bookingId){
    const stoppedAt = nowISO();
    const row = upsertExecution(bookingId, base => {
      const active = activeWaitSession(base);
      if(active){
        active.endedAt = stoppedAt;
        active.durationMinutes = durationMinutes(active.startedAt, active.endedAt);
      }
      return base;
    });
    updateBooking(bookingId, booking => {
      booking.serviceExecution = Object.assign({}, booking.serviceExecution || {}, { activeWaitKind:'', activeWaitStartedAt:'' });
      booking.timeline = Array.isArray(booking.timeline) ? booking.timeline : [];
      booking.timeline.push({ status: booking.dispatchStatus, at: stoppedAt, note: 'wait timer stopped', totalWaitMinutes: totalWaitMinutes(row) });
      return booking;
    });
    writeEvent('whiteglove_wait_stopped', { bookingId }, 'Wait/standby timer stopped', { totalWaitMinutes: totalWaitMinutes(row) });
    return row;
  }

  function addAssistEvent(bookingId, type, note){
    if(!ASSIST_TYPES.includes(type)) type = 'door_assist';
    const row = upsertExecution(bookingId, base => {
      base.assistanceEvents = Array.isArray(base.assistanceEvents) ? base.assistanceEvents : [];
      base.assistanceEvents.unshift({ id: uid('wg_asst'), type, note: clean(note), at: nowISO() });
      return base;
    });
    updateBooking(bookingId, booking => {
      booking.assistanceEvents = (row.assistanceEvents || []).map(item => item.type);
      booking.timeline = Array.isArray(booking.timeline) ? booking.timeline : [];
      booking.timeline.push({ status: booking.dispatchStatus, at: nowISO(), note: 'Assistance event: ' + type });
      return booking;
    });
    writeEvent('whiteglove_assistance_event', { bookingId }, 'Assistance event captured', { type, note: clean(note) });
    return row;
  }

  function addServiceRecovery(bookingId, severity, note){
    const cleanSeverity = clean(severity) || 'service_recovery';
    const item = { id: uid('wg_rec'), bookingId, severity: cleanSeverity, note: clean(note), createdAt: nowISO() };
    const rows = readRecovery();
    rows.unshift(item);
    writeRecovery(rows.slice(0, 300));
    upsertExecution(bookingId, base => {
      base.serviceRecoveryNotes = Array.isArray(base.serviceRecoveryNotes) ? base.serviceRecoveryNotes : [];
      base.serviceRecoveryNotes.unshift(item);
      base.alerts = Array.isArray(base.alerts) ? base.alerts : [];
      base.alerts.unshift(cleanSeverity + ': ' + clean(note || 'Service recovery logged'));
      return base;
    });
    updateBooking(bookingId, booking => {
      booking.serviceRecoveryState = cleanSeverity;
      booking.timeline = Array.isArray(booking.timeline) ? booking.timeline : [];
      booking.timeline.push({ status: booking.dispatchStatus, at: nowISO(), note: 'Service recovery: ' + cleanSeverity });
      return booking;
    });
    writeEvent('whiteglove_service_recovery', { bookingId }, 'Service recovery note captured', item);
    return item;
  }

  function addReturnLeg(bookingId, address, note){
    const row = upsertExecution(bookingId, base => {
      base.returnLegs = Array.isArray(base.returnLegs) ? base.returnLegs : [];
      base.returnLegs.unshift({ id: uid('wg_leg'), address: clean(address), note: clean(note), createdAt: nowISO() });
      return base;
    });
    updateBooking(bookingId, booking => {
      booking.returnLegSupported = true;
      booking.timeline = Array.isArray(booking.timeline) ? booking.timeline : [];
      booking.timeline.push({ status: booking.dispatchStatus, at: nowISO(), note: 'Return leg added' });
      return booking;
    });
    writeEvent('whiteglove_return_leg', { bookingId }, 'Return leg added', { address: clean(address) });
    return row;
  }

  function addHandoffNote(bookingId, person, note){
    const row = upsertExecution(bookingId, base => {
      base.handoffNotes = Array.isArray(base.handoffNotes) ? base.handoffNotes : [];
      base.handoffNotes.unshift({ id: uid('wg_hand'), person: clean(person), note: clean(note), createdAt: nowISO() });
      return base;
    });
    writeEvent('whiteglove_handoff_note', { bookingId }, 'Handoff note captured', { person: clean(person) });
    return row;
  }

  function setBookingStage(bookingId, status){
    const booking = updateBooking(bookingId, row => {
      row.dispatchStatus = clean(status) || row.dispatchStatus;
      row.timeline = Array.isArray(row.timeline) ? row.timeline : [];
      row.timeline.push({ status: row.dispatchStatus, at: nowISO(), note: 'Execution stage -> ' + row.dispatchStatus });
      if(row.dispatchStatus === 'arrived') row.arrivalTimestamp = row.arrivalTimestamp || nowISO();
      if(row.dispatchStatus === 'rider_boarded') row.boardedTimestamp = row.boardedTimestamp || nowISO();
      if(row.dispatchStatus === 'in_service') row.inServiceAt = row.inServiceAt || nowISO();
      return row;
    });
    upsertExecution(bookingId, base => { base.currentStage = booking ? booking.dispatchStatus : clean(status); return base; });
    writeEvent('whiteglove_stage_set', { bookingId }, 'Execution stage updated', { status: clean(status) });
    return booking;
  }

  function computePayout(booking, driver, payload){
    const recognized = Number((booking.finalEconomics && booking.finalEconomics.recognizedRevenue) || (booking.pricingSnapshot && booking.pricingSnapshot.quotedTotal) || 0);
    const hours = Number(booking.actualUsageHours || (booking.pricingSnapshot && booking.pricingSnapshot.bookedHours) || 0);
    const miles = Number(booking.actualUsageMiles || (booking.pricingSnapshot && booking.pricingSnapshot.requestedMiles) || 0);
    const model = clean(payload.payoutModel || (driver && driver.payoutModel) || (booking.payout && booking.payout.model) || 'per_service');
    const hourlyRate = Number(payload.hourlyRate || (driver && driver.hourlyRate) || 24);
    const perServiceRate = Number(payload.perServiceRate || (driver && driver.perServiceRate) || 18);
    const hybridBase = Number(payload.hybridBase || (driver && driver.hybridBase) || 12);
    const hybridHourlyRate = Number(payload.hybridHourlyRate || (driver && driver.hybridHourlyRate) || 16);
    const guaranteedMinimum = Number(payload.guaranteedMinimum || (driver && driver.guaranteedMinimum) || 32);
    const bonusAmount = Number(payload.bonusAmount || 0);
    const tipAmount = Number(payload.tipAmount || 0);
    let amount = 0;
    if(model === 'hourly') amount = hours * hourlyRate;
    else if(model === 'hybrid') amount = hybridBase + (hours * hybridHourlyRate);
    else if(model === 'guaranteed_minimum') amount = Math.max(guaranteedMinimum, hours * hourlyRate);
    else if(model === 'bonus') amount = perServiceRate + bonusAmount;
    else amount = perServiceRate;
    amount += tipAmount;
    return {
      model,
      hourlyRate: Number(hourlyRate.toFixed(2)),
      perServiceRate: Number(perServiceRate.toFixed(2)),
      hybridBase: Number(hybridBase.toFixed(2)),
      hybridHourlyRate: Number(hybridHourlyRate.toFixed(2)),
      guaranteedMinimum: Number(guaranteedMinimum.toFixed(2)),
      bonusAmount: Number(bonusAmount.toFixed(2)),
      tipAmount: Number(tipAmount.toFixed(2)),
      recognizedRevenue: Number(recognized.toFixed(2)),
      hours: Number(hours.toFixed(2)),
      miles: Number(miles.toFixed(2)),
      amount: Number(amount.toFixed(2))
    };
  }

  function updateMembershipFromCloseout(booking){
    if(!(booking.membershipId && booking.billingMode === 'included_block')) return null;
    const rows = readMemberships();
    const idx = rows.findIndex(row => row.id === booking.membershipId);
    if(idx === -1) return null;
    const item = Object.assign({}, rows[idx]);
    item.remainingHours = Number(Math.max(0, Number(item.remainingHours || 0) - Number(booking.actualUsageHours || 0)).toFixed(2));
    item.remainingMiles = Number(Math.max(0, Number(item.remainingMiles || 0) - Number(booking.actualUsageMiles || 0)).toFixed(2));
    item.usageLedger = Array.isArray(item.usageLedger) ? item.usageLedger : [];
    item.usageLedger.unshift({
      id: uid('mem_use'),
      bookingId: booking.id,
      usedHours: Number(booking.actualUsageHours || 0),
      usedMiles: Number(booking.actualUsageMiles || 0),
      remainingHours: item.remainingHours,
      remainingMiles: item.remainingMiles,
      createdAt: nowISO()
    });
    item.updatedAt = nowISO();
    rows[idx] = item;
    writeSharedMemberships(rows);
    writeEvent('membership_usage_written_v41', { membershipId: item.id, bookingId: booking.id }, 'Membership decremented from v41 closeout', { remainingHours: item.remainingHours, remainingMiles: item.remainingMiles });
    return item;
  }

  function upsertDoc(type, title, html, meta){
    const rows = readDocs();
    const row = { id: uid('wg_doc'), type: clean(type), title: clean(title), html: html || '', meta: meta || {}, createdAt: nowISO() };
    rows.unshift(row);
    writeSharedDocs(rows.slice(0, 500));
    return row;
  }

  function buildReceiptHtml(booking, execution, payoutRow){
    const profile = getProfile(booking.serviceProfileId);
    const driver = getDriver(booking.assignedDriverId);
    const vehicle = getVehicle(booking.assignedVehicleId);
    const waitMins = execution ? totalWaitMinutes(execution) : 0;
    return '<!doctype html><html><head><meta charset="utf-8"><title>White-glove trip receipt</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}table{border-collapse:collapse;width:100%;margin-top:12px}td,th{border:1px solid #ccc;padding:8px;text-align:left}.badge{display:inline-block;padding:4px 8px;border:1px solid #999;border-radius:999px;margin-right:8px}</style></head><body><h1>Skye Routex • White-glove trip receipt</h1><div><span class="badge">'+esc(booking.id)+'</span><span class="badge">'+esc(booking.dispatchStatus)+'</span><span class="badge">'+esc(booking.billingMode || 'retail')+'</span></div><p><strong>Client:</strong> '+esc((profile && profile.displayName) || booking.serviceProfileName || '—')+'<br><strong>Driver:</strong> '+esc((driver && driver.displayName) || 'Unassigned')+'<br><strong>Vehicle:</strong> '+esc((vehicle && vehicle.displayName) || 'Unassigned')+'</p><table><tbody><tr><th>Quoted total</th><td>'+money((booking.pricingSnapshot && booking.pricingSnapshot.quotedTotal) || 0)+'</td></tr><tr><th>Recognized revenue</th><td>'+money((booking.finalEconomics && booking.finalEconomics.recognizedRevenue) || 0)+'</td></tr><tr><th>Wait minutes</th><td>'+esc(String(waitMins))+'</td></tr><tr><th>Wait revenue</th><td>'+money((booking.finalEconomics && booking.finalEconomics.waitCharge) || 0)+'</td></tr><tr><th>Overage revenue</th><td>'+money((booking.finalEconomics && booking.finalEconomics.overageRevenue) || 0)+'</td></tr><tr><th>Tip / gratuity</th><td>'+money((booking.billingSummary && booking.billingSummary.tipAmount) || 0)+'</td></tr><tr><th>Credit / refund</th><td>'+money(((booking.billingSummary && booking.billingSummary.creditAmount) || 0) + ((booking.billingSummary && booking.billingSummary.refundAmount) || 0))+'</td></tr><tr><th>Payment method</th><td>'+esc((booking.billingSummary && booking.billingSummary.paymentMethod) || '—')+'</td></tr><tr><th>Driver payout</th><td>'+money((payoutRow && payoutRow.amount) || (booking.payout && booking.payout.amount) || 0)+'</td></tr></tbody></table><h2>Service notes</h2><p>'+esc(booking.whiteGloveNotes || 'No additional service note.')+'</p><h2>Assistance</h2><p>'+esc(((execution && execution.assistanceEvents || []).map(item => item.type).join(', ')) || 'None recorded')+'</p></body></html>';
  }

  function buildServiceSummaryHtml(booking, execution){
    const driver = getDriver(booking.assignedDriverId);
    const waitMins = execution ? totalWaitMinutes(execution) : 0;
    const recovery = (execution && execution.serviceRecoveryNotes || []).map(item => '<li>'+esc(item.severity)+' • '+esc(item.note)+'</li>').join('') || '<li>No service recovery items.</li>';
    const assists = (execution && execution.assistanceEvents || []).map(item => '<li>'+esc(item.type)+' • '+esc(item.note || '')+' • '+esc(item.at)+'</li>').join('') || '<li>No assistance events.</li>';
    return '<!doctype html><html><head><meta charset="utf-8"><title>Premium service summary</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}ul,ol{line-height:1.6}</style></head><body><h1>Premium Service Summary</h1><ul><li><strong>Booking:</strong> '+esc(booking.id)+'</li><li><strong>Status:</strong> '+esc(booking.dispatchStatus)+'</li><li><strong>Driver:</strong> '+esc((driver && driver.displayName) || 'Unassigned')+'</li><li><strong>Favorite-driver state:</strong> '+esc(booking.favoriteDriverState || 'none')+'</li><li><strong>Actual usage:</strong> '+esc(String(booking.actualUsageHours || 0))+' hours / '+esc(String(booking.actualUsageMiles || 0))+' miles</li><li><strong>Wait / standby:</strong> '+esc(String(waitMins))+' minutes</li><li><strong>Service rating:</strong> '+esc(String(booking.serviceRating || 0))+'</li></ul><h2>Assistance log</h2><ul>'+assists+'</ul><h2>Service recovery</h2><ul>'+recovery+'</ul><h2>Status timeline</h2><ol>'+((booking.timeline || []).map(item => '<li>'+esc(item.status)+' • '+esc(item.at)+' • '+esc(item.note || '')+'</li>').join(''))+'</ol></body></html>';
  }

  function buildPayoutHtml(row){
    return '<!doctype html><html><head><meta charset="utf-8"><title>Driver payout event</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}table{border-collapse:collapse;width:100%;margin-top:12px}td,th{border:1px solid #ccc;padding:8px;text-align:left}</style></head><body><h1>Driver payout event</h1><table><tbody><tr><th>Booking</th><td>'+esc(row.bookingId)+'</td></tr><tr><th>Driver</th><td>'+esc(row.driverName)+'</td></tr><tr><th>Model</th><td>'+esc(row.model)+'</td></tr><tr><th>Hours</th><td>'+esc(String(row.hours))+'</td></tr><tr><th>Miles</th><td>'+esc(String(row.miles))+'</td></tr><tr><th>Recognized revenue</th><td>'+money(row.recognizedRevenue)+'</td></tr><tr><th>Payout amount</th><td>'+money(row.amount)+'</td></tr></tbody></table></body></html>';
  }

  function buildIssueHtml(title, bodyHtml){
    return '<!doctype html><html><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}</style></head><body><h1>'+esc(title)+'</h1>'+bodyHtml+'</body></html>';
  }

  function appendPayoutLedger(entry){
    const rows = readPayoutLedger();
    rows.unshift(entry);
    writePayoutLedger(rows.slice(0, 500));
    queueOutbox('whiteglove_payout_event', { payoutId: entry.id, bookingId: entry.bookingId, driverId: entry.driverId, amount: entry.amount });
    return entry;
  }

  function finalizeExecutionCloseout(bookingId, payload){
    const stopped = stopWaitSession(bookingId);
    const execution = getExecutionRow(bookingId) || stopped || upsertExecution(bookingId, base => base);
    let booking = updateBooking(bookingId, row => {
      row.dispatchStatus = clean(payload.finalStatus) || 'completed';
      row.completedAt = nowISO();
      row.actualUsageHours = Number(payload.actualUsageHours || row.actualUsageHours || (row.pricingSnapshot && row.pricingSnapshot.bookedHours) || 0);
      row.actualUsageMiles = Number(payload.actualUsageMiles || row.actualUsageMiles || (row.pricingSnapshot && row.pricingSnapshot.requestedMiles) || 0);
      row.serviceRating = Number(payload.serviceRating || row.serviceRating || 0);
      row.assistanceEvents = ((execution.assistanceEvents || []).map(item => item.type)).filter(Boolean);
      const waitHours = totalWaitMinutes(execution) / 60;
      const overtimeMiles = Math.max(0, Number(row.actualUsageMiles || 0) - Number((row.pricingSnapshot && row.pricingSnapshot.includedMiles) || 0));
      const waitCharge = waitHours * Number((row.pricingSnapshot && row.pricingSnapshot.waitPerHour) || 0);
      const overageRevenue = overtimeMiles * Number((row.pricingSnapshot && row.pricingSnapshot.extraMileRate) || 0);
      const tipAmount = Number(payload.tipAmount || 0);
      const creditAmount = Number(payload.creditAmount || 0);
      const refundAmount = Number(payload.refundAmount || 0);
      const recognizedRevenue = Number((((row.pricingSnapshot && row.pricingSnapshot.quotedTotal) || 0) + waitCharge + overageRevenue + tipAmount - creditAmount - refundAmount).toFixed(2));
      row.finalEconomics = {
        recognizedRevenue,
        overtimeMiles: Number(overtimeMiles.toFixed(2)),
        waitCharge: Number(waitCharge.toFixed(2)),
        overageRevenue: Number(overageRevenue.toFixed(2)),
        waitMinutes: totalWaitMinutes(execution)
      };
      row.billingSummary = {
        paymentMethod: PAYMENT_METHODS.includes(clean(payload.paymentMethod)) ? clean(payload.paymentMethod) : 'card',
        tipAmount: Number(tipAmount.toFixed(2)),
        creditAmount: Number(creditAmount.toFixed(2)),
        refundAmount: Number(refundAmount.toFixed(2)),
        disputeNote: clean(payload.disputeNote),
        adjustmentNote: clean(payload.adjustmentNote),
        externalPaymentNote: clean(payload.externalPaymentNote)
      };
      row.whiteGloveNotes = [clean(row.whiteGloveNotes), clean(payload.closeoutNote)].filter(Boolean).join(' | ');
      row.timeline = Array.isArray(row.timeline) ? row.timeline : [];
      row.timeline.push({ status: row.dispatchStatus, at: nowISO(), note: 'V41 chauffeur closeout completed', waitMinutes: totalWaitMinutes(execution), tipAmount: row.billingSummary.tipAmount, creditAmount: row.billingSummary.creditAmount, refundAmount: row.billingSummary.refundAmount });
      return row;
    });
    if(!booking) return null;
    const driver = getDriver(booking.assignedDriverId);
    const payout = computePayout(booking, driver, payload);
    booking = updateBooking(bookingId, row => { row.payout = Object.assign({}, payout, { note: clean(payload.payoutNote) }); return row; }) || booking;
    const payoutEntry = appendPayoutLedger({
      id: uid('wg_pay'),
      bookingId: booking.id,
      driverId: driver ? driver.id : '',
      driverName: driver ? driver.displayName : 'Unassigned',
      model: payout.model,
      hours: payout.hours,
      miles: payout.miles,
      recognizedRevenue: payout.recognizedRevenue,
      amount: payout.amount,
      createdAt: nowISO()
    });
    updateMembershipFromCloseout(booking);
    if(driver){
      updateDriver(driver.id, row => {
        const currentQuality = Number(row.qualityScore || 5);
        row.qualityScore = Number((((currentQuality * 4) + Number(booking.serviceRating || currentQuality)) / 5).toFixed(2));
        if(booking.serviceRecoveryState) row.incidentCount = Number(row.incidentCount || 0) + 1;
        return row;
      });
    }
    const receipt = upsertDoc('trip_receipt_html_v41', 'whiteglove_receipt_' + booking.id, buildReceiptHtml(booking, execution, payoutEntry), { bookingId: booking.id, type:'receipt' });
    const serviceSummary = upsertDoc('premium_service_summary_html_v41', 'whiteglove_service_summary_' + booking.id, buildServiceSummaryHtml(booking, execution), { bookingId: booking.id, type:'service_summary' });
    const payoutDoc = upsertDoc('driver_payout_html_v41', 'whiteglove_payout_' + booking.id, buildPayoutHtml(payoutEntry), { bookingId: booking.id, driverId: payoutEntry.driverId, type:'payout' });
    if(clean(payload.disputeNote)) upsertDoc('trip_dispute_review_html_v41', 'whiteglove_dispute_' + booking.id, buildIssueHtml('Trip dispute review', '<p>'+esc(payload.disputeNote)+'</p>'), { bookingId: booking.id, type:'dispute' });
    if(clean(payload.adjustmentNote) || clean(payload.refundAmount)) upsertDoc('service_recovery_note_html_v41', 'whiteglove_service_recovery_' + booking.id, buildIssueHtml('Service recovery note', '<p>'+esc(clean(payload.adjustmentNote) || 'Refund/credit adjustment applied')+'</p>'), { bookingId: booking.id, type:'service_recovery' });
    if(['cancelled','no_show'].includes(booking.dispatchStatus)) upsertDoc('cancellation_no_show_proof_html_v41', 'whiteglove_cancellation_proof_' + booking.id, buildIssueHtml('Cancellation / no-show proof', '<p>Status: '+esc(booking.dispatchStatus)+'</p><p>'+esc(clean(payload.closeoutNote) || 'No additional note')+'</p>'), { bookingId: booking.id, type:'cancellation_proof' });
    booking = updateBooking(bookingId, row => {
      row.receiptId = receipt.id;
      row.serviceSummaryDocId = serviceSummary.id;
      row.payoutDocId = payoutDoc.id;
      return row;
    }) || booking;
    writeEvent('whiteglove_chauffeur_closeout_v41', { bookingId: booking.id, payoutId: payoutEntry.id }, 'Chauffeur execution closeout completed', { recognizedRevenue: booking.finalEconomics.recognizedRevenue, payoutAmount: payoutEntry.amount });
    queueOutbox('whiteglove_closeout_bundle_v41', { bookingId: booking.id, receiptId: receipt.id, serviceSummaryDocId: serviceSummary.id, payoutDocId: payoutDoc.id });
    return booking;
  }

  function saveBoard(){
    const bookings = readBookings();
    const executionRows = readExecution();
    const active = bookings.filter(row => ['assigned','en_route','arrived','rider_boarded','in_service','confirmed'].includes(row.dispatchStatus));
    const waitActive = executionRows.filter(row => activeWaitSession(row));
    const recoveries = readRecovery().slice(0, 20);
    const payoutRows = readPayoutLedger();
    const row = {
      id: uid('wg_board'),
      createdAt: nowISO(),
      activeBookings: active.length,
      waitActive: waitActive.length,
      recoveryOpen: recoveries.length,
      payoutToday: payoutRows.filter(item => String(item.createdAt || '').slice(0,10) === dayISO()).reduce((sum, item) => sum + Number(item.amount || 0), 0),
      summary: active.map(item => ({ id:item.id, status:item.dispatchStatus, client:item.serviceProfileName || getProfile(item.serviceProfileId)?.displayName || '—', driver:getDriver(item.assignedDriverId)?.displayName || 'Unassigned', waitMinutes: totalWaitMinutes(getExecutionRow(item.id) || { waitSessions:[] }), favorite:item.favoriteDriverState || '' })),
      fingerprint: uid('svcbd').slice(0, 18)
    };
    const rows = readBoards();
    rows.unshift(row);
    writeBoards(rows.slice(0, 120));
    queueOutbox('whiteglove_service_board_v41', { boardId: row.id, fingerprint: row.fingerprint });
    return row;
  }

  function buildServiceBoardHtml(row){
    const rows = (row.summary || []).map(item => '<tr><td>'+esc(item.id)+'</td><td>'+esc(item.client)+'</td><td>'+esc(item.status)+'</td><td>'+esc(item.driver)+'</td><td>'+esc(String(item.waitMinutes))+'</td><td>'+esc(item.favorite || '—')+'</td></tr>').join('') || '<tr><td colspan="6">No active chauffeur bookings.</td></tr>';
    return '<!doctype html><html><head><meta charset="utf-8"><title>White-glove service board</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}.badge{display:inline-block;padding:4px 8px;border:1px solid #999;border-radius:999px;margin-right:8px}</style></head><body><h1>White-glove service board</h1><div><span class="badge">'+esc(row.fingerprint || '—')+'</span><span class="badge">Active '+esc(String(row.activeBookings || 0))+'</span><span class="badge">Wait timers '+esc(String(row.waitActive || 0))+'</span><span class="badge">Recovery '+esc(String(row.recoveryOpen || 0))+'</span><span class="badge">Payout today '+money(row.payoutToday || 0)+'</span></div><table><thead><tr><th>Booking</th><th>Client</th><th>Status</th><th>Driver</th><th>Wait minutes</th><th>Favorite state</th></tr></thead><tbody>'+rows+'</tbody></table></body></html>';
  }

  function exportPayoutLedgerHtml(){
    const rows = readPayoutLedger();
    const body = rows.map(item => '<tr><td>'+esc(item.createdAt)+'</td><td>'+esc(item.bookingId)+'</td><td>'+esc(item.driverName)+'</td><td>'+esc(item.model)+'</td><td>'+money(item.recognizedRevenue)+'</td><td>'+money(item.amount)+'</td></tr>').join('') || '<tr><td colspan="6">No payout events.</td></tr>';
    const html = '<!doctype html><html><head><meta charset="utf-8"><title>White-glove payout ledger</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}</style></head><body><h1>White-glove payout ledger</h1><table><thead><tr><th>Created</th><th>Booking</th><th>Driver</th><th>Model</th><th>Revenue</th><th>Payout</th></tr></thead><tbody>'+body+'</tbody></table></body></html>';
    downloadText(html, 'whiteglove_payout_ledger_' + dayISO() + '.html', 'text/html');
  }
  function exportPayoutLedgerJson(){ downloadText(JSON.stringify(readPayoutLedger(), null, 2), 'whiteglove_payout_ledger_' + dayISO() + '.json', 'application/json'); }
  function exportServiceBoardHtml(){ const row = readBoards()[0] || saveBoard(); downloadText(buildServiceBoardHtml(row), 'whiteglove_service_board_' + dayISO() + '.html', 'text/html'); }
  function exportServiceBoardJson(){ const row = readBoards()[0] || saveBoard(); downloadText(JSON.stringify(row, null, 2), 'whiteglove_service_board_' + dayISO() + '.json', 'application/json'); }

  function input(label, name, value, type){ return '<label style="display:grid;gap:6px;font-size:.9rem"><span>'+esc(label)+'</span><input type="'+esc(type || 'text')+'" name="'+esc(name)+'" value="'+esc(value || '')+'" style="border:1px solid rgba(255,255,255,.12);background:#020617;color:#fff;border-radius:10px;padding:10px"></label>'; }
  function textarea(label, name, value){ return '<label style="display:grid;gap:6px;font-size:.9rem"><span>'+esc(label)+'</span><textarea name="'+esc(name)+'" rows="3" style="border:1px solid rgba(255,255,255,.12);background:#020617;color:#fff;border-radius:10px;padding:10px">'+esc(value || '')+'</textarea></label>'; }
  function select(label, name, options, current){ return '<label style="display:grid;gap:6px;font-size:.9rem"><span>'+esc(label)+'</span><select name="'+esc(name)+'" style="border:1px solid rgba(255,255,255,.12);background:#020617;color:#fff;border-radius:10px;padding:10px">'+options.map(v => '<option value="'+esc(v)+'"'+(String(current || '') === String(v) ? ' selected' : '')+'>'+esc(v)+'</option>').join('')+'</select></label>'; }

  function openModal(title, html, onReady){
    const existing = document.getElementById('routexWg41Modal');
    if(existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'routexWg41Modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(3,8,20,.78);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto';
    overlay.innerHTML = '<div style="width:min(1240px,96vw);background:#07111f;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:22px;box-shadow:0 30px 80px rgba(0,0,0,.45);overflow:hidden"><div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.08)"><div style="font-size:1.05rem;font-weight:700">'+esc(title)+'</div><button id="routexWg41Close" style="border:0;background:#1e293b;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Close</button></div><div id="routexWg41Body" style="padding:18px">'+html+'</div></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#routexWg41Close').onclick = ()=> overlay.remove();
    overlay.addEventListener('click', (e)=>{ if(e.target === overlay) overlay.remove(); });
    if(typeof onReady === 'function') onReady(overlay.querySelector('#routexWg41Body'));
  }

  function executionTableRows(){
    return readBookings().filter(row => ['assigned','en_route','arrived','rider_boarded','in_service','confirmed'].includes(row.dispatchStatus)).map(row => {
      const exec = getExecutionRow(row.id) || { waitSessions:[], assistanceEvents:[], serviceRecoveryNotes:[] };
      const profile = getProfile(row.serviceProfileId);
      const driver = getDriver(row.assignedDriverId);
      return '<tr><td>'+esc(row.id)+'</td><td>'+esc((profile && profile.displayName) || row.serviceProfileName || '—')+'</td><td>'+esc(row.dispatchStatus)+'</td><td>'+esc((driver && driver.displayName) || 'Unassigned')+'</td><td>'+esc(String(totalWaitMinutes(exec)))+'</td><td>'+esc(String((exec.assistanceEvents || []).length))+'</td><td>'+esc(String((exec.serviceRecoveryNotes || []).length))+'</td><td><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn small wg41-act" data-action="stage" data-status="arrived" data-booking="'+esc(row.id)+'">Arrived</button><button class="btn small wg41-act" data-action="stage" data-status="rider_boarded" data-booking="'+esc(row.id)+'">Boarded</button><button class="btn small wg41-act" data-action="stage" data-status="in_service" data-booking="'+esc(row.id)+'">In service</button><button class="btn small wg41-act" data-action="wait-start" data-booking="'+esc(row.id)+'">Start wait</button><button class="btn small wg41-act" data-action="wait-stop" data-booking="'+esc(row.id)+'">Stop wait</button><button class="btn small wg41-act" data-action="assist" data-booking="'+esc(row.id)+'">Assist</button><button class="btn small wg41-act" data-action="recovery" data-booking="'+esc(row.id)+'">Recovery</button><button class="btn small wg41-act" data-action="closeout" data-booking="'+esc(row.id)+'">Closeout</button></div></td></tr>';
    }).join('') || '<tr><td colspan="8">No active chauffeur bookings.</td></tr>';
  }

  function buildCenterHtml(){
    const board = readBoards()[0] || saveBoard();
    const payouts = readPayoutLedger();
    const ui = readUI();
    return '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><button class="btn small wg41-tab" data-tab="live">Live service</button><button class="btn small wg41-tab" data-tab="payout">Payout ledger</button><button class="btn small wg41-tab" data-tab="reports">Reports</button></div>'+
      (ui.tab === 'payout'
        ? '<div class="card"><h2 style="margin:0 0 10px">Driver payout ledger</h2><table style="width:100%;border-collapse:collapse"><thead><tr><th>Created</th><th>Booking</th><th>Driver</th><th>Model</th><th>Revenue</th><th>Payout</th></tr></thead><tbody>'+(payouts.map(item => '<tr><td>'+esc(item.createdAt)+'</td><td>'+esc(item.bookingId)+'</td><td>'+esc(item.driverName)+'</td><td>'+esc(item.model)+'</td><td>'+money(item.recognizedRevenue)+'</td><td>'+money(item.amount)+'</td></tr>').join('') || '<tr><td colspan="6">No payout events.</td></tr>')+'</tbody></table></div>'
        : ui.tab === 'reports'
          ? '<div class="card"><h2 style="margin:0 0 10px">Service board snapshot</h2><div style="display:flex;gap:8px;flex-wrap:wrap"><span class="badge">'+esc(board.fingerprint || '—')+'</span><span class="badge">Active '+esc(String(board.activeBookings || 0))+'</span><span class="badge">Wait '+esc(String(board.waitActive || 0))+'</span><span class="badge">Recovery '+esc(String(board.recoveryOpen || 0))+'</span><span class="badge">Payout today '+money(board.payoutToday || 0)+'</span></div><table style="width:100%;border-collapse:collapse;margin-top:12px"><thead><tr><th>Booking</th><th>Client</th><th>Status</th><th>Driver</th><th>Wait</th><th>Favorite</th></tr></thead><tbody>'+(board.summary || []).map(item => '<tr><td>'+esc(item.id)+'</td><td>'+esc(item.client)+'</td><td>'+esc(item.status)+'</td><td>'+esc(item.driver)+'</td><td>'+esc(String(item.waitMinutes))+'</td><td>'+esc(item.favorite || '—')+'</td></tr>').join('')+'</tbody></table></div>'
          : '<div class="card"><h2 style="margin:0 0 10px">Live chauffeur execution board</h2><table style="width:100%;border-collapse:collapse"><thead><tr><th>Booking</th><th>Client</th><th>Status</th><th>Driver</th><th>Wait min</th><th>Assists</th><th>Recovery</th><th>Actions</th></tr></thead><tbody>'+executionTableRows()+'</tbody></table></div>'
      )+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button id="wg41ExportBoardHtml" class="btn small">Export board HTML</button><button id="wg41ExportBoardJson" class="btn small">Export board JSON</button><button id="wg41ExportPayoutHtml" class="btn small">Export payout HTML</button><button id="wg41ExportPayoutJson" class="btn small">Export payout JSON</button></div>';
  }

  function openQuickAssist(bookingId){
    openModal('Add white-glove assistance event', '<form id="wg41AssistForm" style="display:grid;gap:10px">'+select('Assistance type','type', ASSIST_TYPES, 'door_assist')+textarea('Note','note','')+'<button style="border:0;background:#7c3aed;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Save assistance</button></form>', body => {
      body.querySelector('#wg41AssistForm').onsubmit = (e)=>{ e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target).entries()); addAssistEvent(bookingId, fd.type, fd.note); toast('Assistance event saved.', 'good'); openCenter('live'); };
    });
  }

  function openQuickRecovery(bookingId){
    openModal('Add service recovery note', '<form id="wg41RecoveryForm" style="display:grid;gap:10px">'+select('Severity','severity',['service_recovery','late_arrival','client_issue','driver_issue'], 'service_recovery')+textarea('Recovery note','note','')+'<button style="border:0;background:#7c3aed;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Save recovery note</button></form>', body => {
      body.querySelector('#wg41RecoveryForm').onsubmit = (e)=>{ e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target).entries()); addServiceRecovery(bookingId, fd.severity, fd.note); toast('Service recovery note saved.', 'warn'); openCenter('live'); };
    });
  }

  function openCloseout(bookingId){
    const booking = getBooking(bookingId);
    const driver = booking ? getDriver(booking.assignedDriverId) : null;
    openModal('Chauffeur closeout ' + bookingId, '<form id="wg41CloseForm" style="display:grid;gap:10px">'+select('Final status','finalStatus',['completed','cancelled','no_show'], booking && booking.dispatchStatus || 'completed')+input('Actual usage hours','actualUsageHours', booking && (booking.actualUsageHours || (booking.pricingSnapshot && booking.pricingSnapshot.bookedHours) || 0),'number')+input('Actual usage miles','actualUsageMiles', booking && (booking.actualUsageMiles || (booking.pricingSnapshot && booking.pricingSnapshot.requestedMiles) || 0),'number')+input('Service rating','serviceRating', booking && (booking.serviceRating || 5) || 5, 'number')+select('Payment method','paymentMethod', PAYMENT_METHODS, booking && booking.billingSummary && booking.billingSummary.paymentMethod || 'card')+input('Tip / gratuity','tipAmount','0','number')+input('Credit amount','creditAmount','0','number')+input('Refund amount','refundAmount','0','number')+select('Payout model','payoutModel', PAYOUT_MODELS, driver && driver.payoutModel || 'per_service')+input('Hourly rate','hourlyRate', driver && driver.hourlyRate || '24', 'number')+input('Per-service rate','perServiceRate', driver && driver.perServiceRate || '18', 'number')+input('Hybrid base','hybridBase', driver && driver.hybridBase || '12', 'number')+input('Hybrid hourly rate','hybridHourlyRate', driver && driver.hybridHourlyRate || '16', 'number')+input('Guaranteed minimum','guaranteedMinimum', driver && driver.guaranteedMinimum || '32', 'number')+input('Bonus amount','bonusAmount','0','number')+textarea('Adjustment note','adjustmentNote','')+textarea('Dispute note','disputeNote','')+textarea('External payment note','externalPaymentNote','')+textarea('Payout note','payoutNote','')+textarea('Closeout note','closeoutNote','')+'<button style="border:0;background:#7c3aed;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Complete chauffeur closeout</button></form>', body => {
      body.querySelector('#wg41CloseForm').onsubmit = (e)=>{ e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target).entries()); const row = finalizeExecutionCloseout(bookingId, fd); toast(row ? 'Chauffeur closeout saved.' : 'Closeout failed.', row ? 'good' : 'warn'); openCenter('reports'); };
    });
  }

  function openCenter(tab){ if(tab) writeUI({ tab }); openModal('White-glove chauffeur execution center', buildCenterHtml(), bindCenter); }
  function bindCenter(body){
    body.addEventListener('click', (e)=>{
      const tab = e.target.closest('.wg41-tab');
      if(tab){ writeUI({ tab: tab.dataset.tab }); openCenter(); return; }
      const action = e.target.closest('.wg41-act');
      if(action){
        const bookingId = action.dataset.booking;
        if(action.dataset.action === 'stage'){ setBookingStage(bookingId, action.dataset.status); toast('Stage updated.', 'good'); openCenter('live'); return; }
        if(action.dataset.action === 'wait-start'){ startWaitSession(bookingId, 'wait'); toast('Wait timer started.', 'good'); openCenter('live'); return; }
        if(action.dataset.action === 'wait-stop'){ stopWaitSession(bookingId); toast('Wait timer stopped.', 'good'); openCenter('live'); return; }
        if(action.dataset.action === 'assist'){ openQuickAssist(bookingId); return; }
        if(action.dataset.action === 'recovery'){ openQuickRecovery(bookingId); return; }
        if(action.dataset.action === 'closeout'){ openCloseout(bookingId); return; }
      }
      if(e.target.id === 'wg41ExportBoardHtml'){ exportServiceBoardHtml(); return; }
      if(e.target.id === 'wg41ExportBoardJson'){ exportServiceBoardJson(); return; }
      if(e.target.id === 'wg41ExportPayoutHtml'){ exportPayoutLedgerHtml(); return; }
      if(e.target.id === 'wg41ExportPayoutJson'){ exportPayoutLedgerJson(); return; }
    });
  }

  function inject(){
    const existing = document.getElementById('routexWg41Card');
    if(existing) existing.remove();
    const host = document.querySelector('#app') || document.body;
    const board = readBoards()[0] || saveBoard();
    const card = document.createElement('div');
    card.id = 'routexWg41Card';
    card.className = 'card';
    card.innerHTML = '<h2 style="margin:0 0 10px">White-glove chauffeur execution</h2><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><span class="badge">Active '+esc(String(board.activeBookings || 0))+'</span><span class="badge">Wait timers '+esc(String(board.waitActive || 0))+'</span><span class="badge">Recovery '+esc(String(board.recoveryOpen || 0))+'</span><span class="badge">Payout today '+money(board.payoutToday || 0)+'</span></div><div style="margin-bottom:12px">Routex can now run the live chauffeur service lane, capture assistance and wait states, close bookings with richer receipts, and write driver payout events from the same stored record.</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="routexWg41Open" class="btn small">Execution center</button><button id="routexWg41BoardHtml" class="btn small">Export board HTML</button><button id="routexWg41PayoutHtml" class="btn small">Export payout HTML</button></div>';
    host.appendChild(card);
    card.querySelector('#routexWg41Open').onclick = ()=> openCenter('live');
    card.querySelector('#routexWg41BoardHtml').onclick = exportServiceBoardHtml;
    card.querySelector('#routexWg41PayoutHtml').onclick = exportPayoutLedgerHtml;

    const toolbar = document.querySelector('#routexWorkbenchToolbar') || document.querySelector('.toolbar') || document.querySelector('.row');
    if(toolbar && !document.getElementById('routexWg41ToolbarBtn')){
      const btn = document.createElement('button');
      btn.id = 'routexWg41ToolbarBtn';
      btn.className = 'btn small';
      btn.textContent = 'Execution center';
      btn.onclick = ()=> openCenter('live');
      toolbar.appendChild(btn);
    }
  }

  const observer = new MutationObserver(()=> inject());
  observer.observe(document.body, { childList:true, subtree:true });
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(inject, 0); return out; };

  window.readWhiteGloveExecutionRowsV41 = readExecution;
  window.readWhiteGlovePayoutLedgerV41 = readPayoutLedger;
  window.saveWhiteGloveServiceBoardV41 = saveBoard;
  window.startWhiteGloveWaitSessionV41 = startWaitSession;
  window.stopWhiteGloveWaitSessionV41 = stopWaitSession;
  window.addWhiteGloveAssistEventV41 = addAssistEvent;
  window.finalizeWhiteGloveCloseoutV41 = finalizeExecutionCloseout;
  window.openWhiteGloveExecutionCenterV41 = openCenter;
})();
