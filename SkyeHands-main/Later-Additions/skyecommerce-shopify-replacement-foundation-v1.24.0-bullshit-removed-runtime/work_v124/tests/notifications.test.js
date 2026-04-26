import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCommerceNotifications, notificationRecord } from '../src/lib/notifications.js';

test('buildCommerceNotifications creates merchant and customer messages for order creation', () => {
  const messages = buildCommerceNotifications({
    merchant: { id: 'm1', slug: 'merchant-store', brandName: 'Merchant Store', email: 'owner@example.com' },
    order: { id: 'o1', orderNumber: 'SKY-1001', customerName: 'Buyer Example', customerEmail: 'buyer@example.com' },
    customer: { id: 'c1', phone: '+15555555555' },
    eventKey: 'order_created'
  });
  assert.equal(messages.length, 3);
  assert.equal(messages[0].templateKey, 'order_created_customer');
  const row = notificationRecord({ id: 'n1', merchant_id: 'm1', order_id: 'o1', channel: 'email', template_key: 'order_created_customer', recipient: 'buyer@example.com', subject: 'Order' , body_text: 'Body', status: 'queued', meta_json: '{"ok":true}' });
  assert.equal(row.meta.ok, true);
});
