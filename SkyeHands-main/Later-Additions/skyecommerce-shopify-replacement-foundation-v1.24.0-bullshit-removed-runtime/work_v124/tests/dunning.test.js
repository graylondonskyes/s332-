import test from 'node:test';
import assert from 'node:assert/strict';
import { applyInvoicePaymentUpdate, buildDunningEvent, dunningEventRecord, normalizeInvoicePaymentSessionInput } from '../src/lib/dunning.js';

test('normalizeInvoicePaymentSessionInput accepts live invoice payment providers', () => {
  const normalized = normalizeInvoicePaymentSessionInput({ provider: 'paypal', amountCents: 4900, metadata: { invoiceId: 'inv_1' } }, { amountCents: 4900, currency: 'usd' });
  assert.equal(normalized.provider, 'paypal');
  assert.equal(normalized.currency, 'USD');
  const rejected = normalizeInvoicePaymentSessionInput({ provider: 'cash', amountCents: 4900 }, { amountCents: 4900, currency: 'usd' });
  assert.equal(rejected.provider, '');
});

test('applyInvoicePaymentUpdate maps paid and failed states into invoice + subscription updates', () => {
  const paid = applyInvoicePaymentUpdate({ status: 'open' }, { orderPaymentStatus: 'paid' }, { status: 'past_due' });
  assert.equal(paid.invoiceStatus, 'paid');
  assert.equal(paid.subscriptionStatus, 'active');

  const failed = applyInvoicePaymentUpdate({ status: 'open' }, { orderPaymentStatus: 'failed' }, { status: 'active' });
  assert.equal(failed.invoiceStatus, 'failed');
  assert.equal(failed.subscriptionStatus, 'past_due');
  const event = dunningEventRecord({ id: 'dun_1', merchant_id: 'm1', subscription_id: 'sub_1', invoice_id: 'inv_1', stage: buildDunningEvent({ stage: 'dunning_sent' }).stage, note: 'Reminder sent' });
  assert.equal(event.stage, 'dunning_sent');
});
