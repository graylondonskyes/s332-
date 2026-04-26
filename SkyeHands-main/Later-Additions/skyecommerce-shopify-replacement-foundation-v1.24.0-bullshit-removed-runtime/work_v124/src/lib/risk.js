export function normalizeRiskSignalInput(input = {}) {
  return {
    ipAddress: String(input.ipAddress || input.ip_address || '').trim(),
    userAgent: String(input.userAgent || input.user_agent || '').trim(),
    billingCountry: String(input.billingCountry || input.billing_country || '').trim().toUpperCase(),
    shippingCountry: String(input.shippingCountry || input.shipping_country || '').trim().toUpperCase(),
    emailDomain: String(input.emailDomain || input.email_domain || '').trim().toLowerCase(),
    customerOrderCount: Math.max(0, Number(input.customerOrderCount || input.customer_order_count || 0) || 0),
    recentOrderCount: Math.max(0, Number(input.recentOrderCount || input.recent_order_count || 0) || 0),
    flags: Array.isArray(input.flags) ? input.flags.map((flag) => String(flag).trim()).filter(Boolean) : []
  };
}

export function scoreOrderRisk(order = {}, signalInput = {}) {
  const signals = normalizeRiskSignalInput(signalInput);
  const totalCents = Number(order.totalCents ?? order.total_cents ?? 0) || 0;
  const customerEmail = String(order.customerEmail || order.customer_email || '').toLowerCase();
  const domain = signals.emailDomain || customerEmail.split('@')[1] || '';
  let score = 5;
  const reasons = [];
  if (totalCents >= 50000) { score += 20; reasons.push('high_value_order'); }
  if (totalCents >= 150000) { score += 20; reasons.push('very_high_value_order'); }
  if (signals.billingCountry && signals.shippingCountry && signals.billingCountry !== signals.shippingCountry) { score += 18; reasons.push('billing_shipping_country_mismatch'); }
  if (signals.recentOrderCount >= 3) { score += 16; reasons.push('velocity_spike'); }
  if (signals.customerOrderCount === 0) { score += 8; reasons.push('new_customer'); }
  if (['tempmail.com', 'mailinator.com', '10minutemail.com'].includes(domain)) { score += 25; reasons.push('disposable_email_domain'); }
  for (const flag of signals.flags) {
    if (flag === 'chargeback_history') { score += 35; reasons.push('chargeback_history'); }
    else if (flag === 'address_warning') { score += 15; reasons.push('address_warning'); }
    else if (flag === 'proxy_ip') { score += 15; reasons.push('proxy_ip'); }
  }
  score = Math.max(0, Math.min(100, score));
  const decision = score >= 70 ? 'hold' : score >= 40 ? 'review' : 'approve';
  return { score, decision, reasons, signals };
}

export function riskAssessmentRecord(row = {}) {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    orderId: row.order_id || '',
    score: Number(row.score || 0),
    decision: row.decision || 'approve',
    reasons: safeJson(row.reasons_json, []),
    signals: safeJson(row.signals_json, {}),
    createdAt: row.created_at || ''
  };
}

function safeJson(raw, fallback) {
  try { return JSON.parse(raw || JSON.stringify(fallback)); } catch { return fallback; }
}
