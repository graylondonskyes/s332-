const { getSessionFromRequest, revokeSession } = require('./_shared/ae_auth');
const { appendAuditEvent, writeUsageEvent } = require('./_shared/ae_state');

function json(statusCode, payload) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) };
}

module.exports.handler = async (event = {}) => {
  const session = getSessionFromRequest(event);
  if (!session) {
    return json(401, { ok: false, error: 'unauthorized' });
  }

  const revoked = revokeSession(session.token);
  await writeUsageEvent({ route: 'ae-founder-logout', action: 'logout', actorId: session.user.id, tenantId: session.user.tenantId });
  await appendAuditEvent({
    actorId: session.user.id,
    actorType: 'user',
    action: 'ae_founder_logout',
    resource: 'ae_founder_session',
    outcome: revoked ? 'ok' : 'noop',
    detail: { sessionId: session.sessionId }
  });

  return json(200, { ok: true, revoked });
};
