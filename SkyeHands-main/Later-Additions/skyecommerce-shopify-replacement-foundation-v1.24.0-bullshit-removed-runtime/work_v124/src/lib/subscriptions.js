const PLAN_INTERVALS = new Set(['day', 'week', 'month', 'year']);
const SUBSCRIPTION_STATUSES = new Set(['trialing', 'active', 'past_due', 'paused', 'cancelled']);

function normalizedText(value = '') {
  return String(value || '').trim();
}

function boolish(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  return value === true || value === 'true' || value === '1' || value === 1;
}

function numberish(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function coerceInterval(value = 'month') {
  const normalized = normalizedText(value).toLowerCase();
  return PLAN_INTERVALS.has(normalized) ? normalized : 'month';
}

function coerceStatus(value = 'active') {
  const normalized = normalizedText(value).toLowerCase();
  return SUBSCRIPTION_STATUSES.has(normalized) ? normalized : 'active';
}

function addInterval(date, interval = 'month', count = 1) {
  const base = new Date(date instanceof Date ? date : new Date(date || Date.now()));
  const next = new Date(base);
  const amount = Math.max(1, Number(count || 1));
  if (interval === 'day') next.setUTCDate(next.getUTCDate() + amount);
  else if (interval === 'week') next.setUTCDate(next.getUTCDate() + (amount * 7));
  else if (interval === 'month') next.setUTCMonth(next.getUTCMonth() + amount);
  else next.setUTCFullYear(next.getUTCFullYear() + amount);
  return next.toISOString();
}

export function subscriptionPlanRecord(row = {}) {
  return {
    id: row.id || '',
    merchantId: row.merchant_id || row.merchantId || '',
    name: row.name || '',
    code: row.code || '',
    amountCents: Number(row.amount_cents ?? row.amountCents ?? 0),
    currency: normalizedText(row.currency || 'USD').toUpperCase(),
    intervalUnit: coerceInterval(row.interval_unit || row.intervalUnit || 'month'),
    intervalCount: Math.max(1, numberish(row.interval_count, 1)),
    trialDays: Math.max(0, numberish(row.trial_days, 0)),
    active: Boolean(Number(row.active ?? 1)),
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

export function customerSubscriptionRecord(row = {}) {
  return {
    id: row.id || '',
    merchantId: row.merchant_id || row.merchantId || '',
    planId: row.plan_id || row.planId || '',
    customerId: row.customer_id || row.customerId || '',
    status: coerceStatus(row.status || 'active'),
    amountCents: Number(row.amount_cents ?? row.amountCents ?? 0),
    currency: normalizedText(row.currency || 'USD').toUpperCase(),
    intervalUnit: coerceInterval(row.interval_unit || row.intervalUnit || 'month'),
    intervalCount: Math.max(1, numberish(row.interval_count, 1)),
    currentPeriodStart: row.current_period_start || row.currentPeriodStart || '',
    currentPeriodEnd: row.current_period_end || row.currentPeriodEnd || '',
    nextChargeAt: row.next_charge_at || row.nextChargeAt || '',
    cancelAtPeriodEnd: Boolean(Number(row.cancel_at_period_end ?? 0)),
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

export function subscriptionInvoiceRecord(row = {}) {
  return {
    id: row.id || '',
    merchantId: row.merchant_id || row.merchantId || '',
    subscriptionId: row.subscription_id || row.subscriptionId || '',
    customerId: row.customer_id || row.customerId || '',
    orderId: row.order_id || row.orderId || '',
    status: normalizedText(row.status || 'open').toLowerCase(),
    amountCents: Number(row.amount_cents ?? row.amountCents ?? 0),
    currency: normalizedText(row.currency || 'USD').toUpperCase(),
    periodStart: row.period_start || row.periodStart || '',
    periodEnd: row.period_end || row.periodEnd || '',
    dueAt: row.due_at || row.dueAt || '',
    createdAt: row.created_at || row.createdAt || ''
  };
}

export function normalizeSubscriptionPlanInput(body = {}) {
  return {
    name: normalizedText(body.name || ''),
    code: normalizedText(body.code || body.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'plan',
    amountCents: Math.max(0, numberish(body.amountCents, 0)),
    currency: normalizedText(body.currency || 'USD').toUpperCase(),
    intervalUnit: coerceInterval(body.intervalUnit || body.interval || 'month'),
    intervalCount: Math.max(1, numberish(body.intervalCount, 1)),
    trialDays: Math.max(0, numberish(body.trialDays, 0)),
    active: boolish(body.active, true)
  };
}

export function normalizeSubscriptionCreateInput(body = {}, plan = {}) {
  const now = new Date();
  const trialDays = Math.max(0, numberish(body.trialDays, plan.trialDays || 0));
  const currentPeriodStart = now.toISOString();
  const currentPeriodEnd = trialDays
    ? addInterval(now, 'day', trialDays)
    : addInterval(now, body.intervalUnit || plan.intervalUnit || 'month', body.intervalCount || plan.intervalCount || 1);
  return {
    planId: normalizedText(body.planId || plan.id || ''),
    customerId: normalizedText(body.customerId || ''),
    status: trialDays ? 'trialing' : 'active',
    amountCents: Math.max(0, numberish(body.amountCents, plan.amountCents || 0)),
    currency: normalizedText(body.currency || plan.currency || 'USD').toUpperCase(),
    intervalUnit: coerceInterval(body.intervalUnit || plan.intervalUnit || 'month'),
    intervalCount: Math.max(1, numberish(body.intervalCount, plan.intervalCount || 1)),
    currentPeriodStart,
    currentPeriodEnd,
    nextChargeAt: currentPeriodEnd,
    cancelAtPeriodEnd: boolish(body.cancelAtPeriodEnd, false)
  };
}

export function normalizeSubscriptionPatch(body = {}, current = {}) {
  return {
    status: body.status ? coerceStatus(body.status) : coerceStatus(current.status || 'active'),
    cancelAtPeriodEnd: body.cancelAtPeriodEnd === undefined ? Boolean(current.cancelAtPeriodEnd) : boolish(body.cancelAtPeriodEnd, false)
  };
}

export function buildSubscriptionRenewal(current = {}, now = new Date()) {
  const subscription = customerSubscriptionRecord(current);
  const start = subscription.currentPeriodEnd || now.toISOString();
  const end = addInterval(start, subscription.intervalUnit, subscription.intervalCount);
  return {
    nextPeriodStart: start,
    nextPeriodEnd: end,
    nextChargeAt: start,
    invoice: {
      status: 'open',
      amountCents: subscription.amountCents,
      currency: subscription.currency,
      periodStart: start,
      periodEnd: end,
      dueAt: start
    }
  };
}
