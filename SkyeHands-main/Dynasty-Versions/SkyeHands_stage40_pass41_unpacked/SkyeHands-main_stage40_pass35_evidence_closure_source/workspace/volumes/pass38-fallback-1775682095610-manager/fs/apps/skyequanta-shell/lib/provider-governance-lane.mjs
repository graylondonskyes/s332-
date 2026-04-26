import fs from 'node:fs';
import path from 'node:path';

import {
  appendAuditEvent,
  getGovernanceSecretsPath,
  listGovernanceSecrets
} from './governance-manager.mjs';
import { saveProviderProfile } from './provider-vault.mjs';
import { validateProviderPayload } from './provider-connectors.mjs';

function readString(value) {
  return String(value ?? '').trim();
}

function normalizeTenantId(value) {
  const normalized = readString(value).toLowerCase();
  return normalized || 'local';
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
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function getGovernanceSecretMigrationFilePath(config) {
  return path.join(config.rootDir, '.skyequanta', 'governance-secret-migration.json');
}

function getFounderLaneDeclarationFilePath(config) {
  return path.join(config.rootDir, '.skyequanta', 'founder-lane-declarations.json');
}

function writeMigrationSnapshot(config, payload) {
  const existing = readJson(getGovernanceSecretMigrationFilePath(config), { version: 1, migrations: [] });
  const migrations = Array.isArray(existing?.migrations) ? existing.migrations : [];
  migrations.push({ recordedAt: new Date().toISOString(), ...payload });
  writeJson(getGovernanceSecretMigrationFilePath(config), { version: 1, migrations: migrations.slice(-100) });
}

function writeFounderLaneSnapshot(config, payload) {
  const existing = readJson(getFounderLaneDeclarationFilePath(config), { version: 1, declarations: [] });
  const declarations = Array.isArray(existing?.declarations) ? existing.declarations : [];
  declarations.push({ recordedAt: new Date().toISOString(), ...payload });
  writeJson(getFounderLaneDeclarationFilePath(config), { version: 1, declarations: declarations.slice(-100) });
}

const KNOWN_PROVIDERS = new Set(['neon', 'cloudflare', 'netlify', 'github', 'env_bundle']);

function normalizeScopeSegment(segment) {
  return readString(segment).toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '');
}

export function inferProviderFromSecret(secret = {}) {
  const scope = readString(secret.scope).toLowerCase();
  const key = readString(secret.key).toLowerCase();
  for (const provider of KNOWN_PROVIDERS) {
    if (scope === provider || scope.startsWith(`${provider}:`) || scope.includes(`:${provider}:`) || scope.includes(provider)) {
      return provider;
    }
  }
  if (['databaseurl', 'database_url', 'postgres_url', 'projectid', 'project_id', 'databasename', 'database_name'].includes(key)) return 'neon';
  if (['apitoken', 'api_token', 'accountid', 'account_id', 'zoneid', 'zone_id', 'workername', 'worker_name', 'r2bucket', 'r2_bucket'].includes(key)) return 'cloudflare';
  if (['authtoken', 'auth_token', 'siteid', 'site_id', 'teamslug', 'team_slug', 'sitename', 'site_name'].includes(key)) return 'netlify';
  if (['token', 'owner', 'repo', 'branch', 'installationid', 'installation_id'].includes(key) && scope.includes('github')) return 'github';
  if (key === 'env' || key.startsWith('env.') || key.startsWith('env_')) return 'env_bundle';
  return null;
}

export function inferGovernanceCandidateAlias(scope, provider) {
  const parts = readString(scope).split(':').map(normalizeScopeSegment).filter(Boolean);
  const providerName = normalizeScopeSegment(provider);
  const filtered = parts.filter(part => part !== 'provider' && part !== 'legacy' && part !== 'founder' && part !== providerName);
  return filtered[filtered.length - 1] || providerName || 'legacy-provider';
}

function normalizeSecretKeyToPayloadKey(provider, key) {
  const normalized = readString(key).trim();
  const lower = normalized.toLowerCase();
  const maps = {
    neon: {
      databaseurl: 'databaseUrl',
      database_url: 'databaseUrl',
      postgres_url: 'databaseUrl',
      projectid: 'projectId',
      project_id: 'projectId',
      databasename: 'databaseName',
      database_name: 'databaseName'
    },
    cloudflare: {
      apitoken: 'apiToken',
      api_token: 'apiToken',
      accountid: 'accountId',
      account_id: 'accountId',
      zoneid: 'zoneId',
      zone_id: 'zoneId',
      workername: 'workerName',
      worker_name: 'workerName',
      r2bucket: 'r2Bucket',
      r2_bucket: 'r2Bucket'
    },
    netlify: {
      authtoken: 'authToken',
      auth_token: 'authToken',
      siteid: 'siteId',
      site_id: 'siteId',
      teamslug: 'teamSlug',
      team_slug: 'teamSlug',
      sitename: 'siteName',
      site_name: 'siteName'
    },
    github: {
      token: 'token',
      owner: 'owner',
      repo: 'repo',
      branch: 'branch',
      installationid: 'installationId',
      installation_id: 'installationId'
    }
  };
  return maps[provider]?.[lower] || normalized;
}

export function buildProviderPayloadFromGovernanceSecrets(provider, secrets = []) {
  const kind = readString(provider).toLowerCase();
  if (kind === 'env_bundle') {
    const env = {};
    for (const secret of secrets) {
      const key = readString(secret.key);
      const value = readString(secret.value);
      if (!key || !value) continue;
      if (key.toLowerCase() === 'env') {
        try {
          const parsed = JSON.parse(value);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            for (const [envKey, envValue] of Object.entries(parsed)) {
              const normalizedKey = readString(envKey).toUpperCase();
              if (normalizedKey) env[normalizedKey] = readString(envValue);
            }
            continue;
          }
        } catch {}
      }
      const envKey = key.replace(/^env[._-]?/i, '').trim() || key;
      env[envKey.toUpperCase()] = value;
    }
    return { env };
  }

  const payload = {};
  for (const secret of secrets) {
    const payloadKey = normalizeSecretKeyToPayloadKey(kind, secret.key);
    if (!payloadKey) continue;
    payload[payloadKey] = readString(secret.value);
  }
  return payload;
}

function loadSecretsStore(config) {
  const filePath = getGovernanceSecretsPath(config);
  const parsed = readJson(filePath, { version: 1, secrets: [] });
  return {
    filePath,
    version: 1,
    secrets: Array.isArray(parsed?.secrets) ? parsed.secrets.map(secret => ({
      ...secret,
      id: readString(secret.id),
      tenantId: normalizeTenantId(secret.tenantId),
      scope: readString(secret.scope),
      key: readString(secret.key),
      value: readString(secret.value),
      description: readString(secret.description) || null,
      credentialLane: readString(secret.credentialLane || 'founder-only') || 'founder-only',
      founderManaged: secret.founderManaged !== false,
      migrationStatus: readString(secret.migrationStatus || 'legacy_founder_managed') || 'legacy_founder_managed',
      migrationTargetProfileId: readString(secret.migrationTargetProfileId) || null,
      migrationArchivedAt: readString(secret.migrationArchivedAt) || null,
      migrationSourceRetained: secret.migrationSourceRetained !== false,
      createdAt: readString(secret.createdAt),
      updatedAt: readString(secret.updatedAt),
      lastAccessedAt: readString(secret.lastAccessedAt) || null,
      source: readString(secret.source || 'secret-broker') || 'secret-broker'
    })) : []
  };
}

function saveSecretsStore(config, store) {
  writeJson(getGovernanceSecretsPath(config), {
    version: 1,
    secrets: Array.isArray(store?.secrets) ? store.secrets : []
  });
}

export function listGovernanceSecretMigrationCandidates(config, options = {}) {
  const tenantId = options.tenantId ? normalizeTenantId(options.tenantId) : null;
  const listed = listGovernanceSecrets(config, { tenantId, includeValue: Boolean(options.includeValues) }).secrets || [];
  const grouped = new Map();
  for (const secret of listed) {
    const provider = inferProviderFromSecret(secret);
    if (!provider) continue;
    const candidateKey = `${secret.tenantId}::${secret.scope}::${provider}`;
    const existing = grouped.get(candidateKey) || {
      candidateId: candidateKey,
      tenantId: secret.tenantId,
      scope: secret.scope,
      provider,
      alias: inferGovernanceCandidateAlias(secret.scope, provider),
      credentialLane: 'founder-only',
      founderManaged: true,
      migrationStatus: secret.migrationStatus || 'legacy_founder_managed',
      migrationTargetProfileId: secret.migrationTargetProfileId || null,
      keys: [],
      secretCount: 0,
      secrets: []
    };
    existing.keys.push(secret.key);
    existing.secretCount += 1;
    existing.founderManaged = existing.founderManaged && secret.founderManaged !== false;
    existing.migrationStatus = secret.migrationStatus === 'migrated_to_provider_vault' ? 'migrated_to_provider_vault' : existing.migrationStatus;
    existing.migrationTargetProfileId = existing.migrationTargetProfileId || secret.migrationTargetProfileId || null;
    existing.secrets.push(secret);
    grouped.set(candidateKey, existing);
  }

  const candidates = [...grouped.values()].map(candidate => {
    const payload = options.includeValues ? buildProviderPayloadFromGovernanceSecrets(candidate.provider, candidate.secrets) : null;
    const validation = payload ? validateProviderPayload(candidate.provider, payload) : { ok: null, errors: [] };
    return {
      candidateId: candidate.candidateId,
      tenantId: candidate.tenantId,
      scope: candidate.scope,
      provider: candidate.provider,
      alias: candidate.alias,
      credentialLane: candidate.credentialLane,
      founderManaged: candidate.founderManaged,
      migrationStatus: candidate.migrationStatus,
      migrationTargetProfileId: candidate.migrationTargetProfileId,
      secretCount: candidate.secretCount,
      keys: [...new Set(candidate.keys)].sort(),
      validation,
      payloadPreview: options.includeValues ? payload : null
    };
  }).sort((a, b) => a.scope.localeCompare(b.scope) || a.provider.localeCompare(b.provider));

  const result = {
    total: candidates.length,
    candidates
  };
  writeMigrationSnapshot(config, { action: 'inspect_candidates', tenantId: tenantId || 'all', total: result.total, candidates: result.candidates.map(candidate => ({
    scope: candidate.scope,
    provider: candidate.provider,
    alias: candidate.alias,
    migrationStatus: candidate.migrationStatus,
    migrationTargetProfileId: candidate.migrationTargetProfileId,
    secretCount: candidate.secretCount,
    keys: candidate.keys
  })) });
  return result;
}

export function markGovernanceSecretsFounderManaged(config, options = {}) {
  const tenantId = normalizeTenantId(options.tenantId);
  const scope = readString(options.scope);
  if (!scope) {
    throw new Error('scope is required to mark governance secrets as founder-managed.');
  }
  const store = loadSecretsStore(config);
  let updatedCount = 0;
  store.secrets = store.secrets.map(secret => {
    if (secret.tenantId !== tenantId || secret.scope !== scope) {
      return secret;
    }
    updatedCount += 1;
    return {
      ...secret,
      credentialLane: 'founder-only',
      founderManaged: true,
      migrationStatus: secret.migrationStatus === 'migrated_to_provider_vault' ? secret.migrationStatus : 'legacy_founder_managed',
      updatedAt: new Date().toISOString()
    };
  });
  saveSecretsStore(config, store);
  writeMigrationSnapshot(config, { action: 'mark_founder_lane', tenantId, scope, updatedCount, credentialLane: 'founder-only' });
  appendAuditEvent(config, {
    action: 'governance.secret.founder_lane.mark',
    actorType: readString(options.actorType || 'operator') || 'operator',
    actorId: readString(options.actorId || 'provider-governance-lane') || 'provider-governance-lane',
    tenantId,
    workspaceId: readString(options.workspaceId) || null,
    detail: {
      scope,
      updatedCount,
      credentialLane: 'founder-only'
    }
  });
  return {
    ok: true,
    tenantId,
    scope,
    updatedCount,
    credentialLane: 'founder-only'
  };
}

export function migrateGovernanceSecretScopeToProviderProfile(config, options = {}) {
  const tenantId = normalizeTenantId(options.tenantId);
  const scope = readString(options.scope);
  const unlockSecret = readString(options.unlockSecret);
  if (!scope) {
    throw new Error('scope is required for governance secret migration.');
  }
  if (!unlockSecret) {
    throw new Error('unlockSecret is required for governance secret migration.');
  }

  const candidate = listGovernanceSecretMigrationCandidates(config, { tenantId, includeValues: true }).candidates.find(item => item.scope === scope);
  if (!candidate) {
    throw new Error(`No governance-secret migration candidate was found for scope '${scope}'.`);
  }
  const provider = readString(options.provider || candidate.provider).toLowerCase() || candidate.provider;
  const alias = readString(options.alias || candidate.alias) || candidate.alias;
  const payload = candidate.payloadPreview || buildProviderPayloadFromGovernanceSecrets(provider, []);
  const validation = validateProviderPayload(provider, payload);
  if (!validation.ok) {
    throw new Error(`Governance secret migration payload validation failed: ${validation.errors.join(' ')}`.trim());
  }

  const saved = saveProviderProfile(config, {
    tenantId,
    provider,
    alias,
    description: readString(options.description || `Migrated from governance scope ${scope}`) || `Migrated from governance scope ${scope}`,
    unlockSecret,
    secretPayload: payload,
    scopesSummary: [scope, 'migrated-governance-secret'],
    actorType: readString(options.actorType || 'operator') || 'operator',
    actorId: readString(options.actorId || 'provider-governance-lane') || 'provider-governance-lane',
    workspaceId: readString(options.workspaceId) || null,
    source: 'governance-secret-migration'
  });

  const stripSourceValues = options.stripSourceValues !== false;
  const now = new Date().toISOString();
  const store = loadSecretsStore(config);
  let updatedCount = 0;
  store.secrets = store.secrets.map(secret => {
    if (secret.tenantId !== tenantId || secret.scope !== scope) {
      return secret;
    }
    updatedCount += 1;
    return {
      ...secret,
      credentialLane: 'founder-only',
      founderManaged: true,
      migrationStatus: 'migrated_to_provider_vault',
      migrationTargetProfileId: saved.profile.profileId,
      migrationArchivedAt: stripSourceValues ? now : secret.migrationArchivedAt || null,
      migrationSourceRetained: !stripSourceValues,
      value: stripSourceValues ? '[MIGRATED_TO_PROVIDER_VAULT]' : secret.value,
      updatedAt: now
    };
  });
  saveSecretsStore(config, store);

  writeMigrationSnapshot(config, { action: 'migrate_to_provider_vault', tenantId, scope, provider, alias, updatedCount, stripSourceValues, migrationTargetProfileId: saved.profile.profileId });
  appendAuditEvent(config, {
    action: 'governance.secret.migrate_to_provider_vault',
    actorType: readString(options.actorType || 'operator') || 'operator',
    actorId: readString(options.actorId || 'provider-governance-lane') || 'provider-governance-lane',
    tenantId,
    workspaceId: readString(options.workspaceId) || null,
    detail: {
      scope,
      provider,
      alias,
      updatedCount,
      stripSourceValues,
      migrationTargetProfileId: saved.profile.profileId
    }
  });

  return {
    ok: true,
    tenantId,
    scope,
    provider,
    alias,
    updatedCount,
    stripSourceValues,
    profile: saved.profile
  };
}

const ACTION_PROVIDER_PREFERENCES = {
  db_connect: ['neon', 'env_bundle'],
  object_storage: ['cloudflare', 'env_bundle'],
  worker_deploy: ['cloudflare', 'env_bundle'],
  site_deploy: ['netlify', 'env_bundle'],
  preview_deploy: ['netlify', 'cloudflare', 'env_bundle'],
  scm_sync: ['github', 'env_bundle'],
  provider_runtime_execution: ['env_bundle', 'neon', 'cloudflare', 'netlify', 'github']
};

export function getFounderLaneDeclaration(config, options = {}) {
  const tenantId = normalizeTenantId(options.tenantId);
  const action = readString(options.action || 'provider_runtime_execution').toLowerCase() || 'provider_runtime_execution';
  const preferredProviders = ACTION_PROVIDER_PREFERENCES[action] || [];
  const candidates = listGovernanceSecretMigrationCandidates(config, { tenantId }).candidates
    .filter(candidate => candidate.credentialLane === 'founder-only' && (!preferredProviders.length || preferredProviders.includes(candidate.provider)));
  const declaration = {
    declared: candidates.length > 0,
    available: candidates.length > 0,
    lane: 'founder-only-governance',
    tenantId,
    workspaceId: readString(options.workspaceId) || null,
    action,
    providerCandidates: candidates.map(candidate => ({
      scope: candidate.scope,
      provider: candidate.provider,
      alias: candidate.alias,
      migrationStatus: candidate.migrationStatus,
      migrationTargetProfileId: candidate.migrationTargetProfileId,
      keyCount: candidate.secretCount,
      keys: candidate.keys
    })),
    warning: candidates.length > 0
      ? 'Founder-only credentials are declared as a separate governance lane and are never mixed into user-owned runtime execution.'
      : 'No founder-only governance lane is declared for this action.'
  };
  writeFounderLaneSnapshot(config, declaration);
  return declaration;
}
