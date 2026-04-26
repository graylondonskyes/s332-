import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateEarnedPoints, loyaltyLedgerRecord, normalizeLoyaltyLedgerInput, normalizeLoyaltyProgramInput, previewLoyaltyRedemption, summarizeLoyaltyBalance } from '../src/lib/loyalty.js';

test('loyalty program earns and redeems bounded points', () => {
  const program = normalizeLoyaltyProgramInput({ name: 'Sky Rewards', earnPointsPerDollar: 2, redeemCentsPerPoint: 5, minimumRedeemPoints: 100 });
  const earned = calculateEarnedPoints({ totalCents: 12345 }, { ...program, active: true });
  const ledger = [loyaltyLedgerRecord({ id: 'l1', points_delta: earned.points }), normalizeLoyaltyLedgerInput({ direction: 'redeem', points: 40 })];
  const summary = summarizeLoyaltyBalance(ledger);
  const redemption = previewLoyaltyRedemption(summary.balancePoints, 120, program);
  assert.equal(earned.points, 246);
  assert.equal(summary.balancePoints, 206);
  assert.equal(redemption.discountCents, 600);
  assert.equal(redemption.valid, true);
});
