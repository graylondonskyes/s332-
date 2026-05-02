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
const dynastyRoot = path.join(repoRoot, 'Dynasty-Versions');
const proofDir = path.join(runtimeRoot, '.skyequanta', 'proofs');
const outFile = path.join(proofDir, 'creator-ide-mesh-smoke.json');

const platformRoots = [
  'AbovetheSkye-Platforms/SuperIDEv2',
  'AbovetheSkye-Platforms/SuperIDEv3.8',
  'AbovetheSkye-Platforms/skAIxuIDEPro',
  'AbovetheSkye-Platforms/SkyeWebCreatorMax',
  'AbovetheSkye-Platforms/SkyDexia',
  'AbovetheSkye-Platforms/SkyeForgeMax',
  'AbovetheSkye-Platforms/skyeroutex-workforce-command-v0.4.0',
];

const manifests = [
  'platform/user-platforms/superidev2/skyehands.platform.json',
  'platform/user-platforms/superidev3/skyehands.platform.json',
  'platform/user-platforms/skaixu-ide-pro/skyehands.platform.json',
];

const captured = {};
function track(platformId, eventType) {
  const key = `${platformId}:${eventType}`;
  captured[key] = 0;
  subscribe(platformId, eventType, () => { captured[key] += 1; });
}

[
  ['superidev2', 'ide.project.created'],
  ['superidev3', 'ide.project.created'],
  ['skaixu-ide-pro', 'ide.project.created'],
  ['ae-commandhub', 'ide.project.created'],
  ['skydexia', 'ide.project.created'],
  ['skyewebcreator-max', 'ide.project.created'],
  ['skyeforgemax', 'ide.project.created'],
  ['ae-commandhub', 'ide.agent.requested'],
  ['skydexia', 'ide.agent.requested'],
  ['superidev3', 'ide.agent.requested'],
  ['skaixu-ide-pro', 'ide.agent.requested'],
  ['ae-commandhub', 'ide.release.packaged'],
  ['skydexia', 'ide.release.packaged'],
  ['skyewebcreator-max', 'ide.release.packaged'],
  ['skyeforgemax', 'ide.release.packaged'],
  ['superidev2', 'ide.release.packaged'],
  ['superidev3', 'ide.release.packaged'],
  ['skaixu-ide-pro', 'ide.release.packaged'],
  ['skydexia', 'webcreator.project.requested'],
  ['ae-commandhub', 'webcreator.project.generated'],
  ['skydexia', 'webcreator.project.generated'],
  ['skyewebcreator-max', 'webcreator.project.generated'],
  ['superidev2', 'webcreator.project.generated'],
  ['superidev3', 'webcreator.project.generated'],
  ['skaixu-ide-pro', 'webcreator.project.generated'],
  ['ae-commandhub', 'app.generated'],
  ['superidev2', 'app.generated'],
  ['superidev3', 'app.generated'],
  ['skaixu-ide-pro', 'app.generated'],
].forEach(([platformId, eventType]) => track(platformId, eventType));

const tenantId = 'creator-ide-mesh-smoke';
const workspaceId = 'creator-owned-build-workspace';
const actorId = 'skaixu-ide-pro';

const missingPlatformRoots = platformRoots.filter((relativePath) => !fs.existsSync(path.join(repoRoot, relativePath)));
const missingManifests = manifests.filter((relativePath) => !fs.existsSync(path.join(dynastyRoot, relativePath)));

const published = [];
async function emit(eventType, targetPlatform, payload, sourcePlatform = 'skaixu-ide-pro') {
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

await emit('ide.project.created', null, {
  projectId: 'creator-project-restaurant-os-001',
  title: 'Restaurant Operating Company OS',
  originIde: 'skAIxu IDE Pro',
  capabilities: ['code', 'website', 'storefront', 'jobs', 'dispatch', 'orders', 'release-package'],
});

await emit('ide.agent.requested', null, {
  projectId: 'creator-project-restaurant-os-001',
  requestedAgents: ['skydexia-architect', 'ae-operator', 'routex-dispatch-planner'],
  purpose: 'Turn creator intent into platform tasks and release artifacts.',
});

const webProject = await requestWebCreatorProject({
  tenantId,
  workspaceId,
  actorId,
  name: 'Creator Restaurant OS Website',
  brief: 'Create a creator-owned restaurant operating company surface with storefront, jobs, dispatch, order status, and admin command views.',
  audience: 'restaurant owner operators',
  pages: ['home', 'storefront', 'jobs', 'dispatch', 'orders', 'admin'],
  features: ['IDE project handoff', 'SkyeWebCreatorMax package', 'SkyDexia design reasoning', 'AE delivery queue'],
});

const artifact = await persistGeneratedWebCreatorArtifact(webProject.projectId, {
  kind: 'creator-ide-release-package',
  title: 'Creator Restaurant OS Release Package',
  files: ['index.html', 'storefront.js', 'jobs.js', 'dispatch.js', 'orders.js', 'README.md'],
  previewUrl: 'abovetheskye://creator-restaurant-os',
});

await emit('ide.release.packaged', null, {
  projectId: 'creator-project-restaurant-os-001',
  webProjectId: webProject.projectId,
  artifactId: artifact.artifactId,
  packageType: 'full-stack-platform-release',
  releaseTargets: ['SuperIDEv3', 'skAIxu IDE Pro', 'SkyeWebCreatorMax', 'SkyeForgeMax', 'AE CommandHub'],
});

const audit = readAuditLedger(800);
const eventSeen = (eventType) => audit.some((entry) => entry.action === 'published' && entry.envelope?.eventType === eventType && entry.envelope?.tenantId === tenantId);
const delivered = (platformId, eventType) => (captured[`${platformId}:${eventType}`] || 0) > 0;

const checks = {
  idePlatformRootsPresent: missingPlatformRoots.length === 0,
  ideManifestsRegistered: missingManifests.length === 0,
  ideProjectReachedAllIdes: delivered('superidev2', 'ide.project.created') && delivered('superidev3', 'ide.project.created') && delivered('skaixu-ide-pro', 'ide.project.created'),
  ideProjectReachedPlanningAndBuildPlatforms: delivered('ae-commandhub', 'ide.project.created') && delivered('skydexia', 'ide.project.created') && delivered('skyewebcreator-max', 'ide.project.created') && delivered('skyeforgemax', 'ide.project.created'),
  agentRequestReachedCommandAndReasoning: delivered('ae-commandhub', 'ide.agent.requested') && delivered('skydexia', 'ide.agent.requested'),
  webCreatorBridgeGeneratedPackage: delivered('skydexia', 'webcreator.project.requested') && delivered('ae-commandhub', 'app.generated'),
  generatedProjectReachedPlanningAndIdes: delivered('ae-commandhub', 'webcreator.project.generated') && delivered('skydexia', 'webcreator.project.generated') && delivered('skyewebcreator-max', 'webcreator.project.generated') && delivered('superidev2', 'webcreator.project.generated') && delivered('superidev3', 'webcreator.project.generated') && delivered('skaixu-ide-pro', 'webcreator.project.generated'),
  generatedAppReturnedToIdes: delivered('superidev2', 'app.generated') && delivered('superidev3', 'app.generated') && delivered('skaixu-ide-pro', 'app.generated'),
  releasePackageReachedAllBuildSurfaces: delivered('ae-commandhub', 'ide.release.packaged') && delivered('skydexia', 'ide.release.packaged') && delivered('skyewebcreator-max', 'ide.release.packaged') && delivered('skyeforgemax', 'ide.release.packaged') && delivered('superidev2', 'ide.release.packaged') && delivered('superidev3', 'ide.release.packaged') && delivered('skaixu-ide-pro', 'ide.release.packaged'),
  auditContainsIdeMesh: ['ide.project.created', 'ide.agent.requested', 'webcreator.project.requested', 'app.generated', 'ide.release.packaged'].every(eventSeen),
};

const result = {
  generatedAt: new Date().toISOString(),
  smoke: 'creator-ide-mesh',
  tenantId,
  workspaceId,
  webProjectId: webProject.projectId,
  artifactId: artifact.artifactId,
  published,
  captured,
  missingPlatformRoots,
  missingManifests,
  checks,
  passed: Object.values(checks).every(Boolean),
};

fs.mkdirSync(proofDir, { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result, null, 2));

if (!result.passed) process.exit(1);
