import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPosCheckoutReceipt, calculatePosCartTotals, normalizePosCartInput, normalizeRegisterInput, normalizeShiftCloseInput, normalizeShiftOpenInput } from '../src/lib/pos.js';

test('pos register and shift inputs normalize retail operations data', () => {
  const register = normalizeRegisterInput({ name: 'Front Counter', cashDrawerCents: 12500 });
  const open = normalizeShiftOpenInput({ staffMemberId: 'stm_1' }, { id: 'reg_1', cashDrawerCents: register.cashDrawerCents });
  const close = normalizeShiftCloseInput({ closingCashCents: 14900, note: 'balanced' });
  assert.equal(register.name, 'Front Counter');
  assert.equal(open.openingCashCents, 12500);
  assert.equal(close.closingCashCents, 14900);
});

test('pos cart totals and checkout receipt prove payment capture math', () => {
  const cart = normalizePosCartInput({ items: [{ productId: 'p1', title: 'Hat', quantity: 2, unitPriceCents: 2500 }], discountCents: 500, taxBps: 810 });
  const totals = calculatePosCartTotals(cart.items, { discountCents: 500, taxBps: 810 });
  const receipt = buildPosCheckoutReceipt(cart, [{ type: 'cash', amountCents: 5300 }]);
  assert.equal(totals.totalCents, 4864);
  assert.equal(receipt.paid, true);
  assert.equal(receipt.changeDueCents, 436);
});
