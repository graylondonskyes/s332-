function normalizedText(value = '') {
  return String(value || '').trim();
}

export function notificationRecord(row = {}) {
  return {
    id: row.id || '',
    merchantId: row.merchant_id || row.merchantId || '',
    orderId: row.order_id || row.orderId || '',
    customerId: row.customer_id || row.customerId || '',
    channel: normalizedText(row.channel || 'email').toLowerCase(),
    templateKey: row.template_key || row.templateKey || '',
    recipient: row.recipient || '',
    subject: row.subject || '',
    bodyText: row.body_text || row.bodyText || '',
    status: row.status || 'queued',
    providerRef: row.provider_ref || row.providerRef || '',
    meta: (() => {
      try {
        return JSON.parse(row.meta_json || row.metaJson || '{}');
      } catch {
        return {};
      }
    })(),
    createdAt: row.created_at || row.createdAt || '',
    sentAt: row.sent_at || row.sentAt || ''
  };
}

function recipientLabel(kind = 'customer') {
  return kind === 'merchant' ? 'merchant team' : 'customer';
}

function buildSubject(eventKey, merchant = {}, order = {}) {
  const brand = merchant.brandName || merchant.slug || 'Store';
  const orderNumber = order.orderNumber || 'order';
  switch (eventKey) {
    case 'order_created_customer': return `${brand}: order ${orderNumber} received`;
    case 'order_created_merchant': return `${brand}: new order ${orderNumber}`;
    case 'payment_paid_customer': return `${brand}: payment captured for ${orderNumber}`;
    case 'payment_paid_merchant': return `${brand}: payment collected for ${orderNumber}`;
    case 'fulfillment_created_customer': return `${brand}: shipment update for ${orderNumber}`;
    case 'return_requested_customer': return `${brand}: return request received for ${orderNumber}`;
    case 'return_requested_merchant': return `${brand}: new return request for ${orderNumber}`;
    case 'return_updated_customer': return `${brand}: return updated for ${orderNumber}`;
    default: return `${brand}: commerce update for ${orderNumber}`;
  }
}

function buildBody(eventKey, { merchant = {}, order = {}, payment = null, fulfillment = null, returnRequest = null } = {}, kind = 'customer') {
  const brand = merchant.brandName || merchant.slug || 'Store';
  const orderNumber = order.orderNumber || 'order';
  const who = recipientLabel(kind);
  const lines = [`${brand} update for ${who}.`, `Order: ${orderNumber}`];
  if (order.customerName) lines.push(`Customer: ${order.customerName}`);
  if (eventKey.startsWith('payment_') && payment) {
    lines.push(`Payment status: ${payment.status}`);
    if (payment.providerReference) lines.push(`Reference: ${payment.providerReference}`);
  }
  if (eventKey === 'fulfillment_created_customer' && fulfillment) {
    lines.push(`Carrier: ${fulfillment.carrier || 'n/a'}`);
    lines.push(`Tracking: ${fulfillment.trackingNumber || fulfillment.note || 'n/a'}`);
  }
  if (eventKey.startsWith('return_') && returnRequest) {
    lines.push(`Return status: ${returnRequest.status || 'requested'}`);
    if (returnRequest.reason) lines.push(`Reason: ${returnRequest.reason}`);
    if (returnRequest.merchantNote) lines.push(`Merchant note: ${returnRequest.merchantNote}`);
  }
  if (eventKey === 'order_created_customer') lines.push('Your order is in the merchant command queue and awaiting the configured payment flow.');
  if (eventKey === 'order_created_merchant') lines.push('A new order entered the platform and should appear in merchant operations immediately.');
  if (eventKey === 'payment_paid_customer') lines.push('Payment is marked captured in the platform ledger.');
  if (eventKey === 'payment_paid_merchant') lines.push('Order payment status is now paid.');
  if (eventKey === 'return_requested_customer') lines.push('The return request is now recorded in the platform.');
  if (eventKey === 'return_updated_customer') lines.push('Return status changed inside the merchant command center.');
  return lines.join('\n');
}

export function buildCommerceNotifications({ merchant = {}, order = {}, customer = null, payment = null, fulfillment = null, returnRequest = null, eventKey = '' } = {}) {
  const notifications = [];
  const merchantRecipient = normalizedText(merchant.email || '').toLowerCase();
  const customerRecipient = normalizedText(order.customerEmail || customer?.email || '').toLowerCase();
  const customerPhone = normalizedText(customer?.phone || '');

  const addNotification = (kind, channel, recipient, templateKey) => {
    if (!recipient) return;
    notifications.push({
      channel,
      recipient,
      templateKey,
      subject: buildSubject(templateKey, merchant, order),
      bodyText: buildBody(templateKey, { merchant, order, payment, fulfillment, returnRequest }, kind),
      meta: {
        orderNumber: order.orderNumber || '',
        merchantSlug: merchant.slug || '',
        eventKey,
        channel
      }
    });
  };

  if (eventKey === 'order_created') {
    addNotification('customer', 'email', customerRecipient, 'order_created_customer');
    addNotification('merchant', 'email', merchantRecipient, 'order_created_merchant');
    addNotification('customer', 'sms', customerPhone, 'order_created_customer');
  }
  if (eventKey === 'payment_paid') {
    addNotification('customer', 'email', customerRecipient, 'payment_paid_customer');
    addNotification('merchant', 'email', merchantRecipient, 'payment_paid_merchant');
  }
  if (eventKey === 'fulfillment_created') {
    addNotification('customer', 'email', customerRecipient, 'fulfillment_created_customer');
    addNotification('customer', 'sms', customerPhone, 'fulfillment_created_customer');
  }
  if (eventKey === 'return_requested') {
    addNotification('customer', 'email', customerRecipient, 'return_requested_customer');
    addNotification('merchant', 'email', merchantRecipient, 'return_requested_merchant');
  }
  if (eventKey === 'return_updated') {
    addNotification('customer', 'email', customerRecipient, 'return_updated_customer');
  }
  return notifications;
}
