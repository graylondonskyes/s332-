const { addRecord, listRecords, updateRecord } = require('./_shared/ae_runtime_db');
const { appendAuditEvent, writeUsageEvent } = require('./_shared/ae_state');

function json(statusCode, payload) {
  return { statusCode, headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(payload) };
}

function body(event = {}) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return {};
  }
}

module.exports.handler = async (event = {}) => {
  const method = String(event.httpMethod || 'GET').toUpperCase();

  if (method === 'GET') {
    const taskId = event?.queryStringParameters?.taskId;
    const aeId = event?.queryStringParameters?.aeId;
    const status = event?.queryStringParameters?.status;
    const assignments = listRecords('assignments', (row) => {
      if (taskId && row.taskId !== taskId) return false;
      if (aeId && row.aeId !== aeId) return false;
      if (status && row.status !== status) return false;
      return true;
    });
    await writeUsageEvent({ route: 'ae-assignments', action: 'list_assignments', detail: { returned: assignments.length, taskId, aeId, status } });
    return json(200, { ok: true, count: assignments.length, assignments });
  }

  if (method === 'POST') {
    const input = body(event);
    if (!input.taskId || !input.aeId) return json(400, { ok: false, error: 'taskId_and_aeId_required' });

    const assignment = addRecord('assignments', {
      taskId: String(input.taskId),
      aeId: String(input.aeId),
      status: String(input.status || 'active'),
      notes: String(input.notes || '')
    });

    await writeUsageEvent({ route: 'ae-assignments', action: 'create_assignment', detail: { assignmentId: assignment.id } });
    await appendAuditEvent({ action: 'ae_assignment_created', resource: assignment.id, detail: { taskId: assignment.taskId, aeId: assignment.aeId } });
    return json(201, { ok: true, assignment });
  }

  if (method === 'PATCH') {
    const input = body(event);
    if (!input.id) return json(400, { ok: false, error: 'id_required' });

    const updated = updateRecord('assignments', String(input.id), {
      status: input.status ? String(input.status) : undefined,
      notes: input.notes !== undefined ? String(input.notes || '') : undefined
    });

    if (!updated) return json(404, { ok: false, error: 'assignment_not_found' });

    await writeUsageEvent({ route: 'ae-assignments', action: 'update_assignment', detail: { assignmentId: updated.id } });
    await appendAuditEvent({ action: 'ae_assignment_updated', resource: updated.id, detail: { status: updated.status } });
    return json(200, { ok: true, assignment: updated });
  }

  return json(405, { ok: false, error: 'method_not_allowed' });
};
