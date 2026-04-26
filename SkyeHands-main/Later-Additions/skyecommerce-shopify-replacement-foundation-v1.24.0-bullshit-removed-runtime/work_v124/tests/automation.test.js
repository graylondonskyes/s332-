import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAutomationActionEffects, evaluateWorkflowRule, normalizeWorkflowRuleInput, renderTemplate } from '../src/lib/automation.js';

test('workflow automation rules match conditions and render action templates', () => {
  const rule = normalizeWorkflowRuleInput({
    name: 'High value order hold',
    triggerEvent: 'order.created',
    conditions: [{ field: 'order.totalCents', operator: 'gte', value: 100000 }],
    actions: [
      { type: 'hold_order', note: 'Review {{order.orderNumber}}' },
      { type: 'queue_notification', target: 'email', subject: 'Order {{order.orderNumber}} needs review', bodyText: 'Total {{order.totalCents}}' },
      { type: 'queue_webhook', target: 'order.high_value' }
    ]
  });
  const result = evaluateWorkflowRule(rule, { eventType: 'order.created', payload: { order: { orderNumber: 'SKY-100', totalCents: 125000 } } });
  assert.equal(rule.key, 'high_value_order_hold');
  assert.equal(result.matched, true);
  assert.equal(result.actions[1].subject, 'Order SKY-100 needs review');
  assert.deepEqual(buildAutomationActionEffects(result.actions), { notificationCount: 1, webhookCount: 1, orderHoldCount: 1, taskCount: 0, tags: [] });
  assert.equal(renderTemplate('Hello {{customer.firstName}}', { customer: { firstName: 'Sky' } }), 'Hello Sky');
});

test('workflow automation skips inactive or nonmatching triggers', () => {
  const rule = normalizeWorkflowRuleInput({ name: 'Abandoned checkout', triggerEvent: 'checkout.abandoned', active: true, actions: [{ type: 'queue_notification' }] });
  assert.equal(evaluateWorkflowRule(rule, { eventType: 'order.created', payload: {} }).matched, false);
  assert.equal(evaluateWorkflowRule({ ...rule, active: false }, { eventType: 'checkout.abandoned', payload: {} }).reason, 'rule_inactive');
});
