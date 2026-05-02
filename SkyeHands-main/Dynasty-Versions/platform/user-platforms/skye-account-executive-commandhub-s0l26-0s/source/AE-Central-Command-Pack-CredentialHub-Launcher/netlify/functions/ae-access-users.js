const { listRecords, addRecord, updateRecord } = require('./_shared/ae_runtime_db');
const { appendAuditEvent, writeUsageEvent } = require('./_shared/ae_state');

const ALLOWED_ROLES = new Set(['viewer', 'editor', 'manager', 'admin']);
const ALLOWED_STATUS = new Set(['pending', 'active', 'suspended', 'revoked']);

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

function normalizeEmail(value) {
  return readString(value).toLowerCase();
}

function normalizeRole(value, fallback = 'viewer') {
  const normalized = readString(value).toLowerCase();
  return ALLOWED_ROLES.has(normalized) ? normalized : fallback;
}

function normalizeStatus(value, fallback = 'active') {
  const normalized = readString(value).toLowerCase();
  return ALLOWED_STATUS.has(normalized) ? normalized : fallback;
}

function toAccessUser(client = {}) {
  return {
    id: client.id,
    name: readString(client.name),
    email: normalizeEmail(client.email),
    role: normalizeRole(client.role || client.accessRole || 'viewer'),
    status: normalizeStatus(client.status || 'active'),
    invitedBy: readString(client.invitedBy),
    lastGrantedAt: client.lastGrantedAt || null,
    lastRevokedAt: client.lastRevokedAt || null,
    updatedAt: client.updatedAt || client.createdAt || null
  };
}

function findUserByIdOrEmail({ userId = '', email = '' }) {
  const users = listRecords('clients');
  if (userId) return users.find((user) => user.id === userId) || null;
  if (email) return users.find((user) => normalizeEmail(user.email) === email) || null;
  return null;
}

module.exports.handler = async (event = {}) => {
  const method = readString(event.httpMethod || 'GET').toUpperCase();

  if (method === 'GET') {
    const query = event.queryStringParameters || {};
    const role = normalizeRole(query.role, '');
    const hasRoleFilter = readString(query.role).length > 0;
    const status = normalizeStatus(query.status, '');
    const hasStatusFilter = readString(query.status).length > 0;

    const users = listRecords('clients')
      .map(toAccessUser)
      .filter((user) => {
        if (hasRoleFilter && user.role !== role) return false;
        if (hasStatusFilter && user.status !== status) return false;
        return true;
      });

    await writeUsageEvent({ route: 'ae-access-users', action: 'list_access_users', detail: { returned: users.length, role: hasRoleFilter ? role : '', status: hasStatusFilter ? status : '' } });
    return json(200, { ok: true, users });
  }

  if (method === 'POST') {
    const input = parseBody(event);
    const email = normalizeEmail(input.email);
    if (!email) return json(400, { ok: false, error: 'email_required' });

    const existing = findUserByIdOrEmail({ email });
    if (existing) {
      const updated = updateRecord('clients', existing.id, {
        name: readString(input.name) || existing.name,
        accessRole: normalizeRole(input.role, existing.accessRole || existing.role || 'viewer'),
        status: normalizeStatus(input.status, 'active'),
        invitedBy: readString(input.invitedBy) || existing.invitedBy || 'ae-system',
        lastGrantedAt: new Date().toISOString()
      });

      await appendAuditEvent({ action: 'ae_access_user_granted', actorId: 'ae-system', actorType: 'system', resource: updated.id, outcome: 'ok', detail: { email: updated.email, role: updated.accessRole } });
      await writeUsageEvent({ route: 'ae-access-users', action: 'grant_access_existing', detail: { userId: updated.id, role: updated.accessRole } });
      return json(200, { ok: true, user: toAccessUser(updated), reused: true });
    }

    const user = addRecord('clients', {
      name: readString(input.name) || email,
      email,
      status: normalizeStatus(input.status, 'active'),
      accessRole: normalizeRole(input.role),
      invitedBy: readString(input.invitedBy) || 'ae-system',
      lastGrantedAt: new Date().toISOString()
    });

    await appendAuditEvent({ action: 'ae_access_user_invited', actorId: 'ae-system', actorType: 'system', resource: user.id, outcome: 'ok', detail: { email: user.email, role: user.accessRole } });
    await writeUsageEvent({ route: 'ae-access-users', action: 'invite_access_user', detail: { userId: user.id, role: user.accessRole } });
    return json(201, { ok: true, user: toAccessUser(user), reused: false });
  }

  if (method === 'PATCH') {
    const input = parseBody(event);
    const userId = readString(input.id || input.userId);
    const email = normalizeEmail(input.email);
    const existing = findUserByIdOrEmail({ userId, email });
    if (!existing) return json(404, { ok: false, error: 'user_not_found' });

    const action = readString(input.action).toLowerCase();
    const nextStatus = action === 'revoke'
      ? 'revoked'
      : normalizeStatus(input.status, existing.status || 'active');

    const patch = {
      name: input.name ? readString(input.name) : existing.name,
      accessRole: input.role ? normalizeRole(input.role, existing.accessRole || 'viewer') : (existing.accessRole || 'viewer'),
      status: nextStatus,
      invitedBy: input.invitedBy ? readString(input.invitedBy) : (existing.invitedBy || 'ae-system')
    };
    if (action === 'revoke') {
      patch.lastRevokedAt = new Date().toISOString();
    }

    const updated = updateRecord('clients', existing.id, patch);
    const auditAction = action === 'revoke' ? 'ae_access_user_revoked' : 'ae_access_user_updated';

    await appendAuditEvent({ action: auditAction, actorId: 'ae-system', actorType: 'system', resource: updated.id, outcome: 'ok', detail: { status: updated.status, role: updated.accessRole } });
    await writeUsageEvent({ route: 'ae-access-users', action: action === 'revoke' ? 'revoke_access_user' : 'update_access_user', detail: { userId: updated.id, status: updated.status, role: updated.accessRole } });

    return json(200, { ok: true, user: toAccessUser(updated) });
  }

  return json(405, { ok: false, error: 'method_not_allowed' });
};
