import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDiscount } from '../src/lib/discounts.js';
import { computeOrderQuote } from '../src/lib/quote.js';

test('resolveDiscount applies percentage discount code when active', () => {
  const resolved = resolveDiscount(10000, [{ code: 'SAVE10', type: 'percent', amountBps: 1000, active: 1, usageCount: 0 }], 'save10');
  assert.equal(resolved.applied, true);
  assert.equal(resolved.discountCents, 1000);
});

test('computeOrderQuote subtracts discount before shipping and tax', () => {
  const quote = computeOrderQuote(
    [{ productId: '1', unitPriceCents: 5000, quantity: 2 }],
    [{ rates: [{ code: 'standard', amountCents: 1000, freeAboveCents: 9000 }] }],
    [{ countryCode: 'US', stateCode: 'AZ', rateBps: 810 }],
    { countryCode: 'US', stateCode: 'AZ' },
    'standard',
    'SAVE10',
    [{ code: 'SAVE10', type: 'percent', amountBps: 1000, active: 1, usageCount: 0 }]
  );
  assert.equal(quote.discountCents, 1000);
  assert.equal(quote.discountedSubtotalCents, 9000);
  assert.equal(quote.shippingCents, 0);
  assert.equal(quote.taxCents, 729);
  assert.equal(quote.totalCents, 9729);
});
