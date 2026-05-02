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
    const threadId = event?.queryStringParameters?.threadId;
    const author = event?.queryStringParameters?.author;
    const messages = listRecords('messages', (item) => {
      if (threadId && item.threadId !== threadId) return false;
      if (author && item.author !== author) return false;
      return true;
    });
    await writeUsageEvent({ route: 'ae-messages', action: 'list_messages', detail: { threadId, author, returned: messages.length } });
    return json(200, { ok: true, count: messages.length, messages });
  }

  if (method === 'POST') {
    const input = body(event);
    if (!input.threadId || !input.content) return json(400, { ok: false, error: 'threadId_and_content_required' });

    const message = addRecord('messages', {
      threadId: String(input.threadId),
      author: String(input.author || 'system'),
      content: String(input.content),
      status: String(input.status || 'sent')
    });

    await writeUsageEvent({ route: 'ae-messages', action: 'create_message', detail: { messageId: message.id, threadId: message.threadId } });
    await appendAuditEvent({ action: 'ae_message_created', resource: message.id, detail: { threadId: message.threadId, author: message.author } });
    return json(201, { ok: true, message });
  }

  if (method === 'PATCH') {
    const input = body(event);
    if (!input.id) return json(400, { ok: false, error: 'id_required' });

    const patch = {};
    if (input.content !== undefined) patch.content = String(input.content || '');
    if (input.status !== undefined) patch.status = String(input.status || 'sent');

    const updated = updateRecord('messages', String(input.id), patch);
    if (!updated) return json(404, { ok: false, error: 'message_not_found' });

    await writeUsageEvent({ route: 'ae-messages', action: 'update_message', detail: { messageId: updated.id, status: updated.status } });
    await appendAuditEvent({ action: 'ae_message_updated', resource: updated.id, detail: { status: updated.status } });
    return json(200, { ok: true, message: updated });
  }

  return json(405, { ok: false, error: 'method_not_allowed' });
};
