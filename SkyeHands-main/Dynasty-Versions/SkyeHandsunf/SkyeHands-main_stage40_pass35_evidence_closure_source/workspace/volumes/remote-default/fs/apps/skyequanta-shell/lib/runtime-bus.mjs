import fs from 'node:fs';
import path from 'node:path';

import { redactProviderPayload } from './provider-redaction.mjs';

const MAX_RECENT_FILE_OPERATIONS = 25;
const MAX_RECENT_PREVIEW_EVENTS = 25;
const MAX_RECENT_MESSAGES = 25;

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

function trimRecent(entries, maxEntries) {
  return Array.isArray(entries) ? entries.slice(0, maxEntries) : [];
}

function normalizeLane(lane) {
  const normalized = String(lane || '').trim().toLowerCase();
  if (['ide', 'agent', 'preview', 'shell', 'system'].includes(normalized)) {
    return normalized;
  }

  return 'system';
}

function busRootDir(config) {
  return path.join(config.rootDir, '.skyequanta', 'runtime-bus');
}

function projectionsDir(config) {
  return path.join(busRootDir(config), 'workspaces');
}

function eventsFile(config) {
  return path.join(busRootDir(config), 'events.ndjson');
}

function workspaceProjectionFile(config, workspaceId) {
  return path.join(projectionsDir(config), `${workspaceId}.json`);
}

function emptyProjection(workspaceId = null) {
  return {
    version: 1,
    workspaceId: workspaceId || null,
    tenantId: null,
    updatedAt: nowIso(),
    canonicalAuthority: {
      shellOwned: true,
      authoritativeLayer: 'apps/skyequanta-shell',
      authoritativeBridge: 'apps/skyequanta-shell/lib/bridge.mjs',
      authoritativeWorkspaceManager: 'apps/skyequanta-shell/lib/workspace-manager.mjs',
      authoritativeSessionManager: 'apps/skyequanta-shell/lib/session-manager.mjs',
      authoritativeRuntimeBus: 'apps/skyequanta-shell/lib/runtime-bus.mjs',
      importedExamplesAreAuthoritative: false
    },
    workspaceContext: {
      id: workspaceId || null,
      name: null,
      status: null,
      source: null,
      selected: false,
      routes: {},
      metadata: {}
    },
    sessionContext: {
      active: false,
      sessionId: null,
      tenantId: null,
      clientName: null,
      authSource: null,
      gateSessionId: null,
      gateAppId: null,
      gateOrgId: null,
      gateAuthMode: null,
      founderGateway: false,
      lastSeenAt: null,
      expiresAt: null
    },
    lanes: {
      ide: { lastSeenAt: null, lastPath: null, health: null },
      agent: { lastSeenAt: null, lastPath: null, health: null },
      preview: { lastSeenAt: null, lastPath: null, health: null },
      shell: { lastSeenAt: null, lastPath: null, health: null }
    },
    previewState: {
      active: false,
      lane: null,
      lastSeenAt: null,
      port: null,
      publicPath: null,
      publicUrl: null,
      status: null,
      detail: null
    },
    recentFileOperations: [],
    recentPreviewEvents: [],
    recentMessages: [],
    lastHealth: null
  };
}

function loadProjection(config, workspaceId) {
  return readJson(workspaceProjectionFile(config, workspaceId), emptyProjection(workspaceId));
}

function saveProjection(config, workspaceId, projection) {
  const next = {
    ...projection,
    workspaceId,
    updatedAt: nowIso()
  };
  writeJson(workspaceProjectionFile(config, workspaceId), next);
  return next;
}

export function getRuntimeBusPaths(config, workspaceId = null) {
  return {
    rootDir: busRootDir(config),
    eventsFile: eventsFile(config),
    projectionsDir: projectionsDir(config),
    workspaceProjectionFile: workspaceId ? workspaceProjectionFile(config, workspaceId) : null
  };
}

export function publishRuntimeEvent(config, event = {}) {
  const record = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    at: nowIso(),
    action: String(event.action || 'runtime.event').trim() || 'runtime.event',
    workspaceId: event.workspaceId ? String(event.workspaceId).trim() : null,
    tenantId: event.tenantId ? String(event.tenantId).trim().toLowerCase() : null,
    lane: normalizeLane(event.lane),
    actorType: String(event.actorType || 'system').trim() || 'system',
    actorId: String(event.actorId || 'system').trim() || 'system',
    detail: event.detail && typeof event.detail === 'object' ? redactProviderPayload(event.detail) : null
  };

  const paths = getRuntimeBusPaths(config);
  ensureDirectory(paths.rootDir);
  fs.appendFileSync(paths.eventsFile, `${JSON.stringify(record)}\n`, 'utf8');
  return record;
}

export function listRuntimeEvents(config, options = {}) {
  const paths = getRuntimeBusPaths(config);
  if (!fs.existsSync(paths.eventsFile)) {
    return [];
  }

  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 50;
  const workspaceId = options.workspaceId ? String(options.workspaceId).trim() : null;
  const lane = options.lane ? normalizeLane(options.lane) : null;
  const lines = fs.readFileSync(paths.eventsFile, 'utf8').split(/\r?\n/).filter(Boolean);
  const events = [];
  for (let index = lines.length - 1; index >= 0 && events.length < limit; index -= 1) {
    try {
      const parsed = JSON.parse(lines[index]);
      if (workspaceId && parsed.workspaceId !== workspaceId) {
        continue;
      }
      if (lane && parsed.lane !== lane) {
        continue;
      }
      events.push(parsed);
    } catch {
      // ignore malformed historical lines
    }
  }

  return events;
}

export function ensureWorkspaceRuntimeProjection(config, workspaceId) {
  const projection = loadProjection(config, workspaceId);
  return saveProjection(config, workspaceId, projection);
}

export function recordWorkspaceContext(config, workspace, options = {}) {
  const workspaceId = String(workspace?.id || options.workspaceId || '').trim();
  if (!workspaceId) {
    throw new Error('workspaceId is required to record workspace context.');
  }

  const current = loadProjection(config, workspaceId);
  const next = {
    ...current,
    tenantId: String(workspace?.metadata?.tenantId || current.tenantId || '').trim().toLowerCase() || current.tenantId || null,
    workspaceContext: {
      ...(current.workspaceContext || {}),
      id: workspaceId,
      name: workspace?.name || current.workspaceContext?.name || workspaceId,
      status: workspace?.status || current.workspaceContext?.status || null,
      source: workspace?.source || current.workspaceContext?.source || null,
      selected: options.selected === undefined ? current.workspaceContext?.selected || false : Boolean(options.selected),
      routes: {
        ...(current.workspaceContext?.routes || {}),
        ...(workspace?.routes || {})
      },
      metadata: {
        ...(current.workspaceContext?.metadata || {}),
        ...(workspace?.metadata || {})
      }
    }
  };

  return saveProjection(config, workspaceId, next);
}

export function recordSessionContext(config, sessionOrAccess, options = {}) {
  const session = sessionOrAccess && sessionOrAccess.session ? sessionOrAccess.session : sessionOrAccess;
  const workspaceId = String(session?.workspaceId || options.workspaceId || '').trim();
  if (!workspaceId) {
    throw new Error('workspaceId is required to record session context.');
  }

  const current = loadProjection(config, workspaceId);
  const next = {
    ...current,
    tenantId: String(session?.tenantId || current.tenantId || '').trim().toLowerCase() || current.tenantId || null,
    sessionContext: {
      ...(current.sessionContext || {}),
      active: options.active === undefined ? Boolean(session) : Boolean(options.active),
      sessionId: session?.id || current.sessionContext?.sessionId || null,
      tenantId: session?.tenantId || current.sessionContext?.tenantId || null,
      clientName: session?.clientName || current.sessionContext?.clientName || null,
      authSource: session?.authSource || current.sessionContext?.authSource || null,
      gateSessionId: session?.gateSessionId || current.sessionContext?.gateSessionId || null,
      gateAppId: session?.gateAppId || current.sessionContext?.gateAppId || null,
      gateOrgId: session?.gateOrgId || current.sessionContext?.gateOrgId || null,
      gateAuthMode: session?.gateAuthMode || current.sessionContext?.gateAuthMode || null,
      founderGateway: Boolean(session?.founderGateway || current.sessionContext?.founderGateway),
      lastSeenAt: session?.lastSeenAt || current.sessionContext?.lastSeenAt || null,
      expiresAt: session?.expiresAt || current.sessionContext?.expiresAt || null
    }
  };

  return saveProjection(config, workspaceId, next);
}

export function recordLaneHealth(config, options = {}) {
  const workspaceId = String(options.workspaceId || '').trim();
  if (!workspaceId) {
    throw new Error('workspaceId is required to record lane health.');
  }

  const lane = normalizeLane(options.lane);
  const current = loadProjection(config, workspaceId);
  const laneState = {
    ...(current.lanes?.[lane] || {}),
    lastSeenAt: nowIso(),
    lastPath: options.path || current.lanes?.[lane]?.lastPath || null,
    health: options.health || current.lanes?.[lane]?.health || null
  };

  const next = {
    ...current,
    lanes: {
      ...(current.lanes || {}),
      [lane]: laneState
    },
    lastHealth: options.combinedHealth
      ? options.combinedHealth
      : current.lastHealth
  };

  return saveProjection(config, workspaceId, next);
}

export function recordCombinedRuntimeHealth(config, workspaceId, payload) {
  const current = loadProjection(config, workspaceId);
  const next = {
    ...current,
    lastHealth: {
      ...(payload || {}),
      checkedAt: nowIso()
    }
  };
  return saveProjection(config, workspaceId, next);
}

export function recordFileOperation(config, options = {}) {
  const workspaceId = String(options.workspaceId || '').trim();
  if (!workspaceId) {
    throw new Error('workspaceId is required to record file operations.');
  }

  const lane = normalizeLane(options.lane);
  const entry = {
    at: nowIso(),
    lane,
    operation: String(options.operation || 'unknown').trim() || 'unknown',
    path: String(options.path || '').trim() || null,
    status: String(options.status || 'observed').trim() || 'observed',
    detail: options.detail && typeof options.detail === 'object' ? options.detail : null,
    sessionId: String(options.sessionId || '').trim() || null,
    tenantId: String(options.tenantId || '').trim().toLowerCase() || null
  };

  const current = loadProjection(config, workspaceId);
  const next = {
    ...current,
    recentFileOperations: trimRecent([entry, ...(current.recentFileOperations || [])], MAX_RECENT_FILE_OPERATIONS),
    lanes: {
      ...(current.lanes || {}),
      [lane]: {
        ...(current.lanes?.[lane] || {}),
        lastSeenAt: entry.at,
        lastPath: entry.path
      }
    }
  };

  saveProjection(config, workspaceId, next);
  publishRuntimeEvent(config, {
    action: 'runtime.file_operation',
    workspaceId,
    tenantId: entry.tenantId,
    lane,
    actorType: 'system',
    actorId: 'runtime-bus',
    detail: entry
  });
  return entry;
}

export function recordPreviewState(config, options = {}) {
  const workspaceId = String(options.workspaceId || '').trim();
  if (!workspaceId) {
    throw new Error('workspaceId is required to record preview state.');
  }

  const lane = normalizeLane(options.lane || 'preview');
  const event = {
    at: nowIso(),
    lane,
    port: options.port === undefined ? null : Number.parseInt(String(options.port), 10) || null,
    publicPath: String(options.publicPath || '').trim() || null,
    publicUrl: String(options.publicUrl || '').trim() || null,
    status: String(options.status || 'observed').trim() || 'observed',
    detail: options.detail && typeof options.detail === 'object' ? options.detail : null
  };

  const current = loadProjection(config, workspaceId);
  const next = {
    ...current,
    previewState: {
      active: true,
      ...event,
      lastSeenAt: event.at
    },
    recentPreviewEvents: trimRecent([event, ...(current.recentPreviewEvents || [])], MAX_RECENT_PREVIEW_EVENTS),
    lanes: {
      ...(current.lanes || {}),
      preview: {
        ...(current.lanes?.preview || {}),
        lastSeenAt: event.at,
        lastPath: event.publicPath || current.lanes?.preview?.lastPath || null,
        health: event.status
      }
    }
  };

  saveProjection(config, workspaceId, next);
  publishRuntimeEvent(config, {
    action: 'runtime.preview_state',
    workspaceId,
    tenantId: current.tenantId,
    lane,
    actorType: 'system',
    actorId: 'runtime-bus',
    detail: event
  });
  return event;
}

export function recordRuntimeMessage(config, options = {}) {
  const workspaceId = String(options.workspaceId || '').trim();
  if (!workspaceId) {
    throw new Error('workspaceId is required to record runtime messages.');
  }

  const lane = normalizeLane(options.lane || 'shell');
  const entry = {
    at: nowIso(),
    lane,
    channel: String(options.channel || 'runtime-bus').trim() || 'runtime-bus',
    type: String(options.type || 'message').trim() || 'message',
    payload: options.payload && typeof options.payload === 'object' ? redactProviderPayload(options.payload) : {}
  };

  const current = loadProjection(config, workspaceId);
  const next = {
    ...current,
    recentMessages: trimRecent([entry, ...(current.recentMessages || [])], MAX_RECENT_MESSAGES),
    lanes: {
      ...(current.lanes || {}),
      [lane]: {
        ...(current.lanes?.[lane] || {}),
        lastSeenAt: entry.at
      }
    }
  };

  saveProjection(config, workspaceId, next);
  publishRuntimeEvent(config, {
    action: 'runtime.message',
    workspaceId,
    tenantId: current.tenantId,
    lane,
    actorType: 'system',
    actorId: 'runtime-bus',
    detail: entry
  });
  return entry;
}

export function getWorkspaceRuntimeProjection(config, workspaceId) {
  const id = String(workspaceId || '').trim();
  if (!id) {
    return null;
  }

  return loadProjection(config, id);
}
