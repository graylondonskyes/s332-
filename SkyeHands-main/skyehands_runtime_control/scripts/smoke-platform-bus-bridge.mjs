#!/usr/bin/env node
/**
 * Directive 3.1 smoke:
 * Prove app.generated leaves SkyeHands, reaches AE, creates productization task,
 * and writes audit ledger entries.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  publish,
  subscribe,
  readAuditLedger,
} from '../core/platform-bus/skyehands-platform-bus.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ARTIFACT_DIR = path.join(ROOT, '.skyequanta', 'proofs');
const TASK_LEDGER = path.join(ROOT, '.skyequanta', 'ae-productization-tasks.ndjson');
const OUT_FILE = path.join(ARTIFACT_DIR, 'platform-bus-bridge-smoke.json');

function appendTask(task) {
  fs.mkdirSync(path.dirname(TASK_LEDGER), { recursive: true });
  fs.appendFileSync(TASK_LEDGER, `${JSON.stringify(task)}\n`);
}

async function main() {
  const captured = { received: false, taskId: null };

  subscribe('ae-commandhub', 'app.generated', async (env) => {
    captured.received = true;
    captured.taskId = `task-${env.eventId}`;
    appendTask({
      taskId: captured.taskId,
      eventId: env.eventId,
      tenantId: env.tenantId,
      workspaceId: env.workspaceId,
      sourcePlatform: env.sourcePlatform,
      targetPlatform: env.targetPlatform,
      taskType: 'productization-intake',
      createdAt: new Date().toISOString(),
      status: 'queued',
      payloadHash: env.payloadHash,
    });
  });

  const envelope = await publish({
    tenantId: 'smoke-tenant',
    workspaceId: 'smoke-workspace',
    actorId: 'smoke-runner',
    sourcePlatform: 'skyehands-codex-platform',
    targetPlatform: 'ae-commandhub',
    eventType: 'app.generated',
    payload: {
      appName: 'parent-babysitter-medical-info',
      packageId: 'pkg-smoke-001',
      fileCount: 12,
    },
  });

  const audit = readAuditLedger(200);
  const publishedAudit = audit.some((x) => x.action === 'published' && x.envelope?.eventId === envelope.eventId);
  const deliveredAudit = audit.some((x) => x.action === 'delivered' && x.envelope?.eventId === envelope.eventId && x.targetPlatform === 'ae-commandhub');

  const taskLines = fs.existsSync(TASK_LEDGER)
    ? fs.readFileSync(TASK_LEDGER, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];
  const taskFound = taskLines.some((t) => t.eventId === envelope.eventId && t.taskType === 'productization-intake');

  const result = {
    generatedAt: new Date().toISOString(),
    smoke: 'platform-bus-bridge',
    eventId: envelope.eventId,
    checks: {
      published: true,
      receivedByAE: captured.received,
      productizationTaskCreated: taskFound,
      auditPublishedEntry: publishedAudit,
      auditDeliveredEntry: deliveredAudit,
    },
  };
  result.passed = Object.values(result.checks).every(Boolean);

  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));

  console.log(JSON.stringify(result, null, 2));

  if (!result.passed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
