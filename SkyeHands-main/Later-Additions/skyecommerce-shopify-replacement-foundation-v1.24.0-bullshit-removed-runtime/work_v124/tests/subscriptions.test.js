import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSubscriptionRenewal, customerSubscriptionRecord, normalizeSubscriptionCreateInput, normalizeSubscriptionPatch, normalizeSubscriptionPlanInput, subscriptionInvoiceRecord, subscriptionPlanRecord } from '../src/lib/subscriptions.js';

test('normalizeSubscriptionPlanInput and subscriptionPlanRecord map recurring plan details', () => {
  const payload = normalizeSubscriptionPlanInput({ name: 'Growth Monthly', amountCents: 4900, intervalUnit: 'MONTH', intervalCount: 1, trialDays: 14 });
  assert.equal(payload.code, 'growth-monthly');
  const mapped = subscriptionPlanRecord({ id: 'plan_1', merchant_id: 'm1', name: payload.name, code: payload.code, amount_cents: payload.amountCents, currency: payload.currency, interval_unit: payload.intervalUnit, interval_count: payload.intervalCount, trial_days: payload.trialDays, active: 1 });
  assert.equal(mapped.trialDays, 14);
});

test('normalizeSubscriptionCreateInput and buildSubscriptionRenewal produce cycle ledger', () => {
  const plan = { id: 'plan_1', amountCents: 4900, currency: 'USD', intervalUnit: 'month', intervalCount: 1, trialDays: 0 };
  const created = normalizeSubscriptionCreateInput({ customerId: 'cus_1' }, plan);
  assert.equal(created.status, 'active');
  const renewal = buildSubscriptionRenewal(customerSubscriptionRecord({ id: 'sub_1', merchant_id: 'm1', plan_id: 'plan_1', customer_id: 'cus_1', status: created.status, amount_cents: created.amountCents, currency: created.currency, interval_unit: created.intervalUnit, interval_count: created.intervalCount, current_period_start: created.currentPeriodStart, current_period_end: created.currentPeriodEnd, next_charge_at: created.nextChargeAt }));
  assert.ok(renewal.invoice.periodEnd > renewal.invoice.periodStart);
  const invoice = subscriptionInvoiceRecord({ id: 'inv_1', merchant_id: 'm1', subscription_id: 'sub_1', customer_id: 'cus_1', status: renewal.invoice.status, amount_cents: renewal.invoice.amountCents, currency: renewal.invoice.currency, period_start: renewal.invoice.periodStart, period_end: renewal.invoice.periodEnd, due_at: renewal.invoice.dueAt });
  assert.equal(invoice.amountCents, 4900);
  const patch = normalizeSubscriptionPatch({ status: 'paused', cancelAtPeriodEnd: 'true' }, { status: 'active' });
  assert.equal(patch.status, 'paused');
  assert.equal(patch.cancelAtPeriodEnd, true);
});
