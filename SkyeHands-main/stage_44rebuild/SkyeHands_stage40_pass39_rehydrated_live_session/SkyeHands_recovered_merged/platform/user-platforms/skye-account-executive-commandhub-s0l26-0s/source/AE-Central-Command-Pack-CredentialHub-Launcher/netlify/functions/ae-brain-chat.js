const { callAeBrain } = require('./_shared/ae_brain');
const { executeProviderAction } = require('./_shared/ae_providers');
const { writeUsageEvent, appendAuditEvent } = require('./_shared/ae_state');

function json(statusCode, payload) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) };
}

function parseBody(event = {}) {
  try { return JSON.parse(event.body || '{}'); } catch { return {}; }
}

module.exports.handler = async (event = {}) => {
  if (event.httpMethod && event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'method_not_allowed' });
  }

  const body = parseBody(event);
  const provider = String(body.provider || 'openai').toLowerCase();
  const providerResult = await executeProviderAction(provider, {
    model: body.model,
    input: body.message,
    sku: body.sku,
    quantity: body.quantity,
    eventTypeUri: body.eventTypeUri,
    inviteeEmail: body.inviteeEmail
  });

  if (!providerResult.ok) {
    await appendAuditEvent({
      actorId: 'ae-brain-chat',
      actorType: 'system',
      action: 'ae_provider_contract_failed',
      resource: provider,
      outcome: 'denied',
      detail: { errors: providerResult.errors }
    });
    return json(422, { ok: false, error: 'provider_contract_violation', detail: providerResult.errors });
  }

  const ai = await callAeBrain({
    message: body.message,
    context: body.context || {},
    model: body.model || 'gpt-4.1-mini'
  });

  await writeUsageEvent({ route: 'ae-brain-chat', action: 'chat', actorId: String(body.actorId || 'unknown'), tenantId: String(body.tenantId || 'ae-commandhub'), detail: { provider } });
  await appendAuditEvent({
    actorId: String(body.actorId || 'unknown'),
    actorType: 'user',
    action: 'ae_brain_chat_executed',
    resource: provider,
    outcome: 'ok',
    detail: { executionId: providerResult.executionId }
  });

  return json(200, {
    ok: true,
    provider: providerResult,
    response: ai
  });
};
