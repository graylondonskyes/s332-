import fs from 'node:fs';
import path from 'node:path';

import { loadWorkspaceRegistry } from './workspace-registry.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function readJson(filePath, fallback = null) {
  if (!filePath || !fs.existsSync(filePath)) return fallback;
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

function isPidRunning(pid) {
  const normalized = Number.parseInt(String(pid ?? ''), 10);
  if (!Number.isInteger(normalized) || normalized <= 0) return false;
  try {
    process.kill(normalized, 0);
    return true;
  } catch {
    return false;
  }
}

function readNumber(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function recoveryRoot(config) {
  return path.join(config.rootDir, '.skyequanta', 'runtime-recovery');
}

function runtimeRoot(config) {
  return path.join(config.rootDir, '.skyequanta', 'workspace-runtime');
}

function workspaceRuntimeDir(config, workspaceId) {
  return path.join(runtimeRoot(config), String(workspaceId || '').trim());
}

function workspaceStateFile(config, workspaceId) {
  return path.join(workspaceRuntimeDir(config, workspaceId), 'state.json');
}

function startupLockFile(config, workspaceId) {
  return path.join(workspaceRuntimeDir(config, workspaceId), 'startup.lock.json');
}

function journalFile(config) {
  return path.join(recoveryRoot(config), 'journal.ndjson');
}

function timingFile(config) {
  return path.join(recoveryRoot(config), 'timing.json');
}

function loadLock(lockFile) {
  return readJson(lockFile, null);
}

function lockAgeMs(lock) {
  const acquired = Date.parse(String(lock?.acquiredAt || ''));
  if (!Number.isFinite(acquired)) return Number.POSITIVE_INFINITY;
  return Date.now() - acquired;
}

export function appendRecoveryJournal(config, event = {}) {
  const entry = {
    timestamp: nowIso(),
    action: String(event.action || 'runtime_recovery_event').trim() || 'runtime_recovery_event',
    workspaceId: String(event.workspaceId || '').trim() || null,
    detail: event.detail && typeof event.detail === 'object' ? event.detail : {},
    actorType: String(event.actorType || 'system').trim() || 'system',
    actorId: String(event.actorId || 'runtime-recovery').trim() || 'runtime-recovery'
  };
  const target = journalFile(config);
  ensureDirectory(path.dirname(target));
  fs.appendFileSync(target, `${JSON.stringify(entry)}\n`, 'utf8');
  return entry;
}

export function readRecoveryJournal(config, options = {}) {
  const target = journalFile(config);
  if (!fs.existsSync(target)) return [];
  const limit = Math.max(1, readNumber(options.limit, 200));
  const lines = fs.readFileSync(target, 'utf8').split(/\r?\n/).filter(Boolean);
  return lines.slice(-limit).map(line => {
    try { return JSON.parse(line); } catch { return { action: 'invalid_journal_line', raw: line }; }
  });
}

export function acquireStartupLock(config, workspaceId, options = {}) {
  const normalizedWorkspaceId = String(workspaceId || '').trim();
  if (!normalizedWorkspaceId) throw new Error('workspaceId is required to acquire a startup lock.');
  const target = startupLockFile(config, normalizedWorkspaceId);
  const pid = readNumber(options.pid, process.pid);
  const ttlMs = Math.max(1000, readNumber(options.ttlMs, 10 * 60 * 1000));
  const existing = loadLock(target);
  let staleReplaced = false;
  let previousLock = null;

  if (existing) {
    const active = isPidRunning(existing.pid) && lockAgeMs(existing) <= ttlMs;
    if (active) {
      return {
        ok: false,
        acquired: false,
        reason: 'active_lock',
        workspaceId: normalizedWorkspaceId,
        lockFile: target,
        lock: existing
      };
    }
    previousLock = existing;
    staleReplaced = true;
    fs.rmSync(target, { force: true });
  }

  const next = {
    version: 1,
    workspaceId: normalizedWorkspaceId,
    pid,
    acquiredAt: nowIso(),
    holder: String(options.holder || 'runtime-provisioner').trim() || 'runtime-provisioner',
    ttlMs
  };
  writeJson(target, next);
  appendRecoveryJournal(config, {
    action: staleReplaced ? 'startup_lock_replaced' : 'startup_lock_acquired',
    workspaceId: normalizedWorkspaceId,
    detail: { pid, ttlMs, staleReplaced, previousLock }
  });
  return {
    ok: true,
    acquired: true,
    staleReplaced,
    workspaceId: normalizedWorkspaceId,
    lockFile: target,
    lock: next
  };
}

export function releaseStartupLock(config, workspaceId, options = {}) {
  const normalizedWorkspaceId = String(workspaceId || '').trim();
  const target = startupLockFile(config, normalizedWorkspaceId);
  const existing = loadLock(target);
  if (!existing) {
    return { ok: true, released: false, workspaceId: normalizedWorkspaceId, reason: 'lock_missing', lockFile: target };
  }
  fs.rmSync(target, { force: true });
  appendRecoveryJournal(config, {
    action: 'startup_lock_released',
    workspaceId: normalizedWorkspaceId,
    detail: { holder: options.holder || 'runtime-provisioner', priorPid: existing.pid }
  });
  return { ok: true, released: true, workspaceId: normalizedWorkspaceId, lockFile: target, lock: existing };
}

function scanRuntimeStates(config) {
  const root = runtimeRoot(config);
  if (!fs.existsSync(root)) return [];
  const bucket = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const workspaceId = entry.name;
    const statePath = workspaceStateFile(config, workspaceId);
    const lockPath = startupLockFile(config, workspaceId);
    bucket.push({ workspaceId, statePath, lockPath, state: readJson(statePath, null), lock: loadLock(lockPath) });
  }
  return bucket;
}

function normalizeRecoveryStatus(state) {
  const ideAlive = isPidRunning(state?.processes?.idePid);
  const agentAlive = isPidRunning(state?.processes?.agentPid);
  const runningCount = [ideAlive, agentAlive].filter(Boolean).length;
  return {
    ideAlive,
    agentAlive,
    runningCount,
    status: runningCount === 2 ? 'running' : (runningCount === 1 ? 'partial' : 'stopped')
  };
}

export function reconcileWorkspaceRuntime(config, workspaceId, options = {}) {
  const normalizedWorkspaceId = String(workspaceId || '').trim();
  if (!normalizedWorkspaceId) throw new Error('workspaceId is required to reconcile runtime state.');
  const statePath = workspaceStateFile(config, normalizedWorkspaceId);
  const existing = readJson(statePath, null);
  if (!existing) {
    return { ok: false, reconciled: false, workspaceId: normalizedWorkspaceId, reason: 'state_missing', statePath };
  }
  const lockPath = startupLockFile(config, normalizedWorkspaceId);
  const currentLock = loadLock(lockPath);
  const lockTtlMs = Math.max(1000, readNumber(options.lockTtlMs, 10 * 60 * 1000));
  const runtime = normalizeRecoveryStatus(existing);
  const next = {
    ...existing,
    updatedAt: nowIso(),
    recovery: {
      ...(existing.recovery || {}),
      lastReconciledAt: nowIso(),
      ideAlive: runtime.ideAlive,
      agentAlive: runtime.agentAlive,
      status: runtime.status,
      reason: runtime.status === 'partial' ? 'partial_process_survival' : (runtime.status === 'stopped' ? 'no_runtime_processes_alive' : 'healthy')
    },
    processes: {
      ...(existing.processes || {}),
      idePid: runtime.ideAlive ? existing?.processes?.idePid ?? null : null,
      agentPid: runtime.agentAlive ? existing?.processes?.agentPid ?? null : null
    }
  };
  if (currentLock && (!isPidRunning(currentLock.pid) || lockAgeMs(currentLock) > lockTtlMs || runtime.status !== 'running')) {
    fs.rmSync(lockPath, { force: true });
    next.recovery.clearedStartupLock = true;
  }
  writeJson(statePath, next);
  appendRecoveryJournal(config, {
    action: 'runtime_reconciled',
    workspaceId: normalizedWorkspaceId,
    detail: {
      status: next.recovery.status,
      ideAlive: next.recovery.ideAlive,
      agentAlive: next.recovery.agentAlive,
      clearedStartupLock: Boolean(next.recovery.clearedStartupLock)
    }
  });
  return {
    ok: true,
    reconciled: true,
    workspaceId: normalizedWorkspaceId,
    statePath,
    state: next,
    startupLockCleared: Boolean(next.recovery.clearedStartupLock)
  };
}

export function reconcileAllWorkspaceRuntimes(config, options = {}) {
  const results = scanRuntimeStates(config).map(item => reconcileWorkspaceRuntime(config, item.workspaceId, options));
  return {
    ok: results.every(item => item.ok),
    reconciled: results.length,
    results
  };
}

function terminatePid(pid, signal = 'SIGTERM') {
  const normalized = Number.parseInt(String(pid ?? ''), 10);
  if (!Number.isInteger(normalized) || normalized <= 0) return false;
  try {
    process.kill(normalized, signal);
    return true;
  } catch {
    return false;
  }
}

export function reapOrphanWorkspaceProcesses(config, options = {}) {
  const registry = loadWorkspaceRegistry(config);
  const knownWorkspaces = new Set((registry.workspaces || []).map(item => String(item.id || '').trim()).filter(Boolean));
  const includeUnknownOnly = options.includeUnknownOnly !== false;
  const targets = [];

  for (const item of scanRuntimeStates(config)) {
    const workspaceKnown = knownWorkspaces.has(item.workspaceId);
    if (includeUnknownOnly && workspaceKnown) continue;
    const processes = [
      { role: 'ide', pid: item.state?.processes?.idePid ?? null },
      { role: 'agent', pid: item.state?.processes?.agentPid ?? null }
    ];
    for (const processInfo of processes) {
      if (!isPidRunning(processInfo.pid)) continue;
      terminatePid(processInfo.pid, 'SIGTERM');
      targets.push({ workspaceId: item.workspaceId, role: processInfo.role, pid: processInfo.pid, workspaceKnown });
    }
    const nextState = item.state ? {
      ...item.state,
      updatedAt: nowIso(),
      recovery: {
        ...(item.state.recovery || {}),
        lastReapedAt: nowIso(),
        reason: workspaceKnown ? 'explicit_reap_requested' : 'orphan_workspace_state'
      },
      processes: {
        ...(item.state.processes || {}),
        idePid: null,
        agentPid: null
      }
    } : null;
    if (nextState && targets.some(target => target.workspaceId === item.workspaceId)) {
      writeJson(item.statePath, nextState);
    }
    if (targets.some(target => target.workspaceId === item.workspaceId)) {
      appendRecoveryJournal(config, {
        action: 'runtime_orphan_reaped',
        workspaceId: item.workspaceId,
        detail: { workspaceKnown, processes: targets.filter(target => target.workspaceId === item.workspaceId) }
      });
    }
  }

  return {
    ok: true,
    reapedCount: targets.length,
    processes: targets
  };
}

export async function measureRecoveryOperation(config, label, runner) {
  const startedAt = Date.now();
  const result = await runner();
  const elapsedMs = Date.now() - startedAt;
  const target = timingFile(config);
  const current = readJson(target, { version: 1, generatedAt: nowIso(), timings: [] });
  const next = {
    version: 1,
    generatedAt: current.generatedAt || nowIso(),
    timings: [
      ...(Array.isArray(current.timings) ? current.timings : []),
      { label: String(label || 'recovery_operation'), measuredAt: nowIso(), elapsedMs }
    ]
  };
  writeJson(target, next);
  return { result, elapsedMs, timingFile: target };
}

export function getRecoveryTimingPacket(config) {
  return readJson(timingFile(config), { version: 1, generatedAt: nowIso(), timings: [] });
}
