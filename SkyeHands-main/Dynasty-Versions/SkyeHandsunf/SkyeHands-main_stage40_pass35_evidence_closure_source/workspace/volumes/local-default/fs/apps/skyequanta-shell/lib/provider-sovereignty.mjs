import { listProviderProfiles } from './provider-vault.mjs';
import { listWorkspaceProviderBindings } from './provider-bindings.mjs';

function sortObjectEntries(value = {}) {
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}

export function getProviderSovereigntySummary(config, options = {}) {
  const tenantId = options.tenantId || null;
  const providerProfiles = listProviderProfiles(config, tenantId ? { tenantId } : {}).profiles || [];
  const bindings = listWorkspaceProviderBindings(config, tenantId ? { tenantId } : {}).bindings || [];

  const providerCounts = {};
  const capabilityCounts = {};
  const bindingRoleCounts = {};
  const tenantIds = new Set();
  const workspaceIds = new Set();
  const boundProfileIds = new Set();

  for (const profile of providerProfiles) {
    tenantIds.add(profile.tenantId || 'local');
    providerCounts[profile.provider] = (providerCounts[profile.provider] || 0) + 1;
    for (const capability of profile.capabilities || []) {
      capabilityCounts[capability] = (capabilityCounts[capability] || 0) + 1;
    }
  }

  for (const binding of bindings) {
    tenantIds.add(binding.tenantId || 'local');
    if (binding.workspaceId) workspaceIds.add(binding.workspaceId);
    if (binding.profileId) boundProfileIds.add(binding.profileId);
    bindingRoleCounts[binding.bindingRole] = (bindingRoleCounts[binding.bindingRole] || 0) + 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    tenantFilter: tenantId || null,
    totalProfiles: providerProfiles.length,
    encryptedAtRestProfiles: providerProfiles.filter(item => item?.vault?.encryptedAtRest).length,
    totalBindings: bindings.length,
    boundProfiles: boundProfileIds.size,
    workspacesUsingProviderBindings: workspaceIds.size,
    tenantsRepresented: tenantIds.size,
    providerCounts: sortObjectEntries(providerCounts),
    capabilityCounts: sortObjectEntries(capabilityCounts),
    bindingRoleCounts: sortObjectEntries(bindingRoleCounts),
    userOwnedExecutionDefaults: {
      encryptedAtRest: true,
      founderCredentialMixingBlocked: true,
      unlockRequiredForProviderExecution: true
    }
  };
}

export function buildProviderSovereigntyNarrative(summary = {}) {
  const providerBreakdown = Object.entries(summary.providerCounts || {})
    .map(([provider, count]) => `${provider}: ${count}`)
    .join(', ') || 'no provider profiles yet';
  const bindingBreakdown = Object.entries(summary.bindingRoleCounts || {})
    .map(([role, count]) => `${role}: ${count}`)
    .join(', ') || 'no workspace bindings yet';

  return [
    `User-owned provider profiles present: ${summary.totalProfiles || 0}.`,
    `Encrypted-at-rest provider profiles present: ${summary.encryptedAtRestProfiles || 0}.`,
    `Workspace bindings present: ${summary.totalBindings || 0} across ${summary.workspacesUsingProviderBindings || 0} workspace(s).`,
    `Provider mix: ${providerBreakdown}.`,
    `Binding roles in use: ${bindingBreakdown}.`,
    'Provider execution remains unlock-gated and user-owned with no silent founder-credential fallback in the sovereign lane.'
  ];
}
