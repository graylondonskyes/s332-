import { appendAuditEvent } from './governance-manager.mjs';
import { discoverProviderResources, inferProviderCapabilities, normalizeProvider } from './provider-connectors.mjs';
import { deleteWorkspaceProviderBinding, listWorkspaceProviderBindings, upsertWorkspaceProviderBinding } from './provider-bindings.mjs';
import { decryptProviderProfile, getProviderProfile } from './provider-vault.mjs';

function readString(value) {
  return String(value ?? '').trim();
}

function normalizeTenantId(value) {
  const normalized = readString(value).toLowerCase();
  return normalized || 'local';
}

function unique(items = []) {
  return [...new Set(items.map(item => readString(item).toLowerCase()).filter(Boolean))];
}

export function buildProviderBindingSuggestions(profile, options = {}) {
  const provider = normalizeProvider(profile?.provider || options.provider);
  const capabilitySet = new Set(unique(Array.isArray(profile?.capabilities) && profile.capabilities.length ? profile.capabilities : inferProviderCapabilities(provider, options.payload || {})));
  const suggestions = [];
  const push = (bindingRole, capability, envTarget, allowedActions, notes = null) => {
    suggestions.push({
      bindingRole,
      capability,
      envTarget,
      projectionMode: 'minimum',
      allowedActions: unique(allowedActions),
      requiredCapabilities: unique([capability]),
      notes
    });
  };

  if (provider === 'neon') {
    if (capabilitySet.has('database')) push('primary_database', 'database', 'workspace_runtime', ['db_connect', 'provider_runtime_execution'], 'Auto-suggested from Neon/Postgres discovery.');
  }
  if (provider === 'cloudflare') {
    if (capabilitySet.has('worker_runtime')) push('worker_deploy', 'worker_runtime', 'deployment_runtime', ['worker_deploy', 'provider_runtime_execution'], 'Auto-suggested from Cloudflare discovery.');
    if (capabilitySet.has('object_storage')) push('object_storage', 'object_storage', 'workspace_runtime', ['object_storage', 'provider_runtime_execution'], 'Auto-suggested from Cloudflare discovery.');
    if (capabilitySet.has('preview')) push('preview_deploy', 'preview', 'deployment_runtime', ['preview_deploy', 'provider_runtime_execution'], 'Auto-suggested from Cloudflare discovery.');
  }
  if (provider === 'netlify') {
    if (capabilitySet.has('site_runtime')) push('site_deploy', 'site_runtime', 'deployment_runtime', ['site_deploy', 'provider_runtime_execution'], 'Auto-suggested from Netlify discovery.');
    if (capabilitySet.has('preview')) push('preview_deploy', 'preview', 'deployment_runtime', ['preview_deploy', 'provider_runtime_execution'], 'Auto-suggested from Netlify discovery.');
  }
  if (provider === 'github') {
    if (capabilitySet.has('scm')) push('scm_origin', 'scm', 'workspace_runtime', ['scm_sync', 'provider_runtime_execution'], 'Auto-suggested from GitHub discovery.');
  }
  if (provider === 'env_bundle') {
    push('runtime_env', 'runtime', 'workspace_runtime', ['provider_runtime_execution'], 'Auto-suggested from env bundle discovery.');
  }

  const seen = new Set();
  const deduped = [];
  for (const suggestion of suggestions) {
    const key = `${suggestion.bindingRole}:${suggestion.capability}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(suggestion);
  }
  return deduped;
}

export async function discoverProviderForWorkspace(config, options = {}) {
  const profile = getProviderProfile(config, options.profileId, { tenantId: options.tenantId });
  if (!profile) {
    throw new Error(`Provider profile '${options.profileId}' was not found.`);
  }
  const decrypted = decryptProviderProfile(config, {
    profileId: profile.profileId,
    tenantId: profile.tenantId,
    unlockSecret: options.unlockSecret
  });
  const discovery = await discoverProviderResources(profile, decrypted.payload, {
    workspaceId: options.workspaceId || null,
    tenantId: profile.tenantId,
    timeoutMs: options.timeoutMs || null,
    action: options.action || 'provider_discovery'
  });
  return {
    profile,
    discovery,
    suggestions: buildProviderBindingSuggestions(profile, { payload: decrypted.payload })
  };
}

export function bootstrapWorkspaceProviderBindings(config, options = {}) {
  const workspaceId = readString(options.workspaceId);
  if (!workspaceId) {
    throw new Error('workspaceId is required for provider bootstrap.');
  }
  const profile = getProviderProfile(config, options.profileId, { tenantId: options.tenantId });
  if (!profile) {
    throw new Error(`Provider profile '${options.profileId}' was not found.`);
  }
  const tenantId = normalizeTenantId(options.tenantId || profile.tenantId);
  const suggestions = Array.isArray(options.suggestions) ? options.suggestions : buildProviderBindingSuggestions(profile, options);
  const replaceExisting = Boolean(options.replaceExisting);
  const existing = listWorkspaceProviderBindings(config, { workspaceId, tenantId }).bindings.filter(item => item.profileId === profile.profileId);
  const deletedBindings = [];
  if (replaceExisting) {
    for (const binding of existing) {
      deletedBindings.push(deleteWorkspaceProviderBinding(config, {
        workspaceId,
        bindingId: binding.bindingId,
        tenantId,
        actorType: options.actorType,
        actorId: options.actorId
      }));
    }
  }
  const applied = [];
  for (const suggestion of suggestions) {
    applied.push(upsertWorkspaceProviderBinding(config, {
      workspaceId,
      tenantId,
      profileId: profile.profileId,
      bindingRole: suggestion.bindingRole,
      capability: suggestion.capability,
      envTarget: suggestion.envTarget,
      projectionMode: suggestion.projectionMode,
      allowedActions: suggestion.allowedActions,
      requiredCapabilities: suggestion.requiredCapabilities,
      notes: suggestion.notes || readString(options.notes) || 'Auto-bootstrap from provider discovery.',
      actorType: options.actorType || 'operator',
      actorId: options.actorId || 'provider-bootstrap',
      createdBy: options.createdBy || 'provider-bootstrap'
    }));
  }
  appendAuditEvent(config, {
    action: 'workspace.provider_bootstrap.apply',
    actorType: readString(options.actorType || 'operator') || 'operator',
    actorId: readString(options.actorId || 'provider-bootstrap') || 'provider-bootstrap',
    tenantId,
    workspaceId,
    detail: {
      profileId: profile.profileId,
      provider: profile.provider,
      alias: profile.alias,
      suggestionCount: suggestions.length,
      appliedBindingIds: applied.map(item => item.binding.bindingId),
      replacedExisting: replaceExisting,
      deletedBindingIds: deletedBindings.map(item => item?.bindingId).filter(Boolean)
    }
  });
  return {
    ok: true,
    workspaceId,
    tenantId,
    profile,
    suggestions,
    applied,
    deletedBindings,
    totalApplied: applied.length
  };
}
