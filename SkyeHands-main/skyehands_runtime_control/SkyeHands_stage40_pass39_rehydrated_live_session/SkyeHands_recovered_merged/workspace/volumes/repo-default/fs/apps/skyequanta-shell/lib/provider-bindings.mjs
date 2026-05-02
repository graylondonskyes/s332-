import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { appendAuditEvent } from './governance-manager.mjs';
import { getProviderProfile, resolveProviderProfileRecord } from './provider-vault.mjs';
import { getWorkspace, updateWorkspaceStatus } from './workspace-manager.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function nowIso() {
  return new Date().toISOString();
}

function readString(value) {
  return String(value ?? '').trim();
}

function normalizeTenantId(value) {
  const normalized = readString(value).toLowerCase();
  return normalized || 'local';
}

const BINDING_ROLE_DEFINITIONS = {
  primary_database: {
    role: 'primary_database',
    label: 'Primary Database',
    requiredCapabilities: ['database'],
    defaultCapability: 'database',
    allowedActions: ['db_connect', 'provider_runtime_execution']
  },
  preview_deploy: {
    role: 'preview_deploy',
    label: 'Preview Deploy',
    requiredCapabilities: ['preview'],
    defaultCapability: 'preview',
    allowedActions: ['preview_deploy', 'provider_runtime_execution']
  },
  worker_deploy: {
    role: 'worker_deploy',
    label: 'Worker Deploy',
    requiredCapabilities: ['worker_runtime', 'deploy'],
    defaultCapability: 'worker_runtime',
    allowedActions: ['worker_deploy', 'provider_runtime_execution']
  },
  site_deploy: {
    role: 'site_deploy',
    label: 'Site Deploy',
    requiredCapabilities: ['site_runtime', 'deploy'],
    defaultCapability: 'site_runtime',
    allowedActions: ['site_deploy', 'provider_runtime_execution']
  },
  scm_origin: {
    role: 'scm_origin',
    label: 'SCM Origin',
    requiredCapabilities: ['scm'],
    defaultCapability: 'scm',
    allowedActions: ['scm_sync', 'provider_runtime_execution']
  },
  object_storage: {
    role: 'object_storage',
    label: 'Object Storage',
    requiredCapabilities: ['object_storage', 'storage'],
    defaultCapability: 'object_storage',
    allowedActions: ['object_storage', 'provider_runtime_execution']
  },
  runtime_env: {
    role: 'runtime_env',
    label: 'Runtime Env',
    requiredCapabilities: ['runtime'],
    defaultCapability: 'runtime',
    allowedActions: ['provider_runtime_execution']
  }
};

export function getBindingRoleCatalog() {
  return {
    roles: Object.values(BINDING_ROLE_DEFINITIONS).map(item => ({
      role: item.role,
      label: item.label,
      requiredCapabilities: [...item.requiredCapabilities],
      defaultCapability: item.defaultCapability,
      allowedActions: [...item.allowedActions]
    }))
  };
}

function resolveBindingRole(role, capability = '') {
  const normalizedRole = readString(role).toLowerCase();
  if (normalizedRole && BINDING_ROLE_DEFINITIONS[normalizedRole]) {
    return BINDING_ROLE_DEFINITIONS[normalizedRole];
  }
  const normalizedCapability = readString(capability).toLowerCase();
  return Object.values(BINDING_ROLE_DEFINITIONS).find(item => item.defaultCapability === normalizedCapability) || BINDING_ROLE_DEFINITIONS.runtime_env;
}

export function getWorkspaceProviderBindingsPath(config) {
  return path.join(config.rootDir, '.skyequanta', 'workspace-provider-bindings.json');
}

function normalizeBindingRecord(record = {}) {
  const role = resolveBindingRole(record.bindingRole, record.capability);
  const capability = readString(record.capability).toLowerCase() || role.defaultCapability || 'runtime';
  const allowedActions = Array.isArray(record.allowedActions) && record.allowedActions.length
    ? [...new Set(record.allowedActions.map(item => readString(item).toLowerCase()).filter(Boolean))]
    : [...role.allowedActions];
  const requiredCapabilities = Array.isArray(record.requiredCapabilities) && record.requiredCapabilities.length
    ? [...new Set(record.requiredCapabilities.map(item => readString(item).toLowerCase()).filter(Boolean))]
    : [...role.requiredCapabilities];
  return {
    bindingId: readString(record.bindingId || crypto.randomUUID()),
    workspaceId: readString(record.workspaceId),
    tenantId: normalizeTenantId(record.tenantId),
    profileId: readString(record.profileId),
    provider: readString(record.provider).toLowerCase(),
    alias: readString(record.alias) || null,
    bindingRole: role.role,
    capability,
    envTarget: readString(record.envTarget).toLowerCase() || 'workspace_runtime',
    projectionMode: readString(record.projectionMode).toLowerCase() || 'minimum',
    allowedActions,
    requiredCapabilities,
    createdAt: readString(record.createdAt || nowIso()),
    updatedAt: readString(record.updatedAt || nowIso()),
    createdBy: readString(record.createdBy) || 'provider-bindings',
    notes: readString(record.notes) || null
  };
}

function loadBindingsStore(config) {
  const parsed = readJson(getWorkspaceProviderBindingsPath(config), { version: 1, bindings: [] });
  return {
    version: 1,
    bindings: Array.isArray(parsed?.bindings) ? parsed.bindings.map(normalizeBindingRecord) : []
  };
}

function saveBindingsStore(config, store) {
  writeJson(getWorkspaceProviderBindingsPath(config), {
    version: 1,
    bindings: Array.isArray(store?.bindings) ? store.bindings.map(normalizeBindingRecord) : []
  });
}

export function ensureWorkspaceProviderBindingsStore(config) {
  const store = loadBindingsStore(config);
  saveBindingsStore(config, store);
  return { workspaceProviderBindingsPath: getWorkspaceProviderBindingsPath(config) };
}

function decorateBinding(config, binding) {
  return {
    ...binding,
    profile: getProviderProfile(config, binding.profileId, { tenantId: binding.tenantId }),
    role: resolveBindingRole(binding.bindingRole, binding.capability)
  };
}

export function listWorkspaceProviderBindings(config, options = {}) {
  const workspaceId = readString(options.workspaceId);
  const tenantId = options.tenantId ? normalizeTenantId(options.tenantId) : null;
  const bindings = loadBindingsStore(config).bindings
    .filter(binding => {
      if (workspaceId && binding.workspaceId !== workspaceId) return false;
      if (tenantId && binding.tenantId !== tenantId) return false;
      return true;
    })
    .map(binding => decorateBinding(config, binding));
  return {
    total: bindings.length,
    bindings,
    roles: getBindingRoleCatalog().roles
  };
}

export function upsertWorkspaceProviderBinding(config, options = {}) {
  const workspaceId = readString(options.workspaceId);
  if (!workspaceId) {
    throw new Error('workspaceId is required for provider bindings.');
  }
  const workspace = getWorkspace(config, workspaceId);
  if (!workspace) {
    throw new Error(`Workspace '${workspaceId}' was not found.`);
  }
  const tenantId = normalizeTenantId(options.tenantId || workspace?.metadata?.tenantId);
  const profile = resolveProviderProfileRecord(config, options.profileId, { tenantId });
  if (!profile) {
    throw new Error(`Provider profile '${options.profileId}' was not found for tenant '${tenantId}'.`);
  }
  const role = resolveBindingRole(options.bindingRole, options.capability);
  const capability = readString(options.capability).toLowerCase() || role.defaultCapability;
  const providerCapabilities = Array.isArray(profile.capabilities) ? profile.capabilities : [];
  if (role.requiredCapabilities.length && !role.requiredCapabilities.some(item => providerCapabilities.includes(item))) {
    throw new Error(`Provider '${profile.alias}' does not satisfy binding role '${role.role}'. Required capabilities: ${role.requiredCapabilities.join(', ')}.`);
  }
  if (capability && !providerCapabilities.includes(capability) && capability !== 'runtime') {
    throw new Error(`Provider '${profile.alias}' does not advertise capability '${capability}'.`);
  }

  const store = loadBindingsStore(config);
  const existingIndex = store.bindings.findIndex(item => item.workspaceId === workspaceId && item.profileId === profile.profileId && item.bindingRole === role.role);
  const existing = existingIndex >= 0 ? store.bindings[existingIndex] : null;
  const next = normalizeBindingRecord({
    ...(existing || {}),
    bindingId: existing?.bindingId || readString(options.bindingId || crypto.randomUUID()),
    workspaceId,
    tenantId,
    profileId: profile.profileId,
    provider: profile.provider,
    alias: profile.alias,
    bindingRole: role.role,
    capability,
    envTarget: options.envTarget,
    projectionMode: options.projectionMode,
    allowedActions: Array.isArray(options.allowedActions) && options.allowedActions.length ? options.allowedActions : role.allowedActions,
    requiredCapabilities: Array.isArray(options.requiredCapabilities) && options.requiredCapabilities.length ? options.requiredCapabilities : role.requiredCapabilities,
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso(),
    createdBy: options.createdBy || 'provider-bindings',
    notes: options.notes || null
  });

  if (existingIndex >= 0) {
    store.bindings[existingIndex] = next;
  } else {
    store.bindings.push(next);
  }
  saveBindingsStore(config, store);

  appendAuditEvent(config, {
    action: 'workspace.provider_binding.upsert',
    actorType: readString(options.actorType || 'operator') || 'operator',
    actorId: readString(options.actorId || 'provider-bindings') || 'provider-bindings',
    tenantId,
    workspaceId,
    detail: {
      bindingId: next.bindingId,
      profileId: next.profileId,
      provider: next.provider,
      alias: next.alias,
      bindingRole: next.bindingRole,
      capability: next.capability,
      envTarget: next.envTarget,
      projectionMode: next.projectionMode,
      allowedActions: next.allowedActions,
      requiredCapabilities: next.requiredCapabilities
    }
  });

  updateWorkspaceStatus(config, workspaceId, workspace.status || 'ready', 'provider_binding_update');

  return {
    saved: true,
    binding: decorateBinding(config, next)
  };
}

export function deleteWorkspaceProviderBinding(config, options = {}) {
  const workspaceId = readString(options.workspaceId);
  const bindingId = readString(options.bindingId);
  if (!workspaceId || !bindingId) {
    throw new Error('workspaceId and bindingId are required to delete a provider binding.');
  }
  const workspace = getWorkspace(config, workspaceId);
  if (!workspace) {
    throw new Error(`Workspace '${workspaceId}' was not found.`);
  }
  const tenantId = normalizeTenantId(options.tenantId || workspace?.metadata?.tenantId);
  const store = loadBindingsStore(config);
  const index = store.bindings.findIndex(item => item.workspaceId === workspaceId && item.bindingId === bindingId && item.tenantId === tenantId);
  if (index === -1) {
    throw new Error(`Provider binding '${bindingId}' was not found for workspace '${workspaceId}'.`);
  }
  const [removed] = store.bindings.splice(index, 1);
  saveBindingsStore(config, store);
  appendAuditEvent(config, {
    action: 'workspace.provider_binding.delete',
    actorType: readString(options.actorType || 'operator') || 'operator',
    actorId: readString(options.actorId || 'provider-bindings') || 'provider-bindings',
    tenantId,
    workspaceId,
    detail: {
      bindingId: removed.bindingId,
      profileId: removed.profileId,
      bindingRole: removed.bindingRole,
      capability: removed.capability
    }
  });
  updateWorkspaceStatus(config, workspaceId, workspace.status || 'ready', 'provider_binding_delete');
  return {
    ok: true,
    removed: decorateBinding(config, removed)
  };
}
