
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
out.request = call(bookings, 'POST', '/request', { requestSource:'website', serviceProfileId:'svc_1', serviceType:'reserve', market:'Phoenix', pickupAddress:'A', dropoffAddress:'B', etaWindow:'2026-04-04T18:00:00Z' });
out.confirm = call(bookings, 'POST', '/confirm', { requestId: out.request.body.request.id, pricingSnapshot: out.quote.body.pricingSnapshot });
out.materialize = call(bookings, 'POST', '/materialize-route', { bookingId: out.confirm.body.booking.id, multiStopText:'Stop 1\nStop 2', returnLeg:true, standbyMinutesPlanned:15 });
out.membership = call(memberships, 'POST', '/memberships', { serviceProfileId:'svc_1', planType:'monthly included-hours-and-miles', includedHours:10, includedMiles:200 });
out.draw = call(memberships, 'POST', '/draw', { membershipId: out.membership.body.membership.id, bookingId: out.confirm.body.booking.id, hoursUsed:2, milesUsed:40 });
out.availability = call(dispatch, 'POST', '/availability', { driverId:'drv_1', market:'Phoenix', shiftStart:'08:00', shiftEnd:'20:00' });
out.assign = call(dispatch, 'POST', '/assign', { bookingId: out.confirm.body.booking.id, driverId:'drv_1', vehicleId:'veh_1', favoriteDriverState:'matched' });
out.conflict = call(dispatch, 'POST', '/conflict-check', { bookingId: out.confirm.body.booking.id });
out.charge = call(payments, 'POST', '/charge-summary', { bookingId: out.confirm.body.booking.id, waitRevenue:20, overageRevenue:12, tip:15 });
out.payout = call(payments, 'POST', '/payout-preview', { bookingId: out.confirm.body.booking.id, payModel:'hybrid', baseRate:25, bonus:10, guaranteedMinimum:40 });
out.incident = call(payments, 'POST', '/incident', { bookingId: out.confirm.body.booking.id, driverId:'drv_1', severity:'low', note:'Door assist noted.' });
out.importWebsite = call(sync, 'POST', '/import-website-booking', { serviceProfileId:'svc_2', serviceType:'airport', market:'Scottsdale', pickupAddress:'Airport', dropoffAddress:'Hotel', etaWindow:'2026-04-05T01:00:00Z' });
out.retry = call(sync, 'POST', '/retry', { queueId: out.importWebsite.body.queueRow.id });
console.log(JSON.stringify(out, null, 2));
