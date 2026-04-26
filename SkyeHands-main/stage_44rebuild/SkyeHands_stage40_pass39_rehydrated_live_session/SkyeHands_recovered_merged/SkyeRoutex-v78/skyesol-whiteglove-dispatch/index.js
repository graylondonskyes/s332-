const H = require('../skyesol-whiteglove-runtime/shared');
const { buildMaterializedRoute } = require('../skyesol-whiteglove-bookings');
const SERVICE = 'skyesol-whiteglove-dispatch';

function exactWindowOverlap(a, b){ return H.clean(a) && H.clean(b) && H.clean(a) === H.clean(b); }
function openStatuses(){ return new Set(['confirmed','assigned','en_route','arrived','rider_boarded','in_service']); }

function scoreConflicts(booking, availabilityRows, allBookings){
  const blockers = [];
  const severity = { low:0, medium:1, high:2 };
  let max = 0;
  availabilityRows.forEach(row => {
    if(H.clean(row.driverId) === H.clean(booking.assignedDriverId) && H.clean(row.market) && H.clean(row.market) !== H.clean(booking.market)){
      blockers.push({ type:'driver_market_mismatch', driverId:row.driverId, market:row.market }); max = Math.max(max, severity.medium);
    }
    if(row.blackoutStart && row.blackoutEnd && booking.etaWindow){ blockers.push({ type:'driver_blackout_overlap', driverId:row.driverId }); max = Math.max(max, severity.high); }
  });
  const active = allBookings.filter(row => H.clean(row.id) !== H.clean(booking.id) && openStatuses().has(H.clean(row.dispatchStatus || row.status).toLowerCase()));
  active.forEach(row => {
    if(H.clean(row.assignedDriverId) && H.clean(row.assignedDriverId) === H.clean(booking.assignedDriverId) && exactWindowOverlap(row.etaWindow, booking.etaWindow)){
      blockers.push({ type:'driver_window_overlap', driverId:row.assignedDriverId, otherBookingId:row.id }); max = Math.max(max, severity.high);
    }
    if(H.clean(row.assignedVehicleId) && H.clean(row.assignedVehicleId) === H.clean(booking.assignedVehicleId) && exactWindowOverlap(row.etaWindow, booking.etaWindow)){
      blockers.push({ type:'vehicle_window_overlap', vehicleId:row.assignedVehicleId, otherBookingId:row.id }); max = Math.max(max, severity.high);
    }
    if(H.clean(row.serviceProfileId) && H.clean(row.serviceProfileId) === H.clean(booking.serviceProfileId) && exactWindowOverlap(row.etaWindow, booking.etaWindow)){
      blockers.push({ type:'rider_window_overlap', serviceProfileId:row.serviceProfileId, otherBookingId:row.id }); max = Math.max(max, severity.medium);
    }
  });
  if(booking.returnLeg) { blockers.push({ type:'return_leg_complexity', note:'Return leg requires mirrored availability.' }); max = Math.max(max, severity.medium); }
  if(H.toNum(booking.standbyMinutesPlanned || 0,0) > 0) { blockers.push({ type:'standby_exposure', minutes:H.toNum(booking.standbyMinutesPlanned || 0,0) }); max = Math.max(max, severity.medium); }
  if(H.clean(booking.multiStopText)) { blockers.push({ type:'multi_stop_depth', stopCount:H.clean(booking.multiStopText).split(/\n+|\s*->\s*|\s*>\s*|\s*\|\s*/).filter(Boolean).length }); max = Math.max(max, severity.medium); }
  if(booking.airportMeetGreet) { blockers.push({ type:'airport_window_sensitivity', note:'Meet/greet requires tighter arrival handling.' }); max = Math.max(max, severity.medium); }
  return { blockers, severity: max >= 2 ? 'high' : max === 1 ? 'medium' : 'low' };
}

function buildCommandCenter(){
  const bookings = H.getStore('bookings');
  const availability = H.getStore('dispatchAvailability');
  const events = H.getStore('dispatchEvents');
  const payments = H.getStore('payments');
  const payouts = H.getStore('payouts');
  const memberships = H.getStore('memberships');
  const syncQueue = H.getStore('syncQueue');
  const active = bookings.filter(row => openStatuses().has(H.clean(row.dispatchStatus || row.status).toLowerCase()));
  const conflictRows = active.map(row => ({ bookingId: row.id, ...scoreConflicts(row, availability, bookings) }));
  const severe = conflictRows.filter(row => row.severity === 'high').length;
  const quoted = bookings.reduce((sum, row) => sum + H.toNum(row.pricingSnapshot && row.pricingSnapshot.quotedTotal || 0, 0), 0);
  const paymentTotal = payments.reduce((sum, row) => sum + H.toNum(row.total || 0, 0), 0);
  const payoutTotal = payouts.reduce((sum, row) => sum + H.toNum(row.payoutAmount || 0, 0), 0);
  const memberBookings = bookings.filter(row => H.clean(row.membershipId)).length;
  const retailBookings = bookings.length - memberBookings;
  const materialized = bookings.filter(row => row.routeMaterialized).length;
  return {
    createdAt: H.iso(),
    bookings: bookings.length,
    activeBookings: active.length,
    memberBookings,
    retailBookings,
    materializedBookings: materialized,
    syncQueueDepth: syncQueue.length,
    severeConflicts: severe,
    mediumConflicts: conflictRows.filter(row => row.severity === 'medium').length,
    availabilityRows: availability.length,
    dispatchEvents: events.length,
    memberships: memberships.length,
    quotedRevenue: Number(quoted.toFixed(2)),
    recognizedRevenue: Number(paymentTotal.toFixed(2)),
    payoutLiability: Number(payoutTotal.toFixed(2)),
    estimatedNet: Number((paymentTotal - payoutTotal).toFixed(2)),
    conflictRows
  };
}


function buildUnifiedOperatorDeck(){
  const command = buildCommandCenter();
  const bookings = H.getStore('bookings');
  const memberships = H.getStore('memberships');
  const payments = H.getStore('payments');
  const payouts = H.getStore('payouts');
  const syncQueue = H.getStore('syncQueue');
  const websiteRequests = H.getStore('bookingRequests').filter(row => H.clean(row.requestSource) === 'website');
  const favoriteMatched = bookings.filter(row => H.clean(row.favoriteDriverState) === 'matched').length;
  const activeMemberships = memberships.filter(row => !['cancelled','expired'].includes(H.clean(row.status).toLowerCase())).length;
  const paymentTotal = payments.reduce((sum, row) => sum + H.toNum(row.amount || row.chargeAmount || 0, 0), 0);
  const payoutTotal = payouts.reduce((sum, row) => sum + H.toNum(row.amount || row.totalPayout || row.payoutAmount || 0, 0), 0);
  return {
    id: H.uid('wg_opdeck51'),
    createdAt: H.iso(),
    command,
    continuity: {
      favoriteMatched,
      activeMemberships,
      memberBookings: bookings.filter(row => /member|included/i.test(H.clean(row.billingMode || ''))).length,
      retailBookings: bookings.filter(row => !/member|included/i.test(H.clean(row.billingMode || ''))).length
    },
    backend: {
      websiteRequests: websiteRequests.length,
      syncQueue: syncQueue.length,
      payments: payments.length,
      payouts: payouts.length,
      recognizedRevenue: Number(paymentTotal.toFixed(2)),
      payoutLiability: Number(payoutTotal.toFixed(2)),
      estimatedNet: Number((paymentTotal - payoutTotal).toFixed(2))
    }
  };
}

function buildOperatorSuperdeck(){
  const deck = buildUnifiedOperatorDeck();
  const active = H.getStore('bookings').filter(row => openStatuses().has(H.clean(row.dispatchStatus || row.status).toLowerCase()));
  const standbyExposure = active.filter(row => H.toNum(row.standbyMinutesPlanned || 0, 0) > 0 || H.clean(row.serviceType) === 'hourly_standby').length;
  const airportExposure = active.filter(row => row.airportMeetGreet).length;
  const returnLegExposure = active.filter(row => row.returnLeg).length;
  return { id:H.uid('wg_superdeck52'), createdAt:H.iso(), deck, risk:{ standbyExposure, airportExposure, returnLegExposure, severeConflicts: deck.command.severeConflicts, mediumConflicts: deck.command.mediumConflicts, syncQueue: deck.backend.syncQueue }, note:'Dispatch-side superdeck deepens the operator deck with standby, airport, and return-leg exposure.' };
}


function buildEntrypointSpreadReport(){
  const bookings = H.getStore('bookings');
  const completed = bookings.filter(row => H.clean(row.dispatchStatus || row.status).toLowerCase() === 'completed').length;
  const active = bookings.filter(row => openStatuses().has(H.clean(row.dispatchStatus || row.status).toLowerCase())).length;
  return {
    createdAt:H.iso(),
    entryPoints:{ dispatchBoard:true, commandCenter:true, operatorDeck:true, operatorSuperdeck:true, operatorSurfaceBundle:true, surfaceSaturation:true },
    counts:{ bookings:bookings.length, active, completed },
    saturationNote: active ? 'Dispatch-side entry points are live for active service chains.' : 'Dispatch-side entry points are loaded even without active service chains.'
  };
}


function buildEntrypointSpreadV56(){
  const bookings = H.getStore('bookings');
  const memberships = H.getStore('memberships');
  const payouts = H.getStore('payouts');
  const payments = H.getStore('payments');
  const syncQueue = H.getStore('syncQueue');
  const coverage = [
    { surface:'dashboard', ready:true, reason:'base operator shell exists' },
    { surface:'dispatch_board', ready:bookings.length > 0, reason:'booking rows=' + bookings.length },
    { surface:'continuity', ready:memberships.length > 0, reason:'membership rows=' + memberships.length },
    { surface:'finance', ready:(payments.length + payouts.length) > 0, reason:'finance rows=' + (payments.length + payouts.length) },
    { surface:'backend_queue', ready:syncQueue.length > 0, reason:'queue rows=' + syncQueue.length },
    { surface:'valuation', ready:true, reason:'valuation lane shipped in app bundle' },
    { surface:'proof', ready:true, reason:'proof lane shipped in app bundle' },
    { surface:'settings_academy', ready:true, reason:'tutorial center present in app bundle' }
  ];
  return { ok:true, covered:coverage.filter(row => row.ready).length, missing:coverage.filter(row => !row.ready).length, coverage };
}

function buildSurfaceSaturation(){
  const bookings = H.getStore('bookings');
  const availability = H.getStore('dispatchAvailability');
  const events = H.getStore('dispatchEvents');
  const payouts = H.getStore('payouts');
  const payments = H.getStore('payments');
  const active = bookings.filter(row => ['assigned','en_route','arrived','rider_boarded','in_service'].includes(H.clean(row.dispatchStatus || row.status))).length;
  const completed = bookings.filter(row => H.clean(row.dispatchStatus || row.status) === 'completed').length;
  const withDriver = bookings.filter(row => H.clean(row.assignedDriverId)).length;
  const withVehicle = bookings.filter(row => H.clean(row.assignedVehicleId)).length;
  return { ok:true, saturationScore: Math.max(0, Math.min(100, 50 + Math.min(20, withDriver) + Math.min(20, withVehicle) + Math.min(10, completed))), counts:{ bookings:bookings.length, availability:availability.length, events:events.length, active, completed, withDriver, withVehicle, payouts:payouts.length, payments:payments.length }, notes:[ active ? ('There are ' + active + ' active service chains.') : 'No active service chains right now.', completed ? ('Completed chains: ' + completed + '.') : 'No completed chains yet.', availability.length ? 'Driver availability rows exist.' : 'Driver availability rows are still empty.' ] };
}




function buildOperatorSurfaceBundle(){
  const deck = buildUnifiedOperatorDeck();
  const superdeck = buildOperatorSuperdeck();
  const bookings = H.getStore('bookings');
  const payments = H.getStore('payments');
  const payouts = H.getStore('payouts');
  const completed = bookings.filter(row => H.clean(row.dispatchStatus || row.status).toLowerCase() === 'completed');
  const blockers = [];
  if(superdeck.conflictBreakdown && H.toNum(superdeck.conflictBreakdown.high || 0, 0) > 0) blockers.push('high_conflicts_present');
  if(completed.length > 0 && payouts.filter(row => H.clean(row.bookingId)).length < completed.length) blockers.push('completed_bookings_exceed_payout_rows');
  return { ok:blockers.length === 0, blockers, deck, superdeck, finance:{ payments:payments.length, payouts:payouts.length, completedBookings:completed.length } };
}

function route(request){
  const auth = H.checkToken(request, SERVICE); if(auth) return auth;
  const path = H.clean(request && request.path || '/') || '/';
  const method = H.clean(request && request.method || 'GET').toUpperCase();
  const body = H.parseBody(request);
  if(path === '/health') return H.json(H.responseEnvelope(SERVICE,{ status:'healthy', counts:{ availability:H.getStore('dispatchAvailability').length, events:H.getStore('dispatchEvents').length } }));
  if(path === '/board'){
    if(method !== 'GET') return H.methodNotAllowed(method,['GET']);
    return H.json(H.responseEnvelope(SERVICE,{ bookings:H.clone(H.getStore('bookings')), availability:H.clone(H.getStore('dispatchAvailability')), events:H.clone(H.getStore('dispatchEvents')) }));
  }
  if(path === '/command-center'){
    if(method !== 'GET') return H.methodNotAllowed(method,['GET']);
    return H.json(H.responseEnvelope(SERVICE,{ snapshot: buildCommandCenter() }));
  }

if(path === '/operator-deck'){
  if(method !== 'GET') return H.methodNotAllowed(method,['GET']);
  return H.json(H.responseEnvelope(SERVICE,{ deck: buildUnifiedOperatorDeck() }));
}

if(path === '/operator-surface-bundle'){
    if(method !== 'GET') return H.methodNotAllowed(method,['GET']);
    return H.json(H.responseEnvelope(SERVICE,{ bundle: buildOperatorSurfaceBundle() }));
  }

  if(path === '/operator-superdeck'){
  if(method !== 'GET') return H.methodNotAllowed(method,['GET']);
  return H.json(H.responseEnvelope(SERVICE,{ superdeck: buildOperatorSuperdeck() }));
}


  if(path === '/entrypoint-spread'){
    if(method !== 'GET') return H.methodNotAllowed(method,['GET']);
    return H.json(H.responseEnvelope(SERVICE,{ spread: buildEntrypointSpreadReport() }));
  }

  if(path === '/entrypoint-spread-v56'){
    if(method !== 'GET') return H.methodNotAllowed(method,['GET']);
    return H.json(H.responseEnvelope(SERVICE, buildEntrypointSpreadV56()));
  }
  if(path === '/surface-saturation'){
    if(method !== 'GET') return H.methodNotAllowed(method,['GET']);
    return H.json(H.responseEnvelope(SERVICE,{ saturation: buildSurfaceSaturation() }));
  }
  if(path === '/availability'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    const missing = H.requireFields(body,['driverId','market','shiftStart','shiftEnd']);
    if(missing.length) return H.badRequest(SERVICE,'Missing availability fields.',{ missing });
    const row = { id:H.uid('wg_av50'), driverId:H.clean(body.driverId), market:H.clean(body.market), shiftStart:H.clean(body.shiftStart), shiftEnd:H.clean(body.shiftEnd), blackoutStart:H.clean(body.blackoutStart || ''), blackoutEnd:H.clean(body.blackoutEnd || ''), notes:H.clean(body.notes || ''), createdAt:H.iso() };
    H.pushStore('dispatchAvailability', row, 2000);
    return H.json(H.responseEnvelope(SERVICE,{ availability: row }), 201);
  }
  if(path === '/assign' || path === '/reassign'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    const missing = H.requireFields(body,['bookingId','driverId','vehicleId']);
    if(missing.length) return H.badRequest(SERVICE,'Missing assignment fields.',{ missing });
    const booking = H.updateById('bookings', body.bookingId, row => {
      row.assignedDriverId = H.clean(body.driverId); row.assignedVehicleId = H.clean(body.vehicleId); row.dispatchStatus = 'assigned'; row.status = 'assigned';
      row.favoriteDriverState = H.clean(body.favoriteDriverState || row.favoriteDriverState || 'preferred');
      row.updatedAt = H.iso(); row.timeline = Array.isArray(row.timeline) ? row.timeline : []; row.timeline.push({ status:path === '/reassign' ? 'reassigned' : 'assigned', at:H.iso(), note:H.clean(body.note || '') });
      if(body.materializeRoute !== false){
        row.routeMaterialized = true; row.routeMaterializedAt = H.iso();
        Object.assign(row, H.pick(buildMaterializedRoute(row), ['routeFingerprint','routeStopSequence','routeStopSequenceDetailed','routeLegCount','routeStopCount','routeReturnLegBuilt','standbyMinutesPlanned']));
      }
      return row;
    });
    if(!booking) return H.badRequest(SERVICE,'Booking not found.',{ bookingId: body.bookingId });
    const event = { id:H.uid('wg_disp50'), bookingId:booking.id, driverId:booking.assignedDriverId, vehicleId:booking.assignedVehicleId, type:path === '/reassign' ? 'reassigned' : 'assigned', createdAt:H.iso() };
    H.pushStore('dispatchEvents', event, 4000);
    return H.json(H.responseEnvelope(SERVICE,{ booking, event, conflict: scoreConflicts(booking, H.getStore('dispatchAvailability'), H.getStore('bookings')) }));
  }
  if(path === '/conflict-check'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    const missing = H.requireFields(body,['bookingId']);
    if(missing.length) return H.badRequest(SERVICE,'Missing conflict-check fields.',{ missing });
    const booking = H.findById('bookings', body.bookingId);
    if(!booking) return H.badRequest(SERVICE,'Booking not found.',{ bookingId: body.bookingId });
    const result = scoreConflicts(booking, H.getStore('dispatchAvailability'), H.getStore('bookings'));
    return H.json(H.responseEnvelope(SERVICE,{ bookingId: booking.id, conflict: result }));
  }
  return H.notFound(SERVICE, method, path);
}
if(typeof module !== 'undefined') module.exports = { route, scoreConflicts, buildCommandCenter, buildUnifiedOperatorDeck, buildOperatorSuperdeck, buildOperatorSurfaceBundle, buildEntrypointSpreadReport, buildSurfaceSaturation, buildEntrypointSpreadV56 };
