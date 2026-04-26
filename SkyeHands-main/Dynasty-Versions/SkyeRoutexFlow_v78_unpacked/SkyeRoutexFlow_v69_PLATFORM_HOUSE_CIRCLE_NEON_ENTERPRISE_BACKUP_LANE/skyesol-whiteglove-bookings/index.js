const H = require('../skyesol-whiteglove-runtime/shared');
const SERVICE = 'skyesol-whiteglove-bookings';
const SERVICE_TYPES = ['now','reserve','airport','errand','hourly_standby','recurring'];
const PROFILE_TYPES = ['individual','household','business','vip','medical','executive'];

function quotePreview(input){
  const hours = Math.max(1, H.toNum(input.bookedHours || 1, 1));
  const miles = Math.max(0, H.toNum(input.requestedMiles || 0, 0));
  const base = /suv/i.test(H.clean(input.serviceType)) ? 95 : input.serviceType === 'airport' ? 85 : input.serviceType === 'hourly_standby' ? 110 : 72;
  const zone = /scottsdale/i.test(H.clean(input.market)) ? 1.12 : /mesa/i.test(H.clean(input.market)) ? 1.06 : /glendale/i.test(H.clean(input.market)) ? 1.08 : 1;
  const rush = input.sameDay ? 18 : 0;
  const includedMiles = hours * 15;
  const extraMiles = Math.max(0, miles - includedMiles);
  const overage = extraMiles * 2.85;
  const subtotal = (base * hours * zone) + rush + overage;
  return {
    pricingVersion: 'WG-V50', serviceType: H.clean(input.serviceType), market: H.clean(input.market),
    bookedHours: hours, requestedMiles: miles, includedMiles, extraMiles, rushFee: rush,
    overageRevenue: Number(overage.toFixed(2)), quotedTotal: Number(subtotal.toFixed(2))
  };
}

function parseStops(text){
  return H.clean(text)
    .split(/\n+|\s*->\s*|\s*>\s*|\s*\|\s*/)
    .map(H.clean)
    .filter(Boolean);
}

function buildLeg(label, from, to, kind, order, extra){
  return Object.assign({ id: H.uid('wg_leg50'), label, from, to, kind, order }, extra || {});
}

function buildMaterializedRoute(bookingLike){
  const booking = Object.assign({}, bookingLike || {});
  const stops = parseStops(booking.multiStopText || '');
  const legs = [];
  let order = 1;
  let current = H.clean(booking.pickupAddress || 'Pickup');
  stops.forEach((stop, idx) => {
    legs.push(buildLeg('Service stop ' + (idx + 1), current, stop, 'service_stop', order++, { direction: 'outbound', dwellMinutes: 10 }));
    current = stop;
  });
  const finalDrop = H.clean(booking.dropoffAddress || 'Dropoff');
  legs.push(buildLeg('Primary dropoff', current, finalDrop, 'dropoff', order++, { direction: 'outbound', dwellMinutes: 5 }));
  const standby = Math.max(0, H.toNum(booking.standbyMinutesPlanned || 0, 0));
  if(standby > 0 || H.clean(booking.serviceType) === 'hourly_standby'){
    legs.push(buildLeg('Standby hold', finalDrop, finalDrop, 'standby_hold', order++, { direction: 'service', standbyMinutes: standby, dwellMinutes: standby }));
  }
  if(booking.returnLeg){
    const reverseStops = stops.slice().reverse();
    let back = finalDrop;
    reverseStops.forEach((stop, idx) => {
      legs.push(buildLeg('Return stop ' + (idx + 1), back, stop, 'return_stop', order++, { direction: 'return', dwellMinutes: 10 }));
      back = stop;
    });
    legs.push(buildLeg('Return to pickup', back, H.clean(booking.pickupAddress || 'Pickup'), 'return_complete', order++, { direction: 'return', dwellMinutes: 5 }));
  }
  return {
    routeFingerprint: [booking.pickupAddress, booking.dropoffAddress, stops.join('|'), booking.returnLeg ? 'return' : 'oneway', String(standby)].join('::'),
    routeStopSequence: [H.clean(booking.pickupAddress || '')].concat(stops).concat([H.clean(booking.dropoffAddress || '')]).filter(Boolean),
    routeStopSequenceDetailed: legs.map(leg => ({ label: leg.label, from: leg.from, to: leg.to, kind: leg.kind, direction: leg.direction || '', dwellMinutes: H.toNum(leg.dwellMinutes || 0, 0) })),
    routeLegCount: legs.length,
    routeStopCount: stops.length,
    routeReturnLegBuilt: !!booking.returnLeg,
    standbyMinutesPlanned: standby,
    legs
  };
}


function routeChainValidate(bookingId){
  const booking = H.findById('bookings', bookingId);
  if(!booking) return { ok:false, error:'booking_not_found', bookingId };
  const profile = H.findById('serviceProfiles', booking.serviceProfileId);
  const membership = booking.membershipId ? H.findById('memberships', booking.membershipId) : null;
  const checks = [];
  const blockers = [];
  function add(label, ok, note){ checks.push({ label, ok, note }); if(!ok) blockers.push(label + ': ' + note); }
  add('service_profile_link', !!profile, profile ? 'profile linked' : 'service profile missing from runtime store');
  add('membership_link', booking.membershipId ? !!membership : true, booking.membershipId ? (membership ? 'membership linked' : 'membership missing from runtime store') : 'retail booking');
  add('driver_assignment', !!H.clean(booking.assignedDriverId), H.clean(booking.assignedDriverId) ? 'driver assigned' : 'driver missing');
  add('vehicle_assignment', !!H.clean(booking.assignedVehicleId), H.clean(booking.assignedVehicleId) ? 'vehicle assigned' : 'vehicle missing');
  add('route_materialized', !!booking.routeMaterialized && Array.isArray(booking.routeStopSequenceDetailed) && booking.routeStopSequenceDetailed.length > 0, booking.routeMaterialized ? 'route chain materialized' : 'route chain not materialized');
  add('route_fingerprint', !!H.clean(booking.routeFingerprint), H.clean(booking.routeFingerprint) ? 'route fingerprint saved' : 'route fingerprint missing');
  add('return_leg_state', booking.returnLeg ? !!booking.routeReturnLegBuilt : true, booking.returnLeg ? (booking.routeReturnLegBuilt ? 'return leg built' : 'return leg requested but not built') : 'one-way booking');
  add('multi_stop_state', H.clean(booking.multiStopText) ? H.toNum(booking.routeStopCount || 0, 0) > 0 : true, H.clean(booking.multiStopText) ? ('route stop count ' + H.toNum(booking.routeStopCount || 0, 0)) : 'single-stop booking');
  const score = checks.length ? Math.round((checks.filter(row => row.ok).length / checks.length) * 100) : 0;
  return { ok: blockers.length === 0, bookingId: booking.id, score, blockers, checks, routeLegCount: H.toNum(booking.routeLegCount || 0, 0), routeStopCount: H.toNum(booking.routeStopCount || 0, 0), dispatchStatus: H.clean(booking.dispatchStatus || booking.status || '') };
}


function duplicatePreview(input){
  const booking = H.findById('bookings', input.bookingId);
  if(!booking) return { ok:false, error:'booking_not_found', bookingId: input.bookingId };
  const mode = H.clean(input.mode || 'next_day_repeat') || 'next_day_repeat';
  const previews = [];
  const baseClone = ()=> Object.assign({}, booking, { id:H.uid('wg_dup51'), duplicateOfBookingId: booking.id, dispatchStatus:'requested', status:'requested', routeMaterialized:false, routeLink:'', routeStopLink:'', createdAt:H.iso(), updatedAt:H.iso(), timeline:[{ status:'duplicated', at:H.iso(), note:mode }] });
  if(mode === 'split_multi_stop'){
    const route = buildMaterializedRoute(booking);
    const chain = [H.clean(booking.pickupAddress || '')].concat(route.routeStopSequence.slice(1,-1)).concat([H.clean(booking.dropoffAddress || '')]).filter(Boolean);
    for(let i=0;i<chain.length-1;i++){
      const clone = baseClone();
      clone.pickupAddress = chain[i]; clone.dropoffAddress = chain[i+1]; clone.multiStopText = ''; clone.returnLeg = false; clone.splitIndex = i + 1;
      Object.assign(clone, H.pick(buildMaterializedRoute(clone), ['routeFingerprint','routeStopSequence','routeStopSequenceDetailed','routeLegCount','routeStopCount','routeReturnLegBuilt','standbyMinutesPlanned']));
      previews.push(clone);
    }
  } else {
    const clone = baseClone();
    if(mode === 'return_leg_rebuild') clone.returnLeg = true;
    if(mode === 'next_day_repeat') clone.etaWindow = H.clean(clone.etaWindow || '') ? clone.etaWindow + ' +1D' : '';
    Object.assign(clone, H.pick(buildMaterializedRoute(clone), ['routeFingerprint','routeStopSequence','routeStopSequenceDetailed','routeLegCount','routeStopCount','routeReturnLegBuilt','standbyMinutesPlanned']));
    previews.push(clone);
  }
  return { ok:true, bookingId: booking.id, mode, cloneCount: previews.length, previews };
}
function applyDuplicate(input){
  const preview = duplicatePreview(input);
  if(!preview.ok) return preview;
  const routePlans = H.getStore('dispatchEvents');
  preview.previews.forEach(clone => {
    H.pushStore('bookings', clone, 6000);
    H.pushStore('dispatchEvents', { id:H.uid('wg_dispdup51'), bookingId:clone.id, type:'duplicated_' + preview.mode, createdAt:H.iso(), duplicateOfBookingId: preview.bookingId }, 6000);
  });
  return { ok:true, bookingId: preview.bookingId, mode: preview.mode, cloneIds: preview.previews.map(row => row.id), cloneCount: preview.cloneCount };
}



function buildMaterializationEdgeReport(input){
  const booking = typeof input === 'string' ? H.findById('bookings', input) : H.findById('bookings', input && input.bookingId);
  if(!booking) return { ok:false, error:'booking_not_found', bookingId: typeof input === 'string' ? input : (input && input.bookingId) };
  const detailed = Array.isArray(booking.routeStopSequenceDetailed) ? booking.routeStopSequenceDetailed : [];
  const blockers = [];
  const notes = [];
  const multiStopCount = H.clean(booking.multiStopText || '').split(/\n+|\s*->\s*|\s*>\s*|\s*\|\s*/).filter(Boolean).length;
  const standby = H.toNum(booking.standbyMinutesPlanned || 0, 0);
  if(H.clean(booking.multiStopText) && H.toNum(booking.routeStopCount || 0, 0) === 0) blockers.push('multi_stop_without_count');
  if(booking.returnLeg && !booking.routeReturnLegBuilt) blockers.push('return_leg_not_built');
  if(standby > 0 && !detailed.some(row => /standby/i.test(H.clean(row.kind || row.label)))) blockers.push('standby_hold_missing');
  if(H.clean(booking.pickupAddress) && H.clean(booking.pickupAddress) === H.clean(booking.dropoffAddress) && !booking.returnLeg && multiStopCount === 0) notes.push('pickup_equals_dropoff');
  if(booking.airportMeetGreet && !H.clean(booking.flightCode || booking.flightNumber || '')) notes.push('airport_without_flight_code');
  if(H.toNum(booking.routeLegCount || 0, 0) < Math.max(1, multiStopCount + 1)) notes.push('route_leg_count_light');
  const score = Math.max(0, 100 - (blockers.length * 18) - (notes.length * 6));
  return { ok:blockers.length === 0, bookingId: booking.id, score, blockers, notes, snapshot:{ routeLegCount:H.toNum(booking.routeLegCount || 0,0), routeStopCount:H.toNum(booking.routeStopCount || 0,0), multiStopCount, standbyMinutesPlanned:standby, returnLeg:!!booking.returnLeg, airportMeetGreet:!!booking.airportMeetGreet } };
}


function buildClientPacket(input){
  const booking = H.findById('bookings', input.bookingId);
  if(!booking) return { ok:false, error:'booking_not_found', bookingId: input.bookingId };
  const profile = H.findById('serviceProfiles', booking.serviceProfileId) || null;
  const membership = booking.membershipId ? (H.findById('memberships', booking.membershipId) || null) : null;
  const docs = H.getStore('incidents').filter(row => H.clean(row.bookingId) === H.clean(booking.id));
  return { ok:true, packet:{ id:H.uid('wg_client_packet57'), createdAt:H.iso(), booking, profile, membership, incidentCount:docs.length, transparency:{ requestSource:booking.requestSource || '', dispatchStatus:booking.dispatchStatus || booking.status || '', favoriteDriverState:booking.favoriteDriverState || '', routeMaterialized:!!booking.routeMaterialized, routeLegCount:H.toNum(booking.routeLegCount || 0, 0), quotedTotal:H.toNum(booking.pricingSnapshot && booking.pricingSnapshot.quotedTotal || 0, 0) } } };
}

function listRoutes(){
  return {
    routes:[
      { method:'GET', path:'/health' },{ method:'GET', path:'/schema' },{ method:'GET', path:'/requests' },
      { method:'GET', path:'/bookings' },{ method:'POST', path:'/request' },{ method:'POST', path:'/quote-preview' },
      { method:'POST', path:'/confirm' },{ method:'POST', path:'/update-status' },{ method:'POST', path:'/materialize-route' },
      { method:'POST', path:'/materialization-preview' },{ method:'POST', path:'/materialization-edge-report' },{ method:'POST', path:'/booking-chain' },{ method:'POST', path:'/client-packet' },{ method:'POST', path:'/duplicate-preview' },{ method:'POST', path:'/duplicate-booking' }
    ]
  };
}

function route(request){
  const auth = H.checkToken(request, SERVICE); if(auth) return auth;
  const path = H.clean(request && request.path || '/') || '/';
  const method = H.clean(request && request.method || 'GET').toUpperCase();
  const body = H.parseBody(request);
  if(path === '/health') return H.json(H.responseEnvelope(SERVICE,{ status:'healthy', counts:{ requests:H.getStore('bookingRequests').length, bookings:H.getStore('bookings').length } }));
  if(path === '/schema') return H.json(H.responseEnvelope(SERVICE,{ enums:{ serviceTypes:SERVICE_TYPES, profileTypes:PROFILE_TYPES }, ...listRoutes() }));
  if(path === '/requests'){
    if(method !== 'GET') return H.methodNotAllowed(method,['GET']);
    return H.json(H.responseEnvelope(SERVICE,{ rows:H.clone(H.getStore('bookingRequests')) }));
  }
  if(path === '/bookings'){
    if(method !== 'GET') return H.methodNotAllowed(method,['GET']);
    return H.json(H.responseEnvelope(SERVICE,{ rows:H.clone(H.getStore('bookings')) }));
  }
  if(path === '/quote-preview'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    const missing = H.requireFields(body,['serviceType','market']);
    if(missing.length) return H.badRequest(SERVICE,'Missing required quote fields.',{ missing });
    return H.json(H.responseEnvelope(SERVICE,{ pricingSnapshot: quotePreview(body) }));
  }
  if(path === '/request'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    const missing = H.requireFields(body,['serviceProfileId','serviceType','market','pickupAddress','dropoffAddress']);
    if(missing.length) return H.badRequest(SERVICE,'Missing required booking request fields.',{ missing });
    const row = {
      id:H.uid('wg_req50'), requestSource:H.clean(body.requestSource || 'website'), serviceProfileId:H.clean(body.serviceProfileId),
      serviceType:H.clean(body.serviceType), market:H.clean(body.market), pickupAddress:H.clean(body.pickupAddress),
      dropoffAddress:H.clean(body.dropoffAddress), etaWindow:H.clean(body.etaWindow || ''),
      notes:H.clean(body.notes || ''), createdAt:H.iso(), status:'requested', multiStopText:H.clean(body.multiStopText || ''),
      returnLeg: !!body.returnLeg, standbyMinutesPlanned: H.toNum(body.standbyMinutesPlanned || 0, 0)
    };
    H.pushStore('bookingRequests', row, 2000);
    return H.json(H.responseEnvelope(SERVICE,{ request: row }), 201);
  }
  if(path === '/confirm'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    const requestRow = body.requestId ? H.findById('bookingRequests', body.requestId) : null;
    const input = Object.assign({}, requestRow || {}, body.booking || body);
    const missing = H.requireFields(input,['serviceProfileId','serviceType','market','pickupAddress','dropoffAddress']);
    if(missing.length) return H.badRequest(SERVICE,'Missing required booking confirm fields.',{ missing });
    const pricingSnapshot = body.pricingSnapshot || quotePreview(input);
    const materialized = buildMaterializedRoute(input);
    const booking = {
      id:H.uid('wg_book50'), requestId: requestRow ? requestRow.id : '', requestSource:H.clean(input.requestSource || input.source || (requestRow && requestRow.requestSource) || 'operator'),
      serviceProfileId:H.clean(input.serviceProfileId), serviceType:H.clean(input.serviceType), market:H.clean(input.market),
      pickupAddress:H.clean(input.pickupAddress), dropoffAddress:H.clean(input.dropoffAddress), etaWindow:H.clean(input.etaWindow || ''),
      favoriteDriverState:H.clean(input.favoriteDriverState || 'preferred'), membershipId:H.clean(input.membershipId || ''),
      status:'confirmed', dispatchStatus:'confirmed', pricingSnapshot, timeline:[{ status:'confirmed', at:H.iso(), note:'Booking confirmed via backend contract.' }],
      createdAt:H.iso(), updatedAt:H.iso(), multiStopText:H.clean(input.multiStopText || ''), returnLeg:!!input.returnLeg,
      standbyMinutesPlanned:H.toNum(input.standbyMinutesPlanned || 0, 0), routeMaterialized:false,
      assignedDriverId:H.clean(input.assignedDriverId || ''), assignedVehicleId:H.clean(input.assignedVehicleId || ''),
      airportMeetGreet: !!input.airportMeetGreet, flightCode: H.clean(input.flightCode || ''), signageName: H.clean(input.signageName || '')
    };
    Object.assign(booking, H.pick(materialized, ['routeFingerprint','routeStopSequence','routeStopSequenceDetailed','routeLegCount','routeStopCount','routeReturnLegBuilt']));
    H.pushStore('bookings', booking, 3000);
    if(requestRow){ H.updateById('bookingRequests', requestRow.id, row => { row.status = 'confirmed'; row.bookingId = booking.id; row.updatedAt = H.iso(); return row; }); }
    return H.json(H.responseEnvelope(SERVICE,{ booking }), 201);
  }
  if(path === '/update-status'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    const missing = H.requireFields(body,['bookingId','status']);
    if(missing.length) return H.badRequest(SERVICE,'Missing status update fields.',{ missing });
    const booking = H.updateById('bookings', body.bookingId, row => {
      row.status = H.clean(body.status); row.dispatchStatus = H.clean(body.status); row.updatedAt = H.iso();
      row.timeline = Array.isArray(row.timeline) ? row.timeline : []; row.timeline.push({ status:H.clean(body.status), at:H.iso(), note:H.clean(body.note || '') });
      return row;
    });
    if(!booking) return H.badRequest(SERVICE,'Booking not found.',{ bookingId: body.bookingId });
    return H.json(H.responseEnvelope(SERVICE,{ booking }));
  }
  if(path === '/materialization-edge-report'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    const missing = H.requireFields(body,['bookingId']);
    if(missing.length) return H.badRequest(SERVICE,'Missing materialization edge-report fields.',{ missing });
    const report = buildMaterializationEdgeReport(body);
    if(!report.ok && report.error === 'booking_not_found') return H.badRequest(SERVICE,'Booking not found.',{ bookingId: body.bookingId });
    return H.json(H.responseEnvelope(SERVICE,{ report }));
  }

  
  if(path === '/client-packet'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    const missing = H.requireFields(body,['bookingId']);
    if(missing.length) return H.badRequest(SERVICE,'Missing client-packet fields.',{ missing });
    const packet = buildClientPacket(body);
    if(!packet.ok) return H.badRequest(SERVICE,'Booking not found.',{ bookingId: body.bookingId });
    return H.json(H.responseEnvelope(SERVICE, packet));
  }

if(path === '/materialization-preview'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    const missing = H.requireFields(body,['pickupAddress','dropoffAddress']);
    if(missing.length) return H.badRequest(SERVICE,'Missing materialization preview fields.',{ missing });
    return H.json(H.responseEnvelope(SERVICE,{ preview: buildMaterializedRoute(body) }));
  }

if(path === '/duplicate-preview'){
  if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
  const missing = H.requireFields(body,['bookingId']);
  if(missing.length) return H.badRequest(SERVICE,'Missing duplicate-preview fields.',{ missing });
  return H.json(H.responseEnvelope(SERVICE, duplicatePreview(body)));
}
if(path === '/duplicate-booking'){
  if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
  const missing = H.requireFields(body,['bookingId']);
  if(missing.length) return H.badRequest(SERVICE,'Missing duplicate-booking fields.',{ missing });
  const result = applyDuplicate(body);
  if(!result.ok) return H.badRequest(SERVICE,'Booking not found.',{ bookingId: body.bookingId });
  return H.json(H.responseEnvelope(SERVICE, result), 201);
}

  if(path === '/materialize-route'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    const missing = H.requireFields(body,['bookingId']);
    if(missing.length) return H.badRequest(SERVICE,'Missing route materialization fields.',{ missing });
    const booking = H.updateById('bookings', body.bookingId, row => {
      row.multiStopText = H.clean(body.multiStopText || row.multiStopText || '');
      row.returnLeg = body.returnLeg != null ? !!body.returnLeg : !!row.returnLeg;
      row.standbyMinutesPlanned = H.toNum(body.standbyMinutesPlanned != null ? body.standbyMinutesPlanned : row.standbyMinutesPlanned || 0, 0);
      row.airportMeetGreet = body.airportMeetGreet != null ? !!body.airportMeetGreet : !!row.airportMeetGreet;
      row.routeMaterialized = true; row.routeMaterializedAt = H.iso();
      const materialized = buildMaterializedRoute(row);
      Object.assign(row, H.pick(materialized, ['routeFingerprint','routeStopSequence','routeStopSequenceDetailed','routeLegCount','routeStopCount','routeReturnLegBuilt','standbyMinutesPlanned']));
      row.timeline = Array.isArray(row.timeline) ? row.timeline : [];
      row.timeline.push({ status:'route_materialized', at:H.iso(), note:'Backend route materialization saved.', routeLegCount: row.routeLegCount, routeStopCount: row.routeStopCount });
      return row;
    });
    if(!booking) return H.badRequest(SERVICE,'Booking not found.',{ bookingId: body.bookingId });
    return H.json(H.responseEnvelope(SERVICE,{ booking }));
  }
  if(path === '/booking-chain'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    const missing = H.requireFields(body,['bookingId']);
    if(missing.length) return H.badRequest(SERVICE,'Missing booking-chain fields.',{ missing });
    const booking = H.findById('bookings', body.bookingId);
    if(!booking) return H.badRequest(SERVICE,'Booking not found.',{ bookingId: body.bookingId });
    return H.json(H.responseEnvelope(SERVICE,{ booking, request: booking.requestId ? H.findById('bookingRequests', booking.requestId) : null, payments: H.getStore('payments').filter(row => H.clean(row.bookingId) === H.clean(booking.id)), payouts: H.getStore('payouts').filter(row => H.clean(row.bookingId) === H.clean(booking.id)), incidents: H.getStore('incidents').filter(row => H.clean(row.bookingId) === H.clean(booking.id)), membershipLedger: booking.membershipId ? H.getStore('membershipLedger').filter(row => H.clean(row.membershipId) === H.clean(booking.membershipId)) : [] }));
  }

  if(path === '/route-chain-validate'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    const missing = H.requireFields(body,['bookingId']);
    if(missing.length) return H.badRequest(SERVICE,'Missing route-chain-validate fields.',{ missing });
    return H.json(H.responseEnvelope(SERVICE,{ validation: routeChainValidate(body.bookingId) }));
  }
  return H.notFound(SERVICE, method, path);
}
if(typeof module !== 'undefined') module.exports = { route, quotePreview, buildMaterializedRoute, parseStops, routeChainValidate };
