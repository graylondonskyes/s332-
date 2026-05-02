#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { publish, readAuditLedger, subscribe } from '../core/platform-bus/skyehands-platform-bus.mjs';
import {
  persistGeneratedWebCreatorArtifact,
  requestWebCreatorProject,
} from '../core/webcreator/skyewebcreator-bridge.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runtimeRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(runtimeRoot, '..');
const proofDir = path.join(runtimeRoot, '.skyequanta', 'proofs');
const outFile = path.join(proofDir, 'autonomous-company-flow-smoke.json');

const requiredPlatformRoots = [
  'AbovetheSkye-Platforms/AppointmentSetter',
  'AbovetheSkye-Platforms/JobPing',
  'AbovetheSkye-Platforms/MaggiesStore',
  'AbovetheSkye-Platforms/SkyDexia',
  'AbovetheSkye-Platforms/SkyeForgeMax',
  'AbovetheSkye-Platforms/SkyeLeadVault',
  'AbovetheSkye-Platforms/SkyeMediaCenter',
  'AbovetheSkye-Platforms/SkyeMusicNexus',
  'AbovetheSkye-Platforms/SkyeRoutex',
  'AbovetheSkye-Platforms/SkyeWebCreatorMax',
  'AbovetheSkye-Platforms/skyeroutex-workforce-command-v0.4.0',
];

const captured = {};
function track(platformId, eventType) {
  const key = `${platformId}:${eventType}`;
  captured[key] = 0;
  subscribe(platformId, eventType, () => { captured[key] += 1; });
}

[
  ['lead-vault', 'merchant.onboarded'],
  ['lead-vault', 'lead.generated'],
  ['appointment-setter', 'merchant.onboarded'],
  ['appointment-setter', 'lead.generated'],
  ['ae-commandhub', 'ae.requested'],
  ['skydexia', 'webcreator.project.requested'],
  ['skydexia', 'storefront.requested'],
  ['skyewebcreator-max', 'webcreator.project.generated'],
  ['ae-commandhub', 'app.generated'],
  ['ae-commandhub', 'webcreator.delivery.queued'],
  ['maggies-store', 'merchant.onboarded'],
  ['maggies-store', 'storefront.requested'],
  ['maggies-store', 'commerce.product.created'],
  ['maggies-store', 'commerce.order.created'],
  ['skyeroutex-workforce-command', 'merchant.onboarded'],
  ['skyeroutex-workforce-command', 'storefront.published'],
  ['skyeroutex-workforce-command', 'workforce.job.posted'],
  ['skyeroutex-workforce-command', 'dispatch.requested'],
  ['skye-routex', 'dispatch.requested'],
  ['skye-routex', 'commerce.order.created'],
].forEach(([platformId, eventType]) => track(platformId, eventType));

const tenantId = 'restaurant-onboarding-smoke';
const workspaceId = 'restaurant-autonomous-company-flow';
const actorId = 'ae-commandhub';
const merchant = {
  merchantId: 'merchant-smoke-restaurant-001',
  businessName: 'Smoke Test Restaurant',
  vertical: 'restaurant',
  market: 'Phoenix',
  wantsJobs: true,
  wantsDispatch: true,
  wantsStorefront: true,
  wantsOrders: true,
};

const published = [];
async function emit(eventType, targetPlatform, payload, sourcePlatform = 'ae-commandhub') {
  const envelope = await publish({
    tenantId,
    workspaceId,
    actorId,
    sourcePlatform,
    targetPlatform,
    eventType,
    payload,
  });
  published.push({ eventType, targetPlatform, eventId: envelope.eventId });
  return envelope;
}

const missingPlatformRoots = requiredPlatformRoots.filter((relativePath) => !fs.existsSync(path.join(repoRoot, relativePath)));

await emit('merchant.onboarded', null, merchant);
await emit('lead.generated', null, {
  ...merchant,
  leadId: 'lead-smoke-restaurant-001',
  source: 'restaurant-onboarding',
});
await emit('ae.requested', 'ae-commandhub', {
  merchantId: merchant.merchantId,
  requestType: 'autonomous-company-onboarding',
  requiredCapabilities: ['jobs', 'dispatch', 'orders', 'storefront'],
});

const webProject = await requestWebCreatorProject({
  tenantId,
  workspaceId,
  actorId,
  name: `${merchant.businessName} Autonomous Storefront`,
  brief: 'Restaurant onboarding needs a public website, autonomous storefront, order intake, dispatch handoff, and hiring calls to action.',
  audience: 'restaurant customers and local operators',
  pages: ['home', 'menu', 'order', 'jobs', 'dispatch-status', 'contact'],
  features: ['storefront publishing', 'order intake', 'job posting handoff', 'dispatch handoff', 'AE command followup'],
});
published.push(
  { eventType: 'webcreator.project.requested', targetPlatform: 'skydexia', eventId: webProject.requestEventId },
  { eventType: 'ae.requested', targetPlatform: 'ae-commandhub', eventId: webProject.aeEventId },
);

await emit('storefront.requested', null, {
  merchantId: merchant.merchantId,
  projectId: webProject.projectId,
  storefrontType: 'restaurant',
});

const artifact = await persistGeneratedWebCreatorArtifact(webProject.projectId, {
  kind: 'restaurant-storefront-package',
  title: `${merchant.businessName} Storefront Package`,
  files: ['index.html', 'menu.json', 'orders.js', 'jobs.js', 'dispatch.js'],
  previewUrl: `abovetheskye://storefronts/${merchant.merchantId}`,
});
published.push(
  { eventType: 'webcreator.project.generated', targetPlatform: null, eventId: artifact.generatedEventId },
  { eventType: 'app.generated', targetPlatform: null, eventId: artifact.appGeneratedEventId },
  { eventType: 'webcreator.delivery.queued', targetPlatform: 'ae-commandhub', eventId: artifact.deliveryQueuedEventId },
);

await emit('storefront.published', null, {
  merchantId: merchant.merchantId,
  projectId: webProject.projectId,
  artifactId: artifact.artifactId,
  previewUrl: `abovetheskye://storefronts/${merchant.merchantId}`,
}, 'skyewebcreator-max');

await emit('commerce.product.created', 'maggies-store', {
  merchantId: merchant.merchantId,
  productId: 'restaurant-menu-smoke-001',
  kind: 'menu',
  channel: 'storefront',
});
await emit('commerce.order.created', null, {
  merchantId: merchant.merchantId,
  orderId: 'order-smoke-restaurant-001',
  fulfillment: 'dispatch-required',
  amountCents: 4200,
});
await emit('workforce.job.posted', 'skyeroutex-workforce-command', {
  merchantId: merchant.merchantId,
  jobId: 'job-smoke-dinner-rush-001',
  role: 'Dinner rush courier',
  slots: 3,
  dispatchRequired: true,
});
await emit('dispatch.requested', null, {
  merchantId: merchant.merchantId,
  orderId: 'order-smoke-restaurant-001',
  jobId: 'job-smoke-dinner-rush-001',
  pickup: 'Smoke Test Restaurant',
  dropoffZone: 'Phoenix local',
});

const audit = readAuditLedger(600);
const publishedEventIds = published.reduce((acc, event) => {
  if (event.eventId) {
    if (!acc.has(event.eventType)) acc.set(event.eventType, []);
    acc.get(event.eventType).push(event.eventId);
  }
  return acc;
}, new Map());
const eventSeen = (eventType) => {
  const eventIds = publishedEventIds.get(eventType) || [];
  return eventIds.some((eventId) => audit.some((entry) => entry.action === 'published' && entry.envelope?.eventId === eventId && entry.envelope?.tenantId === tenantId));
};
const delivered = (platformId, eventType) => (captured[`${platformId}:${eventType}`] || 0) > 0;

const checks = {
  platformRootsOrganized: missingPlatformRoots.length === 0,
  merchantOnboardingReachedLeadVault: delivered('lead-vault', 'merchant.onboarded'),
  merchantOnboardingReachedAppointmentSetter: delivered('appointment-setter', 'merchant.onboarded'),
  leadReachedLeadVaultAndAppointmentSetter: delivered('lead-vault', 'lead.generated') && delivered('appointment-setter', 'lead.generated'),
  merchantOnboardingReachedWorkforceCommand: delivered('skyeroutex-workforce-command', 'merchant.onboarded'),
  aeCommandReceivedOnboardingRequest: delivered('ae-commandhub', 'ae.requested'),
  webCreatorRequestedSkydexiaDesign: delivered('skydexia', 'webcreator.project.requested'),
  storefrontRequestedFromSkydexia: delivered('skydexia', 'storefront.requested'),
  storefrontRequestReachedCommerce: delivered('maggies-store', 'storefront.requested'),
  storefrontPublishedReachedWorkforceCommand: delivered('skyeroutex-workforce-command', 'storefront.published'),
  storefrontPublishedBackToWebCreator: delivered('skyewebcreator-max', 'webcreator.project.generated'),
  aeCommandReceivedGeneratedStorefront: delivered('ae-commandhub', 'app.generated') && delivered('ae-commandhub', 'webcreator.delivery.queued'),
  maggiesStoreReceivedProductAndOrder: delivered('maggies-store', 'commerce.product.created') && delivered('maggies-store', 'commerce.order.created'),
  routexReceivedOrderContext: delivered('skye-routex', 'commerce.order.created'),
  workforceCommandReceivedJob: delivered('skyeroutex-workforce-command', 'workforce.job.posted'),
  workforceCommandReceivedDispatchContext: delivered('skyeroutex-workforce-command', 'dispatch.requested'),
  routexReceivedDispatch: delivered('skye-routex', 'dispatch.requested'),
  auditContainsCompanyFlow: [
    'merchant.onboarded',
    'lead.generated',
    'ae.requested',
    'webcreator.project.requested',
    'storefront.requested',
    'storefront.published',
    'webcreator.project.generated',
    'app.generated',
    'commerce.product.created',
    'commerce.order.created',
    'workforce.job.posted',
    'dispatch.requested',
  ].every(eventSeen),
};

const result = {
  generatedAt: new Date().toISOString(),
  smoke: 'autonomous-company-flow',
  tenantId,
  workspaceId,
  merchant,
  webProjectId: webProject.projectId,
  storefrontArtifactId: artifact.artifactId,
  published,
  captured,
  missingPlatformRoots,
  checks,
  passed: Object.values(checks).every(Boolean),
};

fs.mkdirSync(proofDir, { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result, null, 2));

if (!result.passed) process.exit(1);
