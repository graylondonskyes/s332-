export function validatePaymentProviderSmoke({ session = {}, webhook = {}, transaction = {} } = {}) {
  const issues = [];
  if (!['stripe', 'paypal'].includes(session.provider || transaction.provider || webhook.provider || '')) issues.push('unsupported_payment_provider');
  if (!session.checkoutUrl) issues.push('missing_checkout_url');
  if (!session.checkoutToken) issues.push('missing_checkout_token');
  if (!transaction.amountCents && !session.amountCents) issues.push('missing_amount');
  if (!webhook.status) issues.push('missing_webhook_status');
  return {
    provider: session.provider || webhook.provider || transaction.provider || '',
    pass: issues.length === 0,
    issues,
    checks: ['live_provider', 'checkout_url', 'checkout_token', 'amount', 'webhook_status']
  };
}

export function validateCarrierProviderSmoke({ profile = {}, quoteRequest = {}, quotes = [], label = {} } = {}) {
  const issues = [];
  if (profile.provider !== 'ups') issues.push('unsupported_carrier_provider');
  if (!Array.isArray(quoteRequest.packages) || !quoteRequest.packages.length) issues.push('missing_packages');
  if (!Array.isArray(quotes) || !quotes.length) issues.push('missing_quotes');
  if (!label.trackingNumber) issues.push('missing_tracking_number');
  if (!label.labelUrl) issues.push('missing_label_url');
  return {
    provider: profile.provider || '',
    pass: issues.length === 0,
    issues,
    checks: ['ups_provider', 'packages', 'quotes', 'tracking_number', 'label_url']
  };
}

export function validateNotificationProviderSmoke({ message = {}, dispatch = {} } = {}) {
  const issues = [];
  if (!message.channel) issues.push('missing_channel');
  if (!message.recipient) issues.push('missing_recipient');
  if (!message.subject && !message.templateKey) issues.push('missing_subject');
  if (!dispatch.status) issues.push('missing_dispatch_status');
  return {
    channel: message.channel || 'email',
    pass: issues.length === 0,
    issues,
    checks: ['channel', 'recipient', 'subject', 'dispatch_status']
  };
}

export function summarizeProviderSmoke(results = []) {
  const normalized = Array.isArray(results) ? results : [];
  return {
    pass: normalized.every((item) => item.pass),
    total: normalized.length,
    passed: normalized.filter((item) => item.pass).length,
    failed: normalized.filter((item) => !item.pass).length,
    results: normalized
  };
}

export function validateNativeGatewaySpec(spec = {}) {
  const issues = [];
  if (!spec.url) issues.push('missing_url');
  if (!spec.method) issues.push('missing_method');
  if (!spec.headers || typeof spec.headers !== 'object') issues.push('missing_headers');
  if (spec.body === undefined || spec.body === null || spec.body === '') issues.push('missing_body');
  if (!Array.isArray(spec.requiredSecrets) || !spec.requiredSecrets.length) issues.push('missing_required_secrets');
  return {
    provider: spec.provider || 'unknown',
    pass: issues.length === 0,
    issues,
    checks: ['url', 'method', 'headers', 'body', 'required_secrets']
  };
}
