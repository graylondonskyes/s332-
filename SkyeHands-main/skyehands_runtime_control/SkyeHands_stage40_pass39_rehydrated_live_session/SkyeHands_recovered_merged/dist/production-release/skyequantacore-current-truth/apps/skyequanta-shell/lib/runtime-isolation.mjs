import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function readString(value) {
  return String(value ?? '').trim();
}

function readInteger(value, fallback) {
  const parsed = Number.parseInt(readString(value), 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function readBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  const normalized = readString(value).toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function uniq(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function isPosix() {
  return process.platform !== 'win32' && typeof process.getuid === 'function' && typeof process.getgid === 'function';
}

function isRootProcess() {
  return isPosix() && process.getuid() === 0;
}

function hashWorkspaceId(workspaceId) {
  const digest = crypto.createHash('sha256').update(readString(workspaceId)).digest();
  return digest.readUInt32BE(0);
}

function normalizeMode(rawMode) {
  const normalized = readString(rawMode).toLowerCase();
  if (!normalized) return 'auto';
  if (['auto', 'process', 'os-user', 'none'].includes(normalized)) return normalized;
  return 'auto';
}

export function getRuntimeIsolationPolicy(env = process.env) {
  return {
    requestedMode: normalizeMode(env.SKYEQUANTA_RUNTIME_ISOLATION_MODE),
    strict: readBoolean(env.SKYEQUANTA_RUNTIME_ISOLATION_STRICT, false),
    baseUid: readInteger(env.SKYEQUANTA_RUNTIME_ISOLATION_BASE_UID, 61000),
    baseGid: readInteger(env.SKYEQUANTA_RUNTIME_ISOLATION_BASE_GID, 61000),
    rangeSize: Math.max(256, readInteger(env.SKYEQUANTA_RUNTIME_ISOLATION_RANGE_SIZE, 4000)),
    recursiveChown: readBoolean(env.SKYEQUANTA_RUNTIME_ISOLATION_RECURSIVE_CHOWN, true)
  };
}

function resolveEffectiveMode(policy) {
  if (policy.requestedMode === 'none') return 'none';
  if (policy.requestedMode === 'process') return 'process';
  if (policy.requestedMode === 'os-user') return 'os-user';
  if (isRootProcess()) return 'os-user';
  return 'process';
}

function workspaceUid(policy, workspaceId) {
  return policy.baseUid + (hashWorkspaceId(workspaceId) % policy.rangeSize);
}

function workspaceGid(policy, workspaceId) {
  return policy.baseGid + (hashWorkspaceId(`${workspaceId}:gid`) % policy.rangeSize);
}

function ensureDirectory(dirPath) {
  if (!dirPath) return;
  fs.mkdirSync(dirPath, { recursive: true });
}

function chownRecursive(targetPath, uid, gid) {
  if (!targetPath || !fs.existsSync(targetPath)) return;
  const stat = fs.lstatSync(targetPath);
  if (stat.isSymbolicLink()) return;
  fs.chownSync(targetPath, uid, gid);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(targetPath)) {
      chownRecursive(path.join(targetPath, entry), uid, gid);
    }
  }
}

function chmodWritable(targetPath) {
  if (!targetPath || !fs.existsSync(targetPath)) return;
  const stat = fs.lstatSync(targetPath);
  if (stat.isSymbolicLink()) return;
  if (stat.isDirectory()) {
    fs.chmodSync(targetPath, 0o750);
    for (const entry of fs.readdirSync(targetPath)) {
      chmodWritable(path.join(targetPath, entry));
    }
  } else {
    fs.chmodSync(targetPath, (stat.mode & 0o777) | 0o600);
  }
}

function collectSandboxPaths(paths = {}) {
  return uniq([
    paths.instanceDir,
    paths.rootDir,
    paths.fsDir,
    paths.homeDir,
    paths.runtimeDir,
    paths.logsDir,
    paths.configDir,
    paths.volumeDir,
    paths.retentionDir,
    paths.secretStoreDir,
    paths.prebuildDir
  ].filter(Boolean));
}

export function buildWorkspaceIsolation(config, workspaceId, paths = {}, env = process.env) {
  const policy = getRuntimeIsolationPolicy(env);
  const effectiveMode = resolveEffectiveMode(policy);
  const supported = effectiveMode !== 'os-user' || isRootProcess();
  const uid = effectiveMode === 'os-user' ? workspaceUid(policy, workspaceId) : null;
  const gid = effectiveMode === 'os-user' ? workspaceGid(policy, workspaceId) : null;
  if (!supported && policy.strict) {
    throw new Error(`Workspace isolation strict mode failed for '${workspaceId}': os-user isolation requires root on POSIX.`);
  }
  return {
    workspaceId: readString(workspaceId),
    requestedMode: policy.requestedMode,
    mode: supported ? effectiveMode : 'process',
    strict: policy.strict,
    supported,
    uid,
    gid,
    recursiveChown: policy.recursiveChown,
    sandboxPaths: collectSandboxPaths(paths),
    prepared: false,
    preparedAt: null
  };
}

export function prepareWorkspaceIsolation(isolation, paths = {}) {
  const next = { ...(isolation || {}) };
  if (next.mode !== 'os-user') {
    next.prepared = true;
    next.preparedAt = new Date().toISOString();
    return next;
  }
  if (!isRootProcess()) {
    if (next.strict) {
      throw new Error(`Workspace isolation strict mode failed for '${next.workspaceId}': root privileges are required.`);
    }
    next.mode = 'process';
    next.uid = null;
    next.gid = null;
    next.prepared = true;
    next.preparedAt = new Date().toISOString();
    return next;
  }
  for (const targetPath of collectSandboxPaths(paths)) {
    ensureDirectory(targetPath);
    if (next.recursiveChown) chownRecursive(targetPath, next.uid, next.gid);
    else fs.chownSync(targetPath, next.uid, next.gid);
    chmodWritable(targetPath);
  }
  next.prepared = true;
  next.preparedAt = new Date().toISOString();
  return next;
}

export function applyWorkspaceIsolationEnv(baseEnv = {}, isolation = {}) {
  return {
    ...baseEnv,
    SKYEQUANTA_RUNTIME_ISOLATION_EFFECTIVE_MODE: readString(isolation.mode) || 'process',
    SKYEQUANTA_RUNTIME_ISOLATION_REQUESTED_MODE: readString(isolation.requestedMode) || 'auto',
    SKYEQUANTA_RUNTIME_ISOLATION_WORKSPACE_UID: Number.isInteger(isolation.uid) ? String(isolation.uid) : '',
    SKYEQUANTA_RUNTIME_ISOLATION_WORKSPACE_GID: Number.isInteger(isolation.gid) ? String(isolation.gid) : '',
    SKYEQUANTA_RUNTIME_ISOLATION_SUPPORTED: isolation.supported ? '1' : '0'
  };
}

export function getSpawnIsolationOptions(isolation = {}) {
  if (isolation.mode !== 'os-user' || !Number.isInteger(isolation.uid) || !Number.isInteger(isolation.gid)) {
    return {};
  }
  return { uid: isolation.uid, gid: isolation.gid };
}

export function readLinuxProcessIdentity(pid) {
  const normalizedPid = Number.parseInt(String(pid || ''), 10);
  if (!Number.isInteger(normalizedPid) || normalizedPid <= 0) return null;
  const statusPath = `/proc/${normalizedPid}/status`;
  if (!fs.existsSync(statusPath)) return null;
  const text = fs.readFileSync(statusPath, 'utf8');
  const line = prefix => (text.split(/\r?\n/).find(item => item.startsWith(prefix)) || '').split(/\s+/).slice(1).map(v => Number.parseInt(v, 10)).filter(Number.isInteger);
  const uids = line('Uid:');
  const gids = line('Gid:');
  return { pid: normalizedPid, uidReal: uids[0] ?? null, uidEffective: uids[1] ?? null, gidReal: gids[0] ?? null, gidEffective: gids[1] ?? null };
}

export function runIsolatedCommand(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: options.encoding || 'utf8',
    uid: options.isolation?.mode === 'os-user' ? options.isolation.uid : undefined,
    gid: options.isolation?.mode === 'os-user' ? options.isolation.gid : undefined,
    maxBuffer: options.maxBuffer || 8 * 1024 * 1024
  });
  return {
    ok: result.status === 0,
    status: result.status,
    signal: result.signal,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || '')
  };
}
