/* V39 Routex white-glove fleet infrastructure foundation */
(function(){
  if(window.__ROUTEX_WHITEGLOVE_V39__) return;
  window.__ROUTEX_WHITEGLOVE_V39__ = true;

  const KEYS = {
    profiles: 'skye_whiteglove_service_profiles_v39',
    drivers: 'skye_whiteglove_driver_profiles_v39',
    vehicles: 'skye_whiteglove_vehicle_profiles_v39',
    memberships: 'skye_whiteglove_memberships_v39',
    bookings: 'skye_whiteglove_bookings_v39',
    events: 'skye_whiteglove_events_v39',
    pricing: 'skye_whiteglove_pricing_catalog_v39',
    outbox: 'skye_whiteglove_sync_outbox_v39',
    docs: 'skye_whiteglove_docs_v39',
    ui: 'skye_whiteglove_ui_state_v39'
  };

  const CANON = {
    bookingStatus: ['requested','quoted','confirmed','assigned','en_route','arrived','rider_boarded','in_service','completed','cancelled','no_show'],
    serviceProfileType: ['individual','household','business','vip','medical','executive'],
    serviceType: ['now','reserve','airport','errand','hourly_standby','recurring'],
    favoriteDriverState: ['preferred','matched','unavailable','overridden_by_dispatch'],
    membershipPlanType: ['access_only','monthly_included_hours','monthly_included_hours_and_miles','corporate_retainer'],
    requestSource: ['website','operator','imported','phone','returning_member','concierge'],
    vehicleClass: ['sedan','suv','xl','specialty']
  };

  const MARKET_MULTIPLIERS = { phoenix:1, glendale:0.98, scottsdale:1.16, mesa:1.01, valley_wide:1.12 };
  const DEFAULT_CATALOG = [
    { id:'reserve-sedan', label:'Reserve sedan', serviceType:'reserve', vehicleClass:'sedan', market:'phoenix', hourlyMinimum:1, baseRate:78, includedMilesPerHour:29, extraMileRate:0.85, waitPerHour:31, rushFee:14 },
    { id:'now-sedan', label:'Now sedan', serviceType:'now', vehicleClass:'sedan', market:'phoenix', hourlyMinimum:1, baseRate:84, includedMilesPerHour:29, extraMileRate:0.95, waitPerHour:34, rushFee:18 },
    { id:'reserve-suv', label:'Reserve suv', serviceType:'reserve', vehicleClass:'suv', market:'phoenix', hourlyMinimum:1, baseRate:102, includedMilesPerHour:29, extraMileRate:1.05, waitPerHour:38, rushFee:18 },
    { id:'now-suv', label:'Now suv', serviceType:'now', vehicleClass:'suv', market:'phoenix', hourlyMinimum:1, baseRate:112, includedMilesPerHour:29, extraMileRate:1.15, waitPerHour:42, rushFee:24 },
    { id:'airport-meet', label:'Airport meet/greet', serviceType:'airport', vehicleClass:'sedan', market:'phoenix', hourlyMinimum:1, baseRate:96, includedMilesPerHour:34, extraMileRate:0.95, waitPerHour:32, rushFee:15 },
    { id:'errand-assist', label:'Errand / grocery assist', serviceType:'errand', vehicleClass:'suv', market:'phoenix', hourlyMinimum:1, baseRate:88, includedMilesPerHour:24, extraMileRate:0.9, waitPerHour:33, rushFee:12 },
    { id:'hourly-standby', label:'Hourly standby', serviceType:'hourly_standby', vehicleClass:'sedan', market:'phoenix', hourlyMinimum:2, baseRate:76, includedMilesPerHour:24, extraMileRate:0.85, waitPerHour:30, rushFee:0 },
    { id:'recurring-block', label:'Recurring ride block', serviceType:'recurring', vehicleClass:'sedan', market:'phoenix', hourlyMinimum:1, baseRate:72, includedMilesPerHour:29, extraMileRate:0.82, waitPerHour:29, rushFee:0 }
  ];

  const clean = (v)=> String(v == null ? '' : v).trim();
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  const downloadText = window.downloadText || function(content, filename, type){
    const blob = new Blob([content], { type:type || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename || 'download.txt'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 1200);
  };
  const toast = window.toast || function(){};
  const nowISO = ()=> new Date().toISOString();
  const dayISO = ()=> nowISO().slice(0,10);
  const uid = (p)=> (p || 'id') + '_' + Math.random().toString(36).slice(2,10) + '_' + Date.now().toString(36);
  const money = (n)=> '$' + Number(n || 0).toFixed(2);

  function readJSON(key, fallback){
    try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; }
  }
  function writeJSON(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){ }
    return value;
  }
  const readProfiles = ()=> readJSON(KEYS.profiles, []);
  const readDrivers = ()=> readJSON(KEYS.drivers, []);
  const readVehicles = ()=> readJSON(KEYS.vehicles, []);
  const readMemberships = ()=> readJSON(KEYS.memberships, []);
  const readBookings = ()=> readJSON(KEYS.bookings, []);
  const readEvents = ()=> readJSON(KEYS.events, []);
  const readDocs = ()=> readJSON(KEYS.docs, []);
  const readOutbox = ()=> readJSON(KEYS.outbox, []);
  const readUI = ()=> readJSON(KEYS.ui, { tab:'overview' });
  const readPricing = ()=> {
    const rows = readJSON(KEYS.pricing, null);
    if(rows && rows.length) return rows;
    writeJSON(KEYS.pricing, DEFAULT_CATALOG);
    return DEFAULT_CATALOG.slice();
  };

  function writeProfiles(rows){ return writeJSON(KEYS.profiles, rows); }
  function writeDrivers(rows){ return writeJSON(KEYS.drivers, rows); }
  function writeVehicles(rows){ return writeJSON(KEYS.vehicles, rows); }
  function writeMemberships(rows){ return writeJSON(KEYS.memberships, rows); }
  function writeBookings(rows){ return writeJSON(KEYS.bookings, rows); }
  function writeEvents(rows){ return writeJSON(KEYS.events, rows); }
  function writeDocs(rows){ return writeJSON(KEYS.docs, rows); }
  function writeOutbox(rows){ return writeJSON(KEYS.outbox, rows); }
  function writeUI(patch){ return writeJSON(KEYS.ui, Object.assign({}, readUI(), patch || {})); }
  function writePricing(rows){ return writeJSON(KEYS.pricing, rows); }

  function writeEvent(type, refs, note, extra){
    const rows = readEvents();
    const row = Object.assign({
      id: uid('wg_evt'),
      type: clean(type),
      refs: refs || {},
      note: clean(note),
      createdAt: nowISO()
    }, extra || {});
    rows.unshift(row);
    writeEvents(rows.slice(0, 500));
    return row;
  }

  function upsertDoc(type, title, html, meta){
    const rows = readDocs();
    const row = {
      id: uid('wg_doc'),
      type: clean(type),
      title: clean(title) || type,
      html: html || '',
      meta: meta || {},
      createdAt: nowISO()
    };
    rows.unshift(row);
    writeDocs(rows.slice(0, 200));
    return row;
  }

  function queueOutbox(kind, payload){
    const rows = readOutbox();
    const row = {
      id: uid('wg_sync'),
      kind: clean(kind) || 'whiteglove',
      status: 'queued',
      payload: payload || {},
      createdAt: nowISO(),
      updatedAt: nowISO(),
      retryCount: 0,
      note: ''
    };
    rows.unshift(row);
    writeOutbox(rows.slice(0, 300));
    return row;
  }

  function updateOutbox(id, patch){
    const rows = readOutbox().map(row => row.id === id ? Object.assign({}, row, patch || {}, { updatedAt: nowISO() }) : row);
    writeOutbox(rows);
    return rows.find(row => row.id === id) || null;
  }

  function statusIndex(status){
    const idx = CANON.bookingStatus.indexOf(status);
    return idx === -1 ? 0 : idx;
  }
  function nextStatus(current){
    const idx = statusIndex(current);
    return CANON.bookingStatus[Math.min(idx + 1, CANON.bookingStatus.length - 1)];
  }

  function getProfile(id){ return readProfiles().find(row => row.id === id) || null; }
  function getDriver(id){ return readDrivers().find(row => row.id === id) || null; }
  function getVehicle(id){ return readVehicles().find(row => row.id === id) || null; }
  function getMembership(id){ return readMemberships().find(row => row.id === id) || null; }
  function getBooking(id){ return readBookings().find(row => row.id === id) || null; }

  function marketFactor(market){ return MARKET_MULTIPLIERS[clean(market).toLowerCase()] || 1; }
  function findCatalogEntry(serviceType, vehicleClass){
    const rows = readPricing();
    return rows.find(row => row.serviceType === serviceType && row.vehicleClass === vehicleClass) || rows.find(row => row.serviceType === serviceType) || rows[0];
  }

  function buildPricingSnapshot(input){
    const entry = findCatalogEntry(input.serviceType, input.vehicleClass);
    const factor = marketFactor(input.market);
    const bookedHours = Math.max(Number(input.bookedHours || 1), Number(entry.hourlyMinimum || 1));
    const requestedMiles = Math.max(Number(input.requestedMiles || 0), 0);
    const includedMiles = bookedHours * Number(entry.includedMilesPerHour || 0);
    const overMiles = Math.max(0, requestedMiles - includedMiles);
    const rush = input.sameDay ? Number(entry.rushFee || 0) : 0;
    const baseRate = Number(entry.baseRate || 0) * factor;
    const extraMileRate = Number(entry.extraMileRate || 0) * factor;
    const waitPerHour = Number(entry.waitPerHour || 0) * factor;
    const subtotal = (bookedHours * baseRate) + (overMiles * extraMileRate) + rush;
    const override = clean(input.manualOverrideNote) ? Number(input.overrideTotal || subtotal) : subtotal;
    return {
      version: 'whiteglove_pricing_v39',
      catalogId: entry.id,
      catalogLabel: entry.label,
      serviceType: input.serviceType,
      vehicleClass: input.vehicleClass,
      market: input.market,
      marketFactor: factor,
      bookedHours,
      requestedMiles,
      includedMiles,
      extraMiles: overMiles,
      baseRate: Number(baseRate.toFixed(2)),
      extraMileRate: Number(extraMileRate.toFixed(2)),
      waitPerHour: Number(waitPerHour.toFixed(2)),
      rushFee: Number(rush.toFixed(2)),
      subtotal: Number(subtotal.toFixed(2)),
      quotedTotal: Number(override.toFixed(2)),
      manualOverrideNote: clean(input.manualOverrideNote),
      pricingTier: entry.label,
      frozenAt: nowISO()
    };
  }

  function computeFavoriteState(profile, driver, assignedByDispatch){
    const favorites = (profile && Array.isArray(profile.favoriteDriverIds)) ? profile.favoriteDriverIds : [];
    if(!favorites.length) return '';
    if(driver && favorites.includes(driver.id)) return 'matched';
    if(driver && !favorites.includes(driver.id) && assignedByDispatch) return 'overridden_by_dispatch';
    const favoriteDriver = favorites.map(getDriver).find(Boolean);
    if(favoriteDriver && favoriteDriver.status !== 'active') return 'unavailable';
    return 'preferred';
  }

  function addServiceProfile(payload){
    const rows = readProfiles();
    const row = {
      id: uid('svc'),
      profileType: CANON.serviceProfileType.includes(payload.profileType) ? payload.profileType : 'individual',
      displayName: clean(payload.displayName),
      legalName: clean(payload.legalName),
      primaryPhone: clean(payload.primaryPhone),
      alternatePhone: clean(payload.alternatePhone),
      email: clean(payload.email),
      addresses: clean(payload.addresses).split('\n').map(v => clean(v)).filter(Boolean),
      preferredZone: clean(payload.preferredZone),
      serviceArea: clean(payload.serviceArea),
      mobilityFlags: clean(payload.mobilityFlags).split(',').map(v => clean(v)).filter(Boolean),
      assistanceNotes: clean(payload.assistanceNotes),
      accessNotes: clean(payload.accessNotes),
      favoriteDriverIds: clean(payload.favoriteDriverIds).split(',').map(v => clean(v)).filter(Boolean),
      householdAuthorizedRiders: clean(payload.householdAuthorizedRiders).split('\n').map(v => clean(v)).filter(Boolean),
      membershipId: clean(payload.membershipId),
      billingPreference: clean(payload.billingPreference),
      receiptDestination: clean(payload.receiptDestination),
      riderPreferences: {
        temperature: clean(payload.temperature),
        music: clean(payload.music),
        quietRide: !!payload.quietRide,
        luggageHelp: !!payload.luggageHelp,
        groceryHelp: !!payload.groceryHelp,
        callTextPreference: clean(payload.callTextPreference)
      },
      whiteGloveHistory: [],
      notesHistory: clean(payload.notesHistory) ? [{ at: nowISO(), note: clean(payload.notesHistory) }] : [],
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    rows.unshift(row);
    writeProfiles(rows);
    writeEvent('service_profile_created', { serviceProfileId: row.id }, 'Service profile created', { profileType: row.profileType, displayName: row.displayName });
    return row;
  }

  function addDriver(payload){
    const rows = readDrivers();
    const row = {
      id: uid('drv'),
      displayName: clean(payload.displayName),
      status: clean(payload.status) || 'active',
      vehiclePermissions: clean(payload.vehiclePermissions).split(',').map(v => clean(v)).filter(Boolean),
      marketsServed: clean(payload.marketsServed).split(',').map(v => clean(v)).filter(Boolean),
      shiftWindows: clean(payload.shiftWindows),
      blackoutWindows: clean(payload.blackoutWindows),
      assistCapabilities: clean(payload.assistCapabilities).split(',').map(v => clean(v)).filter(Boolean),
      payoutModel: clean(payload.payoutModel),
      qualityScore: Number(payload.qualityScore || 5),
      incidentCount: Number(payload.incidentCount || 0),
      favoriteCount: 0,
      preferredRiderCount: 0,
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    rows.unshift(row);
    writeDrivers(rows);
    writeEvent('driver_profile_created', { driverId: row.id }, 'Driver profile created', { driver: row.displayName });
    return row;
  }

  function addVehicle(payload){
    const rows = readVehicles();
    const row = {
      id: uid('veh'),
      displayName: clean(payload.displayName),
      vehicleClass: CANON.vehicleClass.includes(payload.vehicleClass) ? payload.vehicleClass : 'sedan',
      seatCount: Number(payload.seatCount || 4),
      cargoNotes: clean(payload.cargoNotes),
      mpg: Number(payload.mpg || 0),
      costModel: clean(payload.costModel),
      fuelType: clean(payload.fuelType),
      whiteGloveTags: clean(payload.whiteGloveTags).split(',').map(v => clean(v)).filter(Boolean),
      serviceDue: clean(payload.serviceDue),
      market: clean(payload.market),
      dispatchEligible: payload.dispatchEligible !== false,
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    rows.unshift(row);
    writeVehicles(rows);
    writeEvent('vehicle_profile_created', { vehicleId: row.id }, 'Vehicle profile created', { vehicle: row.displayName });
    return row;
  }

  function addMembership(payload){
    const rows = readMemberships();
    const row = {
      id: uid('mem'),
      serviceProfileId: clean(payload.serviceProfileId),
      planType: CANON.membershipPlanType.includes(payload.planType) ? payload.planType : 'monthly_included_hours_and_miles',
      cadence: clean(payload.cadence) || 'monthly',
      activeStart: clean(payload.activeStart) || dayISO(),
      activeEnd: clean(payload.activeEnd),
      includedHours: Number(payload.includedHours || 0),
      includedMiles: Number(payload.includedMiles || 0),
      remainingHours: Number(payload.includedHours || 0),
      remainingMiles: Number(payload.includedMiles || 0),
      memberTierLabel: clean(payload.memberTierLabel),
      rolloverRule: clean(payload.rolloverRule),
      householdRiderCap: Number(payload.householdRiderCap || 0),
      status: clean(payload.status) || 'active',
      renewalNote: clean(payload.renewalNote),
      failureNote: clean(payload.failureNote),
      manualOverrideNote: clean(payload.manualOverrideNote),
      usageLedger: [],
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    rows.unshift(row);
    writeMemberships(rows);
    writeEvent('membership_created', { membershipId: row.id, serviceProfileId: row.serviceProfileId }, 'Membership created', { planType: row.planType });
    const profiles = readProfiles();
    const target = profiles.find(p => p.id === row.serviceProfileId);
    if(target){
      target.membershipId = row.id; target.updatedAt = nowISO();
      writeProfiles(profiles);
    }
    return row;
  }

  function createBooking(payload){
    const rows = readBookings();
    const profile = getProfile(clean(payload.serviceProfileId));
    const membership = getMembership(clean(payload.membershipId || (profile && profile.membershipId)));
    const pricingSnapshot = buildPricingSnapshot(payload);
    const favoriteState = computeFavoriteState(profile, null, false);
    const routeRef = uid('route');
    const stopRef = uid('stop');
    const row = {
      id: uid('bk'),
      requestSource: CANON.requestSource.includes(payload.requestSource) ? payload.requestSource : 'operator',
      serviceType: CANON.serviceType.includes(payload.serviceType) ? payload.serviceType : 'reserve',
      serviceProfileId: clean(payload.serviceProfileId),
      serviceProfileName: profile ? profile.displayName : clean(payload.serviceProfileName),
      market: clean(payload.market) || 'phoenix',
      zone: clean(payload.zone),
      pricingTier: pricingSnapshot.pricingTier,
      pricingVersion: pricingSnapshot.version,
      pricingSnapshot,
      billingMode: clean(payload.billingMode) || (membership ? 'included_block' : 'retail'),
      membershipId: membership ? membership.id : '',
      membershipName: membership ? membership.memberTierLabel : '',
      hourlyMinimum: pricingSnapshot.bookedHours,
      includedMilesBundle: pricingSnapshot.includedMiles,
      overageRule: money(pricingSnapshot.extraMileRate) + ' per extra mile',
      waitRule: money(pricingSnapshot.waitPerHour) + ' per standby hour',
      assignedDriverId: '',
      assignedVehicleId: '',
      dispatchStatus: 'requested',
      favoriteDriverState: favoriteState,
      favoriteDriverIds: profile ? profile.favoriteDriverIds || [] : [],
      routeLink: routeRef,
      routeStopLink: stopRef,
      etaWindow: clean(payload.etaWindow),
      pickupAddress: clean(payload.pickupAddress),
      dropoffAddress: clean(payload.dropoffAddress),
      riderNotes: clean(payload.riderNotes),
      operatorNotes: clean(payload.operatorNotes),
      whiteGloveNotes: clean(payload.whiteGloveNotes),
      timeline: [{ status:'requested', at: nowISO(), note:'Booking created' }],
      assistanceEvents: [],
      serviceRating: 0,
      actualUsageHours: 0,
      actualUsageMiles: 0,
      payout: null,
      receiptId: '',
      serviceSummaryDocId: '',
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    rows.unshift(row);
    writeBookings(rows);
    writeEvent('booking_created', { bookingId: row.id, serviceProfileId: row.serviceProfileId }, 'Booking created', { source: row.requestSource, serviceType: row.serviceType, quotedTotal: row.pricingSnapshot.quotedTotal });
    if(row.requestSource === 'website' || row.requestSource === 'returning_member'){
      queueOutbox('website_booking_sync', { bookingId: row.id, source: row.requestSource, bookingStatus: row.dispatchStatus, pricingSnapshot: row.pricingSnapshot });
    }
    return row;
  }

  function updateBooking(id, mutator){
    const rows = readBookings();
    const idx = rows.findIndex(row => row.id === id);
    if(idx === -1) return null;
    const next = mutator ? mutator(Object.assign({}, rows[idx])) : rows[idx];
    next.updatedAt = nowISO();
    rows[idx] = next;
    writeBookings(rows);
    return next;
  }

  function assignBooking(id, driverId, vehicleId){
    const booking = updateBooking(id, row => {
      const driver = getDriver(driverId);
      const vehicle = getVehicle(vehicleId);
      row.assignedDriverId = driver ? driver.id : row.assignedDriverId;
      row.assignedVehicleId = vehicle ? vehicle.id : row.assignedVehicleId;
      row.dispatchStatus = 'assigned';
      row.favoriteDriverState = computeFavoriteState(getProfile(row.serviceProfileId), driver, true);
      row.timeline.push({ status:'assigned', at: nowISO(), note:'Driver/vehicle assigned', driverId: row.assignedDriverId, vehicleId: row.assignedVehicleId });
      return row;
    });
    if(booking) writeEvent('booking_assigned', { bookingId:id, driverId:driverId, vehicleId:vehicleId }, 'Booking assigned', { favoriteState: booking.favoriteDriverState });
    return booking;
  }

  function advanceBookingStatus(id, explicitStatus){
    const booking = updateBooking(id, row => {
      const next = explicitStatus && CANON.bookingStatus.includes(explicitStatus) ? explicitStatus : nextStatus(row.dispatchStatus);
      row.dispatchStatus = next;
      row.timeline.push({ status:next, at: nowISO(), note:'Status advanced to ' + next });
      if(next === 'confirmed' && !row.quoteConfirmedAt) row.quoteConfirmedAt = nowISO();
      if(next === 'arrived') row.arrivalTimestamp = nowISO();
      if(next === 'rider_boarded') row.boardedTimestamp = nowISO();
      if(next === 'in_service' && !row.inServiceAt) row.inServiceAt = nowISO();
      if(next === 'completed' && !row.completedAt) row.completedAt = nowISO();
      return row;
    });
    if(booking) writeEvent('booking_status_changed', { bookingId:id }, 'Booking status -> ' + booking.dispatchStatus, { status: booking.dispatchStatus });
    return booking;
  }

  function closeBooking(id, payload){
    const booking = updateBooking(id, row => {
      row.dispatchStatus = 'completed';
      row.completedAt = nowISO();
      row.actualUsageHours = Number(payload.actualUsageHours || row.pricingSnapshot.bookedHours || 0);
      row.actualUsageMiles = Number(payload.actualUsageMiles || row.pricingSnapshot.requestedMiles || 0);
      row.assistanceEvents = [];
      if(payload.doorAssist) row.assistanceEvents.push('door_assist');
      if(payload.luggageAssist) row.assistanceEvents.push('luggage_assist');
      if(payload.groceryAssist) row.assistanceEvents.push('grocery_assist');
      if(payload.standbyUsed) row.assistanceEvents.push('standby_used');
      row.serviceRating = Number(payload.serviceRating || 0);
      row.whiteGloveNotes = [clean(row.whiteGloveNotes), clean(payload.closeoutNote)].filter(Boolean).join(' | ');
      row.timeline.push({ status:'completed', at: nowISO(), note:'Booking closed', usageHours: row.actualUsageHours, usageMiles: row.actualUsageMiles });
      const overtimeMiles = Math.max(0, row.actualUsageMiles - row.pricingSnapshot.includedMiles);
      const waitCharge = (payload.standbyUsed ? Number(payload.standbyHours || 0) * row.pricingSnapshot.waitPerHour : 0);
      const overage = overtimeMiles * row.pricingSnapshot.extraMileRate;
      row.finalEconomics = {
        recognizedRevenue: Number((row.pricingSnapshot.quotedTotal + waitCharge + overage).toFixed(2)),
        overtimeMiles,
        waitCharge: Number(waitCharge.toFixed(2)),
        overageRevenue: Number(overage.toFixed(2))
      };
      row.payout = {
        model: payload.payoutModel || 'per_service',
        amount: Number(payload.payoutAmount || 0),
        note: clean(payload.payoutNote)
      };
      return row;
    });
    if(!booking) return null;

    if(booking.membershipId && booking.billingMode === 'included_block'){
      const memberships = readMemberships();
      const idx = memberships.findIndex(row => row.id === booking.membershipId);
      if(idx !== -1){
        const row = Object.assign({}, memberships[idx]);
        row.remainingHours = Number(Math.max(0, Number(row.remainingHours || 0) - Number(booking.actualUsageHours || 0)).toFixed(2));
        row.remainingMiles = Number(Math.max(0, Number(row.remainingMiles || 0) - Number(booking.actualUsageMiles || 0)).toFixed(2));
        row.usageLedger = Array.isArray(row.usageLedger) ? row.usageLedger : [];
        row.usageLedger.unshift({
          id: uid('mem_use'),
          bookingId: booking.id,
          usedHours: booking.actualUsageHours,
          usedMiles: booking.actualUsageMiles,
          remainingHours: row.remainingHours,
          remainingMiles: row.remainingMiles,
          createdAt: nowISO()
        });
        row.updatedAt = nowISO();
        memberships[idx] = row;
        writeMemberships(memberships);
        writeEvent('membership_usage_written', { membershipId:row.id, bookingId:booking.id }, 'Membership decremented from booking closeout', { remainingHours: row.remainingHours, remainingMiles: row.remainingMiles });
      }
    }

    const receipt = buildReceiptDoc(booking.id);
    const serviceDoc = buildServiceSummaryDoc(booking.id);
    updateBooking(id, row => {
      row.receiptId = receipt ? receipt.id : row.receiptId;
      row.serviceSummaryDocId = serviceDoc ? serviceDoc.id : row.serviceSummaryDocId;
      return row;
    });
    writeEvent('booking_closed', { bookingId:id }, 'White-glove booking closed', { recognizedRevenue: booking.finalEconomics && booking.finalEconomics.recognizedRevenue });
    return getBooking(id);
  }

  function buildReceiptHtml(booking){
    const profile = getProfile(booking.serviceProfileId);
    return '<!doctype html><html><head><meta charset="utf-8"><title>White-glove receipt</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111} .badge{display:inline-block;padding:4px 8px;border:1px solid #999;border-radius:999px;margin-right:8px} table{border-collapse:collapse;width:100%;margin-top:12px} td,th{border:1px solid #ccc;padding:8px;text-align:left}</style></head><body><h1>Skye Routex White-Glove Receipt</h1><div><span class="badge">Booking '+esc(booking.id)+'</span><span class="badge">'+esc(booking.dispatchStatus)+'</span><span class="badge">'+esc(booking.serviceType)+'</span></div><p><strong>Client:</strong> '+esc((profile && profile.displayName) || booking.serviceProfileName || '—')+'<br><strong>Pickup:</strong> '+esc(booking.pickupAddress || '—')+'<br><strong>Dropoff:</strong> '+esc(booking.dropoffAddress || '—')+'</p><table><tbody><tr><th>Quoted total</th><td>'+money(booking.pricingSnapshot.quotedTotal)+'</td></tr><tr><th>Recognized revenue</th><td>'+money((booking.finalEconomics && booking.finalEconomics.recognizedRevenue) || booking.pricingSnapshot.quotedTotal)+'</td></tr><tr><th>Wait revenue</th><td>'+money((booking.finalEconomics && booking.finalEconomics.waitCharge) || 0)+'</td></tr><tr><th>Overage revenue</th><td>'+money((booking.finalEconomics && booking.finalEconomics.overageRevenue) || 0)+'</td></tr><tr><th>Billing mode</th><td>'+esc(booking.billingMode || 'retail')+'</td></tr><tr><th>Driver payout</th><td>'+money((booking.payout && booking.payout.amount) || 0)+'</td></tr></tbody></table><h2>Service notes</h2><p>'+esc(booking.whiteGloveNotes || 'No additional service note.')+'</p><h2>Assistance events</h2><p>'+esc((booking.assistanceEvents || []).join(', ') || 'None recorded')+'</p></body></html>';
  }

  function buildServiceSummaryHtml(booking){
    const driver = getDriver(booking.assignedDriverId);
    const vehicle = getVehicle(booking.assignedVehicleId);
    return '<!doctype html><html><head><meta charset="utf-8"><title>Premium service summary</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111} ul{line-height:1.6}</style></head><body><h1>Premium Service Summary</h1><ul><li><strong>Booking:</strong> '+esc(booking.id)+'</li><li><strong>Status:</strong> '+esc(booking.dispatchStatus)+'</li><li><strong>Favorite-driver state:</strong> '+esc(booking.favoriteDriverState || 'none')+'</li><li><strong>Assigned driver:</strong> '+esc((driver && driver.displayName) || 'Unassigned')+'</li><li><strong>Assigned vehicle:</strong> '+esc((vehicle && vehicle.displayName) || 'Unassigned')+'</li><li><strong>Actual usage:</strong> '+esc(String(booking.actualUsageHours || 0))+' hours / '+esc(String(booking.actualUsageMiles || 0))+' miles</li><li><strong>Assistance events:</strong> '+esc((booking.assistanceEvents || []).join(', ') || 'None recorded')+'</li><li><strong>Service rating:</strong> '+esc(String(booking.serviceRating || 0))+'</li><li><strong>White-glove notes:</strong> '+esc(booking.whiteGloveNotes || 'No additional notes')+'</li></ul><h2>Status timeline</h2><ol>'+((booking.timeline || []).map(row => '<li>'+esc(row.status)+' • '+esc(row.at)+' • '+esc(row.note || '')+'</li>').join(''))+'</ol></body></html>';
  }

  function buildReceiptDoc(bookingId){
    const booking = getBooking(bookingId);
    if(!booking) return null;
    return upsertDoc('trip_receipt_html', 'whiteglove_receipt_' + booking.id, buildReceiptHtml(booking), { bookingId: booking.id, type:'receipt' });
  }
  function buildServiceSummaryDoc(bookingId){
    const booking = getBooking(bookingId);
    if(!booking) return null;
    return upsertDoc('premium_service_summary_html', 'whiteglove_service_summary_' + booking.id, buildServiceSummaryHtml(booking), { bookingId: booking.id, type:'service_summary' });
  }

  function exportWhiteGloveJson(){
    const payload = {
      exportedAt: nowISO(),
      canon: CANON,
      profiles: readProfiles(),
      drivers: readDrivers(),
      vehicles: readVehicles(),
      memberships: readMemberships(),
      bookings: readBookings(),
      events: readEvents(),
      pricing: readPricing(),
      outbox: readOutbox(),
      docs: readDocs()
    };
    downloadText(JSON.stringify(payload, null, 2), 'skye_whiteglove_foundation_' + dayISO() + '.json', 'application/json');
  }

  function exportWhiteGloveHtml(){
    const bookings = readBookings();
    const profiles = readProfiles();
    const memberships = readMemberships();
    const html = '<!doctype html><html><head><meta charset="utf-8"><title>White-glove foundation export</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111} table{width:100%;border-collapse:collapse;margin:12px 0} td,th{border:1px solid #ccc;padding:8px;text-align:left} .badge{display:inline-block;padding:4px 8px;border:1px solid #999;border-radius:999px;margin-right:8px}</style></head><body><h1>White-Glove Foundation Export</h1><p><span class="badge">Profiles '+esc(String(profiles.length))+'</span><span class="badge">Bookings '+esc(String(bookings.length))+'</span><span class="badge">Memberships '+esc(String(memberships.length))+'</span></p><table><thead><tr><th>Booking</th><th>Client</th><th>Status</th><th>Favorite</th><th>Quoted</th><th>Recognized</th></tr></thead><tbody>'+bookings.map(b => '<tr><td>'+esc(b.id)+'</td><td>'+esc(b.serviceProfileName || '—')+'</td><td>'+esc(b.dispatchStatus)+'</td><td>'+esc(b.favoriteDriverState || '—')+'</td><td>'+money((b.pricingSnapshot && b.pricingSnapshot.quotedTotal) || 0)+'</td><td>'+money((b.finalEconomics && b.finalEconomics.recognizedRevenue) || (b.pricingSnapshot && b.pricingSnapshot.quotedTotal) || 0)+'</td></tr>').join('')+'</tbody></table></body></html>';
    downloadText(html, 'skye_whiteglove_foundation_' + dayISO() + '.html', 'text/html');
  }

  function summary(){
    const profiles = readProfiles();
    const drivers = readDrivers();
    const vehicles = readVehicles();
    const memberships = readMemberships();
    const bookings = readBookings();
    const outbox = readOutbox();
    const recognizedRevenue = bookings.reduce((sum, row) => sum + Number((row.finalEconomics && row.finalEconomics.recognizedRevenue) || (row.pricingSnapshot && row.pricingSnapshot.quotedTotal) || 0), 0);
    const matchedFavorites = bookings.filter(row => row.favoriteDriverState === 'matched').length;
    const websiteRows = bookings.filter(row => row.requestSource === 'website').length;
    return {
      profiles: profiles.length,
      drivers: drivers.length,
      vehicles: vehicles.length,
      memberships: memberships.filter(row => row.status === 'active').length,
      bookings: bookings.length,
      completed: bookings.filter(row => row.dispatchStatus === 'completed').length,
      websiteRows,
      queuedSync: outbox.filter(row => row.status === 'queued').length,
      matchedFavorites,
      recognizedRevenue: Number(recognizedRevenue.toFixed(2))
    };
  }

  function openModal(title, bodyHtml, onReady){
    const existing = document.getElementById('wgV39Modal');
    if(existing) existing.remove();
    const wrap = document.createElement('div');
    wrap.id = 'wgV39Modal';
    wrap.style.cssText = 'position:fixed;inset:0;background:rgba(4,6,10,.72);z-index:999999;display:flex;align-items:center;justify-content:center;padding:18px;';
    wrap.innerHTML = '<div style="width:min(1240px,96vw);max-height:92vh;overflow:auto;background:#0d1220;color:#f5f7fb;border:1px solid rgba(255,255,255,.12);border-radius:18px;box-shadow:0 20px 80px rgba(0,0,0,.55)"><div style="display:flex;justify-content:space-between;align-items:center;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.08)"><h2 style="margin:0;font-size:1.1rem">'+esc(title)+'</h2><button id="wgV39CloseBtn" style="border:0;background:#1f2a44;color:#fff;border-radius:10px;padding:10px 12px;cursor:pointer">Close</button></div><div id="wgV39Body" style="padding:18px">'+bodyHtml+'</div></div>';
    document.body.appendChild(wrap);
    wrap.querySelector('#wgV39CloseBtn').onclick = ()=> wrap.remove();
    wrap.addEventListener('click', (e)=>{ if(e.target === wrap) wrap.remove(); });
    if(typeof onReady === 'function') onReady(wrap.querySelector('#wgV39Body'));
  }

  function controlCenterHtml(){
    const ui = readUI();
    const tab = ui.tab || 'overview';
    const s = summary();
    const profiles = readProfiles();
    const drivers = readDrivers();
    const vehicles = readVehicles();
    const memberships = readMemberships();
    const bookings = readBookings();
    const tabs = [
      ['overview','Overview'],['profiles','Service profiles'],['drivers','Drivers + vehicles'],['pricing','Pricing + quote'],['bookings','Bookings + dispatch'],['memberships','Memberships'],['outbox','Outbox + docs']
    ];
    const nav = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">'+tabs.map(([id,label]) => '<button class="wg-v39-tab" data-tab="'+id+'" style="border:1px solid rgba(255,255,255,.12);background:'+(tab===id?'#7c3aed':'#162036')+';color:#fff;border-radius:999px;padding:8px 12px;cursor:pointer">'+esc(label)+'</button>').join('')+'</div>';
    let content = '';
    if(tab === 'overview'){
      content = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px">'
        + buildMetric('Service profiles', s.profiles)
        + buildMetric('Drivers', s.drivers)
        + buildMetric('Vehicles', s.vehicles)
        + buildMetric('Active memberships', s.memberships)
        + buildMetric('Bookings', s.bookings)
        + buildMetric('Completed', s.completed)
        + buildMetric('Website rows', s.websiteRows)
        + buildMetric('Queued sync', s.queuedSync)
        + buildMetric('Favorite matched', s.matchedFavorites)
        + buildMetric('Recognized revenue', money(s.recognizedRevenue))
        + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px">'
        + '<div style="background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0 0 8px">Canonical contracts locked</h3><ul style="margin:0;padding-left:18px;line-height:1.7"><li>Booking status map</li><li>Service profile types</li><li>Service types</li><li>Favorite-driver states</li><li>Membership plan types</li><li>Pricing snapshot schema</li></ul></div>'
        + '<div style="background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0 0 8px">Current integration surface</h3><ul style="margin:0;padding-left:18px;line-height:1.7"><li>Service profiles and household riders</li><li>Driver, vehicle, and market eligibility</li><li>Bookings, dispatch, and truthful favorite state</li><li>Membership decrement ledger</li><li>Website-origin outbox queue</li><li>Trip receipt and premium service summary docs</li></ul></div></div>';
    }
    if(tab === 'profiles'){
      content = '<div style="display:grid;grid-template-columns:minmax(320px,420px) 1fr;gap:16px"><form id="wgV39ProfileForm" style="display:grid;gap:8px;background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px">'
        + '<h3 style="margin:0">Add / extend service profile</h3>'
        + input('Display name','displayName') + input('Legal or billing name','legalName')
        + select('Profile type','profileType', CANON.serviceProfileType) + input('Primary phone','primaryPhone') + input('Alternate phone','alternatePhone') + input('Email','email')
        + textarea('Saved pickup/dropoff addresses (one per line)','addresses') + input('Preferred zone','preferredZone') + input('Service area / market','serviceArea')
        + input('Mobility / assistance flags (comma separated)','mobilityFlags') + textarea('White-glove assistance notes','assistanceNotes') + textarea('Access / gate / building notes','accessNotes')
        + input('Favorite driver IDs (comma separated)','favoriteDriverIds') + textarea('Household authorized riders (one per line)','householdAuthorizedRiders')
        + input('Billing preference','billingPreference') + input('Receipt destination','receiptDestination')
        + input('Temperature preference','temperature') + input('Music preference','music') + input('Call/text preference','callTextPreference')
        + '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="quietRide"> Quiet ride</label><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="luggageHelp"> Luggage help</label><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="groceryHelp"> Grocery help</label>'
        + textarea('Initial notes history','notesHistory')
        + '<button style="border:0;background:#7c3aed;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Save service profile</button></form>'
        + '<div style="background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0 0 10px">Stored service profiles</h3>'+profileTable(profiles)+'</div></div>';
    }
    if(tab === 'drivers'){
      content = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><form id="wgV39DriverForm" style="display:grid;gap:8px;background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px">'
        + '<h3 style="margin:0">Driver profile</h3>'
        + input('Driver name','displayName') + input('Status','status','active') + input('Vehicle permissions (comma separated)','vehiclePermissions') + input('Markets served (comma separated)','marketsServed') + input('Shift windows','shiftWindows') + input('Blackout windows','blackoutWindows') + input('Assist capability flags','assistCapabilities') + input('Payout model','payoutModel') + input('Quality score','qualityScore','5') + input('Incident count','incidentCount','0')
        + '<button style="border:0;background:#7c3aed;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Save driver</button></form>'
        + '<form id="wgV39VehicleForm" style="display:grid;gap:8px;background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px">'
        + '<h3 style="margin:0">Vehicle profile</h3>'
        + input('Vehicle name','displayName') + select('Class','vehicleClass', CANON.vehicleClass) + input('Seat count','seatCount','4') + input('Cargo notes','cargoNotes') + input('MPG or cost model number','mpg','0') + input('Cost model','costModel') + input('Fuel type','fuelType') + input('White-glove tags (comma separated)','whiteGloveTags') + input('Service due / reminders','serviceDue') + input('Active market','market') + '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="dispatchEligible" checked> Dispatch eligible</label>'
        + '<button style="border:0;background:#7c3aed;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Save vehicle</button></form>'
        + '<div style="grid-column:1 / -1;background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0 0 10px">Driver roster</h3>'+driverTable(drivers)+'<h3 style="margin:16px 0 10px">Vehicle roster</h3>'+vehicleTable(vehicles)+'</div></div>';
    }
    if(tab === 'pricing'){
      content = '<div style="display:grid;grid-template-columns:minmax(320px,420px) 1fr;gap:16px"><form id="wgV39QuoteForm" style="display:grid;gap:8px;background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px">'
        + '<h3 style="margin:0">Quote preview</h3>'
        + select('Service type','serviceType', CANON.serviceType) + select('Vehicle class','vehicleClass', CANON.vehicleClass) + input('Market / zone','market','phoenix') + input('Booked hours','bookedHours','1') + input('Requested miles','requestedMiles','29') + '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="sameDay"> Same-day / rush dispatch</label>' + input('Manual override total','overrideTotal','') + textarea('Manual override note','manualOverrideNote')
        + '<button style="border:0;background:#7c3aed;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Preview quote</button><div id="wgV39QuotePreview" style="font-size:.95rem;color:#d6d9e2"></div></form>'
        + '<div style="background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0 0 10px">Pricing catalog</h3>'+pricingTable(readPricing())+'</div></div>';
    }
    if(tab === 'bookings'){
      content = '<div style="display:grid;grid-template-columns:minmax(320px,420px) 1fr;gap:16px"><form id="wgV39BookingForm" style="display:grid;gap:8px;background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px">'
        + '<h3 style="margin:0">Create canonical booking</h3>'
        + select('Request source','requestSource', CANON.requestSource) + selectFromRows('Service profile','serviceProfileId', profiles, 'id', row => row.displayName + ' • ' + row.profileType) + select('Service type','serviceType', CANON.serviceType) + select('Vehicle class','vehicleClass', CANON.vehicleClass) + input('Market','market','phoenix') + input('Zone','zone') + input('Pickup address','pickupAddress') + input('Dropoff address','dropoffAddress') + input('ETA / promised window','etaWindow') + input('Booked hours','bookedHours','1') + input('Requested miles','requestedMiles','29') + select('Billing mode','billingMode', ['retail','member_rate','included_block']) + input('Membership id override (optional)','membershipId') + textarea('Rider notes','riderNotes') + textarea('Operator notes','operatorNotes') + textarea('White-glove notes','whiteGloveNotes')
        + '<button style="border:0;background:#7c3aed;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Save booking</button></form>'
        + '<div style="background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0 0 10px">Dispatch + closeout</h3>'+bookingTable(bookings, drivers, vehicles)+'</div></div>';
    }
    if(tab === 'memberships'){
      content = '<div style="display:grid;grid-template-columns:minmax(320px,420px) 1fr;gap:16px"><form id="wgV39MembershipForm" style="display:grid;gap:8px;background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px">'
        + '<h3 style="margin:0">Membership / subscription ledger</h3>'
        + selectFromRows('Service profile','serviceProfileId', profiles, 'id', row => row.displayName + ' • ' + row.profileType) + select('Plan type','planType', CANON.membershipPlanType) + input('Billing cadence','cadence','monthly') + input('Active window start','activeStart', dayISO()) + input('Active window end','activeEnd') + input('Included hours','includedHours','4') + input('Included miles','includedMiles','120') + input('Member pricing tier label','memberTierLabel','White Glove Member') + input('Rollover rule','rolloverRule','no_rollover') + input('Household rider cap','householdRiderCap','0') + input('Status','status','active') + textarea('Renewal note','renewalNote') + textarea('Failure note','failureNote') + textarea('Manual override note','manualOverrideNote')
        + '<button style="border:0;background:#7c3aed;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Save membership</button></form>'
        + '<div style="background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0 0 10px">Membership ledger</h3>'+membershipTable(memberships, profiles)+'</div></div>';
    }
    if(tab === 'outbox'){
      content = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><div style="background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0 0 10px">Website-sync outbox</h3>'+outboxTable(readOutbox())+'</div><div style="background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><h3 style="margin:0 0 10px">Generated documents</h3>'+docsTable(readDocs())+'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button id="wgV39ExportJsonBtn" style="border:0;background:#7c3aed;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Export white-glove JSON</button><button id="wgV39ExportHtmlBtn" style="border:0;background:#1e293b;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Export white-glove HTML</button></div></div></div>';
    }
    return nav + content;
  }

  function buildMetric(label, value){
    return '<div style="background:#11192d;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px"><div style="font-size:.8rem;color:#a6adbb">'+esc(label)+'</div><div style="font-size:1.2rem;font-weight:700;margin-top:6px">'+esc(String(value))+'</div></div>';
  }
  function input(label,name,value){ return '<label style="display:grid;gap:6px;font-size:.9rem"><span>'+esc(label)+'</span><input name="'+esc(name)+'" value="'+esc(value||'')+'" style="border:1px solid rgba(255,255,255,.12);background:#0b1120;color:#fff;border-radius:10px;padding:10px"></label>'; }
  function textarea(label,name,value){ return '<label style="display:grid;gap:6px;font-size:.9rem"><span>'+esc(label)+'</span><textarea name="'+esc(name)+'" rows="3" style="border:1px solid rgba(255,255,255,.12);background:#0b1120;color:#fff;border-radius:10px;padding:10px">'+esc(value||'')+'</textarea></label>'; }
  function select(label,name,options){ return '<label style="display:grid;gap:6px;font-size:.9rem"><span>'+esc(label)+'</span><select name="'+esc(name)+'" style="border:1px solid rgba(255,255,255,.12);background:#0b1120;color:#fff;border-radius:10px;padding:10px">'+options.map(v => '<option value="'+esc(v)+'">'+esc(v)+'</option>').join('')+'</select></label>'; }
  function selectFromRows(label,name,rows,valKey,labelFn){ return '<label style="display:grid;gap:6px;font-size:.9rem"><span>'+esc(label)+'</span><select name="'+esc(name)+'" style="border:1px solid rgba(255,255,255,.12);background:#0b1120;color:#fff;border-radius:10px;padding:10px"><option value="">Select</option>'+rows.map(row => '<option value="'+esc(row[valKey])+'">'+esc(labelFn(row))+'</option>').join('')+'</select></label>'; }
  function profileTable(rows){ return '<div style="max-height:52vh;overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Name</th><th>Type</th><th>Favorite drivers</th><th>Membership</th></tr></thead><tbody>'+rows.map(row => '<tr><td>'+esc(row.displayName)+'</td><td>'+esc(row.profileType)+'</td><td>'+esc((row.favoriteDriverIds || []).join(', ') || '—')+'</td><td>'+esc(row.membershipId || '—')+'</td></tr>').join('')+'</tbody></table></div>'; }
  function driverTable(rows){ return '<div style="max-height:36vh;overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Driver</th><th>Status</th><th>Markets</th><th>Assist</th></tr></thead><tbody>'+rows.map(row => '<tr><td>'+esc(row.displayName)+'</td><td>'+esc(row.status)+'</td><td>'+esc((row.marketsServed||[]).join(', ') || '—')+'</td><td>'+esc((row.assistCapabilities||[]).join(', ') || '—')+'</td></tr>').join('')+'</tbody></table></div>'; }
  function vehicleTable(rows){ return '<div style="max-height:36vh;overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Vehicle</th><th>Class</th><th>Market</th><th>Eligible</th></tr></thead><tbody>'+rows.map(row => '<tr><td>'+esc(row.displayName)+'</td><td>'+esc(row.vehicleClass)+'</td><td>'+esc(row.market || '—')+'</td><td>'+esc(row.dispatchEligible ? 'yes' : 'no')+'</td></tr>').join('')+'</tbody></table></div>'; }
  function pricingTable(rows){ return '<div style="max-height:52vh;overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Tier</th><th>Service</th><th>Class</th><th>Base/hr</th><th>Included miles/hr</th><th>Extra mile</th></tr></thead><tbody>'+rows.map(row => '<tr><td>'+esc(row.label)+'</td><td>'+esc(row.serviceType)+'</td><td>'+esc(row.vehicleClass)+'</td><td>'+money(row.baseRate)+'</td><td>'+esc(String(row.includedMilesPerHour))+'</td><td>'+money(row.extraMileRate)+'</td></tr>').join('')+'</tbody></table></div>'; }
  function bookingTable(rows, drivers, vehicles){ return '<div style="max-height:52vh;overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Booking</th><th>Client</th><th>Status</th><th>Favorite</th><th>Driver</th><th>Vehicle</th><th>Quoted</th><th>Actions</th></tr></thead><tbody>'+rows.map(row => '<tr><td>'+esc(row.id)+'</td><td>'+esc(row.serviceProfileName || '—')+'<div style="font-size:.8rem;color:#a6adbb">'+esc(row.requestSource)+' • '+esc(row.serviceType)+'</div></td><td>'+esc(row.dispatchStatus)+'</td><td>'+esc(row.favoriteDriverState || '—')+'</td><td>'+esc(((drivers.find(d => d.id === row.assignedDriverId) || {}).displayName) || '—')+'</td><td>'+esc(((vehicles.find(v => v.id === row.assignedVehicleId) || {}).displayName) || '—')+'</td><td>'+money((row.pricingSnapshot && row.pricingSnapshot.quotedTotal) || 0)+'</td><td><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="wg-v39-assign" data-id="'+esc(row.id)+'">Assign</button><button class="wg-v39-step" data-id="'+esc(row.id)+'">Step</button><button class="wg-v39-close-booking" data-id="'+esc(row.id)+'">Close</button><button class="wg-v39-export-receipt" data-id="'+esc(row.id)+'">Receipt</button><button class="wg-v39-export-service" data-id="'+esc(row.id)+'">Service</button></div></td></tr>').join('')+'</tbody></table></div>'; }
  function membershipTable(rows, profiles){ return '<div style="max-height:52vh;overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Member</th><th>Plan</th><th>Remaining hours</th><th>Remaining miles</th><th>Status</th></tr></thead><tbody>'+rows.map(row => '<tr><td>'+esc(((profiles.find(p => p.id === row.serviceProfileId) || {}).displayName) || row.serviceProfileId || '—')+'</td><td>'+esc(row.planType)+'</td><td>'+esc(String(row.remainingHours))+'</td><td>'+esc(String(row.remainingMiles))+'</td><td>'+esc(row.status)+'</td></tr>').join('')+'</tbody></table></div>'; }
  function outboxTable(rows){ return '<div style="max-height:52vh;overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Kind</th><th>Status</th><th>Retries</th><th>Payload</th><th>Actions</th></tr></thead><tbody>'+rows.map(row => '<tr><td>'+esc(row.kind)+'</td><td>'+esc(row.status)+'</td><td>'+esc(String(row.retryCount || 0))+'</td><td>'+esc((row.payload && row.payload.bookingId) || '—')+'</td><td><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="wg-v39-outbox-retry" data-id="'+esc(row.id)+'">Retry</button><button class="wg-v39-outbox-synced" data-id="'+esc(row.id)+'">Mark synced</button><button class="wg-v39-outbox-failed" data-id="'+esc(row.id)+'">Mark failed</button></div></td></tr>').join('')+'</tbody></table></div>'; }
  function docsTable(rows){ return '<div style="max-height:52vh;overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Type</th><th>Title</th><th>Created</th><th>Action</th></tr></thead><tbody>'+rows.map(row => '<tr><td>'+esc(row.type)+'</td><td>'+esc(row.title)+'</td><td>'+esc(row.createdAt)+'</td><td><button class="wg-v39-doc-open" data-id="'+esc(row.id)+'">Open</button></td></tr>').join('')+'</tbody></table></div>'; }

  function attachControlHandlers(body){
    body.addEventListener('click', (e)=>{
      const tabBtn = e.target.closest('.wg-v39-tab');
      if(tabBtn){ writeUI({ tab: tabBtn.dataset.tab }); openControlCenter(); return; }
      const assignBtn = e.target.closest('.wg-v39-assign');
      if(assignBtn){ openAssignPrompt(assignBtn.dataset.id); return; }
      const stepBtn = e.target.closest('.wg-v39-step');
      if(stepBtn){ const row = advanceBookingStatus(stepBtn.dataset.id); toast(row ? 'Booking moved to ' + row.dispatchStatus : 'Booking not found', row ? 'good' : 'warn'); openControlCenter(); return; }
      const closeBtn = e.target.closest('.wg-v39-close-booking');
      if(closeBtn){ openClosePrompt(closeBtn.dataset.id); return; }
      const retryBtn = e.target.closest('.wg-v39-outbox-retry');
      if(retryBtn){ const row = readOutbox().find(r => r.id === retryBtn.dataset.id); if(row) updateOutbox(row.id, { status:'queued', retryCount:Number(row.retryCount || 0)+1 }); openControlCenter(); toast('Outbox row retried.', 'good'); return; }
      const syncedBtn = e.target.closest('.wg-v39-outbox-synced');
      if(syncedBtn){ updateOutbox(syncedBtn.dataset.id, { status:'synced' }); openControlCenter(); toast('Outbox row marked synced.', 'good'); return; }
      const failedBtn = e.target.closest('.wg-v39-outbox-failed');
      if(failedBtn){ updateOutbox(failedBtn.dataset.id, { status:'failed' }); openControlCenter(); toast('Outbox row marked failed.', 'warn'); return; }
      const docBtn = e.target.closest('.wg-v39-doc-open');
      if(docBtn){ const doc = readDocs().find(r => r.id === docBtn.dataset.id); if(doc) downloadText(doc.html || '', clean(doc.title || doc.id)+'.html', 'text/html'); return; }
      const receiptBtn = e.target.closest('.wg-v39-export-receipt');
      if(receiptBtn){ const booking = getBooking(receiptBtn.dataset.id); if(!booking) return; const html = buildReceiptHtml(booking); downloadText(html, 'whiteglove_receipt_'+booking.id+'.html', 'text/html'); upsertDoc('trip_receipt_html','whiteglove_receipt_'+booking.id, html, { bookingId:booking.id }); toast('Receipt exported.', 'good'); return; }
      const serviceBtn = e.target.closest('.wg-v39-export-service');
      if(serviceBtn){ const booking = getBooking(serviceBtn.dataset.id); if(!booking) return; const html = buildServiceSummaryHtml(booking); downloadText(html, 'whiteglove_service_summary_'+booking.id+'.html', 'text/html'); upsertDoc('premium_service_summary_html','whiteglove_service_summary_'+booking.id, html, { bookingId:booking.id }); toast('Service summary exported.', 'good'); return; }
      const jsonBtn = e.target.closest('#wgV39ExportJsonBtn');
      if(jsonBtn){ exportWhiteGloveJson(); return; }
      const htmlBtn = e.target.closest('#wgV39ExportHtmlBtn');
      if(htmlBtn){ exportWhiteGloveHtml(); return; }
    });

    const profileForm = body.querySelector('#wgV39ProfileForm');
    if(profileForm) profileForm.onsubmit = (e)=>{
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(profileForm).entries());
      fd.quietRide = profileForm.querySelector('[name="quietRide"]').checked;
      fd.luggageHelp = profileForm.querySelector('[name="luggageHelp"]').checked;
      fd.groceryHelp = profileForm.querySelector('[name="groceryHelp"]').checked;
      const row = addServiceProfile(fd);
      toast('Service profile saved: ' + row.displayName, 'good');
      openControlCenter('profiles');
    };
    const driverForm = body.querySelector('#wgV39DriverForm');
    if(driverForm) driverForm.onsubmit = (e)=>{
      e.preventDefault();
      const row = addDriver(Object.fromEntries(new FormData(driverForm).entries()));
      toast('Driver saved: ' + row.displayName, 'good');
      openControlCenter('drivers');
    };
    const vehicleForm = body.querySelector('#wgV39VehicleForm');
    if(vehicleForm) vehicleForm.onsubmit = (e)=>{
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(vehicleForm).entries());
      payload.dispatchEligible = vehicleForm.querySelector('[name="dispatchEligible"]').checked;
      const row = addVehicle(payload);
      toast('Vehicle saved: ' + row.displayName, 'good');
      openControlCenter('drivers');
    };
    const membershipForm = body.querySelector('#wgV39MembershipForm');
    if(membershipForm) membershipForm.onsubmit = (e)=>{
      e.preventDefault();
      const row = addMembership(Object.fromEntries(new FormData(membershipForm).entries()));
      toast('Membership saved: ' + row.id, 'good');
      openControlCenter('memberships');
    };
    const bookingForm = body.querySelector('#wgV39BookingForm');
    if(bookingForm) bookingForm.onsubmit = (e)=>{
      e.preventDefault();
      const row = createBooking(Object.fromEntries(new FormData(bookingForm).entries()));
      toast('Canonical booking saved: ' + row.id, 'good');
      openControlCenter('bookings');
    };
    const quoteForm = body.querySelector('#wgV39QuoteForm');
    if(quoteForm) quoteForm.onsubmit = (e)=>{
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(quoteForm).entries());
      payload.sameDay = quoteForm.querySelector('[name="sameDay"]').checked;
      const snap = buildPricingSnapshot(payload);
      const host = body.querySelector('#wgV39QuotePreview');
      if(host) host.innerHTML = '<div><strong>'+esc(snap.catalogLabel)+'</strong></div><div>Quoted total '+money(snap.quotedTotal)+'</div><div>Included miles '+esc(String(snap.includedMiles))+' • extra miles '+esc(String(snap.extraMiles))+'</div><div>Wait rule '+money(snap.waitPerHour)+'/hr • extra mile '+money(snap.extraMileRate)+'</div>';
    };
  }

  function openAssignPrompt(bookingId){
    const booking = getBooking(bookingId);
    if(!booking) return;
    openModal('Assign booking ' + booking.id, '<form id="wgV39AssignForm" style="display:grid;gap:8px">'+selectFromRows('Driver','driverId', readDrivers().filter(r => r.status === 'active'), 'id', row => row.displayName)+' '+selectFromRows('Vehicle','vehicleId', readVehicles().filter(r => r.dispatchEligible), 'id', row => row.displayName + ' • ' + row.vehicleClass)+'<button style="border:0;background:#7c3aed;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Assign now</button></form>', (body)=>{
      body.querySelector('#wgV39AssignForm').onsubmit = (e)=>{
        e.preventDefault();
        const fd = Object.fromEntries(new FormData(e.target).entries());
        const row = assignBooking(bookingId, fd.driverId, fd.vehicleId);
        toast(row ? 'Booking assigned.' : 'Assignment failed.', row ? 'good' : 'warn');
        const modal = document.getElementById('wgV39Modal'); if(modal) modal.remove();
        openControlCenter('bookings');
      };
    });
  }

  function openClosePrompt(bookingId){
    const booking = getBooking(bookingId);
    if(!booking) return;
    openModal('Close white-glove booking ' + booking.id, '<form id="wgV39CloseForm" style="display:grid;gap:8px">'+input('Actual usage hours','actualUsageHours', booking.actualUsageHours || booking.pricingSnapshot.bookedHours)+input('Actual usage miles','actualUsageMiles', booking.actualUsageMiles || booking.pricingSnapshot.requestedMiles)+'<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="doorAssist"> Door assist</label><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="luggageAssist"> Luggage / grocery assist</label><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="groceryAssist"> Grocery / errand handling</label><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="standbyUsed"> Wait / standby used</label>'+input('Standby hours','standbyHours','0')+input('Service rating','serviceRating','5')+input('Payout model','payoutModel', (booking.payout && booking.payout.model) || 'per_service')+input('Payout amount','payoutAmount', (booking.payout && booking.payout.amount) || '0')+textarea('Payout note','payoutNote')+textarea('Closeout note','closeoutNote')+'<button style="border:0;background:#7c3aed;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Close booking</button></form>', (body)=>{
      body.querySelector('#wgV39CloseForm').onsubmit = (e)=>{
        e.preventDefault();
        const form = e.target;
        const fd = Object.fromEntries(new FormData(form).entries());
        fd.doorAssist = form.querySelector('[name="doorAssist"]').checked;
        fd.luggageAssist = form.querySelector('[name="luggageAssist"]').checked;
        fd.groceryAssist = form.querySelector('[name="groceryAssist"]').checked;
        fd.standbyUsed = form.querySelector('[name="standbyUsed"]').checked;
        const row = closeBooking(bookingId, fd);
        toast(row ? 'White-glove booking closed.' : 'Closeout failed.', row ? 'good' : 'warn');
        const modal = document.getElementById('wgV39Modal'); if(modal) modal.remove();
        openControlCenter('bookings');
      };
    });
  }

  function openControlCenter(forceTab){
    if(forceTab) writeUI({ tab: forceTab });
    openModal('White-glove fleet infrastructure', controlCenterHtml(), attachControlHandlers);
  }

  function inject(){
    const existing = document.getElementById('wgV39SummaryCard');
    if(existing) existing.remove();
    const host = document.querySelector('#app') || document.body;
    const s = summary();
    const card = document.createElement('div');
    card.id = 'wgV39SummaryCard';
    card.className = 'card';
    card.innerHTML = '<h2 style="margin:0 0 10px">White-glove fleet infrastructure</h2><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><span class="badge">Profiles '+esc(String(s.profiles))+'</span><span class="badge">Bookings '+esc(String(s.bookings))+'</span><span class="badge">Active memberships '+esc(String(s.memberships))+'</span><span class="badge">Queued website sync '+esc(String(s.queuedSync))+'</span><span class="badge">Revenue '+money(s.recognizedRevenue)+'</span></div><div style="margin-bottom:12px">Premium chauffeur contract layer with service profiles, driver/vehicle dispatch, frozen pricing snapshots, membership ledger decrement logic, truthful favorite-driver state, and website-origin sync outbox.</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="wgV39OpenBtn" class="btn small">White-glove ops</button><button id="wgV39ExportJsonInlineBtn" class="btn small">Export white-glove JSON</button><button id="wgV39ExportHtmlInlineBtn" class="btn small">Export white-glove HTML</button></div>';
    host.appendChild(card);
    const bar = document.querySelector('#routexWorkbenchToolbar') || document.querySelector('.toolbar') || document.querySelector('.row');
    if(bar && !document.getElementById('wgV39ToolbarBtn')){
      const btn = document.createElement('button'); btn.id = 'wgV39ToolbarBtn'; btn.className = 'btn small'; btn.textContent = 'White-glove ops'; btn.onclick = ()=> openControlCenter();
      const exp = document.createElement('button'); exp.className = 'btn small'; exp.textContent = 'White-glove JSON'; exp.onclick = exportWhiteGloveJson;
      bar.appendChild(btn); bar.appendChild(exp);
    }
    const openBtn = document.getElementById('wgV39OpenBtn'); if(openBtn) openBtn.onclick = ()=> openControlCenter();
    const jBtn = document.getElementById('wgV39ExportJsonInlineBtn'); if(jBtn) jBtn.onclick = exportWhiteGloveJson;
    const hBtn = document.getElementById('wgV39ExportHtmlInlineBtn'); if(hBtn) hBtn.onclick = exportWhiteGloveHtml;
  }

  const observer = new MutationObserver(()=> inject());
  observer.observe(document.body, { childList:true, subtree:true });
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(inject, 0); return out; };

  window.SkyeWhiteGloveCanon = CANON;
  window.readWhiteGloveServiceProfiles = readProfiles;
  window.readWhiteGloveDriverProfiles = readDrivers;
  window.readWhiteGloveVehicleProfiles = readVehicles;
  window.readWhiteGloveMemberships = readMemberships;
  window.readWhiteGloveBookings = readBookings;
  window.readWhiteGloveOutbox = readOutbox;
  window.readWhiteGloveDocs = readDocs;
  window.saveWhiteGloveServiceProfile = addServiceProfile;
  window.saveWhiteGloveDriverProfile = addDriver;
  window.saveWhiteGloveVehicleProfile = addVehicle;
  window.saveWhiteGloveMembership = addMembership;
  window.saveWhiteGloveBooking = createBooking;
  window.assignWhiteGloveBooking = assignBooking;
  window.advanceWhiteGloveBookingStatus = advanceBookingStatus;
  window.closeWhiteGloveBooking = closeBooking;
  window.exportWhiteGloveFoundationJson = exportWhiteGloveJson;
  window.exportWhiteGloveFoundationHtml = exportWhiteGloveHtml;
  window.openWhiteGloveFleetOps = openControlCenter;
})();
