import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const root = process.cwd();
const proofDir = path.join(root, 'proof');
fs.mkdirSync(proofDir, { recursive: true });
const dbPath = path.join(root, 'data', 'provider-webhooks-smoke-db.json');
if (fs.existsSync(dbPath)) fs.rmSync(dbPath, { force: true });

const port = 5899;
const base = `http://127.0.0.1:${port}`;
const stripeSecret = 'whsec_provider_webhook_smoke';
const twilioToken = 'twilio_provider_webhook_smoke_token';
const checkrSecret = 'checkr_provider_webhook_smoke_secret';
const env = {
  ...process.env,
  PORT: String(port),
  DATABASE_PATH: dbPath,
  SKYE_ADMIN_EMAIL: 'admin@provider-webhooks.internal.invalid',
  SKYE_ADMIN_PASSWORD: 'AdminProviderWebhooks123!',
  STRIPE_WEBHOOK_SECRET: stripeSecret,
  TWILIO_AUTH_TOKEN: twilioToken,
  PUBLIC_BASE_URL: base,
  CHECKR_WEBHOOK_SECRET: checkrSecret
};
const server = spawn('node', ['src/server.js'], { cwd: root, env, stdio: 'ignore' });

async function req(method, url, body, session, headers = {}) {
  const defaultHeaders = { connection: 'close', ...headers };
  if (body != null && !defaultHeaders['content-type']) defaultHeaders['content-type'] = 'application/json';
  if (session) defaultHeaders['x-skye-session'] = session;
  const res = await fetch(`${base}${url}`, { method, headers: defaultHeaders, body });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), json };
}

function assert(cond, msg, data) {
  if (!cond) {
    const err = new Error(msg);
    err.data = data;
    throw err;
  }
}

function stripeSignature(raw, secret) {
  const t = Math.floor(Date.now() / 1000);
  const v1 = crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  return `t=${t},v1=${v1}`;
}

function twilioSignature(url, form, token) {
  const params = new URLSearchParams(form);
  const signed = [...params.keys()].sort().reduce((acc, key) => acc + key + params.get(key), url);
  return crypto.createHmac('sha1', token).update(signed).digest('base64');
}

function sha256Signature(raw, secret) {
  return crypto.createHmac('sha256', secret).update(raw).digest('hex');
}

async function login() {
  const r = await req('POST', '/api/auth/login', JSON.stringify({ email: 'admin@provider-webhooks.internal.invalid', password: 'AdminProviderWebhooks123!' }));
  assert(r.status === 200, 'admin login failed', r);
  return r.json.session;
}

const proof = { started_at: new Date().toISOString(), checks: [] };
const pass = (name, data = {}) => proof.checks.push({ status: 'PASS', name, data });

try {
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`${base}/api/health`); if (r.ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  const admin = await login();
  pass('admin_login');

  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const adminUser = db.users.find(user => user.email === 'admin@provider-webhooks.internal.invalid');
  db.payment_ledger.push({ id: 'pay_cb', job_id: 'job_cb', assignment_id: 'asg_cb', contractor_id: 'usr_contractor_cb', provider_id: adminUser.id, amount_cents: 5000, status: 'payment_authorization_queued', reason: 'Awaiting Stripe callback.', provider_driver: 'stripe', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  db.notifications.push({ id: 'not_cb', user_id: adminUser.id, title: 'Twilio status', body: 'Awaiting callback.', channel: 'sms', delivery_provider: 'twilio', delivery_status: 'queued', read_at: null, created_at: new Date().toISOString() });
  db.compliance_checks.push({ id: 'cmp_cb', user_id: 'usr_checkr_candidate', role: 'contractor', provider: 'checkr', status: 'background_invitation_queued', checks: ['background_invitation'], created_at: new Date().toISOString() });
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  pass('seeded_provider_reconciliation_rows');

  const stripeRaw = JSON.stringify({ id: 'evt_stripe_cb', type: 'payment_intent.succeeded', data: { object: { id: 'pi_cb', status: 'succeeded', metadata: { payment_ledger_id: 'pay_cb' } } } });
  const stripe = await req('POST', '/api/providers/stripe/webhook', stripeRaw, null, { 'content-type': 'application/json', 'stripe-signature': stripeSignature(stripeRaw, stripeSecret) });
  assert(stripe.status === 200 && stripe.json.payment.status === 'captured' && stripe.json.webhook.verified, 'Stripe webhook did not reconcile payment', stripe);
  pass('stripe_signed_webhook_reconciled_payment', { payment: stripe.json.payment.id, status: stripe.json.payment.status });

  const twilioForm = new URLSearchParams({ notification_id: 'not_cb', MessageSid: 'SM_cb', MessageStatus: 'delivered' }).toString();
  const twilioUrl = `${base}/api/providers/twilio/status`;
  const twilio = await req('POST', '/api/providers/twilio/status', twilioForm, null, { 'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': twilioSignature(twilioUrl, twilioForm, twilioToken) });
  assert(twilio.status === 200 && twilio.json.notification.delivery_status === 'delivered' && twilio.json.webhook.verified, 'Twilio status callback did not reconcile notification', twilio);
  pass('twilio_signed_status_callback_reconciled_notification', { notification: twilio.json.notification.id, status: twilio.json.notification.delivery_status });

  const checkrRaw = JSON.stringify({ id: 'evt_checkr_cb', type: 'report.completed', candidate_id: 'usr_checkr_candidate', status: 'clear' });
  const checkr = await req('POST', '/api/providers/checkr/webhook', checkrRaw, null, { 'content-type': 'application/json', 'x-checkr-signature': sha256Signature(checkrRaw, checkrSecret) });
  assert(checkr.status === 200 && checkr.json.compliance_check.status === 'clear' && checkr.json.webhook.verified, 'Checkr webhook did not reconcile compliance check', checkr);
  pass('checkr_signed_webhook_reconciled_compliance', { compliance_check: checkr.json.compliance_check.id, status: checkr.json.compliance_check.status });

  const badStripe = await req('POST', '/api/providers/stripe/webhook', stripeRaw, null, { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=bad' });
  assert(badStripe.status === 400, 'bad Stripe signature was accepted', badStripe);
  pass('bad_stripe_signature_rejected');

  const listed = await req('GET', '/api/providers/webhooks', null, admin);
  assert(listed.status === 200 && listed.json.provider_webhooks.length >= 3 && listed.json.provider_webhooks.every(row => row.verified), 'provider webhook ledger listing failed', listed);
  pass('admin_can_inspect_provider_webhook_ledger', { count: listed.json.provider_webhooks.length });

  proof.completed_at = new Date().toISOString();
  proof.status = 'PASS';
} catch (error) {
  proof.failed_at = new Date().toISOString();
  proof.status = 'FAIL';
  proof.failure = error.message;
  proof.data = error.data || null;
  console.error(error);
  process.exitCode = 1;
} finally {
  const out = path.join(proofDir, `SMOKE_PROVIDER_WEBHOOKS_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(out, JSON.stringify(proof, null, 2));
  console.log(`Provider webhook proof written: ${out}`);
  try { process.kill(server.pid, 'SIGKILL'); } catch {}
  process.exit(process.exitCode || 0);
}
