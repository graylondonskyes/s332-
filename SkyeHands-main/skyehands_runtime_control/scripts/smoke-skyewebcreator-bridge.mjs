#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readAuditLedger, subscribe } from '../core/platform-bus/skyehands-platform-bus.mjs';
import {
  getWebCreatorProject,
  persistGeneratedWebCreatorArtifact,
  requestWebCreatorProject,
} from '../core/webcreator/skyewebcreator-bridge.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_FILE = path.join(ROOT, '.skyequanta', 'proofs', 'skyewebcreator-bridge-smoke.json');

const captured = {
  skydexiaRequested: 0,
  aeRequested: 0,
  aeGenerated: 0,
  deliveryQueued: 0,
};

subscribe('skydexia', 'webcreator.project.requested', () => { captured.skydexiaRequested += 1; });
subscribe('ae-commandhub', 'ae.requested', () => { captured.aeRequested += 1; });
subscribe('ae-commandhub', 'app.generated', () => { captured.aeGenerated += 1; });
subscribe('ae-commandhub', 'webcreator.delivery.queued', () => { captured.deliveryQueued += 1; });

const request = await requestWebCreatorProject({
  tenantId: 'smoke-tenant',
  workspaceId: 'smoke-webcreator-workspace',
  actorId: 'smoke-webcreator-user',
  name: 'Smoke Client Website',
  brief: 'Create a polished client website with a dashboard-ready app shell and 3D product hero option.',
  audience: 'client delivery team',
  pages: ['home', 'services', 'case-study', 'contact'],
  features: ['responsive layout', 'design-vault lookup', 'AE handoff', 'persistent artifact'],
});

const persisted = await persistGeneratedWebCreatorArtifact(request.projectId, {
  kind: 'website-package',
  title: 'Smoke Client Website Package',
  files: ['index.html', 'styles.css', 'app.js', 'README.md'],
  previewUrl: 'http://127.0.0.1:4177/smoke-client-website',
});

const project = getWebCreatorProject(request.projectId);
const audit = readAuditLedger(300);

const checks = {
  requestCreated: Boolean(request.ok && request.projectId),
  projectPersisted: Boolean(project?.id === request.projectId && project?.status === 'generated'),
  artifactPersisted: Boolean(project?.artifacts?.some((artifact) => artifact.id === persisted.artifactId)),
  skydexiaReceivedRequest: captured.skydexiaRequested > 0,
  aeReceivedRequest: captured.aeRequested > 0,
  aeReceivedGeneratedApp: captured.aeGenerated > 0,
  aeReceivedDeliveryQueued: captured.deliveryQueued > 0,
  auditHasWebCreatorRequest: audit.some((entry) => entry.envelope?.eventType === 'webcreator.project.requested' && entry.envelope?.payload?.projectId === request.projectId),
  auditHasAppGenerated: audit.some((entry) => entry.envelope?.eventType === 'app.generated' && entry.envelope?.payload?.projectId === request.projectId),
};

const result = {
  generatedAt: new Date().toISOString(),
  smoke: 'skyewebcreator-bridge',
  projectId: request.projectId,
  artifactId: persisted.artifactId,
  checks,
  passed: Object.values(checks).every(Boolean),
};

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result, null, 2));

if (!result.passed) process.exit(1);

