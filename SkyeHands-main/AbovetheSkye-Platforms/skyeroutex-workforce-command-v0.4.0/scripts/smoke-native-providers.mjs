import http from 'http';
import fs from 'fs';
import path from 'path';
import { createPlatformServices } from '../src/adapters/platform-services.js';
import { blankDb } from '../src/adapters/workforce-db.js';

const root = process.cwd();
const proofDir = path.join(root, 'proof');
fs.mkdirSync(proofDir, { recursive: true });
const received = [];
const server = http.createServer(async (req, res) => {
  let rawBody = '';
  for await (const chunk of req) rawBody += chunk;
  received.push({
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: rawBody
  });
  res.writeHead(req.url.includes('/directions/') ? 200 : req.url.includes('/Messages') ? 201 : 200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ id: 'provider_contract_received', ok: true }));
});

function listen() {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
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
        reject(new Error(`Timed out waiting for ${count} native provider requests; got ${received.length}.`));
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

function id(prefix) { return `${prefix}_native_smoke`; }
function now() { return new Date().toISOString(); }

const proof = { started_at: new Date().toISOString(), checks: [] };
const pass = (name, data = {}) => proof.checks.push({ status: 'PASS', name, data });

try {
  const port = await listen();
  const base = `http://127.0.0.1:${port}`;
  const env = {
    PAYMENT_PROVIDER: 'stripe',
    STRIPE_SECRET_KEY: 'sk_test_native_provider_contract',
    STRIPE_API_BASE: base,
    NOTIFICATION_PROVIDER: 'twilio',
    TWILIO_ACCOUNT_SID: 'AC_native_provider_contract',
    TWILIO_AUTH_TOKEN: 'twilio_native_provider_contract_token',
    TWILIO_FROM_NUMBER: '+15550000001',
    TWILIO_DEFAULT_TO: '+15550000002',
    TWILIO_API_BASE: base,
    ROUTE_INTELLIGENCE_PROVIDER: 'mapbox',
    MAPBOX_ACCESS_TOKEN: 'mapbox_native_provider_contract_token',
    MAPBOX_API_BASE: base,
    IDENTITY_COMPLIANCE_PROVIDER: 'checkr',
    CHECKR_API_KEY: 'checkr_native_provider_contract_key',
    CHECKR_PACKAGE: 'driver_pro',
    CHECKR_API_BASE: base,
    SKYEHANDS_RUNTIME_PROVIDER: 'standalone-local-events'
  };
  const services = createPlatformServices({ env });
  assert(services.payment.driver === 'stripe' && services.notifications.driver === 'twilio' && services.routeIntelligence.driver === 'mapbox' && services.compliance.driver === 'checkr', 'native providers did not initialize', services);
  pass('native_providers_initialize_with_required_credentials');

  const db = blankDb();
  const job = { id: 'job_native', provider_id: 'usr_provider', pay_amount_cents: 12500, slots: 1, route_mode: 'field_route', vehicle_type: 'van', arrival_window: 'morning' };
  const assignment = { id: 'asg_native', contractor_id: 'usr_contractor' };
  const payment = services.payment.authorizeJob({ db, job, id, now });
  const notification = services.notifications.send({ db, user_id: 'usr_provider', title: 'Native provider smoke', body: 'Twilio request contract.', id, now });
  const route = services.routeIntelligence.planRoute({ db, job, body: { route_stops: [{ label: 'Pickup', address: 'A', lng: -112.074, lat: 33.448 }, { label: 'Dropoff', address: 'B', lng: -112.05, lat: 33.45 }] }, id, now });
  const compliance = services.compliance.recordUserAttestation({ db, userId: 'usr_contractor', role: 'contractor', id, now });
  await Promise.all([payment.external_dispatch.promise, notification.external_dispatch.promise, route.external_dispatch.promise, compliance.external_dispatch.promise]);
  await waitFor(4);

  const stripe = received.find(req => req.url === '/v1/payment_intents');
  assert(stripe && stripe.headers.authorization === `Bearer ${env.STRIPE_SECRET_KEY}` && stripe.body.includes('capture_method=manual') && stripe.body.includes('metadata%5Bjob_id%5D=job_native'), 'Stripe request contract wrong', stripe);
  pass('stripe_payment_intent_request_contract_is_real_http', { url: stripe.url });

  const twilio = received.find(req => req.url.includes('/2010-04-01/Accounts/AC_native_provider_contract/Messages.json'));
  assert(twilio && twilio.headers.authorization?.startsWith('Basic ') && twilio.body.includes('To=%2B15550000002') && twilio.body.includes('From=%2B15550000001'), 'Twilio request contract wrong', twilio);
  pass('twilio_message_request_contract_is_real_http', { url: twilio.url });

  const mapbox = received.find(req => req.url.includes('/directions/v5/mapbox/'));
  assert(mapbox && mapbox.method === 'GET' && mapbox.url.includes('/directions/v5/mapbox/driving/-112.074,33.448;-112.05,33.45') && mapbox.url.includes('access_token=mapbox_native_provider_contract_token'), 'Mapbox request contract wrong', mapbox);
  pass('mapbox_directions_request_contract_is_real_http', { url: mapbox.url.split('?')[0] });

  const checkr = received.find(req => req.url === '/v1/invitations');
  assert(checkr && checkr.headers.authorization?.startsWith('Basic ') && checkr.body.includes('package=driver_pro'), 'Checkr request contract wrong', checkr);
  pass('checkr_invitation_request_contract_is_real_http', { url: checkr.url });

  assert(db.payment_ledger[0].provider_driver === 'stripe' && db.notifications[0].delivery_provider === 'twilio' && db.route_jobs[0].route_provider === 'mapbox' && db.compliance_checks[0].provider === 'checkr', 'local ledgers did not record native provider drivers', db);
  pass('local_ledgers_record_native_provider_drivers');

  for (const [name, badEnv, expect] of [
    ['stripe_fails_closed_without_secret', { PAYMENT_PROVIDER: 'stripe' }, 'STRIPE_SECRET_KEY'],
    ['twilio_fails_closed_without_recipient', { NOTIFICATION_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 'AC_x', TWILIO_AUTH_TOKEN: 'tok', TWILIO_FROM_NUMBER: '+15550000001' }, 'TWILIO_DEFAULT_TO'],
    ['mapbox_fails_closed_without_token', { ROUTE_INTELLIGENCE_PROVIDER: 'mapbox' }, 'MAPBOX_ACCESS_TOKEN'],
    ['checkr_fails_closed_without_package', { IDENTITY_COMPLIANCE_PROVIDER: 'checkr', CHECKR_API_KEY: 'key' }, 'CHECKR_PACKAGE']
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
  const out = path.join(proofDir, `SMOKE_NATIVE_PROVIDERS_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(out, JSON.stringify(proof, null, 2));
  console.log(`Native provider proof written: ${out}`);
  server.close();
}
