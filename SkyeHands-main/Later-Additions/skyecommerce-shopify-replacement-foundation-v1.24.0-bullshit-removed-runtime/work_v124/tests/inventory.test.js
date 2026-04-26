import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateInventoryDemand, normalizeInventoryAdjustmentInput, normalizeInventoryLocationInput, summarizeInventory } from '../src/lib/inventory.js';

test('allocateInventoryDemand splits across prioritized locations', () => {
  const result = allocateInventoryDemand([
    { locationId: 'l2', available: 2, priority: 1, isDefault: false, active: true },
    { locationId: 'l1', available: 5, priority: 0, isDefault: true, active: true },
    { locationId: 'l3', available: 9, priority: 5, isDefault: false, active: true }
  ], 6);
  assert.equal(result.ok, true);
  assert.deepEqual(result.allocations.map((item) => [item.locationId, item.quantity]), [['l1', 5], ['l2', 1]]);
});

test('normalizeInventoryLocationInput sanitizes code and flags', () => {
  const input = normalizeInventoryLocationInput({ name: 'Phoenix Back Room', code: 'Phoenix Back Room', priority: '3', active: 'false', isDefault: '1' });
  assert.equal(input.code, 'PHOENIX_BACK_ROOM');
  assert.equal(input.priority, 3);
  assert.equal(input.active, false);
  assert.equal(input.isDefault, true);
});

test('normalizeInventoryAdjustmentInput constrains payload and summarizeInventory totals units', () => {
  const payload = normalizeInventoryAdjustmentInput({ productId: 'prd_1', locationId: 'loc_1', kind: 'receive', delta: '4', note: 'restock' });
  assert.equal(payload.kind, 'receive');
  assert.equal(payload.delta, 4);
  const summary = summarizeInventory([{ locationId: 'loc_1', available: 4, reserved: 1, inbound: 2 }, { locationId: 'loc_2', available: 3, reserved: 0, inbound: 0 }]);
  assert.equal(summary.totalAvailable, 7);
  assert.equal(summary.totalReserved, 1);
  assert.equal(summary.totalInbound, 2);
});
