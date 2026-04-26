import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAppBillingInvoice, normalizeAppBillingPlanInput, normalizeAppBillingSubscriptionInput, normalizeAppUsageEventInput } from '../src/lib/app-billing.js';

test('app billing supports recurring plus usage invoice math', () => {
  const plan = normalizeAppBillingPlanInput({ appId: 'app_1', name: 'ERP Pro', billingType: 'hybrid', amountCents: 2900, usageUnit: 'order_sync', usageCents: 7 });
  const subscription = normalizeAppBillingSubscriptionInput({ installationId: 'ins_1' }, { ...plan, id: 'plan_1' });
  const usage = normalizeAppUsageEventInput({ quantity: 300 }, plan);
  const invoice = buildAppBillingInvoice({ subscription: { ...subscription, id: 'sub_1' }, plan, usageEvents: [usage] });
  assert.equal(invoice.baseCents, 2900);
  assert.equal(invoice.usageCents, 2100);
  assert.equal(invoice.totalCents, 5000);
  assert.equal(invoice.lineItems.length, 2);
});
