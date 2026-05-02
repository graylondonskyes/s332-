import { STORE_SYSTEM_SEED } from '../shared/data/system-seed.mjs';
import { defaultState, upsertInventoryItem, setInventoryPublished, buildStorefrontView, createBooking, createRoutePacket, buildAeRosterView } from '../shared/core/autonomous-store.mjs';

const state = defaultState(STORE_SYSTEM_SEED);

const created = upsertInventoryItem(state, {
  title: 'Sync Proof Item',
  category: 'Proof',
  description: 'Created by merchant-admin smoke and expected to appear in storefront.',
  price: 12.5,
  stock: 9,
  featured: true,
  deliveryEligible: true,
  pickupEligible: true,
  tags: ['proof', 'sync']
});
setInventoryPublished(state, created.id, true);

const storefront = buildStorefrontView(state);
const syncedItem = storefront.publishedInventory.find((row) => row.id === created.id);
const booking = createBooking(state, {
  customerName: 'Smoke Customer',
  customerPhone: '623-111-1111',
  address: '123 Proof Lane',
  requestedWindow: 'Friday Evening',
  itemId: created.id,
  notes: 'Smoke path booking'
});
const routePacket = createRoutePacket(state, booking.id, { driverName: 'Smoke Driver', dispatchWindow: 'Friday Evening' });
const aeView = buildAeRosterView(state);

const checks = [
  { name: 'merchant-admin inventory creation succeeds', pass: Boolean(created?.id) },
  { name: 'publish flag moves item into storefront renderer', pass: Boolean(syncedItem) },
  { name: 'storefront booking writes booking record', pass: Boolean(booking?.id && state.bookings.length >= 1) },
  { name: 'route packet generation succeeds', pass: Boolean(routePacket?.id && state.routePackets.length >= 1) },
  { name: 'ae roster view reflects booking and route counts', pass: aeView.merchantRows[0]?.bookingCount >= 1 && aeView.merchantRows[0]?.routePacketCount >= 1 }
];

const status = checks.every((check) => check.pass);
console.log(JSON.stringify({ status, checks, metrics: storefront.metrics }, null, 2));
if (!status) process.exit(1);
