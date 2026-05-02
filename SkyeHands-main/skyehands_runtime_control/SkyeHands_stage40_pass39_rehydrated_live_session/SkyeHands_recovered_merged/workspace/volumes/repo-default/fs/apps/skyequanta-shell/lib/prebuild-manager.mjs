import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { appendAuditEvent } from './governance-manager.mjs';
import { publishRuntimeEvent } from './runtime-bus.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function normalizeWorkspaceId(value) {
  return String(value || '').trim() || 'local-default';
}

function normalizeTenantId(value) {
  return String(value || '').trim().toLowerCase() || 'local';
}

function normalizeTemplateId(value, fallback = 'default-template') {
  return String(value || '').trim().toLowerCase() || fallback;
}

function normalizeJobId(value) {
  return String(value || '').trim() || crypto.randomUUID();
}

function normalizeMode(value, fallback = 'prebuild') {
  const normalized = String(value || '').trim().toLowerCase();
  return ['prebuild', 'warm-start'].includes(normalized) ? normalized : fallback;
}

function normalizePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeArray(values = []) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))];
}

function emptyStore() {
  return {
    version: 1,
    templates: {},
    workspacePreferences: {},
    jobs: [],
    hydrations: []
  };
}

function artifactFileName(mode) {
  return normalizeMode(mode) === 'warm-start' ? 'warm-start.json' : 'prebuild.json';
}

function normalizeTemplateRecord(record = {}, fallbackTemplateId = 'default-template') {
  const templateId = normalizeTemplateId(record.templateId || record.id || record.name, fallbackTemplateId);
  const retentionMinutes = normalizePositiveInt(record.retentionMinutes, 60);
  return {
    templateId,
    label: String(record.label || record.name || templateId).trim() || templateId,
    mode: normalizeMode(record.mode, 'prebuild'),
    profileId: String(record.profileId || 'standard').trim() || 'standard',
    startupRecipe: String(record.startupRecipe || 'workspace:standard-start').trim() || 'workspace:standard-start',
    stackPreset: String(record.stackPreset || 'standard-runtime').trim() || 'standard-runtime',
    retentionMinutes,
    sourceWorkspaceId: record.sourceWorkspaceId ? normalizeWorkspaceId(record.sourceWorkspaceId) : null,
    sourceSnapshotId: record.sourceSnapshotId ? String(record.sourceSnapshotId).trim() : null,
    labels: normalizeArray(record.labels || []),
    sourcePaths: normalizeArray(record.sourcePaths || []),
    source: String(record.source || 'push-beyond-prebuild').trim() || 'push-beyond-prebuild',
    createdAt: String(record.createdAt || nowIso()),
    updatedAt: String(record.updatedAt || nowIso())
  };
}

function normalizePreferenceRecord(record = {}, workspaceId = 'local-default') {
  return {
    workspaceId: normalizeWorkspaceId(workspaceId || record.workspaceId),
    templateId: normalizeTemplateId(record.templateId, 'default-template'),
    mode: normalizeMode(record.mode, 'prebuild'),
    preferredProfileId: String(record.preferredProfileId || '').trim() || null,
    hydrationPolicy: String(record.hydrationPolicy || 'reuse-latest').trim() || 'reuse-latest',
    createdAt: String(record.createdAt || nowIso()),
    updatedAt: String(record.updatedAt || nowIso()),
    source: String(record.source || 'push-beyond-prebuild').trim() || 'push-beyond-prebuild'
  };
}

function normalizeJobRecord(record = {}) {
  const jobId = normalizeJobId(record.jobId || record.id);
  const retentionMinutes = normalizePositiveInt(record.retentionMinutes, 60);
  const createdAt = String(record.createdAt || nowIso());
  const expiresAt = String(record.expiresAt || new Date(Date.parse(createdAt) + (retentionMinutes * 60 * 1000)).toISOString());
  return {
    jobId,
    templateId: normalizeTemplateId(record.templateId, 'default-template'),
    workspaceId: normalizeWorkspaceId(record.workspaceId),
    tenantId: normalizeTenantId(record.tenantId),
    mode: normalizeMode(record.mode, 'prebuild'),
    profileId: String(record.profileId || 'standard').trim() || 'standard',
    startupRecipe: String(record.startupRecipe || 'workspace:standard-start').trim() || 'workspace:standard-start',
    stackPreset: String(record.stackPreset || 'standard-runtime').trim() || 'standard-runtime',
    status: String(record.status || 'ready').trim().toLowerCase() || 'ready',
    retentionMinutes,
    artifactDir: String(record.artifactDir || '').trim() || null,
    artifactFile: String(record.artifactFile || '').trim() || null,
    artifactDigest: String(record.artifactDigest || '').trim() || null,
    parentJobId: record.parentJobId ? normalizeJobId(record.parentJobId) : null,
    createdAt,
    expiresAt,
    hydratedAt: record.hydratedAt ? String(record.hydratedAt) : null,
    source: String(record.source || 'push-beyond-prebuild').trim() || 'push-beyond-prebuild'
  };
}

function normalizeHydrationRecord(record = {}) {
  return {
    hydrationId: String(record.hydrationId || crypto.randomUUID()).trim(),
    workspaceId: normalizeWorkspaceId(record.workspaceId),
    templateId: normalizeTemplateId(record.templateId, 'default-template'),
    jobId: normalizeJobId(record.jobId),
    mode: normalizeMode(record.mode, 'prebuild'),
    status: String(record.status || 'ready').trim().toLowerCase() || 'ready',
    allocatedAt: String(record.allocatedAt || nowIso()),
    source: String(record.source || 'push-beyond-prebuild').trim() || 'push-beyond-prebuild'
  };
}

export function getPrebuildStorePath(config) {
  return path.join(config.rootDir, '.skyequanta', 'prebuild-state.json');
}

function loadStore(config) {
  const parsed = readJson(getPrebuildStorePath(config), emptyStore());
  const normalized = {
    version: 1,
    templates: {},
    workspacePreferences: parsed?.workspacePreferences && typeof parsed.workspacePreferences === 'object' ? parsed.workspacePreferences : {},
    jobs: Array.isArray(parsed?.jobs) ? parsed.jobs.map(normalizeJobRecord) : [],
    hydrations: Array.isArray(parsed?.hydrations) ? parsed.hydrations.map(normalizeHydrationRecord) : []
  };

  const templates = parsed?.templates && typeof parsed.templates === 'object' ? parsed.templates : {};
  for (const [templateId, record] of Object.entries(templates)) {
    normalized.templates[normalizeTemplateId(templateId)] = normalizeTemplateRecord(record, templateId);
  }

  return normalized;
}

function saveStore(config, store) {
  writeJson(getPrebuildStorePath(config), store);
  return store;
}

export function ensurePrebuildStore(config) {
  const store = loadStore(config);
  saveStore(config, store);
  return store;
}

function getArtifactsRoot(config) {
  const baseDir = config.paths?.workspacePrebuildRootDir || path.join(config.rootDir, 'workspace', 'prebuilds');
  ensureDirectory(baseDir);
  return baseDir;
}

function computeDigest(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function materializeArtifact(config, job, template, preference = null) {
  const artifactDir = path.join(getArtifactsRoot(config), job.jobId);
  ensureDirectory(artifactDir);
  const artifactPayload = {
    artifactKind: job.mode,
    jobId: job.jobId,
    templateId: template.templateId,
    workspaceId: job.workspaceId,
    profileId: job.profileId,
    startupRecipe: job.startupRecipe,
    stackPreset: job.stackPreset,
    retentionMinutes: job.retentionMinutes,
    createdAt: job.createdAt,
    expiresAt: job.expiresAt,
    labels: template.labels,
    sourcePaths: template.sourcePaths,
    preference,
    sourceSnapshotId: template.sourceSnapshotId,
    sourceWorkspaceId: template.sourceWorkspaceId
  };
  const artifactDigest = computeDigest(artifactPayload);
  artifactPayload.artifactDigest = artifactDigest;
  const artifactFile = path.join(artifactDir, artifactFileName(job.mode));
  writeJson(artifactFile, artifactPayload);
  return {
    artifactDir,
    artifactFile,
    artifactDigest,
    artifactPayload
  };
}

function isExpired(job, at = new Date()) {
  return Date.parse(job.expiresAt || '') <= at.getTime();
}

function summarizeTemplates(templates = []) {
  return {
    total: templates.length,
    byMode: Object.fromEntries([...new Set(templates.map(item => item.mode))].map(mode => [mode, templates.filter(item => item.mode === mode).length]))
  };
}

function summarizeJobs(jobs = []) {
  return {
    total: jobs.length,
    ready: jobs.filter(item => item.status === 'ready').length,
    hydrated: jobs.filter(item => item.status === 'hydrated').length,
    expired: jobs.filter(item => isExpired(item)).length,
    byMode: Object.fromEntries([...new Set(jobs.map(item => item.mode))].map(mode => [mode, jobs.filter(item => item.mode === mode).length]))
  };
}

export function listPrebuildTemplates(config) {
  const store = loadStore(config);
  return Object.values(store.templates).sort((a, b) => a.templateId.localeCompare(b.templateId));
}

export function listPrebuildJobs(config, workspaceId = null) {
  const store = loadStore(config);
  const targetWorkspaceId = workspaceId ? normalizeWorkspaceId(workspaceId) : null;
  return store.jobs
    .filter(item => !targetWorkspaceId || item.workspaceId === targetWorkspaceId)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export function upsertPrebuildTemplate(config, options = {}) {
  const store = loadStore(config);
  const stamp = nowIso();
  const templateId = normalizeTemplateId(options.templateId || options.id || options.label, 'default-template');
  const existing = store.templates[templateId] || null;
  const template = normalizeTemplateRecord({
    ...(existing || {}),
    ...options,
    templateId,
    createdAt: existing?.createdAt || stamp,
    updatedAt: stamp,
    source: options.source || existing?.source || 'push-beyond-prebuild'
  }, templateId);

  store.templates[templateId] = template;
  saveStore(config, store);
  appendAuditEvent(config, {
    action: 'prebuild.template.upsert',
    actorType: 'operator',
    actorId: String(options.actorId || 'prebuild-template-upsert').trim() || 'prebuild-template-upsert',
    tenantId: normalizeTenantId(options.tenantId),
    workspaceId: normalizeWorkspaceId(options.workspaceId),
    detail: template
  });
  publishRuntimeEvent(config, {
    workspaceId: normalizeWorkspaceId(options.workspaceId),
    lane: 'prebuild',
    type: 'template-upserted',
    payload: { templateId: template.templateId, mode: template.mode, profileId: template.profileId }
  });
  return { template, templates: listPrebuildTemplates(config) };
}

export function setWorkspacePrebuildPreference(config, options = {}) {
  const store = loadStore(config);
  const workspaceId = normalizeWorkspaceId(options.workspaceId);
  const templateId = normalizeTemplateId(options.templateId, 'default-template');
  if (!store.templates[templateId]) {
    throw new Error(`Prebuild template '${templateId}' is not registered.`);
  }

  const stamp = nowIso();
  const existing = store.workspacePreferences[workspaceId] || null;
  const preference = normalizePreferenceRecord({
    ...(existing || {}),
    ...options,
    workspaceId,
    templateId,
    createdAt: existing?.createdAt || stamp,
    updatedAt: stamp,
    source: options.source || existing?.source || 'push-beyond-prebuild'
  }, workspaceId);

  store.workspacePreferences[workspaceId] = preference;
  saveStore(config, store);
  appendAuditEvent(config, {
    action: 'prebuild.workspace-preference.set',
    actorType: 'operator',
    actorId: String(options.actorId || 'prebuild-workspace-preference').trim() || 'prebuild-workspace-preference',
    tenantId: normalizeTenantId(options.tenantId),
    workspaceId,
    detail: preference
  });
  publishRuntimeEvent(config, {
    workspaceId,
    lane: 'prebuild',
    type: 'workspace-preference-set',
    payload: { templateId: preference.templateId, mode: preference.mode, hydrationPolicy: preference.hydrationPolicy }
  });
  return { preference, template: store.templates[templateId] };
}

export function queuePrebuildJob(config, options = {}) {
  const store = loadStore(config);
  const workspaceId = normalizeWorkspaceId(options.workspaceId);
  const templateId = normalizeTemplateId(options.templateId, 'default-template');
  const template = store.templates[templateId];
  if (!template) {
    throw new Error(`Prebuild template '${templateId}' is not registered.`);
  }

  const preference = store.workspacePreferences[workspaceId] || null;
  const createdAt = String(options.createdAt || nowIso());
  const job = normalizeJobRecord({
    jobId: options.jobId,
    templateId,
    workspaceId,
    tenantId: options.tenantId,
    mode: options.mode || template.mode,
    profileId: options.profileId || preference?.preferredProfileId || template.profileId,
    startupRecipe: options.startupRecipe || template.startupRecipe,
    stackPreset: options.stackPreset || template.stackPreset,
    retentionMinutes: options.retentionMinutes || template.retentionMinutes,
    status: 'ready',
    parentJobId: options.parentJobId || null,
    createdAt,
    expiresAt: options.expiresAt,
    source: options.source || 'push-beyond-prebuild'
  });

  const artifact = materializeArtifact(config, job, template, preference);
  const persistedJob = {
    ...job,
    artifactDir: artifact.artifactDir,
    artifactFile: artifact.artifactFile,
    artifactDigest: artifact.artifactDigest
  };

  store.jobs.unshift(persistedJob);
  saveStore(config, store);
  appendAuditEvent(config, {
    action: 'prebuild.job.queue',
    actorType: 'operator',
    actorId: String(options.actorId || 'prebuild-job-queue').trim() || 'prebuild-job-queue',
    tenantId: normalizeTenantId(options.tenantId),
    workspaceId,
    detail: persistedJob
  });
  publishRuntimeEvent(config, {
    workspaceId,
    lane: 'prebuild',
    type: 'job-queued',
    payload: { jobId: persistedJob.jobId, templateId, mode: persistedJob.mode, artifactDigest: persistedJob.artifactDigest }
  });

  return {
    job: persistedJob,
    template,
    preference,
    artifact: artifact.artifactPayload,
    summary: summarizeJobs(store.jobs)
  };
}

function getJob(store, jobId) {
  return store.jobs.find(item => item.jobId === normalizeJobId(jobId)) || null;
}

export function replayPrebuildJob(config, options = {}) {
  const store = loadStore(config);
  const parentJobId = normalizeJobId(options.jobId);
  const parentJob = getJob(store, parentJobId);
  if (!parentJob) {
    throw new Error(`Prebuild job '${parentJobId}' was not found.`);
  }

  const replay = queuePrebuildJob(config, {
    workspaceId: parentJob.workspaceId,
    tenantId: parentJob.tenantId,
    templateId: parentJob.templateId,
    mode: parentJob.mode,
    profileId: parentJob.profileId,
    startupRecipe: parentJob.startupRecipe,
    stackPreset: parentJob.stackPreset,
    retentionMinutes: parentJob.retentionMinutes,
    parentJobId,
    source: options.source || 'push-beyond-prebuild-replay',
    actorId: options.actorId || 'prebuild-job-replay'
  });
  return {
    parentJob,
    replayedJob: replay.job,
    artifact: replay.artifact,
    summary: replay.summary
  };
}

export function hydrateWorkspacePrebuild(config, options = {}) {
  const store = loadStore(config);
  const workspaceId = normalizeWorkspaceId(options.workspaceId);
  const preference = store.workspacePreferences[workspaceId] || null;
  const explicitTemplateId = options.templateId ? normalizeTemplateId(options.templateId) : null;
  const templateId = explicitTemplateId || preference?.templateId;
  if (!templateId) {
    throw new Error(`Workspace '${workspaceId}' does not have a prebuild preference.`);
  }

  const candidate = store.jobs.find(item => item.templateId === templateId && item.status === 'ready' && !isExpired(item));
  if (!candidate) {
    throw new Error(`No ready prebuild artifact is available for template '${templateId}'.`);
  }

  const hydration = normalizeHydrationRecord({
    workspaceId,
    templateId,
    jobId: candidate.jobId,
    mode: candidate.mode,
    status: 'ready',
    source: options.source || 'push-beyond-prebuild-hydrate'
  });

  candidate.status = 'hydrated';
  candidate.hydratedAt = nowIso();
  store.hydrations.unshift(hydration);
  saveStore(config, store);
  appendAuditEvent(config, {
    action: 'prebuild.workspace.hydrate',
    actorType: 'operator',
    actorId: String(options.actorId || 'prebuild-workspace-hydrate').trim() || 'prebuild-workspace-hydrate',
    tenantId: normalizeTenantId(options.tenantId),
    workspaceId,
    detail: hydration
  });
  publishRuntimeEvent(config, {
    workspaceId,
    lane: 'prebuild',
    type: 'workspace-hydrated',
    payload: { templateId, jobId: candidate.jobId, mode: candidate.mode }
  });

  return {
    hydration,
    job: candidate,
    artifact: readJson(candidate.artifactFile, null),
    summary: summarizeJobs(store.jobs)
  };
}

export function getPrebuildStatus(config, workspaceId) {
  const store = loadStore(config);
  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
  const templates = Object.values(store.templates);
  const jobs = listPrebuildJobs(config, normalizedWorkspaceId);
  const preference = store.workspacePreferences[normalizedWorkspaceId] || null;
  const latestHydration = store.hydrations.find(item => item.workspaceId === normalizedWorkspaceId) || null;
  return {
    workspaceId: normalizedWorkspaceId,
    summary: {
      templateCount: templates.length,
      currentTemplateId: preference?.templateId || null,
      currentMode: preference?.mode || null,
      readyJobs: jobs.filter(item => item.status === 'ready' && !isExpired(item)).length,
      hydratedJobs: jobs.filter(item => item.status === 'hydrated').length,
      expiredJobs: jobs.filter(item => isExpired(item)).length,
      lastHydrationJobId: latestHydration?.jobId || null
    },
    templates: {
      list: templates,
      summary: summarizeTemplates(templates)
    },
    preference,
    jobs: {
      list: jobs,
      summary: summarizeJobs(jobs)
    },
    latestHydration
  };
}
