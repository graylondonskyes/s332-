const bookings = require('./skyesol-whiteglove-bookings');
const memberships = require('./skyesol-whiteglove-memberships');
const dispatch = require('./skyesol-whiteglove-dispatch');
const payments = require('./skyesol-whiteglove-payments');
const sync = require('./skyesol-whiteglove-sync');
function call(mod, method, path, body){
  const res = mod.route({ method, path, body: body ? JSON.stringify(body) : '' });
  return { statusCode: res.statusCode, body: JSON.parse(res.body) };
}
const out = {};
out.quote = call(bookings, 'POST', '/quote-preview', { serviceType:'reserve sedan', market:'Phoenix', bookedHours:2, requestedMiles:40, sameDay:true });
out.request = call(bookings, 'POST', '/request', { requestSource:'website', serviceProfileId:'svc_1', serviceType:'reserve', market:'Phoenix', pickupAddress:'A', dropoffAddress:'B', etaWindow:'2026-04-04T18:00:00Z', multiStopText:'Stop 1\nStop 2', returnLeg:true, standbyMinutesPlanned:15 });
out.confirm = call(bookings, 'POST', '/confirm', { requestId: out.request.body.request.id, pricingSnapshot: out.quote.body.pricingSnapshot });
out.materialize = call(bookings, 'POST', '/materialize-route', { bookingId: out.confirm.body.booking.id, multiStopText:'Stop 1\nStop 2', returnLeg:true, standbyMinutesPlanned:15 });
out.validateChain = call(bookings, 'POST', '/route-chain-validate', { bookingId: out.confirm.body.booking.id });
out.membership = call(memberships, 'POST', '/memberships', { serviceProfileId:'svc_1', planType:'monthly included-hours-and-miles', includedHours:10, includedMiles:200 });
out.draw = call(memberships, 'POST', '/draw', { membershipId: out.membership.body.membership.id, bookingId: out.confirm.body.booking.id, hoursUsed:2, milesUsed:40 });
out.memberSummary = call(payments, 'POST', '/member-usage-summary', { membershipId: out.membership.body.membership.id });
out.availability = call(dispatch, 'POST', '/availability', { driverId:'drv_1', market:'Phoenix', shiftStart:'08:00', shiftEnd:'20:00' });
out.assign = call(dispatch, 'POST', '/assign', { bookingId: out.confirm.body.booking.id, driverId:'drv_1', vehicleId:'veh_1', favoriteDriverState:'matched' });
out.command = call(dispatch, 'GET', '/command-center');
out.superdeck = call(dispatch, 'GET', '/operator-superdeck');
out.charge = call(payments, 'POST', '/charge-summary', { bookingId: out.confirm.body.booking.id, waitRevenue:20, overageRevenue:12, tip:15 });
out.payout = call(payments, 'POST', '/payout-preview', { bookingId: out.confirm.body.booking.id, payModel:'hybrid', baseRate:25, bonus:10, guaranteedMinimum:40 });
out.valuation = call(payments, 'GET', '/valuation-summary');
out.importWebsite = call(sync, 'POST', '/import-website-booking', { serviceProfileId:'svc_2', serviceType:'airport', market:'Scottsdale', pickupAddress:'Airport', dropoffAddress:'Hotel', etaWindow:'2026-04-05T01:00:00Z' });
out.chainMergeAudit = call(sync, 'POST', '/chain-merge-audit', { payload:{ bookings:[{ id: out.confirm.body.booking.id, updatedAt:'2025-01-01T00:00:00Z' }, { id: out.confirm.body.booking.id, updatedAt:'2025-01-01T00:00:00Z' }] } });
console.log(JSON.stringify(out, null, 2));
