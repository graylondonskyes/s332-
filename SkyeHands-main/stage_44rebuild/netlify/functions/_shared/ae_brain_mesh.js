/**
 * AE Brain Mesh — inter-brain communication layer
 * Directive section 5.2
 *
 * Message types: consult, handoff, escalation, review, quote-request,
 *   appointment-request, commerce-request, launch-request, support-request
 *
 * Max-hop protection prevents uncontrolled brain loops.
 * Per-task transcript records all inter-brain messages.
 */

'use strict';

const crypto = require('node:crypto');
const { getBrain, brainHasPermission } = require('./ae_brain_registry');
const { enqueueTask, auditLog } = require('./ae_brain_state');

const MESSAGE_TYPES = [
  'consult',
  'handoff',
  'escalation',
  'review',
  'quote-request',
  'appointment-request',
  'commerce-request',
  'launch-request',
  'support-request',
];

const MAX_HOPS = 5;
const _transcripts = new Map();

// ─── Send a brain message ─────────────────────────────────────────────────

async function sendBrainMessage({
  fromBrainId,
  toBrainId,
  tenantId,
  taskId,
  messageType,
  payload,
  permissionScope,
  traceId,
  hopCount = 0,
}) {
  if (!MESSAGE_TYPES.includes(messageType)) {
    throw new Error(`Unknown message type: ${messageType}`);
  }

  if (hopCount >= MAX_HOPS) {
    throw new Error(`Max hop limit (${MAX_HOPS}) reached. fromBrain=${fromBrainId} toBrain=${toBrainId} traceId=${traceId}`);
  }

  const fromBrain = getBrain(fromBrainId);
  const toBrain = getBrain(toBrainId);

  // Permission check — fromBrain must have mesh permission
  const requiredPerm = messageType === 'handoff' ? 'ae.mesh.handoff'
    : messageType === 'escalation' ? 'ae.mesh.escalation'
    : 'ae.mesh.consult';

  if (!brainHasPermission(fromBrainId, requiredPerm)) {
    throw new Error(`Brain ${fromBrainId} lacks permission: ${requiredPerm}`);
  }

  const messageId = crypto.randomUUID();
  const envelope = {
    messageId,
    traceId: traceId ?? crypto.randomUUID(),
    fromBrainId,
    toBrainId,
    tenantId,
    taskId,
    messageType,
    payload,
    permissionScope: permissionScope ?? [],
    hopCount,
    sentAt: new Date().toISOString(),
  };

  // Record in transcript
  _appendTranscript(taskId, envelope);

  // Enqueue as task for the target brain
  await enqueueTask(tenantId, toBrainId, {
    taskId: crypto.randomUUID(),
    type: `mesh.${messageType}`,
    payload: { message: envelope },
  });

  // Audit both sides
  await auditLog(tenantId, fromBrainId, `mesh.sent.${messageType}`, `→ ${toBrainId} traceId=${envelope.traceId}`);
  await auditLog(tenantId, toBrainId, `mesh.received.${messageType}`, `← ${fromBrainId} traceId=${envelope.traceId}`);

  return envelope;
}

// ─── Onboarding → Growth → Commerce → Appointment scenario ────────────────

async function runOnboardingScenario({ tenantId, productizationId, appName }) {
  const traceId = crypto.randomUUID();
  const baseTask = { taskId: productizationId ?? crypto.randomUUID(), tenantId };

  const steps = [];

  // Onboarding → Growth
  const step1 = await sendBrainMessage({
    fromBrainId: 'ae-onboarding',
    toBrainId: 'ae-growth',
    tenantId,
    taskId: baseTask.taskId,
    messageType: 'handoff',
    payload: { appName, stage: 'offer-positioning', productizationId },
    traceId,
    hopCount: 0,
  });
  steps.push(step1);

  // Growth → Commerce
  const step2 = await sendBrainMessage({
    fromBrainId: 'ae-growth',
    toBrainId: 'ae-commerce',
    tenantId,
    taskId: baseTask.taskId,
    messageType: 'commerce-request',
    payload: { appName, stage: 'pricing-setup', productizationId },
    traceId: step1.traceId,
    hopCount: 1,
  });
  steps.push(step2);

  // Commerce → Appointment
  const step3 = await sendBrainMessage({
    fromBrainId: 'ae-commerce',
    toBrainId: 'ae-appointment',
    tenantId,
    taskId: baseTask.taskId,
    messageType: 'appointment-request',
    payload: { appName, stage: 'scheduling-link', productizationId },
    traceId: step1.traceId,
    hopCount: 2,
  });
  steps.push(step3);

  // Onboarding → Media/Marketing
  const step4 = await sendBrainMessage({
    fromBrainId: 'ae-onboarding',
    toBrainId: 'ae-media-marketing',
    tenantId,
    taskId: baseTask.taskId,
    messageType: 'launch-request',
    payload: { appName, stage: 'launch-content', productizationId },
    traceId: step1.traceId,
    hopCount: 1,
  });
  steps.push(step4);

  return { traceId: step1.traceId, steps, taskId: baseTask.taskId };
}

// ─── Transcript ───────────────────────────────────────────────────────────

function _appendTranscript(taskId, envelope) {
  if (!_transcripts.has(taskId)) _transcripts.set(taskId, []);
  _transcripts.get(taskId).push(envelope);
}

function getTranscript(taskId) {
  return _transcripts.get(taskId) ?? [];
}

module.exports = {
  sendBrainMessage,
  runOnboardingScenario,
  getTranscript,
  MESSAGE_TYPES,
  MAX_HOPS,
};
