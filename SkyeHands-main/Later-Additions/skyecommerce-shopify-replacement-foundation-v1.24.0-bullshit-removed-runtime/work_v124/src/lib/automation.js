const text = (v = '') => String(v ?? '').trim();
const num = (v, f = 0) => Number.isFinite(Number(v)) ? Number(v) : f;
const bool = (v, f = false) => v === undefined || v === null || v === '' ? f : v === true || v === 'true' || v === '1' || v === 1;
const asJson = (v, f) => Array.isArray(v) || (v && typeof v === 'object') ? v : (() => { try { return JSON.parse(v || ''); } catch { return f; } })();
const key = (v = '') => text(v).toLowerCase().replace(/[^a-z0-9._:-]+/g, '_').replace(/^_+|_+$/g, '') || 'workflow';

function unique(items = []) {
  return [...new Set((Array.isArray(items) ? items : []).map((item) => text(item)).filter(Boolean))];
}

function readPath(source = {}, path = '') {
  return text(path).split('.').filter(Boolean).reduce((current, part) => current && current[part] !== undefined ? current[part] : undefined, source);
}

function normalizeCondition(condition = {}) {
  if (typeof condition === 'string') return { field: condition, operator: 'exists', value: true };
  return {
    field: text(condition.field || condition.path),
    operator: key(condition.operator || condition.op || 'eq'),
    value: condition.value
  };
}

function normalizeConditions(input) {
  if (Array.isArray(input)) return input.map(normalizeCondition).filter((condition) => condition.field);
  if (input && typeof input === 'object') {
    return Object.entries(input).map(([field, value]) => {
      const match = field.match(/^(.*)_(eq|neq|gte|lte|gt|lt|contains|exists)$/i);
      return normalizeCondition({ field: match ? match[1] : field, operator: match ? match[2] : 'eq', value });
    }).filter((condition) => condition.field);
  }
  return [];
}

export function normalizeWorkflowAction(action = {}) {
  return {
    type: key(action.type || 'queue_notification'),
    target: text(action.target || action.event || action.queue || ''),
    templateKey: text(action.templateKey || action.template_key || ''),
    subject: text(action.subject || ''),
    bodyText: text(action.bodyText || action.body_text || action.body || ''),
    payload: asJson(action.payload, action.payload || {}),
    note: text(action.note || '')
  };
}

export function normalizeWorkflowRuleInput(body = {}, existing = {}) {
  const name = text(body.name || existing.name || 'Automation rule');
  return {
    key: key(body.key || body.ruleKey || existing.key || existing.ruleKey || name),
    name,
    triggerEvent: key(body.triggerEvent || body.trigger_event || existing.triggerEvent || existing.trigger_event || 'order.created'),
    conditions: normalizeConditions(body.conditions ?? existing.conditions ?? existing.conditions_json ?? []),
    actions: asJson(body.actions, body.actions || existing.actions || existing.actions_json || []).map(normalizeWorkflowAction).filter((action) => action.type),
    active: bool(body.active, existing.active ?? true)
  };
}

export function workflowRuleRecord(row) {
  if (!row) return null;
  let conditions = Array.isArray(row.conditions) ? row.conditions : [];
  let actions = Array.isArray(row.actions) ? row.actions : [];
  if (!conditions.length) try { conditions = JSON.parse(row.conditions_json || row.conditions || '[]'); } catch {}
  if (!actions.length) try { actions = JSON.parse(row.actions_json || row.actions || '[]'); } catch {}
  return {
    id: row.id || '',
    merchantId: row.merchant_id || row.merchantId || '',
    key: row.rule_key || row.key || '',
    name: row.name || '',
    triggerEvent: row.trigger_event || row.triggerEvent || '',
    conditions: normalizeConditions(conditions),
    actions: actions.map(normalizeWorkflowAction),
    active: Boolean(Number(row.active ?? 1)),
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

export function renderTemplate(template = '', payload = {}) {
  return text(template).replace(/\{\{\s*([a-zA-Z0-9_.:-]+)\s*\}\}/g, (_, path) => {
    const value = readPath(payload, path);
    return value === undefined || value === null ? '' : String(value);
  });
}

export function matchWorkflowCondition(condition = {}, payload = {}) {
  const actual = readPath(payload, condition.field);
  const expected = condition.value;
  const operator = key(condition.operator || 'eq');
  if (operator === 'exists') return actual !== undefined && actual !== null && actual !== '';
  if (operator === 'neq') return String(actual) !== String(expected);
  if (operator === 'gte') return num(actual) >= num(expected);
  if (operator === 'lte') return num(actual) <= num(expected);
  if (operator === 'gt') return num(actual) > num(expected);
  if (operator === 'lt') return num(actual) < num(expected);
  if (operator === 'contains') return String(actual || '').toLowerCase().includes(String(expected || '').toLowerCase());
  return String(actual) === String(expected);
}

export function evaluateWorkflowRule(rule = {}, event = {}) {
  const normalized = workflowRuleRecord(rule) || normalizeWorkflowRuleInput(rule);
  const eventType = key(event.eventType || event.type || event.triggerEvent || '');
  if (!normalized.active) return { matched: false, status: 'inactive', reason: 'rule_inactive', actions: [] };
  if (eventType && normalized.triggerEvent !== eventType) return { matched: false, status: 'skipped', reason: 'trigger_mismatch', actions: [] };
  const payload = event.payload || event;
  const failed = (normalized.conditions || []).find((condition) => !matchWorkflowCondition(condition, payload));
  if (failed) return { matched: false, status: 'skipped', reason: 'condition_failed', failedCondition: failed, actions: [] };
  const actions = (normalized.actions || []).map((action) => ({
    ...action,
    subject: renderTemplate(action.subject, payload),
    bodyText: renderTemplate(action.bodyText, payload),
    payload: Object.fromEntries(Object.entries(action.payload || {}).map(([k, v]) => [k, typeof v === 'string' ? renderTemplate(v, payload) : v]))
  }));
  return { matched: true, status: 'matched', reason: 'matched', actions };
}

export function workflowRunRecord(row) {
  if (!row) return null;
  let actions = [];
  let result = {};
  try { actions = JSON.parse(row.actions_json || row.actions || '[]'); } catch {}
  try { result = JSON.parse(row.result_json || row.result || '{}'); } catch {}
  return {
    id: row.id || '',
    merchantId: row.merchant_id || row.merchantId || '',
    ruleId: row.rule_id || row.ruleId || '',
    eventType: row.event_type || row.eventType || '',
    eventRef: row.event_ref || row.eventRef || '',
    status: row.status || 'skipped',
    matched: Boolean(Number(row.matched ?? 0)),
    actions,
    result,
    createdAt: row.created_at || row.createdAt || ''
  };
}

export function buildAutomationActionEffects(actions = []) {
  const normalized = (Array.isArray(actions) ? actions : []).map(normalizeWorkflowAction);
  return {
    notificationCount: normalized.filter((action) => action.type === 'queue_notification').length,
    webhookCount: normalized.filter((action) => action.type === 'queue_webhook').length,
    orderHoldCount: normalized.filter((action) => action.type === 'hold_order').length,
    taskCount: normalized.filter((action) => action.type === 'create_task').length,
    tags: unique(normalized.filter((action) => action.type === 'tag_customer').map((action) => action.target || action.payload?.tag))
  };
}
