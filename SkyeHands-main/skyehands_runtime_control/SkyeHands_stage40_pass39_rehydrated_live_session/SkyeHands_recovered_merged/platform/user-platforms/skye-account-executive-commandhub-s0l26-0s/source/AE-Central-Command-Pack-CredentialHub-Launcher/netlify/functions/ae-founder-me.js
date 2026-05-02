const { getSessionFromRequest } = require('./_shared/ae_auth');
const { appendAuditEvent, writeUsageEvent } = require('./_shared/ae_state');

function json(statusCode, payload) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) };
}

module.exports.handler = async (event = {}) => {
  const session = getSessionFromRequest(event);
  if (!session) {
    await appendAuditEvent({
      actorId: 'anonymous',
      actorType: 'system',
      action: 'ae_founder_me_denied',
      resource: 'ae_founder_profile',
      outcome: 'denied'
    });
    return json(401, { ok: false, error: 'unauthorized' });
  }

  await writeUsageEvent({ route: 'ae-founder-me', action: 'read_profile', actorId: session.user.id, tenantId: session.user.tenantId });
  return json(200, {
    ok: true,
    user: session.user,
    session: { id: session.sessionId, expiresAt: session.expiresAt }
  });
};
