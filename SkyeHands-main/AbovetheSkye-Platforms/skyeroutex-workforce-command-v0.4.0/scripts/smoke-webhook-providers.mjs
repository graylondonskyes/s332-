import crypto from 'crypto';
import http from 'http';
import { createPlatformServices } from '../src/adapters/platform-services.js';
import { blankDb } from '../src/adapters/workforce-db.js';

const secret = 'webhook-smoke-signing-secret-123';
const received = [];

function verifySignature(req, rawBody) {
  const timestamp = req.headers['x-skyeroutex-timestamp'];
  const signature = req.headers['x-skyeroutex-signature'];
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`;
  return signature === expected;
}

const receiver = http.createServer(async (req, res) => {
  let rawBody = '';
  for await (const chunk of req) rawBody += chunk;
  const signed = verifySignature(req, rawBody);
  received.push({
    signed,
    provider_kind: req.headers['x-skyeroutex-provider-kind'],
    driver: req.headers['x-skyeroutex-driver'],
    body: JSON.parse(rawBody)
  });
  res.writeHead(signed ? 204 : 401);
  res.end();
});

function listen(server) {
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

function waitFor(count) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (received.length >= count) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - started > 4000) {
        clearInterval(timer);
        reject(new Error(`Timed out waiting for ${count} signed webhook deliveries; got ${received.length}.`));
      }
    }, 25);
  });
}

function assert(cond, msg, data) {
  if (!cond) {
    const err = new Error(msg);
    err.data = data;
    throw err;
  }
}

function id(prefix) { return `${prefix}_smoke_${crypto.randomBytes(4).toString('hex')}`; }
function now() { return new Date().toISOString(); }
function enqueue(db, provider_kind, driver, event_type, entity_type, entity_id, payload = {}) {
  const row = { id: id('iox'), provider_kind, driver, event_type, entity_type, entity_id, status: 'pending', attempts: 0, payload, last_error: null, created_at: now(), updated_at: now(), dispatched_at: null };
  db.integration_outbox.push(row);
  return row;
}

const proof = { started_at: new Date().toISOString(), checks: [] };
const pass = (name, data = {}) => proof.checks.push({ status: 'PASS', name, data });

try {
  const port = await listen(receiver);
  const endpoint = `http://127.0.0.1:${port}/webhook`;
  const env = {
    PAYMENT_PROVIDER: 'payment-webhook',
    PAYMENT_WEBHOOK_ENDPOINT: endpoint,
    PAYMENT_WEBHOOK_SIGNING_SECRET: secret,
    NOTIFICATION_PROVIDER: 'notification-webhook',
    NOTIFICATION_WEBHOOK_ENDPOINT: endpoint,
    NOTIFICATION_WEBHOOK_SIGNING_SECRET: secret,
    ROUTE_INTELLIGENCE_PROVIDER: 'route-structure-only',
    IDENTITY_COMPLIANCE_PROVIDER: 'compliance-webhook',
    COMPLIANCE_WEBHOOK_ENDPOINT: endpoint,
    COMPLIANCE_WEBHOOK_SIGNING_SECRET: secret,
    SKYEHANDS_RUNTIME_PROVIDER: 'skyehands-runtime-webhook',
    SKYEHANDS_RUNTIME_WEBHOOK_ENDPOINT: endpoint,
    SKYEHANDS_RUNTIME_WEBHOOK_SIGNING_SECRET: secret
  };
  const services = createPlatformServices({ env });
  assert(services.payment.status === 'connected' && services.notifications.status === 'connected' && services.compliance.status === 'connected' && services.runtime.status === 'connected', 'webhook providers did not report connected', services);
  pass('webhook_providers_report_connected');

  const db = blankDb();
  const job = { id: 'job_smoke', provider_id: 'usr_provider', pay_amount_cents: 5000, slots: 2 };
  const assignment = { id: 'asg_smoke', contractor_id: 'usr_contractor' };
  const payment = services.payment.authorizeJob({ db, job, id, now });
  enqueue(db, 'payment_provider', services.payment.driver, 'payment_authorized', 'payment_ledger', payment.id, { job_id: job.id, amount_cents: payment.amount_cents, status: payment.status });
  const notification = services.notifications.send({ db, user_id: 'usr_provider', title: 'Smoke', body: 'Webhook notification smoke.', id, now });
  enqueue(db, 'notification_provider', services.notifications.driver, 'notification_created', 'notification', notification.id, { user_id: notification.user_id, title: notification.title, channel: notification.channel });
  const compliance = services.compliance.recordAssignmentAttestation({ db, assignment, id, now });
  enqueue(db, 'identity_compliance', services.compliance.driver, 'assignment_compliance_attested', 'compliance_check', compliance.id, { assignment_id: assignment.id, status: compliance.status, checks: compliance.checks });
  const runtime = services.runtime.emit({ db, event: { event_type: 'smoke_runtime_event', entity_type: 'job_assignment', entity_id: assignment.id, actor_user_id: 'usr_provider', metadata: { smoke: true } }, id, now });
  enqueue(db, 'skyehands_runtime', services.runtime.driver, runtime.event_type, runtime.entity_type, runtime.entity_id, { runtime_event_id: runtime.id, metadata: runtime.metadata });

  await waitFor(4);
  assert(received.every(x => x.signed), 'one or more webhook deliveries had invalid signatures', received);
  assert(new Set(received.map(x => x.provider_kind)).size === 4, 'missing provider webhook deliveries', received);
  pass('receiver_verified_signed_json_dispatch', { deliveries: received.map(x => ({ provider_kind: x.provider_kind, driver: x.driver, event_type: x.body.event_type })) });

  assert(db.payment_ledger.length === 1 && db.payment_ledger[0].provider_driver === 'payment-webhook' && db.payment_ledger[0].external_dispatch?.status === 'queued', 'payment webhook did not update local ledger row', db.payment_ledger);
  assert(db.notifications.length === 1 && db.notifications[0].delivery_provider === 'notification-webhook' && db.notifications[0].delivery_status === 'queued', 'notification webhook did not update local ledger row', db.notifications);
  assert(db.compliance_checks.length === 1 && db.compliance_checks[0].provider === 'compliance-webhook', 'compliance webhook did not update local ledger row', db.compliance_checks);
  assert(db.runtime_events.length === 1 && db.runtime_events[0].provider === 'skyehands-runtime-webhook', 'runtime webhook did not update local event row', db.runtime_events);
  assert(db.integration_outbox.length === 4 && db.integration_outbox.every(row => row.status === 'pending' && row.driver.endsWith('-webhook')), 'integration outbox rows were not consistent with webhook drivers', db.integration_outbox);
  pass('local_ledgers_and_outbox_match_webhook_drivers', { outbox: db.integration_outbox.map(row => ({ provider_kind: row.provider_kind, driver: row.driver, event_type: row.event_type })) });

  for (const [name, badEnv, expect] of [
    ['payment_fails_closed_without_endpoint', { PAYMENT_PROVIDER: 'payment-webhook', PAYMENT_WEBHOOK_SIGNING_SECRET: secret }, 'PAYMENT_WEBHOOK_ENDPOINT'],
    ['notification_fails_closed_without_secret', { NOTIFICATION_PROVIDER: 'notification-webhook', NOTIFICATION_WEBHOOK_ENDPOINT: endpoint }, 'NOTIFICATION_WEBHOOK_SIGNING_SECRET'],
    ['compliance_fails_closed_with_short_secret', { IDENTITY_COMPLIANCE_PROVIDER: 'compliance-webhook', COMPLIANCE_WEBHOOK_ENDPOINT: endpoint, COMPLIANCE_WEBHOOK_SIGNING_SECRET: 'short' }, 'COMPLIANCE_WEBHOOK_SIGNING_SECRET'],
    ['runtime_fails_closed_with_bad_endpoint', { SKYEHANDS_RUNTIME_PROVIDER: 'skyehands-runtime-webhook', SKYEHANDS_RUNTIME_WEBHOOK_ENDPOINT: 'file:///tmp/nope', SKYEHANDS_RUNTIME_WEBHOOK_SIGNING_SECRET: secret }, 'SKYEHANDS_RUNTIME_WEBHOOK_ENDPOINT']
  ]) {
    let message = '';
    try { createPlatformServices({ env: badEnv }); } catch (error) { message = error.message; }
    assert(message.includes(expect), `${name} did not fail closed`, { message, expect });
    pass(name);
  }

  proof.status = 'PASS';
  proof.completed_at = new Date().toISOString();
  console.log(JSON.stringify(proof, null, 2));
} catch (error) {
  proof.status = 'FAIL';
  proof.failed_at = new Date().toISOString();
  proof.failure = error.message;
  proof.data = error.data || null;
  console.error(JSON.stringify(proof, null, 2));
  process.exitCode = 1;
} finally {
  receiver.close();
}
