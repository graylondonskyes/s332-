import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMerchantAnalytics } from '../src/lib/analytics.js';

test('buildMerchantAnalytics computes revenue, counts, and top products', () => {
  const analytics = buildMerchantAnalytics({
    orders: [
      { status: 'received', paymentStatus: 'pending_manual', totalCents: 2500, items: [{ productId: 'p1', title: 'Alpha', quantity: 1, unitPriceCents: 2500 }] },
      { status: 'fulfilled', paymentStatus: 'paid', totalCents: 4500, items: [{ productId: 'p1', title: 'Alpha', quantity: 1, unitPriceCents: 2500 }, { productId: 'p2', title: 'Beta', quantity: 1, unitPriceCents: 2000 }] },
      { status: 'cancelled', paymentStatus: 'voided', totalCents: 7000, items: [{ productId: 'p3', title: 'Gamma', quantity: 1, unitPriceCents: 7000 }] }
    ],
    products: [
      { id: 'p1', title: 'Alpha', trackInventory: true, inventoryOnHand: 4, status: 'active', sku: 'A1' },
      { id: 'p2', title: 'Beta', trackInventory: true, inventoryOnHand: 18, status: 'active', sku: 'B1' }
    ],
    returns: [{ status: 'requested', requestedCents: 1000, approvedCents: 0 }],
    importJobs: [{ status: 'complete' }, { status: 'running' }],
    customers: [{ id: 'c1' }, { id: 'c2' }],
    locations: [{ id: 'l1', active: true }],
    inventoryLevels: [{ available: 22 }]
  });
  assert.equal(analytics.counts.orders, 3);
  assert.equal(analytics.counts.openOrders, 1);
  assert.equal(analytics.counts.openReturns, 1);
  assert.equal(analytics.revenue.bookedCents, 7000);
  assert.equal(analytics.revenue.collectedCents, 4500);
  assert.equal(analytics.inventory.availableUnits, 22);
  assert.equal(analytics.lowStockProducts[0].title, 'Alpha');
  assert.equal(analytics.topProducts[0].productId, 'p1');
});
