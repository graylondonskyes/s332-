const { appendAuditEvent, listAuditEvents, writeUsageEvent } = require('./_shared/ae_state');

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload)
  };
}

function parseLimit(event = {}, fallback = 100) {
  const raw = event?.queryStringParameters?.limit;
  const parsed = Number.parseInt(String(raw ?? fallback), 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(1, Math.min(parsed, 1000));
}

module.exports.handler = async (event = {}) => {
  if (event.httpMethod === 'POST') {
    try {
      const payload = event.body ? JSON.parse(event.body) : {};
      const created = await appendAuditEvent(payload);
      await writeUsageEvent({ route: 'ae-audit-events', action: 'append_audit_event', detail: { auditId: created.id } });
      return json(201, { ok: true, auditEvent: created });
    } catch (error) {
      return json(400, { ok: false, error: error.message || 'invalid_payload' });
    }
  }

  const limit = parseLimit(event, 200);
  const events = await listAuditEvents(limit);
  await writeUsageEvent({ route: 'ae-audit-events', action: 'list_audit_events', detail: { limit, returned: events.length } });
  return json(200, events);
};
