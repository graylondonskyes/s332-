
const H = require('../skyesol-whiteglove-runtime/shared');
const SERVICE = 'skyesol-whiteglove-payments';

// CODE-01: moved from hardcoded literals to env vars with documented fallbacks.
const VALUATION_USD = parseInt(process.env.SKYEROUTEX_VALUATION_USD || '1875000', 10);
const VALUATION_DATE = process.env.SKYEROUTEX_VALUATION_DATE || '2026-04-03';
const PAYOUT_RATE = parseFloat(process.env.SKYEROUTEX_PAYOUT_RATE || '0.35');

// CODE-02: currency arithmetic in integer cents to avoid IEEE 754 rounding errors.
function toCents(dollars){ return Math.round(Number(dollars || 0) * 100); }
function fromCents(cents){ return Number((cents / 100).toFixed(2)); }
function addCents(...args){ return args.reduce((sum, v) => sum + toCents(v), 0); }
function subCents(base, ...args){ return args.reduce((sum, v) => sum - toCents(v), toCents(base)); }

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
    const quoted = toCents(booking.pricingSnapshot && booking.pricingSnapshot.quotedTotal || 0);
    const waitRevenue = toCents(body.waitRevenue || 0);
    const overageRevenue = toCents(body.overageRevenue || 0);
    const tip = toCents(body.tip || 0);
    const refund = toCents(body.refund || 0);
    const credit = toCents(body.credit || 0);
    const totalCents = quoted + waitRevenue + overageRevenue + tip - refund - credit;
    const row = { id:H.uid('wg_pay49'), bookingId:booking.id, quoted:fromCents(quoted), waitRevenue:fromCents(waitRevenue), overageRevenue:fromCents(overageRevenue), tip:fromCents(tip), refund:fromCents(refund), credit:fromCents(credit), total:fromCents(totalCents), createdAt:H.iso() };
    H.pushStore('payments', row, 4000);
    return H.json(H.responseEnvelope(SERVICE,{ chargeSummary: row }), 201);
  }
  if(path === '/payout-preview'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    const missing = H.requireFields(body,['bookingId']);
    if(missing.length) return H.badRequest(SERVICE,'Missing payout-preview fields.',{ missing });
    const booking = H.findById('bookings', body.bookingId);
    if(!booking) return H.badRequest(SERVICE,'Booking not found.',{ bookingId: body.bookingId });
    const grossCents = toCents(booking.pricingSnapshot && booking.pricingSnapshot.quotedTotal || 0) + toCents(body.tip || 0);
    const payModel = H.clean(body.payModel || 'hybrid');
    const baseRateCents = toCents(body.baseRate || 0);
    const bonusCents = toCents(body.bonus || 0);
    const guaranteedMinCents = toCents(body.guaranteedMinimum || 0);
    const commissionCents = Math.round(grossCents * PAYOUT_RATE);
    const modelCents = payModel === 'hourly' ? baseRateCents : payModel === 'per-service' ? baseRateCents : commissionCents + baseRateCents;
    const payoutCents = Math.max(guaranteedMinCents, modelCents) + bonusCents;
    const row = { id:H.uid('wg_pout49'), bookingId:booking.id, payModel, baseRate:fromCents(baseRateCents), bonus:fromCents(bonusCents), guaranteedMinimum:fromCents(guaranteedMinCents), payoutAmount:fromCents(payoutCents), createdAt:H.iso() };
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
    const hoursUsedCents = ledger.reduce((sum,row) => sum + toCents(row.hoursUsed || row.hoursDelta || 0), 0);
    const milesUsedCents = ledger.reduce((sum,row) => sum + toCents(row.milesUsed || row.milesDelta || 0), 0);
    const remainingHours = Math.max(0, toCents(membership.remainingHours || membership.includedHours || 0));
    const remainingMiles = Math.max(0, toCents(membership.remainingMiles || membership.includedMiles || 0));
    return H.json(H.responseEnvelope(SERVICE,{ summary:{ membershipId: membership.id, planType:H.clean(membership.planType), ledgerRows: ledger.length, hoursUsed:fromCents(hoursUsedCents), milesUsed:fromCents(milesUsedCents), remainingHours:fromCents(remainingHours), remainingMiles:fromCents(remainingMiles) } }));
  }

  if(path === '/valuation-summary'){
    if(method !== 'GET') return H.methodNotAllowed(method,['GET']);
    const bookings = H.getStore('bookings');
    const paymentsRows = H.getStore('payments');
    const payoutsRows = H.getStore('payouts');
    const memberships = H.getStore('memberships');
    const recognizedRevenueCents = bookings.reduce((sum,row) => sum + toCents(row.pricingSnapshot && row.pricingSnapshot.quotedTotal || 0), 0)
      + paymentsRows.reduce((sum,row) => sum + toCents(row.total || row.chargeAmount || 0), 0);
    const payoutLiabilityCents = payoutsRows.reduce((sum,row) => sum + toCents(row.payoutAmount || row.totalPayout || row.amount || 0), 0);
    return H.json(H.responseEnvelope(SERVICE,{ valuation:{ asOfDate: VALUATION_DATE, amountUsd: VALUATION_USD, label:'Skye Routex Flow • 2026 White-glove Operations Valuation', drivers:['dual-app operator stack','white-glove booking+dispatch+membership chain','backend contract lane','offline continuity + restore + training'], observed:{ bookings:bookings.length, memberships:memberships.length, payments:paymentsRows.length, payouts:payoutsRows.length, recognizedRevenue:fromCents(recognizedRevenueCents), payoutLiability:fromCents(payoutLiabilityCents) } } }));
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
