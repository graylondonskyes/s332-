import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreOrderRisk } from '../src/lib/risk.js';
import { buildSignedWebhookRequest, normalizeWebhookEndpointInput, webhookDeliveryRecord } from '../src/lib/webhooks.js';

test('risk engine escalates high value velocity orders', () => {
  const risk = scoreOrderRisk({ totalCents: 175000, customerEmail: 'buyer@mailinator.com' }, { recentOrderCount: 4, customerOrderCount: 0, flags: ['proxy_ip'] });
  assert.equal(risk.decision, 'hold');
  assert.ok(risk.score >= 70);
  assert.ok(risk.reasons.includes('disposable_email_domain'));
});

test('webhook endpoint normalizes and signs delivery specs', async () => {
  const endpoint = normalizeWebhookEndpointInput({ name: 'ERP', url: 'https://example.com/webhook', events: ['order.created'], secret: 'secret' });
  assert.equal(endpoint.events[0], 'order.created');
  const delivery = webhookDeliveryRecord({ id: 'whd_1', merchant_id: 'm1', endpoint_id: 'whk_1', event_type: 'order.created', payload_json: '{"ok":true}' });
  const spec = await buildSignedWebhookRequest({ ...endpoint, id: 'whk_1' }, delivery);
  assert.equal(spec.method, 'POST');
  assert.equal(spec.headers['x-skyecommerce-event'], 'order.created');
  assert.ok(spec.headers['x-skyecommerce-signature']);
});
