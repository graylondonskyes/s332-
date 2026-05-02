import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const root = process.cwd();
const proofDir = path.join(root, 'proof');
fs.mkdirSync(proofDir, { recursive: true });
const dbPath = path.join(root, 'data', 'integration-smoke-db.json');
const mediaRoot = path.join(root, 'data', 'integration-smoke-media');
const exportRoot = path.join(root, 'data', 'integration-smoke-exports');
for (const p of [dbPath, mediaRoot, exportRoot]) if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });

const port = 5859;
const env = {
  ...process.env,
  PORT: String(port),
  DATABASE_DRIVER: 'local-json',
  DATABASE_PATH: dbPath,
  STORAGE_DRIVER: 'local-json',
  MEDIA_ROOT: mediaRoot,
  EXPORT_ROOT: exportRoot,
  SKYE_ALLOW_LOCAL_PROOF_SERVICES: '1',
  PAYMENT_PROVIDER: 'ledger-only',
  NOTIFICATION_PROVIDER: 'in-app-ledger',
  ROUTE_INTELLIGENCE_PROVIDER: 'route-structure-only',
  IDENTITY_COMPLIANCE_PROVIDER: 'local-attestation-ledger',
  SKYEHANDS_RUNTIME_PROVIDER: 'standalone-local-events',
  SKYE_ADMIN_EMAIL: 'admin@integrations.internal.invalid',
  SKYE_ADMIN_PASSWORD: 'AdminIntegrations123!'
};
const server = spawn('node', ['src/server.js'], { cwd: root, env, stdio: 'ignore' });

async function req(method, url, body, session) {
  const headers = { 'content-type': 'application/json', connection: 'close' };
  if (session) headers['x-skye-session'] = session;
  const res = await fetch(`http://localhost:${port}${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}
function assert(cond, msg, data) { if (!cond) { const e = new Error(msg); e.data = data; throw e; } }
async function login(email, password) {
  const r = await req('POST', '/api/auth/login', { email, password });
  assert(r.status === 200, 'login failed ' + email, r);
  return r.json.session;
}

const proof = { started_at: new Date().toISOString(), checks: [] };
const pass = (name, data = {}) => proof.checks.push({ status: 'PASS', name, data });

try {
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`http://localhost:${port}/api/health`); if (r.ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  const health = await req('GET', '/api/health');
  assert(health.status === 200 && health.json.database_driver === 'local-json' && health.json.storage_driver === 'local-json', 'health adapter drivers failed', health);
  pass('health_reports_adapter_drivers', health.json);

  const admin = await login('admin@integrations.internal.invalid', 'AdminIntegrations123!');
  const initial = await req('GET', '/api/integrations/status', null, admin);
  assert(initial.status === 200 && initial.json.integrations.every(x => x.status === 'local-proof'), 'integration status not local-proof', initial);
  pass('integration_status_all_local_proof', { names: initial.json.integrations.map(x => x.name) });

  const market = await req('POST', '/api/markets', { city: 'Phoenix', state: 'Arizona', status: 'open' }, admin);
  assert(market.status === 201, 'market failed', market);
  const provider = await req('POST', '/api/auth/signup', { email: 'provider-integrations@example.test', password: 'Provider123!', name: 'Integration Provider', role: 'provider', city: 'Phoenix', state: 'Arizona', company_name: 'Integration Provider Co' });
  assert(provider.status === 201, 'provider signup failed', provider);
  const contractor = await req('POST', '/api/auth/signup', { email: 'contractor-integrations@example.test', password: 'Contractor123!', name: 'Integration Contractor', role: 'contractor', city: 'Phoenix', state: 'Arizona', skills: ['route', 'event'] });
  assert(contractor.status === 201, 'contractor signup failed', contractor);
  const providerSession = await login('provider-integrations@example.test', 'Provider123!');
  const contractorSession = await login('contractor-integrations@example.test', 'Contractor123!');

  const compliance = await req('GET', '/api/compliance/checks', null, admin);
  assert(compliance.status === 200 && compliance.json.compliance_checks.length >= 2 && compliance.json.compliance_checks.every(x => x.provider === 'local-attestation-ledger'), 'compliance provider did not write attestations', compliance);
  pass('compliance_attestations_written', { count: compliance.json.compliance_checks.length });

  const job = await req('POST', '/api/jobs', { market_id: market.json.market.id, title: 'Integration closure route job', category: 'event', description: 'Proves local providers are wired into workflow.', location: 'Phoenix Yard', starts_at: '2026-05-05T12:00:00.000Z', pay_type: 'fixed', pay_amount_cents: 12000, slots: 1, acceptance_mode: 'single', proof_required: true, route_required: true, route_mode: 'field_route', vehicle_type: 'van', arrival_window: 'morning', route_stops: [{ label: 'Pickup', address: 'Warehouse', proof_required: true }, { label: 'Dropoff', address: 'Venue', proof_required: true }] }, providerSession);
  assert(job.status === 201, 'route job failed', job);
  const routes = await req('GET', '/api/route-jobs', null, providerSession);
  assert(routes.status === 200 && routes.json.routes[0].route_provider === 'route-structure-only' && routes.json.routes[0].stops.every(s => s.route_provider === 'route-structure-only' && Number.isFinite(s.planned_eta_minutes)), 'route intelligence provider did not return planned route metadata', routes);
  pass('route_intelligence_wrote_route_metadata', { routeId: routes.json.routes[0].id, stops: routes.json.routes[0].stops.length });

  const apply = await req('POST', `/api/jobs/${job.json.job.id}/apply`, { note: 'Ready.' }, contractorSession);
  assert(apply.status === 201, 'apply failed', apply);
  const providerNotifications = await req('GET', '/api/notifications', null, providerSession);
  assert(providerNotifications.status === 200 && providerNotifications.json.notifications.some(n => n.delivery_provider === 'in-app-ledger' && n.delivery_status === 'stored'), 'notification provider did not write delivery ledger', providerNotifications);
  pass('notification_provider_wrote_delivery_ledger');

  const accept = await req('POST', `/api/jobs/${job.json.job.id}/accept-applicant`, { application_id: apply.json.application.id }, providerSession);
  assert(accept.status === 201, 'accept failed', accept);
  const assignmentId = accept.json.assignment.id;
  const payments0 = await req('GET', '/api/payments/ledger', null, providerSession);
  assert(payments0.status === 200 && payments0.json.payments.some(p => p.assignment_id === assignmentId && p.provider_driver === 'ledger-only'), 'payment provider did not stamp assignment ledger', payments0);
  pass('payment_provider_wrote_assignment_ledger');

  await req('POST', `/api/assignments/${assignmentId}/confirm`, {}, contractorSession);
  await req('POST', `/api/assignments/${assignmentId}/on-the-way`, {}, contractorSession);
  await req('POST', `/api/assignments/${assignmentId}/check-in`, {}, contractorSession);
  await req('POST', `/api/assignments/${assignmentId}/check-out`, {}, contractorSession);
  await req('POST', `/api/route-jobs/${routes.json.routes[0].id}/complete-stop`, { stop_id: routes.json.routes[0].stops[0].id, proof_note: 'Integration stop proof.' }, contractorSession);
  const proofSubmit = await req('POST', `/api/assignments/${assignmentId}/proof`, { proof_type: 'text', body: 'Integration proof.' }, contractorSession);
  assert(proofSubmit.status === 201, 'proof failed', proofSubmit);
  const approve = await req('POST', `/api/assignments/${assignmentId}/approve`, {}, providerSession);
  assert(approve.status === 200 && approve.json.payment.status === 'payout_eligible' && approve.json.payment.provider_driver === 'ledger-only', 'payment transition provider failed', approve);
  pass('payment_provider_advanced_payout_eligible');

  const runtime = await req('GET', '/api/runtime/events', null, admin);
  assert(runtime.status === 200 && runtime.json.runtime_events.length >= 8 && runtime.json.runtime_events.every(x => x.provider === 'standalone-local-events'), 'runtime provider did not mirror audit events', runtime);
  pass('runtime_provider_mirrored_audit_events', { count: runtime.json.runtime_events.length });

  const outbox = await req('GET', '/api/integrations/outbox?status=pending', null, admin);
  const kinds = new Set(outbox.json.outbox?.map(row => row.provider_kind));
  assert(outbox.status === 200 && outbox.json.outbox.length >= 10 && ['payment_provider', 'notification_provider', 'route_intelligence', 'identity_compliance', 'skyehands_runtime'].every(kind => kinds.has(kind)), 'integration outbox missing provider dispatch rows', outbox);
  pass('integration_outbox_collected_provider_dispatch_rows', { count: outbox.json.outbox.length, provider_kinds: [...kinds].sort() });

  const dispatched = await req('POST', `/api/integrations/outbox/${outbox.json.outbox[0].id}/status`, { status: 'dispatched' }, admin);
  assert(dispatched.status === 200 && dispatched.json.outbox.status === 'dispatched' && dispatched.json.outbox.dispatched_at, 'integration outbox dispatch status update failed', dispatched);
  pass('integration_outbox_status_can_be_marked_dispatched', { outboxId: dispatched.json.outbox.id });

  const finalStatus = await req('GET', '/api/integrations/status', null, admin);
  assert(finalStatus.status === 200 && finalStatus.json.counts.runtime_events >= 8 && finalStatus.json.counts.compliance_checks >= 3 && finalStatus.json.counts.payment_ledger >= 2 && finalStatus.json.counts.integration_outbox >= 10, 'integration counters failed', finalStatus);
  pass('integration_status_reports_live_counts', finalStatus.json.counts);

  const packet = await req('GET', `/api/jobs/${job.json.job.id}/export-packet`, null, providerSession);
  assert(packet.status === 200 && packet.json.packet.runtime_events.length >= 1 && packet.json.packet.compliance_checks.length >= 1 && packet.json.packet.notifications.length >= 1 && packet.json.packet.payments.every(p => p.provider_driver === 'ledger-only'), 'job packet provider evidence missing', packet);
  pass('job_packet_contains_provider_evidence', { runtime_events: packet.json.packet.runtime_events.length, compliance_checks: packet.json.packet.compliance_checks.length, notifications: packet.json.packet.notifications.length });

  const marketReport = await req('GET', '/api/house-command/market-report?city=Phoenix&state=Arizona', null, admin);
  assert(marketReport.status === 200 && marketReport.json.report.totals.runtime_events >= 1 && marketReport.json.report.totals.compliance_checks >= 1, 'market report provider totals missing', marketReport);
  pass('market_report_contains_provider_totals', marketReport.json.report.totals);

  proof.completed_at = new Date().toISOString();
  proof.status = 'PASS';
} catch (err) {
  proof.failed_at = new Date().toISOString();
  proof.status = 'FAIL';
  proof.failure = err.message;
  proof.data = err.data || null;
  console.error(err);
  process.exitCode = 1;
} finally {
  const out = path.join(proofDir, `SMOKE_INTEGRATIONS_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(out, JSON.stringify(proof, null, 2));
  console.log(`Integration proof written: ${out}`);
  try { process.kill(server.pid, 'SIGKILL'); } catch {}
  process.exit(process.exitCode || 0);
}
