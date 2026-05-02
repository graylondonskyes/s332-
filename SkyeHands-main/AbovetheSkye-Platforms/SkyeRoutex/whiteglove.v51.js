/* V51 Routex white-glove operator deck + duplication + merge policy + walkthrough coverage */
(function(){
  if(window.__ROUTEX_WHITEGLOVE_V51__) return;
  window.__ROUTEX_WHITEGLOVE_V51__ = true;

  const STORAGE = {
    profiles: 'skye_whiteglove_service_profiles_v39',
    drivers: 'skye_whiteglove_driver_profiles_v39',
    vehicles: 'skye_whiteglove_vehicle_profiles_v39',
    memberships: 'skye_whiteglove_memberships_v39',
    bookings: 'skye_whiteglove_bookings_v39',
    docs: 'skye_whiteglove_docs_v39',
    execution: 'skye_whiteglove_execution_rows_v41',
    payouts: 'skye_whiteglove_payout_ledger_v41',
    websiteRequests: 'skye_whiteglove_website_requests_v42',
    syncLedger: 'skye_whiteglove_sync_ledger_v42',
    analytics: 'skye_whiteglove_analytics_snapshots_v42',
    restoreRuns: 'skye_whiteglove_restore_runs_v42',
    acceptanceRuns: 'skye_whiteglove_acceptance_runs_v45',
    proofPacks: 'skye_whiteglove_proof_packs_v44',
    validation: 'skye_whiteglove_validation_snapshots_v44',
    conflicts: 'skye_whiteglove_conflict_snapshots_v46',
    routePlans: 'skye_whiteglove_route_plans_v47',
    profitability: 'skye_whiteglove_profitability_compare_v47',
    adjustments: 'skye_whiteglove_adjustments_v48',
    command: 'skye_whiteglove_command_snapshots_v48',
    backendSnapshots: 'skye_whiteglove_backend_snapshots_v50',
    mergeRuns: 'skye_whiteglove_merge_runs_v50',
    deckSnapshots: 'skye_whiteglove_operator_decks_v51',
    deckOutbox: 'skye_whiteglove_operator_deck_outbox_v51',
    duplicateRuns: 'skye_whiteglove_duplication_runs_v51',
    duplicateOutbox: 'skye_whiteglove_duplication_outbox_v51',
    mergePolicyRuns: 'skye_whiteglove_merge_policy_runs_v51',
    mergePolicyOutbox: 'skye_whiteglove_merge_policy_outbox_v51',
    ui: 'skye_whiteglove_v51_ui'
  };
  const KNOWN = ['profiles','drivers','vehicles','memberships','bookings','docs','execution','payouts','websiteRequests','syncLedger','analytics','restoreRuns','acceptanceRuns','proofPacks','validation','conflicts','routePlans','profitability','adjustments','command'];
  const clean = (v)=> String(v == null ? '' : v).trim();
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const nowISO = ()=> new Date().toISOString();
  const dayISO = ()=> nowISO().slice(0,10);
  const uid = (p)=> (p || 'id') + '_' + Math.random().toString(36).slice(2,9) + '_' + Date.now().toString(36);
  const money = (n)=> '$' + Number(n || 0).toFixed(2);
  const toast = window.toast || function(msg){ try{ console.log(msg); }catch(_){} };
  const downloadText = window.downloadText || function(content, filename, type){
    const blob = new Blob([content], { type: type || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename || 'download.txt'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 1200);
  };
  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){ } return value; }
  function readRows(name){ return readJSON(STORAGE[name], []); }
  function writeRows(name, rows){ return writeJSON(STORAGE[name], Array.isArray(rows) ? rows : []); }
  function readUI(){ return readJSON(STORAGE.ui, { bookingId:'', duplicateMode:'next_day_repeat', mergePolicy:'merge_newer', importText:'' }); }
  function writeUI(patch){ return writeJSON(STORAGE.ui, Object.assign({}, readUI(), patch || {})); }
  function getBooking(id){ return readRows('bookings').find(row => clean(row.id) === clean(id)) || null; }
  function getProfile(id){ return readRows('profiles').find(row => clean(row.id) === clean(id)) || null; }
  function pushOutbox(key, row, limit){ const rows = readJSON(key, []); rows.unshift(row); writeJSON(key, rows.slice(0, limit || 400)); }
  function toNum(v, fallback){ const n = Number(v); return Number.isFinite(n) ? n : Number(fallback || 0); }
  function stamp(){ return { createdAt: nowISO(), updatedAt: nowISO() }; }
  function parseStops(text){ return clean(text).split(/\n+|\s*->\s*|\s*>\s*|\s*\|\s*/).map(clean).filter(Boolean); }
  function buildMaterializedRoute(booking){
    const stops = parseStops(booking.multiStopText || '');
    const legs = [];
    let current = clean(booking.pickupAddress || 'Pickup');
    let order = 1;
    stops.forEach((stop, idx) => { legs.push({ id:uid('wg_leg51'), label:'Service stop ' + (idx + 1), from:current, to:stop, kind:'service_stop', order:order++, direction:'outbound' }); current = stop; });
    const drop = clean(booking.dropoffAddress || 'Dropoff');
    legs.push({ id:uid('wg_leg51'), label:'Primary dropoff', from:current, to:drop, kind:'dropoff', order:order++, direction:'outbound' });
    const standby = toNum(booking.standbyMinutesPlanned || 0, 0);
    if(standby > 0 || clean(booking.serviceType) === 'hourly_standby') legs.push({ id:uid('wg_leg51'), label:'Standby hold', from:drop, to:drop, kind:'standby_hold', standbyMinutes:standby, order:order++, direction:'service' });
    if(booking.returnLeg){
      let back = drop;
      stops.slice().reverse().forEach((stop, idx) => { legs.push({ id:uid('wg_leg51'), label:'Return stop ' + (idx + 1), from:back, to:stop, kind:'return_stop', order:order++, direction:'return' }); back = stop; });
      legs.push({ id:uid('wg_leg51'), label:'Return to pickup', from:back, to:clean(booking.pickupAddress || 'Pickup'), kind:'return_complete', order:order++, direction:'return' });
    }
    return {
      routeFingerprint:[booking.pickupAddress, booking.dropoffAddress, stops.join('|'), booking.returnLeg ? 'return' : 'oneway', String(standby)].join('::'),
      routeStopSequence:[clean(booking.pickupAddress||'')].concat(stops).concat([clean(booking.dropoffAddress||'')]).filter(Boolean),
      routeStopSequenceDetailed: legs.map(leg => ({ label:leg.label, from:leg.from, to:leg.to, kind:leg.kind, direction:leg.direction || '', standbyMinutes:toNum(leg.standbyMinutes || 0, 0) })),
      routeLegCount: legs.length,
      routeStopCount: stops.length,
      routeReturnLegBuilt: !!booking.returnLeg,
      standbyMinutesPlanned: standby,
      legs
    };
  }
  function bookingOptions(){ return readRows('bookings').map(row => ({ id: row.id, label:[row.serviceProfileName || (getProfile(row.serviceProfileId)||{}).displayName || row.id, row.serviceType || 'ride', row.dispatchStatus || row.status || 'status'].join(' • ') })); }
  function baseDeck(){
    const bookings = readRows('bookings');
    const memberships = readRows('memberships');
    const drivers = readRows('drivers');
    const vehicles = readRows('vehicles');
    const analytics = readRows('analytics')[0] || {};
    const conflicts = readRows('conflicts')[0] || {};
    const command = readRows('command')[0] || {};
    const backend = readRows('backendSnapshots')[0] || {};
    const payouts = readRows('payouts');
    const adjustments = readRows('adjustments');
    const restoreRuns = readRows('restoreRuns');
    const mergeRuns = readRows('mergeRuns');
    const acceptanceRuns = readRows('acceptanceRuns');
    const proofPacks = readRows('proofPacks');
    const validation = readRows('validation');
    const websiteRequests = readRows('websiteRequests');
    const syncLedger = readRows('syncLedger');
    const routePlans = readRows('routePlans');
    const profitability = readRows('profitability');
    const live = bookings.filter(row => ['confirmed','assigned','en_route','arrived','rider_boarded','in_service'].includes(clean(row.dispatchStatus || row.status).toLowerCase()));
    const memberBookings = bookings.filter(row => /member|included/i.test(clean(row.billingMode || ''))).length;
    const retailBookings = bookings.length - memberBookings;
    const waitRevenue = bookings.reduce((sum,row)=> sum + toNum(row.finalEconomics && row.finalEconomics.waitRevenue || 0, 0), 0);
    const overageRevenue = bookings.reduce((sum,row)=> sum + toNum(row.finalEconomics && row.finalEconomics.overageRevenue || row.pricingSnapshot && row.pricingSnapshot.overageRevenue || 0, 0), 0);
    const payoutLiability = payouts.reduce((sum,row)=> sum + toNum(row.totalPayout || row.payoutAmount || row.amount || 0, 0), 0);
    const recognizedRevenue = bookings.reduce((sum,row)=> sum + toNum(row.finalEconomics && row.finalEconomics.adjustedRecognizedRevenue || row.pricingSnapshot && row.pricingSnapshot.quotedTotal || 0, 0), 0) + adjustments.filter(r=> clean(r.type)==='credit').reduce((s,r)=> s + toNum(r.amount || 0,0),0) - adjustments.filter(r=> clean(r.type)==='refund').reduce((s,r)=> s + toNum(r.amount || 0,0),0);
    const favoriteMatched = bookings.filter(row => clean(row.favoriteDriverState)==='matched').length;
    const continuityRate = analytics.driverContinuityScore || analytics.repeatRiderRate || 0;
    return {
      id: uid('wg_deck51'),
      createdAt: nowISO(),
      fingerprint: 'WG-DECK-V51-' + nowISO().replace(/[:.TZ-]/g,'').slice(0,12),
      totals: {
        bookings: bookings.length,
        liveBookings: live.length,
        members: memberships.length,
        drivers: drivers.length,
        vehicles: vehicles.length,
        websiteRequests: websiteRequests.length,
        syncQueue: syncLedger.length,
        routePlans: routePlans.length,
        restoreRuns: restoreRuns.length,
        mergeRuns: mergeRuns.length,
        acceptanceRuns: acceptanceRuns.length,
        proofPacks: proofPacks.length,
        validationSnapshots: validation.length,
        conflicts: readRows('conflicts').length
      },
      economics: {
        recognizedRevenue: Number(recognizedRevenue.toFixed(2)),
        waitRevenue: Number(waitRevenue.toFixed(2)),
        overageRevenue: Number(overageRevenue.toFixed(2)),
        payoutLiability: Number(payoutLiability.toFixed(2)),
        estimatedNet: Number((recognizedRevenue - payoutLiability).toFixed(2)),
        adjustmentRows: adjustments.length,
        profitabilityRows: profitability.length
      },
      continuity: {
        memberBookings,
        retailBookings,
        favoriteMatched,
        continuityRate,
        repeatRiderRate: analytics.repeatRiderRate || 0,
        favoriteMatchRate: analytics.favoriteDriverMatchRate || 0
      },
      risk: {
        severeConflicts: conflicts.high || conflicts.severe || backend.severeConflicts || 0,
        syncQueue: syncLedger.length,
        restoreWarnings: restoreRuns.filter(r => (r.duplicateServiceProfiles || 0) || (r.duplicateDrivers || 0) || (r.orphanDocs || 0)).length,
        mergeWarnings: mergeRuns.length
      },
      references: {
        commandSnapshotId: command.id || '',
        backendSnapshotId: backend.id || '',
        latestAcceptanceId: (acceptanceRuns[0] || {}).id || '',
        latestProofPackId: (proofPacks[0] || {}).id || '',
        latestValidationId: (validation[0] || {}).id || ''
      },
      topActions: []
    };
  }
  function buildOperatorDeck(){
    const deck = baseDeck();
    const actions = [];
    if(deck.risk.severeConflicts > 0) actions.push({ priority:'high', label:'Resolve severe dispatch conflicts', reason:'High-risk booking overlap still exists.' });
    if(deck.risk.syncQueue > 0) actions.push({ priority:'high', label:'Drain sync queue', reason:'Website or restore actions are queued locally.' });
    if(deck.continuity.favoriteMatchRate < 70 && deck.totals.bookings > 0) actions.push({ priority:'med', label:'Review favorite-driver continuity', reason:'Preferred-driver continuity is below target.' });
    if(deck.totals.acceptanceRuns === 0) actions.push({ priority:'med', label:'Run white-glove acceptance harness', reason:'No stored acceptance run found.' });
    if(deck.totals.validationSnapshots === 0) actions.push({ priority:'med', label:'Save validation snapshot', reason:'No stored white-glove validation snapshot found.' });
    if(!actions.length) actions.push({ priority:'low', label:'Deck is green', reason:'Core backend, finance, continuity, and merge signals are in clean shape.' });
    deck.topActions = actions;
    const rows = readRows('deckSnapshots'); rows.unshift(deck); writeRows('deckSnapshots', rows.slice(0, 300));
    pushOutbox(STORAGE.deckOutbox, { id: uid('wg_deck_out51'), deckId: deck.id, createdAt: deck.createdAt, estimatedNet: deck.economics.estimatedNet, severeConflicts: deck.risk.severeConflicts }, 300);
    return deck;
  }
  function safeIso(row){ return clean(row && (row.updatedAt || row.createdAt || row.savedAt || row.now || row.at)); }
  function newer(a,b){ const da = safeIso(a); const db = safeIso(b); return da && db ? da > db : !!da; }
  function normalizeRows(value){ return Array.isArray(value) ? value.filter(Boolean).map(row => typeof row === 'object' && row ? Object.assign({}, row) : {}) : []; }
  function summarizeRows(rows){
    const ids = new Set();
    let duplicateIds = 0;
    normalizeRows(rows).forEach(row => { const id = clean(row.id); if(!id) return; if(ids.has(id)) duplicateIds += 1; ids.add(id); });
    return { rows: normalizeRows(rows).length, distinctIds: ids.size, duplicateIds };
  }
  function mergedRefs(payload){
    const refs = { profiles:new Set(), drivers:new Set(), vehicles:new Set(), memberships:new Set() };
    ['profiles','drivers','vehicles','memberships'].forEach(name => {
      const rows = normalizeRows(payload[name] || readRows(name));
      rows.forEach(row => refs[name].add(clean(row.id)));
    });
    return refs;
  }
  function analyzeOrphans(bookings, refs){
    let missingProfiles = 0, missingDrivers = 0, missingVehicles = 0, missingMemberships = 0;
    normalizeRows(bookings).forEach(row => {
      if(clean(row.serviceProfileId) && !refs.profiles.has(clean(row.serviceProfileId))) missingProfiles += 1;
      if(clean(row.assignedDriverId) && !refs.drivers.has(clean(row.assignedDriverId))) missingDrivers += 1;
      if(clean(row.assignedVehicleId) && !refs.vehicles.has(clean(row.assignedVehicleId))) missingVehicles += 1;
      if(clean(row.membershipId) && !refs.memberships.has(clean(row.membershipId))) missingMemberships += 1;
    });
    return { missingProfiles, missingDrivers, missingVehicles, missingMemberships };
  }
  function mergeRowsByPolicy(existingRows, incomingRows, policy){
    const existing = normalizeRows(existingRows); const incoming = normalizeRows(incomingRows);
    if(policy === 'replace') return incoming.slice();
    const seen = new Map();
    existing.forEach(row => { const id = clean(row.id) || uid('anon'); seen.set(id, Object.assign({}, row, { id })); });
    incoming.forEach(row => {
      const id = clean(row.id) || uid('anon');
      const prior = seen.get(id);
      if(!prior){ seen.set(id, Object.assign({}, row, { id })); return; }
      if(policy === 'keep_existing'){ return; }
      if(policy === 'merge_newer'){
        if(newer(row, prior)){ seen.set(id, Object.assign({}, prior, row, { id })); }
        return;
      }
      seen.set(id, Object.assign({}, prior, row, { id }));
    });
    return Array.from(seen.values());
  }
  function previewMergePolicy(payload, policy){
    const preview = {};
    const policyName = ['keep_existing','merge_newer','replace'].includes(clean(policy)) ? clean(policy) : 'merge_newer';
    KNOWN.forEach(name => {
      const existing = readRows(name);
      const incoming = normalizeRows(payload && payload[name]);
      const existingIds = new Map(existing.map(row => [clean(row.id), row]));
      let duplicateAgainstExisting = 0, staleIncoming = 0, replacingIncoming = 0;
      incoming.forEach(row => {
        const id = clean(row.id); if(!id) return;
        if(existingIds.has(id)){
          duplicateAgainstExisting += 1;
          const prior = existingIds.get(id);
          if(newer(prior, row)) staleIncoming += 1;
          if(newer(row, prior)) replacingIncoming += 1;
        }
      });
      const merged = mergeRowsByPolicy(existing, incoming, policyName);
      preview[name] = Object.assign({ duplicateAgainstExisting, staleIncoming, replacingIncoming }, summarizeRows(incoming), { mergedRows: merged.length });
    });
    const refs = mergedRefs(payload || {});
    preview.bookingLinkAudit = analyzeOrphans((payload && payload.bookings) || [], refs);
    return { policy: policyName, preview };
  }
  function applyMergePolicy(payload, policy){
    const policyName = ['keep_existing','merge_newer','replace'].includes(clean(policy)) ? clean(policy) : 'merge_newer';
    const result = {};
    KNOWN.forEach(name => {
      const merged = mergeRowsByPolicy(readRows(name), normalizeRows(payload && payload[name]), policyName);
      writeRows(name, merged);
      result[name] = summarizeRows(merged);
    });
    const refs = mergedRefs({});
    const linkAudit = analyzeOrphans(readRows('bookings'), refs);
    const run = { id: uid('wg_mergepol51'), createdAt: nowISO(), policy: policyName, result, linkAudit };
    const rows = readRows('mergePolicyRuns'); rows.unshift(run); writeRows('mergePolicyRuns', rows.slice(0, 300));
    pushOutbox(STORAGE.mergePolicyOutbox, { id: uid('wg_mergepol_out51'), mergePolicyRunId: run.id, createdAt: run.createdAt, policy: run.policy }, 300);
    return run;
  }
  function duplicatePreview(bookingId, mode){
    const booking = getBooking(bookingId);
    if(!booking) return null;
    const modeName = ['next_day_repeat','return_leg_rebuild','split_multi_stop'].includes(clean(mode)) ? clean(mode) : 'next_day_repeat';
    const clones = [];
    if(modeName === 'split_multi_stop'){
      const stops = parseStops(booking.multiStopText || '');
      const chain = [clean(booking.pickupAddress || '')].concat(stops).concat([clean(booking.dropoffAddress || '')]).filter(Boolean);
      for(let i=0;i<chain.length - 1;i++){
        const clone = Object.assign({}, booking, {
          id: uid('wg_clone51'), duplicateOfBookingId: booking.id, duplicationMode: modeName,
          pickupAddress: chain[i], dropoffAddress: chain[i+1], multiStopText:'', returnLeg:false,
          dispatchStatus:'requested', status:'requested', routeMaterialized:false, routeLink:'', routeStopLink:'', timeline:[{ status:'duplicated_preview', at:nowISO(), note:'Split multi-stop segment ' + (i+1) }],
          createdAt: nowISO(), updatedAt: nowISO()
        });
        Object.assign(clone, buildMaterializedRoute(clone));
        clones.push(clone);
      }
    } else {
      const clone = Object.assign({}, booking, {
        id: uid('wg_clone51'), duplicateOfBookingId: booking.id, duplicationMode: modeName,
        dispatchStatus:'requested', status:'requested', routeMaterialized:false, routeLink:'', routeStopLink:'',
        createdAt: nowISO(), updatedAt: nowISO(), timeline:[{ status:'duplicated_preview', at:nowISO(), note:modeName }]
      });
      if(modeName === 'return_leg_rebuild'){ clone.returnLeg = true; clone.favoriteDriverState = clean(clone.favoriteDriverState || 'preferred'); }
      if(modeName === 'next_day_repeat'){ clone.etaWindow = clean(clone.etaWindow) ? clone.etaWindow + ' +1D' : ''; }
      Object.assign(clone, buildMaterializedRoute(clone));
      clones.push(clone);
    }
    const warnings = [];
    if(modeName === 'split_multi_stop' && clones.length < 2) warnings.push('Split multi-stop preview has fewer than two legs.');
    if(booking.returnLeg && modeName === 'return_leg_rebuild') warnings.push('Original booking already had a return leg; preview forces a fresh rebuilt return chain.');
    if(clean(booking.dispatchStatus).toLowerCase() === 'completed') warnings.push('Source booking is already completed; duplicated clone resets to requested state.');
    return { id: uid('wg_dupprev51'), createdAt: nowISO(), bookingId: booking.id, mode: modeName, sourceFingerprint:[booking.id, booking.serviceType, booking.pickupAddress, booking.dropoffAddress].join('::'), cloneCount: clones.length, warnings, clones };
  }
  function applyDuplicate(bookingId, mode){
    const preview = duplicatePreview(bookingId, mode);
    if(!preview) return null;
    const bookings = readRows('bookings');
    const routePlans = readRows('routePlans');
    preview.clones.forEach((clone, idx) => {
      bookings.unshift(clone);
      routePlans.unshift({ id: uid('wg_routeplan51'), createdAt: nowISO(), bookingId: clone.id, duplicateOfBookingId: bookingId, mode: preview.mode, routeFingerprint: clone.routeFingerprint, legs: clone.legs || [], routeStopCount: clone.routeStopCount || 0, sequence: idx + 1 });
    });
    writeRows('bookings', bookings.slice(0, 4000));
    writeRows('routePlans', routePlans.slice(0, 4000));
    const run = { id: uid('wg_duprun51'), createdAt: nowISO(), bookingId, mode: preview.mode, cloneIds: preview.clones.map(r => r.id), cloneCount: preview.cloneCount, warnings: preview.warnings };
    const runs = readRows('duplicateRuns'); runs.unshift(run); writeRows('duplicateRuns', runs.slice(0, 300));
    pushOutbox(STORAGE.duplicateOutbox, { id: uid('wg_dup_out51'), duplicateRunId: run.id, createdAt: run.createdAt, cloneCount: run.cloneCount, mode: run.mode }, 300);
    return { preview, run };
  }
  function buildDeckHtml(row){
    const actions = (row.topActions || []).map(item => '<tr><td>'+esc(item.priority)+'</td><td>'+esc(item.label)+'</td><td>'+esc(item.reason)+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>White-glove operator deck</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.wrap{max-width:1180px;margin:0 auto}.card{border:1px solid #ddd;border-radius:18px;padding:16px;margin:0 0 16px}.badge{display:inline-block;padding:4px 8px;border:1px solid #bbb;border-radius:999px;margin:0 6px 6px 0}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px">White-glove operator deck</h1><div><span class="badge">'+esc(row.fingerprint)+'</span><span class="badge">Bookings '+esc(String(row.totals.bookings))+'</span><span class="badge">Live '+esc(String(row.totals.liveBookings))+'</span><span class="badge">Estimated net '+esc(money(row.economics.estimatedNet))+'</span></div></div><div class="card"><table><tbody><tr><th>Recognized revenue</th><td>'+esc(money(row.economics.recognizedRevenue))+'</td></tr><tr><th>Wait revenue</th><td>'+esc(money(row.economics.waitRevenue))+'</td></tr><tr><th>Overage revenue</th><td>'+esc(money(row.economics.overageRevenue))+'</td></tr><tr><th>Payout liability</th><td>'+esc(money(row.economics.payoutLiability))+'</td></tr><tr><th>Favorite match rate</th><td>'+esc(String(row.continuity.favoriteMatchRate || 0))+'%</td></tr><tr><th>Continuity rate</th><td>'+esc(String(row.continuity.continuityRate || 0))+'%</td></tr><tr><th>Severe conflicts</th><td>'+esc(String(row.risk.severeConflicts || 0))+'</td></tr><tr><th>Sync queue</th><td>'+esc(String(row.risk.syncQueue || 0))+'</td></tr></tbody></table></div><div class="card"><h2 style="margin:0 0 8px">Top actions</h2><table><thead><tr><th>Priority</th><th>Action</th><th>Reason</th></tr></thead><tbody>'+actions+'</tbody></table></div></div></body></html>';
  }
  function buildDuplicateHtml(row){
    return '<!doctype html><html><head><meta charset="utf-8"><title>White-glove duplication run</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.card{border:1px solid #ddd;border-radius:18px;padding:16px;margin:0 0 16px}</style></head><body><div class="card"><h1 style="margin:0 0 8px">White-glove duplication run</h1><div>Mode: '+esc(row.mode)+'</div><div>Booking: '+esc(row.bookingId)+'</div><div>Clone count: '+esc(String(row.cloneCount || 0))+'</div><div>Clone ids: '+esc((row.cloneIds || []).join(', ') || '—')+'</div><div style="margin-top:12px">Warnings: '+esc((row.warnings || []).join(' | ') || 'none')+'</div></div></body></html>';
  }
  function buildMergePolicyHtml(run){
    const rows = Object.keys(run.result || {}).map(name => '<tr><td>'+esc(name)+'</td><td>'+esc(String(run.result[name].rows || 0))+'</td><td>'+esc(String(run.result[name].distinctIds || 0))+'</td><td>'+esc(String(run.result[name].duplicateIds || 0))+'</td></tr>').join('');
    const audit = run.linkAudit || {};
    return '<!doctype html><html><head><meta charset="utf-8"><title>White-glove merge policy run</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.wrap{max-width:980px;margin:0 auto}.card{border:1px solid #ddd;border-radius:18px;padding:16px;margin:0 0 16px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px">White-glove merge policy run</h1><div>Policy: '+esc(run.policy)+'</div><div>Saved: '+esc(run.createdAt)+'</div><div>Link audit: profiles '+esc(String(audit.missingProfiles||0))+', drivers '+esc(String(audit.missingDrivers||0))+', vehicles '+esc(String(audit.missingVehicles||0))+', memberships '+esc(String(audit.missingMemberships||0))+'</div></div><div class="card"><table><thead><tr><th>Store</th><th>Rows</th><th>Distinct ids</th><th>Duplicate ids</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></body></html>';
  }
  function latest(name){ return readRows(name)[0] || null; }
  function openCenter(tab){ if(tab) writeUI({ activeTab: tab }); const modal = ensureUI(); modal.style.display = 'block'; refresh(); }
  function refresh(){
    const ui = readUI();
    const modal = document.getElementById('wg-v51-modal'); if(!modal) return;
    const bookingSel = modal.querySelector('#wg-v51-booking');
    bookingSel.innerHTML = bookingOptions().map(opt => '<option value="'+esc(opt.id)+'" '+(clean(opt.id)===clean(ui.bookingId)?'selected':'')+'>'+esc(opt.label)+'</option>').join('');
    if(!clean(bookingSel.value) && bookingSel.options[0]) bookingSel.value = bookingSel.options[0].value;
    writeUI({ bookingId: bookingSel.value || '' });
    modal.querySelector('#wg-v51-dup-mode').value = ui.duplicateMode || 'next_day_repeat';
    modal.querySelector('#wg-v51-merge-policy').value = ui.mergePolicy || 'merge_newer';
    modal.querySelector('#wg-v51-import').value = ui.importText || '';
    modal.querySelector('#wg-v51-deck').textContent = JSON.stringify(latest('deckSnapshots'), null, 2);
    modal.querySelector('#wg-v51-duplicate').textContent = JSON.stringify(latest('duplicateRuns'), null, 2);
    modal.querySelector('#wg-v51-merge').textContent = JSON.stringify(latest('mergePolicyRuns'), null, 2);
  }
  function ensureUI(){
    if(document.getElementById('wg-v51-launcher')) return document.getElementById('wg-v51-modal');
    const launcher = document.createElement('button');
    launcher.id = 'wg-v51-launcher'; launcher.textContent = 'WG Deck+';
    launcher.style.cssText = 'position:fixed;right:18px;bottom:62px;z-index:99999;border:1px solid rgba(255,255,255,.18);background:#3c1268;color:#fff;padding:10px 14px;border-radius:999px;font:700 12px system-ui;box-shadow:0 12px 30px rgba(0,0,0,.35);cursor:pointer;';
    const modal = document.createElement('div');
    modal.id = 'wg-v51-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.72);padding:24px;overflow:auto;';
    modal.innerHTML = '<div style="max-width:1180px;margin:0 auto;background:#14091f;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:24px;padding:18px 18px 26px"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px"><div><div style="font:700 20px system-ui">White-glove unified operator deck</div><div style="font:12px system-ui;opacity:.72">Finance, conflict, backend, continuity, duplication, and merge-policy control in one place.</div></div><button id="wg-v51-close" style="border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;padding:8px 12px;border-radius:12px;cursor:pointer">Close</button></div><div style="display:grid;grid-template-columns:1.1fr .9fr;gap:16px"><div style="display:grid;gap:16px"><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 style="margin:0;font:700 15px system-ui">Unified operator deck</h3><div><button id="wg-v51-save-deck" style="margin-right:8px">Save deck</button><button id="wg-v51-export-deck-html" style="margin-right:8px">Export HTML</button><button id="wg-v51-export-deck-json">Export JSON</button></div></div><pre id="wg-v51-deck" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:240px;overflow:auto"></pre></section><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 style="margin:0;font:700 15px system-ui">Complex route duplication</h3><div><button id="wg-v51-preview-duplicate" style="margin-right:8px">Preview</button><button id="wg-v51-apply-duplicate" style="margin-right:8px">Apply</button><button id="wg-v51-export-duplicate-html" style="margin-right:8px">Export HTML</button><button id="wg-v51-export-duplicate-json">Export JSON</button></div></div><div style="margin:10px 0"><select id="wg-v51-booking" style="width:100%;padding:10px;border-radius:12px;background:#0f0a18;color:#fff;border:1px solid rgba(255,255,255,.12)"></select></div><div style="margin:10px 0"><select id="wg-v51-dup-mode" style="width:100%;padding:10px;border-radius:12px;background:#0f0a18;color:#fff;border:1px solid rgba(255,255,255,.12)"><option value="next_day_repeat">Next-day repeat clone</option><option value="return_leg_rebuild">Return-leg rebuild clone</option><option value="split_multi_stop">Split multi-stop into segment bookings</option></select></div><pre id="wg-v51-duplicate" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:240px;overflow:auto"></pre></section></div><div style="display:grid;gap:16px"><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 style="margin:0;font:700 15px system-ui">Merge-policy hardening</h3><div><button id="wg-v51-preview-merge" style="margin-right:8px">Preview</button><button id="wg-v51-apply-merge" style="margin-right:8px">Apply</button><button id="wg-v51-export-merge-html" style="margin-right:8px">Export HTML</button><button id="wg-v51-export-merge-json">Export JSON</button></div></div><div style="margin:10px 0"><select id="wg-v51-merge-policy" style="width:100%;padding:10px;border-radius:12px;background:#0f0a18;color:#fff;border:1px solid rgba(255,255,255,.12)"><option value="merge_newer">Merge newer rows</option><option value="keep_existing">Keep existing on duplicate ids</option><option value="replace">Replace incoming stores</option></select></div><textarea id="wg-v51-import" style="width:100%;min-height:180px;padding:12px;border-radius:14px;background:#0f0a18;color:#fff;border:1px solid rgba(255,255,255,.12)" placeholder="Paste white-glove backup JSON here."></textarea><pre id="wg-v51-merge" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:200px;overflow:auto"></pre></section><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><h3 style="margin:0 0 10px;font:700 15px system-ui">What this pass adds</h3><ul style="margin:0 0 0 18px;font:13px system-ui;line-height:1.65"><li>One unified premium operator deck across finance, continuity, backend, conflict, and restore signals.</li><li>Complex booking duplication for repeat, return-leg rebuild, and multi-stop split scenarios.</li><li>Merge-policy preview and apply with stale-row and orphan-link auditing.</li></ul><div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button id="wg-v51-tour-deck">Walkthrough: deck</button><button id="wg-v51-tour-merge">Walkthrough: merge + duplication</button></div></section></div></div></div>';
    document.body.appendChild(launcher); document.body.appendChild(modal);
    launcher.onclick = ()=> { modal.style.display = 'block'; refresh(); };
    modal.querySelector('#wg-v51-close').onclick = ()=> { modal.style.display = 'none'; };
    modal.querySelector('#wg-v51-booking').onchange = (e)=> { writeUI({ bookingId: e.target.value }); refresh(); };
    modal.querySelector('#wg-v51-dup-mode').onchange = (e)=> writeUI({ duplicateMode: e.target.value });
    modal.querySelector('#wg-v51-merge-policy').onchange = (e)=> writeUI({ mergePolicy: e.target.value });
    modal.querySelector('#wg-v51-import').oninput = (e)=> writeUI({ importText: e.target.value });
    modal.querySelector('#wg-v51-save-deck').onclick = ()=> { const row = buildOperatorDeck(); modal.querySelector('#wg-v51-deck').textContent = JSON.stringify(row, null, 2); toast('White-glove operator deck saved.', 'good'); };
    modal.querySelector('#wg-v51-export-deck-html').onclick = ()=> { const row = latest('deckSnapshots') || buildOperatorDeck(); downloadText(buildDeckHtml(row), 'whiteglove_operator_deck_' + dayISO() + '.html', 'text/html'); };
    modal.querySelector('#wg-v51-export-deck-json').onclick = ()=> { const row = latest('deckSnapshots') || buildOperatorDeck(); downloadText(JSON.stringify(row, null, 2), 'whiteglove_operator_deck_' + dayISO() + '.json', 'application/json'); };
    modal.querySelector('#wg-v51-preview-duplicate').onclick = ()=> { const preview = duplicatePreview(modal.querySelector('#wg-v51-booking').value, modal.querySelector('#wg-v51-dup-mode').value); modal.querySelector('#wg-v51-duplicate').textContent = JSON.stringify(preview, null, 2); if(!preview) toast('Booking not found.', 'warn'); };
    modal.querySelector('#wg-v51-apply-duplicate').onclick = ()=> { const out = applyDuplicate(modal.querySelector('#wg-v51-booking').value, modal.querySelector('#wg-v51-dup-mode').value); modal.querySelector('#wg-v51-duplicate').textContent = JSON.stringify(out && out.run || null, null, 2); if(out){ toast('White-glove duplication run saved.', 'good'); } else { toast('Booking not found.', 'warn'); } };
    modal.querySelector('#wg-v51-export-duplicate-html').onclick = ()=> { const row = latest('duplicateRuns'); if(!row){ toast('No duplication run saved yet.', 'warn'); return; } downloadText(buildDuplicateHtml(row), 'whiteglove_duplication_run_' + dayISO() + '.html', 'text/html'); };
    modal.querySelector('#wg-v51-export-duplicate-json').onclick = ()=> { const row = latest('duplicateRuns'); if(!row){ toast('No duplication run saved yet.', 'warn'); return; } downloadText(JSON.stringify(row, null, 2), 'whiteglove_duplication_run_' + dayISO() + '.json', 'application/json'); };
    modal.querySelector('#wg-v51-preview-merge').onclick = ()=> { let payload = null; try{ payload = JSON.parse(modal.querySelector('#wg-v51-import').value || '{}'); }catch(_){ toast('Import JSON could not be parsed.', 'warn'); return; } const preview = previewMergePolicy(payload, modal.querySelector('#wg-v51-merge-policy').value); modal.querySelector('#wg-v51-merge').textContent = JSON.stringify(preview, null, 2); };
    modal.querySelector('#wg-v51-apply-merge').onclick = ()=> { let payload = null; try{ payload = JSON.parse(modal.querySelector('#wg-v51-import').value || '{}'); }catch(_){ toast('Import JSON could not be parsed.', 'warn'); return; } const run = applyMergePolicy(payload, modal.querySelector('#wg-v51-merge-policy').value); modal.querySelector('#wg-v51-merge').textContent = JSON.stringify(run, null, 2); toast('White-glove merge policy run saved.', 'good'); };
    modal.querySelector('#wg-v51-export-merge-html').onclick = ()=> { const row = latest('mergePolicyRuns'); if(!row){ toast('No merge-policy run saved yet.', 'warn'); return; } downloadText(buildMergePolicyHtml(row), 'whiteglove_merge_policy_run_' + dayISO() + '.html', 'text/html'); };
    modal.querySelector('#wg-v51-export-merge-json').onclick = ()=> { const row = latest('mergePolicyRuns'); if(!row){ toast('No merge-policy run saved yet.', 'warn'); return; } downloadText(JSON.stringify(row, null, 2), 'whiteglove_merge_policy_run_' + dayISO() + '.json', 'application/json'); };
    modal.querySelector('#wg-v51-tour-deck').onclick = ()=> { if(typeof window.startRoutexWhiteGloveV51Tour === 'function') window.startRoutexWhiteGloveV51Tour('deck'); };
    modal.querySelector('#wg-v51-tour-merge').onclick = ()=> { if(typeof window.startRoutexWhiteGloveV51Tour === 'function') window.startRoutexWhiteGloveV51Tour('merge'); };
    return modal;
  }
  window.openWhiteGloveOperatorDeckV51 = openCenter;
  window.saveWhiteGloveOperatorDeckV51 = buildOperatorDeck;
  window.previewWhiteGloveDuplicateV51 = duplicatePreview;
  window.applyWhiteGloveDuplicateV51 = applyDuplicate;
  window.previewWhiteGloveMergePolicyV51 = previewMergePolicy;
  window.applyWhiteGloveMergePolicyV51 = applyMergePolicy;
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureUI); else ensureUI();
})();
