import test from 'node:test';
import assert from 'node:assert/strict';
import { giftCardRecord, normalizeGiftCardIssueInput, previewGiftCardRedemption } from '../src/lib/gift-cards.js';

test('gift card issue input and redemption preview are bounded', () => {
  const issue = normalizeGiftCardIssueInput({ code: 'skye-100!', balanceCents: 10000, customerEmail: 'BUYER@TEST.COM' });
  assert.equal(issue.code, 'SKYE-100');
  assert.equal(issue.customerEmail, 'buyer@test.com');
  const card = giftCardRecord({ id: 'g1', merchant_id: 'm1', code_last4: '-100', initial_balance_cents: 10000, balance_cents: 2500, active: 1, currency: 'USD' });
  const preview = previewGiftCardRedemption(card, 4000);
  assert.equal(preview.appliedCents, 2500);
  assert.equal(preview.remainingBalanceCents, 0);
});
