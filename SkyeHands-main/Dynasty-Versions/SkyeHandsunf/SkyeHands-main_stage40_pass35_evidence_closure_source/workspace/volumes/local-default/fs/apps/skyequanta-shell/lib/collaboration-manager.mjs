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

function normalizeOperatorId(value, fallback = 'operator') {
  return String(value || '').trim().toLowerCase() || fallback;
}

function normalizeDisplayName(value, fallback = 'Operator') {
  return String(value || '').trim() || fallback;
}

function normalizeTargetType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['file', 'channel', 'workspace'].includes(normalized) ? normalized : 'file';
}

function normalizeTargetId(value, targetType = 'file') {
  const normalized = String(value || '').trim();
  if (normalized) {
    return normalized;
  }

  if (targetType === 'workspace') {
    return 'workspace-root';
  }

  if (targetType === 'channel') {
    return 'general';
  }

  return '/workspace/unknown';
}

function normalizeChannel(value) {
  return String(value || '').trim().toLowerCase() || 'general';
}

function normalizeArray(values = []) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map(value => String(value || '').trim())
    .filter(Boolean);
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function emptyStore() {
  return {
    version: 1,
    workspaces: {}
  };
}

function emptyWorkspaceRecord(workspaceId) {
  return {
    workspaceId,
    presence: [],
    courtesyClaims: [],
    notes: [],
    mutations: []
  };
}

function normalizePresenceRecord(record = {}) {
  return {
    id: String(record.id || '').trim(),
    workspaceId: normalizeWorkspaceId(record.workspaceId),
    tenantId: normalizeTenantId(record.tenantId),
    operatorId: normalizeOperatorId(record.operatorId),
    displayName: normalizeDisplayName(record.displayName, record.operatorId || 'Operator'),
    channel: normalizeChannel(record.channel),
    activeFile: String(record.activeFile || '').trim() || null,
    authMode: String(record.authMode || 'operator').trim() || 'operator',
    status: String(record.status || 'active').trim() || 'active',
    joinedAt: String(record.joinedAt || nowIso()),
    lastSeenAt: String(record.lastSeenAt || nowIso()),
    leftAt: record.leftAt ? String(record.leftAt) : null,
    courtesyClaimIds: normalizeArray(record.courtesyClaimIds)
  };
}

function normalizeClaimRecord(record = {}) {
  const targetType = normalizeTargetType(record.targetType);
  return {
    id: String(record.id || '').trim(),
    workspaceId: normalizeWorkspaceId(record.workspaceId),
    tenantId: normalizeTenantId(record.tenantId),
    operatorId: normalizeOperatorId(record.operatorId),
    displayName: normalizeDisplayName(record.displayName, record.operatorId || 'Operator'),
    presenceId: String(record.presenceId || '').trim() || null,
    targetType,
    targetId: normalizeTargetId(record.targetId, targetType),
    mode: String(record.mode || 'editing').trim().toLowerCase() || 'editing',
    note: String(record.note || '').trim() || null,
    status: String(record.status || 'active').trim().toLowerCase() || 'active',
    courtesyConflict: Boolean(record.courtesyConflict),
    blockers: Array.isArray(record.blockers) ? record.blockers : [],
    createdAt: String(record.createdAt || nowIso()),
    lastHeartbeatAt: String(record.lastHeartbeatAt || nowIso()),
    releasedAt: record.releasedAt ? String(record.releasedAt) : null,
    source: String(record.source || 'skyequanta-collaboration').trim() || 'skyequanta-collaboration'
  };
}

function normalizeNoteRecord(record = {}) {
  return {
    id: String(record.id || '').trim(),
    workspaceId: normalizeWorkspaceId(record.workspaceId),
    tenantId: normalizeTenantId(record.tenantId),
    operatorId: normalizeOperatorId(record.operatorId),
    displayName: normalizeDisplayName(record.displayName, record.operatorId || 'Operator'),
    channel: normalizeChannel(record.channel),
    body: String(record.body || '').trim(),
    linkedTarget: record.linkedTarget && typeof record.linkedTarget === 'object'
      ? {
        targetType: normalizeTargetType(record.linkedTarget.targetType),
        targetId: normalizeTargetId(record.linkedTarget.targetId, normalizeTargetType(record.linkedTarget.targetType))
      }
      : null,
    createdAt: String(record.createdAt || nowIso()),
    resolvedAt: record.resolvedAt ? String(record.resolvedAt) : null
  };
}

function normalizeMutationRecord(record = {}) {
  return {
    id: String(record.id || '').trim(),
    workspaceId: normalizeWorkspaceId(record.workspaceId),
    tenantId: normalizeTenantId(record.tenantId),
    operatorId: normalizeOperatorId(record.operatorId),
    displayName: normalizeDisplayName(record.displayName, record.operatorId || 'Operator'),
    filePath: String(record.filePath || '').trim() || '/workspace/unknown',
    channel: normalizeChannel(record.channel),
    action: String(record.action || 'edit').trim().toLowerCase() || 'edit',
    summary: String(record.summary || '').trim() || null,
    courtesyConflict: Boolean(record.courtesyConflict),
    blockers: Array.isArray(record.blockers) ? record.blockers : [],
    claimId: String(record.claimId || '').trim() || null,
    createdAt: String(record.createdAt || nowIso())
  };
}

export function getCollaborationStorePath(config) {
  return path.join(config.rootDir, '.skyequanta', 'collaboration-state.json');
}

function loadStore(config) {
  const parsed = readJson(getCollaborationStorePath(config), emptyStore());
  const workspaces = parsed && typeof parsed.workspaces === 'object' && !Array.isArray(parsed.workspaces)
    ? parsed.workspaces
    : {};

  const normalized = {
    version: 1,
    workspaces: {}
  };

  for (const [workspaceId, record] of Object.entries(workspaces)) {
    normalized.workspaces[normalizeWorkspaceId(workspaceId)] = {
      workspaceId: normalizeWorkspaceId(workspaceId),
      presence: Array.isArray(record?.presence) ? record.presence.map(normalizePresenceRecord) : [],
      courtesyClaims: Array.isArray(record?.courtesyClaims) ? record.courtesyClaims.map(normalizeClaimRecord) : [],
      notes: Array.isArray(record?.notes) ? record.notes.map(normalizeNoteRecord) : [],
      mutations: Array.isArray(record?.mutations) ? record.mutations.map(normalizeMutationRecord) : []
    };
  }

  pruneExpired(normalized, config);
  return normalized;
}

function saveStore(config, store) {
  writeJson(getCollaborationStorePath(config), store);
  return store;
}

function getPresenceTtlMs() {
  return parsePositiveInt(process.env.SKYEQUANTA_COLLAB_PRESENCE_TTL_MS, 5 * 60 * 1000);
}

function getClaimTtlMs() {
  return parsePositiveInt(process.env.SKYEQUANTA_COLLAB_CLAIM_TTL_MS, 10 * 60 * 1000);
}

function getMutationConflictWindowMs() {
  return parsePositiveInt(process.env.SKYEQUANTA_COLLAB_MUTATION_WINDOW_MS, 2 * 60 * 1000);
}

function ensureWorkspaceRecord(store, workspaceId) {
  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
  if (!store.workspaces[normalizedWorkspaceId] || typeof store.workspaces[normalizedWorkspaceId] !== 'object') {
    store.workspaces[normalizedWorkspaceId] = emptyWorkspaceRecord(normalizedWorkspaceId);
  }
  return store.workspaces[normalizedWorkspaceId];
}

function pruneExpired(store, config) {
  const now = Date.now();
  const presenceTtlMs = getPresenceTtlMs(config);
  const claimTtlMs = getClaimTtlMs(config);

  for (const workspaceRecord of Object.values(store.workspaces)) {
    workspaceRecord.presence = (workspaceRecord.presence || []).filter(record => {
      const lastSeen = Date.parse(record.lastSeenAt || record.joinedAt || 0);
      return record.status === 'active' && Number.isFinite(lastSeen) && (now - lastSeen) <= presenceTtlMs;
    });

    workspaceRecord.courtesyClaims = (workspaceRecord.courtesyClaims || []).filter(record => {
      const lastHeartbeat = Date.parse(record.lastHeartbeatAt || record.createdAt || 0);
      if (record.status !== 'active') {
        return false;
      }
      return Number.isFinite(lastHeartbeat) && (now - lastHeartbeat) <= claimTtlMs;
    });

    const activePresenceIds = new Set(workspaceRecord.presence.map(record => record.id));
    workspaceRecord.courtesyClaims = workspaceRecord.courtesyClaims.filter(record => {
      if (!record.presenceId) {
        return true;
      }
      return activePresenceIds.has(record.presenceId);
    });

    workspaceRecord.notes = (workspaceRecord.notes || []).slice(-100);
    workspaceRecord.mutations = (workspaceRecord.mutations || []).slice(-200);
  }

  return store;
}

export function ensureCollaborationStore(config) {
  const store = loadStore(config);
  saveStore(config, store);
  return store;
}

function buildPresenceSnapshot(workspaceRecord) {
  const presence = [...(workspaceRecord.presence || [])]
    .sort((a, b) => String(a.displayName || a.operatorId).localeCompare(String(b.displayName || b.operatorId)));
  const courtesyClaims = [...(workspaceRecord.courtesyClaims || [])]
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  const notes = [...(workspaceRecord.notes || [])]
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  const mutations = [...(workspaceRecord.mutations || [])]
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
    .slice(-25);
  return { presence, courtesyClaims, notes, mutations };
}

function detectClaimBlockers(workspaceRecord, nextClaim) {
  return (workspaceRecord.courtesyClaims || [])
    .filter(record => record.status === 'active')
    .filter(record => record.targetType === nextClaim.targetType)
    .filter(record => record.targetId === nextClaim.targetId)
    .filter(record => record.operatorId !== nextClaim.operatorId)
    .map(record => ({
      claimId: record.id,
      operatorId: record.operatorId,
      displayName: record.displayName,
      mode: record.mode,
      targetType: record.targetType,
      targetId: record.targetId,
      createdAt: record.createdAt
    }));
}

function buildCollaborationSummary(workspaceRecord = {}) {
  const presence = Array.isArray(workspaceRecord.presence) ? workspaceRecord.presence : [];
  const courtesyClaims = Array.isArray(workspaceRecord.courtesyClaims) ? workspaceRecord.courtesyClaims : [];
  const notes = Array.isArray(workspaceRecord.notes) ? workspaceRecord.notes : [];
  const mutations = Array.isArray(workspaceRecord.mutations) ? workspaceRecord.mutations : [];
  const activeClaims = courtesyClaims.filter(item => item.status === 'active');
  const activeOperators = [...new Set(presence.map(item => item.operatorId))];
  const activeFiles = [...new Set(presence.map(item => item.activeFile).filter(Boolean))];
  const channels = [...new Set(presence.map(item => item.channel).filter(Boolean))];
  const courtesyConflicts = activeClaims.filter(item => item.courtesyConflict).length + mutations.filter(item => item.courtesyConflict).length;

  return {
    presenceSessions: presence.length,
    activeOperators: activeOperators.length,
    activeOperatorIds: activeOperators,
    channels,
    activeFiles,
    activeClaims: activeClaims.length,
    unresolvedNotes: notes.filter(item => !item.resolvedAt).length,
    courtesyConflicts,
    recentMutations: mutations.slice(-10)
  };
}

export function getCollaborationStatus(config, workspaceId) {
  const store = loadStore(config);
  const workspaceRecord = ensureWorkspaceRecord(store, workspaceId);
  const snapshot = buildPresenceSnapshot(workspaceRecord);
  return {
    workspaceId: normalizeWorkspaceId(workspaceId),
    summary: buildCollaborationSummary(workspaceRecord),
    roster: snapshot.presence,
    courtesyClaims: snapshot.courtesyClaims,
    notes: snapshot.notes,
    mutations: snapshot.mutations
  };
}

export function joinPresence(config, options = {}) {
  const store = loadStore(config);
  const workspaceId = normalizeWorkspaceId(options.workspaceId);
  const tenantId = normalizeTenantId(options.tenantId);
  const operatorId = normalizeOperatorId(options.operatorId, 'operator');
  const displayName = normalizeDisplayName(options.displayName, operatorId);
  const workspaceRecord = ensureWorkspaceRecord(store, workspaceId);
  const stamp = nowIso();

  let presence = (workspaceRecord.presence || []).find(record => record.operatorId === operatorId);
  if (presence) {
    presence = {
      ...presence,
      displayName,
      channel: normalizeChannel(options.channel || presence.channel),
      activeFile: String(options.activeFile || '').trim() || presence.activeFile || null,
      status: 'active',
      lastSeenAt: stamp,
      leftAt: null,
      authMode: String(options.authMode || presence.authMode || 'operator').trim() || 'operator'
    };
    workspaceRecord.presence = workspaceRecord.presence.map(record => record.id === presence.id ? presence : record);
  } else {
    presence = normalizePresenceRecord({
      id: crypto.randomUUID(),
      workspaceId,
      tenantId,
      operatorId,
      displayName,
      channel: normalizeChannel(options.channel),
      activeFile: String(options.activeFile || '').trim() || null,
      authMode: String(options.authMode || 'operator').trim() || 'operator',
      status: 'active',
      joinedAt: stamp,
      lastSeenAt: stamp,
      courtesyClaimIds: []
    });
    workspaceRecord.presence.push(presence);
  }

  saveStore(config, store);
  appendAuditEvent(config, {
    action: 'collaboration.presence.join',
    actorType: 'operator',
    actorId: operatorId,
    tenantId,
    workspaceId,
    detail: {
      displayName,
      channel: presence.channel,
      activeFile: presence.activeFile,
      authMode: presence.authMode
    }
  });
  publishRuntimeEvent(config, {
    action: 'collaboration.presence_join',
    workspaceId,
    tenantId,
    lane: 'collaboration',
    actorType: 'operator',
    actorId: operatorId,
    detail: {
      presenceId: presence.id,
      displayName,
      channel: presence.channel,
      activeFile: presence.activeFile
    }
  });

  return {
    workspaceId,
    presence,
    collaboration: getCollaborationStatus(config, workspaceId)
  };
}

export function heartbeatPresence(config, options = {}) {
  const store = loadStore(config);
  const workspaceId = normalizeWorkspaceId(options.workspaceId);
  const workspaceRecord = ensureWorkspaceRecord(store, workspaceId);
  const presenceId = String(options.presenceId || '').trim();
  const presence = (workspaceRecord.presence || []).find(record => record.id === presenceId || record.operatorId === normalizeOperatorId(options.operatorId || ''));
  if (!presence) {
    throw new Error(`Presence '${presenceId || options.operatorId || ''}' was not found.`);
  }

  const updated = normalizePresenceRecord({
    ...presence,
    channel: options.channel !== undefined ? normalizeChannel(options.channel) : presence.channel,
    activeFile: options.activeFile !== undefined ? (String(options.activeFile || '').trim() || null) : presence.activeFile,
    lastSeenAt: nowIso(),
    status: 'active'
  });
  workspaceRecord.presence = workspaceRecord.presence.map(record => record.id === presence.id ? updated : record);
  saveStore(config, store);

  return {
    workspaceId,
    presence: updated,
    collaboration: getCollaborationStatus(config, workspaceId)
  };
}

export function leavePresence(config, options = {}) {
  const store = loadStore(config);
  const workspaceId = normalizeWorkspaceId(options.workspaceId);
  const workspaceRecord = ensureWorkspaceRecord(store, workspaceId);
  const presenceId = String(options.presenceId || '').trim();
  const operatorId = normalizeOperatorId(options.operatorId || '');
  const presence = (workspaceRecord.presence || []).find(record => record.id === presenceId || (!!operatorId && record.operatorId === operatorId));
  if (!presence) {
    throw new Error(`Presence '${presenceId || operatorId}' was not found.`);
  }

  workspaceRecord.presence = workspaceRecord.presence.filter(record => record.id !== presence.id);
  workspaceRecord.courtesyClaims = (workspaceRecord.courtesyClaims || []).filter(record => record.presenceId !== presence.id && record.operatorId !== presence.operatorId);
  saveStore(config, store);
  appendAuditEvent(config, {
    action: 'collaboration.presence.leave',
    actorType: 'operator',
    actorId: presence.operatorId,
    tenantId: presence.tenantId,
    workspaceId,
    detail: {
      presenceId: presence.id,
      reason: String(options.reason || 'leave').trim() || 'leave'
    }
  });
  publishRuntimeEvent(config, {
    action: 'collaboration.presence_leave',
    workspaceId,
    tenantId: presence.tenantId,
    lane: 'collaboration',
    actorType: 'operator',
    actorId: presence.operatorId,
    detail: {
      presenceId: presence.id,
      reason: String(options.reason || 'leave').trim() || 'leave'
    }
  });

  return {
    workspaceId,
    releasedPresenceId: presence.id,
    collaboration: getCollaborationStatus(config, workspaceId)
  };
}

export function upsertCourtesyClaim(config, options = {}) {
  const store = loadStore(config);
  const workspaceId = normalizeWorkspaceId(options.workspaceId);
  const tenantId = normalizeTenantId(options.tenantId);
  const operatorId = normalizeOperatorId(options.operatorId, 'operator');
  const displayName = normalizeDisplayName(options.displayName, operatorId);
  const workspaceRecord = ensureWorkspaceRecord(store, workspaceId);
  const stamp = nowIso();
  const targetType = normalizeTargetType(options.targetType);
  const targetId = normalizeTargetId(options.targetId || options.filePath || options.channel, targetType);
  const normalizedPresenceId = String(options.presenceId || '').trim() || null;

  let claim = (workspaceRecord.courtesyClaims || []).find(record => record.operatorId === operatorId && record.targetType === targetType && record.targetId === targetId);
  const nextClaim = normalizeClaimRecord({
    ...(claim || {}),
    id: claim?.id || crypto.randomUUID(),
    workspaceId,
    tenantId,
    operatorId,
    displayName,
    presenceId: normalizedPresenceId,
    targetType,
    targetId,
    mode: String(options.mode || claim?.mode || 'editing').trim().toLowerCase() || 'editing',
    note: String(options.note || '').trim() || claim?.note || null,
    status: 'active',
    createdAt: claim?.createdAt || stamp,
    lastHeartbeatAt: stamp,
    source: String(options.source || 'skyequanta-collaboration').trim() || 'skyequanta-collaboration'
  });
  const blockers = detectClaimBlockers(workspaceRecord, nextClaim);
  const persistedClaim = normalizeClaimRecord({
    ...nextClaim,
    courtesyConflict: blockers.length > 0,
    blockers
  });

  if (claim) {
    workspaceRecord.courtesyClaims = workspaceRecord.courtesyClaims.map(record => record.id === claim.id ? persistedClaim : record);
  } else {
    workspaceRecord.courtesyClaims.push(persistedClaim);
  }

  saveStore(config, store);
  appendAuditEvent(config, {
    action: 'collaboration.courtesy.claim',
    actorType: 'operator',
    actorId: operatorId,
    tenantId,
    workspaceId,
    detail: {
      claimId: persistedClaim.id,
      targetType,
      targetId,
      mode: persistedClaim.mode,
      courtesyConflict: persistedClaim.courtesyConflict,
      blockers
    }
  });
  publishRuntimeEvent(config, {
    action: persistedClaim.courtesyConflict ? 'collaboration.courtesy_conflict' : 'collaboration.courtesy_claim',
    workspaceId,
    tenantId,
    lane: 'collaboration',
    actorType: 'operator',
    actorId: operatorId,
    detail: {
      claimId: persistedClaim.id,
      targetType,
      targetId,
      mode: persistedClaim.mode,
      blockers
    }
  });

  return {
    workspaceId,
    claim: persistedClaim,
    collaboration: getCollaborationStatus(config, workspaceId)
  };
}

export function recordCollaborationMutation(config, options = {}) {
  const store = loadStore(config);
  const workspaceId = normalizeWorkspaceId(options.workspaceId);
  const tenantId = normalizeTenantId(options.tenantId);
  const operatorId = normalizeOperatorId(options.operatorId, 'operator');
  const displayName = normalizeDisplayName(options.displayName, operatorId);
  const workspaceRecord = ensureWorkspaceRecord(store, workspaceId);
  const stamp = nowIso();
  const filePath = String(options.filePath || '').trim() || '/workspace/unknown';
  const targetId = normalizeTargetId(filePath, 'file');
  const activeClaims = (workspaceRecord.courtesyClaims || []).filter(record => record.status === 'active');
  const blockers = activeClaims
    .filter(record => record.targetType === 'file' && record.targetId === targetId && record.operatorId !== operatorId)
    .map(record => ({
      claimId: record.id,
      operatorId: record.operatorId,
      displayName: record.displayName,
      targetId: record.targetId,
      mode: record.mode,
      createdAt: record.createdAt
    }));

  const recentMutationConflicts = (workspaceRecord.mutations || []).filter(record => {
    const createdAtMs = Date.parse(record.createdAt || 0);
    return Number.isFinite(createdAtMs)
      && (Date.now() - createdAtMs) <= getMutationConflictWindowMs(config)
      && record.filePath === filePath
      && record.operatorId !== operatorId;
  }).map(record => ({
    mutationId: record.id,
    operatorId: record.operatorId,
    displayName: record.displayName,
    createdAt: record.createdAt,
    action: record.action
  }));

  const courtesyConflict = blockers.length > 0 || recentMutationConflicts.length > 0;
  const mutation = normalizeMutationRecord({
    id: crypto.randomUUID(),
    workspaceId,
    tenantId,
    operatorId,
    displayName,
    filePath,
    channel: options.channel,
    action: options.action,
    summary: options.summary,
    courtesyConflict,
    blockers: [...blockers, ...recentMutationConflicts],
    claimId: String(options.claimId || '').trim() || null,
    createdAt: stamp
  });

  workspaceRecord.mutations.push(mutation);
  saveStore(config, store);
  appendAuditEvent(config, {
    action: courtesyConflict ? 'collaboration.mutation.conflict' : 'collaboration.mutation.record',
    actorType: 'operator',
    actorId: operatorId,
    tenantId,
    workspaceId,
    detail: {
      mutationId: mutation.id,
      filePath,
      action: mutation.action,
      courtesyConflict,
      blockers: mutation.blockers
    }
  });
  publishRuntimeEvent(config, {
    action: courtesyConflict ? 'collaboration.mutation_conflict' : 'collaboration.mutation_recorded',
    workspaceId,
    tenantId,
    lane: 'collaboration',
    actorType: 'operator',
    actorId: operatorId,
    detail: {
      mutationId: mutation.id,
      filePath,
      action: mutation.action,
      blockers: mutation.blockers
    }
  });

  return {
    workspaceId,
    mutation,
    collaboration: getCollaborationStatus(config, workspaceId)
  };
}

export function addSharedNote(config, options = {}) {
  const store = loadStore(config);
  const workspaceId = normalizeWorkspaceId(options.workspaceId);
  const tenantId = normalizeTenantId(options.tenantId);
  const operatorId = normalizeOperatorId(options.operatorId, 'operator');
  const displayName = normalizeDisplayName(options.displayName, operatorId);
  const body = String(options.body || '').trim();
  if (!body) {
    throw new Error('body is required to create a shared collaboration note.');
  }

  const workspaceRecord = ensureWorkspaceRecord(store, workspaceId);
  const note = normalizeNoteRecord({
    id: crypto.randomUUID(),
    workspaceId,
    tenantId,
    operatorId,
    displayName,
    channel: options.channel,
    body,
    linkedTarget: options.linkedTarget,
    createdAt: nowIso()
  });

  workspaceRecord.notes.push(note);
  saveStore(config, store);
  appendAuditEvent(config, {
    action: 'collaboration.note.add',
    actorType: 'operator',
    actorId: operatorId,
    tenantId,
    workspaceId,
    detail: {
      noteId: note.id,
      channel: note.channel,
      linkedTarget: note.linkedTarget
    }
  });
  publishRuntimeEvent(config, {
    action: 'collaboration.note_added',
    workspaceId,
    tenantId,
    lane: 'collaboration',
    actorType: 'operator',
    actorId: operatorId,
    detail: {
      noteId: note.id,
      channel: note.channel,
      linkedTarget: note.linkedTarget
    }
  });

  return {
    workspaceId,
    note,
    collaboration: getCollaborationStatus(config, workspaceId)
  };
}
