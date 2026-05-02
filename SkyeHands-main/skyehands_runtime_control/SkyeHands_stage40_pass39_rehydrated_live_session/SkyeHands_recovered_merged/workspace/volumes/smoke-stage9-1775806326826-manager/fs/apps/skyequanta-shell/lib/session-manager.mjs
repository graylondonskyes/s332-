import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { appendAuditEvent, assertSessionOpenAllowed } from './governance-manager.mjs';
import { publishRuntimeEvent, recordSessionContext } from './runtime-bus.mjs';
import { decryptProviderProfile, toSafeProviderProfile } from './provider-vault.mjs';

const providerUnlockCache = new Map();

function nowMs() {
  return Date.now();
}

function nowIso() {
  return new Date().toISOString();
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function randomToken() {
  return crypto.randomBytes(24).toString('hex');
}

function readInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return parsed;
}

export function getSessionStorePath(config) {
  return path.join(config.rootDir, '.skyequanta', 'sessions.json');
}

function emptyStore() {
  return {
    version: 1,
    sessions: []
  };
}

function normalizeTenantId(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || 'local';
}

function normalizeSessionRecord(record) {
  const now = nowMs();
  const expiresAtMs = readInteger(record?.expiresAtMs, now);
  return {
    id: String(record?.id || '').trim(),
    tenantId: normalizeTenantId(record?.tenantId),
    workspaceId: String(record?.workspaceId || '').trim(),
    clientName: String(record?.clientName || 'unknown').trim() || 'unknown',
    accessToken: String(record?.accessToken || '').trim(),
    reconnectToken: String(record?.reconnectToken || '').trim(),
    authSource: String(record?.authSource || 'local-session').trim() || 'local-session',
    gateSessionId: String(record?.gateSessionId || '').trim() || null,
    gateAppId: String(record?.gateAppId || '').trim() || null,
    gateOrgId: String(record?.gateOrgId || '').trim() || null,
    gateAuthMode: String(record?.gateAuthMode || '').trim() || null,
    founderGateway: Boolean(record?.founderGateway),
    gateExpiresAt: String(record?.gateExpiresAt || '').trim() || null,
    createdAt: String(record?.createdAt || nowIso()),
    lastSeenAt: String(record?.lastSeenAt || nowIso()),
    expiresAt: String(record?.expiresAt || new Date(expiresAtMs).toISOString()),
    expiresAtMs
  };
}

function pruneExpired(store) {
  const now = nowMs();
  store.sessions = store.sessions.filter(session => session.expiresAtMs > now);
  pruneExpiredProviderUnlocks();
  return store;
}


function pruneExpiredProviderUnlocks(sessionId = null) {
  const now = nowMs();
  const keys = sessionId ? [String(sessionId).trim()] : [...providerUnlockCache.keys()];
  for (const key of keys) {
    const sessionEntry = providerUnlockCache.get(key);
    if (!sessionEntry) continue;
    const nextProfiles = {};
    for (const [profileId, entry] of Object.entries(sessionEntry.profiles || {})) {
      if (Number.parseInt(String(entry?.expiresAtMs || 0), 10) > now) {
        nextProfiles[profileId] = entry;
      }
    }
    if (Object.keys(nextProfiles).length) {
      sessionEntry.profiles = nextProfiles;
      providerUnlockCache.set(key, sessionEntry);
    } else {
      providerUnlockCache.delete(key);
    }
  }
}

function getProviderUnlockTtlMs(config) {
  return readInteger(process.env.SKYEQUANTA_PROVIDER_UNLOCK_TTL_MS, 30 * 60 * 1000);
}

export function unlockProviderProfileForSession(config, options = {}) {
  const sessionId = String(options.sessionId || '').trim();
  const profileId = String(options.profileId || '').trim();
  if (!sessionId || !profileId) {
    throw new Error('sessionId and profileId are required to unlock a provider profile.');
  }
  const ttlMs = readInteger(options.ttlMs, getProviderUnlockTtlMs(config));
  const decrypted = decryptProviderProfile(config, {
    profileId,
    tenantId: options.tenantId,
    unlockSecret: options.unlockSecret
  });
  const expiresAtMs = nowMs() + ttlMs;
  const existing = providerUnlockCache.get(sessionId) || { profiles: {} };
  existing.profiles[profileId] = {
    profileId,
    tenantId: decrypted.profile.tenantId,
    workspaceId: String(options.workspaceId || '').trim() || null,
    unlockedAt: nowIso(),
    expiresAtMs,
    expiresAt: new Date(expiresAtMs).toISOString(),
    payload: decrypted.payload,
    profile: toSafeProviderProfile(decrypted.profile)
  };
  providerUnlockCache.set(sessionId, existing);
  appendAuditEvent(config, {
    action: 'provider.session_unlock',
    actorType: String(options.actorType || 'client').trim() || 'client',
    actorId: String(options.actorId || sessionId).trim() || sessionId,
    tenantId: decrypted.profile.tenantId,
    workspaceId: String(options.workspaceId || '').trim() || null,
    sessionId,
    detail: {
      profileId,
      provider: decrypted.profile.provider,
      alias: decrypted.profile.alias,
      expiresAt: new Date(expiresAtMs).toISOString()
    }
  });
  return {
    ok: true,
    sessionId,
    profile: toSafeProviderProfile(decrypted.profile),
    unlockExpiresAt: new Date(expiresAtMs).toISOString()
  };
}

export function getUnlockedProviderProfileForSession(config, options = {}) {
  pruneExpiredProviderUnlocks(String(options.sessionId || '').trim() || null);
  const sessionEntry = providerUnlockCache.get(String(options.sessionId || '').trim());
  if (!sessionEntry) {
    return null;
  }
  const entry = sessionEntry.profiles?.[String(options.profileId || '').trim()];
  if (!entry) {
    return null;
  }
  return entry;
}

export function getSessionProviderUnlockState(config, options = {}) {
  pruneExpiredProviderUnlocks(String(options.sessionId || '').trim() || null);
  const sessionEntry = providerUnlockCache.get(String(options.sessionId || '').trim());
  const profiles = Object.values(sessionEntry?.profiles || {}).map(entry => ({
    profileId: entry.profileId,
    tenantId: entry.tenantId,
    workspaceId: entry.workspaceId,
    unlockExpiresAt: entry.expiresAt,
    profile: entry.profile
  }));
  return {
    sessionId: String(options.sessionId || '').trim() || null,
    unlocked: profiles.length > 0,
    unlockCount: profiles.length,
    profiles
  };
}

export function lockProviderProfilesForSession(config, options = {}) {
  const sessionId = String(options.sessionId || '').trim();
  if (!sessionId) {
    throw new Error('sessionId is required to lock provider profiles.');
  }
  const profileId = String(options.profileId || '').trim();
  const entry = providerUnlockCache.get(sessionId);
  if (!entry) {
    return { ok: true, sessionId, locked: 0 };
  }
  let locked = 0;
  if (profileId) {
    if (entry.profiles?.[profileId]) {
      delete entry.profiles[profileId];
      locked = 1;
    }
  } else {
    locked = Object.keys(entry.profiles || {}).length;
    entry.profiles = {};
  }
  if (!Object.keys(entry.profiles || {}).length) {
    providerUnlockCache.delete(sessionId);
  } else {
    providerUnlockCache.set(sessionId, entry);
  }
  appendAuditEvent(config, {
    action: 'provider.session_lock',
    actorType: String(options.actorType || 'client').trim() || 'client',
    actorId: String(options.actorId || sessionId).trim() || sessionId,
    tenantId: String(options.tenantId || 'local').trim() || 'local',
    workspaceId: String(options.workspaceId || '').trim() || null,
    sessionId,
    detail: {
      profileId: profileId || null,
      locked
    }
  });
  return { ok: true, sessionId, locked };
}


function loadSessionStore(config) {
  const storePath = getSessionStorePath(config);
  if (!fs.existsSync(storePath)) {
    return emptyStore();
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    const sessions = Array.isArray(parsed.sessions) ? parsed.sessions.map(normalizeSessionRecord) : [];
    return pruneExpired({
      version: 1,
      sessions
    });
  } catch {
    return emptyStore();
  }
}

function saveSessionStore(config, store) {
  const storePath = getSessionStorePath(config);
  ensureDirectory(path.dirname(storePath));
  fs.writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  return storePath;
}

export function cleanupExpiredSessions(config, options = {}) {
  const before = loadSessionStore(config);
  const beforeCount = before.sessions.length;
  const pruned = pruneExpired(before);
  const afterCount = pruned.sessions.length;
  const removed = Math.max(0, beforeCount - afterCount);
  saveSessionStore(config, pruned);

  if (removed > 0) {
    for (const stale of before.sessions.filter(session => !pruned.sessions.find(item => item.id === session.id))) {
      providerUnlockCache.delete(stale.id);
    }
    appendAuditEvent(config, {
      action: 'session.cleanup',
      actorType: 'system',
      actorId: String(options.actorId || 'session-cleanup').trim() || 'session-cleanup',
      detail: {
        removed,
        beforeCount,
        afterCount
      }
    });
  }

  return {
    removed,
    beforeCount,
    afterCount
  };
}

function getSessionTtlMs(config) {
  return readInteger(process.env.SKYEQUANTA_SESSION_TTL_MS, 2 * 60 * 60 * 1000);
}

function getSessionByAccessToken(store, accessToken) {
  return store.sessions.find(session => session.accessToken === accessToken) || null;
}

function getSessionById(store, sessionId) {
  return store.sessions.find(session => session.id === sessionId) || null;
}

function refreshSessionLifetime(config, session) {
  const ttlMs = getSessionTtlMs(config);
  const nextMs = nowMs() + ttlMs;
  return {
    ...session,
    lastSeenAt: nowIso(),
    expiresAtMs: nextMs,
    expiresAt: new Date(nextMs).toISOString()
  };
}

function updateSession(store, nextSession) {
  const index = store.sessions.findIndex(item => item.id === nextSession.id);
  if (index === -1) {
    store.sessions.push(nextSession);
    return nextSession;
  }

  store.sessions[index] = nextSession;
  return nextSession;
}

export function openSession(config, options = {}) {
  const workspaceId = String(options.workspaceId || '').trim();
  if (!workspaceId) {
    throw new Error('workspaceId is required to open a session.');
  }

  const tenantId = normalizeTenantId(options.tenantId);
  const clientName = String(options.clientName || 'unknown').trim() || 'unknown';
  const ttlMs = getSessionTtlMs(config);
  const now = nowMs();
  const expiresAtMs = now + ttlMs;
  const session = {
    id: crypto.randomUUID(),
    tenantId,
    workspaceId,
    clientName,
    accessToken: randomToken(),
    reconnectToken: randomToken(),
    authSource: String(options.authSource || 'local-session').trim() || 'local-session',
    gateSessionId: String(options.gateSessionId || '').trim() || null,
    gateAppId: String(options.gateAppId || '').trim() || null,
    gateOrgId: String(options.gateOrgId || '').trim() || null,
    gateAuthMode: String(options.gateAuthMode || '').trim() || null,
    founderGateway: Boolean(options.founderGateway),
    gateExpiresAt: String(options.gateExpiresAt || '').trim() || null,
    createdAt: nowIso(),
    lastSeenAt: nowIso(),
    expiresAtMs,
    expiresAt: new Date(expiresAtMs).toISOString()
  };

  const store = pruneExpired(loadSessionStore(config));
  assertSessionOpenAllowed(config, store.sessions.length);
  store.sessions.push(session);
  saveSessionStore(config, store);
  recordSessionContext(config, session);
  publishRuntimeEvent(config, {
    action: 'runtime.session_context',
    workspaceId: session.workspaceId,
    tenantId: session.tenantId,
    lane: 'shell',
    actorType: 'client',
    actorId: session.clientName,
    detail: {
      sessionId: session.id,
      authSource: session.authSource,
      mode: 'open'
    }
  });
  appendAuditEvent(config, {
    action: 'session.open',
    workspaceId: workspaceId,
    tenantId,
    sessionId: session.id,
    actorType: 'client',
    actorId: session.clientName,
    detail: {
      clientName,
      authSource: session.authSource,
      gateSessionId: session.gateSessionId,
      gateAppId: session.gateAppId,
      gateOrgId: session.gateOrgId,
      gateAuthMode: session.gateAuthMode,
      founderGateway: session.founderGateway
    }
  });
  return session;
}

export function listSessions(config, tenantId = null) {
  const store = pruneExpired(loadSessionStore(config));
  if (!tenantId) {
    return store.sessions;
  }

  const normalizedTenant = normalizeTenantId(tenantId);
  return store.sessions.filter(session => session.tenantId === normalizedTenant);
}

export function validateAccessToken(config, accessToken, constraints = {}) {
  const token = String(accessToken || '').trim();
  if (!token) {
    return null;
  }

  const store = pruneExpired(loadSessionStore(config));
  const session = getSessionByAccessToken(store, token);
  if (!session) {
    return null;
  }

  const tenantId = constraints.tenantId ? normalizeTenantId(constraints.tenantId) : null;
  const workspaceId = constraints.workspaceId ? String(constraints.workspaceId).trim() : null;
  if (tenantId && session.tenantId !== tenantId) {
    return null;
  }

  if (workspaceId && session.workspaceId !== workspaceId) {
    return null;
  }

  const refreshed = refreshSessionLifetime(config, session);
  updateSession(store, refreshed);
  saveSessionStore(config, store);
  recordSessionContext(config, refreshed);
  return refreshed;
}

export function reconnectSession(config, sessionId, reconnectToken) {
  const id = String(sessionId || '').trim();
  const token = String(reconnectToken || '').trim();
  if (!id || !token) {
    throw new Error('sessionId and reconnectToken are required.');
  }

  const store = pruneExpired(loadSessionStore(config));
  const session = getSessionById(store, id);
  if (!session || session.reconnectToken !== token) {
    throw new Error('Invalid session reconnect credentials.');
  }

  const rotated = refreshSessionLifetime(config, {
    ...session,
    accessToken: randomToken()
  });
  updateSession(store, rotated);
  saveSessionStore(config, store);
  recordSessionContext(config, session);
  publishRuntimeEvent(config, {
    action: 'runtime.session_context',
    workspaceId: session.workspaceId,
    tenantId: session.tenantId,
    lane: 'shell',
    actorType: 'client',
    actorId: session.clientName,
    detail: {
      sessionId: session.id,
      authSource: session.authSource,
      mode: 'open'
    }
  });
  appendAuditEvent(config, {
    action: 'session.reconnect',
    workspaceId: rotated.workspaceId,
    tenantId: rotated.tenantId,
    sessionId: rotated.id,
    actorType: 'client',
    actorId: rotated.clientName
  });
  return rotated;
}

export function heartbeatSession(config, sessionId, accessToken) {
  const id = String(sessionId || '').trim();
  const token = String(accessToken || '').trim();
  if (!id || !token) {
    throw new Error('sessionId and accessToken are required.');
  }

  const store = pruneExpired(loadSessionStore(config));
  const session = getSessionById(store, id);
  if (!session || session.accessToken !== token) {
    throw new Error('Invalid session heartbeat credentials.');
  }

  const refreshed = refreshSessionLifetime(config, session);
  updateSession(store, refreshed);
  saveSessionStore(config, store);
  recordSessionContext(config, session);
  publishRuntimeEvent(config, {
    action: 'runtime.session_context',
    workspaceId: session.workspaceId,
    tenantId: session.tenantId,
    lane: 'shell',
    actorType: 'client',
    actorId: session.clientName,
    detail: {
      sessionId: session.id,
      authSource: session.authSource,
      mode: 'open'
    }
  });
  appendAuditEvent(config, {
    action: 'session.heartbeat',
    workspaceId: refreshed.workspaceId,
    tenantId: refreshed.tenantId,
    sessionId: refreshed.id,
    actorType: 'client',
    actorId: refreshed.clientName
  });
  return refreshed;
}

export function closeSession(config, sessionId, accessToken = null) {
  const id = String(sessionId || '').trim();
  if (!id) {
    throw new Error('sessionId is required.');
  }

  const token = accessToken === null ? null : String(accessToken || '').trim();
  const store = pruneExpired(loadSessionStore(config));
  const session = getSessionById(store, id);
  if (!session) {
    return {
      closed: false,
      reason: 'session_not_found'
    };
  }

  if (token && session.accessToken !== token) {
    throw new Error('Invalid session close credentials.');
  }

  store.sessions = store.sessions.filter(item => item.id !== id);
  providerUnlockCache.delete(id);
  saveSessionStore(config, store);
  recordSessionContext(config, session);
  publishRuntimeEvent(config, {
    action: 'runtime.session_context',
    workspaceId: session.workspaceId,
    tenantId: session.tenantId,
    lane: 'shell',
    actorType: 'client',
    actorId: session.clientName,
    detail: {
      sessionId: session.id,
      authSource: session.authSource,
      mode: 'open'
    }
  });
  appendAuditEvent(config, {
    action: 'session.close',
    workspaceId: session.workspaceId,
    tenantId: session.tenantId,
    sessionId: session.id,
    actorType: 'client',
    actorId: session.clientName
  });
  return {
    closed: true,
    sessionId: id
  };
}


export function revokeSessions(config, options = {}) {
  const tenantId = options.tenantId ? normalizeTenantId(options.tenantId) : null;
  const workspaceId = String(options.workspaceId || '').trim() || null;
  const actorType = String(options.actorType || 'admin').trim() || 'admin';
  const actorId = String(options.actorId || 'session-revoke').trim() || 'session-revoke';
  const store = pruneExpired(loadSessionStore(config));
  const removedSessions = [];
  store.sessions = store.sessions.filter(session => {
    if (tenantId && session.tenantId !== tenantId) return true;
    if (workspaceId && session.workspaceId !== workspaceId) return true;
    removedSessions.push(session);
    providerUnlockCache.delete(session.id);
    return false;
  });
  saveSessionStore(config, store);
  appendAuditEvent(config, {
    action: 'session.revoke_all',
    actorType,
    actorId,
    tenantId: tenantId || null,
    workspaceId,
    detail: {
      revoked: removedSessions.length,
      sessionIds: removedSessions.map(session => session.id),
      workspaceIds: [...new Set(removedSessions.map(session => session.workspaceId).filter(Boolean))]
    }
  });
  return {
    ok: true,
    revoked: removedSessions.length,
    tenantId,
    workspaceId,
    sessions: removedSessions.map(session => ({ id: session.id, tenantId: session.tenantId, workspaceId: session.workspaceId, clientName: session.clientName }))
  };
}

export function restoreSession(config, sessionId, reconnectToken, options = {}) {
  const restored = reconnectSession(config, sessionId, reconnectToken);
  appendAuditEvent(config, {
    action: 'session.restore',
    workspaceId: restored.workspaceId,
    tenantId: restored.tenantId,
    sessionId: restored.id,
    actorType: String(options.actorType || 'admin').trim() || 'admin',
    actorId: String(options.actorId || restored.clientName).trim() || restored.clientName,
    detail: {
      reason: String(options.reason || '').trim() || null
    }
  });
  return restored;
}
