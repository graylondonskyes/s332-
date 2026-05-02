import { getStackConfig } from './config.mjs';
import { ensureRuntimeState } from '../lib/runtime.mjs';
import { discoverProviderResources, getProviderCatalog } from '../lib/provider-connectors.mjs';
import {
  decryptProviderProfile,
  deleteProviderProfile,
  getProviderProfile,
  listProviderProfiles,
  saveProviderProfile
} from '../lib/provider-vault.mjs';
import {
  deleteWorkspaceProviderBinding,
  getBindingRoleCatalog,
  listWorkspaceProviderBindings,
  upsertWorkspaceProviderBinding
} from '../lib/provider-bindings.mjs';
import { resolveWorkspaceProviderProjection } from '../lib/provider-env-projection.mjs';
import {
  getFounderLaneDeclaration,
  listGovernanceSecretMigrationCandidates,
  markGovernanceSecretsFounderManaged,
  migrateGovernanceSecretScopeToProviderProfile
} from '../lib/provider-governance-lane.mjs';
import { bootstrapWorkspaceProviderBindings, buildProviderBindingSuggestions } from '../lib/provider-bootstrap.mjs';
import {
  allowWorkspacePort,
  createSnapshot,
  createWorkspace,
  deleteWorkspace,
  describeSnapshot,
  denyWorkspacePort,
  ensureDefaultWorkspace,
  getWorkspace,
  getSnapshotRetention,
  getWorkspaceRuntime,
  listSnapshots,
  listWorkspacePorts,
  listWorkspaces,
  removeSnapshot,
  runSnapshotRetentionCleanup,
  restoreSnapshot,
  setSnapshotRetention,
  selectWorkspace,
  setWorkspacePorts,
  startWorkspace,
  stopWorkspace,
  updateWorkspaceStatus
} from '../lib/workspace-manager.mjs';
import {
  createWorkspaceSchedulerController,
  getWorkspaceSchedulerSnapshot,
  getWorkspaceSchedulerTrendsCompact
} from '../lib/workspace-scheduler.mjs';
import {
  getPrebuildStatus,
  hydrateWorkspacePrebuild,
  queuePrebuildJob,
  setWorkspacePrebuildPreference
} from '../lib/prebuild-manager.mjs';

function parseArgs(argv) {
  const [command = 'list', ...rest] = argv;
  const options = {
    command,
    id: null,
    name: null,
    status: null,
    repoUrl: null,
    templatePath: null,
    branch: null,
    machineProfile: null,
    secretScope: null,
    startAfterCreate: false,
    prebuildTemplate: null,
    prebuildMode: null,
    hydrationPolicy: null,
    hydratePrebuild: false,
    reason: null,
    forwardedHost: null,
    ports: [],
    label: null,
    snapshotId: null,
    restartAfter: true,
    tenantId: null,
    scope: null,
    mode: 'set',
    maxSnapshots: null,
    maxAgeDays: null,
    intervalMs: null,
    healthTimeoutMs: null,
    maxRestartsPerRun: null,
    restartCooldownMs: null,
    enabled: null,
    cleanupExpiredSessions: null,
    retentionCleanupEnabled: null,
    retentionCleanupEveryRuns: null,
    historyMaxEntries: null,
    bucket: 'day',
    trigger: null,
    startAt: null,
    endAt: null,
    force: false,
    provider: null,
    alias: null,
    description: null,
    unlockSecret: null,
    secretPayload: null,
    profileId: null,
    bindingRole: null,
    capability: null,
    envTarget: null,
    projectionMode: null,
    allowedActions: [],
    requiredCapabilities: [],
    includeValues: false
  };

  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (value === '--name') {
      options.name = rest[index + 1] || null;
      index += 1;
      continue;
    }

if (value === '--repo') {
  options.repoUrl = rest[index + 1] || null;
  index += 1;
  continue;
}

if (value === '--template-path') {
  options.templatePath = rest[index + 1] || null;
  index += 1;
  continue;
}

if (value === '--branch') {
  options.branch = rest[index + 1] || null;
  index += 1;
  continue;
}

if (value === '--machine-profile') {
  options.machineProfile = rest[index + 1] || null;
  index += 1;
  continue;
}

if (value === '--secret-scope') {
  options.secretScope = rest[index + 1] || null;
  index += 1;
  continue;
}

if (value === '--start') {
  options.startAfterCreate = true;
  continue;
}

if (value === '--prebuild-template') {
  options.prebuildTemplate = rest[index + 1] || null;
  index += 1;
  continue;
}

if (value === '--prebuild-mode') {
  options.prebuildMode = rest[index + 1] || null;
  index += 1;
  continue;
}

if (value === '--hydration-policy') {
  options.hydrationPolicy = rest[index + 1] || null;
  index += 1;
  continue;
}

if (value === '--hydrate-prebuild') {
  options.hydratePrebuild = true;
  continue;
}

    if (value === '--status') {
      options.status = rest[index + 1] || null;
      index += 1;
      continue;
    }

    if (value === '--reason') {
      options.reason = rest[index + 1] || null;
      index += 1;
      continue;
    }

    if (value === '--forwarded-host') {
      options.forwardedHost = rest[index + 1] || null;
      index += 1;
      continue;
    }

    if (value === '--ports') {
      const raw = String(rest[index + 1] || '').trim();
      options.ports = raw
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }

    if (value === '--label') {
      options.label = rest[index + 1] || null;
      index += 1;
      continue;
    }

    if (value === '--snapshot') {
      options.snapshotId = rest[index + 1] || null;
      index += 1;
      continue;
    }

    if (value === '--no-restart') {
      options.restartAfter = false;
      continue;
    }

    if (value === '--tenant') {
      options.tenantId = rest[index + 1] || null;
      index += 1;
      continue;
    }

    if (value === '--scope') {
      options.scope = rest[index + 1] || null;
      index += 1;
      continue;
    }

    if (value === '--mode') {
      options.mode = rest[index + 1] || 'set';
      index += 1;
      continue;
    }

    if (value === '--max-snapshots') {
      options.maxSnapshots = rest[index + 1] || null;
      index += 1;
      continue;
    }

    if (value === '--max-age-days') {
      options.maxAgeDays = rest[index + 1] || null;
      index += 1;
      continue;
    }

    if (value === '--force') {
      options.force = true;
      continue;
    }

    if (value === '--interval-ms') {
      options.intervalMs = rest[index + 1] || null;
      index += 1;
      continue;
    }

    if (value === '--health-timeout-ms') {
      options.healthTimeoutMs = rest[index + 1] || null;
      index += 1;
      continue;
    }

    if (value === '--max-restarts-per-run') {
      options.maxRestartsPerRun = rest[index + 1] || null;
      index += 1;
      continue;
    }

    if (value === '--restart-cooldown-ms') {
      options.restartCooldownMs = rest[index + 1] || null;
      index += 1;
      continue;
    }

    if (value === '--enabled') {
      options.enabled = true;
      continue;
    }

    if (value === '--disabled') {
      options.enabled = false;
      continue;
    }

    if (value === '--cleanup-expired-sessions') {
      options.cleanupExpiredSessions = true;
      continue;
    }

    if (value === '--no-cleanup-expired-sessions') {
      options.cleanupExpiredSessions = false;
      continue;
    }

    if (value === '--retention-cleanup-enabled') {
      options.retentionCleanupEnabled = true;
      continue;
    }

    if (value === '--retention-cleanup-disabled') {
      options.retentionCleanupEnabled = false;
      continue;
    }

    if (value === '--retention-cleanup-every-runs') {
      options.retentionCleanupEveryRuns = rest[index + 1] || null;
      index += 1;
      continue;
    }

    if (value === '--history-max-entries') {
      options.historyMaxEntries = rest[index + 1] || null;
      index += 1;
      continue;
    }

    if (value === '--bucket') {
      options.bucket = rest[index + 1] || 'day';
      index += 1;
      continue;
    }

    if (value === '--trigger') {
      options.trigger = rest[index + 1] || null;
      index += 1;
      continue;
    }

    if (value === '--start-at') {
      options.startAt = rest[index + 1] || null;
      index += 1;
      continue;
    }

    if (value === '--end-at') {
      options.endAt = rest[index + 1] || null;
      index += 1;
      continue;
    }

    if (value === '--provider') {
      options.provider = rest[index + 1] || null;
      index += 1;
      continue;
    }

    if (value === '--alias') {
      options.alias = rest[index + 1] || null;
      index += 1;
      continue;
    }

    if (value === '--description') {
      options.description = rest[index + 1] || null;
      index += 1;
      continue;
    }

    if (value === '--unlock-secret') {
      options.unlockSecret = rest[index + 1] || null;
      index += 1;
      continue;
    }

    if (value === '--secret-payload') {
      options.secretPayload = rest[index + 1] || null;
      index += 1;
      continue;
    }

    if (value === '--profile-id') {
      options.profileId = rest[index + 1] || null;
      index += 1;
      continue;
    }

    if (value === '--binding-role') {
      options.bindingRole = rest[index + 1] || null;
      index += 1;
      continue;
    }

    if (value === '--capability') {
      options.capability = rest[index + 1] || null;
      index += 1;
      continue;
    }

    if (value === '--env-target') {
      options.envTarget = rest[index + 1] || null;
      index += 1;
      continue;
    }

    if (value === '--projection-mode') {
      options.projectionMode = rest[index + 1] || null;
      index += 1;
      continue;
    }

    if (value === '--allowed-actions') {
      options.allowedActions = String(rest[index + 1] || '').split(',').map(item => item.trim()).filter(Boolean);
      index += 1;
      continue;
    }

    if (value === '--required-capabilities') {
      options.requiredCapabilities = String(rest[index + 1] || '').split(',').map(item => item.trim()).filter(Boolean);
      index += 1;
      continue;
    }

    if (value === '--include-values') {
      options.includeValues = true;
      continue;
    }

    if (!options.id) {
      options.id = value;
      continue;
    }

    if (!options.snapshotId) {
      options.snapshotId = value;
    }
  }

  return options;
}

function printJson(payload) {
  console.log(JSON.stringify(payload, null, 2));
}

async function main() {
  const config = getStackConfig();
  ensureRuntimeState(config, process.env);

  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'ensure-default') {
    const { workspace } = ensureDefaultWorkspace(config);
    printJson({ ok: true, action: 'ensure-default', workspace });
    return;
  }

  if (args.command === 'provider-catalog') {
    printJson({ ok: true, action: 'provider-catalog', catalog: getProviderCatalog(), roleCatalog: getBindingRoleCatalog() });
    return;
  }

  if (args.command === 'provider-list') {
    printJson({ ok: true, action: 'provider-list', tenantId: args.tenantId || 'local', ...listProviderProfiles(config, { tenantId: args.tenantId || 'local', provider: args.provider || '' }) });
    return;
  }

  if (args.command === 'provider-save') {
    if (!args.provider) throw new Error('Use --provider <neon|cloudflare|netlify|github|env_bundle> for provider-save.');
    if (!args.unlockSecret) throw new Error('Use --unlock-secret <secret> for provider-save.');
    const secretPayload = JSON.parse(String(args.secretPayload || '{}'));
    const result = saveProviderProfile(config, {
      profileId: args.profileId || null,
      tenantId: args.tenantId || 'local',
      provider: args.provider,
      alias: args.alias || `${args.provider}-profile`,
      description: args.description || null,
      unlockSecret: args.unlockSecret,
      secretPayload,
      actorType: 'workspace-cli',
      actorId: 'workspace-cli-provider-save',
      workspaceId: args.id || null,
      source: 'workspace-cli'
    });
    printJson({ ok: true, action: 'provider-save', ...result });
    return;
  }

  if (args.command === 'provider-delete') {
    if (!args.profileId) throw new Error('Use --profile-id <id> for provider-delete.');
    const result = deleteProviderProfile(config, {
      profileId: args.profileId,
      tenantId: args.tenantId || 'local',
      actorType: 'workspace-cli',
      actorId: 'workspace-cli-provider-delete',
      workspaceId: args.id || null
    });
    printJson({ ok: true, action: 'provider-delete', ...result });
    return;
  }

  if (args.command === 'provider-bindings') {
    if (!args.id) throw new Error('Workspace id is required for provider-bindings.');
    printJson({ ok: true, action: 'provider-bindings', workspaceId: args.id, ...listWorkspaceProviderBindings(config, { workspaceId: args.id, tenantId: args.tenantId || 'local' }) });
    return;
  }

  if (args.command === 'provider-bind') {
    if (!args.id) throw new Error('Workspace id is required for provider-bind.');
    if (!args.profileId) throw new Error('Use --profile-id <id> for provider-bind.');
    const result = upsertWorkspaceProviderBinding(config, {
      workspaceId: args.id,
      tenantId: args.tenantId || 'local',
      profileId: args.profileId,
      bindingRole: args.bindingRole,
      capability: args.capability,
      envTarget: args.envTarget,
      projectionMode: args.projectionMode,
      allowedActions: args.allowedActions,
      requiredCapabilities: args.requiredCapabilities,
      actorType: 'workspace-cli',
      actorId: 'workspace-cli-provider-bind',
      createdBy: 'workspace-cli'
    });
    printJson({ ok: true, action: 'provider-bind', ...result });
    return;
  }

  if (args.command === 'provider-unbind') {
    if (!args.id) throw new Error('Workspace id is required for provider-unbind.');
    if (!args.profileId) throw new Error('Use --profile-id <binding-id> for provider-unbind.');
    const result = deleteWorkspaceProviderBinding(config, {
      workspaceId: args.id,
      bindingId: args.profileId,
      tenantId: args.tenantId || 'local',
      actorType: 'workspace-cli',
      actorId: 'workspace-cli-provider-unbind'
    });
    printJson({ ok: true, action: 'provider-unbind', ...result });
    return;
  }

  if (args.command === 'provider-plan') {
    if (!args.id) throw new Error('Workspace id is required for provider-plan.');
    const result = resolveWorkspaceProviderProjection(config, {
      workspaceId: args.id,
      tenantId: args.tenantId || 'local',
      unlockSecret: args.unlockSecret || null,
      profileId: args.profileId || null,
      bindingRole: args.bindingRole || null,
      capability: args.capability || null,
      action: args.reason || 'provider_runtime_execution',
      includeValues: Boolean(args.includeValues),
      actorType: 'workspace-cli',
      actorId: 'workspace-cli-provider-plan'
    });
    printJson({ ok: result.ok, action: 'provider-plan', ...result });
    return;
  }

  if (args.command === 'provider-discover') {
    if (!args.profileId) throw new Error('Use --profile-id <id> for provider-discover.');
    if (!args.unlockSecret) throw new Error('Use --unlock-secret <secret> for provider-discover.');
    const profile = getProviderProfile(config, args.profileId, { tenantId: args.tenantId || 'local' });
    if (!profile) throw new Error(`Provider profile '${args.profileId}' was not found.`);
    const decrypted = decryptProviderProfile(config, { profileId: profile.profileId, tenantId: profile.tenantId, unlockSecret: args.unlockSecret });
    const result = await discoverProviderResources(profile, decrypted.payload, { workspaceId: args.id || null, tenantId: profile.tenantId, action: args.reason || 'provider_discovery' });
    printJson({ ok: result.ok, action: 'provider-discover', profile, result, suggestions: buildProviderBindingSuggestions(profile, { payload: decrypted.payload }) });
    return;
  }

  if (args.command === 'provider-bootstrap') {
    if (!args.id) throw new Error('Workspace id is required for provider-bootstrap.');
    if (!args.profileId) throw new Error('Use --profile-id <id> for provider-bootstrap.');
    const profile = getProviderProfile(config, args.profileId, { tenantId: args.tenantId || 'local' });
    if (!profile) throw new Error(`Provider profile '${args.profileId}' was not found.`);
    let suggestions = buildProviderBindingSuggestions(profile);
    if (args.unlockSecret) {
      const decrypted = decryptProviderProfile(config, { profileId: profile.profileId, tenantId: profile.tenantId, unlockSecret: args.unlockSecret });
      suggestions = buildProviderBindingSuggestions(profile, { payload: decrypted.payload });
    }
    const result = bootstrapWorkspaceProviderBindings(config, {
      workspaceId: args.id,
      tenantId: profile.tenantId,
      profileId: profile.profileId,
      suggestions,
      notes: args.description || 'Auto-bootstrap from workspace CLI.',
      actorType: 'workspace-cli',
      actorId: 'workspace-cli-provider-bootstrap',
      createdBy: 'workspace-cli-provider-bootstrap'
    });
    printJson({ ok: true, action: 'provider-bootstrap', ...result });
    return;
  }

  if (args.command === 'founder-lanes') {
    printJson({
      ok: true,
      action: 'founder-lanes',
      founderLane: getFounderLaneDeclaration(config, {
        tenantId: args.tenantId || 'local',
        workspaceId: args.id || null,
        action: args.reason || 'provider_runtime_execution'
      })
    });
    return;
  }

  if (args.command === 'governance-secret-migration:candidates') {
    printJson({
      ok: true,
      action: 'governance-secret-migration:candidates',
      tenantId: args.tenantId || 'local',
      ...listGovernanceSecretMigrationCandidates(config, { tenantId: args.tenantId || 'local', includeValues: Boolean(args.includeValues) })
    });
    return;
  }

  if (args.command === 'governance-secret-migration:mark-founder') {
    if (!args.scope) throw new Error('Use --scope <scope> for governance-secret-migration:mark-founder.');
    printJson(markGovernanceSecretsFounderManaged(config, {
      tenantId: args.tenantId || 'local',
      scope: args.scope,
      workspaceId: args.id || null,
      actorType: 'workspace-cli',
      actorId: 'workspace-cli-governance-secret-mark-founder'
    }));
    return;
  }

  if (args.command === 'governance-secret-migration:migrate') {
    if (!args.scope) throw new Error('Use --scope <scope> for governance-secret-migration:migrate.');
    if (!args.unlockSecret) throw new Error('Use --unlock-secret <secret> for governance-secret-migration:migrate.');
    printJson(migrateGovernanceSecretScopeToProviderProfile(config, {
      tenantId: args.tenantId || 'local',
      scope: args.scope,
      provider: args.provider || null,
      alias: args.alias || null,
      description: args.description || null,
      unlockSecret: args.unlockSecret,
      stripSourceValues: true,
      workspaceId: args.id || null,
      actorType: 'workspace-cli',
      actorId: 'workspace-cli-governance-secret-migrate'
    }));
    return;
  }

if (args.command === 'create' || args.command === 'create-from-git' || args.command === 'create-from-template' || args.command === 'onboard') {
  if (!args.id) {
    throw new Error('Workspace id is required for create/onboard.');
  }
  if (args.command === 'create-from-git' || (args.command === 'onboard' && args.repoUrl)) {
    if (!args.repoUrl) throw new Error('Use --repo <url> for create-from-git/onboard.');
  }
  if (args.command === 'create-from-template' || (args.command === 'onboard' && args.templatePath)) {
    if (!args.templatePath) throw new Error('Use --template-path <path> for create-from-template/onboard.');
  }
  const sourceCommand = args.command === 'onboard'
    ? (args.repoUrl ? 'create-from-git' : args.templatePath ? 'create-from-template' : 'create')
    : args.command;

  const result = createWorkspace(config, args.id, {
    name: args.name || args.id,
    source: args.command,
    repoUrl: args.repoUrl,
    templatePath: args.templatePath,
    branch: args.branch,
    machineProfile: args.machineProfile,
    secretScope: args.secretScope,
    force: args.force
  });

  let prebuild = null;
  if (args.prebuildTemplate) {
    const preference = setWorkspacePrebuildPreference(config, {
      workspaceId: args.id,
      templateId: args.prebuildTemplate,
      mode: args.prebuildMode || 'prebuild',
      hydrationPolicy: args.hydrationPolicy || (args.hydratePrebuild ? 'hydrate_on_create' : 'manual'),
      actorId: 'workspace-cli-onboard',
      source: 'workspace-cli-onboard'
    });
    const job = queuePrebuildJob(config, {
      workspaceId: args.id,
      templateId: args.prebuildTemplate,
      mode: args.prebuildMode || preference.preference.mode || 'prebuild',
      actorId: 'workspace-cli-onboard',
      source: 'workspace-cli-onboard'
    });
    const hydration = args.hydratePrebuild
      ? hydrateWorkspacePrebuild(config, {
          workspaceId: args.id,
          templateId: args.prebuildTemplate,
          actorId: 'workspace-cli-onboard',
          source: 'workspace-cli-onboard'
        })
      : null;
    prebuild = { preference, job, hydration, status: getPrebuildStatus(config, args.id).summary };
  }

  let started = null;
  let runtime = null;
  if (args.startAfterCreate || args.command === 'onboard') {
    started = await startWorkspace(config, args.id, args.command === 'onboard' ? 'cli_onboard_start' : 'cli_start_after_create');
    runtime = getWorkspaceRuntime(config, args.id);
  }

  const workspacePayload = started ? started.workspace : result.workspace;
  printJson({
    ok: true,
    action: args.command,
    sourceCommand,
    created: result.created,
    workspace: workspacePayload,
    seed: result.seed || null,
    started: Boolean(started),
    runtime,
    prebuild,
    nextActions: {
      select: `npm run workspace -- select ${args.id}`,
      runtime: `npm run workspace -- runtime ${args.id}`,
      ports: `npm run workspace -- ports ${args.id}`,
      aiPatchList: `npm run ai-patch:list -- --workspace ${args.id}`
    }
  });
  return;
}

  if (args.command === 'current') {
    const defaultState = ensureDefaultWorkspace(config);
    printJson({ ok: true, action: 'current', workspace: defaultState.workspace });
    return;
  }

  if (args.command === 'describe') {
    const workspace = getWorkspace(config, args.id);
    if (!workspace) {
      printJson({ ok: false, error: 'workspace_not_found', workspaceId: args.id || null });
      process.exitCode = 1;
      return;
    }

    printJson({ ok: true, action: 'describe', workspace });
    return;
  }

  if (args.command === 'select') {
    if (!args.id) {
      throw new Error('Workspace id is required for select.');
    }
    const result = selectWorkspace(config, args.id);
    printJson({ ok: true, action: 'select', workspace: result.workspace });
    return;
  }

  if (args.command === 'resume') {
    const targetWorkspaceId = args.id || ensureDefaultWorkspace(config).workspace.id;
    const selected = selectWorkspace(config, targetWorkspaceId);
    const result = await startWorkspace(config, targetWorkspaceId, 'cli_resume');
    printJson({ ok: true, action: 'resume', selected: selected.workspace, workspace: result.workspace });
    return;
  }

  if (args.command === 'start') {
    if (!args.id) {
      throw new Error('Workspace id is required for start.');
    }
    const result = await startWorkspace(config, args.id, args.reason || 'cli_start');
    printJson({ ok: true, action: 'start', workspace: result.workspace });
    return;
  }

  if (args.command === 'stop') {
    if (!args.id) {
      throw new Error('Workspace id is required for stop.');
    }
    const result = await stopWorkspace(config, args.id, args.reason || 'cli_stop');
    printJson({ ok: true, action: 'stop', workspace: result.workspace });
    return;
  }

  if (args.command === 'delete') {
    if (!args.id) {
      throw new Error('Workspace id is required for delete.');
    }
    const result = await deleteWorkspace(config, args.id, {
      deletedBy: 'workspace-cli',
      force: args.force
    });
    printJson({ ok: true, action: 'delete', ...result });
    return;
  }

  if (args.command === 'runtime') {
    if (!args.id) {
      throw new Error('Workspace id is required for runtime.');
    }
    const result = getWorkspaceRuntime(config, args.id);
    printJson({
      ok: true,
      action: 'runtime',
      workspace: result.workspace,
      runtime: result.runtime,
      state: result.state
    });
    return;
  }

  if (args.command === 'status') {
    if (!args.id) {
      throw new Error('Workspace id is required for status.');
    }
    if (!args.status) {
      throw new Error('Use --status <ready|running|stopped|error> for status updates.');
    }
    const result = updateWorkspaceStatus(config, args.id, args.status, args.reason || 'cli_status_update');
    printJson({ ok: true, action: 'status', workspace: result.workspace });
    return;
  }

  if (args.command === 'ports') {
    if (!args.id) {
      throw new Error('Workspace id is required for ports.');
    }
    const result = listWorkspacePorts(config, args.id);
    printJson({
      ok: true,
      action: 'ports',
      workspace: result.workspace,
      forwardedHost: result.forwardedHost,
      forwardedPorts: result.forwardedPorts
    });
    return;
  }

  if (args.command === 'ports:set') {
    if (!args.id) {
      throw new Error('Workspace id is required for ports:set.');
    }
    const result = setWorkspacePorts(config, args.id, args.ports, {
      forwardedHost: args.forwardedHost
    });
    printJson({ ok: true, action: 'ports:set', workspace: result.workspace });
    return;
  }

  if (args.command === 'ports:allow') {
    if (!args.id) {
      throw new Error('Workspace id is required for ports:allow.');
    }
    if (!args.ports.length) {
      throw new Error('Use --ports <port> for ports:allow.');
    }
    const result = allowWorkspacePort(config, args.id, args.ports[0], {
      forwardedHost: args.forwardedHost
    });
    printJson({ ok: true, action: 'ports:allow', workspace: result.workspace });
    return;
  }

  if (args.command === 'ports:deny') {
    if (!args.id) {
      throw new Error('Workspace id is required for ports:deny.');
    }
    if (!args.ports.length) {
      throw new Error('Use --ports <port> for ports:deny.');
    }
    const result = denyWorkspacePort(config, args.id, args.ports[0]);
    printJson({ ok: true, action: 'ports:deny', workspace: result.workspace });
    return;
  }

  if (args.command === 'snapshots') {
    if (!args.id) {
      throw new Error('Workspace id is required for snapshots.');
    }
    const result = listSnapshots(config, args.id);
    printJson({
      ok: true,
      action: 'snapshots',
      workspace: result.workspace,
      count: result.snapshots.length,
      snapshots: result.snapshots
    });
    return;
  }

  if (args.command === 'snapshot:create') {
    if (!args.id) {
      throw new Error('Workspace id is required for snapshot:create.');
    }
    const result = await createSnapshot(config, args.id, {
      label: args.label,
      restartAfter: args.restartAfter,
      createdBy: 'workspace-cli'
    });
    printJson({
      ok: true,
      action: 'snapshot:create',
      workspace: result.workspace,
      snapshot: result.snapshot
    });
    return;
  }

  if (args.command === 'snapshot:describe') {
    if (!args.id) {
      throw new Error('Workspace id is required for snapshot:describe.');
    }
    if (!args.snapshotId) {
      throw new Error('Snapshot id is required for snapshot:describe. Use --snapshot <id>.');
    }
    const result = describeSnapshot(config, args.id, args.snapshotId);
    printJson({
      ok: true,
      action: 'snapshot:describe',
      workspace: result.workspace,
      snapshot: result.snapshot
    });
    return;
  }

  if (args.command === 'snapshot:restore') {
    if (!args.id) {
      throw new Error('Workspace id is required for snapshot:restore.');
    }
    if (!args.snapshotId) {
      throw new Error('Snapshot id is required for snapshot:restore. Use --snapshot <id>.');
    }
    const result = await restoreSnapshot(config, args.id, args.snapshotId, {
      restartAfter: args.restartAfter,
      restoredBy: 'workspace-cli'
    });
    printJson({
      ok: true,
      action: 'snapshot:restore',
      workspace: result.workspace,
      snapshot: result.snapshot
    });
    return;
  }

  if (args.command === 'snapshot:delete') {
    if (!args.id) {
      throw new Error('Workspace id is required for snapshot:delete.');
    }
    if (!args.snapshotId) {
      throw new Error('Snapshot id is required for snapshot:delete. Use --snapshot <id>.');
    }
    const result = removeSnapshot(config, args.id, args.snapshotId);
    printJson({
      ok: true,
      action: 'snapshot:delete',
      ...result
    });
    return;
  }

  if (args.command === 'snapshot-retention') {
    const result = getSnapshotRetention(config, args.id || null);
    printJson({
      ok: true,
      action: 'snapshot-retention',
      ...result
    });
    return;
  }

  if (args.command === 'snapshot-retention:set') {
    const policy = setSnapshotRetention(config, {
      scope: args.scope || (args.id ? 'workspace' : args.tenantId ? 'tenant' : 'defaults'),
      mode: args.mode || 'set',
      workspaceId: args.id || null,
      tenantId: args.tenantId || null,
      maxSnapshots: args.maxSnapshots,
      maxAgeDays: args.maxAgeDays
    });
    printJson({
      ok: true,
      action: 'snapshot-retention:set',
      policy
    });
    return;
  }

  if (args.command === 'snapshot-retention:cleanup') {
    const result = runSnapshotRetentionCleanup(config, args.id || null, {
      actorId: 'workspace-cli-retention-cleanup',
      protectSnapshotId: args.snapshotId || null
    });
    printJson({
      ok: true,
      action: 'snapshot-retention:cleanup',
      ...result
    });
    return;
  }

  if (args.command === 'scheduler') {
    const snapshot = getWorkspaceSchedulerSnapshot(config);
    printJson({
      ok: true,
      action: 'scheduler',
      ...snapshot
    });
    return;
  }

  if (args.command === 'scheduler:card') {
    const card = getWorkspaceSchedulerTrendsCompact(config, {
      bucket: args.bucket,
      trigger: args.trigger,
      startAt: args.startAt,
      endAt: args.endAt
    });
    printJson({
      ok: true,
      action: 'scheduler:card',
      ...card
    });
    return;
  }

  if (args.command === 'scheduler:policy:set') {
    const scheduler = createWorkspaceSchedulerController(config);
    const result = scheduler.updatePolicy({
      enabled: args.enabled,
      intervalMs: args.intervalMs,
      healthTimeoutMs: args.healthTimeoutMs,
      maxRestartsPerRun: args.maxRestartsPerRun,
      restartCooldownMs: args.restartCooldownMs,
      cleanupExpiredSessions: args.cleanupExpiredSessions,
      retentionCleanupEnabled: args.retentionCleanupEnabled,
      retentionCleanupEveryRuns: args.retentionCleanupEveryRuns,
      historyMaxEntries: args.historyMaxEntries
    });
    printJson({
      ok: true,
      action: 'scheduler:policy:set',
      ...result
    });
    return;
  }

  if (args.command === 'scheduler:run') {
    const scheduler = createWorkspaceSchedulerController(config);
    const result = await scheduler.runNow({
      trigger: 'cli_manual',
      workspaceId: args.id || null
    });
    printJson({
      ok: true,
      action: 'scheduler:run',
      ...result
    });
    return;
  }

  if (args.command === 'list') {
    const state = listWorkspaces(config);
    printJson({ ok: true, action: 'list', ...state });
    return;
  }

  throw new Error(`Unknown workspace command: ${args.command}`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
