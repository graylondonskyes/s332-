/* V42 Routex white-glove website queue + analytics + backup/restore hardening */
(function(){
  if(window.__ROUTEX_WHITEGLOVE_V42__) return;
  window.__ROUTEX_WHITEGLOVE_V42__ = true;

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
  const V41 = {
    execution: 'skye_whiteglove_execution_rows_v41',
    payoutLedger: 'skye_whiteglove_payout_ledger_v41',
    recovery: 'skye_whiteglove_service_recovery_v41'
  };
  const KEYS = {
    websiteRequests: 'skye_whiteglove_website_requests_v42',
    syncLedger: 'skye_whiteglove_sync_ledger_v42',
    analytics: 'skye_whiteglove_analytics_snapshots_v42',
    backups: 'skye_whiteglove_backup_bundles_v42',
    restoreRuns: 'skye_whiteglove_restore_runs_v42',
    ui: 'skye_whiteglove_v42_ui'
  };

  const clean = (v)=> String(v == null ? '' : v).trim();
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const nowISO = ()=> new Date().toISOString();
  const dayISO = ()=> nowISO().slice(0,10);
  const uid = (p)=> (p || 'id') + '_' + Math.random().toString(36).slice(2,9) + '_' + Date.now().toString(36);
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
  const readPayoutLedger = ()=> (window.readWhiteGlovePayoutLedgerV41 ? window.readWhiteGlovePayoutLedgerV41() : readJSON(V41.payoutLedger, []));
  const readWebsiteRequests = ()=> readJSON(KEYS.websiteRequests, []);
  const readSyncLedger = ()=> readJSON(KEYS.syncLedger, []);
  const readAnalytics = ()=> readJSON(KEYS.analytics, []);
  const readBackups = ()=> readJSON(KEYS.backups, []);
  const readRestoreRuns = ()=> readJSON(KEYS.restoreRuns, []);
  const readUI = ()=> readJSON(KEYS.ui, { tab:'website', previewText:'', previewMode:'merge' });

  const writeWebsiteRequests = (rows)=> writeJSON(KEYS.websiteRequests, rows);
  const writeSyncLedger = (rows)=> writeJSON(KEYS.syncLedger, rows);
  const writeAnalytics = (rows)=> writeJSON(KEYS.analytics, rows);
  const writeBackups = (rows)=> writeJSON(KEYS.backups, rows);
  const writeRestoreRuns = (rows)=> writeJSON(KEYS.restoreRuns, rows);
  const writeUI = (patch)=> writeJSON(KEYS.ui, Object.assign({}, readUI(), patch || {}));

  function norm(v){ return clean(v).toLowerCase().replace(/\s+/g, ' '); }
  function profileKey(row){ return [norm(row && row.email), norm(row && row.primaryPhone), norm(row && row.displayName)].filter(Boolean).join('|'); }
  function driverKey(row){ return [norm(row && row.displayName), norm(row && row.primaryPhone)].filter(Boolean).join('|'); }
  function getProfile(id){ return readProfiles().find(row => row.id === id) || null; }
  function getMembership(id){ return readMemberships().find(row => row.id === id) || null; }
  function getDriver(id){ return readDrivers().find(row => row.id === id) || null; }
  function getVehicle(id){ return readVehicles().find(row => row.id === id) || null; }
  function getExecution(bookingId){ return readExecution().find(row => row.bookingId === bookingId) || null; }

  function writeSharedEvents(type, refs, note, extra){
    const rows = readJSON(SHARED.events, []);
    rows.unshift(Object.assign({ id: uid('wg_evt'), type: clean(type), refs: refs || {}, note: clean(note), createdAt: nowISO() }, extra || {}));
    writeJSON(SHARED.events, rows.slice(0, 1200));
  }

  function pushSync(kind, status, note, payload){
    const rows = readSyncLedger();
    const row = { id: uid('wg_synclog'), kind: clean(kind), status: clean(status) || 'queued', note: clean(note), payload: payload || {}, createdAt: nowISO(), updatedAt: nowISO(), retryCount:0 };
    rows.unshift(row);
    writeSyncLedger(rows.slice(0, 800));
    return row;
  }
  function updateSyncRow(id, patch){
    const rows = readSyncLedger();
    const idx = rows.findIndex(row => row.id === id);
    if(idx === -1) return null;
    rows[idx] = Object.assign({}, rows[idx], patch || {}, { updatedAt: nowISO() });
    writeSyncLedger(rows);
    return rows[idx];
  }

  function findOrCreateServiceProfileForRequest(row){
    const profiles = readProfiles();
    const existing = profiles.find(item => (norm(item.email) && norm(item.email) === norm(row.email)) || (norm(item.primaryPhone) && norm(item.primaryPhone) === norm(row.phone)) || (norm(item.displayName) && norm(item.displayName) === norm(row.riderName)));
    if(existing) return existing;
    if(typeof window.saveWhiteGloveServiceProfile === 'function'){
      return window.saveWhiteGloveServiceProfile({
        profileType: row.profileType || 'individual',
        displayName: row.riderName,
        legalName: row.riderName,
        primaryPhone: row.phone,
        alternatePhone: '',
        email: row.email,
        addresses: [row.pickupAddress, row.dropoffAddress].filter(Boolean).join('\n'),
        market: row.market,
        favoriteDriverIds: row.favoriteDriverId ? [row.favoriteDriverId] : [],
        billingPreference: row.membershipId ? 'member' : 'receipt',
        preferenceNotes: row.notes,
        householdAuthorizedRiders: '',
        serviceTags: row.membershipId ? 'member, website' : 'website'
      });
    }
    return null;
  }

  function createWebsiteRequest(values){
    const rows = readWebsiteRequests();
    const row = {
      id: uid('wg_web'),
      requestSource: 'website',
      status: 'queued_for_operator',
      syncState: 'queued',
      riderName: clean(values.riderName),
      phone: clean(values.phone),
      email: clean(values.email),
      profileType: clean(values.profileType) || 'individual',
      pickupAddress: clean(values.pickupAddress),
      dropoffAddress: clean(values.dropoffAddress),
      market: clean(values.market) || 'phoenix',
      serviceType: clean(values.serviceType) || 'reserve',
      vehicleClass: clean(values.vehicleClass) || 'sedan',
      bookedHours: Number(values.bookedHours || 1),
      requestedMiles: Number(values.requestedMiles || 0),
      sameDay: !!values.sameDay,
      membershipId: clean(values.membershipId),
      favoriteDriverId: clean(values.favoriteDriverId),
      notes: clean(values.notes),
      bookingId: '',
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    rows.unshift(row);
    writeWebsiteRequests(rows.slice(0, 400));
    pushSync('website_request_received', 'queued', 'Website request queued for operator intake.', { requestId: row.id, market: row.market, serviceType: row.serviceType });
    writeSharedEvents('whiteglove_website_request_received', { requestId: row.id }, 'Website request stored for operator intake', { market: row.market, serviceType: row.serviceType });
    return row;
  }

  function materializeWebsiteRequest(requestId){
    const requests = readWebsiteRequests();
    const idx = requests.findIndex(row => row.id === requestId);
    if(idx === -1 || typeof window.saveWhiteGloveBooking !== 'function') return null;
    const req = Object.assign({}, requests[idx]);
    const profile = findOrCreateServiceProfileForRequest(req);
    const booking = window.saveWhiteGloveBooking({
      requestSource: 'website',
      serviceProfileId: profile && profile.id,
      membershipId: req.membershipId,
      serviceType: req.serviceType,
      vehicleClass: req.vehicleClass,
      market: req.market,
      bookedHours: req.bookedHours,
      requestedMiles: req.requestedMiles,
      sameDay: req.sameDay,
      pickupAddress: req.pickupAddress,
      dropoffAddress: req.dropoffAddress,
      riderNotes: req.notes,
      operatorNotes: 'Materialized from website request ' + req.id,
      favoriteDriverId: req.favoriteDriverId
    });
    if(!booking) return null;
    req.status = 'materialized';
    req.syncState = 'awaiting_external_sync';
    req.bookingId = booking.id;
    req.updatedAt = nowISO();
    requests[idx] = req;
    writeWebsiteRequests(requests);
    pushSync('website_request_materialized', 'awaiting_external_sync', 'Website request became a canonical booking and is awaiting external sync.', { requestId: req.id, bookingId: booking.id });
    writeSharedEvents('whiteglove_website_request_materialized', { requestId: req.id, bookingId: booking.id }, 'Website request materialized into canonical booking', { source: booking.requestSource });
    return booking;
  }

  function retryQueuedSyncRows(){
    const rows = readSyncLedger();
    let touched = 0;
    const next = rows.map(row => {
      if(['queued','awaiting_external_sync','retryable'].includes(row.status)){
        touched++;
        return Object.assign({}, row, { status:'retryable', retryCount:Number(row.retryCount || 0) + 1, note:'Local retry pass recorded. External sync lane still required.', updatedAt: nowISO() });
      }
      return row;
    });
    writeSyncLedger(next);
    return { touched, total: next.length };
  }

  function buildAnalyticsSnapshot(){
    const bookings = readBookings();
    const profiles = readProfiles();
    const drivers = readDrivers();
    const vehicles = readVehicles();
    const memberships = readMemberships();
    const payoutRows = readPayoutLedger();
    const executionRows = readExecution();

    const totals = { bookings: bookings.length, profiles: profiles.length, drivers: drivers.length, vehicles: vehicles.length, memberships: memberships.length };
    const byMarket = {};
    const byTier = {};
    const byDriver = {};
    const byVehicleClass = {};
    const byZone = {};
    const byDriverScore = {};
    let memberCount = 0;
    let retailCount = 0;
    let favoritePool = 0;
    let favoriteMatched = 0;
    let waitRevenue = 0;
    let overageRevenue = 0;
    let totalRecognized = 0;
    let totalPayout = 0;
    let cancellations = 0;
    let noShows = 0;
    let repeatProfiles = 0;

    const bookingsByProfile = {};
    bookings.forEach(row => {
      const market = clean(row.market || (row.pricingSnapshot && row.pricingSnapshot.market) || 'unknown').toLowerCase();
      const tier = clean((row.pricingSnapshot && row.pricingSnapshot.catalogLabel) || (row.pricingSnapshot && row.pricingSnapshot.pricingTier) || 'unpriced');
      const driver = getDriver(row.assignedDriverId);
      const vehicle = getVehicle(row.assignedVehicleId);
      const recognized = Number((row.billingSummary && row.billingSummary.totalCharged) || (row.finalEconomics && row.finalEconomics.recognizedRevenue) || (row.pricingSnapshot && row.pricingSnapshot.quotedTotal) || 0);
      const payout = Number((row.payout && row.payout.amount) || (payoutRows.find(item => item.bookingId === row.id) || {}).amount || 0);
      const wait = Number((row.billingSummary && row.billingSummary.waitRevenue) || (row.finalEconomics && row.finalEconomics.waitCharge) || 0);
      const overage = Number((row.billingSummary && row.billingSummary.overageRevenue) || (row.finalEconomics && row.finalEconomics.overageRevenue) || 0);
      const zone = clean(row.pickupAddress || '').split(',')[0] || 'unknown';

      byMarket[market] = (byMarket[market] || 0) + 1;
      byTier[tier] = (byTier[tier] || 0) + 1;
      byZone[zone] = Number(((byZone[zone] || 0) + recognized).toFixed(2));
      if(driver){ byDriver[driver.displayName] = Number(((byDriver[driver.displayName] || 0) + recognized).toFixed(2)); }
      if(vehicle){ byVehicleClass[vehicle.vehicleClass || vehicle.class || 'unknown'] = Number(((byVehicleClass[vehicle.vehicleClass || vehicle.class || 'unknown'] || 0) + recognized).toFixed(2)); }
      totalRecognized += recognized;
      totalPayout += payout;
      waitRevenue += wait;
      overageRevenue += overage;
      if(row.membershipId || row.billingMode === 'included_block' || (row.billingSummary && row.billingSummary.paymentMethod === 'member_draw')) memberCount++; else retailCount++;
      if(row.favoriteDriverState){ favoritePool++; if(row.favoriteDriverState === 'matched') favoriteMatched++; }
      if(row.dispatchStatus === 'cancelled') cancellations++;
      if(row.dispatchStatus === 'no_show') noShows++;
      if(row.serviceProfileId){ bookingsByProfile[row.serviceProfileId] = (bookingsByProfile[row.serviceProfileId] || 0) + 1; }
      if(driver && row.serviceRating){
        const bucket = byDriverScore[driver.displayName] || { sum:0, count:0 };
        bucket.sum += Number(row.serviceRating || 0);
        bucket.count += 1;
        byDriverScore[driver.displayName] = bucket;
      }
    });

    repeatProfiles = Object.values(bookingsByProfile).filter(v => v > 1).length;

    const continuityPairs = {};
    let continuityMatches = 0;
    let continuityTotal = 0;
    bookings.forEach(row => {
      if(!row.serviceProfileId || !row.assignedDriverId) return;
      continuityTotal++;
      const prev = continuityPairs[row.serviceProfileId];
      if(prev && prev === row.assignedDriverId) continuityMatches++;
      continuityPairs[row.serviceProfileId] = row.assignedDriverId;
    });

    let includedHours = 0, usedHours = 0, includedMiles = 0, usedMiles = 0;
    memberships.forEach(row => {
      includedHours += Number(row.includedHours || 0);
      includedMiles += Number(row.includedMiles || 0);
      usedHours += Math.max(0, Number(row.includedHours || 0) - Number(row.remainingHours || 0));
      usedMiles += Math.max(0, Number(row.includedMiles || 0) - Number(row.remainingMiles || 0));
    });

    const driverServiceScores = Object.keys(byDriverScore).map(name => ({
      driverName: name,
      averageServiceScore: Number((byDriverScore[name].sum / Math.max(1, byDriverScore[name].count)).toFixed(2)),
      ratedTrips: byDriverScore[name].count
    })).sort((a,b)=> b.averageServiceScore - a.averageServiceScore);

    const row = {
      id: uid('wg_analytics'),
      createdAt: nowISO(),
      fingerprint: 'wg-analytics-' + dayISO() + '-' + uid('fp').slice(-8),
      totals,
      bookingsByMarket: byMarket,
      bookingsByTier: byTier,
      memberVsRetail: { member: memberCount, retail: retailCount },
      favoriteDriverMatchRate: favoritePool ? Number(((favoriteMatched / favoritePool) * 100).toFixed(2)) : 0,
      driverContinuityScore: continuityTotal ? Number(((continuityMatches / continuityTotal) * 100).toFixed(2)) : 0,
      driverServiceScores,
      revenueByDriver: byDriver,
      revenueByVehicleClass: byVehicleClass,
      revenueByZone: byZone,
      waitRevenue: Number(waitRevenue.toFixed(2)),
      overageRevenue: Number(overageRevenue.toFixed(2)),
      recognizedRevenue: Number(totalRecognized.toFixed(2)),
      payoutLiability: Number(totalPayout.toFixed(2)),
      estimatedNet: Number((totalRecognized - totalPayout).toFixed(2)),
      subscriptionUtilization: {
        includedHours: Number(includedHours.toFixed(2)),
        usedHours: Number(usedHours.toFixed(2)),
        includedMiles: Number(includedMiles.toFixed(2)),
        usedMiles: Number(usedMiles.toFixed(2)),
        hoursRate: includedHours ? Number(((usedHours / includedHours) * 100).toFixed(2)) : 0,
        milesRate: includedMiles ? Number(((usedMiles / includedMiles) * 100).toFixed(2)) : 0
      },
      repeatRiderRate: profiles.length ? Number(((repeatProfiles / profiles.length) * 100).toFixed(2)) : 0,
      cancellationRate: bookings.length ? Number(((cancellations / bookings.length) * 100).toFixed(2)) : 0,
      noShowRate: bookings.length ? Number(((noShows / bookings.length) * 100).toFixed(2)) : 0,
      routeProfitabilityProxy: {
        bookingRecognizedRevenue: Number(totalRecognized.toFixed(2)),
        bookingEstimatedNet: Number((totalRecognized - totalPayout).toFixed(2)),
        payoutRows: payoutRows.length,
        executionRows: executionRows.length,
        linkageCoverage: bookings.length ? Number(((executionRows.filter(row => bookings.some(b => b.id === row.bookingId)).length / bookings.length) * 100).toFixed(2)) : 0
      }
    };
    const rows = readAnalytics();
    rows.unshift(row);
    writeAnalytics(rows.slice(0, 120));
    writeSharedEvents('whiteglove_analytics_snapshot_saved', { analyticsId: row.id }, 'White-glove analytics snapshot saved', { fingerprint: row.fingerprint, recognizedRevenue: row.recognizedRevenue });
    return row;
  }

  function buildAnalyticsHtml(row){
    row = row || readAnalytics()[0] || buildAnalyticsSnapshot();
    const mapTable = (obj, asMoney)=> Object.keys(obj || {}).map(key => '<tr><td>'+esc(key)+'</td><td>'+(asMoney ? money(obj[key]) : esc(String(obj[key])))+'</td></tr>').join('') || '<tr><td colspan="2">No rows.</td></tr>';
    const driverScores = (row.driverServiceScores || []).map(item => '<tr><td>'+esc(item.driverName)+'</td><td>'+esc(String(item.averageServiceScore))+'</td><td>'+esc(String(item.ratedTrips))+'</td></tr>').join('') || '<tr><td colspan="3">No scored trips.</td></tr>';
    return '<!doctype html><html><head><meta charset="utf-8"><title>White-glove analytics</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}table{width:100%;border-collapse:collapse;margin:10px 0 18px}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.badge{display:inline-block;padding:4px 8px;border:1px solid #999;border-radius:999px;margin:0 6px 6px 0}</style></head><body><h1>White-glove analytics snapshot</h1><div><span class="badge">'+esc(row.fingerprint)+'</span><span class="badge">Revenue '+money(row.recognizedRevenue)+'</span><span class="badge">Net '+money(row.estimatedNet)+'</span><span class="badge">Member mix '+esc(String(row.memberVsRetail.member))+'/'+esc(String(row.memberVsRetail.retail))+'</span></div><div class="grid"><div><h2>Bookings by market</h2><table><tbody>'+mapTable(row.bookingsByMarket, false)+'</tbody></table><h2>Bookings by tier</h2><table><tbody>'+mapTable(row.bookingsByTier, false)+'</tbody></table><h2>Revenue by zone</h2><table><tbody>'+mapTable(row.revenueByZone, true)+'</tbody></table></div><div><h2>Driver service scores</h2><table><thead><tr><th>Driver</th><th>Avg score</th><th>Rated trips</th></tr></thead><tbody>'+driverScores+'</tbody></table><h2>Revenue by driver</h2><table><tbody>'+mapTable(row.revenueByDriver, true)+'</tbody></table><h2>Revenue by vehicle class</h2><table><tbody>'+mapTable(row.revenueByVehicleClass, true)+'</tbody></table></div></div><h2>Metrics</h2><table><tbody><tr><td>Favorite-driver match rate</td><td>'+esc(String(row.favoriteDriverMatchRate))+'%</td></tr><tr><td>Driver continuity score</td><td>'+esc(String(row.driverContinuityScore))+'%</td></tr><tr><td>Wait revenue</td><td>'+money(row.waitRevenue)+'</td></tr><tr><td>Overage revenue</td><td>'+money(row.overageRevenue)+'</td></tr><tr><td>Subscription hours utilization</td><td>'+esc(String(row.subscriptionUtilization.hoursRate))+'%</td></tr><tr><td>Subscription miles utilization</td><td>'+esc(String(row.subscriptionUtilization.milesRate))+'%</td></tr><tr><td>Repeat-rider rate</td><td>'+esc(String(row.repeatRiderRate))+'%</td></tr><tr><td>Cancellation rate</td><td>'+esc(String(row.cancellationRate))+'%</td></tr><tr><td>No-show rate</td><td>'+esc(String(row.noShowRate))+'%</td></tr><tr><td>Route linkage coverage</td><td>'+esc(String(row.routeProfitabilityProxy.linkageCoverage))+'%</td></tr></tbody></table></body></html>';
  }

  function exportAnalyticsHtml(){ const row = readAnalytics()[0] || buildAnalyticsSnapshot(); downloadText(buildAnalyticsHtml(row), 'whiteglove_analytics_' + dayISO() + '.html', 'text/html'); }
  function exportAnalyticsJson(){ const row = readAnalytics()[0] || buildAnalyticsSnapshot(); downloadText(JSON.stringify(row, null, 2), 'whiteglove_analytics_' + dayISO() + '.json', 'application/json'); }

  function buildBackupBundle(){
    const row = {
      id: uid('wg_backup'),
      createdAt: nowISO(),
      fingerprint: 'wg-backup-' + dayISO() + '-' + uid('fp').slice(-8),
      source: 'routex-whiteglove-v42',
      data: {
        profiles: readProfiles(),
        drivers: readDrivers(),
        vehicles: readVehicles(),
        memberships: readMemberships(),
        bookings: readBookings(),
        docs: readDocs(),
        outbox: readJSON(SHARED.outbox, []),
        execution: readExecution(),
        payoutLedger: readPayoutLedger(),
        websiteRequests: readWebsiteRequests(),
        syncLedger: readSyncLedger(),
        analytics: readAnalytics()
      },
      counts: {}
    };
    Object.keys(row.data).forEach(key => row.counts[key] = Array.isArray(row.data[key]) ? row.data[key].length : 0);
    const rows = readBackups();
    rows.unshift(row);
    writeBackups(rows.slice(0, 60));
    writeSharedEvents('whiteglove_backup_bundle_saved', { backupId: row.id }, 'White-glove backup bundle saved', { fingerprint: row.fingerprint });
    return row;
  }

  function previewRestore(jsonText){
    let parsed = null;
    try{ parsed = JSON.parse(jsonText); }catch(err){ return { ok:false, error: 'JSON parse failed: ' + err.message }; }
    const data = parsed && parsed.data ? parsed.data : parsed;
    const incomingProfiles = Array.isArray(data.profiles) ? data.profiles : [];
    const incomingDrivers = Array.isArray(data.drivers) ? data.drivers : [];
    const incomingMemberships = Array.isArray(data.memberships) ? data.memberships : [];
    const incomingBookings = Array.isArray(data.bookings) ? data.bookings : [];
    const existingProfiles = readProfiles();
    const existingDrivers = readDrivers();
    const existingBookings = readBookings();
    const dupProfiles = incomingProfiles.filter(item => existingProfiles.some(existing => profileKey(existing) && profileKey(existing) === profileKey(item)));
    const dupDrivers = incomingDrivers.filter(item => existingDrivers.some(existing => driverKey(existing) && driverKey(existing) === driverKey(item)));
    const dupBookings = incomingBookings.filter(item => existingBookings.some(existing => clean(existing.id) === clean(item.id)));
    return {
      ok:true,
      parsed,
      counts: {
        profiles: incomingProfiles.length,
        drivers: incomingDrivers.length,
        vehicles: Array.isArray(data.vehicles) ? data.vehicles.length : 0,
        memberships: incomingMemberships.length,
        bookings: incomingBookings.length,
        docs: Array.isArray(data.docs) ? data.docs.length : 0,
        websiteRequests: Array.isArray(data.websiteRequests) ? data.websiteRequests.length : 0,
        syncLedger: Array.isArray(data.syncLedger) ? data.syncLedger.length : 0,
        analytics: Array.isArray(data.analytics) ? data.analytics.length : 0
      },
      duplicates: {
        profiles: dupProfiles.length,
        drivers: dupDrivers.length,
        bookings: dupBookings.length
      }
    };
  }

  function mergeRows(existingRows, incomingRows, matcher){
    const out = existingRows.slice();
    (incomingRows || []).forEach(item => {
      const idx = out.findIndex(existing => matcher(existing, item));
      if(idx === -1) out.unshift(item);
      else out[idx] = Object.assign({}, out[idx], item);
    });
    return out;
  }

  function applyRestore(preview, mode){
    if(!preview || !preview.ok) return null;
    const data = preview.parsed && preview.parsed.data ? preview.parsed.data : preview.parsed;
    const mergeMode = clean(mode) || 'merge';

    const nextProfiles = mergeMode === 'replace' ? (Array.isArray(data.profiles) ? data.profiles : []) : mergeRows(readProfiles(), data.profiles || [], (a,b)=> clean(a.id) === clean(b.id) || (profileKey(a) && profileKey(a) === profileKey(b)));
    const nextDrivers = mergeMode === 'replace' ? (Array.isArray(data.drivers) ? data.drivers : []) : mergeRows(readDrivers(), data.drivers || [], (a,b)=> clean(a.id) === clean(b.id) || (driverKey(a) && driverKey(a) === driverKey(b)));
    const nextVehicles = mergeMode === 'replace' ? (Array.isArray(data.vehicles) ? data.vehicles : []) : mergeRows(readVehicles(), data.vehicles || [], (a,b)=> clean(a.id) === clean(b.id));
    const nextMemberships = mergeMode === 'replace' ? (Array.isArray(data.memberships) ? data.memberships : []) : mergeRows(readMemberships(), data.memberships || [], (a,b)=> clean(a.id) === clean(b.id));
    const nextBookings = mergeMode === 'replace' ? (Array.isArray(data.bookings) ? data.bookings : []) : mergeRows(readBookings(), data.bookings || [], (a,b)=> clean(a.id) === clean(b.id));
    const nextDocs = mergeMode === 'replace' ? (Array.isArray(data.docs) ? data.docs : []) : mergeRows(readDocs(), data.docs || [], (a,b)=> clean(a.id) === clean(b.id));
    const nextOutbox = mergeMode === 'replace' ? (Array.isArray(data.outbox) ? data.outbox : []) : mergeRows(readJSON(SHARED.outbox, []), data.outbox || [], (a,b)=> clean(a.id) === clean(b.id));
    const nextExecution = mergeMode === 'replace' ? (Array.isArray(data.execution) ? data.execution : []) : mergeRows(readExecution(), data.execution || [], (a,b)=> clean(a.id) === clean(b.id) || clean(a.bookingId) === clean(b.bookingId));
    const nextPayout = mergeMode === 'replace' ? (Array.isArray(data.payoutLedger) ? data.payoutLedger : []) : mergeRows(readPayoutLedger(), data.payoutLedger || [], (a,b)=> clean(a.id) === clean(b.id) || clean(a.bookingId) === clean(b.bookingId));
    const nextWebsite = mergeMode === 'replace' ? (Array.isArray(data.websiteRequests) ? data.websiteRequests : []) : mergeRows(readWebsiteRequests(), data.websiteRequests || [], (a,b)=> clean(a.id) === clean(b.id));
    const nextSync = mergeMode === 'replace' ? (Array.isArray(data.syncLedger) ? data.syncLedger : []) : mergeRows(readSyncLedger(), data.syncLedger || [], (a,b)=> clean(a.id) === clean(b.id));
    const nextAnalytics = mergeMode === 'replace' ? (Array.isArray(data.analytics) ? data.analytics : []) : mergeRows(readAnalytics(), data.analytics || [], (a,b)=> clean(a.id) === clean(b.id) || clean(a.fingerprint) === clean(b.fingerprint));

    writeJSON(SHARED.profiles, nextProfiles.slice(0, 1200));
    writeJSON(SHARED.drivers, nextDrivers.slice(0, 600));
    writeJSON(SHARED.vehicles, nextVehicles.slice(0, 600));
    writeJSON(SHARED.memberships, nextMemberships.slice(0, 900));
    writeJSON(SHARED.bookings, nextBookings.slice(0, 1200));
    writeJSON(SHARED.docs, nextDocs.slice(0, 500));
    writeJSON(SHARED.outbox, nextOutbox.slice(0, 800));
    writeJSON(V41.execution, nextExecution.slice(0, 1200));
    writeJSON(V41.payoutLedger, nextPayout.slice(0, 1200));
    writeWebsiteRequests(nextWebsite.slice(0, 600));
    writeSyncLedger(nextSync.slice(0, 800));
    writeAnalytics(nextAnalytics.slice(0, 200));

    const run = {
      id: uid('wg_restore'),
      createdAt: nowISO(),
      mode: mergeMode,
      importedFingerprint: clean((preview.parsed && preview.parsed.fingerprint) || (preview.parsed && preview.parsed.id) || 'adhoc-json'),
      counts: preview.counts,
      duplicates: preview.duplicates,
      final: {
        profiles: nextProfiles.length,
        drivers: nextDrivers.length,
        vehicles: nextVehicles.length,
        memberships: nextMemberships.length,
        bookings: nextBookings.length,
        docs: nextDocs.length
      }
    };
    const runs = readRestoreRuns();
    runs.unshift(run);
    writeRestoreRuns(runs.slice(0, 120));
    writeSharedEvents('whiteglove_restore_applied', { restoreId: run.id }, 'White-glove restore applied', { mode: mergeMode, bookings: run.final.bookings });
    return run;
  }

  function input(label, name, value, type){ return '<label style="display:grid;gap:6px;font-size:.9rem"><span>'+esc(label)+'</span><input type="'+esc(type || 'text')+'" name="'+esc(name)+'" value="'+esc(value || '')+'" style="border:1px solid rgba(255,255,255,.12);background:#020617;color:#fff;border-radius:10px;padding:10px"></label>'; }
  function textarea(label, name, value, rows){ return '<label style="display:grid;gap:6px;font-size:.9rem"><span>'+esc(label)+'</span><textarea name="'+esc(name)+'" rows="'+esc(String(rows || 6))+'" style="border:1px solid rgba(255,255,255,.12);background:#020617;color:#fff;border-radius:10px;padding:10px">'+esc(value || '')+'</textarea></label>'; }
  function select(label, name, options, current){ return '<label style="display:grid;gap:6px;font-size:.9rem"><span>'+esc(label)+'</span><select name="'+esc(name)+'" style="border:1px solid rgba(255,255,255,.12);background:#020617;color:#fff;border-radius:10px;padding:10px">'+options.map(v => '<option value="'+esc(v)+'"'+(String(current || '') === String(v) ? ' selected' : '')+'>'+esc(v)+'</option>').join('')+'</select></label>'; }

  function openModal(title, html, onReady){
    const existing = document.getElementById('routexWg42Modal');
    if(existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'routexWg42Modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(3,8,20,.78);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto';
    overlay.innerHTML = '<div style="width:min(1320px,96vw);background:#07111f;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:22px;box-shadow:0 30px 80px rgba(0,0,0,.45);overflow:hidden"><div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.08)"><div style="font-size:1.05rem;font-weight:700">'+esc(title)+'</div><button id="routexWg42Close" style="border:0;background:#1e293b;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Close</button></div><div id="routexWg42Body" style="padding:18px">'+html+'</div></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#routexWg42Close').onclick = ()=> overlay.remove();
    overlay.addEventListener('click', (e)=>{ if(e.target === overlay) overlay.remove(); });
    if(typeof onReady === 'function') onReady(overlay.querySelector('#routexWg42Body'));
  }

  function requestRowsHtml(){
    return readWebsiteRequests().map(row => '<tr><td>'+esc(row.id)+'</td><td>'+esc(row.riderName || '—')+'</td><td>'+esc(row.market)+'</td><td>'+esc(row.serviceType)+'</td><td>'+esc(row.vehicleClass)+'</td><td>'+esc(row.status)+'</td><td>'+esc(row.syncState)+'</td><td>'+(row.bookingId ? esc(row.bookingId) : '<button class="btn small wg42-mat" data-request="'+esc(row.id)+'">Materialize</button>')+'</td></tr>').join('') || '<tr><td colspan="8">No website requests captured yet.</td></tr>';
  }
  function syncRowsHtml(){
    return readSyncLedger().map(row => '<tr><td>'+esc(row.createdAt)+'</td><td>'+esc(row.kind)+'</td><td>'+esc(row.status)+'</td><td>'+esc(String(row.retryCount || 0))+'</td><td>'+esc(row.note || '')+'</td></tr>').join('') || '<tr><td colspan="5">No sync rows.</td></tr>';
  }
  function restoreRowsHtml(){
    return readRestoreRuns().map(row => '<tr><td>'+esc(row.createdAt)+'</td><td>'+esc(row.mode)+'</td><td>'+esc(row.importedFingerprint)+'</td><td>'+esc(String(row.final.bookings || 0))+'</td><td>'+esc(String(row.duplicates.bookings || 0))+'</td></tr>').join('') || '<tr><td colspan="5">No restore runs.</td></tr>';
  }

  function buildCenterHtml(){
    const ui = readUI();
    const analytics = readAnalytics()[0] || null;
    const latestBackup = readBackups()[0] || null;
    const tabs = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px"><button class="btn small wg42-tab" data-tab="website">Website queue</button><button class="btn small wg42-tab" data-tab="analytics">Analytics</button><button class="btn small wg42-tab" data-tab="backup">Backup / restore</button></div>';
    if(ui.tab === 'analytics'){
      return tabs + '<div class="card"><h2 style="margin:0 0 10px">White-glove analytics</h2>' + (analytics ? ('<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><span class="badge">'+esc(analytics.fingerprint)+'</span><span class="badge">Revenue '+money(analytics.recognizedRevenue)+'</span><span class="badge">Net '+money(analytics.estimatedNet)+'</span><span class="badge">Favorite match '+esc(String(analytics.favoriteDriverMatchRate))+'%</span><span class="badge">Repeat rider '+esc(String(analytics.repeatRiderRate))+'%</span></div><table style="width:100%;border-collapse:collapse"><tbody><tr><td>Member rides</td><td>'+esc(String(analytics.memberVsRetail.member))+'</td></tr><tr><td>Retail rides</td><td>'+esc(String(analytics.memberVsRetail.retail))+'</td></tr><tr><td>Wait revenue</td><td>'+money(analytics.waitRevenue)+'</td></tr><tr><td>Overage revenue</td><td>'+money(analytics.overageRevenue)+'</td></tr><tr><td>Driver continuity score</td><td>'+esc(String(analytics.driverContinuityScore))+'%</td></tr><tr><td>Hours utilization</td><td>'+esc(String(analytics.subscriptionUtilization.hoursRate))+'%</td></tr><tr><td>Miles utilization</td><td>'+esc(String(analytics.subscriptionUtilization.milesRate))+'%</td></tr><tr><td>Cancellation rate</td><td>'+esc(String(analytics.cancellationRate))+'%</td></tr><tr><td>No-show rate</td><td>'+esc(String(analytics.noShowRate))+'%</td></tr></tbody></table>') : '<div style="margin-bottom:12px">No analytics snapshot saved yet.</div>') + '<div style="display:flex;gap:8px;flex-wrap:wrap"><button id="wg42SaveAnalytics" class="btn small">Save analytics snapshot</button><button id="wg42ExportAnalyticsHtml" class="btn small">Export analytics HTML</button><button id="wg42ExportAnalyticsJson" class="btn small">Export analytics JSON</button></div></div>';
    }
    if(ui.tab === 'backup'){
      const preview = clean(ui.previewText) ? previewRestore(ui.previewText) : null;
      return tabs + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><div class="card"><h2 style="margin:0 0 10px">White-glove backup bundle</h2>' + (latestBackup ? '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><span class="badge">'+esc(latestBackup.fingerprint)+'</span><span class="badge">Bookings '+esc(String(latestBackup.counts.bookings || 0))+'</span><span class="badge">Profiles '+esc(String(latestBackup.counts.profiles || 0))+'</span><span class="badge">Requests '+esc(String(latestBackup.counts.websiteRequests || 0))+'</span></div>' : '<div style="margin-bottom:10px">No backup bundle saved yet.</div>') + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><button id="wg42SaveBackup" class="btn small">Save backup bundle</button><button id="wg42ExportBackupJson" class="btn small">Export latest backup JSON</button></div><h3 style="margin:12px 0 8px">Restore history</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th>Created</th><th>Mode</th><th>Fingerprint</th><th>Bookings</th><th>Booking dupes</th></tr></thead><tbody>'+restoreRowsHtml()+'</tbody></table></div><div class="card"><h2 style="margin:0 0 10px">Import preview + apply</h2>' + textarea('Paste backup JSON','previewText', ui.previewText || '', 14) + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">'+select('Apply mode','previewMode',['merge','replace'], ui.previewMode || 'merge')+'<button id="wg42PreviewRestore" class="btn small" style="height:42px;align-self:end">Preview restore</button><button id="wg42ApplyRestore" class="btn small" style="height:42px;align-self:end">Apply restore</button></div>' + (preview ? (preview.ok ? '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><span class="badge">Profiles '+esc(String(preview.counts.profiles))+'</span><span class="badge">Drivers '+esc(String(preview.counts.drivers))+'</span><span class="badge">Bookings '+esc(String(preview.counts.bookings))+'</span><span class="badge">Profile dupes '+esc(String(preview.duplicates.profiles))+'</span><span class="badge">Driver dupes '+esc(String(preview.duplicates.drivers))+'</span><span class="badge">Booking dupes '+esc(String(preview.duplicates.bookings))+'</span></div>' : '<div style="color:#fca5a5">'+esc(preview.error)+'</div>') : '<div>Paste a bundle to preview duplicate and import counts.</div>') + '</div></div>';
    }
    return tabs + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><form id="wg42RequestForm" class="card" style="display:grid;gap:10px"><h2 style="margin:0">Website booking intake</h2>'+input('Rider name','riderName','')+input('Phone','phone','')+input('Email','email','')+select('Profile type','profileType',['individual','household','business','vip','medical','executive'],'individual')+input('Pickup address','pickupAddress','')+input('Dropoff address','dropoffAddress','')+select('Market','market',['phoenix','glendale','scottsdale','mesa','valley_wide'],'phoenix')+select('Service type','serviceType',['reserve','now','airport','errand','hourly_standby','recurring'],'reserve')+select('Vehicle class','vehicleClass',['sedan','suv','xl','specialty'],'sedan')+input('Booked hours','bookedHours','1','number')+input('Requested miles','requestedMiles','0','number')+input('Membership ID','membershipId','')+input('Favorite driver ID','favoriteDriverId','')+textarea('Service notes','notes','',3)+'<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="sameDay" value="yes"> <span>Same-day / rush request</span></label><button style="border:0;background:#7c3aed;color:#fff;border-radius:12px;padding:10px 12px;cursor:pointer">Save website request</button></form><div class="card"><h2 style="margin:0 0 10px">Website queue + sync visibility</h2><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><span class="badge">Requests '+esc(String(readWebsiteRequests().length))+'</span><span class="badge">Sync rows '+esc(String(readSyncLedger().length))+'</span><span class="badge">Queued '+esc(String(readSyncLedger().filter(row => ['queued','awaiting_external_sync','retryable'].includes(row.status)).length))+'</span></div><table style="width:100%;border-collapse:collapse;margin-bottom:12px"><thead><tr><th>Request</th><th>Rider</th><th>Market</th><th>Service</th><th>Class</th><th>Status</th><th>Sync</th><th>Action</th></tr></thead><tbody>'+requestRowsHtml()+'</tbody></table><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><button id="wg42RetrySync" class="btn small">Run local retry pass</button><button id="wg42ExportSyncJson" class="btn small">Export sync ledger JSON</button></div><table style="width:100%;border-collapse:collapse"><thead><tr><th>Created</th><th>Kind</th><th>Status</th><th>Retries</th><th>Note</th></tr></thead><tbody>'+syncRowsHtml()+'</tbody></table></div></div>';
  }

  function bindCenter(body){
    body.addEventListener('click', (e)=>{
      const tab = e.target.closest('.wg42-tab');
      if(tab){ writeUI({ tab: tab.dataset.tab }); openCenter(); return; }
      const mat = e.target.closest('.wg42-mat');
      if(mat){
        const booking = materializeWebsiteRequest(mat.dataset.request);
        toast(booking ? 'Website request materialized into canonical booking.' : 'Materialization failed.', booking ? 'good' : 'warn');
        openCenter('website');
        return;
      }
      if(e.target.id === 'wg42RetrySync'){ const row = retryQueuedSyncRows(); toast(row.touched ? ('Local retry pass recorded on ' + row.touched + ' row(s).') : 'No queued sync rows to touch.', row.touched ? 'good' : 'warn'); openCenter('website'); return; }
      if(e.target.id === 'wg42ExportSyncJson'){ downloadText(JSON.stringify(readSyncLedger(), null, 2), 'whiteglove_sync_ledger_' + dayISO() + '.json', 'application/json'); return; }
      if(e.target.id === 'wg42SaveAnalytics'){ const row = buildAnalyticsSnapshot(); toast('White-glove analytics snapshot saved.', 'good'); openCenter('analytics'); return; }
      if(e.target.id === 'wg42ExportAnalyticsHtml'){ exportAnalyticsHtml(); return; }
      if(e.target.id === 'wg42ExportAnalyticsJson'){ exportAnalyticsJson(); return; }
      if(e.target.id === 'wg42SaveBackup'){ const row = buildBackupBundle(); toast('White-glove backup bundle saved.', 'good'); openCenter('backup'); return; }
      if(e.target.id === 'wg42ExportBackupJson'){ const row = readBackups()[0] || buildBackupBundle(); downloadText(JSON.stringify(row, null, 2), 'whiteglove_backup_bundle_' + dayISO() + '.json', 'application/json'); return; }
      if(e.target.id === 'wg42PreviewRestore'){ const form = body.querySelector('textarea[name="previewText"]'); const modeEl = body.querySelector('select[name="previewMode"]'); writeUI({ previewText: form ? form.value : '', previewMode: modeEl ? modeEl.value : 'merge' }); openCenter('backup'); return; }
      if(e.target.id === 'wg42ApplyRestore'){ const form = body.querySelector('textarea[name="previewText"]'); const modeEl = body.querySelector('select[name="previewMode"]'); const preview = previewRestore(form ? form.value : ''); if(!preview.ok){ toast(preview.error || 'Preview failed.', 'warn'); openCenter('backup'); return; } const run = applyRestore(preview, modeEl ? modeEl.value : 'merge'); toast(run ? 'White-glove restore applied.' : 'Restore failed.', run ? 'good' : 'warn'); writeUI({ previewText: form ? form.value : '', previewMode: modeEl ? modeEl.value : 'merge' }); openCenter('backup'); return; }
    });
    const form = body.querySelector('#wg42RequestForm');
    if(form){ form.onsubmit = (ev)=>{ ev.preventDefault(); const fd = Object.fromEntries(new FormData(form).entries()); fd.sameDay = fd.sameDay === 'yes'; const row = createWebsiteRequest(fd); toast(row ? 'Website request captured.' : 'Website request failed.', row ? 'good' : 'warn'); openCenter('website'); }; }
  }

  function openCenter(tab){ if(tab) writeUI({ tab }); openModal('White-glove website + analytics + restore center', buildCenterHtml(), bindCenter); }

  function inject(){
    const existing = document.getElementById('routexWg42Card');
    if(existing) existing.remove();
    const analytics = readAnalytics()[0] || null;
    const host = document.querySelector('#app') || document.body;
    const card = document.createElement('div');
    card.id = 'routexWg42Card';
    card.className = 'card';
    card.innerHTML = '<h2 style="margin:0 0 10px">White-glove website / analytics / restore</h2><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><span class="badge">Website requests '+esc(String(readWebsiteRequests().length))+'</span><span class="badge">Sync rows '+esc(String(readSyncLedger().length))+'</span><span class="badge">Analytics '+esc(String(readAnalytics().length))+'</span><span class="badge">Backups '+esc(String(readBackups().length))+'</span></div><div style="margin-bottom:12px">Routex now has a real website intake queue, sync visibility, chauffeur analytics snapshots, and backup/restore hardening for the new white-glove infrastructure.</div>' + (analytics ? '<div style="margin-bottom:12px">Latest analytics: revenue '+money(analytics.recognizedRevenue)+' • favorite match '+esc(String(analytics.favoriteDriverMatchRate))+'% • repeat rider '+esc(String(analytics.repeatRiderRate))+'%</div>' : '') + '<div style="display:flex;gap:8px;flex-wrap:wrap"><button id="routexWg42Open" class="btn small">Open center</button><button id="routexWg42Analytics" class="btn small">Save analytics</button><button id="routexWg42Backup" class="btn small">Save backup</button></div>';
    host.appendChild(card);
    card.querySelector('#routexWg42Open').onclick = ()=> openCenter('website');
    card.querySelector('#routexWg42Analytics').onclick = ()=>{ buildAnalyticsSnapshot(); toast('White-glove analytics snapshot saved.', 'good'); };
    card.querySelector('#routexWg42Backup').onclick = ()=>{ buildBackupBundle(); toast('White-glove backup bundle saved.', 'good'); };

    const toolbar = document.querySelector('#routexWorkbenchToolbar') || document.querySelector('.toolbar') || document.querySelector('.row');
    if(toolbar && !document.getElementById('routexWg42ToolbarBtn')){
      const btn = document.createElement('button');
      btn.id = 'routexWg42ToolbarBtn';
      btn.className = 'btn small';
      btn.textContent = 'White-glove ops+';
      btn.onclick = ()=> openCenter('website');
      toolbar.appendChild(btn);
    }
  }

  const observer = new MutationObserver(()=> inject());
  observer.observe(document.body, { childList:true, subtree:true });
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(inject, 0); return out; };

  window.readWhiteGloveWebsiteRequestsV42 = readWebsiteRequests;
  window.readWhiteGloveSyncLedgerV42 = readSyncLedger;
  window.readWhiteGloveAnalyticsSnapshotsV42 = readAnalytics;
  window.readWhiteGloveRestoreRunsV42 = readRestoreRuns;
  window.buildWhiteGloveAnalyticsSnapshotV42 = buildAnalyticsSnapshot;
  window.openWhiteGloveWebsiteAnalyticsCenterV42 = openCenter;
})();
