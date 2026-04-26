import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInventoryTransferPlan, inventoryTransferRecord, normalizeInventoryTransferInput } from '../src/lib/inventory-transfers.js';

test('inventory transfers normalize multi-location transfer demand and validate source stock', () => {
  const transfer = normalizeInventoryTransferInput({ fromLocationId: 'loc_a', toLocationId: 'loc_b', items: [{ productId: 'prd_1', quantity: 4 }, { productId: 'prd_2', quantity: 2 }] });
  const plan = buildInventoryTransferPlan(transfer, [{ productId: 'prd_1', available: 5 }, { productId: 'prd_2', available: 1 }]);
  const record = inventoryTransferRecord({ id: 'itr_1', from_location_id: transfer.fromLocationId, to_location_id: transfer.toLocationId, status: transfer.status, items_json: JSON.stringify(transfer.items) });
  assert.equal(transfer.status, 'requested');
  assert.equal(plan.ok, false);
  assert.equal(plan.checks[1].shortBy, 1);
  assert.equal(record.unitCount, 6);
});
