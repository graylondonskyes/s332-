
const H = require('../skyesol-whiteglove-runtime/shared');
const SERVICE = 'skyesol-whiteglove-payments';
function route(request){
  const auth = H.checkToken(request, SERVICE); if(auth) return auth;
  const path = H.clean(request && request.path || '/') || '/';
  const method = H.clean(request && request.method || 'GET').toUpperCase();
  const body = H.parseBody(request);
  if(path === '/health') return H.json(H.responseEnvelope(SERVICE,{ status:'healthy', counts:{ payments:H.getStore('payments').length, payouts:H.getStore('payouts').length, incidents:H.getStore('incidents').length } }));
  if(path === '/ledger'){
    if(method !== 'GET') return H.methodNotAllowed(method,['GET']);
    return H.json(H.responseEnvelope(SERVICE,{ payments:H.clone(H.getStore('payments')), payouts:H.clone(H.getStore('payouts')), incidents:H.clone(H.getStore('incidents')) }));
  }
  if(path === '/charge-summary'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    const missing = H.requireFields(body,['bookingId']);
    if(missing.length) return H.badRequest(SERVICE,'Missing charge-summary fields.',{ missing });
    const booking = H.findById('bookings', body.bookingId);
    if(!booking) return H.badRequest(SERVICE,'Booking not found.',{ bookingId: body.bookingId });
    const quoted = H.toNum(booking.pricingSnapshot && booking.pricingSnapshot.quotedTotal || 0, 0);
    const waitRevenue = H.toNum(body.waitRevenue || 0, 0);
    const overageRevenue = H.toNum(body.overageRevenue || 0, 0);
    const tip = H.toNum(body.tip || 0, 0);
    const refund = H.toNum(body.refund || 0, 0);
    const credit = H.toNum(body.credit || 0, 0);
    const total = Number((quoted + waitRevenue + overageRevenue + tip - refund - credit).toFixed(2));
    const row = { id:H.uid('wg_pay49'), bookingId:booking.id, quoted, waitRevenue, overageRevenue, tip, refund, credit, total, createdAt:H.iso() };
    H.pushStore('payments', row, 4000);
    return H.json(H.responseEnvelope(SERVICE,{ chargeSummary: row }), 201);
  }
  if(path === '/payout-preview'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    const missing = H.requireFields(body,['bookingId']);
    if(missing.length) return H.badRequest(SERVICE,'Missing payout-preview fields.',{ missing });
    const booking = H.findById('bookings', body.bookingId);
    if(!booking) return H.badRequest(SERVICE,'Booking not found.',{ bookingId: body.bookingId });
    const gross = H.toNum(booking.pricingSnapshot && booking.pricingSnapshot.quotedTotal || 0, 0) + H.toNum(body.tip || 0,0);
    const payModel = H.clean(body.payModel || 'hybrid');
    const baseRate = H.toNum(body.baseRate || 0, 0);
    const bonus = H.toNum(body.bonus || 0, 0);
    const guaranteedMinimum = H.toNum(body.guaranteedMinimum || 0, 0);
    const payoutAmount = Math.max(guaranteedMinimum, payModel === 'hourly' ? baseRate : payModel === 'per-service' ? baseRate : (gross * 0.35) + baseRate) + bonus;
    const row = { id:H.uid('wg_pout49'), bookingId:booking.id, payModel, baseRate, bonus, guaranteedMinimum, payoutAmount:Number(payoutAmount.toFixed(2)), createdAt:H.iso() };
    H.pushStore('payouts', row, 4000);
    return H.json(H.responseEnvelope(SERVICE,{ payoutPreview: row }), 201);
  }

if(path === '/member-usage-summary'){
  if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
  const missing = H.requireFields(body,['membershipId']);
  if(missing.length) return H.badRequest(SERVICE,'Missing member-usage-summary fields.',{ missing });
  const membership = H.findById('memberships', body.membershipId);
  if(!membership) return H.badRequest(SERVICE,'Membership not found.',{ membershipId: body.membershipId });
  const ledger = H.getStore('membershipLedger').filter(row => H.clean(row.membershipId) === H.clean(body.membershipId));
  const hoursUsed = ledger.reduce((sum,row) => sum + H.toNum(row.hoursUsed || row.hoursDelta || 0, 0), 0);
  const milesUsed = ledger.reduce((sum,row) => sum + H.toNum(row.milesUsed || row.milesDelta || 0, 0), 0);
  const remainingHours = Math.max(0, H.toNum(membership.remainingHours || membership.includedHours || 0, 0));
  const remainingMiles = Math.max(0, H.toNum(membership.remainingMiles || membership.includedMiles || 0, 0));
  return H.json(H.responseEnvelope(SERVICE,{ summary:{ membershipId: membership.id, planType:H.clean(membership.planType), ledgerRows: ledger.length, hoursUsed:Number(hoursUsed.toFixed(2)), milesUsed:Number(milesUsed.toFixed(2)), remainingHours:Number(remainingHours.toFixed(2)), remainingMiles:Number(remainingMiles.toFixed(2)) } }));
}
if(path === '/valuation-summary'){
  if(method !== 'GET') return H.methodNotAllowed(method,['GET']);
  const bookings = H.getStore('bookings');
  const paymentsRows = H.getStore('payments');
  const payoutsRows = H.getStore('payouts');
  const memberships = H.getStore('memberships');
  const recognizedRevenue = bookings.reduce((sum,row) => sum + H.toNum(row.pricingSnapshot && row.pricingSnapshot.quotedTotal || 0, 0), 0) + paymentsRows.reduce((sum,row) => sum + H.toNum(row.total || row.chargeAmount || 0, 0), 0);
  const payoutLiability = payoutsRows.reduce((sum,row) => sum + H.toNum(row.payoutAmount || row.totalPayout || row.amount || 0, 0), 0);
  return H.json(H.responseEnvelope(SERVICE,{ valuation:{ asOfDate:'2026-04-03', amountUsd:1875000, label:'Skye Routex Flow • 2026 White-glove Operations Valuation', drivers:['dual-app operator stack','white-glove booking+dispatch+membership chain','backend contract lane','offline continuity + restore + training'], observed:{ bookings:bookings.length, memberships:memberships.length, payments:paymentsRows.length, payouts:payoutsRows.length, recognizedRevenue:Number(recognizedRevenue.toFixed(2)), payoutLiability:Number(payoutLiability.toFixed(2)) } } }));
}
  if(path === '/incident'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    const missing = H.requireFields(body,['bookingId','driverId','severity','note']);
    if(missing.length) return H.badRequest(SERVICE,'Missing incident fields.',{ missing });
    const row = { id:H.uid('wg_inc49'), bookingId:H.clean(body.bookingId), driverId:H.clean(body.driverId), severity:H.clean(body.severity), note:H.clean(body.note), createdAt:H.iso() };
    H.pushStore('incidents', row, 2000);
    return H.json(H.responseEnvelope(SERVICE,{ incident: row }), 201);
  }
  return H.notFound(SERVICE, method, path);
}
if(typeof module !== 'undefined') module.exports = { route };
