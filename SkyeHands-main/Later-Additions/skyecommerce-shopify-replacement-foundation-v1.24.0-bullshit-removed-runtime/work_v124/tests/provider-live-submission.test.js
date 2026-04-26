import test from 'node:test';
import assert from 'node:assert/strict';
import { executeProviderDisputeEvidence, executeProviderRefund } from '../src/lib/provider-runtime.js';

const stripeConnection = { id: 'pcon_1', provider: 'stripe', environment: 'production', endpoint_base: 'https://api.stripe.test', config_json: '{}' };

test('stripe refund runtime submits a live refund request shape', async () => {
  const calls = [];
  const result = await executeProviderRefund(stripeConnection, { refund: { amountCents: 1200, currency: 'USD', providerRef: 'pi_123', reason: 'requested_by_customer' } }, { STRIPE_SECRET_KEY: 'sk_test', STRIPE_WEBHOOK_SECRET: 'whsec' }, {
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: 're_123', status: 'succeeded' }), { status: 200 });
    }
  });
  assert.equal(result.status, 'executed');
  assert.equal(result.providerReference, 're_123');
  assert.equal(calls[0].url, 'https://api.stripe.test/v1/refunds');
  assert.match(calls[0].init.body, /payment_intent=pi_123/);
});

test('stripe dispute runtime submits evidence shape', async () => {
  const calls = [];
  const result = await executeProviderDisputeEvidence(stripeConnection, { dispute: { providerDisputeId: 'dp_123' }, evidence: { summary: 'Delivered.', sections: { customerCommunication: 'Buyer confirmed.', refundPolicy: 'No return without RMA.', fulfillmentProof: [{ trackingNumber: '1Z' }] } } }, { STRIPE_SECRET_KEY: 'sk_test', STRIPE_WEBHOOK_SECRET: 'whsec' }, {
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: 'dp_123', status: 'under_review' }), { status: 200 });
    }
  });
  assert.equal(result.status, 'executed');
  assert.equal(calls[0].url, 'https://api.stripe.test/v1/disputes/dp_123');
  assert.match(calls[0].init.body, /submit=true/);
});
