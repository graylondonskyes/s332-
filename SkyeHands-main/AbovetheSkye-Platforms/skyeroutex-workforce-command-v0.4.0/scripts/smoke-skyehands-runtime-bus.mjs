import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createPlatformServices } from '../src/adapters/platform-services.js';

const root = process.cwd();
const proofDir = path.join(root, 'proof');
const busRoot = fs.mkdtempSync(path.join(root, 'data', 'runtime-bus-proof-'));
fs.mkdirSync(proofDir, { recursive: true });

const proof = { started_at: new Date().toISOString(), checks: [] };
const pass = (name, data = {}) => proof.checks.push({ status: 'PASS', name, data });

function assert(cond, message, data) {
  if (!cond) {
    const error = new Error(message);
    error.data = data;
    throw error;
  }
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function now() {
  return new Date().toISOString();
}

try {
  const services = createPlatformServices({
    env: {
      ...process.env,
      SKYEHANDS_RUNTIME_PROVIDER: 'skyehands-runtime-bus',
      SKYEHANDS_RUNTIME_BUS_DIR: busRoot,
      SKYEHANDS_RUNTIME_TENANT_ID: 'smoke-tenant',
      SKYEHANDS_RUNTIME_WORKSPACE_ID: 'skyeroutex-workforce-command-smoke'
    }
  });
  assert(services.runtime.driver === 'skyehands-runtime-bus' && services.runtime.status === 'connected', 'runtime bus provider did not initialize', services.runtime);
  pass('runtime_bus_provider_initializes');

  const db = { runtime_events: [] };
  const row = services.runtime.emit({
    db,
    id,
    now,
    event: {
      id: 'aud_smoke_runtime_bus',
      event_type: 'job_posted',
      entity_type: 'job',
      entity_id: 'job_smoke_runtime_bus',
      actor_user_id: 'usr_smoke_runtime_bus',
      metadata: { job_id: 'job_smoke_runtime_bus', source: 'smoke' }
    }
  });

  assert(db.runtime_events.length === 1 && row.external_dispatch?.status === 'published', 'runtime event was not persisted and published', row);
  pass('runtime_event_persisted_with_bus_dispatch', { event_id: row.external_dispatch.event_id });

  const queueFile = row.external_dispatch.queue_file;
  assert(fs.existsSync(queueFile), 'runtime bus queue file was not written', row.external_dispatch);
  const envelope = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
  assert(envelope.sourcePlatform === 'skyeroutex-workforce-command' && envelope.payload.original_event_type === 'job_posted', 'runtime bus envelope does not carry original event context', envelope);
  const expectedHash = crypto.createHash('sha256').update(JSON.stringify(envelope.payload)).digest('hex');
  assert(envelope.payloadHash === expectedHash, 'runtime bus payload hash mismatch', envelope);
  pass('runtime_bus_envelope_written_with_payload_hash', { event_id: envelope.eventId, payload_hash: envelope.payloadHash });

  const auditLedger = row.external_dispatch.audit_ledger;
  assert(fs.existsSync(auditLedger), 'runtime bus audit ledger was not written', row.external_dispatch);
  const auditLines = fs.readFileSync(auditLedger, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
  assert(auditLines.some(line => line.action === 'published' && line.envelope?.eventId === envelope.eventId), 'runtime bus audit ledger missing published entry', auditLines);
  pass('runtime_bus_audit_ledger_records_publish');

  proof.status = 'PASS';
  proof.completed_at = new Date().toISOString();
} catch (err) {
  proof.status = 'FAIL';
  proof.failed_at = new Date().toISOString();
  proof.failure = err.message;
  proof.data = err.data || null;
  console.error(err);
  process.exitCode = 1;
} finally {
  const out = path.join(proofDir, `SMOKE_SKYEHANDS_RUNTIME_BUS_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(out, JSON.stringify(proof, null, 2));
  fs.rmSync(busRoot, { recursive: true, force: true });
  console.log(`SkyeHands runtime bus proof written: ${out}`);
  process.exit(process.exitCode || 0);
}
