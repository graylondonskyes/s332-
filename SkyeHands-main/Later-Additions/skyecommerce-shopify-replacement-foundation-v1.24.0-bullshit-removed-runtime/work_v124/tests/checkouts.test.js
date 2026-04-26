import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCheckoutRecoveryNotification, checkoutSessionRecord, classifyCheckout, normalizeCheckoutInput } from '../src/lib/checkouts.js';

test('checkout input normalizes recoverable cart lines', () => {
  const payload = normalizeCheckoutInput({ slug: 'Merchant', customerEmail: 'BUYER@EXAMPLE.COM', items: [{ productId: 'p1', variantId: 'v1', quantity: 2 }], discountCode: 'save10' });
  assert.equal(payload.slug, 'merchant');
  assert.equal(payload.customerEmail, 'buyer@example.com');
  assert.equal(payload.discountCode, 'SAVE10');
  assert.equal(payload.items[0].quantity, 2);
});

test('checkout session classifies abandoned and builds recovery notification', () => {
  const row = checkoutSessionRecord({ id: 'chk_1', merchant_id: 'm1', customer_email: 'buyer@test.com', status: 'open', total_cents: 4200, items_json: '[]', shipping_address_json: '{}', quote_json: '{}', meta_json: '{}', updated_at: '2026-01-01T00:00:00.000Z' });
  assert.equal(classifyCheckout(row, Date.parse('2026-01-01T02:00:00.000Z'), 60), 'abandoned');
  const message = buildCheckoutRecoveryNotification({ merchant: { brandName: 'Merchant', currency: 'USD' }, checkout: row, storefrontUrl: 'https://example.com/cart' });
  assert.equal(message.recipient, 'buyer@test.com');
  assert.equal(message.templateKey, 'checkout_recovery');
});
