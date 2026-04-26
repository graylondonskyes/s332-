import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { getInternalUrls } from '../bin/config.mjs';
import {
  createWorkspaceRecord,
  findWorkspaceRecord,
  loadWorkspaceRegistry,
  normalizeWorkspaceId,
  saveWorkspaceRegistry,
  setCurrentWorkspace,
  upsertWorkspaceRecord
} from './workspace-registry.mjs';
import {
  getWorkspaceRuntimeState,
  getWorkspaceRuntimeStatus,
  getWorkspaceSandboxPaths,
  provisionWorkspaceRuntime,
  stopWorkspaceRuntime
} from './workspace-runtime.mjs';
import {
  appendAuditEvent,
  assertForwardedPortCountAllowed,
  assertWorkspaceCreateAllowed
} from './governance-manager.mjs';
import {
  applySnapshotRetentionPolicyForWorkspace,
  createWorkspaceSnapshot,
  deleteWorkspaceSnapshot,
  getWorkspaceSnapshot,
  listWorkspaceSnapshots,
  loadSnapshotRetentionPolicy,
  resolveSnapshotRetentionPolicy,
  restoreWorkspaceSnapshot,
  updateSnapshotRetentionPolicy
} from './snapshot-manager.mjs';
import {
  ensureWorkspaceRuntimeProjection,
  publishRuntimeEvent,
  recordRuntimeMessage,
  recordWorkspaceContext
} from './runtime-bus.mjs';

const WORKSPACE_STATUSES = new Set(['ready', 'running', 'stopped', 'error']);

function parsePort(value, label = 'port') {
  const port = Number.parseInt(String(value), 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid ${label}: '${value}'. Expected integer between 1 and 65535.`);
  }

  return port;
}

function normalizeForwardedHost(host) {
  const normalized = String(host || '').trim();
  if (!normalized) {
    return null;
  }

  return normalized.replace(/\/+$/, '');
}

function normalizePortList(ports) {
  if (!Array.isArray(ports)) {
    throw new Error('forwarded ports must be an array.');
  }

  const seen = new Set();
  const normalized = [];
  for (const value of ports) {
    const port = parsePort(value, 'forwarded port');
    if (!seen.has(port)) {
      seen.add(port);
      normalized.push(port);
    }
  }

  return normalized.sort((a, b) => a - b);
}

function resolveDefaultWorkspaceId(config) {
  const configured = normalizeWorkspaceId(process.env.SKYEQUANTA_DEFAULT_WORKSPACE_ID || process.env.SKYEQUANTA_WORKSPACE_ID);
  return configured || 'local-default';
}

function resolveDefaultTenantId() {
  const tenantId = String(process.env.SKYEQUANTA_DEFAULT_TENANT_ID || process.env.SKYEQUANTA_TENANT_ID || '').trim().toLowerCase();
  return tenantId || 'local';
}

function buildDefaultWorkspaceRecord(config, workspaceId) {
  const internalUrls = getInternalUrls(config);
  return createWorkspaceRecord(workspaceId, {
    name: config.productName,
    status: 'ready',
    ideBaseUrl: internalUrls.ide,
    agentBaseUrl: internalUrls.agentBackend,
    gateBaseUrl: internalUrls.gate,
    source: 'bootstrap',
    tenantId: resolveDefaultTenantId()
  });
}

export function ensureDefaultWorkspace(config) {
  const registry = loadWorkspaceRegistry(config);
  const workspaceId = resolveDefaultWorkspaceId(config);

  let workspace = findWorkspaceRecord(registry, workspaceId);
  if (!workspace) {
    workspace = upsertWorkspaceRecord(registry, buildDefaultWorkspaceRecord(config, workspaceId));
  }

  setCurrentWorkspace(registry, workspace.id);
  saveWorkspaceRegistry(config, registry);
  ensureWorkspaceRuntimeProjection(config, workspace.id);
  recordWorkspaceContext(config, workspace, { selected: true });
  publishRuntimeEvent(config, {
    action: 'runtime.workspace_context',
    workspaceId: workspace.id,
    tenantId: workspace?.metadata?.tenantId,
    lane: 'shell',
    actorType: 'system',
    actorId: 'workspace-manager',
    detail: { selected: true, source: 'ensure-default' }
  });
  return {
    registry,
    workspace
  };
}

export function listWorkspaces(config) {
  const registry = loadWorkspaceRegistry(config);
  return {
    count: registry.workspaces.length,
    currentWorkspaceId: registry.currentWorkspaceId,
    workspaces: registry.workspaces
  };
}

export function getWorkspace(config, workspaceId) {
  const registry = loadWorkspaceRegistry(config);
  const resolvedWorkspaceId = workspaceId ? normalizeWorkspaceId(workspaceId) : registry.currentWorkspaceId;
  if (!resolvedWorkspaceId) {
    return null;
  }

  return findWorkspaceRecord(registry, resolvedWorkspaceId);
}

function persistWorkspaceUpdate(config, registry, workspace) {
  upsertWorkspaceRecord(registry, workspace);
  saveWorkspaceRegistry(config, registry);
  ensureWorkspaceRuntimeProjection(config, workspace.id);
  recordWorkspaceContext(config, workspace, { selected: true });
  publishRuntimeEvent(config, {
    action: 'runtime.workspace_context',
    workspaceId: workspace.id,
    tenantId: workspace?.metadata?.tenantId,
    lane: 'shell',
    actorType: 'system',
    actorId: 'workspace-manager',
    detail: { selected: true, source: 'ensure-default' }
  });
  return {
    registry,
    workspace
  };
}

function toRuntimeRoutes(config, workspace, runtimeState) {
  const baseRoutes = {
    ...(workspace.routes || {}),
    providerCenter: '/provider-center',
    storageCenter: '/storage-center',
    deploymentCenter: '/deployment-center',
    founderLaneCenter: '/api/founder-lanes'
  };
  if (!runtimeState?.urls?.ide || !runtimeState?.urls?.agent) {
    return baseRoutes;
  }

  return {
    ...baseRoutes,
    ideBaseUrl: runtimeState.urls.ide,
    agentBaseUrl: runtimeState.urls.agent,
    bridgePathPrefix: workspace?.routes?.bridgePathPrefix || `/w/${workspace.id}`
  };
}

function toRuntimeMetadata(config, workspace, runtimeState, reason) {
  const paths = getWorkspaceSandboxPaths(config, workspace.id);
  return {
    ...(workspace.metadata || {}),
    runtimeDriver: runtimeState?.driver || 'remote-executor',
    runtimeRootDir: paths.instanceDir,
    runtimeFsDir: paths.fsDir,
    runtimeIdePort: runtimeState?.ports?.ide || null,
    runtimeAgentPort: runtimeState?.ports?.agent || null,
    lastStatusReason: reason || null
  };
}


function ensureWorkspaceProjectDir(config, workspaceId) {
  const runtimePaths = getWorkspaceSandboxPaths(config, workspaceId);
  const projectDir = path.join(runtimePaths.fsDir, 'project');
  fs.mkdirSync(projectDir, { recursive: true });
  return projectDir;
}

function assertDirectoryEmpty(dirPath, label) {
  const entries = fs.existsSync(dirPath) ? fs.readdirSync(dirPath) : [];
  if (entries.length > 0) {
    throw new Error(`${label} '${dirPath}' is not empty. Use --force to allow overwrite.`);
  }
}

function seedWorkspaceFromGit(config, workspaceId, repoUrl, options = {}) {
  const normalizedRepo = String(repoUrl || '').trim();
  if (!normalizedRepo) {
    throw new Error('Repository URL is required for create-from-git. Use --repo <url>.');
  }
  const targetDir = ensureWorkspaceProjectDir(config, workspaceId);
  if (!options.force) {
    assertDirectoryEmpty(targetDir, 'Workspace project directory');
  }
  const cloneArgs = ['clone'];
  if (options.branch) {
    cloneArgs.push('--branch', String(options.branch).trim(), '--single-branch');
  }
  cloneArgs.push(normalizedRepo, targetDir);
  const cloneResult = spawnSync('git', cloneArgs, {
    cwd: config.rootDir,
    stdio: 'pipe',
    encoding: 'utf8'
  });
  if (cloneResult.error) {
    throw new Error(`Failed to run git clone: ${cloneResult.error.message}`);
  }
  if ((cloneResult.status ?? 1) !== 0) {
    throw new Error(`git clone failed: ${(cloneResult.stderr || cloneResult.stdout || 'unknown git error').trim()}`);
  }
  return {
    type: 'git',
    repoUrl: normalizedRepo,
    branch: options.branch ? String(options.branch).trim() : null,
    targetDir
  };
}

function seedWorkspaceFromTemplate(config, workspaceId, templatePath, options = {}) {
  const normalizedTemplatePath = String(templatePath || '').trim();
  if (!normalizedTemplatePath) {
    throw new Error('Template path is required for create-from-template. Use --template-path <path>.');
  }
  const absoluteTemplatePath = path.resolve(config.rootDir, normalizedTemplatePath);
  if (!fs.existsSync(absoluteTemplatePath)) {
    throw new Error(`Template path does not exist: ${absoluteTemplatePath}`);
  }
  const targetDir = ensureWorkspaceProjectDir(config, workspaceId);
  if (!options.force) {
    assertDirectoryEmpty(targetDir, 'Workspace project directory');
  }
  const sourceStat = fs.statSync(absoluteTemplatePath);
  if (sourceStat.isDirectory()) {
    fs.cpSync(absoluteTemplatePath, targetDir, { recursive: true, force: Boolean(options.force) });
  } else {
    const filename = path.basename(absoluteTemplatePath);
    fs.copyFileSync(absoluteTemplatePath, path.join(targetDir, filename));
  }
  return {
    type: 'template',
    templatePath: absoluteTemplatePath,
    targetDir
  };
}

function requireWorkspace(registry, workspaceId) {
  const workspace = findWorkspaceRecord(registry, workspaceId);
  if (!workspace) {
    throw new Error(`Workspace '${workspaceId}' is not registered.`);
  }

  return workspace;
}

export function selectWorkspace(config, workspaceId) {
  const registry = loadWorkspaceRegistry(config);
  const workspace = requireWorkspace(registry, workspaceId);
  setCurrentWorkspace(registry, workspace.id);
  saveWorkspaceRegistry(config, registry);
  recordWorkspaceContext(config, workspace, { selected: true });
  publishRuntimeEvent(config, {
    action: 'runtime.workspace_context',
    workspaceId: workspace.id,
    tenantId: workspace?.metadata?.tenantId,
    lane: 'shell',
    actorType: 'system',
    actorId: 'workspace-manager',
    detail: { selected: true, source: 'select' }
  });
  return {
    registry,
    workspace,
    selected: true
  };
}

export function updateWorkspaceStatus(config, workspaceId, status, reason = null) {
  const normalizedStatus = String(status || '').trim().toLowerCase();
  if (!WORKSPACE_STATUSES.has(normalizedStatus)) {
    throw new Error(`Invalid workspace status '${status}'. Allowed: ${Array.from(WORKSPACE_STATUSES).join(', ')}`);
  }

  const registry = loadWorkspaceRegistry(config);
  const workspace = requireWorkspace(registry, workspaceId);
  const updated = {
    ...workspace,
    status: normalizedStatus,
    updatedAt: new Date().toISOString(),
    metadata: {
      ...(workspace.metadata || {}),
      lastStatusReason: reason || null
    }
  };

  return persistWorkspaceUpdate(config, registry, updated);
}

export async function startWorkspace(config, workspaceId, reason = 'manual_start') {
  const registry = loadWorkspaceRegistry(config);
  const workspace = requireWorkspace(registry, workspaceId);
  const runtime = await provisionWorkspaceRuntime(config, workspace);
  const runtimeStatus = getWorkspaceRuntimeStatus(config, workspace);
  const updated = {
    ...workspace,
    status: runtimeStatus.running ? 'running' : 'error',
    updatedAt: new Date().toISOString(),
    routes: toRuntimeRoutes(config, workspace, runtime.state),
    metadata: toRuntimeMetadata(config, workspace, runtime.state, runtimeStatus.reason || reason)
  };
  const result = persistWorkspaceUpdate(config, registry, updated);
  recordWorkspaceContext(config, updated);
  publishRuntimeEvent(config, {
    action: 'runtime.workspace_context',
    workspaceId: updated.id,
    tenantId: updated?.metadata?.tenantId,
    lane: 'shell',
    actorType: 'system',
    actorId: 'workspace-manager',
    detail: { status: updated.status, source: 'start', reason }
  });
  appendAuditEvent(config, {
    action: 'workspace.start',
    workspaceId: updated.id,
    tenantId: updated?.metadata?.tenantId,
    detail: { reason }
  });
  return {
    ...result,
    action: 'start',
    runtime: getWorkspaceRuntimeStatus(config, updated)
  };
}

export async function stopWorkspace(config, workspaceId, reason = 'manual_stop') {
  const registry = loadWorkspaceRegistry(config);
  const workspace = requireWorkspace(registry, workspaceId);
  await stopWorkspaceRuntime(config, workspace.id);
  const updated = {
    ...workspace,
    status: 'stopped',
    updatedAt: new Date().toISOString(),
    metadata: {
      ...(workspace.metadata || {}),
      lastStatusReason: reason || null
    }
  };
  const result = persistWorkspaceUpdate(config, registry, updated);
  recordWorkspaceContext(config, updated);
  publishRuntimeEvent(config, {
    action: 'runtime.workspace_context',
    workspaceId: updated.id,
    tenantId: updated?.metadata?.tenantId,
    lane: 'shell',
    actorType: 'system',
    actorId: 'workspace-manager',
    detail: { status: updated.status, source: 'stop', reason }
  });
  appendAuditEvent(config, {
    action: 'workspace.stop',
    workspaceId: updated.id,
    tenantId: updated?.metadata?.tenantId,
    detail: { reason }
  });
  return {
    ...result,
    action: 'stop',
    runtime: getWorkspaceRuntimeStatus(config, updated)
  };
}

export function getCurrentWorkspace(config) {
  const registry = loadWorkspaceRegistry(config);
  if (!registry.currentWorkspaceId) {
    return null;
  }

  return findWorkspaceRecord(registry, registry.currentWorkspaceId);
}

export async function deleteWorkspace(config, workspaceId, options = {}) {
  const registry = loadWorkspaceRegistry(config);
  const workspace = requireWorkspace(registry, workspaceId);

  await stopWorkspaceRuntime(config, workspace.id);
  const sandboxPaths = getWorkspaceSandboxPaths(config, workspace.id);
  fs.rmSync(sandboxPaths.instanceDir, { recursive: true, force: true });
  fs.rmSync(sandboxPaths.runtimeDir, { recursive: true, force: true });

  const snapshots = listWorkspaceSnapshots(config, workspace.id);
  const removedSnapshotIds = [];
  for (const snapshot of snapshots) {
    const result = deleteWorkspaceSnapshot(config, workspace.id, snapshot.id, {
      tenantId: workspace?.metadata?.tenantId,
      deletedBy: String(options.deletedBy || 'workspace-delete').trim() || 'workspace-delete'
    });
    if (result.deleted) {
      removedSnapshotIds.push(snapshot.id);
    }
  }

  registry.workspaces = registry.workspaces.filter(item => item.id !== workspace.id);
  if (registry.currentWorkspaceId === workspace.id) {
    registry.currentWorkspaceId = registry.workspaces[0]?.id || null;
  }

  saveWorkspaceRegistry(config, registry);

  if (!registry.currentWorkspaceId) {
    ensureDefaultWorkspace(config);
  }

  appendAuditEvent(config, {
    action: 'workspace.delete',
    workspaceId: workspace.id,
    tenantId: workspace?.metadata?.tenantId,
    actorType: 'system',
    actorId: String(options.deletedBy || 'workspace-delete').trim() || 'workspace-delete',
    detail: {
      removedSnapshotIds,
      removedSnapshotCount: removedSnapshotIds.length
    }
  });

  return {
    deleted: true,
    workspaceId: workspace.id,
    removedSnapshotIds,
    removedSnapshotCount: removedSnapshotIds.length
  };
}


export function createWorkspace(config, workspaceId, options = {}) {
  const registry = loadWorkspaceRegistry(config);
  const id = normalizeWorkspaceId(workspaceId);
  if (!id) {
    throw new Error('Workspace id is required.');
  }

  const existing = findWorkspaceRecord(registry, id);
  if (existing) {
    return {
      registry,
      workspace: existing,
      created: false
    };
  }

  assertWorkspaceCreateAllowed(config, registry.workspaces.length);

  const internalUrls = getInternalUrls(config);
  const tenantId = String(options.tenantId || resolveDefaultTenantId()).trim().toLowerCase() || 'local';
  const runtimePaths = getWorkspaceSandboxPaths(config, id);
  const machineProfile = String(options.machineProfile || '').trim().toLowerCase() || null;
  const secretScope = String(options.secretScope || '').trim() || null;
  const workspace = upsertWorkspaceRecord(
    registry,
    createWorkspaceRecord(id, {
      name: options.name || id,
      status: 'ready',
      ideBaseUrl: options.ideBaseUrl || internalUrls.ide,
      agentBaseUrl: options.agentBaseUrl || internalUrls.agentBackend,
      gateBaseUrl: options.gateBaseUrl || internalUrls.gate,
      source: options.source || 'manual',
      tenantId
    })
  );

  let seed = null;
  if (options.repoUrl) {
    seed = seedWorkspaceFromGit(config, id, options.repoUrl, {
      branch: options.branch,
      force: Boolean(options.force)
    });
  } else if (options.templatePath) {
    seed = seedWorkspaceFromTemplate(config, id, options.templatePath, {
      force: Boolean(options.force)
    });
  }

  workspace.metadata = {
    ...(workspace.metadata || {}),
    runtimeDriver: 'remote-executor',
    runtimeRootDir: runtimePaths.instanceDir,
    runtimeFsDir: runtimePaths.fsDir,
    runtimeIdePort: null,
    runtimeAgentPort: null,
    machineProfile,
    secretScope,
    providerSovereigntyMode: 'locked-user-owned',
    founderLanePolicy: 'declared-separated',
    providerCenters: {
      provider: '/provider-center',
      storage: '/storage-center',
      deployment: '/deployment-center',
      founderLane: '/api/founder-lanes'
    },
    seed
  };

  if (!registry.currentWorkspaceId) {
    setCurrentWorkspace(registry, workspace.id);
  }

  saveWorkspaceRegistry(config, registry);
  ensureWorkspaceRuntimeProjection(config, workspace.id);
  recordWorkspaceContext(config, workspace, { selected: !registry.currentWorkspaceId || registry.currentWorkspaceId === workspace.id });
  publishRuntimeEvent(config, {
    action: 'runtime.workspace_context',
    workspaceId: workspace.id,
    tenantId: workspace?.metadata?.tenantId,
    lane: 'shell',
    actorType: 'system',
    actorId: String(options.source || 'manual').trim() || 'manual',
    detail: { created: true, source: options.source || 'manual', machineProfile, secretScope, seedType: seed?.type || null }
  });
  appendAuditEvent(config, {
    action: 'workspace.create',
    workspaceId: workspace.id,
    tenantId: workspace?.metadata?.tenantId,
    actorType: 'system',
    actorId: String(options.source || 'manual').trim() || 'manual',
    detail: {
      name: workspace.name,
      created: true,
      machineProfile,
      secretScope,
      seedType: seed?.type || null,
      seedSource: seed?.repoUrl || seed?.templatePath || null
    }
  });
  return {
    registry,
    workspace,
    created: true,
    seed
  };
}

export function setWorkspaceSecretScope(config, workspaceId, secretScope, options = {}) {
  const registry = loadWorkspaceRegistry(config);
  const workspace = requireWorkspace(registry, workspaceId);
  const normalizedScope = String(secretScope || '').trim() || null;
  const updated = {
    ...workspace,
    updatedAt: new Date().toISOString(),
    metadata: {
      ...(workspace.metadata || {}),
      secretScope: normalizedScope
    }
  };

  const result = persistWorkspaceUpdate(config, registry, updated);
  recordWorkspaceContext(config, updated);
  appendAuditEvent(config, {
    action: normalizedScope ? 'workspace.secret_scope.set' : 'workspace.secret_scope.clear',
    workspaceId: updated.id,
    tenantId: updated?.metadata?.tenantId,
    actorType: options.actorType || 'operator',
    actorId: String(options.actorId || 'workspace-manager').trim() || 'workspace-manager',
    detail: { secretScope: normalizedScope }
  });
  recordRuntimeMessage(config, {
    workspaceId: updated.id,
    lane: 'shell',
    channel: 'workspace.secret_scope',
    type: normalizedScope ? 'secret_scope.set' : 'secret_scope.cleared',
    payload: { secretScope: normalizedScope }
  });
  return result;
}

export function listWorkspacePorts(config, workspaceId) {
  const workspace = getWorkspace(config, workspaceId);
  if (!workspace) {
    throw new Error(`Workspace '${workspaceId}' is not registered.`);
  }

  const metadata = workspace.metadata || {};
  return {
    workspace,
    forwardedHost: metadata.forwardedHost || null,
    forwardedPorts: Array.isArray(metadata.forwardedPorts) ? metadata.forwardedPorts : []
  };
}

export function setWorkspacePorts(config, workspaceId, ports, options = {}) {
  const registry = loadWorkspaceRegistry(config);
  const workspace = requireWorkspace(registry, workspaceId);
  const nextPorts = normalizePortList(ports);
  assertForwardedPortCountAllowed(config, nextPorts.length);
  const forwardedHost = options.forwardedHost === undefined
    ? workspace?.metadata?.forwardedHost || null
    : normalizeForwardedHost(options.forwardedHost);

  const updated = {
    ...workspace,
    updatedAt: new Date().toISOString(),
    metadata: {
      ...(workspace.metadata || {}),
      forwardedPorts: nextPorts,
      forwardedHost
    }
  };

  const result = persistWorkspaceUpdate(config, registry, updated);
  recordWorkspaceContext(config, updated);
  appendAuditEvent(config, {
    action: 'workspace.ports.set',
    workspaceId: updated.id,
    tenantId: updated?.metadata?.tenantId,
    detail: {
      forwardedPorts: nextPorts,
      forwardedHost
    }
  });
  return result;
}

export function allowWorkspacePort(config, workspaceId, port, options = {}) {
  const current = listWorkspacePorts(config, workspaceId);
  const parsedPort = parsePort(port);
  const nextPorts = [...current.forwardedPorts, parsedPort]
    .filter((value, index, self) => self.indexOf(value) === index)
    .sort((a, b) => a - b);

  return setWorkspacePorts(config, workspaceId, nextPorts, {
    forwardedHost: options.forwardedHost === undefined ? current.forwardedHost : options.forwardedHost
  });
}

export function denyWorkspacePort(config, workspaceId, port) {
  const current = listWorkspacePorts(config, workspaceId);
  const parsedPort = parsePort(port);
  const nextPorts = current.forwardedPorts.filter(item => item !== parsedPort);
  return setWorkspacePorts(config, workspaceId, nextPorts, {
    forwardedHost: current.forwardedHost
  });
}

export function getWorkspaceRuntime(config, workspaceId) {
  const workspace = getWorkspace(config, workspaceId);
  if (!workspace) {
    throw new Error(`Workspace '${workspaceId}' is not registered.`);
  }

  const runtime = getWorkspaceRuntimeStatus(config, workspace);
  return {
    workspace,
    runtime,
    state: getWorkspaceRuntimeState(config, workspace.id)
  };
}

export function listSnapshots(config, workspaceId) {
  const workspace = getWorkspace(config, workspaceId);
  if (!workspace) {
    throw new Error(`Workspace '${workspaceId}' is not registered.`);
  }

  return {
    workspace,
    snapshots: listWorkspaceSnapshots(config, workspace.id)
  };
}

export async function createSnapshot(config, workspaceId, options = {}) {
  const workspace = getWorkspace(config, workspaceId);
  if (!workspace) {
    throw new Error(`Workspace '${workspaceId}' is not registered.`);
  }

  const snapshot = await createWorkspaceSnapshot(config, workspace, options);
  const registry = loadWorkspaceRegistry(config);
  const current = requireWorkspace(registry, workspace.id);
  const updated = {
    ...current,
    updatedAt: new Date().toISOString(),
    metadata: {
      ...(current.metadata || {}),
      lastSnapshotId: snapshot.id,
      lastSnapshotAt: snapshot.createdAt
    }
  };

  persistWorkspaceUpdate(config, registry, updated);
  recordWorkspaceContext(config, updated);
  recordRuntimeMessage(config, {
    workspaceId: updated.id,
    lane: 'shell',
    channel: 'workspace.snapshot',
    type: 'snapshot.created',
    payload: { snapshotId: snapshot.id }
  });
  return {
    workspace: updated,
    snapshot
  };
}

export async function restoreSnapshot(config, workspaceId, snapshotId, options = {}) {
  const workspace = getWorkspace(config, workspaceId);
  if (!workspace) {
    throw new Error(`Workspace '${workspaceId}' is not registered.`);
  }

  const snapshot = await restoreWorkspaceSnapshot(config, workspace, snapshotId, options);
  const registry = loadWorkspaceRegistry(config);
  const current = requireWorkspace(registry, workspace.id);
  const updated = {
    ...current,
    updatedAt: new Date().toISOString(),
    metadata: {
      ...(current.metadata || {}),
      lastRestoredSnapshotId: snapshot.id,
      lastRestoredSnapshotAt: new Date().toISOString()
    }
  };

  persistWorkspaceUpdate(config, registry, updated);
  recordWorkspaceContext(config, updated);
  recordRuntimeMessage(config, {
    workspaceId: updated.id,
    lane: 'shell',
    channel: 'workspace.snapshot',
    type: 'snapshot.created',
    payload: { snapshotId: snapshot.id }
  });
  return {
    workspace: updated,
    snapshot
  };
}

export function describeSnapshot(config, workspaceId, snapshotId) {
  const workspace = getWorkspace(config, workspaceId);
  if (!workspace) {
    throw new Error(`Workspace '${workspaceId}' is not registered.`);
  }

  const snapshot = getWorkspaceSnapshot(config, workspace.id, snapshotId);
  if (!snapshot) {
    throw new Error(`Snapshot '${snapshotId}' was not found for workspace '${workspace.id}'.`);
  }

  return {
    workspace,
    snapshot
  };
}

export function removeSnapshot(config, workspaceId, snapshotId) {
  const workspace = getWorkspace(config, workspaceId);
  if (!workspace) {
    throw new Error(`Workspace '${workspaceId}' is not registered.`);
  }

  return {
    workspace,
    ...deleteWorkspaceSnapshot(config, workspace.id, snapshotId, {
      tenantId: workspace?.metadata?.tenantId,
      deletedBy: 'workspace-manager'
    })
  };
}

export function getSnapshotRetention(config, workspaceId = null) {
  const policy = loadSnapshotRetentionPolicy(config);
  if (!workspaceId) {
    return {
      policy,
      effective: null,
      workspace: null
    };
  }

  const workspace = getWorkspace(config, workspaceId);
  if (!workspace) {
    throw new Error(`Workspace '${workspaceId}' is not registered.`);
  }

  return {
    policy,
    effective: resolveSnapshotRetentionPolicy(config, workspace),
    workspace
  };
}

export function setSnapshotRetention(config, options = {}) {
  return updateSnapshotRetentionPolicy(config, options);
}

export function runSnapshotRetentionCleanup(config, workspaceId = null, options = {}) {
  if (workspaceId) {
    const workspace = getWorkspace(config, workspaceId);
    if (!workspace) {
      throw new Error(`Workspace '${workspaceId}' is not registered.`);
    }

    return {
      cleaned: 1,
      results: [applySnapshotRetentionPolicyForWorkspace(config, workspace, options)]
    };
  }

  const state = listWorkspaces(config);
  const results = state.workspaces.map(workspace => applySnapshotRetentionPolicyForWorkspace(config, workspace, options));
  return {
    cleaned: results.length,
    results
  };
}
