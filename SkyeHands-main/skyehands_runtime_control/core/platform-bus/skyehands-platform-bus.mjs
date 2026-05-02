/**
 * SkyeHands Platform Bus — canonical cross-platform event bus
 * Directive section 3.1
 *
 * Transports:
 *   - LOCAL (default): file-backed queue in .skyequanta/bus-queue/
 *   - PRODUCTION: Cloudflare Queue / Neon-backed outbox (injected via PlatformBus.useTransport())
 *
 * Event envelope fields:
 *   eventId, tenantId, workspaceId, actorId, sourcePlatform, targetPlatform,
 *   eventType, payload, payloadHash, createdAt, replayNonce
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUS_ROOT = process.env.SKYEHANDS_BUS_DIR
  ? path.resolve(process.env.SKYEHANDS_BUS_DIR)
  : path.resolve(__dirname, '../../.skyequanta');
const BUS_QUEUE_DIR = path.join(BUS_ROOT, 'bus-queue');
const AUDIT_LEDGER = path.join(BUS_ROOT, 'bus-audit.ndjson');

// ─── Allowed event types ───────────────────────────────────────────────────

export const EVENT_TYPES = [
  'workspace.created',
  'workspace.opened',
  'workspace.paused',
  'workspace.archived',
  'workspace.deleted',
  'app.generated',
  'app.packaged',
  'app.shipped',
  'document.created',
  'document.exported',
  'ide.project.created',
  'ide.agent.requested',
  'ide.release.packaged',
  'webcreator.project.requested',
  'webcreator.project.generated',
  'webcreator.asset.persisted',
  'webcreator.delivery.queued',
  'ae.requested',
  'ae.brain.consulted',
  'ae.brain.handoff',
  'ae.brain.escalation',
  'commerce.product.created',
  'commerce.order.created',
  'commerce.webhook.received',
  'mail.message.queued',
  'mail.message.sent',
  'proof.created',
  'brand.asset.created',
  'gateway.key.created',
  'pdf.document.generated',
  'valuation.report.created',
  'business.launch.requested',
  'funnel.lead.captured',
  'identity.verified',
  'qr.asset.created',
  'seo.snapshot.created',
  'profit.metric.updated',
  'chat.message.created',
  'merchant.onboarded',
  'workforce.job.posted',
  'dispatch.requested',
  'storefront.requested',
  'storefront.published',
  'media.asset.created',
  'lead.generated',
  'lead.qualified',
  'deployment.requested',
  'deployment.completed',
  'smoke.completed',
  'billing.updated',
];

// ─── Platform subscription registry ───────────────────────────────────────

const PLATFORM_SUBSCRIPTIONS = {
  'ae-commandhub': [
    'app.generated', 'app.packaged', 'lead.generated', 'lead.qualified',
    'ae.requested', 'ae.brain.consulted', 'ae.brain.handoff', 'ae.brain.escalation',
    'deployment.requested', 'billing.updated',
    'webcreator.project.requested', 'webcreator.project.generated', 'webcreator.delivery.queued',
    'ide.project.created', 'ide.agent.requested', 'ide.release.packaged',
    'mail.message.queued', 'mail.message.sent', 'proof.created', 'pdf.document.generated',
    'valuation.report.created', 'business.launch.requested', 'funnel.lead.captured',
    'identity.verified', 'profit.metric.updated',
  ],
  'skyewebcreator-max': [
    'webcreator.project.requested', 'webcreator.project.generated',
    'webcreator.asset.persisted', 'webcreator.delivery.queued',
    'app.generated', 'app.packaged', 'deployment.requested', 'deployment.completed',
    'smoke.completed', 'ide.project.created', 'ide.release.packaged',
    'brand.asset.created', 'business.launch.requested', 'funnel.lead.captured',
    'qr.asset.created', 'seo.snapshot.created',
  ],
  'maggies-store': [
    'commerce.product.created', 'commerce.order.created', 'commerce.webhook.received',
    'merchant.onboarded', 'storefront.requested', 'business.launch.requested',
  ],
  'printful-commerce': [
    'commerce.product.created', 'commerce.order.created', 'commerce.webhook.received',
    'app.shipped',
  ],
  'appointment-setter': [
    'ae.requested', 'lead.generated', 'lead.qualified', 'merchant.onboarded', 'ae.brain.escalation',
    'funnel.lead.captured', 'mail.message.queued',
  ],
  'lead-vault': [
    'lead.generated', 'lead.qualified', 'merchant.onboarded', 'ae.requested',
    'funnel.lead.captured', 'mail.message.queued', 'business.launch.requested',
  ],
  'media-center': [
    'media.asset.created', 'app.generated', 'brand.asset.created',
  ],
  'music-nexus': [
    'media.asset.created', 'brand.asset.created',
  ],
  'skydexia': [
    'workspace.created', 'workspace.opened', 'app.generated',
    'webcreator.project.requested', 'webcreator.project.generated',
    'webcreator.asset.persisted', 'webcreator.delivery.queued',
    'merchant.onboarded', 'storefront.requested', 'storefront.published',
    'ide.project.created', 'ide.agent.requested', 'ide.release.packaged',
    'brand.asset.created', 'document.created', 'document.exported', 'proof.created',
    'pdf.document.generated', 'business.launch.requested', 'funnel.lead.captured',
    'identity.verified', 'qr.asset.created', 'seo.snapshot.created',
  ],
  'skyeroutex-workforce-command': [
    'merchant.onboarded', 'workforce.job.posted', 'dispatch.requested',
    'commerce.order.created', 'storefront.published',
  ],
  'skye-routex': [
    'dispatch.requested', 'commerce.order.created', 'workforce.job.posted',
  ],
  'skyehands-codex-platform': [
    'workspace.created', 'workspace.opened', 'workspace.paused', 'workspace.archived',
    'workspace.deleted', 'app.generated', 'deployment.requested', 'deployment.completed',
    'smoke.completed', 'ide.agent.requested', 'proof.created',
  ],
  'superidev2': [
    'ide.project.created', 'ide.agent.requested', 'ide.release.packaged',
    'webcreator.project.generated', 'app.generated', 'app.packaged',
    'document.created', 'document.exported', 'proof.created', 'pdf.document.generated',
  ],
  'superidev3': [
    'ide.project.created', 'ide.agent.requested', 'ide.release.packaged',
    'webcreator.project.generated', 'app.generated', 'app.packaged',
    'deployment.requested', 'deployment.completed',
    'document.created', 'document.exported', 'proof.created', 'pdf.document.generated',
    'mail.message.queued', 'mail.message.sent',
  ],
  'skaixu-ide-pro': [
    'ide.project.created', 'ide.agent.requested', 'ide.release.packaged',
    'webcreator.project.generated', 'app.generated', 'app.packaged',
    'deployment.requested', 'deployment.completed',
    'document.created', 'document.exported', 'proof.created', 'pdf.document.generated',
    'gateway.key.created', 'chat.message.created',
  ],
  'skyeforgemax': [
    'ide.project.created', 'ide.release.packaged', 'app.generated', 'app.packaged',
    'document.exported', 'pdf.document.generated', 'proof.created',
  ],
  'skymail': [
    'merchant.onboarded', 'lead.generated', 'lead.qualified', 'mail.message.queued',
    'mail.message.sent', 'business.launch.requested', 'funnel.lead.captured',
  ],
  'skyeproofx': [
    'proof.created', 'document.exported', 'identity.verified', 'valuation.report.created',
    'smoke.completed',
  ],
  'valleyverified-v2': [
    'identity.verified', 'workforce.job.posted', 'merchant.onboarded', 'proof.created',
  ],
  'jobping': [
    'workforce.job.posted', 'merchant.onboarded', 'funnel.lead.captured',
  ],
  'skye-gatefs13': [
    'gateway.key.created', 'identity.verified', 'proof.created', 'commerce.webhook.received',
    'deployment.requested', 'deployment.completed',
  ],
  'kaixu-gateway13': [
    'gateway.key.created', 'chat.message.created', 'billing.updated', 'proof.created',
  ],
  'kaixu-pdf-pro': [
    'pdf.document.generated', 'document.exported', 'proof.created', 'valuation.report.created',
  ],
  'kaixu-brandkit': [
    'brand.asset.created', 'media.asset.created', 'webcreator.project.requested',
  ],
  'businesslaunchgo': [
    'business.launch.requested', 'merchant.onboarded', 'lead.generated',
  ],
  'duallane-funnel': [
    'funnel.lead.captured', 'lead.generated', 'lead.qualified', 'mail.message.queued',
  ],
  'brandid-offline-pwa': [
    'identity.verified', 'brand.asset.created', 'proof.created',
  ],
  'qr-code-generator': [
    'qr.asset.created', 'brand.asset.created', 'media.asset.created',
  ],
  'local-seo-snapshot': [
    'seo.snapshot.created', 'business.launch.requested', 'lead.generated',
  ],
  'skye-profit-console': [
    'profit.metric.updated', 'commerce.order.created', 'billing.updated',
  ],
  'skyeprofitconsole': [
    'profit.metric.updated', 'commerce.order.created', 'billing.updated',
  ],
  'kaixu-chat': [
    'chat.message.created', 'gateway.key.created', 'ae.brain.consulted',
  ],
};

export const REGISTERED_PLATFORMS = Object.keys(PLATFORM_SUBSCRIPTIONS).sort();

// ─── Registered subscribers (runtime) ─────────────────────────────────────

const _subscribers = new Map();
const _deliveredEventIds = new Set();

// ─── Transport abstraction ─────────────────────────────────────────────────

let _transport = null;

export function useTransport(transport) {
  _transport = transport;
}

// ─── Envelope builder ──────────────────────────────────────────────────────

export function buildEnvelope({
  tenantId,
  workspaceId,
  actorId,
  sourcePlatform,
  targetPlatform,
  eventType,
  payload,
}) {
  if (!EVENT_TYPES.includes(eventType)) {
    throw new Error(`Unknown event type: ${eventType}`);
  }
  if (!sourcePlatform || typeof sourcePlatform !== 'string') {
    throw new Error('sourcePlatform is required');
  }
  if (!PLATFORM_SUBSCRIPTIONS[sourcePlatform]) {
    throw new Error(`Unknown sourcePlatform: ${sourcePlatform}`);
  }
  if (targetPlatform && !PLATFORM_SUBSCRIPTIONS[targetPlatform]) {
    throw new Error(`Unknown targetPlatform: ${targetPlatform}`);
  }
  const payloadStr = JSON.stringify(payload ?? {});
  const payloadHash = crypto.createHash('sha256').update(payloadStr).digest('hex');
  const replayNonce = crypto.randomBytes(16).toString('hex');

  return {
    eventId: crypto.randomUUID(),
    tenantId: tenantId ?? 'default',
    workspaceId: workspaceId ?? null,
    actorId: actorId ?? 'system',
    sourcePlatform,
    targetPlatform: targetPlatform ?? null,
    eventType,
    payload: JSON.parse(payloadStr),
    payloadHash,
    createdAt: new Date().toISOString(),
    replayNonce,
  };
}

// ─── Publish ───────────────────────────────────────────────────────────────

export async function publish(envelopeParams) {
  const envelope = buildEnvelope(envelopeParams);

  if (_transport) {
    await _transport.send(envelope);
  } else {
    await _localQueueSend(envelope);
  }

  _writeAudit({ action: 'published', envelope, status: 'sent' });
  await _deliverToSubscribers(envelope);

  return envelope;
}

// ─── Subscribe ─────────────────────────────────────────────────────────────

export function subscribe(platformId, eventType, handler) {
  const allowed = PLATFORM_SUBSCRIPTIONS[platformId];
  if (!allowed) {
    throw new Error(`Platform not registered: ${platformId}`);
  }
  if (!allowed.includes(eventType)) {
    throw new Error(`Platform ${platformId} is not allowed to subscribe to ${eventType}`);
  }

  const key = `${platformId}::${eventType}`;
  if (!_subscribers.has(key)) _subscribers.set(key, []);
  _subscribers.get(key).push(handler);
}

// ─── Local file-backed queue ───────────────────────────────────────────────

async function _localQueueSend(envelope) {
  fs.mkdirSync(BUS_QUEUE_DIR, { recursive: true });
  const file = path.join(BUS_QUEUE_DIR, `${envelope.eventId}.json`);
  fs.writeFileSync(file, JSON.stringify(envelope, null, 2));
}

export async function drainLocalQueue() {
  if (!fs.existsSync(BUS_QUEUE_DIR)) return [];
  const files = fs.readdirSync(BUS_QUEUE_DIR).filter(f => f.endsWith('.json'));
  const processed = [];
  for (const file of files) {
    const envelope = JSON.parse(fs.readFileSync(path.join(BUS_QUEUE_DIR, file), 'utf8'));
    if (_deliveredEventIds.has(envelope.eventId)) {
      _writeAudit({ action: 'duplicate-skipped', envelope, status: 'ok' });
    } else {
      await _deliverToSubscribers(envelope);
    }
    fs.unlinkSync(path.join(BUS_QUEUE_DIR, file));
    processed.push(envelope.eventId);
  }
  return processed;
}

// ─── Subscriber delivery ───────────────────────────────────────────────────

async function _deliverToSubscribers(envelope) {
  if (_deliveredEventIds.has(envelope.eventId)) {
    _writeAudit({ action: 'duplicate-skipped', envelope, status: 'ok' });
    return;
  }
  _deliveredEventIds.add(envelope.eventId);
  for (const [platformId, allowedTypes] of Object.entries(PLATFORM_SUBSCRIPTIONS)) {
    if (!allowedTypes.includes(envelope.eventType)) continue;
    if (envelope.targetPlatform && envelope.targetPlatform !== platformId) continue;

    const key = `${platformId}::${envelope.eventType}`;
    const handlers = _subscribers.get(key) ?? [];
    for (const handler of handlers) {
      try {
        await handler(envelope);
        _writeAudit({ action: 'delivered', envelope, targetPlatform: platformId, status: 'ok' });
      } catch (err) {
        _writeAudit({ action: 'delivery-failed', envelope, targetPlatform: platformId, status: 'error', error: err.message });
      }
    }
  }
}

// ─── Audit ledger ─────────────────────────────────────────────────────────

function _writeAudit(entry) {
  const line = JSON.stringify({ ...entry, at: new Date().toISOString() }) + '\n';
  try {
    fs.mkdirSync(path.dirname(AUDIT_LEDGER), { recursive: true });
    fs.appendFileSync(AUDIT_LEDGER, line);
  } catch {
    // audit failures must not crash the bus
  }
}

export function readAuditLedger(limit = 100) {
  if (!fs.existsSync(AUDIT_LEDGER)) return [];
  const lines = fs.readFileSync(AUDIT_LEDGER, 'utf8').trim().split('\n').filter(Boolean);
  return lines.slice(-limit).map(l => JSON.parse(l));
}

// ─── Smoke helper ─────────────────────────────────────────────────────────

export async function smokeRoundTrip({ tenantId = 'smoke-tenant', workspaceId = 'smoke-ws' } = {}) {
  const received = [];
  subscribe('ae-commandhub', 'app.generated', env => { received.push(env); });

  const envelope = await publish({
    tenantId,
    workspaceId,
    actorId: 'smoke-actor',
    sourcePlatform: 'skydexia',
    targetPlatform: 'ae-commandhub',
    eventType: 'app.generated',
    payload: { appName: 'smoke-test-app', files: ['index.js'], smokeRun: true },
  });

  const audit = readAuditLedger(10);
  const delivered = audit.some(e => e.action === 'delivered' && e.envelope?.eventId === envelope.eventId);

  return {
    published: true,
    eventId: envelope.eventId,
    receivedBySubscriber: received.length > 0,
    auditEntryPresent: delivered,
    passed: received.length > 0 && delivered,
  };
}
