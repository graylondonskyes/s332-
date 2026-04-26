import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPaymentWebhook, buildHostedPaymentSession, buildPaymentTimelineEvent, normalizePaymentSessionInput, normalizePaymentWebhookInput } from '../src/lib/payments.js';

test('normalizePaymentSessionInput accepts only live payment providers and defaults to order total', () => {
  const payload = normalizePaymentSessionInput({ provider: 'STRIPE' }, { totalCents: 4599, currency: 'usd' });
  assert.equal(payload.provider, 'stripe');
  assert.equal(payload.amountCents, 4599);
  assert.equal(payload.currency, 'USD');
  const rejected = normalizePaymentSessionInput({ provider: 'cash' }, { totalCents: 4599, currency: 'usd' });
  assert.equal(rejected.provider, '');
});

test('buildHostedPaymentSession exposes only provider checkout URLs', () => {
  const session = buildHostedPaymentSession({ transactionId: 'pay_1', checkoutToken: 'chk_1', provider: 'stripe', amountCents: 3000, currency: 'USD', merchantSlug: 'merchant-store', orderNumber: 'SKY-1001', externalCheckoutUrl: 'https://checkout.stripe.com/c/pay_1' });
  assert.equal(session.checkoutUrl, 'https://checkout.stripe.com/c/pay_1');
  assert.equal(session.external, true);
  const blockedLocal = buildHostedPaymentSession({ transactionId: 'pay_2', checkoutToken: 'chk_2', provider: 'stripe', amountCents: 3000, currency: 'USD', merchantSlug: 'merchant-store', orderNumber: 'SKY-1002' });
  assert.equal(blockedLocal.checkoutUrl, '');
  assert.equal(blockedLocal.external, false);
});

test('applyPaymentWebhook upgrades order payment status on paid event', () => {
  const incoming = normalizePaymentWebhookInput({ provider: 'stripe', checkoutToken: 'chk_1', status: 'paid', amountCents: 3000, providerReference: 'pi_123' });
  const next = applyPaymentWebhook({ provider: 'stripe', status: 'pending', amount_cents: 3000, currency: 'USD' }, incoming);
  assert.equal(next.status, 'paid');
  assert.equal(next.orderPaymentStatus, 'paid');
  const event = buildPaymentTimelineEvent({ orderNumber: 'SKY-1001', provider: 'stripe', status: 'paid', amountCents: 3000, currency: 'USD', providerReference: 'pi_123' });
  assert.equal(event.kind, 'payment_paid');
});
