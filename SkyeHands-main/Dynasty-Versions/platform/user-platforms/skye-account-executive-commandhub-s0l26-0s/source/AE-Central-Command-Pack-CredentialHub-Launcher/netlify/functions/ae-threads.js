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
    const clientId = event?.queryStringParameters?.clientId;
    const status = event?.queryStringParameters?.status;
    const threads = listRecords('threads', (row) => {
      if (clientId && row.clientId !== clientId) return false;
      if (status && row.status !== status) return false;
      return true;
    });
    await writeUsageEvent({ route: 'ae-threads', action: 'list_threads', detail: { clientId, status, returned: threads.length } });
    return json(200, { ok: true, count: threads.length, threads });
  }

  if (method === 'POST') {
    const input = body(event);
    if (!input.clientId || !input.subject) return json(400, { ok: false, error: 'clientId_and_subject_required' });

    const thread = addRecord('threads', {
      clientId: String(input.clientId),
      subject: String(input.subject),
      status: String(input.status || 'open'),
      priority: String(input.priority || 'normal')
    });

    await writeUsageEvent({ route: 'ae-threads', action: 'create_thread', detail: { threadId: thread.id, clientId: thread.clientId } });
    await appendAuditEvent({ action: 'ae_thread_created', resource: thread.id, detail: { clientId: thread.clientId, priority: thread.priority } });
    return json(201, { ok: true, thread });
  }

  if (method === 'PATCH') {
    const input = body(event);
    if (!input.id) return json(400, { ok: false, error: 'id_required' });

    const nextPatch = {};
    if (input.subject !== undefined) nextPatch.subject = String(input.subject || '');
    if (input.status !== undefined) nextPatch.status = String(input.status || 'open');
    if (input.priority !== undefined) nextPatch.priority = String(input.priority || 'normal');

    const updated = updateRecord('threads', String(input.id), nextPatch);
    if (!updated) return json(404, { ok: false, error: 'thread_not_found' });

    await writeUsageEvent({ route: 'ae-threads', action: 'update_thread', detail: { threadId: updated.id, status: updated.status } });
    await appendAuditEvent({ action: 'ae_thread_updated', resource: updated.id, detail: { status: updated.status, priority: updated.priority } });
    return json(200, { ok: true, thread: updated });
  }

  return json(405, { ok: false, error: 'method_not_allowed' });
};
