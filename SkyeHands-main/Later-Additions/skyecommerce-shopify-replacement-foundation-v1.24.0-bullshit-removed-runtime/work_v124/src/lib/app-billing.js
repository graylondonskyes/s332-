function safeJson(value, fallback) {
  if (Array.isArray(value) || (value && typeof value === 'object')) return value;
  try { return JSON.parse(value || ''); } catch { return fallback; }
}
const text = (value = '') => String(value || '').trim();
const cents = (value = 0) => Math.max(0, Math.trunc(Number(value || 0) || 0));
const bool = (value, fallback = true) => value === undefined || value === null || value === '' ? fallback : value === true || value === 'true' || value === 1 || value === '1';

export function normalizeAppBillingPlanInput(input = {}) {
  const name = text(input.name || 'App billing plan').slice(0, 120);
  const code = text(input.code || input.slug || name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'app_plan';
  return {
    appId: text(input.appId || input.app_id),
    code,
    name,
    billingType: ['free', 'recurring', 'usage', 'hybrid'].includes(text(input.billingType || input.billing_type).toLowerCase()) ? text(input.billingType || input.billing_type).toLowerCase() : 'recurring',
    amountCents: cents(input.amountCents ?? input.amount_cents),
    usageUnit: text(input.usageUnit || input.usage_unit || 'event').slice(0, 80),
    usageCents: cents(input.usageCents ?? input.usage_cents),
    intervalUnit: ['day', 'week', 'month', 'year'].includes(text(input.intervalUnit || input.interval_unit).toLowerCase()) ? text(input.intervalUnit || input.interval_unit).toLowerCase() : 'month',
    trialDays: Math.max(0, Math.trunc(Number(input.trialDays ?? input.trial_days ?? 0) || 0)),
    active: bool(input.active, true)
  };
}

export function appBillingPlanRecord(row = {}) {
  return {
    id: row.id || '',
    merchantId: row.merchant_id || row.merchantId || '',
    appId: row.app_id || row.appId || '',
    code: row.code || '',
    name: row.name || '',
    billingType: row.billing_type || row.billingType || 'recurring',
    amountCents: Number(row.amount_cents ?? row.amountCents ?? 0),
    usageUnit: row.usage_unit || row.usageUnit || 'event',
    usageCents: Number(row.usage_cents ?? row.usageCents ?? 0),
    intervalUnit: row.interval_unit || row.intervalUnit || 'month',
    trialDays: Number(row.trial_days ?? row.trialDays ?? 0),
    active: Boolean(Number(row.active ?? 1)),
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

export function normalizeAppBillingSubscriptionInput(input = {}, plan = {}) {
  const now = new Date();
  const periodEnd = new Date(now);
  const interval = plan.intervalUnit || plan.interval_unit || 'month';
  if (interval === 'year') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else if (interval === 'week') periodEnd.setDate(periodEnd.getDate() + 7);
  else if (interval === 'day') periodEnd.setDate(periodEnd.getDate() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 1);
  return {
    installationId: text(input.installationId || input.installation_id),
    planId: text(input.planId || input.plan_id || plan.id),
    status: ['trialing', 'active', 'past_due', 'canceled'].includes(text(input.status).toLowerCase()) ? text(input.status).toLowerCase() : (Number(plan.trialDays || plan.trial_days || 0) > 0 ? 'trialing' : 'active'),
    currentPeriodStart: input.currentPeriodStart || input.current_period_start || now.toISOString(),
    currentPeriodEnd: input.currentPeriodEnd || input.current_period_end || periodEnd.toISOString(),
    externalProvider: text(input.externalProvider || input.external_provider || 'internal'),
    externalRef: text(input.externalRef || input.external_ref)
  };
}

export function appBillingSubscriptionRecord(row = {}, plan = null) {
  return {
    id: row.id || '',
    merchantId: row.merchant_id || row.merchantId || '',
    installationId: row.installation_id || row.installationId || '',
    planId: row.plan_id || row.planId || '',
    plan: plan ? appBillingPlanRecord(plan) : null,
    status: row.status || 'active',
    currentPeriodStart: row.current_period_start || row.currentPeriodStart || '',
    currentPeriodEnd: row.current_period_end || row.currentPeriodEnd || '',
    externalProvider: row.external_provider || row.externalProvider || 'internal',
    externalRef: row.external_ref || row.externalRef || '',
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

export function normalizeAppUsageEventInput(input = {}, plan = {}) {
  const quantity = Math.max(1, Math.trunc(Number(input.quantity || 1) || 1));
  const unitCents = cents(input.unitCents ?? input.unit_cents ?? plan.usageCents ?? plan.usage_cents ?? 0);
  return {
    subscriptionId: text(input.subscriptionId || input.subscription_id),
    metricKey: text(input.metricKey || input.metric_key || plan.usageUnit || plan.usage_unit || 'event').toLowerCase().replace(/[^a-z0-9:_-]/g, '_'),
    quantity,
    unitCents,
    totalCents: quantity * unitCents,
    idempotencyKey: text(input.idempotencyKey || input.idempotency_key),
    meta: input.meta && typeof input.meta === 'object' ? input.meta : safeJson(input.meta_json || input.metaJson, {})
  };
}

export function appUsageEventRecord(row = {}) {
  return {
    id: row.id || '',
    merchantId: row.merchant_id || row.merchantId || '',
    subscriptionId: row.subscription_id || row.subscriptionId || '',
    metricKey: row.metric_key || row.metricKey || 'event',
    quantity: Number(row.quantity || 0),
    unitCents: Number(row.unit_cents ?? row.unitCents ?? 0),
    totalCents: Number(row.total_cents ?? row.totalCents ?? 0),
    idempotencyKey: row.idempotency_key || row.idempotencyKey || '',
    meta: safeJson(row.meta_json || row.metaJson, {}),
    createdAt: row.created_at || row.createdAt || ''
  };
}

export function buildAppBillingInvoice({ subscription = {}, plan = {}, usageEvents = [] } = {}) {
  const baseCents = ['recurring', 'hybrid'].includes(plan.billingType || plan.billing_type) ? Number(plan.amountCents ?? plan.amount_cents ?? 0) : 0;
  const usageCents = usageEvents.reduce((sum, event) => sum + Number(event.totalCents ?? event.total_cents ?? 0), 0);
  return {
    subscriptionId: subscription.id || subscription.subscriptionId || '',
    planId: plan.id || subscription.planId || subscription.plan_id || '',
    currency: 'USD',
    baseCents,
    usageCents,
    totalCents: baseCents + usageCents,
    lineItems: [
      baseCents ? { type: 'recurring', label: plan.name || 'Recurring app charge', amountCents: baseCents } : null,
      ...usageEvents.map((event) => ({ type: 'usage', label: event.metricKey || event.metric_key || 'usage', quantity: Number(event.quantity || 0), amountCents: Number(event.totalCents ?? event.total_cents ?? 0) }))
    ].filter(Boolean)
  };
}

export function appBillingInvoiceRecord(row = {}) {
  return {
    id: row.id || '',
    merchantId: row.merchant_id || row.merchantId || '',
    subscriptionId: row.subscription_id || row.subscriptionId || '',
    status: row.status || 'open',
    currency: row.currency || 'USD',
    baseCents: Number(row.base_cents ?? row.baseCents ?? 0),
    usageCents: Number(row.usage_cents ?? row.usageCents ?? 0),
    totalCents: Number(row.total_cents ?? row.totalCents ?? 0),
    lineItems: safeJson(row.line_items_json || row.lineItemsJson, []),
    createdAt: row.created_at || row.createdAt || '',
    paidAt: row.paid_at || row.paidAt || null
  };
}
