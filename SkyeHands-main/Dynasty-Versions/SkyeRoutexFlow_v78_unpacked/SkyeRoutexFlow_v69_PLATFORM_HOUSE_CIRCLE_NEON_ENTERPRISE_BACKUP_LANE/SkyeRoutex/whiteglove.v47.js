/* V47 Routex white-glove advanced materialization + profitability + compliance docs */
(function(){
  if(window.__ROUTEX_WHITEGLOVE_V47__) return;
  window.__ROUTEX_WHITEGLOVE_V47__ = true;

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
    routePlans: 'skye_whiteglove_route_plans_v47',
    routePlanOutbox: 'skye_whiteglove_route_plan_outbox_v47',
    profitability: 'skye_whiteglove_profitability_compare_v47',
    profitabilityOutbox: 'skye_whiteglove_profitability_outbox_v47',
    memberUsage: 'skye_whiteglove_member_usage_v47',
    incidentReports: 'skye_whiteglove_incident_reports_v47',
    ui: 'skye_whiteglove_v47_ui'
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
  const readProfiles = ()=> readJSON(SHARED.profiles, []);
  const readDrivers = ()=> readJSON(SHARED.drivers, []);
  const readVehicles = ()=> readJSON(SHARED.vehicles, []);
  const readMemberships = ()=> readJSON(SHARED.memberships, []);
  const readBookings = ()=> readJSON(SHARED.bookings, []);
  const readEvents = ()=> readJSON(SHARED.events, []);
  const readDocs = ()=> readJSON(SHARED.docs, []);
  const readExecution = ()=> readJSON(V41.execution, []);
  const readPayout = ()=> readJSON(V41.payoutLedger, []);
  const readRoutePlans = ()=> readJSON(KEYS.routePlans, []);
  const readProfitability = ()=> readJSON(KEYS.profitability, []);
  const readMemberUsage = ()=> readJSON(KEYS.memberUsage, []);
  const readIncidentReports = ()=> readJSON(KEYS.incidentReports, []);
  const readUI = ()=> readJSON(KEYS.ui, { bookingId:'' });
  const writeRoutePlans = (rows)=> writeJSON(KEYS.routePlans, rows);
  const writeProfitability = (rows)=> writeJSON(KEYS.profitability, rows);
  const writeMemberUsage = (rows)=> writeJSON(KEYS.memberUsage, rows);
  const writeIncidentReports = (rows)=> writeJSON(KEYS.incidentReports, rows);
  const writeUI = (patch)=> writeJSON(KEYS.ui, Object.assign({}, readUI(), patch || {}));

  function getById(rows, id){ return rows.find(row => clean(row.id) === clean(id)) || null; }
  const getBooking = (id)=> getById(readBookings(), id);
  const getProfile = (id)=> getById(readProfiles(), id);
  const getDriver = (id)=> getById(readDrivers(), id);
  const getVehicle = (id)=> getById(readVehicles(), id);
  const getMembership = (id)=> getById(readMemberships(), id);

  function updateBooking(id, mutator){
    let result = null;
    const rows = readBookings().map(row => {
      if(clean(row.id) !== clean(id)) return row;
      const next = Object.assign({}, row);
      const finalRow = mutator ? (mutator(next) || next) : next;
      finalRow.updatedAt = nowISO();
      result = finalRow;
      return finalRow;
    });
    writeJSON(SHARED.bookings, rows);
    return result;
  }

  function pushEvent(type, refs, note, extra){
    const rows = readEvents();
    rows.unshift(Object.assign({ id: uid('wg_evt47'), type, refs: refs || {}, note: clean(note), createdAt: nowISO() }, extra || {}));
    writeJSON(SHARED.events, rows.slice(0, 3000));
  }
  function pushOutbox(key, row, limit){
    const rows = readJSON(key, []);
    rows.unshift(row);
    writeJSON(key, rows.slice(0, limit || 300));
    return row;
  }
  function upsertDoc(type, title, html, meta){
    const rows = readDocs();
    const row = { id: uid('wg_doc47'), type: clean(type), title: clean(title), html: html || '', meta: meta || {}, createdAt: nowISO() };
    rows.unshift(row);
    writeJSON(SHARED.docs, rows.slice(0, 2600));
    return row;
  }

  function parseStops(booking){
    return clean(booking.multiStopText || '').split(/\n+/).map(clean).filter(Boolean);
  }
  function buildLeg(label, from, to, kind, order, extra){
    return Object.assign({ id: uid('wg_leg47'), label, from, to, kind, order }, extra || {});
  }
  function saveAdvancedRoutePlan(bookingId){
    const booking = getBooking(bookingId);
    if(!booking) return null;
    const profile = getProfile(booking.serviceProfileId);
    const stops = parseStops(booking);
    const legs = [];
    let order = 1;
    let from = clean(booking.pickupAddress || 'Pickup');
    if(stops.length){
      stops.forEach((stop, idx)=>{
        legs.push(buildLeg('Outbound stop ' + (idx + 1), from, stop, 'service_stop', order++, { direction:'outbound', dwellMinutes:10 }));
        from = stop;
      });
    }
    const finalDrop = clean(booking.dropoffAddress || 'Dropoff');
    legs.push(buildLeg('Primary dropoff', from, finalDrop, 'dropoff', order++, { direction:'outbound', dwellMinutes:5 }));
    if(booking.standbyPlanned || Number(booking.standbyMinutesPlanned || 0) > 0 || clean(booking.serviceType) === 'hourly_standby'){
      legs.push(buildLeg('Standby hold', finalDrop, finalDrop, 'standby_hold', order++, { direction:'service', standbyMinutes:Number(booking.standbyMinutesPlanned || 0), dwellMinutes:Number(booking.standbyMinutesPlanned || 0) }));
    }
    if(booking.returnLeg){
      const reverseStops = stops.slice().reverse();
      let current = finalDrop;
      reverseStops.forEach((stop, idx)=>{
        legs.push(buildLeg('Return stop ' + (idx + 1), current, stop, 'return_stop', order++, { direction:'return', dwellMinutes:10 }));
        current = stop;
      });
      legs.push(buildLeg('Return to pickup', current, clean(booking.pickupAddress || 'Pickup'), 'return_complete', order++, { direction:'return', dwellMinutes:5 }));
    }
    const plan = {
      id: uid('wg_route47'),
      bookingId: booking.id,
      serviceProfileId: booking.serviceProfileId || '',
      profileLabel: (profile && profile.displayName) || booking.serviceProfileName || 'Client',
      serviceType: booking.serviceType || '',
      market: booking.market || '',
      standbyPlanned: !!booking.standbyPlanned,
      standbyMinutesPlanned: Number(booking.standbyMinutesPlanned || 0),
      returnLeg: !!booking.returnLeg,
      airportMeetGreet: !!booking.airportMeetGreet,
      legCount: legs.length,
      stopCount: stops.length,
      legs,
      createdAt: nowISO(),
      fingerprint: [booking.id, legs.length, stops.length, booking.returnLeg ? 'return' : 'oneway', booking.standbyPlanned ? 'standby' : 'nostandby'].join('::')
    };
    const rows = readRoutePlans();
    rows.unshift(plan);
    writeRoutePlans(rows.slice(0, 600));
    updateBooking(booking.id, row => {
      row.routeMaterialized = true;
      row.routeMaterializedAt = nowISO();
      row.routePlanId = plan.id;
      row.routeStopSequence = [clean(booking.pickupAddress || '')].concat(stops).concat([clean(booking.dropoffAddress || '')]).filter(Boolean);
      row.routeStopSequenceDetailed = legs.map(leg => ({ label: leg.label, from: leg.from, to: leg.to, kind: leg.kind, direction: leg.direction || '' }));
      row.routeLegCount = legs.length;
      row.routeReturnLegBuilt = !!booking.returnLeg;
      row.timeline = Array.isArray(row.timeline) ? row.timeline : [];
      row.timeline.push({ status:'route_materialized_v47', at: nowISO(), note:'Advanced multi-stop / return-leg route plan saved.', routePlanId: plan.id, legCount: plan.legCount, stopCount: plan.stopCount });
      return row;
    });
    pushOutbox(KEYS.routePlanOutbox, { id: uid('wg_route_out47'), routePlanId: plan.id, bookingId: booking.id, fingerprint: plan.fingerprint, createdAt: nowISO() }, 400);
    pushEvent('whiteglove_route_plan_saved', { bookingId: booking.id, routePlanId: plan.id }, 'Advanced route plan saved', { legCount: plan.legCount, returnLeg: plan.returnLeg, standbyPlanned: plan.standbyPlanned });
    return plan;
  }

  function buildProfitabilityComparison(bookingId){
    const booking = getBooking(bookingId);
    if(!booking) return null;
    const execution = readExecution().find(row => clean(row.bookingId) === clean(booking.id)) || {};
    const payout = readPayout().find(row => clean(row.bookingId) === clean(booking.id)) || {};
    const plan = readRoutePlans().find(row => clean(row.bookingId) === clean(booking.id)) || null;
    const ps = booking.pricingSnapshot || {};
    const final = booking.finalEconomics || {};
    const quotedRevenue = Number(ps.quotedTotal || 0);
    const recognizedRevenue = Number(final.recognizedRevenue || quotedRevenue || 0);
    const waitRevenue = Number(final.waitCharge || execution.waitRevenue || 0);
    const overageRevenue = Number(final.overageRevenue || execution.overageRevenue || 0);
    const tip = Number(booking.tipAmount || payout.tipAmount || 0);
    const refund = Number(booking.refundAmount || payout.refundAmount || 0);
    const credit = Number(booking.creditAmount || payout.creditAmount || 0);
    const payoutAmount = Number((booking.payout && booking.payout.amount) || payout.amount || 0);
    const legCount = Number((plan && plan.legCount) || booking.routeLegCount || 2);
    const stopCount = Number((plan && plan.stopCount) || parseStops(booking).length || 0);
    const fuelReserve = Number((legCount * 3.25 + stopCount * 0.85).toFixed(2));
    const handlingReserve = Number(((booking.airportMeetGreet ? 6 : 0) + (booking.returnLeg ? 4 : 0) + (booking.standbyPlanned ? 5 : 0)).toFixed(2));
    const grossRevenue = Number((recognizedRevenue + tip - refund - credit).toFixed(2));
    const estimatedNet = Number((grossRevenue - payoutAmount - fuelReserve - handlingReserve).toFixed(2));
    const result = {
      id: uid('wg_profit47'),
      bookingId: booking.id,
      routePlanId: plan ? plan.id : '',
      quotedRevenue,
      recognizedRevenue,
      waitRevenue,
      overageRevenue,
      tip,
      refund,
      credit,
      grossRevenue,
      payoutAmount,
      fuelReserve,
      handlingReserve,
      estimatedNet,
      retailVsMember: booking.membershipId ? 'member' : 'retail',
      legCount,
      stopCount,
      createdAt: nowISO(),
      fingerprint: [booking.id, grossRevenue.toFixed(2), payoutAmount.toFixed(2), estimatedNet.toFixed(2)].join('::')
    };
    const rows = readProfitability();
    rows.unshift(result);
    writeProfitability(rows.slice(0, 600));
    updateBooking(booking.id, row => {
      row.profitabilityCompareId = result.id;
      row.latestNetEstimate = result.estimatedNet;
      row.timeline = Array.isArray(row.timeline) ? row.timeline : [];
      row.timeline.push({ status:'profitability_compared_v47', at: nowISO(), note:'Booking vs route profitability comparison saved.', profitabilityCompareId: result.id, estimatedNet: result.estimatedNet });
      return row;
    });
    pushOutbox(KEYS.profitabilityOutbox, { id: uid('wg_profit_out47'), profitabilityId: result.id, bookingId: booking.id, estimatedNet: result.estimatedNet, createdAt: nowISO() }, 400);
    pushEvent('whiteglove_profitability_saved', { bookingId: booking.id, profitabilityId: result.id }, 'Profitability comparison saved', { estimatedNet: result.estimatedNet, grossRevenue: result.grossRevenue });
    return result;
  }

  function buildMemberUsageHtml(booking){
    const profile = getProfile(booking.serviceProfileId);
    const membership = getMembership(booking.membershipId);
    const ps = booking.pricingSnapshot || {};
    const usageHours = Number(booking.actualUsageHours || ps.bookedHours || 0);
    const usageMiles = Number(booking.actualUsageMiles || ps.requestedMiles || 0);
    return '<!doctype html><html><head><meta charset="utf-8"><title>Member usage summary</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.badge{display:inline-block;padding:4px 8px;border:1px solid #888;border-radius:999px;margin-right:8px}table{border-collapse:collapse;width:100%;margin-top:12px}td,th{border:1px solid #ccc;padding:8px;text-align:left}</style></head><body><h1>White-glove Member Usage Summary</h1><div><span class="badge">Booking '+esc(booking.id)+'</span><span class="badge">Membership '+esc((membership && membership.id) || '—')+'</span><span class="badge">'+esc((membership && membership.planType) || booking.billingMode || 'member')+'</span></div><p><strong>Client:</strong> '+esc((profile && profile.displayName) || booking.serviceProfileName || '—')+'<br><strong>Window:</strong> '+esc(booking.etaWindow || '—')+'</p><table><tbody><tr><th>Included hours before draw</th><td>'+esc(String((membership && membership.remainingHours) != null ? membership.remainingHours : '—'))+'</td></tr><tr><th>Included miles before draw</th><td>'+esc(String((membership && membership.remainingMiles) != null ? membership.remainingMiles : '—'))+'</td></tr><tr><th>Usage hours</th><td>'+esc(String(usageHours))+'</td></tr><tr><th>Usage miles</th><td>'+esc(String(usageMiles))+'</td></tr><tr><th>Quoted member value</th><td>'+money(ps.quotedTotal || 0)+'</td></tr><tr><th>Recognized revenue</th><td>'+money((booking.finalEconomics && booking.finalEconomics.recognizedRevenue) || ps.quotedTotal || 0)+'</td></tr></tbody></table></body></html>';
  }
  function exportMemberUsageSummary(bookingId){
    const booking = getBooking(bookingId);
    if(!booking || !booking.membershipId) return null;
    const html = buildMemberUsageHtml(booking);
    const doc = upsertDoc('member_usage_summary_v47', 'whiteglove_member_usage_' + booking.id, html, { bookingId: booking.id, membershipId: booking.membershipId, type:'member_usage_summary' });
    const row = { id: uid('wg_member47'), bookingId: booking.id, membershipId: booking.membershipId, docId: doc.id, createdAt: nowISO() };
    const rows = readMemberUsage();
    rows.unshift(row);
    writeMemberUsage(rows.slice(0, 400));
    pushEvent('whiteglove_member_usage_exported', { bookingId: booking.id, membershipId: booking.membershipId, docId: doc.id }, 'Member usage summary exported', {});
    return { booking, doc, html, row };
  }

  function buildIncidentReportHtml(booking){
    const profile = getProfile(booking.serviceProfileId);
    const driver = getDriver(booking.assignedDriverId);
    const vehicle = getVehicle(booking.assignedVehicleId);
    const execution = readExecution().find(row => clean(row.bookingId) === clean(booking.id)) || {};
    return '<!doctype html><html><head><meta charset="utf-8"><title>Driver incident report</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.wrap{max-width:1100px;margin:0 auto}.card{border:1px solid #ddd;border-radius:18px;padding:16px;margin:0 0 16px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px">White-glove Driver Incident Report</h1><p><strong>Booking:</strong> '+esc(booking.id)+'<br><strong>Client:</strong> '+esc((profile && profile.displayName) || booking.serviceProfileName || '—')+'<br><strong>Driver:</strong> '+esc((driver && driver.displayName) || 'Unassigned')+'<br><strong>Vehicle:</strong> '+esc((vehicle && vehicle.displayName) || 'Unassigned')+'</p></div><div class="card"><table><tbody><tr><th>Service recovery state</th><td>'+esc(booking.serviceRecoveryState || execution.serviceRecoveryState || 'Not flagged')+'</td></tr><tr><th>Closeout note</th><td>'+esc(booking.closeoutNote || execution.closeoutNote || '—')+'</td></tr><tr><th>White-glove note</th><td>'+esc(booking.whiteGloveNotes || '—')+'</td></tr><tr><th>Assistance events</th><td>'+esc((booking.assistanceEvents || []).join(', ') || 'None recorded')+'</td></tr><tr><th>Status</th><td>'+esc(booking.dispatchStatus || '—')+'</td></tr></tbody></table></div></div></body></html>';
  }
  function exportIncidentReport(bookingId){
    const booking = getBooking(bookingId);
    if(!booking) return null;
    const execution = readExecution().find(row => clean(row.bookingId) === clean(booking.id)) || {};
    const shouldWrite = clean(booking.serviceRecoveryState || execution.serviceRecoveryState || booking.closeoutNote || execution.closeoutNote || booking.whiteGloveNotes || '').length > 0;
    if(!shouldWrite) return null;
    const html = buildIncidentReportHtml(booking);
    const doc = upsertDoc('driver_incident_report_v47', 'whiteglove_driver_incident_' + booking.id, html, { bookingId: booking.id, driverId: booking.assignedDriverId || '', type:'driver_incident_report' });
    const row = { id: uid('wg_incident47'), bookingId: booking.id, driverId: booking.assignedDriverId || '', docId: doc.id, createdAt: nowISO() };
    const rows = readIncidentReports();
    rows.unshift(row);
    writeIncidentReports(rows.slice(0, 400));
    pushEvent('whiteglove_incident_report_exported', { bookingId: booking.id, driverId: booking.assignedDriverId || '', docId: doc.id }, 'Driver incident report exported', {});
    return { booking, doc, html, row };
  }

  function bookingOptionsHtml(selectedId){
    return readBookings().map(row => '<option value="'+esc(row.id)+'"'+(clean(row.id) === clean(selectedId) ? ' selected' : '')+'>'+esc((row.serviceProfileName || getProfile(row.serviceProfileId)?.displayName || row.id) + ' • ' + (row.dispatchStatus || '—'))+'</option>').join('');
  }
  function currentBooking(){
    const ui = readUI();
    const booking = getBooking(ui.bookingId) || readBookings()[0] || null;
    if(booking && clean(ui.bookingId) !== clean(booking.id)) writeUI({ bookingId: booking.id });
    return booking;
  }
  function summary(){
    return {
      plans: readRoutePlans().length,
      profitability: readProfitability().length,
      memberUsage: readMemberUsage().length,
      incidentReports: readIncidentReports().length,
      latestPlan: readRoutePlans()[0] || null,
      latestProfit: readProfitability()[0] || null
    };
  }
  function profitabilityHtml(result){
    return '<!doctype html><html><head><meta charset="utf-8"><title>Profitability comparison</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}table{border-collapse:collapse;width:100%;margin-top:12px}td,th{border:1px solid #ccc;padding:8px;text-align:left}</style></head><body><h1>Booking vs Route Profitability</h1><table><tbody><tr><th>Booking</th><td>'+esc(result.bookingId)+'</td></tr><tr><th>Gross revenue</th><td>'+money(result.grossRevenue)+'</td></tr><tr><th>Payout</th><td>'+money(result.payoutAmount)+'</td></tr><tr><th>Fuel reserve</th><td>'+money(result.fuelReserve)+'</td></tr><tr><th>Handling reserve</th><td>'+money(result.handlingReserve)+'</td></tr><tr><th>Estimated net</th><td>'+money(result.estimatedNet)+'</td></tr><tr><th>Leg count</th><td>'+esc(String(result.legCount))+'</td></tr><tr><th>Stop count</th><td>'+esc(String(result.stopCount))+'</td></tr></tbody></table></body></html>';
  }

  function inject(){
    const existing = document.getElementById('routexWhiteGloveV47Card');
    if(existing) existing.remove();
    const host = document.querySelector('#app') || document.body;
    const stats = summary();
    const booking = currentBooking();
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'routexWhiteGloveV47Card';
    card.innerHTML = ''+
      '<h2 style="margin:0 0 10px">White-glove route materialization + profitability center</h2>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><span class="badge">Route plans '+esc(String(stats.plans))+'</span><span class="badge">Profit compares '+esc(String(stats.profitability))+'</span><span class="badge">Member usage docs '+esc(String(stats.memberUsage))+'</span><span class="badge">Incident reports '+esc(String(stats.incidentReports))+'</span></div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">'+
        '<section style="border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;background:rgba(255,255,255,.03)">'+
          '<h3 style="margin:0 0 8px">Selected booking execution builder</h3>'+
          (booking ? ('<div style="margin-bottom:8px"><span class="badge">'+esc(booking.id)+'</span><span class="badge">'+esc(booking.dispatchStatus || '—')+'</span><span class="badge">'+esc(booking.serviceType || '—')+'</span><span class="badge">'+esc(booking.membershipId ? 'member' : 'retail')+'</span></div>') : '<div>No booking available.</div>')+
          '<label>Booking<select id="wg47BookingSel" style="width:100%;margin-top:4px"><option value="">Select booking</option>'+bookingOptionsHtml(booking && booking.id)+'</select></label>'+
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn small" id="wg47PlanBtn">Save advanced route plan</button><button class="btn small" id="wg47ProfitBtn">Save profitability compare</button><button class="btn small" id="wg47MemberBtn">Export member usage</button><button class="btn small" id="wg47IncidentBtn">Export incident report</button></div>'+
          '<div style="margin-top:10px;color:#a6adbb">This lane builds real multi-stop / return-leg route plans, stores profitability comparisons, and exports compliance docs from actual booking records.</div>'+
        '</section>'+
        '<section style="border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;background:rgba(255,255,255,.03)">'+
          '<h3 style="margin:0 0 8px">Latest saved outputs</h3>'+
          (stats.latestPlan ? ('<div><span class="badge">Plan '+esc(stats.latestPlan.fingerprint || '—')+'</span><span class="badge">Legs '+esc(String(stats.latestPlan.legCount || 0))+'</span><span class="badge">Stops '+esc(String(stats.latestPlan.stopCount || 0))+'</span></div>') : '<div>No advanced route plan saved yet.</div>')+
          (stats.latestProfit ? ('<div style="margin-top:8px"><span class="badge">Net '+money(stats.latestProfit.estimatedNet || 0)+'</span><span class="badge">Gross '+money(stats.latestProfit.grossRevenue || 0)+'</span><span class="badge">Payout '+money(stats.latestProfit.payoutAmount || 0)+'</span></div><div style="margin-top:8px"><button class="btn small" id="wg47ExportProfitHtmlBtn">Export profitability HTML</button><button class="btn small" id="wg47ExportProfitJsonBtn">Export profitability JSON</button></div>') : '<div style="margin-top:8px">No profitability comparison saved yet.</div>')+
        '</section>'+
      '</div>';
    host.appendChild(card);

    const selected = ()=> clean((document.getElementById('wg47BookingSel') || {}).value || (booking && booking.id) || '');
    const bind = (id, fn)=> { const el = document.getElementById(id); if(el) el.onclick = fn; };
    const sel = document.getElementById('wg47BookingSel');
    if(sel) sel.onchange = ()=> { writeUI({ bookingId: sel.value }); setTimeout(inject, 0); };
    bind('wg47PlanBtn', ()=>{
      const row = saveAdvancedRoutePlan(selected());
      toast(row ? 'Advanced route plan saved.' : 'Select a booking first.', row ? 'good' : 'warn');
      inject();
    });
    bind('wg47ProfitBtn', ()=>{
      const row = buildProfitabilityComparison(selected());
      toast(row ? 'Profitability comparison saved.' : 'Select a booking first.', row ? 'good' : 'warn');
      inject();
    });
    bind('wg47MemberBtn', ()=>{
      const pack = exportMemberUsageSummary(selected());
      if(!pack) return toast('Selected booking is not linked to a membership.', 'warn');
      downloadText(pack.html, 'whiteglove_member_usage_' + pack.booking.id + '.html', 'text/html');
      toast('Member usage summary exported.', 'good');
      inject();
    });
    bind('wg47IncidentBtn', ()=>{
      const pack = exportIncidentReport(selected());
      if(!pack) return toast('No incident/service-recovery signal exists on that booking yet.', 'warn');
      downloadText(pack.html, 'whiteglove_driver_incident_' + pack.booking.id + '.html', 'text/html');
      toast('Driver incident report exported.', 'good');
      inject();
    });
    bind('wg47ExportProfitHtmlBtn', ()=>{
      const row = readProfitability()[0]; if(!row) return toast('No profitability comparison saved yet.', 'warn');
      downloadText(profitabilityHtml(row), 'whiteglove_profitability_' + row.bookingId + '.html', 'text/html');
    });
    bind('wg47ExportProfitJsonBtn', ()=>{
      const row = readProfitability()[0]; if(!row) return toast('No profitability comparison saved yet.', 'warn');
      downloadText(JSON.stringify(row, null, 2), 'whiteglove_profitability_' + row.bookingId + '.json', 'application/json');
    });
  }

  const observer = new MutationObserver(()=> inject());
  observer.observe(document.body, { childList:true, subtree:true });
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(inject, 0); return out; };

  window.readWhiteGloveRoutePlansV47 = readRoutePlans;
  window.readWhiteGloveProfitabilityV47 = readProfitability;
  window.saveWhiteGloveAdvancedRoutePlanV47 = saveAdvancedRoutePlan;
  window.saveWhiteGloveProfitabilityCompareV47 = buildProfitabilityComparison;
  window.exportWhiteGloveMemberUsageSummaryV47 = exportMemberUsageSummary;
  window.exportWhiteGloveIncidentReportV47 = exportIncidentReport;
})();
