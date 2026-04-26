import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { getStackConfig } from './config.mjs';
import { applyWorkspaceIsolationEnv, getSpawnIsolationOptions, prepareWorkspaceIsolation } from '../lib/runtime-isolation.mjs';
import { buildRuntimeSandboxLaunch, getRuntimeSandboxPolicy } from '../lib/runtime-sandbox.mjs';
import { printCanonicalRuntimeBanner } from '../lib/canonical-runtime.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

function writeJson(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}


function normalizeRuntimeTable(payload) {
  const workspaces = {};
  if (payload && typeof payload === 'object' && payload.workspaces && typeof payload.workspaces === 'object' && !Array.isArray(payload.workspaces)) {
    Object.assign(workspaces, payload.workspaces);
  }
  if (Array.isArray(payload?.runtimes)) {
    for (const runtime of payload.runtimes) {
      const workspaceId = normalizeWorkspaceId(runtime?.workspaceId);
      if (workspaceId) {
        workspaces[workspaceId] = {
          ...(runtime || {}),
          workspaceId
        };
      }
    }
  }
  return {
    version: Number.parseInt(String(payload?.version || '1'), 10) || 1,
    workspaces
  };
}

function appendJsonLine(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.appendFileSync(filePath, `${JSON.stringify(payload)}\n`, 'utf8');
}

function isPidRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function terminatePid(pid, signal = 'SIGTERM') {
  if (!Number.isInteger(pid) || pid <= 0) return;
  try { process.kill(pid, signal); } catch {}
}

function resetLogFile(filePath) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, '', 'utf8');
}

function spawnDetachedProcess(command, args, options) {
  const sandbox = buildRuntimeSandboxLaunch(command, args, {
    env: { ...(options.env || process.env), ...(sandbox.envAdditions || {}) },
    cwd: options.cwd,
    rootDir: options.rootDir,
    workspaceId: options.workspaceId,
    label: options.label,
    policy: options.sandboxPolicy
  });
  const outFd = fs.openSync(options.logFile, 'a');
  const child = spawn(sandbox.command, sandbox.args, {
    cwd: sandbox.cwd || options.cwd,
    detached: true,
    stdio: ['ignore', outFd, outFd],
    env: { ...(options.env || process.env), ...(sandbox.envAdditions || {}) },
    ...getSpawnIsolationOptions(options.isolation)
  });
  child.unref();
  fs.closeSync(outFd);
  return { pid: child.pid, sandbox };
}

function parseArgs(argv) {
  const options = {
    command: argv[0] || 'daemon',
    host: '127.0.0.1',
    port: 3320,
    stateDir: null,
    workspaceId: null,
    json: false,
    removeStale: false,
    killOrphans: true,
    pruneExpired: true
  };
  for (let i = 1; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--host') { options.host = argv[++i] || options.host; continue; }
    if (value === '--port') { options.port = Number.parseInt(argv[++i] || String(options.port), 10); continue; }
    if (value === '--state-dir') { options.stateDir = argv[++i] || options.stateDir; continue; }
    if (value === '--workspace' || value === '--workspace-id') { options.workspaceId = argv[++i] || options.workspaceId; continue; }
    if (value === '--json') { options.json = true; continue; }
    if (value === '--remove-stale') { options.removeStale = true; continue; }
    if (value === '--no-remove-stale') { options.removeStale = false; continue; }
    if (value === '--no-kill-orphans') { options.killOrphans = false; continue; }
    if (value === '--no-prune-expired') { options.pruneExpired = false; continue; }
  }
  return options;
}

function getPaths(stateDir) {
  return {
    stateDir,
    executorStateFile: path.join(stateDir, 'executor-state.json'),
    runtimesFile: path.join(stateDir, 'workspace-runtimes.json'),
    logFile: path.join(stateDir, 'executor.log')
  };
}

function loadRuntimeTable(paths) {
  return normalizeRuntimeTable(readJson(paths.runtimesFile, { workspaces: {} }));
}

function saveRuntimeTable(paths, payload) {
  writeJson(paths.runtimesFile, normalizeRuntimeTable(payload));
}

function loadExecutorState(paths) {
  return readJson(paths.executorStateFile, null);
}

function saveExecutorState(paths, payload) {
  writeJson(paths.executorStateFile, payload);
}

function computeExpiry(payload) {
  const maxRuntimeAgeMs = Number.parseInt(String(payload?.lifecycle?.maxRuntimeAgeMs || ''), 10);
  if (!Number.isInteger(maxRuntimeAgeMs) || maxRuntimeAgeMs <= 0) {
    return null;
  }
  return new Date(Date.now() + maxRuntimeAgeMs).toISOString();
}

function normalizeWorkspaceId(rawValue) {
  return String(rawValue || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
}

function resolveRepoRoot(paths) {
  return path.resolve(paths.stateDir, '..', '..');
}

function startsWithPath(candidate, expectedRoot) {
  const resolvedCandidate = path.resolve(String(candidate || ''));
  const resolvedRoot = path.resolve(String(expectedRoot || ''));
  return resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`);
}

function assertPathEquals(candidate, expectedRoot, label) {
  const resolvedCandidate = path.resolve(String(candidate || ''));
  const resolvedRoot = path.resolve(String(expectedRoot || ''));
  if (resolvedCandidate !== resolvedRoot) {
    throw new Error(`workspace_isolation_violation:${label}: expected '${resolvedRoot}' but received '${resolvedCandidate}'`);
  }
}

function assertPathWithin(candidate, expectedRoot, label) {
  if (!startsWithPath(candidate, expectedRoot)) {
    throw new Error(`workspace_isolation_violation:${label}: expected path inside '${path.resolve(expectedRoot)}' but received '${path.resolve(String(candidate || ''))}'`);
  }
}

function getExpectedWorkspaceRoots(paths, workspaceId) {
  const repoRoot = resolveRepoRoot(paths);
  return {
    repoRoot,
    instanceDir: path.join(repoRoot, 'workspace', 'instances', workspaceId),
    volumeDir: path.join(repoRoot, 'workspace', 'volumes', workspaceId),
    fsDir: path.join(repoRoot, 'workspace', 'volumes', workspaceId, 'fs'),
    homeDir: path.join(repoRoot, 'workspace', 'volumes', workspaceId, 'home'),
    configDir: path.join(repoRoot, 'workspace', 'volumes', workspaceId, 'config'),
    runtimeDir: path.join(repoRoot, '.skyequanta', 'workspace-runtime', workspaceId),
    logsDir: path.join(repoRoot, '.skyequanta', 'workspace-runtime', workspaceId, 'logs'),
    retentionDir: path.join(repoRoot, 'workspace', 'retention', workspaceId),
    secretStoreDir: path.join(repoRoot, 'workspace', 'secrets', workspaceId),
    prebuildDir: path.join(repoRoot, 'workspace', 'prebuilds', workspaceId)
  };
}

function summarizeWorkspaceRuntime(runtime) {
  const ideAlive = isPidRunning(runtime?.processes?.idePid);
  const agentAlive = isPidRunning(runtime?.processes?.agentPid);
  return {
    workspaceId: runtime?.workspaceId || null,
    workspaceName: runtime?.workspaceName || null,
    startedAt: runtime?.startedAt || null,
    updatedAt: runtime?.updatedAt || null,
    stoppedAt: runtime?.stoppedAt || null,
    idePid: runtime?.processes?.idePid || null,
    agentPid: runtime?.processes?.agentPid || null,
    ideAlive,
    agentAlive,
    running: ideAlive && agentAlive,
    ports: runtime?.ports || null,
    paths: runtime?.paths || null,
    lifecycle: runtime?.lifecycle || null,
    isolation: runtime?.isolation || null,
    logPolicy: runtime?.logPolicy || null,
    cleanup: runtime?.cleanup || null
  };
}

function getWorkspaceLogDir(runtime) {
  return runtime?.paths?.logsDir || path.join(runtime?.paths?.runtimeDir || '', 'logs');
}

function getWorkspaceEventLogFile(runtime) {
  return path.join(getWorkspaceLogDir(runtime), 'activity.ndjson');
}

function getWorkspaceLogPolicyFile(runtime) {
  return path.join(getWorkspaceLogDir(runtime), 'log-retention.json');
}

function getRetentionDays(runtime) {
  const retentionDays = Number.parseInt(String(runtime?.lifecycle?.retentionDays || runtime?.logPolicy?.retentionDays || ''), 10);
  if (!Number.isInteger(retentionDays) || retentionDays <= 0) {
    return 14;
  }
  return retentionDays;
}

function cleanupWorkspaceLogs(runtime) {
  const logsDir = getWorkspaceLogDir(runtime);
  ensureDirectory(logsDir);
  const retentionDays = getRetentionDays(runtime);
  const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const removed = [];
  for (const entry of fs.readdirSync(logsDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const filePath = path.join(logsDir, entry.name);
    const stat = fs.statSync(filePath);
    if (now - stat.mtimeMs > retentionMs) {
      fs.rmSync(filePath, { force: true });
      removed.push(entry.name);
    }
  }
  const policy = {
    retentionDays,
    updatedAt: nowIso(),
    removed,
    logsDir
  };
  writeJson(getWorkspaceLogPolicyFile(runtime), policy);
  runtime.logPolicy = policy;
  return policy;
}

function appendWorkspaceEvent(runtime, event, detail = {}) {
  const logsDir = getWorkspaceLogDir(runtime);
  ensureDirectory(logsDir);
  appendJsonLine(getWorkspaceEventLogFile(runtime), {
    at: nowIso(),
    event,
    workspaceId: runtime.workspaceId,
    detail
  });
  cleanupWorkspaceLogs(runtime);
}

function validateWorkspaceIsolation(paths, payload) {
  const workspaceId = normalizeWorkspaceId(payload.workspaceId);
  if (!workspaceId) {
    throw new Error('workspace_isolation_violation:workspaceId missing or invalid');
  }
  const roots = getExpectedWorkspaceRoots(paths, workspaceId);
  assertPathEquals(payload?.paths?.rootDir, roots.instanceDir, 'rootDir');
  assertPathEquals(payload?.paths?.volumeDir, roots.volumeDir, 'volumeDir');
  assertPathEquals(payload?.paths?.fsDir, roots.fsDir, 'fsDir');
  assertPathEquals(payload?.paths?.homeDir, roots.homeDir, 'homeDir');
  assertPathEquals(payload?.paths?.configDir, roots.configDir, 'configDir');
  assertPathEquals(payload?.paths?.runtimeDir, roots.runtimeDir, 'runtimeDir');
  assertPathEquals(payload?.paths?.logsDir, roots.logsDir, 'logsDir');
  assertPathWithin(payload?.paths?.retentionDir, path.join(roots.repoRoot, 'workspace', 'retention', workspaceId), 'retentionDir');
  assertPathWithin(payload?.paths?.secretStoreDir, path.join(roots.repoRoot, 'workspace', 'secrets', workspaceId), 'secretStoreDir');
  assertPathWithin(payload?.paths?.prebuildDir, path.join(roots.repoRoot, 'workspace', 'prebuilds', workspaceId), 'prebuildDir');
  const table = loadRuntimeTable(paths);
  for (const [otherWorkspaceId, runtime] of Object.entries(table.workspaces || {})) {
    if (otherWorkspaceId === workspaceId) continue;
    const otherIdeAlive = isPidRunning(runtime?.processes?.idePid);
    const otherAgentAlive = isPidRunning(runtime?.processes?.agentPid);
    const otherActive = otherIdeAlive || otherAgentAlive;
    if (!otherActive) continue;
    if (runtime?.paths?.rootDir && path.resolve(runtime.paths.rootDir) === path.resolve(payload.paths.rootDir)) {
      throw new Error(`workspace_isolation_violation:duplicate_rootDir with workspace '${otherWorkspaceId}'`);
    }
    if (runtime?.paths?.fsDir && path.resolve(runtime.paths.fsDir) === path.resolve(payload.paths.fsDir)) {
      throw new Error(`workspace_isolation_violation:duplicate_fsDir with workspace '${otherWorkspaceId}'`);
    }
    const otherPorts = new Set([runtime?.ports?.ide, runtime?.ports?.agent].filter(Boolean));
    if (otherPorts.has(payload?.ports?.ide) || otherPorts.has(payload?.ports?.agent)) {
      throw new Error(`workspace_isolation_violation:duplicate_ports with workspace '${otherWorkspaceId}'`);
    }
  }
  return {
    workspaceId,
    rootDir: roots.instanceDir,
    volumeDir: roots.volumeDir,
    fsDir: roots.fsDir,
    runtimeDir: roots.runtimeDir,
    ports: payload.ports || null,
    enforcedAt: nowIso()
  };
}

function stopRuntimeProcesses(runtime, reason = 'stop_workspace') {
  const ideAlive = isPidRunning(runtime?.processes?.idePid);
  const agentAlive = isPidRunning(runtime?.processes?.agentPid);
  if (ideAlive) terminatePid(runtime.processes.idePid, 'SIGTERM');
  if (agentAlive) terminatePid(runtime.processes.agentPid, 'SIGTERM');
  return {
    ideAliveBefore: ideAlive,
    agentAliveBefore: agentAlive,
    reason
  };
}

function sanitizeRuntimeTable(paths, options = {}) {
  const table = loadRuntimeTable(paths);
  const cleaned = [];
  const removed = [];
  let changed = false;
  const now = Date.now();
  for (const [workspaceId, runtime] of Object.entries(table.workspaces || {})) {
    const reasons = [];
    const idePid = runtime?.processes?.idePid;
    const agentPid = runtime?.processes?.agentPid;
    const ideAlive = isPidRunning(idePid);
    const agentAlive = isPidRunning(agentPid);
    const missingPaths = Boolean(runtime?.paths?.fsDir && !fs.existsSync(runtime.paths.fsDir)) || Boolean(runtime?.paths?.rootDir && !fs.existsSync(runtime.paths.rootDir));
    const expiryTs = Date.parse(runtime?.lifecycle?.expiresAt || '');
    const expired = Boolean(options.pruneExpired !== false && Number.isFinite(expiryTs) && expiryTs <= now);

    if (options.killOrphans !== false && ideAlive !== agentAlive) {
      if (ideAlive) terminatePid(idePid, 'SIGTERM');
      if (agentAlive) terminatePid(agentPid, 'SIGTERM');
      reasons.push('orphan_process_cleanup');
    }

    if (missingPaths) {
      if (ideAlive) terminatePid(idePid, 'SIGTERM');
      if (agentAlive) terminatePid(agentPid, 'SIGTERM');
      reasons.push('missing_workspace_paths');
    }

    if (expired) {
      if (ideAlive) terminatePid(idePid, 'SIGTERM');
      if (agentAlive) terminatePid(agentPid, 'SIGTERM');
      reasons.push('expired_runtime_reaped');
    }

    if (!ideAlive && !agentAlive && !runtime?.stoppedAt) {
      reasons.push('stale_runtime_record');
    }

    const policy = cleanupWorkspaceLogs(runtime);

    if (reasons.length) {
      runtime.updatedAt = nowIso();
      runtime.stoppedAt = runtime.stoppedAt || nowIso();
      runtime.processes = { idePid: null, agentPid: null };
      runtime.cleanup = {
        lastRunAt: nowIso(),
        reasons,
        removedLogFiles: policy.removed
      };
      appendWorkspaceEvent(runtime, 'runtime_reaped', { reasons, removedLogFiles: policy.removed });
      if (options.removeStale && (reasons.includes('stale_runtime_record') || reasons.includes('missing_workspace_paths'))) {
        delete table.workspaces[workspaceId];
        removed.push(workspaceId);
      } else {
        table.workspaces[workspaceId] = runtime;
      }
      cleaned.push({ workspaceId, reasons });
      changed = true;
      continue;
    }

    runtime.logPolicy = policy;
    table.workspaces[workspaceId] = runtime;
    if (policy.removed.length) {
      changed = true;
    }
  }

  if (changed) {
    saveRuntimeTable(paths, table);
  }

  return {
    ok: true,
    cleaned,
    removed,
    runtimeCount: Object.keys(table.workspaces || {}).length
  };
}

function stopWorkspace(paths, workspaceId, reason = 'manual_stop') {
  const table = loadRuntimeTable(paths);
  const current = table.workspaces[workspaceId];
  if (!current) {
    return { stopped: false, reason: 'not_found' };
  }
  const processCleanup = stopRuntimeProcesses(current, reason);
  current.updatedAt = nowIso();
  current.stoppedAt = nowIso();
  current.processes = { idePid: null, agentPid: null };
  current.cleanup = {
    lastRunAt: nowIso(),
    reasons: [reason],
    ideAliveBefore: processCleanup.ideAliveBefore,
    agentAliveBefore: processCleanup.agentAliveBefore
  };
  appendWorkspaceEvent(current, 'workspace_stopped', { reason, processCleanup });
  cleanupWorkspaceLogs(current);
  table.workspaces[workspaceId] = current;
  saveRuntimeTable(paths, table);
  return { stopped: true, workspace: current };
}

function startWorkspace(paths, payload) {
  const validatedIsolation = validateWorkspaceIsolation(paths, payload);
  const preparedIsolation = prepareWorkspaceIsolation(payload.isolation || validatedIsolation, payload.paths || {});
  stopWorkspace(paths, payload.workspaceId, 'restart_before_start');
  resetLogFile(payload.plan.ide.logFile);
  resetLogFile(payload.plan.agent.logFile);
  const sandboxPolicy = payload.sandboxPolicy || getRuntimeSandboxPolicy(process.env);
  const ideSpawn = spawnDetachedProcess(payload.plan.ide.command, payload.plan.ide.args || [], {
    cwd: payload.plan.ide.cwd,
    logFile: payload.plan.ide.logFile,
    env: applyWorkspaceIsolationEnv(payload.plan.ide.env || process.env, preparedIsolation),
    isolation: preparedIsolation,
    sandboxPolicy,
    rootDir: resolveRepoRoot(paths),
    workspaceId: payload.workspaceId,
    label: 'ide'
  });
  const agentSpawn = spawnDetachedProcess(payload.plan.agent.command, payload.plan.agent.args || [], {
    cwd: payload.plan.agent.cwd,
    logFile: payload.plan.agent.logFile,
    env: applyWorkspaceIsolationEnv(payload.plan.agent.env || process.env, preparedIsolation),
    isolation: preparedIsolation,
    sandboxPolicy,
    rootDir: resolveRepoRoot(paths),
    workspaceId: payload.workspaceId,
    label: 'agent'
  });
  const idePid = ideSpawn.pid;
  const agentPid = agentSpawn.pid;
  const table = loadRuntimeTable(paths);
  const runtime = {
    workspaceId: payload.workspaceId,
    workspaceName: payload.workspaceName,
    updatedAt: nowIso(),
    startedAt: nowIso(),
    executorPid: process.pid,
    processes: { idePid, agentPid },
    ports: payload.ports,
    urls: payload.urls,
    paths: payload.paths,
    runtimeMode: payload.runtimeMode,
    capabilities: payload.capabilities,
    lifecycle: {
      ...(payload.lifecycle || {}),
      expiresAt: computeExpiry(payload)
    },
    secrets: payload.secrets || null,
    prebuild: payload.prebuild || null,
    launchPlanSummary: {
      ide: { command: payload.plan.ide.command, args: payload.plan.ide.args || [], cwd: payload.plan.ide.cwd },
      agent: { command: payload.plan.agent.command, args: payload.plan.agent.args || [], cwd: payload.plan.agent.cwd }
    },
    isolation: preparedIsolation,
    sandboxPolicy,
    cleanup: null,
    logPolicy: {
      retentionDays: Number.parseInt(String(payload?.lifecycle?.retentionDays || ''), 10) || 14,
      updatedAt: nowIso(),
      removed: []
    }
  };
  appendWorkspaceEvent(runtime, 'workspace_started', { ports: payload.ports, isolation: preparedIsolation });
  cleanupWorkspaceLogs(runtime);
  table.workspaces[payload.workspaceId] = runtime;
  saveRuntimeTable(paths, table);
  return table.workspaces[payload.workspaceId];
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function buildStatusPayload(paths, options = {}) {
  const sanitization = sanitizeRuntimeTable(paths, {
    killOrphans: options.killOrphans,
    pruneExpired: options.pruneExpired,
    removeStale: false
  });
  const executor = loadExecutorState(paths);
  const table = loadRuntimeTable(paths);
  const runtimes = Object.values(table.workspaces || {}).map(summarizeWorkspaceRuntime);
  return {
    ok: true,
    executor: {
      ...(executor || {}),
      alive: Boolean(executor?.pid && isPidRunning(executor.pid))
    },
    workspaceCount: runtimes.length,
    runningWorkspaces: runtimes.filter(item => item.running).length,
    runtimes,
    sanitization,
    generatedAt: nowIso()
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const bannerConfig = getStackConfig({ ...process.env, SKYEQUANTA_REMOTE_EXECUTOR_PORT: String(options.port), SKYEQUANTA_HOST: options.host });
  printCanonicalRuntimeBanner(bannerConfig, 'remote-executor.mjs');
  const stateDir = options.stateDir || path.join(process.cwd(), '.skyequanta', 'remote-executor');
  const paths = getPaths(stateDir);
  ensureDirectory(paths.stateDir);

  if (options.command === 'ensure-daemon') {
    const current = loadExecutorState(paths);
    if (current && isPidRunning(current.pid)) {
      console.log(JSON.stringify({ ok: true, pid: current.pid, reused: true, url: current.url }, null, 2));
      return;
    }
    const pid = spawnDetachedProcess('node', [path.resolve(process.argv[1]), 'daemon', '--host', options.host, '--port', String(options.port), '--state-dir', stateDir], {
      cwd: process.cwd(),
      logFile: paths.logFile,
      env: { ...process.env }
    });
    saveExecutorState(paths, {
      pid,
      host: options.host,
      port: options.port,
      url: `http://${options.host}:${options.port}`,
      stateDir,
      startedAt: nowIso(),
      status: 'starting'
    });
    console.log(JSON.stringify({ ok: true, pid, reused: false, url: `http://${options.host}:${options.port}` }, null, 2));
    return;
  }

  if (options.command === 'status') {
    console.log(JSON.stringify(buildStatusPayload(paths, options), null, 2));
    return;
  }

  if (options.command === 'reap') {
    console.log(JSON.stringify(sanitizeRuntimeTable(paths, {
      killOrphans: options.killOrphans,
      pruneExpired: options.pruneExpired,
      removeStale: options.removeStale
    }), null, 2));
    return;
  }

  if (options.command !== 'daemon') {
    throw new Error(`Unsupported command: ${options.command}`);
  }

  const startupCleanup = sanitizeRuntimeTable(paths, {
    killOrphans: true,
    pruneExpired: true,
    removeStale: false
  });

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${options.host}:${options.port}`);
    try {
      if (request.method === 'GET' && url.pathname === '/health') {
        const table = loadRuntimeTable(paths);
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ ok: true, pid: process.pid, url: `http://${options.host}:${options.port}`, workspaceCount: Object.keys(table.workspaces || {}).length }));
        return;
      }
      if (request.method === 'GET' && url.pathname === '/status') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify(buildStatusPayload(paths, options)));
        return;
      }
      if (request.method === 'GET' && url.pathname === '/state') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ executor: loadExecutorState(paths), runtimes: loadRuntimeTable(paths) }));
        return;
      }
      if (request.method === 'POST' && url.pathname === '/maintenance/prune') {
        const result = sanitizeRuntimeTable(paths, { killOrphans: true, pruneExpired: true, removeStale: true });
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify(result));
        return;
      }
      if (request.method === 'POST' && url.pathname === '/workspaces/start') {
        const payload = await readBody(request);
        const runtime = startWorkspace(paths, payload);
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ ok: true, runtime }));
        return;
      }
      if (request.method === 'POST' && url.pathname === '/workspaces/stop') {
        const payload = await readBody(request);
        const result = stopWorkspace(paths, payload.workspaceId, payload.reason || 'api_stop');
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ ok: true, result }));
        return;
      }
      if (request.method === 'GET' && url.pathname.startsWith('/workspaces/')) {
        const workspaceId = decodeURIComponent(url.pathname.split('/').pop());
        const table = loadRuntimeTable(paths);
        if (table.workspaces[workspaceId]) {
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ ok: true, runtime: summarizeWorkspaceRuntime(table.workspaces[workspaceId]) }));
          return;
        }
        response.writeHead(404, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ ok: false, error: 'not_found' }));
        return;
      }
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: false, error: 'not_found' }));
    } catch (error) {
      response.writeHead(500, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    }
  });

  server.listen(options.port, options.host, () => {
    saveExecutorState(paths, {
      pid: process.pid,
      host: options.host,
      port: options.port,
      url: `http://${options.host}:${options.port}`,
      stateDir,
      startedAt: nowIso(),
      status: 'running',
      startupCleanup
    });
  });
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
