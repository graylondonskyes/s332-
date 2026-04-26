function normalizedText(value = '') {
  return String(value || '').trim();
}

function boolish(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  return value === true || value === 'true' || value === '1' || value === 1;
}

export function taxNexusRuleRecord(row = {}) {
  return {
    id: row.id || '',
    merchantId: row.merchant_id || row.merchantId || '',
    label: row.label || '',
    countryCode: normalizedText(row.country_code || row.countryCode || 'US').toUpperCase(),
    stateCode: normalizedText(row.state_code || row.stateCode || '').toUpperCase(),
    thresholdCents: Number(row.threshold_cents ?? row.thresholdCents ?? 0),
    thresholdOrders: Number(row.threshold_orders ?? row.thresholdOrders ?? 0),
    active: Boolean(Number(row.active ?? (row.active === false ? 0 : 1))),
    createdAt: row.created_at || row.createdAt || ''
  };
}

export function nexusRollupRecord(row = {}) {
  return {
    merchantId: row.merchant_id || row.merchantId || '',
    countryCode: normalizedText(row.country_code || row.countryCode || 'US').toUpperCase(),
    stateCode: normalizedText(row.state_code || row.stateCode || '').toUpperCase(),
    orderCount: Number(row.order_count ?? row.orderCount ?? 0),
    grossCents: Number(row.gross_cents ?? row.grossCents ?? 0),
    thresholdMet: Boolean(Number(row.threshold_met ?? row.thresholdMet ?? 0)),
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

export function normalizeTaxNexusRuleInput(body = {}) {
  return {
    label: normalizedText(body.label || 'Economic nexus'),
    countryCode: normalizedText(body.countryCode || body.country_code || 'US').toUpperCase(),
    stateCode: normalizedText(body.stateCode || body.state_code || '').toUpperCase(),
    thresholdCents: Math.max(0, Number(body.thresholdCents ?? body.threshold_cents ?? 0) || 0),
    thresholdOrders: Math.max(0, Number(body.thresholdOrders ?? body.threshold_orders ?? 0) || 0),
    active: boolish(body.active, true)
  };
}

export function applyOrderToNexusRollup(current = {}, order = {}, rule = null) {
  const baseline = nexusRollupRecord(current);
  const orderCount = baseline.orderCount + 1;
  const grossCents = baseline.grossCents + Math.max(0, Number(order.totalCents ?? order.total_cents ?? 0) || 0);
  const thresholdMet = Boolean(rule) && (
    (Number(rule.thresholdCents || 0) > 0 && grossCents >= Number(rule.thresholdCents || 0)) ||
    (Number(rule.thresholdOrders || 0) > 0 && orderCount >= Number(rule.thresholdOrders || 0))
  );
  return {
    orderCount,
    grossCents,
    thresholdMet: baseline.thresholdMet || thresholdMet
  };
}
