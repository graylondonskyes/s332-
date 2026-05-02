import { buildProviderEnvProjection, buildProviderRuntimeActionPlan } from './provider-connectors.mjs';
import { appendAuditEvent } from './governance-manager.mjs';
import { getUnlockedProviderProfileForSession } from './session-manager.mjs';
import { decryptProviderProfile } from './provider-vault.mjs';
import { listWorkspaceProviderBindings } from './provider-bindings.mjs';
import { getFounderLaneDeclaration } from './provider-governance-lane.mjs';

function readString(value) {
  return String(value ?? '').trim();
}

function maskEnvValue(value) {
  const normalized = readString(value);
  if (!normalized) {
    return '';
  }
  if (normalized.length <= 8) {
    return '*'.repeat(Math.max(4, normalized.length));
  }
  return `${normalized.slice(0, 4)}${'*'.repeat(Math.max(4, normalized.length - 8))}${normalized.slice(-4)}`;
}

const ACTION_BINDING_ROLE_PREFERENCES = {
  db_connect: ['primary_database', 'runtime_env'],
  worker_deploy: ['worker_deploy', 'runtime_env'],
  site_deploy: ['site_deploy', 'preview_deploy', 'runtime_env'],
  preview_deploy: ['preview_deploy', 'site_deploy', 'runtime_env'],
  scm_sync: ['scm_origin', 'runtime_env'],
  object_storage: ['object_storage', 'runtime_env'],
  provider_runtime_execution: ['runtime_env', 'primary_database', 'worker_deploy', 'site_deploy', 'preview_deploy', 'scm_origin', 'object_storage'],
  provider_projection: ['runtime_env', 'primary_database', 'worker_deploy', 'site_deploy', 'preview_deploy', 'scm_origin', 'object_storage'],
  provider_test: ['runtime_env', 'primary_database', 'worker_deploy', 'site_deploy', 'preview_deploy', 'scm_origin', 'object_storage']
};

function bindingMatchesAction(binding, targetAction, requestedRole, requestedCapability) {
  if (requestedRole && binding.bindingRole !== requestedRole) {
    return false;
  }
  if (requestedCapability && binding.capability !== requestedCapability && !(binding.requiredCapabilities || []).includes(requestedCapability)) {
    return false;
  }
  const preferredRoles = ACTION_BINDING_ROLE_PREFERENCES[targetAction] || [];
  if (!preferredRoles.length) {
    return true;
  }
  if (preferredRoles.includes(binding.bindingRole)) {
    return true;
  }
  return Array.isArray(binding.allowedActions) && binding.allowedActions.includes(targetAction);
}

function projectEnvPreview(env, includeValues) {
  return Object.fromEntries(
    Object.entries(env).map(([key, value]) => [key, includeValues ? value : maskEnvValue(value)])
  );
}

export function resolveWorkspaceProviderProjection(config, options = {}) {
  const workspaceId = readString(options.workspaceId);
  if (!workspaceId) {
    throw new Error('workspaceId is required for provider projection.');
  }
  const includeValues = Boolean(options.includeValues);
  const action = readString(options.action || 'runtime_projection').toLowerCase() || 'runtime_projection';
  const requestedRole = readString(options.bindingRole).toLowerCase() || null;
  const requestedCapability = readString(options.capability).toLowerCase() || null;
  const requestedProfileId = readString(options.profileId) || null;
  const allBindings = listWorkspaceProviderBindings(config, {
    workspaceId,
    tenantId: options.tenantId
  }).bindings;

  const bindings = allBindings.filter(binding => {
    if (requestedProfileId && binding.profileId !== requestedProfileId) return false;
    return bindingMatchesAction(binding, action, requestedRole, requestedCapability);
  });

  const projections = [];
  const executionPlans = [];
  const internalBindings = [];
  const combinedEnv = {};
  const missingUnlock = [];
  const selectedBindingRoles = [];
  const bindingMissing = bindings.length === 0;

  for (const binding of bindings) {
    let payload = null;
    let unlockMode = 'locked';
    if (options.unlockSecret && requestedProfileId && binding.profileId === requestedProfileId) {
      const decrypted = decryptProviderProfile(config, {
        profileId: binding.profileId,
        tenantId: binding.tenantId,
        unlockSecret: options.unlockSecret
      });
      payload = decrypted.payload;
      unlockMode = 'one_off';
    } else if (options.sessionId) {
      const unlocked = getUnlockedProviderProfileForSession(config, {
        sessionId: options.sessionId,
        profileId: binding.profileId
      });
      if (unlocked) {
        payload = unlocked.payload;
        unlockMode = 'session';
      }
    }

    if (!payload) {
      missingUnlock.push({
        bindingId: binding.bindingId,
        profileId: binding.profileId,
        provider: binding.provider,
        alias: binding.alias,
        capability: binding.capability,
        bindingRole: binding.bindingRole,
        allowedActions: binding.allowedActions
      });
      continue;
    }

    const env = buildProviderEnvProjection(binding.provider, payload, {
      capability: binding.capability,
      action
    });
    Object.assign(combinedEnv, env);
    selectedBindingRoles.push(binding.bindingRole);
    const executionPlan = buildProviderRuntimeActionPlan({
      provider: binding.provider,
      alias: binding.alias,
      capabilities: binding.profile?.capabilities || []
    }, payload, {
      action,
      capability: binding.capability,
      bindingRole: binding.bindingRole
    });
    executionPlans.push({
      bindingId: binding.bindingId,
      profileId: binding.profileId,
      bindingRole: binding.bindingRole,
      ...executionPlan
    });
    internalBindings.push({
      bindingId: binding.bindingId,
      profileId: binding.profileId,
      provider: binding.provider,
      alias: binding.alias,
      capability: binding.capability,
      bindingRole: binding.bindingRole,
      payload,
      allowedActions: binding.allowedActions,
      requiredCapabilities: binding.requiredCapabilities
    });
    projections.push({
      bindingId: binding.bindingId,
      profileId: binding.profileId,
      provider: binding.provider,
      alias: binding.alias,
      capability: binding.capability,
      bindingRole: binding.bindingRole,
      envTarget: binding.envTarget,
      projectionMode: binding.projectionMode,
      unlockMode,
      envKeys: Object.keys(env).sort(),
      envPreview: projectEnvPreview(env, includeValues),
      allowedActions: binding.allowedActions,
      requiredCapabilities: binding.requiredCapabilities
    });
  }

  const requiresUnlock = !bindingMissing && missingUnlock.length > 0;
  const ok = !bindingMissing && !requiresUnlock;
  const founderLaneDeclaration = getFounderLaneDeclaration(config, {
    tenantId: options.tenantId,
    workspaceId,
    action
  });
  appendAuditEvent(config, {
    action: 'workspace.provider_projection.resolve',
    actorType: readString(options.actorType || 'operator') || 'operator',
    actorId: readString(options.actorId || 'provider-runtime') || 'provider-runtime',
    tenantId: readString(options.tenantId || 'local') || 'local',
    workspaceId,
    sessionId: readString(options.sessionId) || null,
    detail: {
      action,
      bindingMissing,
      bindingCount: bindings.length,
      projectionCount: projections.length,
      envKeys: Object.keys(combinedEnv).sort(),
      requiresUnlock,
      missingUnlockCount: missingUnlock.length,
      selectedBindingRoles,
      founderFallback: false,
      founderLaneDeclared: founderLaneDeclaration.declared,
      founderLaneAvailable: founderLaneDeclaration.available,
      profiles: projections.map(item => ({
        profileId: item.profileId,
        provider: item.provider,
        capability: item.capability,
        bindingRole: item.bindingRole,
        envKeys: item.envKeys
      }))
    }
  });

  return {
    ok,
    action,
    workspaceId,
    bindingMissing,
    founderFallback: false,
    founderLaneDeclared: founderLaneDeclaration.declared,
    founderLaneAvailable: founderLaneDeclaration.available,
    founderLaneDeclaration,
    selectedLane: 'user-owned',
    requestedBindingRole: requestedRole,
    requestedCapability,
    requiresUnlock,
    missingUnlock,
    selectedBindingRoles: [...new Set(selectedBindingRoles)],
    projections,
    executionPlans,
    ...(options.includeInternalBindings ? { internalBindings } : {}),
    env: includeValues ? combinedEnv : projectEnvPreview(combinedEnv, false),
    envKeys: Object.keys(combinedEnv).sort()
  };
}
