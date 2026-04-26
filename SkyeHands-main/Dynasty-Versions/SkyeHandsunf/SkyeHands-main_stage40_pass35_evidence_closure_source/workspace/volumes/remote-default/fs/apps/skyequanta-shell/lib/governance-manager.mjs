import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { redactProviderPayload } from './provider-redaction.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function readInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function readNonNegativeInteger(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function normalizeBoolean(value, fallback = true) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
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

function defaultPolicy(config) {
  const limits = config?.governance?.limits || {};
  return {
    version: 1,
    limits: {
      maxWorkspaces: readInteger(limits.maxWorkspaces, 16),
      maxSessions: readInteger(limits.maxSessions, 256),
      maxForwardedPortsPerWorkspace: readInteger(limits.maxForwardedPortsPerWorkspace, 16),
      maxSnapshotsPerWorkspace: readInteger(limits.maxSnapshotsPerWorkspace, 20),
      maxSnapshotBytes: readInteger(limits.maxSnapshotBytes, 5 * 1024 * 1024 * 1024),
      maxAuditEvents: readInteger(limits.maxAuditEvents, 2000)
    }
  };
}

function normalizeTenantId(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || 'local';
}

function normalizeCredentialLane(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || 'founder-only';
}

function inferGovernanceSecretProvider(scope = '', key = '') {
  const normalizedScope = String(scope || '').trim().toLowerCase();
  const normalizedKey = String(key || '').trim().toLowerCase();
  for (const provider of ['neon', 'cloudflare', 'netlify', 'github', 'env_bundle']) {
    if (normalizedScope === provider || normalizedScope.startsWith(`${provider}:`) || normalizedScope.includes(`:${provider}:`) || normalizedScope.includes(provider)) {
      return provider;
    }
  }
  if (['databaseurl', 'database_url', 'postgres_url', 'projectid', 'project_id', 'databasename', 'database_name'].includes(normalizedKey)) return 'neon';
  if (['apitoken', 'api_token', 'accountid', 'account_id', 'zoneid', 'zone_id', 'workername', 'worker_name', 'r2bucket', 'r2_bucket'].includes(normalizedKey)) return 'cloudflare';
  if (['authtoken', 'auth_token', 'siteid', 'site_id', 'teamslug', 'team_slug', 'sitename', 'site_name'].includes(normalizedKey)) return 'netlify';
  if (['token', 'owner', 'repo', 'branch', 'installationid', 'installation_id'].includes(normalizedKey) && normalizedScope.includes('github')) return 'github';
  if (normalizedKey === 'env' || normalizedKey.startsWith('env.') || normalizedKey.startsWith('env_')) return 'env_bundle';
  return null;
}

function inferGovernanceSecretAlias(scope = '', provider = '') {
  const parts = String(scope || '').trim().toLowerCase().split(':').map(item => item.replace(/[^a-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '')).filter(Boolean);
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  const filtered = parts.filter(item => item !== 'provider' && item !== 'legacy' && item !== 'founder' && item !== normalizedProvider);
  return filtered[filtered.length - 1] || normalizedProvider || 'legacy-provider';
}

function normalizeOffset(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function parseTimestampMs(value, fallback = null) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const parsed = Date.parse(String(value));
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid timestamp '${value}'. Expected ISO-8601 date/time.`);
  }

  return parsed;
}

function pruneAuditEvents(policy, events) {
  const maxEvents = readInteger(policy?.limits?.maxAuditEvents, 2000);
  if (events.length <= maxEvents) {
    return events;
  }

  return events.slice(events.length - maxEvents);
}

export function getGovernancePolicyPath(config) {
  return path.join(config.rootDir, '.skyequanta', 'governance-policy.json');
}

export function getAuditLogPath(config) {
  return path.join(config.rootDir, '.skyequanta', 'audit-log.json');
}

export function getAuditChainPath(config) {
  return path.join(config.rootDir, '.skyequanta', 'audit-chain.ndjson');
}

export function getAuditChainHeadPath(config) {
  return path.join(config.rootDir, '.skyequanta', 'audit-chain-head.json');
}

export function loadGovernancePolicy(config) {
  const policyPath = getGovernancePolicyPath(config);
  const parsed = readJson(policyPath, null);
  const defaults = defaultPolicy(config);
  if (!parsed || typeof parsed !== 'object') {
    return defaults;
  }

  return {
    version: 1,
    limits: {
      ...defaults.limits,
      ...(parsed.limits || {})
    }
  };
}

export function saveGovernancePolicy(config, policy) {
  const next = {
    version: 1,
    limits: {
      ...defaultPolicy(config).limits,
      ...(policy?.limits || {})
    }
  };

  writeJson(getGovernancePolicyPath(config), next);
  return next;
}

export function ensureGovernanceStores(config) {
  const policy = loadGovernancePolicy(config);
  saveGovernancePolicy(config, policy);
  if (!fs.existsSync(getAuditLogPath(config))) {
    writeJson(getAuditLogPath(config), {
      version: 1,
      events: []
    });
  }
  if (!fs.existsSync(getAuditChainPath(config))) {
    ensureDirectory(path.dirname(getAuditChainPath(config)));
    fs.writeFileSync(getAuditChainPath(config), '', 'utf8');
  }
  if (!fs.existsSync(getAuditChainHeadPath(config))) {
    saveAuditChainHead(config, {
      sequence: 0,
      latestHash: null,
      latestEventId: null,
      updatedAt: nowIso()
    });
  }
  if (!fs.existsSync(getTenantGovernancePolicyPath(config))) {
    writeJson(getTenantGovernancePolicyPath(config), { version: 1, policies: {} });
  }
  if (!fs.existsSync(getGovernanceSecretsPath(config))) {
    writeJson(getGovernanceSecretsPath(config), { version: 1, secrets: [] });
  }
  if (!fs.existsSync(getGovernanceCostLedgerPath(config))) {
    writeJson(getGovernanceCostLedgerPath(config), { version: 1, entries: [] });
  }
  if (!fs.existsSync(getGovernanceReleaseDecisionPath(config))) {
    writeJson(getGovernanceReleaseDecisionPath(config), { version: 1, decisions: [] });
  }

  return {
    policyPath: getGovernancePolicyPath(config),
    auditLogPath: getAuditLogPath(config),
    tenantPolicyPath: getTenantGovernancePolicyPath(config),
    secretsPath: getGovernanceSecretsPath(config),
    costLedgerPath: getGovernanceCostLedgerPath(config),
    releaseDecisionPath: getGovernanceReleaseDecisionPath(config)
  };
}

function loadAuditStore(config) {
  return readJson(getAuditLogPath(config), {
    version: 1,
    events: []
  });
}

function saveAuditStore(config, store) {
  writeJson(getAuditLogPath(config), {
    version: 1,
    events: Array.isArray(store?.events) ? store.events : []
  });
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(item => canonicalJson(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashAuditPayload(value) {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function loadAuditChainHead(config) {
  return readJson(getAuditChainHeadPath(config), {
    version: 1,
    sequence: 0,
    latestHash: null,
    latestEventId: null,
    updatedAt: null
  });
}

function saveAuditChainHead(config, payload) {
  writeJson(getAuditChainHeadPath(config), {
    version: 1,
    sequence: Number.parseInt(String(payload?.sequence || 0), 10) || 0,
    latestHash: payload?.latestHash || null,
    latestEventId: payload?.latestEventId || null,
    updatedAt: payload?.updatedAt || nowIso()
  });
}

function appendAuditChainEvent(config, event) {
  const head = loadAuditChainHead(config);
  const previousHash = head.latestHash || null;
  const sequence = (Number.parseInt(String(head.sequence || 0), 10) || 0) + 1;
  const entry = {
    sequence,
    previousHash,
    eventHash: hashAuditPayload({ previousHash, event }),
    sealedAt: nowIso(),
    event
  };
  ensureDirectory(path.dirname(getAuditChainPath(config)));
  fs.appendFileSync(getAuditChainPath(config), `${JSON.stringify(entry)}\n`, 'utf8');
  saveAuditChainHead(config, {
    sequence,
    latestHash: entry.eventHash,
    latestEventId: event.id,
    updatedAt: entry.sealedAt
  });
  return entry;
}

export function verifyAuditChain(config, options = {}) {
  const chainPath = getAuditChainPath(config);
  const lines = fs.existsSync(chainPath)
    ? fs.readFileSync(chainPath, 'utf8').split(/\r?\n/).filter(Boolean)
    : [];
  const failures = [];
  let previousHash = null;
  let previousSequence = 0;
  let latestHash = null;
  let latestEventId = null;
  let verified = 0;

  for (const [index, line] of lines.entries()) {
    let entry = null;
    try {
      entry = JSON.parse(line);
    } catch {
      failures.push({ line: index + 1, error: 'invalid_json' });
      continue;
    }
    const expectedSequence = previousSequence + 1;
    if ((entry?.sequence || 0) != expectedSequence) {
      failures.push({ line: index + 1, error: 'invalid_sequence', expectedSequence, actualSequence: entry?.sequence || 0 });
    }
    if ((entry?.previousHash || null) !== previousHash) {
      failures.push({ line: index + 1, error: 'previous_hash_mismatch', expectedPreviousHash: previousHash, actualPreviousHash: entry?.previousHash || null });
    }
    const expectedHash = hashAuditPayload({ previousHash: entry?.previousHash || null, event: entry?.event || null });
    if ((entry?.eventHash || '') !== expectedHash) {
      failures.push({ line: index + 1, error: 'event_hash_mismatch', expectedEventHash: expectedHash, actualEventHash: entry?.eventHash || null });
    }
    previousHash = entry?.eventHash || previousHash;
    previousSequence = Number.parseInt(String(entry?.sequence || 0), 10) || previousSequence;
    latestHash = entry?.eventHash || latestHash;
    latestEventId = entry?.event?.id || latestEventId;
    verified += 1;
  }

  const head = loadAuditChainHead(config);
  if ((head.latestHash || null) !== latestHash) {
    failures.push({ error: 'head_hash_mismatch', expectedLatestHash: latestHash, actualLatestHash: head.latestHash || null });
  }
  if ((Number.parseInt(String(head.sequence || 0), 10) || 0) != previousSequence) {
    failures.push({ error: 'head_sequence_mismatch', expectedSequence: previousSequence, actualSequence: Number.parseInt(String(head.sequence || 0), 10) || 0 });
  }
  return {
    ok: failures.length === 0,
    verifiedEntries: verified,
    latestHash,
    latestEventId,
    head,
    failures: failures.slice(0, Number.parseInt(String(options.limitFailures || 50), 10) || 50)
  };
}

export function appendAuditEvent(config, event) {
  const policy = loadGovernancePolicy(config);
  const store = loadAuditStore(config);
  const nextEvent = {
    id: crypto.randomUUID(),
    at: nowIso(),
    action: String(event?.action || 'unknown').trim(),
    outcome: String(event?.outcome || 'success').trim(),
    actorType: String(event?.actorType || 'system').trim(),
    actorId: String(event?.actorId || 'system').trim(),
    tenantId: normalizeTenantId(event?.tenantId),
    workspaceId: String(event?.workspaceId || '').trim() || null,
    sessionId: String(event?.sessionId || '').trim() || null,
    detail: redactProviderPayload(event?.detail || {})
  };

  const existing = Array.isArray(store.events) ? store.events : [];
  store.events = pruneAuditEvents(policy, [...existing, nextEvent]);
  saveAuditStore(config, store);
  appendAuditChainEvent(config, nextEvent);
  return nextEvent;
}

export function listAuditEvents(config, options = {}) {
  const limit = readInteger(options.limit, 100);
  const offset = normalizeOffset(options.offset);
  const workspaceId = String(options.workspaceId || '').trim();
  const tenantId = options.tenantId ? normalizeTenantId(options.tenantId) : '';
  const startAtMs = parseTimestampMs(options.startAt, null);
  const endAtMs = parseTimestampMs(options.endAt, null);
  if (startAtMs !== null && endAtMs !== null && startAtMs > endAtMs) {
    throw new Error('Invalid audit window: startAt must be less than or equal to endAt.');
  }

  const store = loadAuditStore(config);
  const filtered = (Array.isArray(store.events) ? store.events : [])
    .filter(event => {
      if (workspaceId && event.workspaceId !== workspaceId) {
        return false;
      }

      if (tenantId && event.tenantId !== tenantId) {
        return false;
      }

      const eventAtMs = Date.parse(String(event.at || ''));
      if (startAtMs !== null && Number.isFinite(eventAtMs) && eventAtMs < startAtMs) {
        return false;
      }

      if (endAtMs !== null && Number.isFinite(eventAtMs) && eventAtMs > endAtMs) {
        return false;
      }

      return true;
    })
    .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));

  const page = filtered.slice(offset, offset + limit);
  const nextOffset = offset + page.length;

  return {
    total: filtered.length,
    offset,
    limit,
    hasMore: nextOffset < filtered.length,
    nextOffset: nextOffset < filtered.length ? nextOffset : null,
    events: page
  };
}

export function assertWorkspaceCreateAllowed(config, workspaceCount) {
  const policy = loadGovernancePolicy(config);
  if (workspaceCount >= policy.limits.maxWorkspaces) {
    throw new Error(`Workspace limit reached (${policy.limits.maxWorkspaces}).`);
  }
}

export function assertSessionOpenAllowed(config, sessionCount) {
  const policy = loadGovernancePolicy(config);
  if (sessionCount >= policy.limits.maxSessions) {
    throw new Error(`Session limit reached (${policy.limits.maxSessions}).`);
  }
}

export function assertForwardedPortCountAllowed(config, portCount) {
  const policy = loadGovernancePolicy(config);
  if (portCount > policy.limits.maxForwardedPortsPerWorkspace) {
    throw new Error(`Forwarded port limit exceeded (${policy.limits.maxForwardedPortsPerWorkspace}).`);
  }
}

export function assertSnapshotQuotaAllowed(config, snapshotCount) {
  const policy = loadGovernancePolicy(config);
  if (snapshotCount >= policy.limits.maxSnapshotsPerWorkspace) {
    throw new Error(`Snapshot limit reached (${policy.limits.maxSnapshotsPerWorkspace}).`);
  }
}

export function assertSnapshotSizeAllowed(config, sizeBytes) {
  const policy = loadGovernancePolicy(config);
  if (sizeBytes > policy.limits.maxSnapshotBytes) {
    throw new Error(`Snapshot size exceeds limit (${policy.limits.maxSnapshotBytes} bytes).`);
  }
}

export function getGovernanceSummary(config, usage = {}) {
  const policy = loadGovernancePolicy(config);
  return {
    policy,
    usage: {
      workspaceCount: readInteger(usage.workspaceCount, 0),
      sessionCount: readInteger(usage.sessionCount, 0),
      snapshotCountByWorkspace: usage.snapshotCountByWorkspace || {}
    }
  };
}

export function summarizeTenantAccess(workspaces = [], sessions = []) {
  const map = new Map();

  function ensureTenant(tenantId) {
    const normalized = normalizeTenantId(tenantId);
    if (!map.has(normalized)) {
      map.set(normalized, {
        tenantId: normalized,
        workspaces: { total: 0, running: 0, ready: 0, stopped: 0, error: 0, ids: [] },
        sessions: { total: 0, workspaceIds: [] }
      });
    }

    return map.get(normalized);
  }

  for (const workspace of Array.isArray(workspaces) ? workspaces : []) {
    const tenant = ensureTenant(workspace?.metadata?.tenantId || workspace?.tenantId || 'local');
    tenant.workspaces.total += 1;
    const status = String(workspace?.status || 'ready').trim().toLowerCase();
    if (['running', 'ready', 'stopped', 'error'].includes(status)) {
      tenant.workspaces[status] += 1;
    }
    if (workspace?.id) {
      tenant.workspaces.ids.push(workspace.id);
    }
  }

  for (const session of Array.isArray(sessions) ? sessions : []) {
    const tenant = ensureTenant(session?.tenantId || 'local');
    tenant.sessions.total += 1;
    if (session?.workspaceId && !tenant.sessions.workspaceIds.includes(session.workspaceId)) {
      tenant.sessions.workspaceIds.push(session.workspaceId);
    }
  }

  return {
    totalTenants: map.size,
    tenants: Array.from(map.values()).sort((a, b) => a.tenantId.localeCompare(b.tenantId))
  };
}


export function getGovernancePolicyHistoryPath(config) {
  return path.join(config.rootDir, '.skyequanta', 'governance-policy-history.json');
}

function loadGovernancePolicyHistoryStore(config) {
  return readJson(getGovernancePolicyHistoryPath(config), {
    version: 1,
    revisions: []
  });
}

function saveGovernancePolicyHistoryStore(config, store) {
  writeJson(getGovernancePolicyHistoryPath(config), {
    version: 1,
    revisions: Array.isArray(store?.revisions) ? store.revisions : []
  });
}

function normalizeGovernancePolicySnapshot(policy, fallbackPolicy) {
  const base = fallbackPolicy || defaultPolicy({ governance: { limits: {} } });
  return {
    version: 1,
    limits: {
      ...base.limits,
      ...(policy?.limits || {})
    }
  };
}

function normalizeGovernanceRevision(entry, fallbackPolicy) {
  const fallback = normalizeGovernancePolicySnapshot(fallbackPolicy, fallbackPolicy);
  return {
    id: String(entry?.id || crypto.randomUUID()).trim(),
    at: String(entry?.at || nowIso()).trim() || nowIso(),
    action: String(entry?.action || 'policy_update').trim() || 'policy_update',
    actorType: String(entry?.actorType || 'system').trim() || 'system',
    actorId: String(entry?.actorId || 'system').trim() || 'system',
    reason: String(entry?.reason || '').trim() || null,
    policy: normalizeGovernancePolicySnapshot(entry?.policy, fallback),
    previousPolicy: entry?.previousPolicy ? normalizeGovernancePolicySnapshot(entry.previousPolicy, fallback) : null
  };
}

export function listGovernancePolicyHistory(config, options = {}) {
  const limit = readInteger(options.limit, 50);
  const offset = normalizeOffset(options.offset);
  const store = loadGovernancePolicyHistoryStore(config);
  const currentPolicy = loadGovernancePolicy(config);
  const revisions = (Array.isArray(store.revisions) ? store.revisions : [])
    .map(entry => normalizeGovernanceRevision(entry, currentPolicy))
    .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));

  const page = revisions.slice(offset, offset + limit);
  const nextOffset = offset + page.length;

  return {
    total: revisions.length,
    offset,
    limit,
    hasMore: nextOffset < revisions.length,
    nextOffset: nextOffset < revisions.length ? nextOffset : null,
    revisions: page
  };
}

export function updateGovernancePolicy(config, policy, options = {}) {
  const previousPolicy = loadGovernancePolicy(config);
  const nextPolicy = saveGovernancePolicy(config, policy);
  const store = loadGovernancePolicyHistoryStore(config);
  const revision = normalizeGovernanceRevision({
    id: crypto.randomUUID(),
    at: nowIso(),
    action: 'policy_update',
    actorType: String(options.actorType || 'system').trim() || 'system',
    actorId: String(options.actorId || 'system').trim() || 'system',
    reason: String(options.reason || '').trim() || null,
    policy: nextPolicy,
    previousPolicy
  }, nextPolicy);
  store.revisions = [revision, ...(Array.isArray(store.revisions) ? store.revisions : [])].slice(0, 250);
  saveGovernancePolicyHistoryStore(config, store);
  return {
    policy: nextPolicy,
    revision
  };
}

export function rollbackGovernancePolicy(config, revisionId = null, options = {}) {
  const store = loadGovernancePolicyHistoryStore(config);
  const revisions = Array.isArray(store.revisions) ? store.revisions : [];
  if (!revisions.length) {
    throw new Error('No governance policy revision history is available for rollback.');
  }

  const target = revisionId
    ? revisions.find(entry => String(entry?.id || '').trim() === String(revisionId || '').trim())
    : revisions[0];

  if (!target) {
    throw new Error(`Governance policy revision '${revisionId}' was not found.`);
  }

  if (!target.previousPolicy) {
    throw new Error(`Governance policy revision '${target.id}' does not contain a rollback baseline.`);
  }

  const currentPolicy = loadGovernancePolicy(config);
  const restoredPolicy = saveGovernancePolicy(config, target.previousPolicy);
  const rollbackRevision = normalizeGovernanceRevision({
    id: crypto.randomUUID(),
    at: nowIso(),
    action: 'policy_rollback',
    actorType: String(options.actorType || 'system').trim() || 'system',
    actorId: String(options.actorId || 'system').trim() || 'system',
    reason: String(options.reason || '').trim() || null,
    policy: restoredPolicy,
    previousPolicy: currentPolicy
  }, restoredPolicy);
  store.revisions = [rollbackRevision, ...revisions].slice(0, 250);
  saveGovernancePolicyHistoryStore(config, store);
  return {
    policy: restoredPolicy,
    restoredFromRevisionId: target.id,
    revision: rollbackRevision
  };
}


export function getTenantGovernancePolicyPath(config) {
  return path.join(config.rootDir, '.skyequanta', 'governance-tenant-policies.json');
}

export function getGovernanceSecretsPath(config) {
  return path.join(config.rootDir, '.skyequanta', 'governance-secrets.json');
}

export function getGovernanceCostLedgerPath(config) {
  return path.join(config.rootDir, '.skyequanta', 'governance-cost-ledger.json');
}

export function getGovernanceReleaseDecisionPath(config) {
  return path.join(config.rootDir, '.skyequanta', 'governance-release-decisions.json');
}

function defaultTenantPolicy(tenantId = 'local') {
  return {
    version: 1,
    tenantId: normalizeTenantId(tenantId),
    actions: {
      githubPushAllowed: true,
      netlifyDeployAllowed: true,
      pullRequestCreateAllowed: true,
      pullRequestMergeAllowed: true,
      prebuildReplayAllowed: true,
      releaseReplayAllowed: true,
      secretBrokerAllowed: true
    },
    releaseGovernance: {
      requireApproval: false,
      maxReplayCount: 3,
      requiredSecretScopes: [],
      releaseReplayCostCents: 250
    },
    costControls: {
      monthlyBudgetCents: 5000,
      hardStop: true
    },
    createdAt: nowIso(),
    updatedAt: nowIso(),
    source: 'governance-default'
  };
}

function normalizeTenantPolicy(record = {}, tenantId = 'local') {
  const base = defaultTenantPolicy(tenantId);
  const currentTenantId = normalizeTenantId(record.tenantId || tenantId);
  return {
    version: 1,
    tenantId: currentTenantId,
    actions: {
      githubPushAllowed: normalizeBoolean(record?.actions?.githubPushAllowed, base.actions.githubPushAllowed),
      netlifyDeployAllowed: normalizeBoolean(record?.actions?.netlifyDeployAllowed, base.actions.netlifyDeployAllowed),
      pullRequestCreateAllowed: normalizeBoolean(record?.actions?.pullRequestCreateAllowed, base.actions.pullRequestCreateAllowed),
      pullRequestMergeAllowed: normalizeBoolean(record?.actions?.pullRequestMergeAllowed, base.actions.pullRequestMergeAllowed),
      prebuildReplayAllowed: normalizeBoolean(record?.actions?.prebuildReplayAllowed, base.actions.prebuildReplayAllowed),
      releaseReplayAllowed: normalizeBoolean(record?.actions?.releaseReplayAllowed, base.actions.releaseReplayAllowed),
      secretBrokerAllowed: normalizeBoolean(record?.actions?.secretBrokerAllowed, base.actions.secretBrokerAllowed)
    },
    releaseGovernance: {
      requireApproval: normalizeBoolean(record?.releaseGovernance?.requireApproval, base.releaseGovernance.requireApproval),
      maxReplayCount: readInteger(record?.releaseGovernance?.maxReplayCount, base.releaseGovernance.maxReplayCount),
      requiredSecretScopes: Array.isArray(record?.releaseGovernance?.requiredSecretScopes)
        ? [...new Set(record.releaseGovernance.requiredSecretScopes.map(value => String(value || '').trim()).filter(Boolean))]
        : base.releaseGovernance.requiredSecretScopes,
      releaseReplayCostCents: readNonNegativeInteger(record?.releaseGovernance?.releaseReplayCostCents, base.releaseGovernance.releaseReplayCostCents)
    },
    costControls: {
      monthlyBudgetCents: readNonNegativeInteger(record?.costControls?.monthlyBudgetCents, base.costControls.monthlyBudgetCents),
      hardStop: normalizeBoolean(record?.costControls?.hardStop, base.costControls.hardStop)
    },
    createdAt: String(record.createdAt || base.createdAt),
    updatedAt: String(record.updatedAt || nowIso()),
    source: String(record.source || base.source).trim() || base.source
  };
}

function loadTenantPolicyStore(config) {
  const parsed = readJson(getTenantGovernancePolicyPath(config), { version: 1, policies: {} });
  return {
    version: 1,
    policies: parsed?.policies && typeof parsed.policies === 'object' ? parsed.policies : {}
  };
}

function saveTenantPolicyStore(config, store) {
  writeJson(getTenantGovernancePolicyPath(config), {
    version: 1,
    policies: store?.policies && typeof store.policies === 'object' ? store.policies : {}
  });
}

export function listTenantGovernancePolicies(config) {
  const store = loadTenantPolicyStore(config);
  return Object.entries(store.policies)
    .map(([tenantId, policy]) => normalizeTenantPolicy(policy, tenantId))
    .sort((a, b) => a.tenantId.localeCompare(b.tenantId));
}

export function loadTenantGovernancePolicy(config, tenantId = 'local') {
  const normalizedTenantId = normalizeTenantId(tenantId);
  const store = loadTenantPolicyStore(config);
  const current = store.policies[normalizedTenantId];
  return normalizeTenantPolicy(current || {}, normalizedTenantId);
}

export function upsertTenantGovernancePolicy(config, tenantId = 'local', policy = {}, options = {}) {
  const normalizedTenantId = normalizeTenantId(tenantId);
  const store = loadTenantPolicyStore(config);
  const existing = normalizeTenantPolicy(store.policies[normalizedTenantId] || {}, normalizedTenantId);
  const next = normalizeTenantPolicy({
    ...existing,
    ...policy,
    actions: {
      ...existing.actions,
      ...(policy?.actions || {})
    },
    releaseGovernance: {
      ...existing.releaseGovernance,
      ...(policy?.releaseGovernance || {})
    },
    costControls: {
      ...existing.costControls,
      ...(policy?.costControls || {})
    },
    tenantId: normalizedTenantId,
    createdAt: existing.createdAt || nowIso(),
    updatedAt: nowIso(),
    source: String(options.source || policy?.source || existing.source || 'governance-upsert').trim() || 'governance-upsert'
  }, normalizedTenantId);
  store.policies[normalizedTenantId] = next;
  saveTenantPolicyStore(config, store);
  appendAuditEvent(config, {
    action: 'governance.tenant_policy.update',
    actorType: String(options.actorType || 'operator').trim() || 'operator',
    actorId: String(options.actorId || 'governance-policy').trim() || 'governance-policy',
    tenantId: normalizedTenantId,
    workspaceId: String(options.workspaceId || '').trim() || null,
    detail: {
      tenantId: normalizedTenantId,
      actions: next.actions,
      releaseGovernance: next.releaseGovernance,
      costControls: next.costControls,
      reason: String(options.reason || '').trim() || null
    }
  });
  return next;
}

function normalizeSecretRecord(record = {}) {
  const scope = String(record.scope || '').trim();
  const key = String(record.key || '').trim();
  const candidateProvider = String(record.candidateProvider || inferGovernanceSecretProvider(scope, key) || '').trim().toLowerCase() || null;
  return {
    id: String(record.id || crypto.randomUUID()).trim(),
    tenantId: normalizeTenantId(record.tenantId),
    scope,
    key,
    value: String(record.value || '').trim(),
    description: String(record.description || '').trim() || null,
    credentialLane: normalizeCredentialLane(record.credentialLane),
    founderManaged: record.founderManaged !== false,
    migrationStatus: String(record.migrationStatus || 'legacy_founder_managed').trim() || 'legacy_founder_managed',
    migrationTargetProfileId: String(record.migrationTargetProfileId || '').trim() || null,
    migrationArchivedAt: record.migrationArchivedAt ? String(record.migrationArchivedAt) : null,
    migrationSourceRetained: record.migrationSourceRetained !== false,
    candidateProvider,
    candidateAlias: String(record.candidateAlias || inferGovernanceSecretAlias(scope, candidateProvider)).trim() || null,
    createdAt: String(record.createdAt || nowIso()),
    updatedAt: String(record.updatedAt || nowIso()),
    lastAccessedAt: record.lastAccessedAt ? String(record.lastAccessedAt) : null,
    source: String(record.source || 'secret-broker').trim() || 'secret-broker'
  };
}

function loadSecretsStore(config) {
  const parsed = readJson(getGovernanceSecretsPath(config), { version: 1, secrets: [] });
  return {
    version: 1,
    secrets: Array.isArray(parsed?.secrets) ? parsed.secrets.map(normalizeSecretRecord) : []
  };
}

function saveSecretsStore(config, store) {
  writeJson(getGovernanceSecretsPath(config), {
    version: 1,
    secrets: Array.isArray(store?.secrets) ? store.secrets.map(normalizeSecretRecord) : []
  });
}

export function listGovernanceSecrets(config, options = {}) {
  const tenantId = options.tenantId ? normalizeTenantId(options.tenantId) : null;
  const scope = String(options.scope || '').trim();
  const includeValue = Boolean(options.includeValue);
  const secrets = loadSecretsStore(config).secrets
    .filter(secret => {
      if (tenantId && secret.tenantId !== tenantId) return false;
      if (scope && secret.scope !== scope) return false;
      return true;
    })
    .sort((a, b) => String(a.scope || '').localeCompare(String(b.scope || '')) || String(a.key || '').localeCompare(String(b.key || '')))
    .map(secret => ({
      ...secret,
      value: includeValue ? secret.value : '[REDACTED]'
    }));
  return {
    total: secrets.length,
    secrets
  };
}

export function upsertGovernanceSecret(config, options = {}) {
  const tenantId = normalizeTenantId(options.tenantId);
  const scope = String(options.scope || '').trim();
  const key = String(options.key || '').trim();
  const value = String(options.value || '').trim();
  if (!scope || !key) {
    throw new Error('scope and key are required for the secret broker.');
  }
  if (!value) {
    throw new Error('value is required for the secret broker.');
  }
  const store = loadSecretsStore(config);
  const index = store.secrets.findIndex(secret => secret.tenantId === tenantId && secret.scope === scope && secret.key === key);
  const existing = index >= 0 ? store.secrets[index] : null;
  const next = normalizeSecretRecord({
    ...(existing || {}),
    tenantId,
    scope,
    key,
    value,
    description: options.description,
    credentialLane: options.credentialLane || existing?.credentialLane || 'founder-only',
    founderManaged: options.founderManaged !== false,
    migrationStatus: existing?.migrationStatus || 'legacy_founder_managed',
    migrationTargetProfileId: existing?.migrationTargetProfileId || null,
    source: options.source || existing?.source || 'secret-broker',
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso()
  });
  if (index >= 0) {
    store.secrets[index] = next;
  } else {
    store.secrets.push(next);
  }
  saveSecretsStore(config, store);
  appendAuditEvent(config, {
    action: 'governance.secret.upsert',
    actorType: String(options.actorType || 'operator').trim() || 'operator',
    actorId: String(options.actorId || 'secret-broker').trim() || 'secret-broker',
    tenantId,
    workspaceId: String(options.workspaceId || '').trim() || null,
    detail: {
      scope,
      key,
      description: next.description
    }
  });
  return {
    ...next,
    value: '[REDACTED]'
  };
}

export function resolveGovernanceSecret(config, options = {}) {
  const tenantId = normalizeTenantId(options.tenantId);
  const scope = String(options.scope || '').trim();
  if (!scope) {
    throw new Error('scope is required to resolve a brokered secret.');
  }
  const includeValue = Boolean(options.includeValue);
  const store = loadSecretsStore(config);
  const index = store.secrets.findIndex(secret => secret.tenantId === tenantId && secret.scope === scope);
  if (index === -1) {
    return null;
  }
  store.secrets[index] = normalizeSecretRecord({
    ...store.secrets[index],
    lastAccessedAt: nowIso()
  });
  saveSecretsStore(config, store);
  const secret = store.secrets[index];
  return {
    ...secret,
    value: includeValue ? secret.value : '[REDACTED]'
  };
}

function loadCostLedger(config) {
  const parsed = readJson(getGovernanceCostLedgerPath(config), { version: 1, entries: [] });
  return {
    version: 1,
    entries: Array.isArray(parsed?.entries) ? parsed.entries : []
  };
}

function saveCostLedger(config, store) {
  writeJson(getGovernanceCostLedgerPath(config), {
    version: 1,
    entries: Array.isArray(store?.entries) ? store.entries : []
  });
}

export function recordGovernanceCost(config, entry = {}) {
  const normalized = {
    id: String(entry.id || crypto.randomUUID()).trim(),
    at: String(entry.at || nowIso()),
    tenantId: normalizeTenantId(entry.tenantId),
    workspaceId: String(entry.workspaceId || '').trim() || null,
    action: String(entry.action || 'governance.cost').trim() || 'governance.cost',
    costCents: readNonNegativeInteger(entry.costCents, 0),
    detail: entry.detail || {}
  };
  const store = loadCostLedger(config);
  store.entries = [...store.entries, normalized].slice(-2000);
  saveCostLedger(config, store);
  appendAuditEvent(config, {
    action: 'governance.cost.record',
    actorType: 'system',
    actorId: 'cost-ledger',
    tenantId: normalized.tenantId,
    workspaceId: normalized.workspaceId,
    detail: {
      action: normalized.action,
      costCents: normalized.costCents,
      releaseId: normalized.detail?.releaseId || null
    }
  });
  return normalized;
}

export function getGovernanceCostStatus(config, tenantId = 'local') {
  const normalizedTenantId = normalizeTenantId(tenantId);
  const policy = loadTenantGovernancePolicy(config, normalizedTenantId);
  const store = loadCostLedger(config);
  const entries = store.entries.filter(entry => normalizeTenantId(entry.tenantId) === normalizedTenantId);
  const spentCents = entries.reduce((sum, entry) => sum + readNonNegativeInteger(entry.costCents, 0), 0);
  const budgetCents = readNonNegativeInteger(policy.costControls.monthlyBudgetCents, 0);
  return {
    tenantId: normalizedTenantId,
    budgetCents,
    spentCents,
    remainingCents: Math.max(0, budgetCents - spentCents),
    hardStop: Boolean(policy.costControls.hardStop),
    entries: entries.length,
    latestEntry: entries.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))[0] || null
  };
}

function loadReleaseDecisionStore(config) {
  const parsed = readJson(getGovernanceReleaseDecisionPath(config), { version: 1, decisions: [] });
  return {
    version: 1,
    decisions: Array.isArray(parsed?.decisions) ? parsed.decisions : []
  };
}

function saveReleaseDecisionStore(config, store) {
  writeJson(getGovernanceReleaseDecisionPath(config), {
    version: 1,
    decisions: Array.isArray(store?.decisions) ? store.decisions : []
  });
}

export function recordGovernanceReleaseDecision(config, decision = {}) {
  const normalized = {
    id: String(decision.id || crypto.randomUUID()).trim(),
    at: String(decision.at || nowIso()),
    tenantId: normalizeTenantId(decision.tenantId),
    workspaceId: String(decision.workspaceId || '').trim() || null,
    action: String(decision.action || 'release_replay').trim() || 'release_replay',
    releaseId: String(decision.releaseId || '').trim() || null,
    allowed: Boolean(decision.allowed),
    reasons: Array.isArray(decision.reasons) ? decision.reasons : [],
    requiredSecretScopes: Array.isArray(decision.requiredSecretScopes) ? decision.requiredSecretScopes : [],
    availableSecretScopes: Array.isArray(decision.availableSecretScopes) ? decision.availableSecretScopes : [],
    estimatedCostCents: readNonNegativeInteger(decision.estimatedCostCents, 0),
    actorId: String(decision.actorId || 'governance').trim() || 'governance',
    detail: decision.detail || {}
  };
  const store = loadReleaseDecisionStore(config);
  store.decisions = [normalized, ...store.decisions].slice(0, 500);
  saveReleaseDecisionStore(config, store);
  appendAuditEvent(config, {
    action: normalized.allowed ? 'governance.release.allow' : 'governance.release.deny',
    actorType: 'operator',
    actorId: normalized.actorId,
    tenantId: normalized.tenantId,
    workspaceId: normalized.workspaceId,
    detail: {
      releaseId: normalized.releaseId,
      reasons: normalized.reasons,
      estimatedCostCents: normalized.estimatedCostCents
    }
  });
  return normalized;
}

export function listGovernanceReleaseDecisions(config, options = {}) {
  const tenantId = options.tenantId ? normalizeTenantId(options.tenantId) : null;
  const workspaceId = String(options.workspaceId || '').trim();
  const limit = readInteger(options.limit, 50);
  const decisions = loadReleaseDecisionStore(config).decisions
    .filter(entry => {
      if (tenantId && normalizeTenantId(entry.tenantId) != tenantId) return false;
      if (workspaceId && String(entry.workspaceId || '').trim() !== workspaceId) return false;
      return true;
    })
    .slice(0, limit);
  return {
    total: decisions.length,
    decisions
  };
}

export function evaluateGovernedAction(config, options = {}) {
  const tenantId = normalizeTenantId(options.tenantId);
  const workspaceId = String(options.workspaceId || '').trim() || null;
  const action = String(options.action || 'release_replay').trim() || 'release_replay';
  const requiredSecretScopes = Array.isArray(options.requiredSecretScopes)
    ? [...new Set(options.requiredSecretScopes.map(value => String(value || '').trim()).filter(Boolean))]
    : [];
  const estimatedCostCents = readNonNegativeInteger(options.estimatedCostCents, 0);
  const policy = loadTenantGovernancePolicy(config, tenantId);
  const costStatus = getGovernanceCostStatus(config, tenantId);
  const availableSecrets = listGovernanceSecrets(config, { tenantId, includeValue: false }).secrets;
  const availableSecretScopes = [...new Set(availableSecrets.map(secret => secret.scope))];
  const reasons = [];

  const actionMap = {
    github_push: 'githubPushAllowed',
    netlify_deploy: 'netlifyDeployAllowed',
    pr_create: 'pullRequestCreateAllowed',
    pr_merge: 'pullRequestMergeAllowed',
    prebuild_replay: 'prebuildReplayAllowed',
    release_replay: 'releaseReplayAllowed',
    secret_broker: 'secretBrokerAllowed'
  };
  const actionFlag = actionMap[action] || null;
  if (actionFlag && policy.actions[actionFlag] === false) {
    reasons.push('action_disabled');
  }

  const missingSecretScopes = requiredSecretScopes.filter(scope => !availableSecretScopes.includes(scope));
  if (missingSecretScopes.length) {
    reasons.push('missing_secret_scopes');
  }

  if (policy.costControls.hardStop && estimatedCostCents > costStatus.remainingCents) {
    reasons.push('budget_exceeded');
  }

  return {
    id: crypto.randomUUID(),
    at: nowIso(),
    tenantId,
    workspaceId,
    action,
    releaseId: String(options.releaseId || '').trim() || null,
    allowed: reasons.length === 0,
    reasons,
    missingSecretScopes,
    requiredSecretScopes,
    availableSecretScopes,
    estimatedCostCents,
    policy,
    costStatus,
    actorId: String(options.actorId || 'governance').trim() || 'governance',
    detail: options.detail || {}
  };
}

export function getGovernancePlaneSummary(config, options = {}) {
  const tenantId = normalizeTenantId(options.tenantId || 'local');
  const releaseQueueCount = readNonNegativeInteger(options.releaseQueueCount, 0);
  const releaseHistoryCount = readNonNegativeInteger(options.releaseHistoryCount, 0);
  const policy = loadTenantGovernancePolicy(config, tenantId);
  const secretSummary = listGovernanceSecrets(config, { tenantId, includeValue: false });
  const costs = getGovernanceCostStatus(config, tenantId);
  const decisions = listGovernanceReleaseDecisions(config, { tenantId, limit: 100 }).decisions;
  return {
    tenantId,
    policy,
    secretBroker: {
      total: secretSummary.total,
      scopes: [...new Set(secretSummary.secrets.map(secret => secret.scope))]
    },
    costs,
    releaseGovernance: {
      queue: releaseQueueCount,
      history: releaseHistoryCount,
      decisions: decisions.length,
      denied: decisions.filter(item => item.allowed === false).length,
      latestDecision: decisions[0] || null
    }
  };
}
