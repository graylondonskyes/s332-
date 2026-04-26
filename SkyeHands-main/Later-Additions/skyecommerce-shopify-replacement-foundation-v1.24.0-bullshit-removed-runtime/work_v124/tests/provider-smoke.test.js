import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeProviderSmoke, validateCarrierProviderSmoke, validateNotificationProviderSmoke, validatePaymentProviderSmoke } from '../src/lib/provider-smoke.js';

test('provider smoke validators pass for complete live-provider artifacts', () => {
  const payment = validatePaymentProviderSmoke({ session: { provider: 'stripe', checkoutUrl: 'https://checkout.stripe.com/c/pay_1', checkoutToken: 'chk_1', amountCents: 1000 }, webhook: { provider: 'stripe', status: 'paid' }, transaction: { provider: 'stripe', amountCents: 1000 } });
  const carrier = validateCarrierProviderSmoke({ profile: { provider: 'ups' }, quoteRequest: { packages: [{ id: 'pkg_1' }] }, quotes: [{ serviceCode: 'ground' }], label: { trackingNumber: '1Z123', labelUrl: 'data:application/pdf;base64,UEs=' } });
  const notification = validateNotificationProviderSmoke({ message: { channel: 'email', recipient: 'test@example.com', subject: 'Ready' }, dispatch: { status: 'sent' } });
  const summary = summarizeProviderSmoke([payment, carrier, notification]);
  assert.equal(summary.pass, true);
  assert.equal(summary.passed, 3);
});
