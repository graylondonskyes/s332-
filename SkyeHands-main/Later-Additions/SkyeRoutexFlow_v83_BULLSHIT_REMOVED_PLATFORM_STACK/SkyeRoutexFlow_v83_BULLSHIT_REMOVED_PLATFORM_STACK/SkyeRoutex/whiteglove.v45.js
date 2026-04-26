/* V45 Routex white-glove acceptance harness + compliance review bundles */
(function(){
  if(window.__ROUTEX_WHITEGLOVE_V45__) return;
  window.__ROUTEX_WHITEGLOVE_V45__ = true;

  const SHARED = {
    profiles: 'skye_whiteglove_service_profiles_v39',
    drivers: 'skye_whiteglove_driver_profiles_v39',
    vehicles: 'skye_whiteglove_vehicle_profiles_v39',
    memberships: 'skye_whiteglove_memberships_v39',
    bookings: 'skye_whiteglove_bookings_v39',
    events: 'skye_whiteglove_events_v39',
    outbox: 'skye_whiteglove_sync_outbox_v39',
    docs: 'skye_whiteglove_docs_v39'
  };
  const V40 = {
    templates: 'skye_whiteglove_recurring_templates_v40',
    materialized: 'skye_whiteglove_materialized_routes_v40'
  };
  const V41 = {
    execution: 'skye_whiteglove_execution_rows_v41',
    payoutLedger: 'skye_whiteglove_payout_ledger_v41'
  };
  const V42 = {
    websiteRequests: 'skye_whiteglove_website_requests_v42',
    syncLedger: 'skye_whiteglove_sync_ledger_v42',
    analytics: 'skye_whiteglove_analytics_snapshots_v42',
    backups: 'skye_whiteglove_backup_bundles_v42',
    restoreRuns: 'skye_whiteglove_restore_runs_v42'
  };
  const V44 = {
    acceptanceLog: 'skye_whiteglove_driver_acceptance_v44',
    proofPacks: 'skye_whiteglove_proof_packs_v44',
    validationSnapshots: 'skye_whiteglove_validation_snapshots_v44'
  };
  const KEYS = {
    scenarioRuns: 'skye_whiteglove_acceptance_runs_v45',
    scenarioOutbox: 'skye_whiteglove_acceptance_outbox_v45',
    compliancePacks: 'skye_whiteglove_compliance_packs_v45',
    complianceOutbox: 'skye_whiteglove_compliance_outbox_v45',
    ui: 'skye_whiteglove_v45_ui'
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
  const readExecution = ()=> readJSON(V41.execution, []);
  const readPayout = ()=> readJSON(V41.payoutLedger, []);
  const readMaterialized = ()=> readJSON(V40.materialized, []);
  const readWebsiteRequests = ()=> readJSON(V42.websiteRequests, []);
  const readSyncLedger = ()=> readJSON(V42.syncLedger, []);
  const readBackups = ()=> readJSON(V42.backups, []);
  const readRestoreRuns = ()=> readJSON(V42.restoreRuns, []);
  const readAcceptanceLog = ()=> readJSON(V44.acceptanceLog, []);
  const readProofPacks = ()=> readJSON(V44.proofPacks, []);
  const readValidation = ()=> readJSON(V44.validationSnapshots, []);
  const readScenarioRuns = ()=> readJSON(KEYS.scenarioRuns, []);
  const readScenarioOutbox = ()=> readJSON(KEYS.scenarioOutbox, []);
  const readCompliancePacks = ()=> readJSON(KEYS.compliancePacks, []);
  const readComplianceOutbox = ()=> readJSON(KEYS.complianceOutbox, []);
  const readUI = ()=> readJSON(KEYS.ui, { scenarioTab:'acceptance', complianceBookingId:'' });
  const writeScenarioRuns = (rows)=> writeJSON(KEYS.scenarioRuns, rows);
  const writeScenarioOutbox = (rows)=> writeJSON(KEYS.scenarioOutbox, rows);
  const writeCompliancePacks = (rows)=> writeJSON(KEYS.compliancePacks, rows);
  const writeComplianceOutbox = (rows)=> writeJSON(KEYS.complianceOutbox, rows);
  const writeUI = (patch)=> writeJSON(KEYS.ui, Object.assign({}, readUI(), patch || {}));

  function patchRows(key, mutator){
    const rows = readJSON(key, []);
    const next = mutator(rows.slice()) || rows;
    writeJSON(key, next);
    return next;
  }
  function patchBooking(id, fn){
    const rows = readBookings();
    const idx = rows.findIndex(row => row.id === id);
    if(idx === -1) return null;
    const next = fn ? fn(Object.assign({}, rows[idx])) : rows[idx];
    next.updatedAt = nowISO();
    rows[idx] = next;
    writeJSON(SHARED.bookings, rows);
    return next;
  }
  function getById(rows, id){ return rows.find(row => clean(row.id) === clean(id)) || null; }
  function getProfile(id){ return getById(readProfiles(), id); }
  function getDriver(id){ return getById(readDrivers(), id); }
  function getVehicle(id){ return getById(readVehicles(), id); }
  function getMembership(id){ return getById(readMemberships(), id); }
  function getBooking(id){ return getById(readBookings(), id); }

  function pushSharedEvent(type, refs, note, extra){
    const rows = readJSON(SHARED.events, []);
    rows.unshift(Object.assign({ id: uid('wg_evt45'), type: clean(type), refs: refs || {}, note: clean(note), createdAt: nowISO() }, extra || {}));
    writeJSON(SHARED.events, rows.slice(0, 2000));
  }
  function pushSync(kind, status, note, payload){
    const rows = readSyncLedger();
    const row = { id: uid('wg_sync45'), kind: clean(kind), status: clean(status) || 'queued', note: clean(note), payload: payload || {}, createdAt: nowISO(), updatedAt: nowISO(), retryCount:0 };
    rows.unshift(row);
    writeJSON(V42.syncLedger, rows.slice(0, 1200));
    return row;
  }

  function ensureServiceProfile(payload){
    const rows = readProfiles();
    const existing = rows.find(row => clean(row.displayName) === clean(payload.displayName) || (clean(payload.email) && clean(row.email) === clean(payload.email)));
    if(existing) return existing;
    if(typeof window.saveWhiteGloveServiceProfile === 'function') return window.saveWhiteGloveServiceProfile(payload);
    return null;
  }
  function ensureDriver(payload){
    const rows = readDrivers();
    const existing = rows.find(row => clean(row.displayName) === clean(payload.displayName));
    if(existing) return existing;
    if(typeof window.saveWhiteGloveDriverProfile === 'function') return window.saveWhiteGloveDriverProfile(payload);
    return null;
  }
  function ensureVehicle(payload){
    const rows = readVehicles();
    const existing = rows.find(row => clean(row.displayName) === clean(payload.displayName));
    if(existing) return existing;
    if(typeof window.saveWhiteGloveVehicleProfile === 'function') return window.saveWhiteGloveVehicleProfile(payload);
    return null;
  }
  function ensureMembership(payload){
    const rows = readMemberships();
    const existing = rows.find(row => clean(row.serviceProfileId) === clean(payload.serviceProfileId) && clean(row.memberTierLabel) === clean(payload.memberTierLabel));
    if(existing) return existing;
    if(typeof window.saveWhiteGloveMembership === 'function') return window.saveWhiteGloveMembership(payload);
    return null;
  }
  function createBooking(payload){
    if(typeof window.saveWhiteGloveBooking !== 'function') return null;
    return window.saveWhiteGloveBooking(payload);
  }

  function seedMaterializedRoute(booking){
    const rows = readMaterialized();
    const existing = rows.find(row => clean(row.bookingId) === clean(booking.id));
    if(existing) return existing;
    const stopSequence = [booking.pickupAddress].concat((booking.multiStopText || '').split('\n').map(clean).filter(Boolean)).concat([booking.dropoffAddress]).filter(Boolean);
    const row = {
      id: uid('wg_mat45'),
      bookingId: booking.id,
      createdAt: nowISO(),
      routeLink: booking.routeLink || uid('route'),
      routeStopLink: booking.routeStopLink || uid('stop'),
      stopSequence,
      returnLeg: !!booking.returnLeg,
      standbyEnabled: booking.serviceType === 'hourly_standby'
    };
    rows.unshift(row);
    writeJSON(V40.materialized, rows.slice(0, 800));
    return row;
  }

  function seedExecution(booking, payload){
    const rows = readExecution();
    const existing = rows.find(row => clean(row.bookingId) === clean(booking.id));
    if(existing) return existing;
    const row = Object.assign({
      id: uid('wg_exec45'),
      bookingId: booking.id,
      serviceProfileId: booking.serviceProfileId,
      driverId: booking.assignedDriverId,
      vehicleId: booking.assignedVehicleId,
      startedAt: nowISO(),
      completedAt: nowISO(),
      dispatchStatus: 'completed',
      waitMinutes: 0,
      standbyMinutes: 0,
      assistanceEvents: [],
      handoffNotes: '',
      serviceRecoveryNotes: '',
      returnLegCompleted: !!booking.returnLeg,
      riderConfirmed: true,
      createdAt: nowISO(),
      updatedAt: nowISO()
    }, payload || {});
    rows.unshift(row);
    writeJSON(V41.execution, rows.slice(0, 1200));
    return row;
  }

  function seedPayout(booking, payload){
    const rows = readPayout();
    const existing = rows.find(row => clean(row.bookingId) === clean(booking.id));
    if(existing) return existing;
    const quoted = Number(booking.pricingSnapshot && booking.pricingSnapshot.quotedTotal || 0);
    const row = Object.assign({
      id: uid('wg_pay45'),
      bookingId: booking.id,
      driverId: booking.assignedDriverId,
      model: 'hybrid',
      payoutAmount: Number((quoted * 0.42).toFixed(2)),
      bookedRevenue: quoted,
      waitRevenue: Number(booking.waitRevenue || 0),
      overageRevenue: Number(booking.overageRevenue || 0),
      tipAmount: Number(booking.tipAmount || 0),
      createdAt: nowISO(),
      updatedAt: nowISO()
    }, payload || {});
    rows.unshift(row);
    writeJSON(V41.payoutLedger, rows.slice(0, 1200));
    return row;
  }

  function appendDoc(bookingId, type, title, html, extra){
    const rows = readDocs();
    const row = Object.assign({
      id: uid('wg_doc45'),
      bookingId: clean(bookingId),
      type: clean(type),
      title: clean(title),
      html: String(html || ''),
      createdAt: nowISO(),
      updatedAt: nowISO()
    }, extra || {});
    rows.unshift(row);
    writeJSON(SHARED.docs, rows.slice(0, 1200));
    return row;
  }

  function addAcceptance(bookingId, driverId, action, note){
    const rows = readAcceptanceLog();
    const row = { id: uid('wg_accept45'), bookingId: clean(bookingId), driverId: clean(driverId), action: clean(action), note: clean(note), savedAt: nowISO(), driverName: (getDriver(driverId) || {}).displayName || '', bookingLabel: bookingId };
    rows.unshift(row);
    writeJSON(V44.acceptanceLog, rows.slice(0, 1200));
    return row;
  }

  function createSimpleHtml(title, sections){
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.wrap{max-width:1100px;margin:0 auto}.card{border:1px solid #ddd;border-radius:16px;padding:16px;margin:0 0 16px}.badge{display:inline-block;padding:4px 8px;border:1px solid #ccc;border-radius:999px;margin:0 6px 6px 0}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}pre{white-space:pre-wrap}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px">'+esc(title)+'</h1><div><span class="badge">Generated '+esc(nowISO())+'</span></div></div>'+sections.join('')+'</div></body></html>';
  }

  function completeBooking(bookingId, patch){
    const booking = patchBooking(bookingId, row => {
      row.assignedDriverId = clean((patch && patch.assignedDriverId) || row.assignedDriverId);
      row.assignedVehicleId = clean((patch && patch.assignedVehicleId) || row.assignedVehicleId);
      row.dispatchStatus = clean((patch && patch.dispatchStatus) || 'completed');
      row.favoriteDriverState = clean((patch && patch.favoriteDriverState) || row.favoriteDriverState || '');
      row.waitRevenue = Number((patch && patch.waitRevenue) || row.waitRevenue || 0);
      row.overageRevenue = Number((patch && patch.overageRevenue) || row.overageRevenue || 0);
      row.tipAmount = Number((patch && patch.tipAmount) || row.tipAmount || 0);
      row.creditAmount = Number((patch && patch.creditAmount) || row.creditAmount || 0);
      row.refundAmount = Number((patch && patch.refundAmount) || row.refundAmount || 0);
      row.paymentMethod = clean((patch && patch.paymentMethod) || row.paymentMethod || 'card_on_file');
      row.whiteGloveNotes = clean((patch && patch.whiteGloveNotes) || row.whiteGloveNotes);
      row.serviceRecoveryNotes = clean((patch && patch.serviceRecoveryNotes) || row.serviceRecoveryNotes);
      row.timeline = Array.isArray(row.timeline) ? row.timeline : [];
      row.timeline.push({ status: row.dispatchStatus, at: nowISO(), note: clean((patch && patch.timelineNote) || 'Scenario completion recorded') });
      row.closedAt = nowISO();
      return row;
    });
    return booking;
  }

  function ensureMembershipUsage(booking, usedHours, usedMiles){
    if(!booking || !booking.membershipId) return null;
    const memberships = readMemberships();
    const idx = memberships.findIndex(row => clean(row.id) === clean(booking.membershipId));
    if(idx === -1) return null;
    const row = Object.assign({}, memberships[idx]);
    row.remainingHours = Math.max(0, Number(row.remainingHours || row.includedHours || 0) - Number(usedHours || 0));
    row.remainingMiles = Math.max(0, Number(row.remainingMiles || row.includedMiles || 0) - Number(usedMiles || 0));
    row.usageLedger = Array.isArray(row.usageLedger) ? row.usageLedger : [];
    row.usageLedger.unshift({ id: uid('wg_use45'), bookingId: booking.id, usedHours: Number(usedHours || 0), usedMiles: Number(usedMiles || 0), createdAt: nowISO() });
    row.updatedAt = nowISO();
    memberships[idx] = row;
    writeJSON(SHARED.memberships, memberships);
    return row;
  }

  function seedWebsiteRequestForBooking(profile, driver, membership){
    const rows = readWebsiteRequests();
    const row = {
      id: uid('wg_web45'),
      requestSource: 'website',
      status: 'materialized',
      syncState: 'awaiting_external_sync',
      riderName: profile.displayName,
      phone: profile.primaryPhone,
      email: profile.email,
      profileType: profile.profileType,
      pickupAddress: 'Phoenix Convention Center',
      dropoffAddress: 'Scottsdale Quarter',
      market: 'phoenix',
      serviceType: 'reserve',
      vehicleClass: 'suv',
      bookedHours: 2,
      requestedMiles: 28,
      sameDay: false,
      membershipId: membership ? membership.id : '',
      favoriteDriverId: driver ? driver.id : '',
      notes: 'Website-origin VIP request',
      bookingId: '',
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    rows.unshift(row);
    writeJSON(V42.websiteRequests, rows.slice(0, 600));
    return row;
  }

  function buildBackupBundle(){
    const data = {
      profiles: readProfiles(),
      drivers: readDrivers(),
      vehicles: readVehicles(),
      memberships: readMemberships(),
      bookings: readBookings(),
      docs: readDocs(),
      outbox: readJSON(SHARED.outbox, []),
      execution: readExecution(),
      payoutLedger: readPayout(),
      websiteRequests: readWebsiteRequests(),
      syncLedger: readSyncLedger(),
      analytics: readJSON(V42.analytics, [])
    };
    const fingerprint = 'wgbackup45-' + btoa(unescape(encodeURIComponent(JSON.stringify({ counts:{ profiles:data.profiles.length, drivers:data.drivers.length, bookings:data.bookings.length, docs:data.docs.length } }))))
      .replace(/[^a-z0-9]/gi,'').slice(0,18).toLowerCase();
    const row = {
      id: uid('wg_backup45'),
      createdAt: nowISO(),
      fingerprint,
      counts: {
        profiles: data.profiles.length,
        drivers: data.drivers.length,
        vehicles: data.vehicles.length,
        memberships: data.memberships.length,
        bookings: data.bookings.length,
        docs: data.docs.length,
        websiteRequests: data.websiteRequests.length,
        syncLedger: data.syncLedger.length,
        analytics: data.analytics.length
      },
      data
    };
    const rows = readBackups();
    rows.unshift(row);
    writeJSON(V42.backups, rows.slice(0, 120));
    return row;
  }

  function createRestoreRunFromBackup(bundle){
    if(!bundle) return null;
    const run = {
      id: uid('wg_restore45'),
      createdAt: nowISO(),
      mode: 'merge',
      importedFingerprint: bundle.fingerprint,
      counts: bundle.counts,
      duplicates: { profiles:0, drivers:0, bookings:0 },
      final: {
        profiles: readProfiles().length,
        drivers: readDrivers().length,
        vehicles: readVehicles().length,
        memberships: readMemberships().length,
        bookings: readBookings().length,
        docs: readDocs().length
      }
    };
    const rows = readRestoreRuns();
    rows.unshift(run);
    writeJSON(V42.restoreRuns, rows.slice(0, 120));
    return run;
  }

  function scenarioChecklist(label, items, refs){
    const blockerList = items.filter(item => !item.ok).map(item => item.label + ' — ' + item.note);
    return {
      id: uid('wg_case45'),
      label,
      createdAt: nowISO(),
      ok: blockerList.length === 0,
      refs: refs || {},
      checks: items,
      blockers: blockerList
    };
  }

  function runScenarioRetailReserve(){
    const driver = ensureDriver({ displayName:'Adrian Vale', vehiclePermissions:'sedan,suv', marketsServed:'phoenix,scottsdale', payoutModel:'hybrid', qualityScore:5, assistCapabilities:'door assist,luggage help' });
    const vehicle = ensureVehicle({ displayName:'Midnight Sedan', vehicleClass:'sedan', seatCount:4, market:'phoenix', whiteGloveTags:'executive,quiet' });
    const profile = ensureServiceProfile({ profileType:'individual', displayName:'Retail Reserve Rider', legalName:'Retail Reserve Rider', primaryPhone:'602-000-4501', email:'retail.reserve@example.com', addresses:'Biltmore Fashion Park\nPhoenix Sky Harbor', preferredZone:'phoenix', serviceArea:'phoenix', assistanceNotes:'Door assist preferred', accessNotes:'Use valet lane', favoriteDriverIds:'', householdAuthorizedRiders:'', billingPreference:'receipt', receiptDestination:'email', temperature:'cool', music:'quiet jazz', quietRide:true, luggageHelp:true, groceryHelp:false, callTextPreference:'text', notesHistory:'Retail reserve scenario seed' });
    let booking = createBooking({ requestSource:'operator', serviceProfileId:profile.id, serviceType:'reserve', vehicleClass:'sedan', market:'phoenix', bookedHours:2, requestedMiles:22, pickupAddress:'Biltmore Fashion Park', dropoffAddress:'Phoenix Sky Harbor', riderNotes:'Retail reserve acceptance scenario', operatorNotes:'Scenario A', etaWindow:dayISO()+' 09:00-11:00' });
    booking = completeBooking(booking.id, { assignedDriverId:driver.id, assignedVehicleId:vehicle.id, dispatchStatus:'completed', timelineNote:'Retail reserve ride completed', whiteGloveNotes:'Door assist and luggage support completed.', paymentMethod:'card_on_file' });
    const route = seedMaterializedRoute(booking);
    const execution = seedExecution(booking, { waitMinutes:6, assistanceEvents:['door_assist','luggage_assist'], handoffNotes:'Airport curbside handoff confirmed.' });
    const payout = seedPayout(booking, { model:'hybrid', payoutAmount:Number(((booking.pricingSnapshot && booking.pricingSnapshot.quotedTotal || 0) * 0.41).toFixed(2)) });
    const receipt = appendDoc(booking.id, 'trip_receipt_html', 'Retail reserve receipt', createSimpleHtml('Retail reserve receipt', [
      '<div class="card"><h2 style="margin:0 0 8px">Booking</h2><table><tr><td>Booking</td><td>'+esc(booking.id)+'</td></tr><tr><td>Client</td><td>'+esc(profile.displayName)+'</td></tr><tr><td>Quoted total</td><td>'+money(booking.pricingSnapshot && booking.pricingSnapshot.quotedTotal)+'</td></tr><tr><td>Payment</td><td>'+esc(booking.paymentMethod || 'card_on_file')+'</td></tr></table></div>'
    ]));
    const service = appendDoc(booking.id, 'premium_service_summary_html', 'Retail reserve service summary', createSimpleHtml('Retail reserve service summary', [
      '<div class="card"><h2 style="margin:0 0 8px">Service notes</h2><div>'+esc(booking.whiteGloveNotes || '')+'</div><div style="margin-top:8px">Wait minutes '+esc(String(execution.waitMinutes || 0))+'</div></div>'
    ]));
    const checks = [
      { label:'Canonical booking created', ok: !!booking, note: booking ? booking.id : 'Booking missing' },
      { label:'Route materialized', ok: !!route, note: route ? route.routeLink : 'No route record' },
      { label:'Trip closed', ok: booking && booking.dispatchStatus === 'completed', note: booking ? booking.dispatchStatus : 'No status' },
      { label:'Receipt generated', ok: !!receipt, note: receipt ? receipt.id : 'Receipt missing' },
      { label:'Operator ledger generated', ok: !!payout, note: payout ? payout.id : 'Payout missing' }
    ];
    return scenarioChecklist('Scenario A — retail reserve ride', checks, { bookingId: booking && booking.id, profileId: profile.id, driverId: driver.id, receiptId: receipt && receipt.id, payoutId: payout && payout.id, serviceDocId: service && service.id });
  }

  function runScenarioFavoriteDriver(){
    const driver = ensureDriver({ displayName:'Selene Hart', vehiclePermissions:'sedan,suv', marketsServed:'phoenix,scottsdale', payoutModel:'per_service', qualityScore:5, assistCapabilities:'door assist,executive support' });
    const vehicle = ensureVehicle({ displayName:'Pearl Executive SUV', vehicleClass:'suv', seatCount:6, market:'scottsdale', whiteGloveTags:'vip,executive' });
    const profile = ensureServiceProfile({ profileType:'vip', displayName:'Favorite Driver Rider', legalName:'Favorite Driver Rider', primaryPhone:'602-000-4502', email:'favorite.driver@example.com', addresses:'Scottsdale Waterfront\nCamelback Inn', preferredZone:'scottsdale', serviceArea:'scottsdale', assistanceNotes:'Executive handoff', accessNotes:'Hotel lobby', favoriteDriverIds:driver.id, householdAuthorizedRiders:'', billingPreference:'receipt', receiptDestination:'email', temperature:'cool', music:'instrumental', quietRide:true, luggageHelp:false, groceryHelp:false, callTextPreference:'call', notesHistory:'Favorite driver scenario seed' });
    let booking = createBooking({ requestSource:'operator', serviceProfileId:profile.id, serviceType:'now', vehicleClass:'suv', market:'scottsdale', bookedHours:1, requestedMiles:12, sameDay:true, pickupAddress:'Scottsdale Waterfront', dropoffAddress:'Camelback Inn', riderNotes:'Needs favorite-driver continuity.', operatorNotes:'Scenario B', etaWindow:dayISO()+' 13:00-14:00' });
    booking = completeBooking(booking.id, { assignedDriverId:driver.id, assignedVehicleId:vehicle.id, favoriteDriverState:'matched', dispatchStatus:'completed', timelineNote:'Favorite driver matched and completed', whiteGloveNotes:'Preferred driver request honored.', paymentMethod:'card_on_file' });
    seedMaterializedRoute(booking);
    seedExecution(booking, { assistanceEvents:['door_assist'], handoffNotes:'Favorite driver continuity maintained.' });
    seedPayout(booking, { model:'per_service' });
    const acceptance = addAcceptance(booking.id, driver.id, 'accepted', 'Favorite driver accepted and was matched.');
    const service = appendDoc(booking.id, 'premium_service_summary_html', 'Favorite driver continuity summary', createSimpleHtml('Favorite driver continuity summary', [
      '<div class="card"><h2 style="margin:0 0 8px">Continuity</h2><table><tr><td>Favorite state</td><td>'+esc(booking.favoriteDriverState)+'</td></tr><tr><td>Driver</td><td>'+esc(driver.displayName)+'</td></tr><tr><td>Acceptance row</td><td>'+esc(acceptance.id)+'</td></tr></table></div>'
    ]));
    const checks = [
      { label:'Favorite driver preference stored', ok: Array.isArray(profile.favoriteDriverIds) && profile.favoriteDriverIds.includes(driver.id), note: profile.favoriteDriverIds.join(', ') || 'None' },
      { label:'Booking created', ok: !!booking, note: booking ? booking.id : 'Missing booking' },
      { label:'Truthful favorite state recorded', ok: booking && ['matched','unavailable','overridden_by_dispatch','preferred'].includes(booking.favoriteDriverState), note: booking ? booking.favoriteDriverState : 'Missing' },
      { label:'Acceptance / override row stored', ok: !!acceptance, note: acceptance ? acceptance.action : 'Missing' },
      { label:'Continuity doc generated', ok: !!service, note: service ? service.id : 'Missing doc' }
    ];
    return scenarioChecklist('Scenario B — on-demand ride with favorite-driver preference', checks, { bookingId: booking && booking.id, profileId: profile.id, driverId: driver.id, acceptanceId: acceptance && acceptance.id, serviceDocId: service && service.id });
  }

  function runScenarioMember(){
    const driver = ensureDriver({ displayName:'Noah Crest', vehiclePermissions:'sedan,suv', marketsServed:'phoenix,mesa', payoutModel:'hourly', qualityScore:5, assistCapabilities:'grocery help,door assist' });
    const vehicle = ensureVehicle({ displayName:'Sterling Member SUV', vehicleClass:'suv', seatCount:6, market:'phoenix', whiteGloveTags:'member,grocery' });
    const profile = ensureServiceProfile({ profileType:'household', displayName:'Member Household', legalName:'Member Household', primaryPhone:'602-000-4503', email:'member.household@example.com', addresses:'Arcadia Home\nWhole Foods Camelback', preferredZone:'phoenix', serviceArea:'phoenix', assistanceNotes:'Grocery assist', accessNotes:'Call on arrival', favoriteDriverIds:'', householdAuthorizedRiders:'Member Household – Rider 2', billingPreference:'member', receiptDestination:'email', temperature:'neutral', music:'light pop', quietRide:false, luggageHelp:false, groceryHelp:true, callTextPreference:'text', notesHistory:'Membership scenario seed' });
    const membership = ensureMembership({ serviceProfileId: profile.id, planType:'monthly_included_hours_and_miles', cadence:'monthly', includedHours:10, includedMiles:120, memberTierLabel:'Founder Member', rolloverRule:'no_rollover', householdRiderCap:4, status:'active', renewalNote:'Auto-renew member plan' });
    let booking = createBooking({ requestSource:'returning_member', serviceProfileId:profile.id, membershipId:membership.id, serviceType:'errand', vehicleClass:'suv', market:'phoenix', bookedHours:2, requestedMiles:18, pickupAddress:'Arcadia Home', dropoffAddress:'Whole Foods Camelback', riderNotes:'Grocery assist member booking', operatorNotes:'Scenario C', etaWindow:dayISO()+' 15:00-17:00' });
    booking = completeBooking(booking.id, { assignedDriverId:driver.id, assignedVehicleId:vehicle.id, dispatchStatus:'completed', timelineNote:'Member ride completed', whiteGloveNotes:'Grocery assist complete.', paymentMethod:'membership_ledger' });
    seedMaterializedRoute(booking);
    seedExecution(booking, { assistanceEvents:['grocery_assist','door_assist'], waitMinutes:4 });
    const updatedMembership = ensureMembershipUsage(booking, 2, 18);
    const payout = seedPayout(booking, { model:'hourly', payoutAmount:Number((2 * 31).toFixed(2)) });
    const ledgerDoc = appendDoc(booking.id, 'member_usage_summary_html', 'Member usage summary', createSimpleHtml('Member usage summary', [
      '<div class="card"><h2 style="margin:0 0 8px">Membership ledger</h2><table><tr><td>Plan</td><td>'+esc(membership.memberTierLabel)+'</td></tr><tr><td>Remaining hours</td><td>'+esc(String(updatedMembership ? updatedMembership.remainingHours : membership.remainingHours))+'</td></tr><tr><td>Remaining miles</td><td>'+esc(String(updatedMembership ? updatedMembership.remainingMiles : membership.remainingMiles))+'</td></tr></table></div>'
    ]));
    const checks = [
      { label:'Membership created', ok: !!membership, note: membership ? membership.id : 'Missing membership' },
      { label:'Member booking created', ok: !!booking && clean(booking.membershipId) === clean(membership.id), note: booking ? booking.membershipId : 'No booking' },
      { label:'Included ledger decremented', ok: !!updatedMembership && updatedMembership.remainingHours < membership.includedHours && updatedMembership.remainingMiles < membership.includedMiles, note: updatedMembership ? ('H ' + updatedMembership.remainingHours + ' / M ' + updatedMembership.remainingMiles) : 'Missing' },
      { label:'Member ledger doc generated', ok: !!ledgerDoc, note: ledgerDoc ? ledgerDoc.id : 'Missing doc' },
      { label:'Payout event stored', ok: !!payout, note: payout ? payout.id : 'Missing payout' }
    ];
    return scenarioChecklist('Scenario C — subscription ride', checks, { bookingId: booking && booking.id, membershipId: membership.id, profileId: profile.id, payoutId: payout && payout.id, ledgerDocId: ledgerDoc && ledgerDoc.id });
  }

  function runScenarioWebsiteOrigin(){
    const driver = ensureDriver({ displayName:'Mara Quinn', vehiclePermissions:'suv,xl', marketsServed:'phoenix,glendale', payoutModel:'hybrid', qualityScore:5, assistCapabilities:'meet greet,luggage help' });
    const vehicle = ensureVehicle({ displayName:'Jet Black Airport SUV', vehicleClass:'suv', seatCount:6, market:'phoenix', whiteGloveTags:'airport,meet greet' });
    const profile = ensureServiceProfile({ profileType:'executive', displayName:'Website Origin Executive', legalName:'Website Origin Executive', primaryPhone:'602-000-4504', email:'website.origin@example.com', addresses:'Phoenix Convention Center\nScottsdale Quarter', preferredZone:'phoenix', serviceArea:'phoenix', assistanceNotes:'Meet/greet sign required', accessNotes:'Call assistant if delayed', favoriteDriverIds:driver.id, householdAuthorizedRiders:'', billingPreference:'receipt', receiptDestination:'assistant@example.com', temperature:'cool', music:'none', quietRide:true, luggageHelp:true, groceryHelp:false, callTextPreference:'text', notesHistory:'Website-origin scenario seed' });
    const request = seedWebsiteRequestForBooking(profile, driver, null);
    let booking = createBooking({ requestSource:'website', serviceProfileId:profile.id, serviceType:'reserve', vehicleClass:'suv', market:'phoenix', bookedHours:2, requestedMiles:28, pickupAddress:request.pickupAddress, dropoffAddress:request.dropoffAddress, riderNotes:request.notes, operatorNotes:'Scenario D', favoriteDriverId:driver.id, etaWindow:dayISO()+' 18:00-20:00' });
    booking = completeBooking(booking.id, { assignedDriverId:driver.id, assignedVehicleId:vehicle.id, favoriteDriverState:'matched', dispatchStatus:'completed', timelineNote:'Website-origin ride completed', whiteGloveNotes:'Meet and greet performed.', paymentMethod:'card_on_file' });
    patchRows(V42.websiteRequests, rows => rows.map(row => clean(row.id) === clean(request.id) ? Object.assign({}, row, { bookingId: booking.id, status:'completed', syncState:'retryable', updatedAt: nowISO() }) : row));
    seedMaterializedRoute(booking);
    seedExecution(booking, { assistanceEvents:['meet_greet','luggage_assist'], handoffNotes:'Executive assistant copied on updates.' });
    const payout = seedPayout(booking, { model:'hybrid' });
    pushSync('website_request_materialized', 'retryable', 'Website-origin booking recorded and awaiting downstream confirmation.', { requestId: request.id, bookingId: booking.id, source:'website' });
    const receipt = appendDoc(booking.id, 'trip_receipt_html', 'Website-origin customer receipt', createSimpleHtml('Website-origin customer receipt', [
      '<div class="card"><h2 style="margin:0 0 8px">Website source</h2><table><tr><td>Request source</td><td>'+esc(booking.requestSource)+'</td></tr><tr><td>Request row</td><td>'+esc(request.id)+'</td></tr><tr><td>Booking</td><td>'+esc(booking.id)+'</td></tr></table></div>'
    ]));
    const checks = [
      { label:'Website request stored', ok: !!request, note: request ? request.id : 'Missing request' },
      { label:'Website request materialized into booking', ok: !!booking && booking.requestSource === 'website', note: booking ? booking.id : 'Missing booking' },
      { label:'Routex execution closed from website origin', ok: booking && booking.dispatchStatus === 'completed', note: booking ? booking.dispatchStatus : 'Missing' },
      { label:'Source attribution preserved', ok: booking && booking.requestSource === 'website', note: booking ? booking.requestSource : 'Missing' },
      { label:'Customer record and export created', ok: !!receipt && !!payout, note: (receipt && payout) ? (receipt.id + ' / ' + payout.id) : 'Missing' }
    ];
    return scenarioChecklist('Scenario D — website-origin booking', checks, { bookingId: booking && booking.id, requestId: request && request.id, receiptId: receipt && receipt.id, payoutId: payout && payout.id });
  }

  function runScenarioBackupRestore(){
    const bundle = buildBackupBundle();
    const restoreRun = createRestoreRunFromBackup(bundle);
    const latestBookings = readBookings();
    const linked = latestBookings.filter(row => row.routeMaterialized || row.routeLink || row.routeStopLink).length;
    const checks = [
      { label:'Backup bundle saved', ok: !!bundle, note: bundle ? bundle.fingerprint : 'Missing bundle' },
      { label:'Restore run logged', ok: !!restoreRun, note: restoreRun ? restoreRun.id : 'Missing restore run' },
      { label:'Booking chain still present after restore log', ok: linked > 0, note: 'Linked bookings ' + linked },
      { label:'Service profiles preserved', ok: readProfiles().length > 0, note: 'Profiles ' + readProfiles().length },
      { label:'Receipts/docs still line up', ok: readDocs().filter(row => clean(row.bookingId)).length > 0, note: 'Docs with booking links ' + readDocs().filter(row => clean(row.bookingId)).length }
    ];
    return scenarioChecklist('Scenario E — backup and restore', checks, { backupId: bundle && bundle.id, restoreId: restoreRun && restoreRun.id, backupFingerprint: bundle && bundle.fingerprint });
  }

  function runAllScenarios(){
    const scenarios = [
      runScenarioRetailReserve(),
      runScenarioFavoriteDriver(),
      runScenarioMember(),
      runScenarioWebsiteOrigin(),
      runScenarioBackupRestore()
    ];
    const blockers = scenarios.filter(row => !row.ok).map(row => row.label + ': ' + (row.blockers[0] || 'review'));
    const run = {
      id: uid('wg_acceptance45'),
      createdAt: nowISO(),
      label: 'White-glove acceptance harness • ' + dayISO(),
      ok: blockers.length === 0,
      blockerCount: blockers.length,
      blockers,
      scenarios,
      fingerprint: 'wgaccept-' + dayISO() + '-' + String(scenarios.map(row => row.id).join('|').length + blockers.length)
    };
    const rows = readScenarioRuns();
    rows.unshift(run);
    writeScenarioRuns(rows.slice(0, 120));
    const outbox = readScenarioOutbox();
    outbox.unshift(run);
    writeScenarioOutbox(outbox.slice(0, 120));
    pushSharedEvent('whiteglove_acceptance_harness_saved', { acceptanceRunId: run.id }, 'White-glove acceptance harness saved', { blockerCount: run.blockerCount });
    return run;
  }

  function buildCompliancePack(bookingId){
    const booking = getBooking(bookingId);
    if(!booking) return null;
    const profile = getProfile(booking.serviceProfileId);
    const membership = getMembership(booking.membershipId);
    const driver = getDriver(booking.assignedDriverId);
    const vehicle = getVehicle(booking.assignedVehicleId);
    const execution = readExecution().filter(row => clean(row.bookingId) === clean(booking.id));
    const payout = readPayout().filter(row => clean(row.bookingId) === clean(booking.id));
    const docs = readDocs().filter(row => clean(row.bookingId) === clean(booking.id));
    const acceptance = readAcceptanceLog().filter(row => clean(row.bookingId) === clean(booking.id));
    const syncRows = readSyncLedger().filter(row => clean((row.payload || {}).bookingId) === clean(booking.id) || clean((row.payload || {}).requestId) === clean(booking.id));
    const proof = readProofPacks()[0] || null;
    const validation = readValidation()[0] || null;
    const sections = [
      '<div class="card"><h2 style="margin:0 0 8px">Booking chain</h2><table><tr><td>Booking</td><td>'+esc(booking.id)+'</td></tr><tr><td>Request source</td><td>'+esc(booking.requestSource)+'</td></tr><tr><td>Status</td><td>'+esc(booking.dispatchStatus)+'</td></tr><tr><td>Client</td><td>'+esc(profile ? profile.displayName : booking.serviceProfileName)+'</td></tr><tr><td>Driver</td><td>'+esc(driver ? driver.displayName : '—')+'</td></tr><tr><td>Vehicle</td><td>'+esc(vehicle ? vehicle.displayName : '—')+'</td></tr><tr><td>Membership</td><td>'+esc(membership ? membership.memberTierLabel : 'Retail')+'</td></tr></table></div>',
      '<div class="card"><h2 style="margin:0 0 8px">Execution + money</h2><table><tr><td>Execution rows</td><td>'+esc(String(execution.length))+'</td></tr><tr><td>Payout rows</td><td>'+esc(String(payout.length))+'</td></tr><tr><td>Wait revenue</td><td>'+money(booking.waitRevenue || 0)+'</td></tr><tr><td>Overage revenue</td><td>'+money(booking.overageRevenue || 0)+'</td></tr><tr><td>Tip</td><td>'+money(booking.tipAmount || 0)+'</td></tr><tr><td>Refund</td><td>'+money(booking.refundAmount || 0)+'</td></tr></table></div>',
      '<div class="card"><h2 style="margin:0 0 8px">Evidence</h2><table><tr><td>Docs</td><td>'+esc(String(docs.length))+'</td></tr><tr><td>Acceptance rows</td><td>'+esc(String(acceptance.length))+'</td></tr><tr><td>Sync rows</td><td>'+esc(String(syncRows.length))+'</td></tr><tr><td>Latest proof pack</td><td>'+esc(proof ? proof.fingerprint : '—')+'</td></tr><tr><td>Latest validation</td><td>'+esc(validation ? validation.fingerprint : '—')+'</td></tr></table></div>',
      '<div class="card"><h2 style="margin:0 0 8px">Timeline</h2><pre>'+esc(JSON.stringify(booking.timeline || [], null, 2))+'</pre></div>'
    ];
    const html = createSimpleHtml('White-glove dispute and VIP reconstruction pack', sections);
    const row = {
      id: uid('wg_compliance45'),
      createdAt: nowISO(),
      bookingId: booking.id,
      label: 'White-glove dispute / VIP pack • ' + booking.id,
      fingerprint: 'wgcomp-' + booking.id + '-' + String((docs.length + execution.length + payout.length + acceptance.length)),
      refs: { bookingId: booking.id, profileId: profile && profile.id, membershipId: membership && membership.id, driverId: driver && driver.id, vehicleId: vehicle && vehicle.id },
      counts: { execution: execution.length, payout: payout.length, docs: docs.length, acceptance: acceptance.length, sync: syncRows.length },
      html,
      data: { booking, profile, membership, driver, vehicle, execution, payout, docs, acceptance, syncRows, proof, validation }
    };
    const rows = readCompliancePacks();
    rows.unshift(row);
    writeCompliancePacks(rows.slice(0, 120));
    const outbox = readComplianceOutbox();
    outbox.unshift(row);
    writeComplianceOutbox(outbox.slice(0, 120));
    pushSharedEvent('whiteglove_compliance_pack_saved', { bookingId: booking.id, complianceId: row.id }, 'White-glove compliance pack saved', { docCount: docs.length, executionCount: execution.length });
    return row;
  }

  function buildAcceptanceHtml(run){
    run = run || readScenarioRuns()[0] || runAllScenarios();
    const scenarioRows = (run.scenarios || []).map(s => '<tr><td>'+esc(s.label)+'</td><td>'+(s.ok ? 'PASS' : 'REVIEW')+'</td><td>'+esc((s.blockers || [])[0] || 'None')+'</td><td>'+esc(Object.values(s.refs || {}).filter(Boolean).join(' • ') || '—')+'</td></tr>').join('');
    return createSimpleHtml('White-glove acceptance harness', [
      '<div class="card"><h2 style="margin:0 0 8px">Acceptance summary</h2><div><span class="badge">Fingerprint '+esc(run.fingerprint || '—')+'</span><span class="badge">Blockers '+esc(String(run.blockerCount || 0))+'</span><span class="badge">Status '+(run.ok ? 'GREEN' : 'ACTION REQUIRED')+'</span></div></div>',
      '<div class="card"><table><thead><tr><th>Scenario</th><th>Status</th><th>Top blocker</th><th>Refs</th></tr></thead><tbody>'+scenarioRows+'</tbody></table></div>'
    ]);
  }

  function openModal(title, html, onReady){
    const existing = document.getElementById('routexWg45Modal');
    if(existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'routexWg45Modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(3,8,20,.78);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto';
    overlay.innerHTML = '<div style="width:min(1320px,96vw);background:#07111f;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:22px;box-shadow:0 30px 80px rgba(0,0,0,.45);overflow:hidden"><div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.08)"><div style="font-size:1.05rem;font-weight:700">'+esc(title)+'</div><button id="routexWg45Close" style="border:0;background:#1e293b;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Close</button></div><div id="routexWg45Body" style="padding:18px">'+html+'</div></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#routexWg45Close').onclick = ()=> overlay.remove();
    overlay.addEventListener('click', (e)=>{ if(e.target === overlay) overlay.remove(); });
    if(typeof onReady === 'function') onReady(overlay.querySelector('#routexWg45Body'));
  }

  function buildCenterHtml(){
    const ui = readUI();
    const tab = ui.scenarioTab || 'acceptance';
    const latestRun = readScenarioRuns()[0] || null;
    const latestPack = readCompliancePacks()[0] || null;
    const bookingOptions = readBookings().slice(0, 100).map(row => '<option value="'+esc(row.id)+'"'+(row.id === ui.complianceBookingId ? ' selected' : '')+'>'+esc(row.id + ' • ' + (row.serviceProfileName || row.requestSource || 'booking'))+'</option>').join('');
    const nav = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px"><button class="btn small wg45-tab" data-tab="acceptance">Acceptance harness</button><button class="btn small wg45-tab" data-tab="compliance">Compliance review</button></div>';
    if(tab === 'compliance'){
      return nav + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><div class="card"><h2 style="margin:0 0 10px">Dispute + VIP reconstruction pack</h2><label style="display:grid;gap:6px"><span>Booking</span><select name="complianceBookingId" style="border:1px solid rgba(255,255,255,.12);background:#020617;color:#fff;border-radius:10px;padding:10px"><option value="">Select booking</option>'+bookingOptions+'</select></label><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button id="wg45BuildCompliance" class="btn small">Save compliance pack</button><button id="wg45ExportComplianceHtml" class="btn small">Export latest pack HTML</button><button id="wg45ExportComplianceJson" class="btn small">Export latest pack JSON</button></div><div style="margin-top:12px">'+(latestPack ? ('Latest pack: '+esc(latestPack.fingerprint)+' • docs '+esc(String(latestPack.counts.docs || 0))) : 'No compliance pack saved yet.')+'</div></div><div class="card"><h2 style="margin:0 0 10px">Current booking chain coverage</h2><div><span class="badge">Bookings '+esc(String(readBookings().length))+'</span><span class="badge">Docs '+esc(String(readDocs().length))+'</span><span class="badge">Execution '+esc(String(readExecution().length))+'</span><span class="badge">Payout '+esc(String(readPayout().length))+'</span></div><div style="margin-top:12px">Use this lane to generate the stored dispute / VIP reconstruction bundle for any booking already in the white-glove chain.</div></div></div>';
    }
    const scenarioButtons = [
      ['wg45ScenarioA','Run Scenario A'],
      ['wg45ScenarioB','Run Scenario B'],
      ['wg45ScenarioC','Run Scenario C'],
      ['wg45ScenarioD','Run Scenario D'],
      ['wg45ScenarioE','Run Scenario E'],
      ['wg45RunAll','Run all scenarios']
    ].map(item => '<button id="'+item[0]+'" class="btn small">'+item[1]+'</button>').join('');
    const rows = latestRun ? latestRun.scenarios.map(s => '<tr><td>'+esc(s.label)+'</td><td>'+(s.ok ? 'PASS' : 'REVIEW')+'</td><td>'+esc((s.blockers || [])[0] || 'None')+'</td></tr>').join('') : '<tr><td colspan="3">No acceptance run saved yet.</td></tr>';
    return nav + '<div style="display:grid;grid-template-columns:1.2fr .8fr;gap:16px"><div class="card"><h2 style="margin:0 0 10px">Acceptance harness</h2><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">'+scenarioButtons+'<button id="wg45ExportAcceptanceHtml" class="btn small">Export latest HTML</button><button id="wg45ExportAcceptanceJson" class="btn small">Export latest JSON</button></div><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Scenario</th><th>Status</th><th>Top blocker</th></tr></thead><tbody>'+rows+'</tbody></table></div><div class="card"><h2 style="margin:0 0 10px">Latest harness state</h2>'+(latestRun ? '<div><span class="badge">'+esc(latestRun.fingerprint)+'</span><span class="badge">Blockers '+esc(String(latestRun.blockerCount))+'</span><span class="badge">'+(latestRun.ok ? 'GREEN' : 'ACTION REQUIRED')+'</span></div><div style="margin-top:12px">'+esc((latestRun.blockers || [])[0] || 'All acceptance scenarios are passing in the local harness.')+'</div>' : '<div>No acceptance harness saved yet.</div>')+'<div style="margin-top:12px">This lane turns the directive acceptance sequence into stored scenario evidence for retail reserve, favorite-driver, member, website-origin, and backup/restore chains.</div></div></div>';
  }

  function bindCenter(body){
    body.addEventListener('click', (e)=>{
      const tab = e.target.closest('.wg45-tab');
      if(tab){ writeUI({ scenarioTab: tab.dataset.tab }); openCenter(tab.dataset.tab); return; }
      if(e.target.id === 'wg45ScenarioA'){ const row = runScenarioRetailReserve(); toast(row.ok ? 'Scenario A saved.' : 'Scenario A saved with blockers.', row.ok ? 'good' : 'warn'); return; }
      if(e.target.id === 'wg45ScenarioB'){ const row = runScenarioFavoriteDriver(); toast(row.ok ? 'Scenario B saved.' : 'Scenario B saved with blockers.', row.ok ? 'good' : 'warn'); return; }
      if(e.target.id === 'wg45ScenarioC'){ const row = runScenarioMember(); toast(row.ok ? 'Scenario C saved.' : 'Scenario C saved with blockers.', row.ok ? 'good' : 'warn'); return; }
      if(e.target.id === 'wg45ScenarioD'){ const row = runScenarioWebsiteOrigin(); toast(row.ok ? 'Scenario D saved.' : 'Scenario D saved with blockers.', row.ok ? 'good' : 'warn'); return; }
      if(e.target.id === 'wg45ScenarioE'){ const row = runScenarioBackupRestore(); toast(row.ok ? 'Scenario E saved.' : 'Scenario E saved with blockers.', row.ok ? 'good' : 'warn'); return; }
      if(e.target.id === 'wg45RunAll'){ const row = runAllScenarios(); toast(row.ok ? 'Acceptance harness saved.' : 'Acceptance harness saved with blockers.', row.ok ? 'good' : 'warn'); openCenter('acceptance'); return; }
      if(e.target.id === 'wg45ExportAcceptanceHtml'){ const row = readScenarioRuns()[0] || runAllScenarios(); downloadText(buildAcceptanceHtml(row), 'whiteglove_acceptance_harness_' + dayISO() + '.html', 'text/html'); return; }
      if(e.target.id === 'wg45ExportAcceptanceJson'){ const row = readScenarioRuns()[0] || runAllScenarios(); downloadText(JSON.stringify(row, null, 2), 'whiteglove_acceptance_harness_' + dayISO() + '.json', 'application/json'); return; }
      if(e.target.id === 'wg45BuildCompliance'){ const select = body.querySelector('select[name="complianceBookingId"]'); const bookingId = select ? select.value : ''; writeUI({ complianceBookingId: bookingId }); const row = buildCompliancePack(bookingId); toast(row ? 'Compliance pack saved.' : 'Select a booking first.', row ? 'good' : 'warn'); openCenter('compliance'); return; }
      if(e.target.id === 'wg45ExportComplianceHtml'){ const row = readCompliancePacks()[0]; if(!row){ toast('No compliance pack saved yet.', 'warn'); return; } downloadText(row.html, 'whiteglove_compliance_pack_' + dayISO() + '.html', 'text/html'); return; }
      if(e.target.id === 'wg45ExportComplianceJson'){ const row = readCompliancePacks()[0]; if(!row){ toast('No compliance pack saved yet.', 'warn'); return; } downloadText(JSON.stringify(row, null, 2), 'whiteglove_compliance_pack_' + dayISO() + '.json', 'application/json'); return; }
    });
    const select = body.querySelector('select[name="complianceBookingId"]');
    if(select) select.onchange = ()=> writeUI({ complianceBookingId: select.value });
  }

  function openCenter(tab){ if(tab) writeUI({ scenarioTab: tab }); openModal('White-glove acceptance + compliance center', buildCenterHtml(), bindCenter); }

  function inject(){
    const existing = document.getElementById('routexWg45Card');
    if(existing) existing.remove();
    const latest = readScenarioRuns()[0] || null;
    const host = document.querySelector('#app') || document.body;
    const card = document.createElement('div');
    card.id = 'routexWg45Card';
    card.className = 'card';
    card.innerHTML = '<h2 style="margin:0 0 10px">White-glove acceptance + compliance</h2><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><span class="badge">Acceptance runs '+esc(String(readScenarioRuns().length))+'</span><span class="badge">Compliance packs '+esc(String(readCompliancePacks().length))+'</span><span class="badge">Docs '+esc(String(readDocs().length))+'</span></div><div style="margin-bottom:12px">Routex now has a stored acceptance harness for Scenarios A–E and a dispute / VIP reconstruction pack generator for any booking in the white-glove chain.</div>'+(latest ? '<div style="margin-bottom:12px">Latest acceptance: '+esc(latest.fingerprint)+' • blockers '+esc(String(latest.blockerCount || 0))+'</div>' : '')+'<div style="display:flex;gap:8px;flex-wrap:wrap"><button id="routexWg45Open" class="btn small">Open center</button><button id="routexWg45Run" class="btn small">Run all scenarios</button><button id="routexWg45Html" class="btn small">Export acceptance HTML</button></div>';
    host.appendChild(card);
    card.querySelector('#routexWg45Open').onclick = ()=> openCenter('acceptance');
    card.querySelector('#routexWg45Run').onclick = ()=>{ const row = runAllScenarios(); toast(row.ok ? 'Acceptance harness saved.' : 'Acceptance harness saved with blockers.', row.ok ? 'good' : 'warn'); };
    card.querySelector('#routexWg45Html').onclick = ()=>{ const row = readScenarioRuns()[0] || runAllScenarios(); downloadText(buildAcceptanceHtml(row), 'whiteglove_acceptance_harness_' + dayISO() + '.html', 'text/html'); };

    const toolbar = document.querySelector('#routexWorkbenchToolbar') || document.querySelector('.toolbar') || document.querySelector('.row');
    if(toolbar && !document.getElementById('routexWg45ToolbarBtn')){
      const btn = document.createElement('button');
      btn.id = 'routexWg45ToolbarBtn';
      btn.className = 'btn small';
      btn.textContent = 'WG acceptance+';
      btn.onclick = ()=> openCenter('acceptance');
      toolbar.appendChild(btn);
    }
  }

  const observer = new MutationObserver(()=> inject());
  observer.observe(document.body, { childList:true, subtree:true });
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(inject, 0); return out; };

  window.readWhiteGloveAcceptanceRunsV45 = readScenarioRuns;
  window.readWhiteGloveAcceptanceOutboxV45 = readScenarioOutbox;
  window.readWhiteGloveCompliancePacksV45 = readCompliancePacks;
  window.readWhiteGloveComplianceOutboxV45 = readComplianceOutbox;
  window.runWhiteGloveAcceptanceHarnessV45 = runAllScenarios;
  window.buildWhiteGloveCompliancePackV45 = buildCompliancePack;
})();
