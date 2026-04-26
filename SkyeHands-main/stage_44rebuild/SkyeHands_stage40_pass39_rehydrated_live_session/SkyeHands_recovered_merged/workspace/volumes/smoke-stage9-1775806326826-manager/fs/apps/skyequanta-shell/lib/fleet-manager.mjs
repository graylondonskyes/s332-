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

function normalizeProfileId(value, fallback = 'standard') {
  return String(value || '').trim().toLowerCase() || fallback;
}

function normalizePoolId(value, fallback = 'primary') {
  return String(value || '').trim().toLowerCase() || fallback;
}

function normalizeArray(values = []) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))];
}

function normalizePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizePoolState(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['active', 'draining', 'maintenance'].includes(normalized) ? normalized : 'active';
}

function defaultProfileDecorations(profileId) {
  const normalized = normalizeProfileId(profileId);
  const stackPreset = normalized.includes('gpu') ? 'gpu-runtime' : (normalized.includes('large') || normalized.includes('xl') ? 'high-memory-runtime' : 'standard-runtime');
  const startupRecipe = normalized.includes('skydexia') ? 'skydexia:ignite' : (normalized === 'large' ? 'workspace:heavy-start' : 'workspace:standard-start');
  const labels = normalized.includes('skydexia')
    ? ['skydexia', 'donor-imported']
    : (normalized === 'large' ? ['high-memory'] : ['baseline']);
  return { stackPreset, startupRecipe, labels };
}

function normalizeProfileRecord(record = {}, fallbackProfileId = 'standard') {
  const profileId = normalizeProfileId(record.profileId || record.id || record.name, fallbackProfileId);
  const defaults = defaultProfileDecorations(profileId);
  return {
    profileId,
    name: String(record.name || profileId).trim() || profileId,
    cpu: normalizePositiveInt(record.cpu, 4),
    memoryMb: normalizePositiveInt(record.memoryMb, 8192),
    diskGb: normalizePositiveInt(record.diskGb, 40),
    stackPreset: String(record.stackPreset || defaults.stackPreset).trim() || defaults.stackPreset,
    startupRecipe: String(record.startupRecipe || defaults.startupRecipe).trim() || defaults.startupRecipe,
    labels: normalizeArray(record.labels || defaults.labels),
    source: String(record.source || 'config-lifecycle').trim() || 'config-lifecycle',
    baseProfileId: record.baseProfileId ? normalizeProfileId(record.baseProfileId, profileId) : null,
    createdAt: String(record.createdAt || nowIso()),
    updatedAt: String(record.updatedAt || nowIso())
  };
}

function normalizePoolRecord(record = {}, fallbackPoolId = 'primary') {
  const poolId = normalizePoolId(record.poolId || record.id || record.name, fallbackPoolId);
  return {
    poolId,
    label: String(record.label || poolId).trim() || poolId,
    region: String(record.region || 'local').trim() || 'local',
    driver: String(record.driver || 'skyequanta-bridge').trim() || 'skyequanta-bridge',
    allowedProfiles: normalizeArray(record.allowedProfiles || ['standard']),
    capacity: normalizePositiveInt(record.capacity, 1),
    state: normalizePoolState(record.state),
    maintenanceWindow: String(record.maintenanceWindow || '').trim() || null,
    startupRecipes: normalizeArray(record.startupRecipes || []),
    labels: normalizeArray(record.labels || []),
    createdAt: String(record.createdAt || nowIso()),
    updatedAt: String(record.updatedAt || nowIso())
  };
}

function normalizeAssignmentRecord(record = {}) {
  return {
    id: String(record.id || '').trim() || crypto.randomUUID(),
    workspaceId: normalizeWorkspaceId(record.workspaceId),
    tenantId: normalizeTenantId(record.tenantId),
    poolId: normalizePoolId(record.poolId),
    profileId: normalizeProfileId(record.profileId),
    startupRecipe: String(record.startupRecipe || '').trim() || null,
    stackPreset: String(record.stackPreset || '').trim() || null,
    actorId: String(record.actorId || 'fleet-assignment').trim() || 'fleet-assignment',
    source: String(record.source || 'push-beyond-fleet').trim() || 'push-beyond-fleet',
    status: String(record.status || 'active').trim().toLowerCase() || 'active',
    assignedAt: String(record.assignedAt || nowIso()),
    releasedAt: record.releasedAt ? String(record.releasedAt) : null
  };
}

function emptyStore() {
  return {
    version: 1,
    machineProfiles: {},
    pools: {},
    assignments: [],
    workspacePreferences: {}
  };
}

export function getFleetStorePath(config) {
  return path.join(config.rootDir, '.skyequanta', 'fleet-state.json');
}

function applyLifecycleProfiles(store, config) {
  const lifecycleProfiles = config.lifecycle?.machineProfiles && typeof config.lifecycle.machineProfiles === 'object'
    ? config.lifecycle.machineProfiles
    : {};
  for (const [profileId, profile] of Object.entries(lifecycleProfiles)) {
    const normalized = normalizeProfileRecord({ ...profile, profileId, source: 'config-lifecycle' }, profileId);
    if (!store.machineProfiles[normalized.profileId]) {
      store.machineProfiles[normalized.profileId] = normalized;
      continue;
    }
    const existing = store.machineProfiles[normalized.profileId];
    store.machineProfiles[normalized.profileId] = {
      ...normalized,
      ...existing,
      profileId: normalized.profileId,
      name: existing.name || normalized.name,
      source: existing.source || normalized.source,
      updatedAt: existing.updatedAt || normalized.updatedAt
    };
  }
}

function loadStore(config) {
  const parsed = readJson(getFleetStorePath(config), emptyStore());
  const normalized = {
    version: 1,
    machineProfiles: {},
    pools: {},
    assignments: Array.isArray(parsed?.assignments) ? parsed.assignments.map(normalizeAssignmentRecord) : [],
    workspacePreferences: parsed?.workspacePreferences && typeof parsed.workspacePreferences === 'object' ? parsed.workspacePreferences : {}
  };

  const machineProfiles = parsed?.machineProfiles && typeof parsed.machineProfiles === 'object' ? parsed.machineProfiles : {};
  for (const [profileId, record] of Object.entries(machineProfiles)) {
    normalized.machineProfiles[normalizeProfileId(profileId)] = normalizeProfileRecord(record, profileId);
  }

  const pools = parsed?.pools && typeof parsed.pools === 'object' ? parsed.pools : {};
  for (const [poolId, record] of Object.entries(pools)) {
    normalized.pools[normalizePoolId(poolId)] = normalizePoolRecord(record, poolId);
  }

  applyLifecycleProfiles(normalized, config);
  return normalized;
}

function saveStore(config, store) {
  writeJson(getFleetStorePath(config), store);
  return store;
}

export function ensureFleetStore(config) {
  const store = loadStore(config);
  saveStore(config, store);
  return store;
}

function summarizeAssignments(assignments = []) {
  const active = assignments.filter(item => item.status === 'active');
  return {
    total: assignments.length,
    active: active.length,
    released: assignments.filter(item => item.status === 'released').length,
    byPool: Object.fromEntries([...new Set(active.map(item => item.poolId))].map(poolId => [poolId, active.filter(item => item.poolId === poolId).length]))
  };
}

export function listMachineProfiles(config) {
  const store = loadStore(config);
  return Object.values(store.machineProfiles).sort((a, b) => a.profileId.localeCompare(b.profileId));
}

export function listFleetPools(config) {
  const store = loadStore(config);
  const activeAssignments = store.assignments.filter(item => item.status === 'active');
  return Object.values(store.pools)
    .sort((a, b) => a.poolId.localeCompare(b.poolId))
    .map(pool => ({
      ...pool,
      activeAssignments: activeAssignments.filter(item => item.poolId === pool.poolId).length,
      availableCapacity: Math.max(pool.capacity - activeAssignments.filter(item => item.poolId === pool.poolId).length, 0)
    }));
}

export function upsertMachineProfile(config, options = {}) {
  const store = loadStore(config);
  const stamp = nowIso();
  const profileId = normalizeProfileId(options.profileId || options.id || options.name, 'custom');
  const existing = store.machineProfiles[profileId] || null;
  const profile = normalizeProfileRecord({
    ...(existing || {}),
    ...options,
    profileId,
    createdAt: existing?.createdAt || stamp,
    updatedAt: stamp,
    source: options.source || existing?.source || 'push-beyond-fleet'
  }, profileId);

  store.machineProfiles[profileId] = profile;
  saveStore(config, store);
  appendAuditEvent(config, {
    action: 'fleet.profile.upsert',
    actorType: 'operator',
    actorId: String(options.actorId || 'fleet-profile-upsert').trim() || 'fleet-profile-upsert',
    tenantId: normalizeTenantId(options.tenantId),
    workspaceId: normalizeWorkspaceId(options.workspaceId),
    detail: profile
  });
  publishRuntimeEvent(config, {
    workspaceId: normalizeWorkspaceId(options.workspaceId),
    lane: 'fleet',
    type: 'machine-profile-upserted',
    payload: { profileId: profile.profileId, stackPreset: profile.stackPreset, startupRecipe: profile.startupRecipe }
  });
  return { profile, profiles: listMachineProfiles(config) };
}

export function setWorkspaceMachineProfile(config, options = {}) {
  const store = loadStore(config);
  const workspaceId = normalizeWorkspaceId(options.workspaceId);
  const profileId = normalizeProfileId(options.profileId || options.machineProfileId, config.lifecycle?.defaultMachineProfile || 'standard');
  const profile = store.machineProfiles[profileId];
  if (!profile) {
    throw new Error(`Machine profile '${profileId}' is not registered.`);
  }

  const stamp = nowIso();
  store.workspacePreferences[workspaceId] = {
    workspaceId,
    profileId,
    startupRecipe: String(options.startupRecipe || profile.startupRecipe || '').trim() || profile.startupRecipe,
    stackPreset: String(options.stackPreset || profile.stackPreset || '').trim() || profile.stackPreset,
    updatedAt: stamp,
    source: String(options.source || 'push-beyond-fleet').trim() || 'push-beyond-fleet'
  };
  saveStore(config, store);
  appendAuditEvent(config, {
    action: 'fleet.workspace.profile.set',
    actorType: 'operator',
    actorId: String(options.actorId || 'fleet-profile-set').trim() || 'fleet-profile-set',
    tenantId: normalizeTenantId(options.tenantId),
    workspaceId,
    detail: store.workspacePreferences[workspaceId]
  });
  publishRuntimeEvent(config, {
    workspaceId,
    lane: 'fleet',
    type: 'workspace-machine-profile-set',
    payload: store.workspacePreferences[workspaceId]
  });
  return {
    workspaceId,
    preference: store.workspacePreferences[workspaceId],
    profile
  };
}

export function upsertFleetPool(config, options = {}) {
  const store = loadStore(config);
  const stamp = nowIso();
  const poolId = normalizePoolId(options.poolId || options.id || options.label || options.name, 'primary');
  const existing = store.pools[poolId] || null;
  const pool = normalizePoolRecord({
    ...(existing || {}),
    ...options,
    poolId,
    createdAt: existing?.createdAt || stamp,
    updatedAt: stamp,
    state: options.state || existing?.state || 'active'
  }, poolId);

  for (const profileId of pool.allowedProfiles) {
    if (!store.machineProfiles[normalizeProfileId(profileId)]) {
      throw new Error(`Fleet pool '${poolId}' references unknown machine profile '${profileId}'.`);
    }
  }

  store.pools[poolId] = pool;
  saveStore(config, store);
  appendAuditEvent(config, {
    action: 'fleet.pool.upsert',
    actorType: 'operator',
    actorId: String(options.actorId || 'fleet-pool-upsert').trim() || 'fleet-pool-upsert',
    tenantId: normalizeTenantId(options.tenantId),
    workspaceId: normalizeWorkspaceId(options.workspaceId),
    detail: pool
  });
  publishRuntimeEvent(config, {
    workspaceId: normalizeWorkspaceId(options.workspaceId),
    lane: 'fleet',
    type: 'fleet-pool-upserted',
    payload: { poolId: pool.poolId, state: pool.state, capacity: pool.capacity }
  });
  return { pool, pools: listFleetPools(config) };
}

export function setFleetPoolState(config, options = {}) {
  const store = loadStore(config);
  const poolId = normalizePoolId(options.poolId);
  const pool = store.pools[poolId];
  if (!pool) {
    throw new Error(`Fleet pool '${poolId}' is not registered.`);
  }

  pool.state = normalizePoolState(options.state || pool.state);
  pool.updatedAt = nowIso();
  if (options.maintenanceWindow !== undefined) {
    pool.maintenanceWindow = String(options.maintenanceWindow || '').trim() || null;
  }
  saveStore(config, store);
  appendAuditEvent(config, {
    action: 'fleet.pool.state.set',
    actorType: 'operator',
    actorId: String(options.actorId || 'fleet-pool-state').trim() || 'fleet-pool-state',
    tenantId: normalizeTenantId(options.tenantId),
    workspaceId: normalizeWorkspaceId(options.workspaceId),
    detail: { poolId: pool.poolId, state: pool.state, maintenanceWindow: pool.maintenanceWindow }
  });
  publishRuntimeEvent(config, {
    workspaceId: normalizeWorkspaceId(options.workspaceId),
    lane: 'fleet',
    type: 'fleet-pool-state-set',
    payload: { poolId: pool.poolId, state: pool.state }
  });
  return { pool, pools: listFleetPools(config) };
}

function getActiveAssignmentsForPool(store, poolId) {
  return store.assignments.filter(item => item.poolId === poolId && item.status === 'active');
}

export function assignWorkspaceToFleet(config, options = {}) {
  const store = loadStore(config);
  const workspaceId = normalizeWorkspaceId(options.workspaceId);
  const poolId = normalizePoolId(options.poolId);
  const pool = store.pools[poolId];
  if (!pool) {
    throw new Error(`Fleet pool '${poolId}' is not registered.`);
  }
  if (pool.state !== 'active') {
    throw new Error(`Fleet pool '${poolId}' is currently ${pool.state} and cannot accept new assignments.`);
  }

  const preference = store.workspacePreferences[workspaceId] || null;
  const profileId = normalizeProfileId(options.profileId || preference?.profileId, config.lifecycle?.defaultMachineProfile || 'standard');
  const profile = store.machineProfiles[profileId];
  if (!profile) {
    throw new Error(`Machine profile '${profileId}' is not registered.`);
  }
  if (!pool.allowedProfiles.includes(profileId)) {
    throw new Error(`Fleet pool '${poolId}' does not allow machine profile '${profileId}'.`);
  }

  const activeAssignments = getActiveAssignmentsForPool(store, poolId);
  const existingForWorkspace = store.assignments.find(item => item.workspaceId === workspaceId && item.status === 'active');
  const capacityUsage = existingForWorkspace && existingForWorkspace.poolId === poolId ? activeAssignments.length - 1 : activeAssignments.length;
  if (capacityUsage >= pool.capacity) {
    throw new Error(`Fleet pool '${poolId}' is at capacity.`);
  }

  if (existingForWorkspace) {
    existingForWorkspace.status = 'released';
    existingForWorkspace.releasedAt = nowIso();
  }

  const assignment = normalizeAssignmentRecord({
    workspaceId,
    tenantId: normalizeTenantId(options.tenantId),
    poolId,
    profileId,
    startupRecipe: String(options.startupRecipe || preference?.startupRecipe || profile.startupRecipe).trim() || profile.startupRecipe,
    stackPreset: String(options.stackPreset || preference?.stackPreset || profile.stackPreset).trim() || profile.stackPreset,
    actorId: String(options.actorId || 'fleet-assign').trim() || 'fleet-assign',
    source: String(options.source || 'push-beyond-fleet').trim() || 'push-beyond-fleet'
  });
  store.assignments.push(assignment);
  saveStore(config, store);
  appendAuditEvent(config, {
    action: 'fleet.assignment.create',
    actorType: 'operator',
    actorId: assignment.actorId,
    tenantId: assignment.tenantId,
    workspaceId,
    detail: assignment
  });
  publishRuntimeEvent(config, {
    workspaceId,
    lane: 'fleet',
    type: 'fleet-assignment-created',
    payload: assignment
  });

  return {
    assignment,
    pool: listFleetPools(config).find(item => item.poolId === poolId) || pool,
    profile,
    status: getFleetStatus(config, workspaceId)
  };
}

export function releaseFleetAssignment(config, options = {}) {
  const store = loadStore(config);
  const workspaceId = normalizeWorkspaceId(options.workspaceId);
  const active = store.assignments.find(item => item.workspaceId === workspaceId && item.status === 'active');
  if (!active) {
    throw new Error(`Workspace '${workspaceId}' has no active fleet assignment.`);
  }
  active.status = 'released';
  active.releasedAt = nowIso();
  saveStore(config, store);
  appendAuditEvent(config, {
    action: 'fleet.assignment.release',
    actorType: 'operator',
    actorId: String(options.actorId || 'fleet-release').trim() || 'fleet-release',
    tenantId: active.tenantId,
    workspaceId,
    detail: active
  });
  publishRuntimeEvent(config, {
    workspaceId,
    lane: 'fleet',
    type: 'fleet-assignment-released',
    payload: active
  });
  return {
    released: active,
    status: getFleetStatus(config, workspaceId)
  };
}

export function getFleetStatus(config, workspaceId = null) {
  const store = loadStore(config);
  const profiles = listMachineProfiles(config);
  const pools = listFleetPools(config);
  const assignments = store.assignments.slice().sort((a, b) => String(b.assignedAt || '').localeCompare(String(a.assignedAt || '')));
  const normalizedWorkspaceId = workspaceId ? normalizeWorkspaceId(workspaceId) : null;
  const currentAssignment = normalizedWorkspaceId
    ? assignments.find(item => item.workspaceId === normalizedWorkspaceId && item.status === 'active') || null
    : null;
  const preference = normalizedWorkspaceId ? (store.workspacePreferences[normalizedWorkspaceId] || null) : null;
  return {
    workspaceId: normalizedWorkspaceId,
    profiles,
    pools,
    assignments,
    preference,
    currentAssignment,
    summary: {
      profileCount: profiles.length,
      poolCount: pools.length,
      activePools: pools.filter(item => item.state === 'active').length,
      drainingPools: pools.filter(item => item.state === 'draining').length,
      maintenancePools: pools.filter(item => item.state === 'maintenance').length,
      assignments: summarizeAssignments(assignments),
      currentWorkspaceProfile: preference?.profileId || currentAssignment?.profileId || (config.lifecycle?.defaultMachineProfile || 'standard'),
      currentWorkspacePool: currentAssignment?.poolId || null
    }
  };
}
