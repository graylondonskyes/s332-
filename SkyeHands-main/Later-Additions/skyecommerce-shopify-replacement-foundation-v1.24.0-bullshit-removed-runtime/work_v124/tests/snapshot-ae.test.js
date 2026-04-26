import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStorefrontSnapshot } from '../src/lib/snapshot.js';
import { buildRoutePacket } from '../src/lib/ae.js';

test('buildStorefrontSnapshot returns storefront payload', () => {
  const snapshot = buildStorefrontSnapshot(
    { id: 'm1', slug: 'delta', brandName: 'Delta Store', email: 'owner@delta.test', currency: 'USD' },
    [{ id: 'p1', title: 'One', slug: 'one', priceCents: 5000, inventoryOnHand: 3, trackInventory: 1, status: 'active' }],
    [],
    []
  );
  assert.equal(snapshot.merchant.slug, 'delta');
  assert.equal(snapshot.productCount, 1);
  assert.equal(snapshot.products[0].available, true);
});

test('buildRoutePacket sorts bookings into stop order', () => {
  const packet = buildRoutePacket({
    agent: { id: 'a1', displayName: 'Agent 1', territory: 'Phoenix' },
    merchants: [{ id: 'm1', brandName: 'Alpha' }, { id: 'm2', brandName: 'Beta' }],
    bookings: [
      { id: 'b2', merchantId: 'm2', bookingDate: '2026-04-20T11:00', location: 'B' },
      { id: 'b1', merchantId: 'm1', bookingDate: '2026-04-20T09:00', location: 'A' }
    ],
    routeDate: '2026-04-20'
  });
  assert.equal(packet.stopCount, 2);
  assert.equal(packet.stops[0].merchantName, 'Alpha');
  assert.equal(packet.stops[1].merchantName, 'Beta');
});
