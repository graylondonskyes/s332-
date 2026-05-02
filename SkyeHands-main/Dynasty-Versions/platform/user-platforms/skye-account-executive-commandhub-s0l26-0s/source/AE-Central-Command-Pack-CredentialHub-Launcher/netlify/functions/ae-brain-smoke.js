const clients = require('./ae-clients');
const tasks = require('./ae-tasks');
const assignments = require('./ae-assignments');
const threads = require('./ae-threads');
const messages = require('./ae-messages');
const { executeProviderAction, executeWithFailover } = require('./_shared/ae_providers');
const { upsertSmokeReport } = require('./_shared/ae_state');

function parse(result) { try { return JSON.parse(result.body || '{}'); } catch { return {}; } }
function json(statusCode, payload) { return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }; }

module.exports.handler = async () => {
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'openai-smoke-key';
  process.env.CALENDLY_TOKEN = process.env.CALENDLY_TOKEN || 'calendly-smoke-token';
  process.env.PRINTFUL_API_TOKEN = process.env.PRINTFUL_API_TOKEN || 'printful-smoke-token';
  process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'anthropic-smoke-token';
  process.env.AE_PROVIDERS_DRY_RUN = process.env.AE_PROVIDERS_DRY_RUN || '1';

  const smokeId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const clientRes = parse(await clients.handler({ httpMethod: 'POST', body: JSON.stringify({ name: 'Runtime Client', email: `runtime-client-${smokeId}@example.com` }) }));
  if (!clientRes.ok || !clientRes.client?.id) {
    const report = await upsertSmokeReport({
      suite: 'ae-brain-runtime',
      status: 'FAIL',
      summary: { failedStep: 'create_client', clientRes }
    });
    return json(500, { ok: false, error: 'client_create_failed', report });
  }
  const taskRes = parse(await tasks.handler({ httpMethod: 'POST', body: JSON.stringify({ clientId: clientRes.client.id, title: 'CommandHub lifecycle' }) }));
  const promisedRes = parse(await tasks.handler({ httpMethod: 'PATCH', body: JSON.stringify({ taskId: taskRes.task.id, action: 'promise' }) }));
  const churnedRes = parse(await tasks.handler({ httpMethod: 'PATCH', body: JSON.stringify({ taskId: taskRes.task.id, action: 'churn' }) }));
  const reactivatedRes = parse(await tasks.handler({ httpMethod: 'PATCH', body: JSON.stringify({ taskId: taskRes.task.id, action: 'reactivation' }) }));
  const sweptRes = parse(await tasks.handler({ httpMethod: 'PATCH', body: JSON.stringify({ taskId: taskRes.task.id, action: 'sweep' }) }));

  const assignRes = parse(await assignments.handler({ httpMethod: 'POST', body: JSON.stringify({ taskId: taskRes.task.id, aeId: 'ae-founder' }) }));
  const threadRes = parse(await threads.handler({ httpMethod: 'POST', body: JSON.stringify({ clientId: clientRes.client.id, subject: 'Appointment + Commerce' }) }));
  const msgRes = parse(await messages.handler({ httpMethod: 'POST', body: JSON.stringify({ threadId: threadRes.thread.id, author: 'system', content: 'Ready for booking and commerce.' }) }));

  const appointment = await executeProviderAction('calendly', { eventTypeUri: 'evt_001', inviteeEmail: clientRes.client.email });
  const commerce = await executeProviderAction('printful', { sku: 'SKU-AE-1', quantity: 2 });

  const outageRecovery = await executeWithFailover('offline-provider', ['anthropic', 'gemini'], { model: 'claude-3-5-sonnet-latest', input: 'fallback test' });

  const pass = Boolean(
    clientRes.ok
    && taskRes.ok
    && promisedRes.task?.state === 'promised'
    && churnedRes.task?.state === 'churned'
    && reactivatedRes.task?.state === 'reactivated'
    && sweptRes.task?.state === 'swept'
    && assignRes.ok
    && threadRes.ok
    && msgRes.ok
    && appointment.ok
    && commerce.ok
    && outageRecovery.ok
    && outageRecovery.selectedProvider === 'anthropic'
  );

  const report = await upsertSmokeReport({
    suite: 'ae-brain-runtime',
    status: pass ? 'PASS' : 'FAIL',
    summary: {
      clientId: clientRes.client?.id,
      taskId: taskRes.task?.id,
      threadId: threadRes.thread?.id,
      outageRecovery
    }
  });

  return json(pass ? 200 : 500, { ok: pass, report });
};
