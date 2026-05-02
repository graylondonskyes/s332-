const { addRecord, listRecords, updateRecord } = require('./_shared/ae_runtime_db');
const { appendAuditEvent, writeUsageEvent } = require('./_shared/ae_state');

const ALLOWED_STATUS = new Set(['prospect', 'active', 'inactive', 'churned']);

function json(statusCode, payload) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) };
}

function parseBody(event = {}) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return {};
  }
}

function readString(value) {
  return String(value ?? '').trim();
}

function normalizeStatus(value, fallback = 'prospect') {
  const normalized = readString(value).toLowerCase();
  return ALLOWED_STATUS.has(normalized) ? normalized : fallback;
}

function normalizeEmail(value) {
  return readString(value).toLowerCase();
}

function filterClients(clients, query = {}) {
  const status = normalizeStatus(query.status, '');
  const hasStatusFilter = readString(query.status).length > 0;
  const search = readString(query.search).toLowerCase();

  return clients.filter((client) => {
    if (hasStatusFilter && client.status !== status) return false;
    if (!search) return true;
    return [client.name, client.email, client.company].some((field) => readString(field).toLowerCase().includes(search));
  });
}

module.exports.handler = async (event = {}) => {
  const method = readString(event.httpMethod || 'GET').toUpperCase();

  if (method === 'GET') {
    const query = event.queryStringParameters || {};
    const clients = filterClients(listRecords('clients'), query);
    await writeUsageEvent({ route: 'ae-clients', action: 'list_clients', actorId: 'ae-system', detail: { returned: clients.length, status: readString(query.status), hasSearch: Boolean(readString(query.search)) } });
    return json(200, { ok: true, clients });
  }

  if (method === 'POST') {
    const input = parseBody(event);
    const name = readString(input.name);
    const email = normalizeEmail(input.email);
    if (!name || !email) return json(400, { ok: false, error: 'name_and_email_required' });

    const duplicate = listRecords('clients').find((client) => normalizeEmail(client.email) === email);
    if (duplicate) {
      return json(409, { ok: false, error: 'client_email_exists', clientId: duplicate.id });
    }

    const client = addRecord('clients', {
      name,
      email,
      company: readString(input.company),
      ownerAeId: readString(input.ownerAeId),
      tags: Array.isArray(input.tags) ? input.tags.map((tag) => readString(tag)).filter(Boolean) : [],
      notes: readString(input.notes),
      status: normalizeStatus(input.status)
    });

    await writeUsageEvent({ route: 'ae-clients', action: 'create_client', actorId: 'ae-system', detail: { clientId: client.id } });
    await appendAuditEvent({ action: 'ae_client_created', actorId: 'ae-system', actorType: 'system', resource: client.id, outcome: 'ok', detail: { email: client.email, status: client.status } });
    return json(201, { ok: true, client });
  }

  if (method === 'PATCH') {
    const input = parseBody(event);
    const clientId = readString(input.id || input.clientId);
    if (!clientId) return json(400, { ok: false, error: 'client_id_required' });

    const existing = listRecords('clients').find((client) => client.id === clientId);
    if (!existing) return json(404, { ok: false, error: 'client_not_found' });

    const nextEmail = input.email ? normalizeEmail(input.email) : existing.email;
    if (nextEmail !== existing.email) {
      const collision = listRecords('clients').find((client) => client.id !== clientId && normalizeEmail(client.email) === nextEmail);
      if (collision) {
        return json(409, { ok: false, error: 'client_email_exists', clientId: collision.id });
      }
    }

    const patch = {
      name: input.name ? readString(input.name) : existing.name,
      email: nextEmail,
      company: input.company !== undefined ? readString(input.company) : (existing.company || ''),
      ownerAeId: input.ownerAeId !== undefined ? readString(input.ownerAeId) : (existing.ownerAeId || ''),
      notes: input.notes !== undefined ? readString(input.notes) : (existing.notes || ''),
      status: input.status ? normalizeStatus(input.status, existing.status || 'prospect') : (existing.status || 'prospect'),
      tags: Array.isArray(input.tags) ? input.tags.map((tag) => readString(tag)).filter(Boolean) : (existing.tags || [])
    };

    const updated = updateRecord('clients', clientId, patch);
    await writeUsageEvent({ route: 'ae-clients', action: 'update_client', actorId: 'ae-system', detail: { clientId } });
    await appendAuditEvent({ action: 'ae_client_updated', actorId: 'ae-system', actorType: 'system', resource: clientId, outcome: 'ok', detail: { status: updated.status } });
    return json(200, { ok: true, client: updated });
  }

  return json(405, { ok: false, error: 'method_not_allowed' });
};
