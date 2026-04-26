/* V44 Routex white-glove proof center + favorite-driver availability + restore conflict inspector */
(function(){
  if(window.__ROUTEX_WHITEGLOVE_V44__) return;
  window.__ROUTEX_WHITEGLOVE_V44__ = true;

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
  const V42 = {
    websiteRequests: 'skye_whiteglove_website_requests_v42',
    syncLedger: 'skye_whiteglove_sync_ledger_v42',
    analytics: 'skye_whiteglove_analytics_snapshots_v42',
    restoreRuns: 'skye_whiteglove_restore_runs_v42'
  };
  const KEYS = {
    availabilityPlans: 'skye_whiteglove_driver_availability_v44',
    acceptanceLog: 'skye_whiteglove_driver_acceptance_v44',
    proofPacks: 'skye_whiteglove_proof_packs_v44',
    proofOutbox: 'skye_whiteglove_proof_outbox_v44',
    validationSnapshots: 'skye_whiteglove_validation_snapshots_v44',
    validationOutbox: 'skye_whiteglove_validation_outbox_v44',
    restoreConflictReports: 'skye_whiteglove_restore_conflicts_v44',
    ui: 'skye_whiteglove_v44_ui'
  };

  const clean = (v)=> String(v == null ? '' : v).trim();
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const nowISO = ()=> new Date().toISOString();
  const dayISO = ()=> nowISO().slice(0,10);
  const uid = (p)=> (p || 'id') + '_' + Math.random().toString(36).slice(2,9) + '_' + Date.now().toString(36);
  const hash = (str)=> { let h = 2166136261; for(let i=0;i<String(str).length;i++){ h ^= String(str).charCodeAt(i); h += (h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24); } return (h>>>0).toString(36); };
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
  function norm(v){ return clean(v).toLowerCase().replace(/\s+/g, ' '); }

  const readProfiles = ()=> (window.readWhiteGloveServiceProfiles ? window.readWhiteGloveServiceProfiles() : readJSON(SHARED.profiles, []));
  const readDrivers = ()=> (window.readWhiteGloveDriverProfiles ? window.readWhiteGloveDriverProfiles() : readJSON(SHARED.drivers, []));
  const readVehicles = ()=> (window.readWhiteGloveVehicleProfiles ? window.readWhiteGloveVehicleProfiles() : readJSON(SHARED.vehicles, []));
  const readMemberships = ()=> (window.readWhiteGloveMemberships ? window.readWhiteGloveMemberships() : readJSON(SHARED.memberships, []));
  const readBookings = ()=> (window.readWhiteGloveBookings ? window.readWhiteGloveBookings() : readJSON(SHARED.bookings, []));
  const readDocs = ()=> (window.readWhiteGloveDocs ? window.readWhiteGloveDocs() : readJSON(SHARED.docs, []));
  const readExecution = ()=> (window.readWhiteGloveExecutionRowsV41 ? window.readWhiteGloveExecutionRowsV41() : readJSON(V41.execution, []));
  const readPayoutLedger = ()=> (window.readWhiteGlovePayoutLedgerV41 ? window.readWhiteGlovePayoutLedgerV41() : readJSON(V41.payoutLedger, []));
  const readWebsiteRequests = ()=> (window.readWhiteGloveWebsiteRequestsV42 ? window.readWhiteGloveWebsiteRequestsV42() : readJSON(V42.websiteRequests, []));
  const readSyncLedger = ()=> (window.readWhiteGloveSyncLedgerV42 ? window.readWhiteGloveSyncLedgerV42() : readJSON(V42.syncLedger, []));
  const readAnalytics = ()=> (window.readWhiteGloveAnalyticsSnapshotsV42 ? window.readWhiteGloveAnalyticsSnapshotsV42() : readJSON(V42.analytics, []));
  const readRestoreRuns = ()=> (window.readWhiteGloveRestoreRunsV42 ? window.readWhiteGloveRestoreRunsV42() : readJSON(V42.restoreRuns, []));
  const readAvailabilityPlans = ()=> readJSON(KEYS.availabilityPlans, []);
  const readAcceptanceLog = ()=> readJSON(KEYS.acceptanceLog, []);
  const readProofPacks = ()=> readJSON(KEYS.proofPacks, []);
  const readProofOutbox = ()=> readJSON(KEYS.proofOutbox, []);
  const readValidationSnapshots = ()=> readJSON(KEYS.validationSnapshots, []);
  const readValidationOutbox = ()=> readJSON(KEYS.validationOutbox, []);
  const readRestoreConflictReports = ()=> readJSON(KEYS.restoreConflictReports, []);
  const readUI = ()=> readJSON(KEYS.ui, { driverId:'', bookingId:'', market:'phoenix', shiftStart:'08:00', shiftEnd:'18:00', blackout:'', notes:'', reportMode:'merge' });

  const writeAvailabilityPlans = (rows)=> writeJSON(KEYS.availabilityPlans, rows);
  const writeAcceptanceLog = (rows)=> writeJSON(KEYS.acceptanceLog, rows);
  const writeProofPacks = (rows)=> writeJSON(KEYS.proofPacks, rows);
  const writeProofOutbox = (rows)=> writeJSON(KEYS.proofOutbox, rows);
  const writeValidationSnapshots = (rows)=> writeJSON(KEYS.validationSnapshots, rows);
  const writeValidationOutbox = (rows)=> writeJSON(KEYS.validationOutbox, rows);
  const writeRestoreConflictReports = (rows)=> writeJSON(KEYS.restoreConflictReports, rows);
  const writeUI = (patch)=> writeJSON(KEYS.ui, Object.assign({}, readUI(), patch || {}));

  function pushSharedEvent(type, refs, note, extra){
    const rows = readJSON(SHARED.events, []);
    rows.unshift(Object.assign({ id: uid('wg_evt44'), type: clean(type), refs: refs || {}, note: clean(note), createdAt: nowISO() }, extra || {}));
    writeJSON(SHARED.events, rows.slice(0, 1500));
  }

  function getDriver(id){ return readDrivers().find(row => row.id === id) || null; }
  function getBooking(id){ return readBookings().find(row => row.id === id) || null; }
  function getProfile(id){ return readProfiles().find(row => row.id === id) || null; }

  function saveAvailabilityPlan(payload){
    const rows = readAvailabilityPlans();
    const row = {
      id: uid('wg_avail'),
      driverId: clean(payload.driverId),
      driverName: clean(payload.driverName),
      market: clean(payload.market) || 'phoenix',
      shiftStart: clean(payload.shiftStart) || '08:00',
      shiftEnd: clean(payload.shiftEnd) || '18:00',
      blackout: clean(payload.blackout),
      notes: clean(payload.notes),
      savedAt: nowISO(),
      active: true
    };
    rows.unshift(row);
    writeAvailabilityPlans(rows.slice(0, 500));
    pushSharedEvent('whiteglove_driver_availability_saved', { driverId: row.driverId, availabilityId: row.id }, 'Driver availability plan saved', { market: row.market, shiftStart: row.shiftStart, shiftEnd: row.shiftEnd });
    return row;
  }

  function logAcceptance(payload){
    const rows = readAcceptanceLog();
    const booking = getBooking(payload.bookingId);
    const driver = getDriver(payload.driverId);
    const row = {
      id: uid('wg_accept'),
      bookingId: clean(payload.bookingId),
      driverId: clean(payload.driverId),
      action: clean(payload.action) || 'accepted',
      note: clean(payload.note),
      savedAt: nowISO(),
      bookingLabel: booking ? booking.id : clean(payload.bookingId),
      driverName: driver ? driver.displayName : clean(payload.driverName)
    };
    rows.unshift(row);
    writeAcceptanceLog(rows.slice(0, 1000));
    pushSharedEvent('whiteglove_driver_acceptance_logged', { bookingId: row.bookingId, driverId: row.driverId, acceptanceId: row.id }, 'Driver acceptance state recorded', { action: row.action });
    return row;
  }

  function collectCounts(){
    const bookings = readBookings();
    const profiles = readProfiles();
    const drivers = readDrivers();
    const vehicles = readVehicles();
    const memberships = readMemberships();
    const docs = readDocs();
    const execution = readExecution();
    const payouts = readPayoutLedger();
    const website = readWebsiteRequests();
    const sync = readSyncLedger();
    const analytics = readAnalytics();
    const restoreRuns = readRestoreRuns();
    const availability = readAvailabilityPlans();
    const acceptance = readAcceptanceLog();
    return {
      bookings, profiles, drivers, vehicles, memberships, docs, execution, payouts, website, sync, analytics, restoreRuns, availability, acceptance
    };
  }

  function driverContinuitySummary(){
    const drivers = readDrivers();
    const profiles = readProfiles();
    const bookings = readBookings();
    const availability = readAvailabilityPlans();
    const acceptance = readAcceptanceLog();
    const matched = bookings.filter(row => row.favoriteDriverState === 'matched').length;
    const unavailable = bookings.filter(row => row.favoriteDriverState === 'unavailable').length;
    const overridden = bookings.filter(row => row.favoriteDriverState === 'overridden_by_dispatch').length;
    const preferred = bookings.filter(row => row.favoriteDriverState === 'preferred').length;
    const continuityByDriver = drivers.map(driver => {
      const favCount = profiles.filter(profile => Array.isArray(profile.favoriteDriverIds) && profile.favoriteDriverIds.includes(driver.id)).length;
      const assigned = bookings.filter(row => row.assignedDriverId === driver.id).length;
      const accepted = acceptance.filter(row => row.driverId === driver.id && row.action === 'accepted').length;
      const declined = acceptance.filter(row => row.driverId === driver.id && row.action === 'declined').length;
      const activePlans = availability.filter(row => row.driverId === driver.id && row.active !== false).length;
      return { driverId: driver.id, driverName: driver.displayName, favoriteCount: favCount, assigned, accepted, declined, activePlans };
    }).sort((a,b)=> (b.favoriteCount + b.assigned) - (a.favoriteCount + a.assigned));
    return { matched, unavailable, overridden, preferred, continuityByDriver };
  }

  function buildChecklist(){
    const c = collectCounts();
    const continuity = driverContinuitySummary();
    const websiteLinked = c.bookings.filter(row => row.requestSource === 'website');
    const memberBookings = c.bookings.filter(row => clean(row.membershipId));
    const favoriteBookings = c.bookings.filter(row => clean(row.favoriteDriverId));
    const docsByBooking = c.docs.filter(row => clean(row.bookingId));
    const completed = c.bookings.filter(row => ['completed','cancelled','no_show'].includes(clean(row.dispatchStatus)));
    const checks = [
      { id:'contracts', label:'Canonical white-glove records', ok: c.profiles.length > 0 && c.drivers.length > 0 && c.vehicles.length > 0 && c.bookings.length > 0, note:'Profiles '+c.profiles.length+' • Drivers '+c.drivers.length+' • Vehicles '+c.vehicles.length+' • Bookings '+c.bookings.length },
      { id:'pricing', label:'Frozen pricing snapshot coverage', ok: c.bookings.length > 0 && c.bookings.every(row => row.pricingSnapshot && Number(row.pricingSnapshot.quotedTotal || 0) >= 0), note:c.bookings.length ? 'Pricing snapshots on '+c.bookings.filter(row => row.pricingSnapshot).length+' / '+c.bookings.length+' bookings.' : 'No bookings saved yet.' },
      { id:'favorites', label:'Favorite-driver continuity lane', ok: favoriteBookings.length > 0 || continuity.preferred + continuity.matched + continuity.unavailable + continuity.overridden > 0, note:'Favorite-state bookings '+favoriteBookings.length+' • matched '+continuity.matched+' • unavailable '+continuity.unavailable+' • overridden '+continuity.overridden },
      { id:'availability', label:'Driver availability / acceptance lane', ok: c.availability.length > 0 && c.acceptance.length > 0, note:'Availability plans '+c.availability.length+' • acceptance log rows '+c.acceptance.length },
      { id:'memberships', label:'Membership usage lane', ok: c.memberships.length > 0 && memberBookings.length > 0, note:'Memberships '+c.memberships.length+' • member-linked bookings '+memberBookings.length },
      { id:'website', label:'Website-origin booking lane', ok: c.website.length > 0 && websiteLinked.length > 0, note:'Website requests '+c.website.length+' • website-linked bookings '+websiteLinked.length },
      { id:'execution', label:'Execution + payout lane', ok: c.execution.length > 0 && c.payouts.length > 0, note:'Execution rows '+c.execution.length+' • payout rows '+c.payouts.length },
      { id:'docs', label:'Customer / operator proof docs', ok: docsByBooking.length > 0, note:'Booking-linked docs '+docsByBooking.length+' • total docs '+c.docs.length },
      { id:'analytics', label:'Analytics + sync visibility', ok: c.analytics.length > 0 && c.sync.length > 0, note:'Analytics snapshots '+c.analytics.length+' • sync rows '+c.sync.length },
      { id:'restore', label:'Restore / portability runs', ok: c.restoreRuns.length > 0, note:'Restore runs '+c.restoreRuns.length },
      { id:'closeout', label:'Closed trip coverage', ok: completed.length > 0, note:'Completed/cancelled/no-show bookings '+completed.length }
    ];
    const blockers = checks.filter(item => !item.ok).map(item => item.label + ' — ' + item.note);
    return { checks, blockers, continuity };
  }

  function buildProofPack(){
    const counts = collectCounts();
    const proof = buildChecklist();
    const latestAnalytics = counts.analytics[0] || null;
    const latestRestore = counts.restoreRuns[0] || null;
    const digest = JSON.stringify({
      checks: proof.checks.map(item => [item.id, item.ok]),
      blockers: proof.blockers,
      bookings: counts.bookings.length,
      docs: counts.docs.length,
      website: counts.website.length,
      sync: counts.sync.length,
      availability: counts.availability.length,
      acceptance: counts.acceptance.length,
      analytics: latestAnalytics && latestAnalytics.id,
      restore: latestRestore && latestRestore.id
    });
    return {
      id: uid('wg_proof'),
      label: 'White-glove proof pack • ' + dayISO(),
      source: 'routex-whiteglove-proof-pack-v44',
      fingerprint: 'wg-proof-' + dayISO() + '-' + hash(digest),
      savedAt: nowISO(),
      blockerCount: proof.blockers.length,
      ok: proof.blockers.length === 0,
      checks: proof.checks,
      blockers: proof.blockers,
      continuity: proof.continuity,
      counts: {
        profiles: counts.profiles.length,
        drivers: counts.drivers.length,
        vehicles: counts.vehicles.length,
        memberships: counts.memberships.length,
        bookings: counts.bookings.length,
        websiteRequests: counts.website.length,
        syncRows: counts.sync.length,
        docs: counts.docs.length,
        executionRows: counts.execution.length,
        payoutRows: counts.payouts.length,
        availabilityPlans: counts.availability.length,
        acceptanceRows: counts.acceptance.length,
        analyticsSnapshots: counts.analytics.length,
        restoreRuns: counts.restoreRuns.length
      },
      latestRefs: {
        analyticsId: latestAnalytics && latestAnalytics.id,
        restoreRunId: latestRestore && latestRestore.id,
        latestWebsiteRequestId: (counts.website[0] || {}).id || '',
        latestBookingId: (counts.bookings[0] || {}).id || ''
      }
    };
  }

  function pushOutboxRow(key, row){ const rows = readJSON(key, []); rows.unshift(row); writeJSON(key, rows.slice(0, 400)); }

  function saveProofPack(){
    const row = buildProofPack();
    const rows = readProofPacks();
    rows.unshift(row);
    writeProofPacks(rows.slice(0, 400));
    pushOutboxRow(KEYS.proofOutbox, row);
    pushSharedEvent('whiteglove_proof_pack_saved', { proofPackId: row.id }, 'White-glove proof pack saved', { blockerCount: row.blockerCount, fingerprint: row.fingerprint });
    return row;
  }

  function buildValidationSnapshot(){
    const counts = collectCounts();
    const continuity = driverContinuitySummary();
    const retryable = counts.sync.filter(row => ['queued','awaiting_external_sync','retryable'].includes(clean(row.status))).length;
    const activeAvail = counts.availability.filter(row => row.active !== false).length;
    const digest = JSON.stringify({ retryable, activeAvail, matched: continuity.matched, bookings: counts.bookings.length, docs: counts.docs.length, payouts: counts.payouts.length });
    return {
      id: uid('wg_validate'),
      label: 'White-glove validation snapshot • ' + dayISO(),
      source: 'routex-whiteglove-validation-v44',
      fingerprint: 'wg-validate-' + dayISO() + '-' + hash(digest),
      savedAt: nowISO(),
      syncHealth: retryable === 0 ? 'clean' : 'review',
      continuityHealth: continuity.unavailable + continuity.overridden === 0 ? 'clean' : 'review',
      notes: retryable === 0 ? 'Sync ledger is clean for locally visible rows.' : 'Sync ledger still has retryable or queued rows requiring operator review.',
      metrics: {
        retryableSyncRows: retryable,
        activeAvailabilityPlans: activeAvail,
        matchedFavoriteTrips: continuity.matched,
        unavailableFavoriteTrips: continuity.unavailable,
        overriddenFavoriteTrips: continuity.overridden,
        payouts: counts.payouts.length,
        docs: counts.docs.length,
        bookings: counts.bookings.length
      }
    };
  }

  function saveValidationSnapshot(){
    const row = buildValidationSnapshot();
    const rows = readValidationSnapshots();
    rows.unshift(row);
    writeValidationSnapshots(rows.slice(0, 400));
    pushOutboxRow(KEYS.validationOutbox, row);
    pushSharedEvent('whiteglove_validation_snapshot_saved', { validationId: row.id }, 'White-glove validation snapshot saved', { fingerprint: row.fingerprint, syncHealth: row.syncHealth });
    return row;
  }

  function buildRestoreConflictReport(){
    const profiles = readProfiles();
    const drivers = readDrivers();
    const bookings = readBookings();
    const dupProfiles = [];
    const seenProfiles = {};
    profiles.forEach(row => {
      const key = [norm(row.email), norm(row.primaryPhone), norm(row.displayName)].filter(Boolean).join('|');
      if(!key) return;
      if(seenProfiles[key]) dupProfiles.push([seenProfiles[key], row.id]);
      else seenProfiles[key] = row.id;
    });
    const dupDrivers = [];
    const seenDrivers = {};
    drivers.forEach(row => {
      const key = [norm(row.displayName), norm(row.primaryPhone)].filter(Boolean).join('|');
      if(!key) return;
      if(seenDrivers[key]) dupDrivers.push([seenDrivers[key], row.id]);
      else seenDrivers[key] = row.id;
    });
    const brokenBookings = bookings.filter(row => (clean(row.serviceProfileId) && !getProfile(row.serviceProfileId)) || (clean(row.assignedDriverId) && !getDriver(row.assignedDriverId)));
    const orphanDocs = readDocs().filter(row => clean(row.bookingId) && !getBooking(row.bookingId));
    const report = {
      id: uid('wg_conflict'),
      label: 'White-glove restore conflict report • ' + dayISO(),
      source: 'routex-whiteglove-restore-conflicts-v44',
      savedAt: nowISO(),
      profileDuplicatePairs: dupProfiles,
      driverDuplicatePairs: dupDrivers,
      brokenBookingLinks: brokenBookings.map(row => ({ bookingId: row.id, serviceProfileId: row.serviceProfileId, assignedDriverId: row.assignedDriverId })),
      orphanDocs: orphanDocs.map(row => ({ docId: row.id, bookingId: row.bookingId, kind: row.kind || row.type || 'doc' })),
      summary: {
        profileDuplicates: dupProfiles.length,
        driverDuplicates: dupDrivers.length,
        brokenBookingLinks: brokenBookings.length,
        orphanDocs: orphanDocs.length
      }
    };
    return report;
  }

  function saveRestoreConflictReport(){
    const report = buildRestoreConflictReport();
    const rows = readRestoreConflictReports();
    rows.unshift(report);
    writeRestoreConflictReports(rows.slice(0, 200));
    pushSharedEvent('whiteglove_restore_conflict_report_saved', { reportId: report.id }, 'White-glove restore conflict report saved', report.summary);
    return report;
  }

  function proofHtml(row){
    row = row || readProofPacks()[0] || saveProofPack();
    const checks = (row.checks || []).map(item => '<tr><td>'+esc(item.label)+'</td><td>'+(item.ok ? 'PASS' : 'REVIEW')+'</td><td>'+esc(item.note || '')+'</td></tr>').join('');
    const blockers = (row.blockers || []).map(item => '<li>'+esc(item)+'</li>').join('');
    const continuityRows = ((row.continuity || {}).continuityByDriver || []).slice(0, 12).map(item => '<tr><td>'+esc(item.driverName || '—')+'</td><td>'+esc(String(item.favoriteCount || 0))+'</td><td>'+esc(String(item.assigned || 0))+'</td><td>'+esc(String(item.accepted || 0))+'</td><td>'+esc(String(item.declined || 0))+'</td><td>'+esc(String(item.activePlans || 0))+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>White-glove proof pack</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1180px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.18);border-radius:999px;margin:0 6px 6px 0}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}ul{padding-left:18px}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">Routex • White-glove proof pack</h1><div><span class="badge">'+esc(row.fingerprint || '—')+'</span><span class="badge">Blockers '+esc(String(row.blockerCount || 0))+'</span><span class="badge">'+(row.ok ? 'GREEN' : 'ACTION REQUIRED')+'</span></div><p style="margin:12px 0 0;">This pack documents the code-side white-glove infrastructure coverage currently visible inside the app.</p></div><div class="card"><h2 style="margin:0 0 8px;">Checklist</h2><table><thead><tr><th>Lane</th><th>Status</th><th>Note</th></tr></thead><tbody>'+checks+'</tbody></table></div><div class="card"><h2 style="margin:0 0 8px;">Blockers</h2>'+(blockers ? '<ul>'+blockers+'</ul>' : '<div>No blockers.</div>')+'</div><div class="card"><h2 style="margin:0 0 8px;">Driver continuity summary</h2><table><thead><tr><th>Driver</th><th>Favorites</th><th>Assigned</th><th>Accepted</th><th>Declined</th><th>Availability plans</th></tr></thead><tbody>'+(continuityRows || '<tr><td colspan="6">No driver continuity rows yet.</td></tr>')+'</tbody></table></div></div></body></html>';
  }

  function validationHtml(row){
    row = row || readValidationSnapshots()[0] || saveValidationSnapshot();
    const m = row.metrics || {};
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>White-glove validation snapshot</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:980px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.18);border-radius:999px;margin:0 6px 6px 0}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">Routex • White-glove validation snapshot</h1><div><span class="badge">'+esc(row.fingerprint || '—')+'</span><span class="badge">Sync '+esc(row.syncHealth || '—')+'</span><span class="badge">Continuity '+esc(row.continuityHealth || '—')+'</span></div><p style="margin:12px 0 0;">'+esc(row.notes || '')+'</p></div><div class="card"><table><tbody><tr><td>Retryable sync rows</td><td>'+esc(String(m.retryableSyncRows || 0))+'</td></tr><tr><td>Active availability plans</td><td>'+esc(String(m.activeAvailabilityPlans || 0))+'</td></tr><tr><td>Matched favorite trips</td><td>'+esc(String(m.matchedFavoriteTrips || 0))+'</td></tr><tr><td>Unavailable favorite trips</td><td>'+esc(String(m.unavailableFavoriteTrips || 0))+'</td></tr><tr><td>Overridden favorite trips</td><td>'+esc(String(m.overriddenFavoriteTrips || 0))+'</td></tr><tr><td>Bookings</td><td>'+esc(String(m.bookings || 0))+'</td></tr><tr><td>Docs</td><td>'+esc(String(m.docs || 0))+'</td></tr><tr><td>Payouts</td><td>'+esc(String(m.payouts || 0))+'</td></tr></tbody></table></div></div></body></html>';
  }

  function conflictHtml(row){
    row = row || readRestoreConflictReports()[0] || saveRestoreConflictReport();
    const profilePairs = (row.profileDuplicatePairs || []).map(pair => '<li>'+esc(pair.join(' ↔ '))+'</li>').join('');
    const driverPairs = (row.driverDuplicatePairs || []).map(pair => '<li>'+esc(pair.join(' ↔ '))+'</li>').join('');
    const broken = (row.brokenBookingLinks || []).map(item => '<tr><td>'+esc(item.bookingId)+'</td><td>'+esc(item.serviceProfileId || '—')+'</td><td>'+esc(item.assignedDriverId || '—')+'</td></tr>').join('');
    const orphan = (row.orphanDocs || []).map(item => '<tr><td>'+esc(item.docId)+'</td><td>'+esc(item.bookingId || '—')+'</td><td>'+esc(item.kind || 'doc')+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>White-glove restore conflict report</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1100px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.18);border-radius:999px;margin:0 6px 6px 0}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}ul{padding-left:18px}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">Routex • White-glove restore conflict report</h1><div><span class="badge">Profiles dupes '+esc(String((row.summary || {}).profileDuplicates || 0))+'</span><span class="badge">Drivers dupes '+esc(String((row.summary || {}).driverDuplicates || 0))+'</span><span class="badge">Broken booking links '+esc(String((row.summary || {}).brokenBookingLinks || 0))+'</span><span class="badge">Orphan docs '+esc(String((row.summary || {}).orphanDocs || 0))+'</span></div></div><div class="card"><h2 style="margin:0 0 8px;">Duplicate service profiles</h2>'+(profilePairs ? '<ul>'+profilePairs+'</ul>' : '<div>No duplicate profile pairs detected.</div>')+'</div><div class="card"><h2 style="margin:0 0 8px;">Duplicate drivers</h2>'+(driverPairs ? '<ul>'+driverPairs+'</ul>' : '<div>No duplicate driver pairs detected.</div>')+'</div><div class="card"><h2 style="margin:0 0 8px;">Broken booking links</h2><table><thead><tr><th>Booking</th><th>Service profile</th><th>Driver</th></tr></thead><tbody>'+(broken || '<tr><td colspan="3">No broken booking links.</td></tr>')+'</tbody></table></div><div class="card"><h2 style="margin:0 0 8px;">Orphan docs</h2><table><thead><tr><th>Doc</th><th>Booking</th><th>Kind</th></tr></thead><tbody>'+(orphan || '<tr><td colspan="3">No orphan docs.</td></tr>')+'</tbody></table></div></div></body></html>';
  }

  function exportProofHtml(){ const row = readProofPacks()[0] || saveProofPack(); downloadText(proofHtml(row), 'whiteglove_proof_pack_' + dayISO() + '.html', 'text/html'); }
  function exportProofJson(){ const row = readProofPacks()[0] || saveProofPack(); downloadText(JSON.stringify(row, null, 2), 'whiteglove_proof_pack_' + dayISO() + '.json', 'application/json'); }
  function exportValidationHtml(){ const row = readValidationSnapshots()[0] || saveValidationSnapshot(); downloadText(validationHtml(row), 'whiteglove_validation_snapshot_' + dayISO() + '.html', 'text/html'); }
  function exportValidationJson(){ const row = readValidationSnapshots()[0] || saveValidationSnapshot(); downloadText(JSON.stringify(row, null, 2), 'whiteglove_validation_snapshot_' + dayISO() + '.json', 'application/json'); }
  function exportConflictHtml(){ const row = readRestoreConflictReports()[0] || saveRestoreConflictReport(); downloadText(conflictHtml(row), 'whiteglove_restore_conflicts_' + dayISO() + '.html', 'text/html'); }
  function exportConflictJson(){ const row = readRestoreConflictReports()[0] || saveRestoreConflictReport(); downloadText(JSON.stringify(row, null, 2), 'whiteglove_restore_conflicts_' + dayISO() + '.json', 'application/json'); }

  function availabilityTable(){
    const plans = readAvailabilityPlans().slice(0, 8);
    return plans.length ? ('<table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Driver</th><th>Market</th><th>Shift</th><th>Blackout</th></tr></thead><tbody>' + plans.map(row => '<tr><td>'+esc(row.driverName || row.driverId)+'</td><td>'+esc(row.market || '—')+'</td><td>'+esc(row.shiftStart || '—')+' → '+esc(row.shiftEnd || '—')+'</td><td>'+esc(row.blackout || '—')+'</td></tr>').join('') + '</tbody></table>') : '<div>No driver availability plans saved yet.</div>';
  }

  function acceptanceTable(){
    const rows = readAcceptanceLog().slice(0, 8);
    return rows.length ? ('<table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Booking</th><th>Driver</th><th>Action</th><th>Note</th></tr></thead><tbody>' + rows.map(row => '<tr><td>'+esc(row.bookingLabel || row.bookingId)+'</td><td>'+esc(row.driverName || row.driverId)+'</td><td>'+esc(row.action || '—')+'</td><td>'+esc(row.note || '—')+'</td></tr>').join('') + '</tbody></table>') : '<div>No driver acceptance records saved yet.</div>';
  }

  function makeSelectOptions(rows, emptyLabel, labelFn){
    const opts = ['<option value="">'+esc(emptyLabel || 'Select')+'</option>'];
    rows.forEach(row => opts.push('<option value="'+esc(row.id)+'">'+esc(labelFn(row))+'</option>'));
    return opts.join('');
  }

  function inject(){
    const ui = readUI();
    const proof = readProofPacks()[0] || null;
    const validation = readValidationSnapshots()[0] || null;
    const conflicts = readRestoreConflictReports()[0] || null;
    const drivers = readDrivers();
    const bookings = readBookings().slice(0, 60);
    const existing = document.getElementById('routexWhiteGloveProofCenterV44');
    if(existing) existing.remove();
    const host = document.querySelector('#app') || document.body;
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'routexWhiteGloveProofCenterV44';
    card.innerHTML = ''+
      '<h2 style="margin:0 0 10px;">White-glove proof + assignment center</h2>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">'+
        '<button class="btn small" id="wgV44SaveProofBtn">Save proof pack</button>'+
        '<button class="btn small" id="wgV44ProofHtmlBtn">Export proof HTML</button>'+
        '<button class="btn small" id="wgV44ProofJsonBtn">Export proof JSON</button>'+
        '<button class="btn small" id="wgV44SaveValidationBtn">Save validation snapshot</button>'+
        '<button class="btn small" id="wgV44ValidationHtmlBtn">Export validation HTML</button>'+
        '<button class="btn small" id="wgV44ValidationJsonBtn">Export validation JSON</button>'+
        '<button class="btn small" id="wgV44ScanConflictsBtn">Scan restore conflicts</button>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;">'+
        '<section style="border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;background:rgba(255,255,255,.03);">'+
          '<h3 style="margin:0 0 8px;">Latest proof pack</h3>'+
          (proof ? ('<div><span class="badge">'+esc(proof.fingerprint || '—')+'</span><span class="badge">Blockers '+esc(String(proof.blockerCount || 0))+'</span><span class="badge">'+(proof.ok ? 'GREEN' : 'ACTION REQUIRED')+'</span></div><div style="margin-top:8px;">Top blocker: '+esc((proof.blockers || [])[0] || 'None')+'</div>') : '<div>No white-glove proof pack saved yet.</div>')+
        '</section>'+
        '<section style="border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;background:rgba(255,255,255,.03);">'+
          '<h3 style="margin:0 0 8px;">Latest validation snapshot</h3>'+
          (validation ? ('<div><span class="badge">'+esc(validation.fingerprint || '—')+'</span><span class="badge">Sync '+esc(validation.syncHealth || '—')+'</span><span class="badge">Continuity '+esc(validation.continuityHealth || '—')+'</span></div><div style="margin-top:8px;">'+esc(validation.notes || '')+'</div>') : '<div>No validation snapshot saved yet.</div>')+
        '</section>'+
        '<section style="border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;background:rgba(255,255,255,.03);">'+
          '<h3 style="margin:0 0 8px;">Restore conflict inspector</h3>'+
          (conflicts ? ('<div><span class="badge">Profiles dupes '+esc(String((conflicts.summary || {}).profileDuplicates || 0))+'</span><span class="badge">Drivers dupes '+esc(String((conflicts.summary || {}).driverDuplicates || 0))+'</span></div><div style="margin-top:8px;">Broken links '+esc(String((conflicts.summary || {}).brokenBookingLinks || 0))+' • Orphan docs '+esc(String((conflicts.summary || {}).orphanDocs || 0))+'</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;"><button class="btn small" id="wgV44ConflictHtmlBtn">Export conflicts HTML</button><button class="btn small" id="wgV44ConflictJsonBtn">Export conflicts JSON</button></div>') : '<div>No restore conflict report saved yet.</div>')+
        '</section>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px;margin-top:14px;">'+
        '<section style="border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;background:rgba(255,255,255,.03);">'+
          '<h3 style="margin:0 0 8px;">Driver availability planner</h3>'+
          '<label style="display:block;font-size:.85rem;color:#c7ced8;margin-bottom:6px;">Driver</label>'+
          '<select id="wgV44DriverSelect" class="input" style="width:100%;margin-bottom:8px;">'+makeSelectOptions(drivers, 'Select driver', row => row.displayName || row.id)+'</select>'+
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">'+
            '<input id="wgV44MarketInput" class="input" placeholder="Market" value="'+esc(ui.market || 'phoenix')+'" />'+
            '<input id="wgV44BlackoutInput" class="input" placeholder="Blackout note" value="'+esc(ui.blackout || '')+'" />'+
            '<input id="wgV44ShiftStartInput" class="input" placeholder="Shift start" value="'+esc(ui.shiftStart || '08:00')+'" />'+
            '<input id="wgV44ShiftEndInput" class="input" placeholder="Shift end" value="'+esc(ui.shiftEnd || '18:00')+'" />'+
          '</div>'+
          '<textarea id="wgV44AvailabilityNotes" class="input" rows="3" style="width:100%;margin-top:8px;" placeholder="Notes">'+esc(ui.notes || '')+'</textarea>'+
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;"><button class="btn small" id="wgV44SaveAvailabilityBtn">Save availability plan</button></div>'+
          '<div style="margin-top:10px;max-height:220px;overflow:auto;">'+availabilityTable()+'</div>'+
        '</section>'+
        '<section style="border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;background:rgba(255,255,255,.03);">'+
          '<h3 style="margin:0 0 8px;">Favorite-driver acceptance log</h3>'+
          '<label style="display:block;font-size:.85rem;color:#c7ced8;margin-bottom:6px;">Booking</label>'+
          '<select id="wgV44BookingSelect" class="input" style="width:100%;margin-bottom:8px;">'+makeSelectOptions(bookings, 'Select booking', row => row.id + ' • ' + (row.serviceProfileName || row.serviceType || 'booking'))+'</select>'+
          '<label style="display:block;font-size:.85rem;color:#c7ced8;margin-bottom:6px;">Driver</label>'+
          '<select id="wgV44AcceptanceDriverSelect" class="input" style="width:100%;margin-bottom:8px;">'+makeSelectOptions(drivers, 'Select driver', row => row.displayName || row.id)+'</select>'+
          '<textarea id="wgV44AcceptanceNote" class="input" rows="3" style="width:100%;" placeholder="Dispatch note / continuity note"></textarea>'+
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">'+
            '<button class="btn small" id="wgV44AcceptedBtn">Log accepted</button>'+
            '<button class="btn small" id="wgV44DeclinedBtn">Log declined</button>'+
            '<button class="btn small" id="wgV44OverrideBtn">Log override</button>'+
          '</div>'+
          '<div style="margin-top:10px;max-height:220px;overflow:auto;">'+acceptanceTable()+'</div>'+
        '</section>'+
      '</div>';
    host.appendChild(card);

    const byId = (id)=> document.getElementById(id);
    const bind = (id, fn)=> { const el = byId(id); if(el) el.onclick = fn; };
    bind('wgV44SaveProofBtn', ()=>{ const row = saveProofPack(); toast(row.ok ? 'White-glove proof pack saved.' : 'White-glove proof pack saved with blockers.', row.ok ? 'good' : 'warn'); inject(); });
    bind('wgV44ProofHtmlBtn', exportProofHtml);
    bind('wgV44ProofJsonBtn', exportProofJson);
    bind('wgV44SaveValidationBtn', ()=>{ const row = saveValidationSnapshot(); toast('White-glove validation snapshot saved.', row.syncHealth === 'clean' ? 'good' : 'warn'); inject(); });
    bind('wgV44ValidationHtmlBtn', exportValidationHtml);
    bind('wgV44ValidationJsonBtn', exportValidationJson);
    bind('wgV44ScanConflictsBtn', ()=>{ const row = saveRestoreConflictReport(); toast('White-glove restore conflict report saved.', (row.summary.brokenBookingLinks || row.summary.orphanDocs || row.summary.profileDuplicates || row.summary.driverDuplicates) ? 'warn' : 'good'); inject(); });
    bind('wgV44ConflictHtmlBtn', exportConflictHtml);
    bind('wgV44ConflictJsonBtn', exportConflictJson);
    bind('wgV44SaveAvailabilityBtn', ()=>{
      const driverId = clean((byId('wgV44DriverSelect') || {}).value);
      const driver = getDriver(driverId);
      if(!driverId || !driver){ toast('Select a driver first.', 'warn'); return; }
      const payload = {
        driverId,
        driverName: driver.displayName,
        market: clean((byId('wgV44MarketInput') || {}).value),
        blackout: clean((byId('wgV44BlackoutInput') || {}).value),
        shiftStart: clean((byId('wgV44ShiftStartInput') || {}).value),
        shiftEnd: clean((byId('wgV44ShiftEndInput') || {}).value),
        notes: clean((byId('wgV44AvailabilityNotes') || {}).value)
      };
      saveAvailabilityPlan(payload);
      writeUI(payload);
      toast('Driver availability plan saved.', 'good');
      inject();
    });
    const logAction = (action)=>{
      const bookingId = clean((byId('wgV44BookingSelect') || {}).value);
      const driverId = clean((byId('wgV44AcceptanceDriverSelect') || {}).value);
      const driver = getDriver(driverId);
      if(!bookingId || !driverId || !driver){ toast('Select both booking and driver.', 'warn'); return; }
      const note = clean((byId('wgV44AcceptanceNote') || {}).value);
      logAcceptance({ bookingId, driverId, driverName: driver.displayName, action, note });
      toast('Driver '+action+' logged.', action === 'accepted' ? 'good' : 'warn');
      inject();
    };
    bind('wgV44AcceptedBtn', ()=> logAction('accepted'));
    bind('wgV44DeclinedBtn', ()=> logAction('declined'));
    bind('wgV44OverrideBtn', ()=> logAction('overridden_by_dispatch'));
  }

  const observer = new MutationObserver(()=> inject());
  observer.observe(document.body, { childList:true, subtree:true });
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(inject, 0); return out; };

  window.readWhiteGloveDriverAvailabilityV44 = readAvailabilityPlans;
  window.readWhiteGloveAcceptanceLogV44 = readAcceptanceLog;
  window.readWhiteGloveProofPacksV44 = readProofPacks;
  window.readWhiteGloveValidationSnapshotsV44 = readValidationSnapshots;
  window.readWhiteGloveRestoreConflictReportsV44 = readRestoreConflictReports;
  window.saveWhiteGloveProofPackV44 = saveProofPack;
  window.saveWhiteGloveValidationSnapshotV44 = saveValidationSnapshot;
  window.saveWhiteGloveRestoreConflictReportV44 = saveRestoreConflictReport;
})();
