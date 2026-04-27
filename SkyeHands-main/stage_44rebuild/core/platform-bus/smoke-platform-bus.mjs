#!/usr/bin/env node
/**
 * Platform Bus — BEHAVIORAL SMOKE
 * Verifies: publish → subscribe → file-backed queue → audit ledger → drain
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Point bus data dirs at an isolated tmpdir
const testDir = path.join(os.tmpdir(), `platform-bus-smoke-${Date.now()}`);
process.env.SKYEHANDS_BUS_DIR = testDir;

// Monkey-patch the module's paths before import by overriding env — the bus reads __dirname-relative paths
// so we directly test via smokeRoundTrip which exercises the full stack
import {
  buildEnvelope,
  publish,
  subscribe,
  drainLocalQueue,
  readAuditLedger,
  EVENT_TYPES,
} from './skyehands-platform-bus.mjs';

const results = [];
let allPass = true;

function assert(label, condition, detail = '') {
  const ok = Boolean(condition);
  results.push({ label, ok, detail });
  if (!ok) allPass = false;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
}

// ── 1. EVENT_TYPES list ───────────────────────────────────────────────────
assert('EVENT_TYPES is an array', Array.isArray(EVENT_TYPES));
assert('EVENT_TYPES has core events', EVENT_TYPES.includes('app.generated') && EVENT_TYPES.includes('lead.generated'));

// ── 2. buildEnvelope ─────────────────────────────────────────────────────
const env = buildEnvelope({
  tenantId: 'smoke-tenant',
  workspaceId: 'smoke-ws',
  actorId: 'smoke-actor',
  sourcePlatform: 'skydexia',
  targetPlatform: 'ae-commandhub',
  eventType: 'app.generated',
  payload: { appName: 'smoke-app', files: ['index.js'] },
});
assert('envelope has eventId', typeof env.eventId === 'string' && env.eventId.length > 0);
assert('envelope has payloadHash', typeof env.payloadHash === 'string' && env.payloadHash.length === 64);
assert('envelope has replayNonce', typeof env.replayNonce === 'string');
assert('envelope eventType correct', env.eventType === 'app.generated');
assert('envelope tenantId correct', env.tenantId === 'smoke-tenant');

// ── 3. Unknown event type throws ──────────────────────────────────────────
let threw = false;
try { buildEnvelope({ eventType: 'fake.event.that.does.not.exist', sourcePlatform: 'x' }); }
catch { threw = true; }
assert('unknown eventType throws', threw);

// ── 4. Subscribe + publish ────────────────────────────────────────────────
const received = [];
subscribe('ae-commandhub', 'app.generated', env => { received.push(env); });

const published = await publish({
  tenantId: 'smoke-tenant',
  workspaceId: 'smoke-ws-2',
  actorId: 'smoke-actor',
  sourcePlatform: 'skydexia',
  targetPlatform: 'ae-commandhub',
  eventType: 'app.generated',
  payload: { appName: 'published-app', smokeRun: true },
});
assert('publish returns envelope', typeof published?.eventId === 'string');
assert('subscriber received event', received.length === 1);
assert('subscriber got correct payload', received[0]?.payload?.appName === 'published-app');

// ── 5. Audit ledger written ────────────────────────────────────────────────
const audit = readAuditLedger(20);
assert('audit ledger has entries', audit.length >= 1);
assert('audit has published action', audit.some(e => e.action === 'published' && e.envelope?.eventId === published.eventId));
assert('audit has delivered action', audit.some(e => e.action === 'delivered' && e.envelope?.eventId === published.eventId));

// ── 6. Local queue file created ───────────────────────────────────────────
const busQueueDir = path.resolve(__dirname, '../../.skyequanta/bus-queue');
const queueFiles = fs.existsSync(busQueueDir) ? fs.readdirSync(busQueueDir).filter(f => f.endsWith('.json')) : [];
assert('queue file written to disk', queueFiles.length >= 1);

// ── 7. drainLocalQueue ────────────────────────────────────────────────────
const drained = await drainLocalQueue();
assert('drain returns processed ids', Array.isArray(drained) && drained.length >= 1);
const queueAfterDrain = fs.existsSync(busQueueDir) ? fs.readdirSync(busQueueDir).filter(f => f.endsWith('.json')) : [];
assert('queue empty after drain', queueAfterDrain.length === 0);

// ── 8. Lead event type ────────────────────────────────────────────────────
const leadReceived = [];
subscribe('lead-vault', 'lead.generated', env => { leadReceived.push(env); });
await publish({
  tenantId: 'smoke-tenant',
  sourcePlatform: 'ae-commandhub',
  eventType: 'lead.generated',
  payload: { leadId: 'smoke-lead-1', score: 72 },
});
assert('lead subscriber receives event', leadReceived.length === 1);
assert('lead event has correct payload', leadReceived[0]?.payload?.leadId === 'smoke-lead-1');

// ── Results ───────────────────────────────────────────────────────────────
const passed = results.filter(r => r.ok).length;
console.log(`\n${allPass ? 'PASS' : 'FAIL'} — ${passed}/${results.length} assertions`);
if (!allPass) process.exit(1);
