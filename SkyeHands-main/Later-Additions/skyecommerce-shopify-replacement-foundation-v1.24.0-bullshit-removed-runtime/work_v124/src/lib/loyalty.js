const text = (v = '') => String(v ?? '').trim();
const num = (v, f = 0) => Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : f;
const bool = (v, f = false) => v === undefined || v === null || v === '' ? f : v === true || v === 'true' || v === '1' || v === 1;

export function normalizeLoyaltyProgramInput(body = {}, existing = {}) {
  return {
    name: text(body.name || existing.name || 'Rewards Program'),
    earnPointsPerDollar: Math.max(0, num(body.earnPointsPerDollar ?? body.earn_points_per_dollar ?? existing.earnPointsPerDollar ?? existing.earn_points_per_dollar, 1)),
    redeemCentsPerPoint: Math.max(0, num(body.redeemCentsPerPoint ?? body.redeem_cents_per_point ?? existing.redeemCentsPerPoint ?? existing.redeem_cents_per_point, 1)),
    minimumRedeemPoints: Math.max(0, num(body.minimumRedeemPoints ?? body.minimum_redeem_points ?? existing.minimumRedeemPoints ?? existing.minimum_redeem_points, 100)),
    active: bool(body.active, existing.active ?? true)
  };
}

export function loyaltyProgramRecord(row) {
  if (!row) return null;
  return {
    id: row.id || '',
    merchantId: row.merchant_id || row.merchantId || '',
    name: row.name || '',
    earnPointsPerDollar: Number(row.earn_points_per_dollar ?? row.earnPointsPerDollar ?? 0),
    redeemCentsPerPoint: Number(row.redeem_cents_per_point ?? row.redeemCentsPerPoint ?? 0),
    minimumRedeemPoints: Number(row.minimum_redeem_points ?? row.minimumRedeemPoints ?? 0),
    active: Boolean(Number(row.active ?? 1)),
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

export function calculateEarnedPoints(order = {}, program = {}) {
  if (!program?.active) return { points: 0, reason: 'program_inactive' };
  const cents = Math.max(0, Number(order.totalCents ?? order.total_cents ?? 0));
  const dollars = Math.floor(cents / 100);
  const points = dollars * Math.max(0, Number(program.earnPointsPerDollar || 0));
  return { points, baseCents: cents, earnPointsPerDollar: program.earnPointsPerDollar || 0, reason: points > 0 ? 'earned' : 'no_eligible_amount' };
}

export function previewLoyaltyRedemption(balancePoints = 0, requestedPoints = 0, program = {}) {
  const balance = Math.max(0, Number(balancePoints || 0));
  const requested = Math.max(0, Number(requestedPoints || 0));
  const minimum = Math.max(0, Number(program.minimumRedeemPoints || 0));
  const usablePoints = requested < minimum ? 0 : Math.min(balance, requested);
  const discountCents = usablePoints * Math.max(0, Number(program.redeemCentsPerPoint || 0));
  return { balancePoints: balance, requestedPoints: requested, usablePoints, discountCents, remainingPoints: Math.max(0, balance - usablePoints), valid: usablePoints > 0 && usablePoints === requested };
}

export function normalizeLoyaltyLedgerInput(body = {}) {
  const direction = text(body.direction || body.kind || 'adjust').toLowerCase();
  const rawPoints = Math.max(0, num(body.points ?? body.pointDelta ?? body.points_delta, 0));
  const sign = direction === 'redeem' || direction === 'expire' || direction === 'void' ? -1 : 1;
  return {
    customerId: text(body.customerId || body.customer_id),
    orderId: text(body.orderId || body.order_id),
    pointsDelta: sign * rawPoints,
    reason: text(body.reason || direction || 'adjust'),
    note: text(body.note || '')
  };
}

export function loyaltyLedgerRecord(row) {
  if (!row) return null;
  return {
    id: row.id || '',
    merchantId: row.merchant_id || row.merchantId || '',
    customerId: row.customer_id || row.customerId || '',
    orderId: row.order_id || row.orderId || '',
    pointsDelta: Number(row.points_delta ?? row.pointsDelta ?? 0),
    reason: row.reason || '',
    note: row.note || '',
    createdAt: row.created_at || row.createdAt || ''
  };
}

export function summarizeLoyaltyBalance(entries = []) {
  const records = (Array.isArray(entries) ? entries : []).map(loyaltyLedgerRecord).filter(Boolean);
  const earnedPoints = records.filter((row) => row.pointsDelta > 0).reduce((sum, row) => sum + row.pointsDelta, 0);
  const spentPoints = Math.abs(records.filter((row) => row.pointsDelta < 0).reduce((sum, row) => sum + row.pointsDelta, 0));
  return { earnedPoints, spentPoints, balancePoints: Math.max(0, earnedPoints - spentPoints), entryCount: records.length };
}
