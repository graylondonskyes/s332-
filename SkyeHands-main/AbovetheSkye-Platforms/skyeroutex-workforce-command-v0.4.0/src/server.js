import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createDatabaseAdapter } from './adapters/workforce-db.js';
import { createProofStorageAdapter } from './adapters/proof-storage.js';
import { createIntegrationRegistry } from './adapters/integration-registry.js';
import { createPlatformServices } from './adapters/platform-services.js';
import { createSecurity } from './security.js';
import { ACCEPTANCE_MODES, PAY_TYPES, PAYMENT_STATUSES, ROLES, USER_STATUSES, assignmentTransitionAllowed, cleanText, isEmail, isoDateLike, moneyCents, positiveInt, ratingScore, strongEnoughPassword } from './validation.js';
import { appendAuditChainFields, verifyAuditChain } from './audit-chain.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 4177);
const database = createDatabaseAdapter({ root });
const proofStorage = createProofStorageAdapter({ root });
const services = createPlatformServices();
const security = createSecurity();
const integrations = createIntegrationRegistry({ database, proofStorage, services });
security.assertProductionReady();

const VERSION = '0.4.0';
const ASSIGNMENT_CLOSED = ['cancelled_by_contractor', 'cancelled_by_provider', 'no_show'];
const INVITABLE_ROLES = ['contractor', 'provider', 'crew', 'house_command', 'ae'];

function now() { return new Date().toISOString(); }
function id(prefix) { return `${prefix}_${crypto.randomBytes(9).toString('hex')}`; }
function hash(password, salt = crypto.randomBytes(16).toString('hex')) {
  const digest = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  return `${salt}:${digest}`;
}
function hashToken(token) { return crypto.createHash('sha256').update(String(token || '')).digest('hex'); }
function verify(password, stored) {
  const [salt, digest] = String(stored || '').split(':');
  if (!salt || !digest) return false;
  return hash(password, salt).split(':')[1] === digest;
}
function loadDb() { return database.load(); }
function mutate(fn) { return database.mutate(fn); }
function enqueueIntegrationOutbox(db, provider_kind, driver, event_type, entity_type, entity_id, payload = {}) {
  const row = { id: id('iox'), provider_kind, driver, event_type, entity_type, entity_id, status: 'pending', attempts: 0, payload, last_error: null, created_at: now(), updated_at: now(), dispatched_at: null };
  db.integration_outbox.push(row);
  return row;
}
function audit(db, actor, event_type, entity_type, entity_id, metadata = {}) {
  const row = { id: id('aud'), actor_user_id: actor?.id || actor || null, event_type, entity_type, entity_id, metadata, created_at: now() };
  appendAuditChainFields(db, row);
  db.audit_events.push(row);
  const runtimeRow = services.runtime.emit({ db, event: row, id, now });
  enqueueIntegrationOutbox(db, 'skyehands_runtime', services.runtime.driver, runtimeRow.event_type, runtimeRow.entity_type, runtimeRow.entity_id, { runtime_event_id: runtimeRow.id, actor_user_id: runtimeRow.actor_user_id, metadata: runtimeRow.metadata });
  return row;
}
function notify(db, user_id, title, body) {
  const row = services.notifications.send({ db, user_id, title, body, id, now });
  enqueueIntegrationOutbox(db, 'notification_provider', services.notifications.driver, 'notification_created', 'notification', row.id, { user_id, title, channel: row.channel });
  return row;
}
function paymentAuthorizeJob(db, job) {
  const row = services.payment.authorizeJob({ db, job, id, now });
  enqueueIntegrationOutbox(db, 'payment_provider', services.payment.driver, 'payment_authorized', 'payment_ledger', row.id, { job_id: job.id, amount_cents: row.amount_cents, status: row.status });
  return row;
}
function paymentCreateAssignment(db, job, assignment, contractorId, reason) {
  const row = services.payment.createAssignmentLedger({ db, job, assignment, contractorId, reason, id, now });
  enqueueIntegrationOutbox(db, 'payment_provider', services.payment.driver, 'assignment_payment_created', 'payment_ledger', row.id, { job_id: job.id, assignment_id: assignment.id, contractor_id: contractorId, amount_cents: row.amount_cents, status: row.status });
  return row;
}
function paymentMarkAssignment(db, assignmentId, status, reason) {
  const rows = services.payment.markAssignment({ db, assignmentId, status, reason, now });
  rows.forEach(row => enqueueIntegrationOutbox(db, 'payment_provider', services.payment.driver, 'assignment_payment_status_changed', 'payment_ledger', row.id, { assignment_id: assignmentId, status: row.status, reason: row.reason }));
  return rows;
}
function planRoute(db, job, body) {
  const route = services.routeIntelligence.planRoute({ db, job, body, id, now });
  enqueueIntegrationOutbox(db, 'route_intelligence', services.routeIntelligence.driver, 'route_planned', 'route_job', route.id, { job_id: job.id, route_mode: route.mode, late_risk: route.late_risk });
  return route;
}
function completeRouteStop(db, route, stop, proofNote) {
  const result = services.routeIntelligence.completeStop({ db, route, stop, proofNote, now });
  enqueueIntegrationOutbox(db, 'route_intelligence', services.routeIntelligence.driver, 'route_stop_completed', 'route_stop', stop.id, { route_job_id: route.id, job_id: route.job_id, proof_note: proofNote || null });
  return result;
}
function complianceUser(db, userId, role) {
  const row = services.compliance.recordUserAttestation({ db, userId, role, id, now });
  enqueueIntegrationOutbox(db, 'identity_compliance', services.compliance.driver, 'user_compliance_attested', 'compliance_check', row.id, { user_id: userId, role, status: row.status, checks: row.checks });
  return row;
}
function complianceAssignment(db, assignment) {
  const row = services.compliance.recordAssignmentAttestation({ db, assignment, id, now });
  enqueueIntegrationOutbox(db, 'identity_compliance', services.compliance.driver, 'assignment_compliance_attested', 'compliance_check', row.id, { user_id: assignment.contractor_id, assignment_id: assignment.id, status: row.status, checks: row.checks });
  return row;
}
function json(res, status, payload, cookie) {
  const headers = security.securityHeaders('application/json');
  if (cookie) headers['set-cookie'] = cookie;
  res.writeHead(status, headers);
  res.end(JSON.stringify(payload));
}
function text(res, status, body, type = 'text/plain') { res.writeHead(status, security.securityHeaders(type)); res.end(body); }
async function readBody(req) {
  const data = await readRawBody(req);
  if (!data) return {};
  try { return JSON.parse(data); } catch { return Object.fromEntries(new URLSearchParams(data)); }
}
async function readRawBody(req) {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (Buffer.byteLength(data) > security.maxBodyBytes) throw new Error(`Request body exceeds ${security.maxBodyBytes} byte limit.`);
  }
  return data;
}
function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(v => v.trim()).filter(Boolean).map(v => {
    const i = v.indexOf('='); return [v.slice(0, i), decodeURIComponent(v.slice(i + 1))];
  }));
}
function getSessionId(req) { return req.headers['x-skye-session'] || parseCookies(req.headers.cookie || '').skye_session; }
function auth(req, db) {
  const sid = getSessionId(req);
  if (!sid) return null;
  const session = db.sessions.find(s => s.id === sid && s.expires_at > now());
  if (!session) return null;
  const user = db.users.find(u => u.id === session.user_id);
  if (!user || user.status !== 'active') return null;
  const { password_hash, ...safe } = user;
  return safe;
}
function requireUser(req, res, db, roles) {
  const user = auth(req, db);
  if (!user) { json(res, 401, { error: 'Authentication required.' }); return null; }
  if (roles && !roles.includes(user.role)) { json(res, 403, { error: `Requires role: ${roles.join(', ')}` }); return null; }
  return user;
}
let currentMethod = '';
function routeMatch(method, pathname, pattern) {
  if (method && method !== currentMethod) return null;
  const parts = pathname.split('/').filter(Boolean);
  const pat = pattern.split('/').filter(Boolean);
  if (parts.length !== pat.length) return null;
  const params = {};
  for (let i = 0; i < pat.length; i++) {
    if (pat[i].startsWith(':')) params[pat[i].slice(1)] = parts[i];
    else if (pat[i] !== parts[i]) return null;
  }
  return params;
}
function publicFile(res, pathname) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const full = path.join(root, 'public', safePath);
  const publicRoot = path.join(root, 'public');
  if (!full.startsWith(publicRoot)) return text(res, 403, 'Forbidden');
  if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) return text(res, 404, 'Not found');
  const ext = path.extname(full);
  const type = ext === '.html' ? 'text/html' : ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : 'application/octet-stream';
  text(res, 200, fs.readFileSync(full), type);
}
function ensureAdmin(db) {
  const email = String(process.env.SKYE_ADMIN_EMAIL || '').trim();
  const password = String(process.env.SKYE_ADMIN_PASSWORD || '').trim();
  if (!email || !password) return;
  if (db.users.some(u => u.email === email)) return;
  const uid = id('usr'); const t = now();
  db.users.push({ id: uid, email, password_hash: hash(password), role: 'admin', status: 'active', name: 'House Command Admin', city: null, state: null, created_at: t, updated_at: t });
  audit(db, uid, 'admin_seeded', 'user', uid, { email });
}
function required(body, fields) { for (const f of fields) if (body[f] === undefined || body[f] === null || body[f] === '') return f; return null; }
function acceptedCount(db, jobId) { return db.job_assignments.filter(a => a.job_id === jobId && !ASSIGNMENT_CLOSED.includes(a.status)).length; }
async function writeJsonExport(name, payload) { return proofStorage.writeJsonExport(name, payload); }
async function storeProofMedia(proofId, body) { return proofStorage.storeProofMedia({ proofId, body, id, now }); }
function jobAccessAllowed(db, user, job) {
  if (!user || !job) return false;
  if (['admin', 'house_command'].includes(user.role)) return true;
  if (job.provider_id === user.id) return true;
  return db.job_assignments.some(a => a.job_id === job.id && a.contractor_id === user.id);
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function verifyStripeSignature(rawBody, header, secret) {
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is required to accept Stripe webhooks.');
  const parts = Object.fromEntries(String(header || '').split(',').map(part => part.split('=')).filter(x => x.length === 2));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return timingSafeEqual(signature, expected);
}

function verifyTwilioSignature({ rawBody, req, publicBaseUrl, authToken }) {
  if (!authToken) throw new Error('TWILIO_AUTH_TOKEN is required to accept Twilio callbacks.');
  const params = new URLSearchParams(rawBody);
  const url = `${String(publicBaseUrl || `http://${req.headers.host}`).replace(/\/+$/, '')}${new URL(req.url, `http://${req.headers.host}`).pathname}`;
  const signed = [...params.keys()].sort().reduce((acc, key) => acc + key + params.get(key), url);
  const expected = crypto.createHmac('sha1', authToken).update(signed).digest('base64');
  return timingSafeEqual(req.headers['x-twilio-signature'], expected);
}

function verifySharedSha256(rawBody, header, secret) {
  if (!secret) throw new Error('Provider webhook secret is required.');
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const actual = String(header || '').replace(/^sha256=/, '');
  return timingSafeEqual(actual, expected);
}

function recordProviderWebhook(db, { provider, event_type, verified, entity_type = null, entity_id = null, provider_event_id = null, payload = {}, status = 'processed', error = null }) {
  const row = { id: id('pwh'), provider, event_type, verified: !!verified, entity_type, entity_id, provider_event_id, payload, received_at: now(), processed_at: status === 'processed' ? now() : null, processing_status: status, error };
  db.provider_webhooks.push(row);
  return row;
}

mutate(db => ensureAdmin(db));

async function handler(req, res) {
  currentMethod = req.method;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;
  let m;
  try {
    const limit = security.rateLimit(req);
    if (!limit.ok) return json(res, 429, { error: 'Rate limit exceeded.', retry_after_seconds: limit.retry_after_seconds, limit: limit.limit });
    if (!security.csrfAllowed(req)) return json(res, 403, { error: 'CSRF header required for cookie-authenticated state changes.' });
    if (!p.startsWith('/api/')) return publicFile(res, p);
    if (req.method === 'GET' && p === '/api/health') return json(res, 200, { ok: true, app: 'SkyeRoutexFlow Workforce Command', version: VERSION, database_driver: database.driver, storage_driver: proofStorage.driver, production_mode: security.isProduction });
    if (req.method === 'GET' && p === '/api/readiness') return json(res, 200, { ok: security.productionChecks().filter(c => c.required && !c.ok).length === 0, production_mode: security.isProduction, checks: security.productionChecks(), integrations: integrations.list() });

    if (req.method === 'POST' && p === '/api/providers/stripe/webhook') {
      const raw = await readRawBody(req);
      let payload = {};
      try { payload = JSON.parse(raw || '{}'); } catch { return json(res, 400, { error: 'Invalid JSON.' }); }
      let verified = false;
      try { verified = verifyStripeSignature(raw, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET); } catch (error) { return json(res, 400, { error: error.message }); }
      if (!verified) return json(res, 400, { error: 'Invalid Stripe webhook signature.' });
      return mutate(db => {
        const object = payload.data?.object || {};
        const ledgerId = object.metadata?.payment_ledger_id || object.metadata?.payment_id || null;
        const payment = ledgerId ? db.payment_ledger.find(row => row.id === ledgerId) : null;
        if (payment) {
          payment.external_provider_id = object.id || payment.external_provider_id || null;
          payment.external_status = object.status || null;
          payment.updated_at = now();
          if (payload.type === 'payment_intent.succeeded') { payment.status = 'captured'; payment.reason = 'Stripe payment intent succeeded.'; }
          if (payload.type === 'payment_intent.payment_failed') { payment.status = 'failed'; payment.reason = 'Stripe payment intent failed.'; }
          if (payload.type === 'payment_intent.canceled') { payment.status = 'cancelled'; payment.reason = 'Stripe payment intent canceled.'; }
        }
        const row = recordProviderWebhook(db, { provider: 'stripe', event_type: payload.type || 'unknown', verified, entity_type: payment ? 'payment_ledger' : null, entity_id: payment?.id || null, provider_event_id: payload.id || object.id || null, payload, status: payment ? 'processed' : 'received_unmatched' });
        audit(db, 'stripe', 'provider_webhook_received', 'provider_webhook', row.id, { provider: 'stripe', event_type: row.event_type, entity_id: row.entity_id, matched: !!payment });
        return json(res, 200, { received: true, webhook: row, payment });
      });
    }

    if (req.method === 'POST' && p === '/api/providers/twilio/status') {
      const raw = await readRawBody(req);
      let verified = false;
      try { verified = verifyTwilioSignature({ rawBody: raw, req, publicBaseUrl: process.env.PUBLIC_BASE_URL, authToken: process.env.TWILIO_AUTH_TOKEN }); } catch (error) { return json(res, 400, { error: error.message }); }
      if (!verified) return json(res, 400, { error: 'Invalid Twilio callback signature.' });
      const body = Object.fromEntries(new URLSearchParams(raw));
      return mutate(db => {
        const notification = db.notifications.find(row => row.id === body.notification_id || row.external_provider_id === body.MessageSid);
        if (notification) {
          notification.external_provider_id = body.MessageSid || notification.external_provider_id || null;
          notification.delivery_status = body.MessageStatus || body.SmsStatus || notification.delivery_status;
          notification.updated_at = now();
        }
        const row = recordProviderWebhook(db, { provider: 'twilio', event_type: body.MessageStatus || body.SmsStatus || 'status_callback', verified, entity_type: notification ? 'notification' : null, entity_id: notification?.id || null, provider_event_id: body.MessageSid || null, payload: body, status: notification ? 'processed' : 'received_unmatched' });
        audit(db, 'twilio', 'provider_webhook_received', 'provider_webhook', row.id, { provider: 'twilio', event_type: row.event_type, entity_id: row.entity_id, matched: !!notification });
        return json(res, 200, { received: true, webhook: row, notification });
      });
    }

    if (req.method === 'POST' && p === '/api/providers/checkr/webhook') {
      const raw = await readRawBody(req);
      let payload = {};
      try { payload = JSON.parse(raw || '{}'); } catch { return json(res, 400, { error: 'Invalid JSON.' }); }
      let verified = false;
      try { verified = verifySharedSha256(raw, req.headers['x-checkr-signature'] || req.headers['x-skyeroutex-signature'], process.env.CHECKR_WEBHOOK_SECRET); } catch (error) { return json(res, 400, { error: error.message.replace('Provider', 'CHECKR_WEBHOOK_SECRET') }); }
      if (!verified) return json(res, 400, { error: 'Invalid Checkr webhook signature.' });
      return mutate(db => {
        const candidateId = payload.candidate_id || payload.data?.object?.candidate_id || payload.data?.object?.candidate?.id || payload.user_id;
        const check = db.compliance_checks.find(row => row.user_id === candidateId || row.id === payload.compliance_check_id);
        if (check) {
          check.external_provider_id = payload.id || payload.report_id || check.external_provider_id || null;
          check.status = payload.status || payload.type || check.status;
          check.updated_at = now();
        }
        const row = recordProviderWebhook(db, { provider: 'checkr', event_type: payload.type || payload.status || 'checkr_callback', verified, entity_type: check ? 'compliance_check' : null, entity_id: check?.id || null, provider_event_id: payload.id || payload.report_id || null, payload, status: check ? 'processed' : 'received_unmatched' });
        audit(db, 'checkr', 'provider_webhook_received', 'provider_webhook', row.id, { provider: 'checkr', event_type: row.event_type, entity_id: row.entity_id, matched: !!check });
        return json(res, 200, { received: true, webhook: row, compliance_check: check });
      });
    }

    if (req.method === 'POST' && p === '/api/auth/signup') {
      const body = await readBody(req);
      const miss = required(body, ['email', 'password', 'name', 'role']);
      if (miss) return json(res, 400, { error: `${miss} is required.` });
      if (!isEmail(body.email)) return json(res, 400, { error: 'Valid email is required.' });
      if (!strongEnoughPassword(body.password)) return json(res, 400, { error: 'Password must be at least 10 characters and include letters and numbers.' });
      if (!ROLES.includes(body.role)) return json(res, 400, { error: 'Invalid role.' });
      const name = cleanText(body.name, 120); if (!name) return json(res, 400, { error: 'Valid name is required.' });
      return mutate(db => {
        if (db.users.some(u => u.email === body.email.toLowerCase())) return json(res, 409, { error: 'Email already exists.' });
        if (body.role === 'provider' && !body.company_name) return json(res, 400, { error: 'Provider signup requires company_name.' });
        const uid = id('usr'); const t = now();
        db.users.push({ id: uid, email: body.email.toLowerCase(), password_hash: hash(body.password), role: body.role, status: 'active', name, city: cleanText(body.city, 80), state: cleanText(body.state, 80), created_at: t, updated_at: t });
        if (body.role === 'contractor') db.contractor_profiles.push({ user_id: uid, skills: body.skills || [], service_radius_miles: 25, transportation_status: 'unknown', reliability_score: 50, rating_avg: 0, completed_jobs: 0 });
        if (body.role === 'provider') db.provider_profiles.push({ user_id: uid, company_name: body.company_name, provider_type: 'local_business', rating_avg: 0, completed_jobs: 0 });
        if (body.role === 'crew') db.crew_profiles.push({ user_id: uid, crew_name: body.crew_name || body.name, member_count: Number(body.member_count || 1), rating_avg: 0, completed_jobs: 0 });
        complianceUser(db, uid, body.role);
        audit(db, uid, 'signup', 'user', uid, { role: body.role });
        return json(res, 201, { id: uid, email: body.email.toLowerCase(), role: body.role });
      });
    }

    if (req.method === 'POST' && p === '/api/auth/login') {
      const body = await readBody(req);
      return mutate(db => {
        const user = db.users.find(u => u.email === String(body.email || '').toLowerCase());
        if (!user || !verify(body.password || '', user.password_hash)) return json(res, 401, { error: 'Invalid email or password.' });
        if (user.status !== 'active') return json(res, 403, { error: `Account is ${user.status}.` });
        const sid = id('ses');
        db.sessions.push({ id: sid, user_id: user.id, created_at: now(), expires_at: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString() });
        audit(db, user.id, 'login', 'user', user.id);
        return json(res, 200, { session: sid, user: { id: user.id, email: user.email, role: user.role, name: user.name } }, security.sessionCookie(sid));
      });
    }

    if (req.method === 'POST' && p === '/api/auth/logout') {
      return mutate(db => {
        const sid = getSessionId(req);
        const before = db.sessions.length;
        db.sessions = db.sessions.filter(s => s.id !== sid);
        audit(db, sid || null, 'logout', 'session', sid || 'none', { removed: before - db.sessions.length });
        return json(res, 200, { ok: true, removed: before - db.sessions.length }, 'skye_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
      });
    }

    if (req.method === 'POST' && p === '/api/auth/accept-invite') {
      const body = await readBody(req);
      const miss = required(body, ['token', 'password']);
      if (miss) return json(res, 400, { error: `${miss} is required.` });
      if (!strongEnoughPassword(body.password)) return json(res, 400, { error: 'Password must be at least 10 characters and include letters and numbers.' });
      return mutate(db => {
        const t = now();
        const invite = db.admin_invites.find(x => x.token_hash === hashToken(body.token));
        if (!invite) return json(res, 404, { error: 'Invite not found.' });
        if (invite.used_at) return json(res, 409, { error: 'Invite has already been used.' });
        if (invite.revoked_at) return json(res, 409, { error: 'Invite has been revoked.' });
        if (invite.expires_at <= t) return json(res, 410, { error: 'Invite has expired.' });
        if (db.users.some(u => u.email === invite.email)) return json(res, 409, { error: 'Email already exists.' });
        const companyName = invite.role === 'provider' ? cleanText(body.company_name, 160) : null;
        if (invite.role === 'provider' && !companyName) return json(res, 400, { error: 'Provider invite acceptance requires company_name.' });
        const name = cleanText(body.name || invite.name, 120);
        if (!name) return json(res, 400, { error: 'Valid name is required.' });
        const uid = id('usr');
        const userRow = { id: uid, email: invite.email, password_hash: hash(body.password), role: invite.role, status: 'active', name, city: cleanText(body.city, 80), state: cleanText(body.state, 80), created_at: t, updated_at: t, invited_by: invite.created_by, invite_id: invite.id };
        db.users.push(userRow);
        if (invite.role === 'contractor') db.contractor_profiles.push({ user_id: uid, skills: Array.isArray(body.skills) ? body.skills : [], service_radius_miles: 25, transportation_status: 'unknown', reliability_score: 50, rating_avg: 0, completed_jobs: 0 });
        if (invite.role === 'provider') db.provider_profiles.push({ user_id: uid, company_name: companyName, provider_type: 'local_business', rating_avg: 0, completed_jobs: 0 });
        if (invite.role === 'crew') db.crew_profiles.push({ user_id: uid, crew_name: cleanText(body.crew_name, 120) || name, member_count: Number(body.member_count || 1), rating_avg: 0, completed_jobs: 0 });
        invite.used_at = t;
        invite.used_by = uid;
        complianceUser(db, uid, invite.role);
        audit(db, uid, 'invite_accepted', 'admin_invite', invite.id, { invited_by: invite.created_by, role: invite.role, user_id: uid });
        const { password_hash, ...safe } = userRow;
        return json(res, 201, { user: safe, invite: { id: invite.id, email: invite.email, role: invite.role, expires_at: invite.expires_at, used_at: invite.used_at } });
      });
    }

    if (req.method === 'GET' && p === '/api/me') { const db = loadDb(); const user = requireUser(req, res, db); if (!user) return; return json(res, 200, { user }); }

    if (req.method === 'GET' && p === '/api/admin/users') {
      const db = loadDb(); const user = requireUser(req, res, db, ['admin', 'house_command']); if (!user) return;
      const users = db.users.map(({ password_hash, ...safe }) => safe);
      return json(res, 200, { users });
    }

    if (req.method === 'GET' && p === '/api/admin/invites') {
      const db = loadDb(); const user = requireUser(req, res, db, ['admin', 'house_command']); if (!user) return;
      const invites = db.admin_invites.map(({ token_hash, ...safe }) => safe).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      return json(res, 200, { invites });
    }

    if (req.method === 'POST' && p === '/api/admin/invites') {
      const body = await readBody(req);
      return mutate(db => {
        const user = requireUser(req, res, db, ['admin', 'house_command']); if (!user) return;
        const miss = required(body, ['email', 'role']);
        if (miss) return json(res, 400, { error: `${miss} is required.` });
        const email = String(body.email || '').toLowerCase();
        if (!isEmail(email)) return json(res, 400, { error: 'Valid email is required.' });
        if (!INVITABLE_ROLES.includes(body.role)) return json(res, 400, { error: `Invite role must be one of: ${INVITABLE_ROLES.join(', ')}` });
        if (db.users.some(u => u.email === email)) return json(res, 409, { error: 'Email already exists.' });
        const activeInvite = db.admin_invites.find(x => x.email === email && !x.used_at && !x.revoked_at && x.expires_at > now());
        if (activeInvite) return json(res, 409, { error: 'An active invite already exists for this email.' });
        const expiresInHours = positiveInt(body.expires_in_hours || 72, 720);
        if (!expiresInHours) return json(res, 400, { error: 'expires_in_hours must be a positive integer no greater than 720.' });
        const token = crypto.randomBytes(24).toString('base64url');
        const t = now();
        const invite = { id: id('inv'), email, role: body.role, name: cleanText(body.name, 120), token_hash: hashToken(token), created_by: user.id, created_at: t, expires_at: new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString(), used_at: null, used_by: null, revoked_at: null, revoked_by: null };
        db.admin_invites.push(invite);
        audit(db, user, 'admin_invite_created', 'admin_invite', invite.id, { email, role: invite.role, expires_at: invite.expires_at });
        const { token_hash, ...safe } = invite;
        return json(res, 201, { invite: safe, token, accept_url: `/api/auth/accept-invite` });
      });
    }

    if ((m = routeMatch('POST', p, '/api/admin/users/:id/status'))) {
      const body = await readBody(req);
      return mutate(db => {
        const user = requireUser(req, res, db, ['admin', 'house_command']); if (!user) return;
        if (!USER_STATUSES.includes(body.status)) return json(res, 400, { error: 'Invalid user status.' });
        const target = db.users.find(u => u.id === m.id); if (!target) return json(res, 404, { error: 'User not found.' });
        if (target.id === user.id && body.status !== 'active') return json(res, 400, { error: 'Cannot suspend or disable the current operator session user.' });
        target.status = body.status; target.updated_at = now();
        if (body.status !== 'active') db.sessions = db.sessions.filter(s => s.user_id !== target.id);
        audit(db, user, 'user_status_updated', 'user', target.id, { status: body.status });
        const { password_hash, ...safe } = target;
        return json(res, 200, { user: safe });
      });
    }

    if (req.method === 'POST' && p === '/api/markets') {
      const body = await readBody(req);
      return mutate(db => {
        const user = requireUser(req, res, db, ['admin', 'house_command', 'ae']); if (!user) return;
        const miss = required(body, ['city', 'state']); if (miss) return json(res, 400, { error: `${miss} is required.` });
        let market = db.markets.find(x => x.city === body.city && x.state === body.state);
        if (!market) { market = { id: id('mkt'), city: body.city, state: body.state, status: body.status || 'open', created_at: now() }; db.markets.push(market); }
        else market.status = body.status || market.status;
        audit(db, user, 'market_upserted', 'market', market.id, market);
        return json(res, 201, { market });
      });
    }
    if (req.method === 'GET' && p === '/api/markets') { const db = loadDb(); const user = requireUser(req, res, db); if (!user) return; return json(res, 200, { markets: db.markets }); }

    if (req.method === 'POST' && p === '/api/jobs') {
      const body = await readBody(req);
      return mutate(db => {
        const user = requireUser(req, res, db, ['provider', 'ae', 'house_command', 'admin']); if (!user) return;
        const miss = required(body, ['market_id', 'title', 'category', 'description', 'location', 'starts_at', 'pay_type', 'pay_amount_cents', 'slots', 'acceptance_mode']);
        if (miss) return json(res, 400, { error: `${miss} is required.` });
        const pay = moneyCents(body.pay_amount_cents); if (!pay) return json(res, 400, { error: 'pay_amount_cents must be a positive integer.' });
        const slots = positiveInt(body.slots, 100); if (!slots) return json(res, 400, { error: 'slots must be a positive integer no greater than 100.' });
        if (!PAY_TYPES.includes(body.pay_type)) return json(res, 400, { error: 'Invalid pay_type.' });
        if (!ACCEPTANCE_MODES.includes(body.acceptance_mode)) return json(res, 400, { error: 'Invalid acceptance_mode.' });
        const title = cleanText(body.title, 160); if (!title) return json(res, 400, { error: 'Valid title is required.' });
        const category = cleanText(body.category, 80); if (!category) return json(res, 400, { error: 'Valid category is required.' });
        const description = cleanText(body.description, 3000); if (!description) return json(res, 400, { error: 'Valid description is required.' });
        const location = cleanText(body.location, 300); if (!location) return json(res, 400, { error: 'Valid location is required.' });
        const startsAt = isoDateLike(body.starts_at); if (!startsAt) return json(res, 400, { error: 'starts_at must be a valid date.' });
        const market = db.markets.find(x => x.id === body.market_id && x.status === 'open');
        if (!market) return json(res, 400, { error: 'Market not found or not open.' });
        if (body.acceptance_mode === 'single' && slots !== 1) return json(res, 400, { error: 'Single-acceptance jobs must have exactly one slot.' });
        const provider_id = user.role === 'provider' ? user.id : (body.provider_id || user.id);
        const jid = id('job'); const t = now();
        const job = { id: jid, provider_id, market_id: market.id, title, category, description, city: market.city, state: market.state, location, starts_at: startsAt, ends_at: body.ends_at || null, pay_type: body.pay_type, pay_amount_cents: pay, slots, acceptance_mode: body.acceptance_mode, status: 'open', proof_required: body.proof_required !== false, route_required: !!body.route_required, route_mode: cleanText(body.route_mode, 80) || (body.route_required ? 'single_stop' : 'none'), vehicle_type: cleanText(body.vehicle_type, 80), arrival_window: cleanText(body.arrival_window, 120), created_at: t, updated_at: t };
        db.jobs.push(job);
        if (job.route_required) planRoute(db, job, body);
        paymentAuthorizeJob(db, job);
        audit(db, user, 'job_created', 'job', jid, { city: job.city, state: job.state, slots: job.slots, acceptance_mode: job.acceptance_mode });
        return json(res, 201, { job });
      });
    }
    if (req.method === 'GET' && p === '/api/jobs') {
      const db = loadDb(); const user = requireUser(req, res, db); if (!user) return;
      let jobs = [...db.jobs];
      if (url.searchParams.get('city')) jobs = jobs.filter(j => j.city === url.searchParams.get('city'));
      if (url.searchParams.get('state')) jobs = jobs.filter(j => j.state === url.searchParams.get('state'));
      const status = url.searchParams.get('status') || 'open';
      if (status) jobs = jobs.filter(j => j.status === status || (user.role === 'contractor' && ['open', 'applicant_pool_active', 'partially_filled'].includes(j.status)));
      return json(res, 200, { jobs });
    }
    if ((m = routeMatch('GET', p, '/api/jobs/:id'))) {
      const db = loadDb(); const user = requireUser(req, res, db); if (!user) return;
      const job = db.jobs.find(j => j.id === m.id); if (!job) return json(res, 404, { error: 'Job not found.' });
      return json(res, 200, { job });
    }
    if ((m = routeMatch('POST', p, '/api/jobs/:id/apply'))) {
      const body = await readBody(req);
      return mutate(db => {
        const user = requireUser(req, res, db, ['contractor', 'crew']); if (!user) return;
        const job = db.jobs.find(j => j.id === m.id); if (!job) return json(res, 404, { error: 'Job not found.' });
        if (!['open', 'applicant_pool_active', 'partially_filled'].includes(job.status)) return json(res, 400, { error: `Job is ${job.status}; applications are closed.` });
        if (db.provider_blocks.some(b => b.provider_id === job.provider_id && b.contractor_id === user.id)) return json(res, 403, { error: 'Provider has blocked this contractor.' });
        if (job.acceptance_mode === 'roster_only' && !db.provider_rosters.some(r => r.provider_id === job.provider_id && r.contractor_id === user.id)) return json(res, 403, { error: 'This is a roster-only job.' });
        if (db.job_assignments.some(a => a.job_id === job.id && a.contractor_id === user.id && !ASSIGNMENT_CLOSED.includes(a.status))) return json(res, 409, { error: 'Already assigned to this job.' });
        if (db.job_applications.some(a => a.job_id === job.id && a.contractor_id === user.id)) return json(res, 409, { error: 'Already applied.' });
        const app = { id: id('app'), job_id: job.id, contractor_id: user.id, note: body.note || null, status: 'applied', created_at: now(), updated_at: now() };
        db.job_applications.push(app); if (job.status === 'open') job.status = 'applicant_pool_active'; job.updated_at = now();
        notify(db, job.provider_id, 'New applicant', `${user.name} applied to ${job.title}.`);
        audit(db, user, 'job_applied', 'job_application', app.id, { job_id: job.id });
        return json(res, 201, { application: app });
      });
    }
    if ((m = routeMatch('GET', p, '/api/jobs/:id/applicants'))) {
      const db = loadDb(); const user = requireUser(req, res, db); if (!user) return;
      const job = db.jobs.find(j => j.id === m.id); if (!job) return json(res, 404, { error: 'Job not found.' });
      if (!['admin', 'house_command'].includes(user.role) && job.provider_id !== user.id) return json(res, 403, { error: 'Not allowed to view this applicant pool.' });
      const applicants = db.job_applications.filter(a => a.job_id === job.id).map(a => ({ ...a, user: db.users.find(u => u.id === a.contractor_id) }));
      return json(res, 200, { job, applicants });
    }
    if ((m = routeMatch('POST', p, '/api/jobs/:id/accept-applicant'))) {
      const body = await readBody(req);
      return mutate(db => {
        const user = requireUser(req, res, db); if (!user) return;
        const job = db.jobs.find(j => j.id === m.id); if (!job) return json(res, 404, { error: 'Job not found.' });
        if (!['admin', 'house_command'].includes(user.role) && job.provider_id !== user.id) return json(res, 403, { error: 'Not allowed.' });
        const app = db.job_applications.find(a => a.id === body.application_id && a.job_id === job.id); if (!app) return json(res, 404, { error: 'Application not found.' });
        if (app.status === 'accepted') return json(res, 409, { error: 'Application is already accepted.' });
        if (app.status !== 'applied') return json(res, 400, { error: `Cannot accept application with status ${app.status}.` });
        const count = acceptedCount(db, job.id);
        if (job.acceptance_mode === 'single' && count >= 1) return json(res, 409, { error: 'Single-acceptance lock blocked over-acceptance.' });
        if (count >= job.slots) return json(res, 409, { error: 'Slot cap blocked over-acceptance.' });
        app.status = 'accepted'; app.updated_at = now();
        const asg = { id: id('asg'), job_id: job.id, application_id: app.id, contractor_id: app.contractor_id, status: 'offered', confirmed_at: null, on_way_at: null, checked_in_at: null, checked_out_at: null, provider_approved_at: null, created_at: now(), updated_at: now() };
        db.job_assignments.push(asg);
        const newCount = count + 1; job.status = newCount >= job.slots ? 'filled' : 'partially_filled'; job.updated_at = now();
        paymentCreateAssignment(db, job, asg, app.contractor_id, 'Assignment accepted; work pending.');
        complianceAssignment(db, asg);
        notify(db, app.contractor_id, 'Application accepted', `You were accepted for ${job.title}. Confirm the assignment.`);
        audit(db, user, 'applicant_accepted', 'job_assignment', asg.id, { job_id: job.id, contractor_id: app.contractor_id });
        return json(res, 201, { assignment: asg, job });
      });
    }
    if ((m = routeMatch('POST', p, '/api/jobs/:id/reject-applicant'))) {
      const body = await readBody(req);
      return mutate(db => {
        const user = requireUser(req, res, db); if (!user) return;
        const job = db.jobs.find(j => j.id === m.id); if (!job) return json(res, 404, { error: 'Job not found.' });
        if (!['admin', 'house_command'].includes(user.role) && job.provider_id !== user.id) return json(res, 403, { error: 'Not allowed.' });
        const app = db.job_applications.find(a => a.id === body.application_id && a.job_id === job.id); if (!app) return json(res, 404, { error: 'Application not found.' });
        const nextStatus = body.status || 'rejected';
        if (!['rejected', 'withdrawn'].includes(nextStatus)) return json(res, 400, { error: 'Invalid application rejection status.' });
        if (app.status === 'accepted') return json(res, 400, { error: 'Accepted applications cannot be rejected.' });
        app.status = nextStatus; app.updated_at = now();
        audit(db, user, `applicant_${app.status}`, 'job_application', app.id, { job_id: job.id });
        return json(res, 200, { application: app });
      });
    }

    const assignmentActions = { confirm: ['contractor_confirmed', 'confirmed_at', 'assignment_confirmed'], 'on-the-way': ['on_the_way', 'on_way_at', 'contractor_on_the_way'], 'check-in': ['checked_in', 'checked_in_at', 'contractor_checked_in'], 'check-out': ['checked_out', 'checked_out_at', 'contractor_checked_out'] };
    for (const action of Object.keys(assignmentActions)) {
      if ((m = routeMatch('POST', p, `/api/assignments/:id/${action}`))) return mutate(db => {
        const user = requireUser(req, res, db); if (!user) return;
        const asg = db.job_assignments.find(a => a.id === m.id); if (!asg) return json(res, 404, { error: 'Assignment not found.' });
        const job = db.jobs.find(j => j.id === asg.job_id);
        if (asg.contractor_id !== user.id && !['admin', 'house_command'].includes(user.role)) return json(res, 403, { error: 'Contractor action required.' });
        const [status, col, event] = assignmentActions[action];
        if (!assignmentTransitionAllowed(asg.status, status)) return json(res, 400, { error: `Cannot transition assignment from ${asg.status} to ${status}.` });
        asg.status = status; asg[col] = now(); asg.updated_at = now();
        audit(db, user, event, 'job_assignment', asg.id, { job_id: job.id });
        return json(res, 200, { assignment: asg });
      });
    }
    if ((m = routeMatch('POST', p, '/api/assignments/:id/proof'))) {
      const body = await readBody(req);
      const db = loadDb();
      const user = requireUser(req, res, db); if (!user) return;
      const asg = db.job_assignments.find(a => a.id === m.id); if (!asg) return json(res, 404, { error: 'Assignment not found.' });
      if (asg.contractor_id !== user.id && !['admin', 'house_command'].includes(user.role)) return json(res, 403, { error: 'Only assigned contractor or operator can submit proof.' });
      if (!assignmentTransitionAllowed(asg.status, 'proof_submitted')) return json(res, 400, { error: `Cannot submit proof from assignment status ${asg.status}.` });
      if (!body.proof_type || !body.body) return json(res, 400, { error: 'proof_type and body are required.' });
      const prf = { id: id('prf'), assignment_id: asg.id, proof_type: body.proof_type, body: body.body, media_required: !!body.media_base64, created_at: now() };
      const media = await storeProofMedia(prf.id, body);
      if (media) { db.proof_media.push(media); prf.media_id = media.id; prf.media_size_bytes = media.byte_size; }
      db.proof_items.push(prf); asg.status = 'proof_submitted'; asg.updated_at = now();
      paymentMarkAssignment(db, asg.id, 'approval_pending', 'Proof submitted; provider approval pending.');
      audit(db, user, 'proof_submitted', 'proof_item', prf.id, { assignment_id: asg.id, media_id: prf.media_id || null });
      database.save(db);
      return json(res, 201, { proof: prf, media });
    }
    if ((m = routeMatch('POST', p, '/api/assignments/:id/approve'))) return mutate(db => {
      const user = requireUser(req, res, db); if (!user) return;
      const asg = db.job_assignments.find(a => a.id === m.id); if (!asg) return json(res, 404, { error: 'Assignment not found.' });
      const job = db.jobs.find(j => j.id === asg.job_id);
      if (!['admin', 'house_command'].includes(user.role) && job.provider_id !== user.id) return json(res, 403, { error: 'Only provider/operator can approve.' });
      if (job.proof_required && !db.proof_items.some(pr => pr.assignment_id === asg.id)) return json(res, 400, { error: 'Proof required before approval.' });
      if (!assignmentTransitionAllowed(asg.status, 'completed')) return json(res, 400, { error: `Cannot approve assignment from status ${asg.status}.` });
      asg.status = 'completed'; asg.provider_approved_at = now(); asg.updated_at = now();
      paymentMarkAssignment(db, asg.id, 'payout_eligible', 'Provider approved work; payout eligible.');
      audit(db, user, 'assignment_approved', 'job_assignment', asg.id, { payment_status: 'payout_eligible' });
      return json(res, 200, { assignment: asg, payment: db.payment_ledger.find(x => x.assignment_id === asg.id) });
    });
    if ((m = routeMatch('POST', p, '/api/assignments/:id/dispute'))) {
      const body = await readBody(req);
      return mutate(db => {
        const user = requireUser(req, res, db); if (!user) return;
        const asg = db.job_assignments.find(a => a.id === m.id); if (!asg) return json(res, 404, { error: 'Assignment not found.' });
        const job = db.jobs.find(j => j.id === asg.job_id);
        if (![asg.contractor_id, job.provider_id].includes(user.id) && !['admin', 'house_command'].includes(user.role)) return json(res, 403, { error: 'Not allowed.' });
        const dis = { id: id('dis'), job_id: job.id, assignment_id: asg.id, opened_by: user.id, type: body.type || 'general', body: body.body || 'Dispute opened.', status: 'open', resolution: null, created_at: now(), updated_at: now() };
        db.disputes.push(dis);
        paymentMarkAssignment(db, asg.id, 'held', 'Dispute opened; payment held.');
        audit(db, user, 'dispute_opened', 'dispute', dis.id, { assignment_id: asg.id });
        return json(res, 201, { dispute: dis });
      });
    }

    if (req.method === 'POST' && p === '/api/ratings') {
      const body = await readBody(req);
      return mutate(db => {
        const user = requireUser(req, res, db); if (!user) return;
        const job = db.jobs.find(j => j.id === body.job_id); if (!job) return json(res, 404, { error: 'Job not found.' });
        const score = ratingScore(body.score); if (!score) return json(res, 400, { error: 'score must be an integer from 1 to 5.' });
        if (!db.users.some(u => u.id === body.to_user_id)) return json(res, 404, { error: 'Rated user not found.' });
        const related = db.job_assignments.some(a => a.job_id === job.id && (a.contractor_id === user.id || a.contractor_id === body.to_user_id)) || job.provider_id === user.id || job.provider_id === body.to_user_id;
        if (!related) return json(res, 403, { error: 'Rating must be tied to a related job.' });
        const rating = { id: id('rat'), job_id: job.id, from_user_id: user.id, to_user_id: body.to_user_id, score, note: cleanText(body.note, 1000), created_at: now() };
        db.ratings.push(rating); audit(db, user, 'rating_submitted', 'rating', rating.id, { job_id: job.id, score: rating.score });
        return json(res, 201, { rating });
      });
    }
    if (req.method === 'GET' && p === '/api/payments/ledger') {
      const db = loadDb(); const user = requireUser(req, res, db); if (!user) return;
      let payments = db.payment_ledger;
      if (user.role === 'provider') payments = payments.filter(x => x.provider_id === user.id);
      else if (!['admin', 'house_command'].includes(user.role)) payments = payments.filter(x => x.contractor_id === user.id);
      return json(res, 200, { payments });
    }
    if (req.method === 'POST' && p === '/api/provider/roster') {
      const body = await readBody(req);
      return mutate(db => {
        const user = requireUser(req, res, db, ['provider', 'admin', 'house_command']); if (!user) return;
        const provider_id = user.role === 'provider' ? user.id : body.provider_id;
        if (!body.contractor_id) return json(res, 400, { error: 'contractor_id is required.' });
        if (!db.users.some(u => u.id === body.contractor_id && ['contractor', 'crew'].includes(u.role))) return json(res, 404, { error: 'Contractor or crew user not found.' });
        if (db.provider_rosters.some(r => r.provider_id === provider_id && r.contractor_id === body.contractor_id)) return json(res, 200, { ok: true, roster: db.provider_rosters.find(r => r.provider_id === provider_id && r.contractor_id === body.contractor_id), already_exists: true });
        const row = { id: id('ros'), provider_id, contractor_id: body.contractor_id, created_at: now() };
        db.provider_rosters.push(row); audit(db, user, 'contractor_rostered', 'provider_roster', row.id, row);
        return json(res, 201, { ok: true, roster: row });
      });
    }
    if (req.method === 'POST' && p === '/api/provider/block') {
      const body = await readBody(req);
      return mutate(db => {
        const user = requireUser(req, res, db, ['provider', 'admin', 'house_command']); if (!user) return;
        const provider_id = user.role === 'provider' ? user.id : body.provider_id;
        if (!body.contractor_id) return json(res, 400, { error: 'contractor_id is required.' });
        if (!db.users.some(u => u.id === body.contractor_id && ['contractor', 'crew'].includes(u.role))) return json(res, 404, { error: 'Contractor or crew user not found.' });
        const row = { id: id('blk'), provider_id, contractor_id: body.contractor_id, reason: body.reason || null, created_at: now() };
        db.provider_blocks.push(row); audit(db, user, 'contractor_blocked', 'provider_block', row.id, row);
        return json(res, 201, { ok: true, block: row });
      });
    }
    if (req.method === 'GET' && p === '/api/provider/roster') {
      const db = loadDb(); const user = requireUser(req, res, db, ['provider', 'admin', 'house_command']); if (!user) return;
      const provider_id = user.role === 'provider' ? user.id : url.searchParams.get('provider_id');
      const roster = db.provider_rosters.filter(r => !provider_id || r.provider_id === provider_id).map(r => ({ ...r, contractor: db.users.find(u => u.id === r.contractor_id), provider: db.users.find(u => u.id === r.provider_id) }));
      return json(res, 200, { roster });
    }
    if ((m = routeMatch('DELETE', p, '/api/provider/roster/:contractorId'))) return mutate(db => {
      const user = requireUser(req, res, db, ['provider', 'admin', 'house_command']); if (!user) return;
      const provider_id = user.role === 'provider' ? user.id : url.searchParams.get('provider_id');
      const before = db.provider_rosters.length;
      db.provider_rosters = db.provider_rosters.filter(r => !(r.provider_id === provider_id && r.contractor_id === m.contractorId));
      audit(db, user, 'contractor_unrostered', 'provider_roster', m.contractorId, { removed: before - db.provider_rosters.length });
      return json(res, 200, { removed: before - db.provider_rosters.length });
    });
    if (req.method === 'GET' && p === '/api/ratings') {
      const db = loadDb(); const user = requireUser(req, res, db); if (!user) return;
      let ratings = db.ratings;
      if (!['admin', 'house_command'].includes(user.role)) ratings = ratings.filter(r => r.from_user_id === user.id || r.to_user_id === user.id);
      return json(res, 200, { ratings });
    }
    if (req.method === 'GET' && p === '/api/notifications') { const db = loadDb(); const user = requireUser(req, res, db); if (!user) return; return json(res, 200, { notifications: db.notifications.filter(n => n.user_id === user.id) }); }
    if ((m = routeMatch('POST', p, '/api/autonomous/recommend/:jobId'))) return mutate(db => {
      const user = requireUser(req, res, db, ['admin', 'house_command', 'ae', 'provider']); if (!user) return;
      const job = db.jobs.find(j => j.id === m.jobId); if (!job) return json(res, 404, { error: 'Job not found.' });
      if (user.role === 'provider' && job.provider_id !== user.id) return json(res, 403, { error: 'Not allowed.' });
      db.autonomous_recommendations = db.autonomous_recommendations.filter(r => r.job_id !== job.id);
      const recommendations = db.users.filter(u => ['contractor', 'crew'].includes(u.role) && u.status === 'active').map(u => {
        const cp = db.contractor_profiles.find(c => c.user_id === u.id) || db.crew_profiles.find(c => c.user_id === u.id) || {};
        let score = 40; const reasons = [];
        if (u.city === job.city && u.state === job.state) { score += 25; reasons.push('same_market'); }
        if (JSON.stringify(cp.skills || []).toLowerCase().includes(job.category.toLowerCase())) { score += 20; reasons.push('category_skill_match'); }
        if (db.provider_rosters.some(r => r.provider_id === job.provider_id && r.contractor_id === u.id)) { score += 20; reasons.push('provider_roster'); }
        score += Math.min(15, Math.floor((cp.reliability_score || 50) / 10));
        const rec = { id: id('rec'), job_id: job.id, contractor_id: u.id, score, reasons, created_at: now() };
        db.autonomous_recommendations.push(rec);
        return { contractor_id: u.id, name: u.name, score, reasons };
      }).sort((a, b) => b.score - a.score);
      audit(db, user, 'autonomous_recommendations_generated', 'job', job.id, { count: recommendations.length });
      return json(res, 200, { job_id: job.id, recommendations });
    });

    if (req.method === 'GET' && p === '/api/assignments') {
      const db = loadDb(); const user = requireUser(req, res, db); if (!user) return;
      let assignments = db.job_assignments.map(a => ({ ...a, job: db.jobs.find(j => j.id === a.job_id), proof_items: db.proof_items.filter(pr => pr.assignment_id === a.id), payment: db.payment_ledger.find(pay => pay.assignment_id === a.id) }));
      if (user.role === 'contractor' || user.role === 'crew') assignments = assignments.filter(a => a.contractor_id === user.id);
      else if (user.role === 'provider') assignments = assignments.filter(a => a.job && a.job.provider_id === user.id);
      else if (!['admin', 'house_command', 'ae'].includes(user.role)) assignments = [];
      return json(res, 200, { assignments });
    }
    if (req.method === 'GET' && p === '/api/provider/jobs') {
      const db = loadDb(); const user = requireUser(req, res, db, ['provider', 'admin', 'house_command', 'ae']); if (!user) return;
      let jobs = db.jobs;
      if (user.role === 'provider') jobs = jobs.filter(j => j.provider_id === user.id);
      if (url.searchParams.get('city')) jobs = jobs.filter(j => j.city === url.searchParams.get('city'));
      if (url.searchParams.get('state')) jobs = jobs.filter(j => j.state === url.searchParams.get('state'));
      jobs = jobs.map(j => ({ ...j, applicant_count: db.job_applications.filter(a => a.job_id === j.id).length, assignment_count: db.job_assignments.filter(a => a.job_id === j.id).length, payments: db.payment_ledger.filter(x => x.job_id === j.id) }));
      return json(res, 200, { jobs });
    }
    if ((m = routeMatch('POST', p, '/api/house-command/resolve-dispute'))) {
      const body = await readBody(req);
      return mutate(db => {
        const user = requireUser(req, res, db, ['admin', 'house_command']); if (!user) return;
        const dis = db.disputes.find(d => d.id === body.dispute_id); if (!dis) return json(res, 404, { error: 'Dispute not found.' });
        if (body.payment_status && !PAYMENT_STATUSES.includes(body.payment_status)) return json(res, 400, { error: 'Invalid payment_status.' });
        dis.status = 'resolved'; dis.resolution = body.resolution || 'Resolved by House Command.'; dis.updated_at = now();
        if (body.payment_status) paymentMarkAssignment(db, dis.assignment_id, body.payment_status, `Dispute resolved: ${dis.resolution}`);
        audit(db, user, 'dispute_resolved', 'dispute', dis.id, { payment_status: body.payment_status || null });
        return json(res, 200, { dispute: dis, payments: db.payment_ledger.filter(x => x.assignment_id === dis.assignment_id) });
      });
    }
    if (req.method === 'GET' && p === '/api/route-jobs') {
      const db = loadDb(); const user = requireUser(req, res, db); if (!user) return;
      let routes = db.route_jobs.map(r => ({ ...r, job: db.jobs.find(j => j.id === r.job_id), stops: db.route_stops.filter(s => s.route_job_id === r.id) }));
      if (user.role === 'provider') routes = routes.filter(r => r.job && r.job.provider_id === user.id);
      else if (user.role === 'contractor' || user.role === 'crew') { const jobIds = db.job_assignments.filter(a => a.contractor_id === user.id).map(a => a.job_id); routes = routes.filter(r => jobIds.includes(r.job_id)); }
      return json(res, 200, { routes });
    }
    if ((m = routeMatch('POST', p, '/api/route-jobs/:id/complete-stop'))) {
      const body = await readBody(req);
      return mutate(db => {
        const user = requireUser(req, res, db); if (!user) return;
        const route = db.route_jobs.find(r => r.id === m.id); if (!route) return json(res, 404, { error: 'Route job not found.' });
        const asg = db.job_assignments.find(a => a.job_id === route.job_id && a.contractor_id === user.id);
        const job = db.jobs.find(j => j.id === route.job_id);
        if (!asg && !['admin', 'house_command'].includes(user.role) && job.provider_id !== user.id) return json(res, 403, { error: 'Assigned contractor, provider, or operator required.' });
        const stop = db.route_stops.find(s => s.id === body.stop_id && s.route_job_id === route.id); if (!stop) return json(res, 404, { error: 'Route stop not found.' });
        completeRouteStop(db, route, stop, body.proof_note);
        audit(db, user, 'route_stop_completed', 'route_stop', stop.id, { route_job_id: route.id });
        return json(res, 200, { route, stop });
      });
    }
    if (req.method === 'POST' && p === '/api/house-command/assign') {
      const body = await readBody(req);
      return mutate(db => {
        const user = requireUser(req, res, db, ['admin', 'house_command']); if (!user) return;
        const job = db.jobs.find(j => j.id === body.job_id); if (!job) return json(res, 404, { error: 'Job not found.' });
        const contractor = db.users.find(u => u.id === body.contractor_id && ['contractor', 'crew'].includes(u.role) && u.status === 'active'); if (!contractor) return json(res, 404, { error: 'Active contractor or crew not found.' });
        const count = acceptedCount(db, job.id);
        if (job.acceptance_mode === 'single' && count >= 1) return json(res, 409, { error: 'Single-acceptance lock blocked operator over-assignment.' });
        if (count >= job.slots) return json(res, 409, { error: 'Slot cap blocked operator over-assignment.' });
        let app = db.job_applications.find(a => a.job_id === job.id && a.contractor_id === contractor.id);
        if (!app) { app = { id: id('app'), job_id: job.id, contractor_id: contractor.id, note: body.note || 'Assigned by House Command.', status: 'accepted', created_at: now(), updated_at: now() }; db.job_applications.push(app); }
        else { app.status = 'accepted'; app.updated_at = now(); }
        const asg = { id: id('asg'), job_id: job.id, application_id: app.id, contractor_id: contractor.id, status: 'offered', confirmed_at: null, on_way_at: null, checked_in_at: null, checked_out_at: null, provider_approved_at: null, created_at: now(), updated_at: now(), assigned_by: user.id };
        db.job_assignments.push(asg);
        const newCount = count + 1; job.status = newCount >= job.slots ? 'filled' : 'partially_filled'; job.updated_at = now();
        paymentCreateAssignment(db, job, asg, contractor.id, 'House Command assigned contractor; work pending.');
        complianceAssignment(db, asg);
        notify(db, contractor.id, 'House Command assignment', `You were assigned to ${job.title}. Confirm the assignment.`);
        audit(db, user, 'house_command_assigned_contractor', 'job_assignment', asg.id, { job_id: job.id, contractor_id: contractor.id });
        return json(res, 201, { assignment: asg, job });
      });
    }
    if (req.method === 'GET' && p === '/api/house-command/jobs') {
      const db = loadDb(); const user = requireUser(req, res, db, ['admin', 'house_command']); if (!user) return;
      const jobs = db.jobs.map(j => ({ ...j, applicant_count: db.job_applications.filter(a => a.job_id === j.id).length, assignment_count: db.job_assignments.filter(a => a.job_id === j.id).length }));
      return json(res, 200, { jobs });
    }
    if (req.method === 'POST' && p === '/api/house-command/freeze-payment') {
      const body = await readBody(req);
      return mutate(db => {
        const user = requireUser(req, res, db, ['admin', 'house_command']); if (!user) return;
        const pay = db.payment_ledger.find(x => x.id === body.payment_id); if (!pay) return json(res, 404, { error: 'Payment not found.' });
        services.payment.freeze({ payment: pay, reason: body.reason || 'Operator freeze.', now });
        audit(db, user, 'payment_frozen', 'payment_ledger', pay.id, { reason: pay.reason });
        return json(res, 200, { payment: pay });
      });
    }
    if (req.method === 'GET' && p === '/api/admin/audit-events') { const db = loadDb(); const user = requireUser(req, res, db, ['admin', 'house_command']); if (!user) return; return json(res, 200, { audit_events: db.audit_events.slice().reverse().slice(0, 500) }); }
    if (req.method === 'GET' && p === '/api/admin/audit-integrity') { const db = loadDb(); const user = requireUser(req, res, db, ['admin', 'house_command']); if (!user) return; return json(res, 200, { audit_integrity: verifyAuditChain(db.audit_events) }); }
    if (req.method === 'GET' && p === '/api/storage/status') {
      const db = loadDb(); const user = requireUser(req, res, db, ['admin', 'house_command']); if (!user) return;
      return json(res, 200, { storage: { ...database.status(), ...proofStorage.status(), proof_media_count: db.proof_media.length, export_packet_count: db.export_packets.length } });
    }
    if (req.method === 'GET' && p === '/api/storage/integrity') {
      const db = loadDb(); const user = requireUser(req, res, db, ['admin', 'house_command']); if (!user) return;
      const checks = await Promise.all(db.proof_media.map(media => proofStorage.verifyProofMedia ? proofStorage.verifyProofMedia(media) : { ok: false, id: media.id, reason: 'storage_driver_has_no_integrity_verifier' }));
      return json(res, 200, { storage_integrity: { ok: checks.every(c => c.ok), media_count: checks.length, checks } });
    }
    if (req.method === 'GET' && p === '/api/integrations/status') {
      const db = loadDb(); const user = requireUser(req, res, db, ['admin', 'house_command']); if (!user) return;
      return json(res, 200, { integrations: integrations.list(), counts: { runtime_events: db.runtime_events.length, compliance_checks: db.compliance_checks.length, notifications: db.notifications.length, payment_ledger: db.payment_ledger.length, integration_outbox: db.integration_outbox.length, integration_outbox_pending: db.integration_outbox.filter(x => x.status === 'pending').length } });
    }
    if (req.method === 'GET' && p === '/api/integrations/outbox') {
      const db = loadDb(); const user = requireUser(req, res, db, ['admin', 'house_command']); if (!user) return;
      const status = url.searchParams.get('status');
      const provider = url.searchParams.get('provider_kind');
      let rows = db.integration_outbox.slice();
      if (status) rows = rows.filter(row => row.status === status);
      if (provider) rows = rows.filter(row => row.provider_kind === provider);
      return json(res, 200, { outbox: rows.reverse().slice(0, 500) });
    }
    if ((m = routeMatch('POST', p, '/api/integrations/outbox/:id/status'))) {
      const body = await readBody(req);
      return mutate(db => {
        const user = requireUser(req, res, db, ['admin', 'house_command']); if (!user) return;
        const row = db.integration_outbox.find(x => x.id === m.id); if (!row) return json(res, 404, { error: 'Integration outbox row not found.' });
        if (!['pending', 'dispatched', 'failed'].includes(body.status)) return json(res, 400, { error: 'status must be pending, dispatched, or failed.' });
        row.status = body.status;
        row.updated_at = now();
        if (body.status === 'dispatched') row.dispatched_at = now();
        if (body.status === 'failed') { row.attempts += 1; row.last_error = cleanText(body.last_error, 500) || 'Dispatch failed.'; }
        if (body.status === 'pending') { row.last_error = null; row.dispatched_at = null; }
        audit(db, user, 'integration_outbox_status_updated', 'integration_outbox', row.id, { status: row.status, provider_kind: row.provider_kind });
        return json(res, 200, { outbox: row });
      });
    }
    if (req.method === 'GET' && p === '/api/runtime/events') {
      const db = loadDb(); const user = requireUser(req, res, db, ['admin', 'house_command']); if (!user) return;
      return json(res, 200, { runtime_events: db.runtime_events.slice().reverse().slice(0, 500) });
    }
    if (req.method === 'GET' && p === '/api/compliance/checks') {
      const db = loadDb(); const user = requireUser(req, res, db, ['admin', 'house_command']); if (!user) return;
      return json(res, 200, { compliance_checks: db.compliance_checks.slice().reverse().slice(0, 500) });
    }
    if (req.method === 'GET' && p === '/api/providers/webhooks') {
      const db = loadDb(); const user = requireUser(req, res, db, ['admin', 'house_command']); if (!user) return;
      const provider = url.searchParams.get('provider');
      let rows = db.provider_webhooks.slice();
      if (provider) rows = rows.filter(row => row.provider === provider);
      return json(res, 200, { provider_webhooks: rows.reverse().slice(0, 500) });
    }
    if ((m = routeMatch('GET', p, '/api/jobs/:id/export-packet'))) {
      const db = loadDb();
      const user = requireUser(req, res, db); if (!user) return;
      const job = db.jobs.find(j => j.id === m.id); if (!job) return json(res, 404, { error: 'Job not found.' });
      if (!jobAccessAllowed(db, user, job)) return json(res, 403, { error: 'Not allowed to export this job packet.' });
      const applications = db.job_applications.filter(a => a.job_id === job.id);
      const assignments = db.job_assignments.filter(a => a.job_id === job.id);
      const assignmentIds = assignments.map(a => a.id);
      const proof_items = db.proof_items.filter(pr => assignmentIds.includes(pr.assignment_id));
      const proof_media = db.proof_media.filter(pm => proof_items.some(pr => pr.id === pm.proof_id));
      const route_jobs = db.route_jobs.filter(r => r.job_id === job.id).map(r => ({ ...r, stops: db.route_stops.filter(s => s.route_job_id === r.id) }));
      const payments = db.payment_ledger.filter(x => x.job_id === job.id);
      const disputes = db.disputes.filter(d => d.job_id === job.id);
      const ratings = db.ratings.filter(r => r.job_id === job.id);
      const relatedAuditEvents = db.audit_events.filter(a => a.metadata?.job_id === job.id || a.entity_id === job.id || applications.some(x => x.id === a.entity_id) || assignments.some(x => x.id === a.entity_id) || proof_items.some(x => x.id === a.entity_id));
      const relatedRuntimeEvents = db.runtime_events.filter(a => a.metadata?.job_id === job.id || a.entity_id === job.id || applications.some(x => x.id === a.entity_id) || assignments.some(x => x.id === a.entity_id) || proof_items.some(x => x.id === a.entity_id));
      const relatedComplianceChecks = db.compliance_checks.filter(c => assignments.some(a => a.id === c.assignment_id) || assignments.some(a => a.contractor_id === c.user_id) || c.user_id === job.provider_id);
      const notifications = db.notifications.filter(n => [job.provider_id, ...assignments.map(a => a.contractor_id)].includes(n.user_id));
      const packet = { packet_type: 'job_proof_packet', version: VERSION, generated_at: now(), generated_by: user.id, job, applications, assignments, proof_items, proof_media, route_jobs, payments, disputes, ratings, notifications, compliance_checks: relatedComplianceChecks, audit_events: relatedAuditEvents, runtime_events: relatedRuntimeEvents };
      const file = await writeJsonExport(`JOB_PACKET_${job.id}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`, packet);
      const row = { id: id('exp'), type: 'job_packet', entity_id: job.id, path: file.path, byte_size: file.byte_size, sha256: file.sha256, created_by: user.id, created_at: now() };
      db.export_packets.push(row); audit(db, user, 'job_packet_exported', 'job', job.id, { export_packet_id: row.id, path: row.path, sha256: row.sha256 });
      database.save(db);
      return json(res, 200, { export: row, packet });
    }
    if (req.method === 'GET' && p === '/api/house-command/market-report') {
      const db = loadDb();
      const user = requireUser(req, res, db, ['admin', 'house_command']); if (!user) return;
      const city = url.searchParams.get('city'); const state = url.searchParams.get('state');
      let jobs = db.jobs; if (city) jobs = jobs.filter(j => j.city === city); if (state) jobs = jobs.filter(j => j.state === state);
      const jobIds = jobs.map(j => j.id); const assignments = db.job_assignments.filter(a => jobIds.includes(a.job_id)); const payments = db.payment_ledger.filter(x => jobIds.includes(x.job_id));
      const assignmentIds = assignments.map(a => a.id);
      const report = { packet_type: 'market_report', version: VERSION, generated_at: now(), filters: { city, state }, totals: { jobs: jobs.length, open_jobs: jobs.filter(j => ['open', 'applicant_pool_active', 'partially_filled'].includes(j.status)).length, filled_jobs: jobs.filter(j => j.status === 'filled').length, assignments: assignments.length, payout_eligible: payments.filter(x => x.status === 'payout_eligible').length, held_payments: payments.filter(x => x.status === 'held').length, disputes: db.disputes.filter(d => jobIds.includes(d.job_id)).length, route_jobs: db.route_jobs.filter(r => jobIds.includes(r.job_id)).length, notifications: db.notifications.length, compliance_checks: db.compliance_checks.filter(c => assignmentIds.includes(c.assignment_id) || assignments.some(a => a.contractor_id === c.user_id)).length, runtime_events: db.runtime_events.filter(e => jobIds.includes(e.entity_id) || assignmentIds.includes(e.entity_id) || jobIds.includes(e.metadata?.job_id)).length }, jobs: jobs.map(j => ({ id: j.id, title: j.title, city: j.city, state: j.state, status: j.status, slots: j.slots, applicants: db.job_applications.filter(a => a.job_id === j.id).length, assignments: assignments.filter(a => a.job_id === j.id).length })) };
      const file = await writeJsonExport(`MARKET_REPORT_${city || 'all'}_${state || 'all'}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`, report);
      const row = { id: id('exp'), type: 'market_report', entity_id: `${city || 'all'}:${state || 'all'}`, path: file.path, byte_size: file.byte_size, sha256: file.sha256, created_by: user.id, created_at: now() };
      db.export_packets.push(row); audit(db, user, 'market_report_exported', 'market', row.entity_id, { export_packet_id: row.id, path: row.path, sha256: row.sha256 });
      database.save(db);
      return json(res, 200, { export: row, report });
    }

    return json(res, 404, { error: 'Route not found.' });
  } catch (err) {
    return json(res, 500, { error: err.message, stack: process.env.NODE_ENV === 'production' ? undefined : err.stack });
  }
}

export { handler };
export function startServer(listenPort = port) {
  const server = http.createServer(handler);
  return new Promise(resolve => server.listen(listenPort, () => {
    console.log(`SkyeRoutexFlow Workforce Command running on http://localhost:${listenPort}`);
    resolve(server);
  }));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) startServer(port);
