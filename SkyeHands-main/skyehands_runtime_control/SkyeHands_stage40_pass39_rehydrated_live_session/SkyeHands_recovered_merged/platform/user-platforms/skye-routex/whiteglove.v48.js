/* V48 Routex white-glove financial control board + compliance + command-center depth */
(function(){
  if(window.__ROUTEX_WHITEGLOVE_V48__) return;
  window.__ROUTEX_WHITEGLOVE_V48__ = true;

  const SHARED = {
    profiles: 'skye_whiteglove_service_profiles_v39',
    drivers: 'skye_whiteglove_driver_profiles_v39',
    vehicles: 'skye_whiteglove_vehicle_profiles_v39',
    memberships: 'skye_whiteglove_memberships_v39',
    bookings: 'skye_whiteglove_bookings_v39',
    docs: 'skye_whiteglove_docs_v39',
    events: 'skye_whiteglove_events_v39'
  };
  const V41 = { execution: 'skye_whiteglove_execution_rows_v41', payoutLedger: 'skye_whiteglove_payout_ledger_v41' };
  const V46 = { conflictSnapshots: 'skye_whiteglove_conflict_snapshots_v46' };
  const V47 = { routePlans: 'skye_whiteglove_route_plans_v47', profitability: 'skye_whiteglove_profitability_compare_v47' };
  const KEYS = {
    adjustments: 'skye_whiteglove_adjustments_v48',
    adjustmentOutbox: 'skye_whiteglove_adjustment_outbox_v48',
    compliance: 'skye_whiteglove_compliance_ack_v48',
    complianceOutbox: 'skye_whiteglove_compliance_outbox_v48',
    command: 'skye_whiteglove_command_snapshots_v48',
    commandOutbox: 'skye_whiteglove_command_outbox_v48',
    dispute: 'skye_whiteglove_dispute_packets_v48',
    ui: 'skye_whiteglove_v48_ui'
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
    const a = document.createElement('a'); a.href = url; a.download = filename || 'download.txt'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 1200);
  };
  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){ } return value; }
  const readProfiles = ()=> readJSON(SHARED.profiles, []);
  const readDrivers = ()=> readJSON(SHARED.drivers, []);
  const readVehicles = ()=> readJSON(SHARED.vehicles, []);
  const readMemberships = ()=> readJSON(SHARED.memberships, []);
  const readBookings = ()=> readJSON(SHARED.bookings, []);
  const readDocs = ()=> readJSON(SHARED.docs, []);
  const readEvents = ()=> readJSON(SHARED.events, []);
  const readExecution = ()=> readJSON(V41.execution, []);
  const readPayout = ()=> readJSON(V41.payoutLedger, []);
  const readConflicts = ()=> readJSON(V46.conflictSnapshots, []);
  const readRoutePlans = ()=> readJSON(V47.routePlans, []);
  const readProfit = ()=> readJSON(V47.profitability, []);
  const readAdjustments = ()=> readJSON(KEYS.adjustments, []);
  const readCompliance = ()=> readJSON(KEYS.compliance, []);
  const readCommand = ()=> readJSON(KEYS.command, []);
  const readDisputes = ()=> readJSON(KEYS.dispute, []);
  const readUI = ()=> readJSON(KEYS.ui, { bookingId:'', adjustmentType:'refund', amount:'', reason:'', policyVersion:'WG-2026.04', acknowledgedBy:'operator' });
  const writeAdjustments = (rows)=> writeJSON(KEYS.adjustments, rows);
  const writeCompliance = (rows)=> writeJSON(KEYS.compliance, rows);
  const writeCommand = (rows)=> writeJSON(KEYS.command, rows);
  const writeDisputes = (rows)=> writeJSON(KEYS.dispute, rows);
  const writeUI = (patch)=> writeJSON(KEYS.ui, Object.assign({}, readUI(), patch || {}));
  function getById(rows, id){ return rows.find(row => clean(row.id) === clean(id)) || null; }
  function getBooking(id){ return getById(readBookings(), id); }
  function getProfile(id){ return getById(readProfiles(), id); }
  function getDriver(id){ return getById(readDrivers(), id); }
  function getVehicle(id){ return getById(readVehicles(), id); }
  function getMembership(id){ return getById(readMemberships(), id); }
  function saveEvents(type, refs, note, extra){
    const rows = readEvents();
    rows.unshift(Object.assign({ id: uid('wg_evt48'), type: clean(type), refs: refs || {}, note: clean(note), createdAt: nowISO() }, extra || {}));
    writeJSON(SHARED.events, rows.slice(0, 4000));
  }
  function patchBooking(bookingId, mutator){
    let updated = null;
    const rows = readBookings().map(row => {
      if(clean(row.id) !== clean(bookingId)) return row;
      const next = Object.assign({}, row);
      const result = mutator ? (mutator(next) || next) : next;
      result.updatedAt = nowISO();
      updated = result;
      return result;
    });
    writeJSON(SHARED.bookings, rows);
    return updated;
  }
  function pushOutbox(key, row, limit){
    const rows = readJSON(key, []); rows.unshift(row); writeJSON(key, rows.slice(0, limit || 500)); return row;
  }
  function upsertDoc(type, title, html, meta){
    const rows = readDocs();
    const row = { id: uid('wg_doc48'), type: clean(type), title: clean(title), html: html || '', meta: meta || {}, createdAt: nowISO() };
    rows.unshift(row); writeJSON(SHARED.docs, rows.slice(0, 4000)); return row;
  }
  function listBookingOptions(){
    return readBookings().map(row => ({ id: row.id, label: [row.serviceProfileName || getProfile(row.serviceProfileId)?.displayName || 'Client', row.serviceType || 'ride', row.dispatchStatus || row.status || 'status'].join(' • ') }));
  }
  function bookingAdjustments(bookingId){ return readAdjustments().filter(row => clean(row.bookingId) === clean(bookingId)); }
  function bookingCompliance(bookingId){ return readCompliance().filter(row => clean(row.bookingId) === clean(bookingId)); }

  function saveAdjustment(bookingId, kind, amount, reason){
    const booking = getBooking(bookingId); if(!booking) return null;
    const value = Number(amount || 0); if(!Number.isFinite(value) || value <= 0) return null;
    const row = { id: uid('wg_adj48'), bookingId: booking.id, kind: clean(kind || 'adjustment'), amount: value, reason: clean(reason || 'operator note'), createdAt: nowISO() };
    const rows = readAdjustments(); rows.unshift(row); writeAdjustments(rows.slice(0, 2000));
    patchBooking(booking.id, current => {
      current.adjustmentLedgerIds = Array.isArray(current.adjustmentLedgerIds) ? current.adjustmentLedgerIds : [];
      current.adjustmentLedgerIds.unshift(row.id);
      current.adjustmentsTotal = Number(current.adjustmentsTotal || 0) + (row.kind === 'credit' ? -value : row.kind === 'refund' ? -value : value);
      current.refundTotal = Number(current.refundTotal || 0) + (row.kind === 'refund' ? value : 0);
      current.creditTotal = Number(current.creditTotal || 0) + (row.kind === 'credit' ? value : 0);
      current.finalEconomics = current.finalEconomics || {};
      const baseRecognized = Number(current.finalEconomics.recognizedRevenue || current.pricingSnapshot?.quotedTotal || 0);
      current.finalEconomics.adjustments = Number(current.adjustmentsTotal || 0);
      current.finalEconomics.refunds = Number(current.refundTotal || 0);
      current.finalEconomics.credits = Number(current.creditTotal || 0);
      current.finalEconomics.adjustedRecognizedRevenue = baseRecognized + Number(current.adjustmentsTotal || 0);
      return current;
    });
    pushOutbox(KEYS.adjustmentOutbox, { id: uid('wg_adj_out48'), adjustmentId: row.id, bookingId: booking.id, kind: row.kind, amount: row.amount, createdAt: nowISO() }, 400);
    saveEvents('whiteglove_adjustment_saved_v48', { bookingId: booking.id, adjustmentId: row.id }, 'Financial adjustment saved', { kind: row.kind, amount: row.amount });
    return row;
  }

  function saveComplianceAck(bookingId, policyVersion, acknowledgedBy, note){
    const booking = getBooking(bookingId); if(!booking) return null;
    const row = { id: uid('wg_cmp48'), bookingId: booking.id, policyVersion: clean(policyVersion || 'WG-2026.04'), acknowledgedBy: clean(acknowledgedBy || 'operator'), note: clean(note || ''), createdAt: nowISO() };
    const rows = readCompliance(); rows.unshift(row); writeCompliance(rows.slice(0, 2000));
    patchBooking(booking.id, current => {
      current.policyAcknowledgements = Array.isArray(current.policyAcknowledgements) ? current.policyAcknowledgements : [];
      current.policyAcknowledgements.unshift({ policyVersion: row.policyVersion, acknowledgedBy: row.acknowledgedBy, createdAt: row.createdAt, complianceId: row.id });
      current.latestPolicyVersion = row.policyVersion;
      return current;
    });
    const html = buildComplianceHtml(booking.id, row);
    upsertDoc('whiteglove_policy_ack_v48', 'White-glove policy acknowledgement • ' + (booking.serviceProfileName || booking.id), html, { bookingId: booking.id, complianceId: row.id });
    pushOutbox(KEYS.complianceOutbox, { id: uid('wg_cmp_out48'), complianceId: row.id, bookingId: booking.id, policyVersion: row.policyVersion, createdAt: nowISO() }, 400);
    saveEvents('whiteglove_policy_ack_saved_v48', { bookingId: booking.id, complianceId: row.id }, 'Policy acknowledgement saved', { policyVersion: row.policyVersion });
    return row;
  }

  function summarizeBreakage(){
    const memberships = readMemberships().filter(row => !clean(row.status || row.planStatus).toLowerCase().includes('cancel'));
    let remainingHours = 0, remainingMiles = 0;
    memberships.forEach(row => {
      remainingHours += Number(row.remainingHours || 0);
      remainingMiles += Number(row.remainingMiles || 0);
    });
    return { activeMemberships: memberships.length, remainingHours, remainingMiles };
  }

  function buildCommandSnapshot(){
    const bookings = readBookings();
    const profits = readProfit();
    const conflicts = readConflicts();
    const routePlans = readRoutePlans();
    const payouts = readPayout();
    const adjustments = readAdjustments();
    const compliance = readCompliance();
    const docs = readDocs();
    const liveStatuses = new Set(['confirmed','assigned','en_route','arrived','rider_boarded','in_service']);
    const liveBookings = bookings.filter(row => liveStatuses.has(clean(row.dispatchStatus || row.status).toLowerCase())).length;
    const quotedRevenue = bookings.reduce((sum, row) => sum + Number(row.pricingSnapshot?.quotedTotal || 0), 0);
    const recognizedRevenue = bookings.reduce((sum, row) => sum + Number(row.finalEconomics?.adjustedRecognizedRevenue || row.finalEconomics?.recognizedRevenue || row.pricingSnapshot?.quotedTotal || 0), 0);
    const waitRevenue = bookings.reduce((sum, row) => sum + Number(row.finalEconomics?.waitCharge || row.waitRevenue || 0), 0);
    const overageRevenue = bookings.reduce((sum, row) => sum + Number(row.finalEconomics?.overageRevenue || 0), 0);
    const refundValue = adjustments.filter(row => clean(row.kind) === 'refund').reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const creditValue = adjustments.filter(row => clean(row.kind) === 'credit').reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const adjustmentValue = adjustments.filter(row => clean(row.kind) === 'adjustment').reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const payoutLiability = payouts.reduce((sum, row) => sum + Number(row.totalPayout || row.payoutAmount || 0), 0);
    const severeConflicts = conflicts.filter(row => clean(row.severity).toLowerCase() === 'high').length;
    const repeatRiderCount = new Set(bookings.map(row => clean(row.serviceProfileId)).filter(Boolean)).size;
    const favoriteMatched = bookings.filter(row => clean(row.favoriteDriverState) === 'matched').length;
    const favoriteOverridden = bookings.filter(row => clean(row.favoriteDriverState) === 'overridden_by_dispatch').length;
    const cancellationCount = bookings.filter(row => ['cancelled','no_show'].includes(clean(row.dispatchStatus || row.status).toLowerCase())).length;
    const coverage = { routePlans: routePlans.length, profitabilityRows: profits.length, complianceRows: compliance.length, adjustmentRows: adjustments.length, docs: docs.filter(row => clean(row.type).includes('whiteglove_')).length };
    const breakage = summarizeBreakage();
    const row = {
      id: uid('wg_cmd48'),
      createdAt: nowISO(),
      bookings: bookings.length,
      liveBookings,
      repeatRiderCount,
      quotedRevenue,
      recognizedRevenue,
      waitRevenue,
      overageRevenue,
      adjustmentValue,
      refundValue,
      creditValue,
      payoutLiability,
      estimatedNet: recognizedRevenue - payoutLiability,
      severeConflicts,
      favoriteMatched,
      favoriteOverridden,
      cancellationCount,
      activeMemberships: breakage.activeMemberships,
      remainingHoursLiability: breakage.remainingHours,
      remainingMilesLiability: breakage.remainingMiles,
      coverage
    };
    const rows = readCommand(); rows.unshift(row); writeCommand(rows.slice(0, 500));
    pushOutbox(KEYS.commandOutbox, { id: uid('wg_cmd_out48'), commandId: row.id, createdAt: nowISO(), estimatedNet: row.estimatedNet, severeConflicts: row.severeConflicts }, 300);
    saveEvents('whiteglove_command_snapshot_v48', { commandId: row.id }, 'Financial control board snapshot saved', { bookings: row.bookings, estimatedNet: row.estimatedNet });
    return row;
  }

  function buildComplianceHtml(bookingId, ack){
    const booking = getBooking(bookingId) || {};
    const profile = getProfile(booking.serviceProfileId) || {};
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>White-glove policy acknowledgement</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.wrap{max-width:900px;margin:0 auto}.card{border:1px solid #ddd;border-radius:18px;padding:16px;margin:0 0 16px}.badge{display:inline-block;padding:4px 8px;border:1px solid #bbb;border-radius:999px;margin:0 6px 6px 0}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px">White-glove policy acknowledgement</h1><div><span class="badge">Policy '+esc(ack.policyVersion)+'</span><span class="badge">Acknowledged by '+esc(ack.acknowledgedBy)+'</span><span class="badge">Saved '+esc(ack.createdAt)+'</span></div></div><div class="card"><h2 style="margin:0 0 8px">Booking context</h2><div>Client: '+esc(profile.displayName || booking.serviceProfileName || '—')+'</div><div>Service type: '+esc(booking.serviceType || '—')+'</div><div>Status: '+esc(booking.dispatchStatus || booking.status || '—')+'</div><div>Note: '+esc(ack.note || '—')+'</div></div></div></body></html>';
  }

  function buildCommandHtml(row){
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>White-glove financial control board</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.wrap{max-width:1200px;margin:0 auto}.card{border:1px solid #ddd;border-radius:18px;padding:16px;margin:0 0 16px}.badge{display:inline-block;padding:4px 8px;border:1px solid #bbb;border-radius:999px;margin:0 6px 6px 0}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px">White-glove financial control board</h1><div><span class="badge">Bookings '+esc(String(row.bookings))+'</span><span class="badge">Live '+esc(String(row.liveBookings))+'</span><span class="badge">Estimated net '+esc(money(row.estimatedNet))+'</span><span class="badge">Severe conflicts '+esc(String(row.severeConflicts))+'</span></div></div><div class="card"><table><tr><th>Metric</th><th>Value</th></tr><tr><td>Quoted revenue</td><td>'+esc(money(row.quotedRevenue))+'</td></tr><tr><td>Recognized revenue</td><td>'+esc(money(row.recognizedRevenue))+'</td></tr><tr><td>Wait revenue</td><td>'+esc(money(row.waitRevenue))+'</td></tr><tr><td>Overage revenue</td><td>'+esc(money(row.overageRevenue))+'</td></tr><tr><td>Adjustments</td><td>'+esc(money(row.adjustmentValue))+'</td></tr><tr><td>Refunds</td><td>'+esc(money(row.refundValue))+'</td></tr><tr><td>Credits</td><td>'+esc(money(row.creditValue))+'</td></tr><tr><td>Payout liability</td><td>'+esc(money(row.payoutLiability))+'</td></tr><tr><td>Favorite matched</td><td>'+esc(String(row.favoriteMatched))+'</td></tr><tr><td>Favorite overridden</td><td>'+esc(String(row.favoriteOverridden))+'</td></tr><tr><td>Cancellations / no-shows</td><td>'+esc(String(row.cancellationCount))+'</td></tr><tr><td>Active memberships</td><td>'+esc(String(row.activeMemberships))+'</td></tr><tr><td>Remaining included hours</td><td>'+esc(String(row.remainingHoursLiability))+'</td></tr><tr><td>Remaining included miles</td><td>'+esc(String(row.remainingMilesLiability))+'</td></tr></table></div></div></body></html>';
  }

  function buildBookingFinanceHtml(bookingId){
    const booking = getBooking(bookingId); if(!booking) return '';
    const profile = getProfile(booking.serviceProfileId) || {};
    const driver = getDriver(booking.assignedDriverId) || {};
    const vehicle = getVehicle(booking.assignedVehicleId) || {};
    const ledger = bookingAdjustments(booking.id);
    const payout = readPayout().find(row => clean(row.bookingId) === clean(booking.id)) || {};
    const final = booking.finalEconomics || {};
    const rows = ledger.map(row => '<tr><td>'+esc(row.kind)+'</td><td>'+esc(money(row.amount))+'</td><td>'+esc(row.reason || '—')+'</td><td>'+esc(row.createdAt)+'</td></tr>').join('') || '<tr><td colspan="4">No adjustments yet.</td></tr>';
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>White-glove booking finance</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.wrap{max-width:1100px;margin:0 auto}.card{border:1px solid #ddd;border-radius:18px;padding:16px;margin:0 0 16px}.badge{display:inline-block;padding:4px 8px;border:1px solid #bbb;border-radius:999px;margin:0 6px 6px 0}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px">White-glove booking finance + compliance</h1><div><span class="badge">Client '+esc(profile.displayName || booking.serviceProfileName || booking.id)+'</span><span class="badge">Driver '+esc(driver.displayName || '—')+'</span><span class="badge">Vehicle '+esc(vehicle.displayName || vehicle.plate || '—')+'</span></div></div><div class="card"><div>Quoted: '+esc(money(booking.pricingSnapshot?.quotedTotal || 0))+'</div><div>Recognized: '+esc(money(final.adjustedRecognizedRevenue || final.recognizedRevenue || booking.pricingSnapshot?.quotedTotal || 0))+'</div><div>Wait: '+esc(money(final.waitCharge || 0))+'</div><div>Overage: '+esc(money(final.overageRevenue || 0))+'</div><div>Payout: '+esc(money(payout.totalPayout || payout.payoutAmount || 0))+'</div><div>Estimated net: '+esc(money((final.adjustedRecognizedRevenue || final.recognizedRevenue || booking.pricingSnapshot?.quotedTotal || 0) - Number(payout.totalPayout || payout.payoutAmount || 0)))+'</div></div><div class="card"><h2 style="margin:0 0 8px">Adjustments ledger</h2><table><tr><th>Type</th><th>Amount</th><th>Reason</th><th>Created</th></tr>'+rows+'</table></div></div></body></html>';
  }

  function saveDisputePacket(bookingId){
    const booking = getBooking(bookingId); if(!booking) return null;
    const packet = {
      id: uid('wg_dis48'),
      bookingId: booking.id,
      createdAt: nowISO(),
      booking,
      profile: getProfile(booking.serviceProfileId),
      driver: getDriver(booking.assignedDriverId),
      vehicle: getVehicle(booking.assignedVehicleId),
      membership: getMembership(booking.membershipId),
      adjustments: bookingAdjustments(booking.id),
      compliance: bookingCompliance(booking.id),
      payout: readPayout().filter(row => clean(row.bookingId) === clean(booking.id)),
      execution: readExecution().filter(row => clean(row.bookingId) === clean(booking.id)),
      routePlan: readRoutePlans().find(row => clean(row.bookingId) === clean(booking.id)) || null,
      profitability: readProfit().find(row => clean(row.bookingId) === clean(booking.id)) || null,
      conflicts: readConflicts().filter(row => clean(row.bookingId) === clean(booking.id)),
      docs: readDocs().filter(row => clean(row.meta?.bookingId) === clean(booking.id)),
      events: readEvents().filter(row => clean(row.refs?.bookingId) === clean(booking.id)).slice(0, 50)
    };
    const rows = readDisputes(); rows.unshift(packet); writeDisputes(rows.slice(0, 500));
    saveEvents('whiteglove_dispute_packet_v48', { bookingId: booking.id, disputePacketId: packet.id }, 'Dispute packet saved', { adjustmentCount: packet.adjustments.length, complianceCount: packet.compliance.length });
    return packet;
  }

  function buildDisputeHtml(packet){
    const booking = packet.booking || {};
    const profile = packet.profile || {};
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>White-glove dispute packet</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.wrap{max-width:1100px;margin:0 auto}.card{border:1px solid #ddd;border-radius:18px;padding:16px;margin:0 0 16px}.badge{display:inline-block;padding:4px 8px;border:1px solid #bbb;border-radius:999px;margin:0 6px 6px 0}ul{margin:0;padding-left:18px}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px">White-glove dispute packet</h1><div><span class="badge">Booking '+esc(booking.id || '—')+'</span><span class="badge">Client '+esc(profile.displayName || booking.serviceProfileName || '—')+'</span><span class="badge">Generated '+esc(packet.createdAt)+'</span></div></div><div class="card"><h2 style="margin:0 0 8px">Counts</h2><ul><li>Adjustments: '+esc(String(packet.adjustments.length))+'</li><li>Compliance rows: '+esc(String(packet.compliance.length))+'</li><li>Execution rows: '+esc(String(packet.execution.length))+'</li><li>Docs: '+esc(String(packet.docs.length))+'</li><li>Events: '+esc(String(packet.events.length))+'</li><li>Conflict rows: '+esc(String(packet.conflicts.length))+'</li></ul></div></div></body></html>';
  }

  function summary(){
    const latestCommand = readCommand()[0] || null;
    const latestDispute = readDisputes()[0] || null;
    return {
      bookings: readBookings().length,
      adjustments: readAdjustments().length,
      compliance: readCompliance().length,
      command: latestCommand,
      dispute: latestDispute
    };
  }

  function inject(){
    const existing = document.getElementById('whiteGloveV48Card'); if(existing) existing.remove();
    const ui = readUI();
    const opts = listBookingOptions();
    const s = summary();
    const host = document.querySelector('#whiteGloveV47Card')?.parentElement || document.querySelector('#app') || document.body;
    const card = document.createElement('div');
    card.className = 'card'; card.id = 'whiteGloveV48Card';
    card.innerHTML = ''+
      '<h2 style="margin:0 0 10px">White-glove financial control board + compliance</h2>'+
      '<div style="display:grid;grid-template-columns:2fr 1fr;gap:14px">'+
        '<section style="border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;background:rgba(255,255,255,.03)">'+
          '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">'+
            '<label>Booking<select id="wgV48Booking">'+opts.map(o => '<option value="'+esc(o.id)+'" '+(clean(ui.bookingId)===clean(o.id)?'selected':'')+'>'+esc(o.label)+'</option>').join('')+'</select></label>'+
            '<label>Adjustment type<select id="wgV48AdjustmentType"><option value="refund" '+(ui.adjustmentType==='refund'?'selected':'')+'>refund</option><option value="credit" '+(ui.adjustmentType==='credit'?'selected':'')+'>credit</option><option value="adjustment" '+(ui.adjustmentType==='adjustment'?'selected':'')+'>adjustment</option></select></label>'+
            '<label>Amount<input id="wgV48Amount" value="'+esc(ui.amount || '')+'" placeholder="25.00"></label>'+
            '<label>Reason<input id="wgV48Reason" value="'+esc(ui.reason || '')+'" placeholder="service recovery / dispute"></label>'+
            '<label>Policy version<input id="wgV48Policy" value="'+esc(ui.policyVersion || 'WG-2026.04')+'"></label>'+
            '<label>Acknowledged by<input id="wgV48AckBy" value="'+esc(ui.acknowledgedBy || 'operator')+'"></label>'+
          '</div>'+
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'+
            '<button class="btn small" id="wgV48SaveAdjustment">Save adjustment</button>'+
            '<button class="btn small" id="wgV48SaveCompliance">Save policy ack</button>'+
            '<button class="btn small" id="wgV48SaveCommand">Save command snapshot</button>'+
            '<button class="btn small" id="wgV48ExportFinance">Export booking finance HTML</button>'+
            '<button class="btn small" id="wgV48ExportDispute">Export dispute HTML</button>'+
          '</div>'+
        '</section>'+
        '<section style="border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;background:rgba(255,255,255,.03)">'+
          '<div><span class="badge">Adjustments '+esc(String(s.adjustments))+'</span><span class="badge">Compliance '+esc(String(s.compliance))+'</span></div>'+
          (s.command ? '<div style="margin-top:8px"><span class="badge">Latest net '+esc(money(s.command.estimatedNet))+'</span><span class="badge">Conflicts '+esc(String(s.command.severeConflicts))+'</span></div>' : '<div style="margin-top:8px">No command snapshot yet.</div>')+
          (s.dispute ? '<div style="margin-top:8px"><span class="badge">Latest dispute '+esc(s.dispute.bookingId)+'</span></div>' : '')+
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn small" id="wgV48ExportCommandHtml">Export command HTML</button><button class="btn small" id="wgV48ExportCommandJson">Export command JSON</button></div>'+
        '</section>'+
      '</div>';
    host.appendChild(card);
    const bind=(id,fn)=>{ const el=document.getElementById(id); if(el) el.onclick=fn; };
    const persistUI = ()=> writeUI({ bookingId: document.getElementById('wgV48Booking')?.value || '', adjustmentType: document.getElementById('wgV48AdjustmentType')?.value || 'refund', amount: document.getElementById('wgV48Amount')?.value || '', reason: document.getElementById('wgV48Reason')?.value || '', policyVersion: document.getElementById('wgV48Policy')?.value || 'WG-2026.04', acknowledgedBy: document.getElementById('wgV48AckBy')?.value || 'operator' });
    ['wgV48Booking','wgV48AdjustmentType','wgV48Amount','wgV48Reason','wgV48Policy','wgV48AckBy'].forEach(id => { const el=document.getElementById(id); if(el) el.onchange = persistUI; if(el) el.oninput = persistUI; });
    bind('wgV48SaveAdjustment', ()=>{ persistUI(); const u=readUI(); const row=saveAdjustment(u.bookingId, u.adjustmentType, u.amount, u.reason); toast(row ? 'Adjustment saved.' : 'Select booking and positive amount.', row ? 'good':'warn'); inject(); });
    bind('wgV48SaveCompliance', ()=>{ persistUI(); const u=readUI(); const row=saveComplianceAck(u.bookingId, u.policyVersion, u.acknowledgedBy, u.reason); toast(row ? 'Policy acknowledgement saved.' : 'Select booking first.', row ? 'good':'warn'); inject(); });
    bind('wgV48SaveCommand', ()=>{ const row=buildCommandSnapshot(); toast(row ? 'Financial control board snapshot saved.' : 'Unable to save snapshot.', row ? 'good':'warn'); inject(); });
    bind('wgV48ExportFinance', ()=>{ persistUI(); const bookingId=readUI().bookingId; const html=buildBookingFinanceHtml(bookingId); if(!html){ toast('Select a booking first.', 'warn'); return; } downloadText(html, 'whiteglove_booking_finance_' + bookingId + '.html', 'text/html'); });
    bind('wgV48ExportDispute', ()=>{ persistUI(); const bookingId=readUI().bookingId; const packet=saveDisputePacket(bookingId); if(!packet){ toast('Select a booking first.', 'warn'); return; } downloadText(buildDisputeHtml(packet), 'whiteglove_dispute_packet_' + bookingId + '.html', 'text/html'); downloadText(JSON.stringify(packet, null, 2), 'whiteglove_dispute_packet_' + bookingId + '.json', 'application/json'); toast('Dispute packet exported.', 'good'); inject(); });
    bind('wgV48ExportCommandHtml', ()=>{ const row=readCommand()[0]; if(!row){ toast('Save a command snapshot first.', 'warn'); return; } downloadText(buildCommandHtml(row), 'whiteglove_command_snapshot_' + dayISO() + '.html', 'text/html'); });
    bind('wgV48ExportCommandJson', ()=>{ const row=readCommand()[0]; if(!row){ toast('Save a command snapshot first.', 'warn'); return; } downloadText(JSON.stringify(row, null, 2), 'whiteglove_command_snapshot_' + dayISO() + '.json', 'application/json'); });
  }
  const observer = new MutationObserver(()=> inject());
  observer.observe(document.body, { childList:true, subtree:true });
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(inject, 0); return out; };
  window.saveWhiteGloveCommandSnapshotV48 = buildCommandSnapshot;
})();
