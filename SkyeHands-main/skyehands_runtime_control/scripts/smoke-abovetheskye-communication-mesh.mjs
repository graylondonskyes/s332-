#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { publish, readAuditLedger, subscribe } from '../core/platform-bus/skyehands-platform-bus.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runtimeRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(runtimeRoot, '..');
const proofDir = path.join(runtimeRoot, '.skyequanta', 'proofs');
const outFile = path.join(proofDir, 'abovetheskye-communication-mesh-smoke.json');

const tenantId = 'abovetheskye-communication-smoke';
const workspaceId = 'autonomous-company-platform-mesh';
const actorId = 'skyehands-platform-mesh';

const platformRoots = [
  'AbovetheSkye-Platforms/AppointmentSetter',
  'AbovetheSkye-Platforms/BusinessLaunchGo',
  'AbovetheSkye-Platforms/DualLaneFunnel',
  'AbovetheSkye-Platforms/JobPing',
  'AbovetheSkye-Platforms/MaggiesStore',
  'AbovetheSkye-Platforms/SkyeDocxMax',
  'AbovetheSkye-Platforms/SkyeGateFS13',
  'AbovetheSkye-Platforms/SkyeLeadVault',
  'AbovetheSkye-Platforms/SkyeMail',
  'AbovetheSkye-Platforms/SkyeProofx',
  'AbovetheSkye-Platforms/SkyeRoutex',
  'AbovetheSkye-Platforms/SkyeWebCreatorMax',
  'AbovetheSkye-Platforms/SuperIDEv2',
  'AbovetheSkye-Platforms/SuperIDEv3.8',
  'AbovetheSkye-Platforms/ValleyVerified-v2',
  'AbovetheSkye-Platforms/kAIxU-PDF-Pro',
  'AbovetheSkye-Platforms/kAIxUBrandKit',
  'AbovetheSkye-Platforms/kAIxUGateway13',
  'AbovetheSkye-Platforms/skAIxuIDEPro',
  'AbovetheSkye-Platforms/skyeroutex-workforce-command-v0.4.0',
];

const captures = {};
function track(platformId, eventType) {
  const key = `${platformId}:${eventType}`;
  captures[key] = 0;
  subscribe(platformId, eventType, () => { captures[key] += 1; });
}

[
  ['businesslaunchgo', 'business.launch.requested'],
  ['lead-vault', 'business.launch.requested'],
  ['skyewebcreator-max', 'business.launch.requested'],
  ['maggies-store', 'business.launch.requested'],
  ['duallane-funnel', 'funnel.lead.captured'],
  ['lead-vault', 'funnel.lead.captured'],
  ['appointment-setter', 'funnel.lead.captured'],
  ['skymail', 'mail.message.queued'],
  ['appointment-setter', 'mail.message.queued'],
  ['superidev3', 'mail.message.queued'],
  ['jobping', 'workforce.job.posted'],
  ['valleyverified-v2', 'workforce.job.posted'],
  ['skyeroutex-workforce-command', 'workforce.job.posted'],
  ['skye-routex', 'workforce.job.posted'],
  ['skydexia', 'document.exported'],
  ['superidev2', 'document.exported'],
  ['superidev3', 'document.exported'],
  ['skyeforgemax', 'document.exported'],
  ['kaixu-pdf-pro', 'document.exported'],
  ['kaixu-pdf-pro', 'pdf.document.generated'],
  ['ae-commandhub', 'pdf.document.generated'],
  ['skaixu-ide-pro', 'pdf.document.generated'],
  ['skyeproofx', 'proof.created'],
  ['skye-gatefs13', 'proof.created'],
  ['kaixu-gateway13', 'proof.created'],
  ['kaixu-brandkit', 'brand.asset.created'],
  ['media-center', 'brand.asset.created'],
  ['skyewebcreator-max', 'brand.asset.created'],
  ['skydexia', 'brand.asset.created'],
  ['skye-gatefs13', 'gateway.key.created'],
  ['kaixu-gateway13', 'gateway.key.created'],
  ['skaixu-ide-pro', 'gateway.key.created'],
  ['kaixu-chat', 'chat.message.created'],
  ['skaixu-ide-pro', 'chat.message.created'],
  ['ae-commandhub', 'profit.metric.updated'],
  ['skye-profit-console', 'profit.metric.updated'],
  ['skyeprofitconsole', 'profit.metric.updated'],
  ['skydexia', 'seo.snapshot.created'],
  ['local-seo-snapshot', 'seo.snapshot.created'],
  ['qr-code-generator', 'qr.asset.created'],
  ['skyewebcreator-max', 'qr.asset.created'],
].forEach(([platformId, eventType]) => track(platformId, eventType));

const published = [];
async function emit(eventType, sourcePlatform, payload, targetPlatform = null) {
  const envelope = await publish({ tenantId, workspaceId, actorId, sourcePlatform, targetPlatform, eventType, payload });
  published.push({ eventType, sourcePlatform, targetPlatform, eventId: envelope.eventId });
  return envelope;
}

await emit('business.launch.requested', 'businesslaunchgo', {
  businessId: 'restaurant-growth-co-001',
  vertical: 'restaurant',
  requestedSurfaces: ['website', 'storefront', 'jobs', 'dispatch', 'email', 'proof-pack'],
});
await emit('funnel.lead.captured', 'duallane-funnel', {
  leadId: 'lead-restaurant-owner-001',
  source: 'dual-lane-funnel',
  intent: 'restaurant operating company onboarding',
});
await emit('mail.message.queued', 'skymail', { messageId: 'mail-client-onboarding-001', to: 'owner@example.test' });
await emit('workforce.job.posted', 'jobping', { jobId: 'job-dinner-shift-001', role: 'line cook', market: 'Phoenix' });
await emit('document.exported', 'superidev3', { documentId: 'doc-restaurant-os-spec', format: 'pdf' });
await emit('pdf.document.generated', 'kaixu-pdf-pro', { documentId: 'pdf-client-launch-pack-001', template: 'client-launch-pack' });
await emit('proof.created', 'skyeproofx', { proofId: 'proof-autonomous-company-mesh', scope: 'restaurant onboarding' });
await emit('brand.asset.created', 'kaixu-brandkit', { assetId: 'brand-restaurant-system-001', assetType: 'identity-kit' });
await emit('gateway.key.created', 'kaixu-gateway13', { keyId: 'gateway-key-client-001', scopes: ['chat', 'commerce', 'webcreator'] });
await emit('chat.message.created', 'kaixu-chat', { messageId: 'chat-client-command-001', channel: 'operator-assist' });
await emit('profit.metric.updated', 'skye-profit-console', { metricId: 'profit-restaurant-weekly-001', grossRevenue: 24750 });
await emit('seo.snapshot.created', 'local-seo-snapshot', { snapshotId: 'seo-restaurant-local-001', market: 'Phoenix' });
await emit('qr.asset.created', 'qr-code-generator', { qrId: 'qr-menu-storefront-001', target: 'storefront' });

const delivered = (platformId, eventType) => (captures[`${platformId}:${eventType}`] || 0) > 0;
const missingPlatformRoots = platformRoots.filter((relativePath) => !fs.existsSync(path.join(repoRoot, relativePath)));
const audit = readAuditLedger(1200);
const auditHasEveryPublishedEvent = published.every((event) => audit.some((entry) => entry.action === 'published' && entry.envelope?.eventId === event.eventId));

const checks = {
  platformRootsPresent: missingPlatformRoots.length === 0,
  businessLaunchFanout: delivered('businesslaunchgo', 'business.launch.requested') && delivered('lead-vault', 'business.launch.requested') && delivered('skyewebcreator-max', 'business.launch.requested') && delivered('maggies-store', 'business.launch.requested'),
  funnelLeadFanout: delivered('duallane-funnel', 'funnel.lead.captured') && delivered('lead-vault', 'funnel.lead.captured') && delivered('appointment-setter', 'funnel.lead.captured'),
  mailFanout: delivered('skymail', 'mail.message.queued') && delivered('appointment-setter', 'mail.message.queued') && delivered('superidev3', 'mail.message.queued'),
  workforceFanout: delivered('jobping', 'workforce.job.posted') && delivered('valleyverified-v2', 'workforce.job.posted') && delivered('skyeroutex-workforce-command', 'workforce.job.posted') && delivered('skye-routex', 'workforce.job.posted'),
  documentAndPdfFanout: delivered('skydexia', 'document.exported') && delivered('superidev2', 'document.exported') && delivered('superidev3', 'document.exported') && delivered('kaixu-pdf-pro', 'pdf.document.generated') && delivered('ae-commandhub', 'pdf.document.generated') && delivered('skaixu-ide-pro', 'pdf.document.generated'),
  proofFanout: delivered('skyeproofx', 'proof.created') && delivered('skye-gatefs13', 'proof.created') && delivered('kaixu-gateway13', 'proof.created'),
  brandFanout: delivered('kaixu-brandkit', 'brand.asset.created') && delivered('media-center', 'brand.asset.created') && delivered('skyewebcreator-max', 'brand.asset.created') && delivered('skydexia', 'brand.asset.created'),
  gatewayAndChatFanout: delivered('skye-gatefs13', 'gateway.key.created') && delivered('kaixu-gateway13', 'gateway.key.created') && delivered('skaixu-ide-pro', 'gateway.key.created') && delivered('kaixu-chat', 'chat.message.created') && delivered('skaixu-ide-pro', 'chat.message.created'),
  growthOpsFanout: delivered('skye-profit-console', 'profit.metric.updated') && delivered('skyeprofitconsole', 'profit.metric.updated') && delivered('local-seo-snapshot', 'seo.snapshot.created') && delivered('qr-code-generator', 'qr.asset.created'),
  auditHasEveryPublishedEvent,
};

const result = {
  generatedAt: new Date().toISOString(),
  smoke: 'abovetheskye-communication-mesh',
  tenantId,
  workspaceId,
  published,
  captures,
  missingPlatformRoots,
  checks,
  passed: Object.values(checks).every(Boolean),
};

fs.mkdirSync(proofDir, { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result, null, 2));

if (!result.passed) process.exit(1);
