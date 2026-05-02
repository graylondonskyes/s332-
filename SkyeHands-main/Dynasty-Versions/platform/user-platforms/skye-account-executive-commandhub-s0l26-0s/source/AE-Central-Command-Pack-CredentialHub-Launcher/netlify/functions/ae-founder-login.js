const crypto = require('node:crypto');
const { createSession } = require('./_shared/ae_auth');
const { appendAuditEvent, writeUsageEvent } = require('./_shared/ae_state');

function json(statusCode, payload) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) };
}

function parseBody(event = {}) {
  try { return JSON.parse(event.body || '{}'); } catch { return {}; }
}

function hashPassword(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

module.exports.handler = async (event = {}) => {
  if (event.httpMethod && event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'method_not_allowed' });
  }

  const body = parseBody(event);
  const expectedEmail = String(process.env.AE_FOUNDER_EMAIL || 'founder@skyehands.local').trim().toLowerCase();
  const expectedPasswordHash = String(process.env.AE_FOUNDER_PASSWORD_HASH || hashPassword(process.env.AE_FOUNDER_PASSWORD || 'change-me-now')).trim();
  const suppliedEmail = String(body.email || '').trim().toLowerCase();
  const suppliedPasswordHash = hashPassword(body.password || '');

  if (!suppliedEmail || !body.password) {
    return json(400, { ok: false, error: 'invalid_credentials_payload' });
  }
  if (suppliedEmail !== expectedEmail || suppliedPasswordHash !== expectedPasswordHash) {
    await appendAuditEvent({
      actorId: suppliedEmail || 'unknown',
      actorType: 'user',
      action: 'ae_founder_login_failed',
      resource: 'ae_founder_session',
      outcome: 'denied',
      detail: { reason: 'invalid_credentials' }
    });
    return json(401, { ok: false, error: 'invalid_credentials' });
  }

  const session = createSession({
    userId: 'founder',
    role: 'founder',
    email: suppliedEmail,
    tenantId: 'ae-commandhub',
    ttlHours: 12
  });

  await writeUsageEvent({ route: 'ae-founder-login', action: 'login', actorId: 'founder', tenantId: 'ae-commandhub' });
  await appendAuditEvent({
    actorId: 'founder',
    actorType: 'user',
    action: 'ae_founder_login_success',
    resource: 'ae_founder_session',
    outcome: 'ok',
    detail: { sessionId: session.payload.sessionId }
  });

  return json(200, {
    ok: true,
    accessToken: session.token,
    session: session.payload,
    user: { id: 'founder', email: suppliedEmail, role: 'founder' }
  });
};
