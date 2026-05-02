/**
 * SkyeWebCreatorMax bridge.
 *
 * This is the code-backed handoff layer between the standalone website/UI creator,
 * SkyDexia, AE CommandHub, and the SkyeHands platform bus.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { publish } from '../platform-bus/skyehands-platform-bus.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME_ROOT = path.resolve(__dirname, '../..');
const WEB_CREATOR_ROOT = path.join(RUNTIME_ROOT, '.skyequanta', 'webcreator');
const PROJECTS_DIR = path.join(WEB_CREATOR_ROOT, 'projects');
const PROJECT_INDEX = path.join(WEB_CREATOR_ROOT, 'projects-index.json');
const DELIVERY_LEDGER = path.join(WEB_CREATOR_ROOT, 'ae-delivery.ndjson');
const REQUIRED_LOCAL_SURFACES = [
  'AbovetheSkye-Platforms/SkyeWebCreatorMax/index.html',
  'AbovetheSkye-Platforms/SkyeWebCreatorMax/js/webcreator.js',
  'AbovetheSkye-Platforms/SkyeWebCreatorMax/RELEASE_MANIFEST.json',
  'design-vault/library/use-case-matrix.json',
  'design-vault/library/templates/template-catalog.json',
  'design-vault/library/catalog/pattern-index.json',
  'design-vault/library/catalog/source-index.json',
];
const PRODUCTION_ENV_VARS = [
  'SKYEWEB_PUBLIC_BASE_URL',
  'SKYEWEB_R2_ACCOUNT_ID',
  'SKYEWEB_R2_BUCKET',
  'SKYEWEB_R2_ACCESS_KEY_ID',
  'SKYEWEB_R2_SECRET_ACCESS_KEY',
  'SKYEWEB_AE_DELIVERY_ENDPOINT',
  'SKYEWEB_SKYDEXIA_ENDPOINT',
  'SKYGATEFS13_BASE_URL',
  'SKYGATEFS13_EVENT_MIRROR_SECRET',
  'SKYGATEFS13_APP_CLIENT_ID',
  'SKYGATEFS13_APP_CLIENT_SECRET',
];

function nowIso() {
  return new Date().toISOString();
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function appendNdjson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(payload)}\n`, 'utf8');
}

function slugify(value) {
  return String(value || 'web-project')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'web-project';
}

function projectIdFromSpec(spec) {
  const seed = JSON.stringify({
    name: spec.name,
    tenantId: spec.tenantId,
    workspaceId: spec.workspaceId,
    requestedAt: spec.requestedAt,
  });
  return `swc-${slugify(spec.name)}-${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 10)}`;
}

export function validateWebCreatorSpec(spec = {}) {
  const errors = [];
  if (!spec.name || typeof spec.name !== 'string') errors.push('name is required');
  if (!spec.brief || typeof spec.brief !== 'string') errors.push('brief is required');
  if (spec.name && String(spec.name).trim().length > 140) errors.push('name must be 140 characters or fewer');
  if (spec.brief && String(spec.brief).trim().length > 12000) errors.push('brief must be 12000 characters or fewer');
  if (spec.pages && !Array.isArray(spec.pages)) errors.push('pages must be an array when provided');
  if (spec.features && !Array.isArray(spec.features)) errors.push('features must be an array when provided');
  return errors;
}

export function getWebCreatorRuntimePaths() {
  return {
    runtimeRoot: RUNTIME_ROOT,
    webCreatorRoot: WEB_CREATOR_ROOT,
    projectsDir: PROJECTS_DIR,
    projectIndex: PROJECT_INDEX,
    deliveryLedger: DELIVERY_LEDGER,
  };
}

export function getWebCreatorProductionReadiness(options = {}) {
  const repoRoot = options.repoRoot || path.resolve(RUNTIME_ROOT, '..');
  const missingLocalSurfaces = REQUIRED_LOCAL_SURFACES.filter((relativePath) => !fs.existsSync(path.join(repoRoot, relativePath)));
  const missingProductionVars = PRODUCTION_ENV_VARS.filter((name) => !process.env[name]);
  const localReady = missingLocalSurfaces.length === 0;
  return {
    localReady,
    productionReady: localReady && missingProductionVars.length === 0,
    allowedProductionBlockers: missingProductionVars.map((name) => ({
      name,
      type: 'missing-env-var',
    })),
    missingLocalSurfaces,
    requiredProductionEnvVars: PRODUCTION_ENV_VARS,
  };
}

export function listWebCreatorProjects() {
  return readJson(PROJECT_INDEX, []);
}

export function getWebCreatorProject(projectId) {
  const projectPath = path.join(PROJECTS_DIR, projectId, 'project.json');
  return readJson(projectPath, null);
}

export async function requestWebCreatorProject(spec = {}, options = {}) {
  const requestedAt = nowIso();
  const normalized = {
    tenantId: spec.tenantId || options.tenantId || 'default',
    workspaceId: spec.workspaceId || options.workspaceId || null,
    actorId: spec.actorId || options.actorId || 'skyewebcreator-user',
    name: String(spec.name || '').trim(),
    brief: String(spec.brief || '').trim(),
    audience: spec.audience || null,
    pages: Array.isArray(spec.pages) ? spec.pages : [],
    features: Array.isArray(spec.features) ? spec.features : [],
    designLane: spec.designLane || 'skydexia-design-vault',
    deliveryTarget: spec.deliveryTarget || 'ae-commandhub',
    persistence: spec.persistence || {
      local: true,
      r2: Boolean(process.env.SKYEWEB_R2_BUCKET && process.env.SKYEWEB_R2_ACCOUNT_ID),
      r3: Boolean(process.env.SKYEWEB_R3_BUCKET),
    },
    requestedAt,
  };

  const errors = validateWebCreatorSpec(normalized);
  if (errors.length > 0) {
    throw new Error(`Invalid SkyeWebCreatorMax spec: ${errors.join(', ')}`);
  }

  const projectId = projectIdFromSpec(normalized);
  const project = {
    id: projectId,
    status: 'requested',
    sourcePlatform: 'skyewebcreator-max',
    targetPlatforms: ['skydexia', 'ae-commandhub'],
    designVault: 'design-vault/library',
    spec: normalized,
    artifacts: [],
    events: [],
    createdAt: requestedAt,
    updatedAt: requestedAt,
  };

  writeJson(path.join(PROJECTS_DIR, projectId, 'project.json'), project);
  const index = listWebCreatorProjects().filter((entry) => entry.id !== projectId);
  index.push({
    id: projectId,
    name: normalized.name,
    tenantId: normalized.tenantId,
    workspaceId: normalized.workspaceId,
    status: project.status,
    updatedAt: project.updatedAt,
  });
  writeJson(PROJECT_INDEX, index);

  const requestEnvelope = await publish({
    tenantId: normalized.tenantId,
    workspaceId: normalized.workspaceId,
    actorId: normalized.actorId,
    sourcePlatform: 'skyewebcreator-max',
    targetPlatform: 'skydexia',
    eventType: 'webcreator.project.requested',
    payload: {
      projectId,
      name: normalized.name,
      brief: normalized.brief,
      designLane: normalized.designLane,
      designVault: 'design-vault/library',
      pages: normalized.pages,
      features: normalized.features,
    },
  });

  const aeEnvelope = await publish({
    tenantId: normalized.tenantId,
    workspaceId: normalized.workspaceId,
    actorId: normalized.actorId,
    sourcePlatform: 'skyewebcreator-max',
    targetPlatform: 'ae-commandhub',
    eventType: 'ae.requested',
    payload: {
      projectId,
      requestType: 'website-ui-creation',
      clientDeliveryTarget: normalized.deliveryTarget,
      name: normalized.name,
      brief: normalized.brief,
    },
  });

  const next = {
    ...project,
    events: [
      { eventId: requestEnvelope.eventId, eventType: requestEnvelope.eventType, targetPlatform: requestEnvelope.targetPlatform },
      { eventId: aeEnvelope.eventId, eventType: aeEnvelope.eventType, targetPlatform: aeEnvelope.targetPlatform },
    ],
    updatedAt: nowIso(),
  };
  writeJson(path.join(PROJECTS_DIR, projectId, 'project.json'), next);
  return { ok: true, projectId, project: next, requestEventId: requestEnvelope.eventId, aeEventId: aeEnvelope.eventId };
}

export async function persistGeneratedWebCreatorArtifact(projectId, artifact = {}, options = {}) {
  const project = getWebCreatorProject(projectId);
  if (!project) throw new Error(`Unknown SkyeWebCreatorMax project: ${projectId}`);

  const artifactId = artifact.id || `artifact-${crypto.randomBytes(5).toString('hex')}`;
  const persistedAt = nowIso();
  const normalizedArtifact = {
    id: artifactId,
    kind: artifact.kind || 'website-package',
    title: artifact.title || project.spec.name,
    files: Array.isArray(artifact.files) ? artifact.files : [],
    previewUrl: artifact.previewUrl || null,
    storage: {
      localPath: path.join('.skyequanta', 'webcreator', 'projects', projectId, 'artifacts', `${artifactId}.json`),
      r2: artifact.r2 || null,
      r3: artifact.r3 || null,
    },
    persistedAt,
  };

  writeJson(path.join(PROJECTS_DIR, projectId, 'artifacts', `${artifactId}.json`), normalizedArtifact);

  const next = {
    ...project,
    status: options.status || 'generated',
    artifacts: [...(project.artifacts || []), normalizedArtifact],
    updatedAt: persistedAt,
  };
  writeJson(path.join(PROJECTS_DIR, projectId, 'project.json'), next);

  const generatedEnvelope = await publish({
    tenantId: project.spec.tenantId,
    workspaceId: project.spec.workspaceId,
    actorId: options.actorId || 'skydexia',
    sourcePlatform: options.sourcePlatform || 'skydexia',
    targetPlatform: null,
    eventType: 'webcreator.project.generated',
    payload: { projectId, artifact: normalizedArtifact },
  });

  const appGeneratedEnvelope = await publish({
    tenantId: project.spec.tenantId,
    workspaceId: project.spec.workspaceId,
    actorId: options.actorId || 'skydexia',
    sourcePlatform: 'skyewebcreator-max',
    targetPlatform: null,
    eventType: 'app.generated',
    payload: {
      projectId,
      appName: project.spec.name,
      artifactId,
      files: normalizedArtifact.files,
      previewUrl: normalizedArtifact.previewUrl,
      designVault: 'design-vault/library',
    },
  });

  appendNdjson(DELIVERY_LEDGER, {
    projectId,
    artifactId,
    targetPlatform: 'platform-mesh',
    eventId: appGeneratedEnvelope.eventId,
    status: 'queued',
    queuedAt: nowIso(),
  });

  const deliveryQueuedEnvelope = await publish({
    tenantId: project.spec.tenantId,
    workspaceId: project.spec.workspaceId,
    actorId: options.actorId || 'skydexia',
    sourcePlatform: 'skyewebcreator-max',
    targetPlatform: 'ae-commandhub',
    eventType: 'webcreator.delivery.queued',
    payload: { projectId, artifactId, appGeneratedEventId: appGeneratedEnvelope.eventId },
  });

  return {
    ok: true,
    projectId,
    artifactId,
    generatedEventId: generatedEnvelope.eventId,
    appGeneratedEventId: appGeneratedEnvelope.eventId,
    deliveryQueuedEventId: deliveryQueuedEnvelope.eventId,
  };
}
