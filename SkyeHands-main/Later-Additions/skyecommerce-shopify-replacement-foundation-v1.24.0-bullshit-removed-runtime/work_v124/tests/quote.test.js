import test from 'node:test';
import assert from 'node:assert/strict';
import { computeOrderQuote } from '../src/lib/quote.js';

test('computeOrderQuote applies shipping threshold and tax', () => {
  const quote = computeOrderQuote(
    [{ productId: '1', unitPriceCents: 6000, quantity: 2 }],
    [{ rates: [{ code: 'standard', amountCents: 1299, freeAboveCents: 10000 }] }],
    [{ countryCode: 'US', stateCode: 'AZ', rateBps: 810 }],
    { countryCode: 'US', stateCode: 'AZ' },
    'standard'
  );
  assert.equal(quote.subtotalCents, 12000);
  assert.equal(quote.shippingCents, 0);
  assert.equal(quote.taxCents, 972);
  assert.equal(quote.totalCents, 12972);
});
