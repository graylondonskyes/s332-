const { addRecord, listRecords, updateRecord } = require('./_shared/ae_runtime_db');
const { appendAuditEvent, writeUsageEvent } = require('./_shared/ae_state');

function json(statusCode, payload) { return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }; }
function body(event = {}) { try { return JSON.parse(event.body || '{}'); } catch { return {}; } }

const allowedActions = new Set(['promise', 'churn', 'reactivation', 'sweep']);

module.exports.handler = async (event = {}) => {
  const method = String(event.httpMethod || 'GET').toUpperCase();
  if (method === 'GET') return json(200, { ok: true, tasks: listRecords('tasks') });
  if (method === 'POST') {
    const input = body(event);
    if (!input.clientId || !input.title) return json(400, { ok: false, error: 'clientId_and_title_required' });
    const task = addRecord('tasks', { clientId: String(input.clientId), title: String(input.title), state: 'open', actionHistory: [] });
    await writeUsageEvent({ route: 'ae-tasks', action: 'create_task', actorId: 'ae-system', detail: { taskId: task.id } });
    return json(201, { ok: true, task });
  }
  if (method === 'PATCH') {
    const input = body(event);
    if (!input.taskId || !allowedActions.has(String(input.action || ''))) return json(400, { ok: false, error: 'taskId_and_valid_action_required' });
    const action = String(input.action);
    const stateMap = { promise: 'promised', churn: 'churned', reactivation: 'reactivated', sweep: 'swept' };
    const existing = listRecords('tasks').find((item) => item.id === input.taskId);
    if (!existing) return json(404, { ok: false, error: 'task_not_found' });
    const updated = updateRecord('tasks', input.taskId, {
      state: stateMap[action],
      actionHistory: [...(existing.actionHistory || []), { action, at: new Date().toISOString(), note: String(input.note || '') }]
    });
    await appendAuditEvent({ action: `ae_task_${action}`, actorId: 'ae-system', actorType: 'system', resource: input.taskId, outcome: 'ok' });
    return json(200, { ok: true, task: updated });
  }
  return json(405, { ok: false, error: 'method_not_allowed' });
};
