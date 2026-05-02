import { repairArchiveStrippedRuntimeDependencies } from './runtime.mjs';
import { applyWorkspaceIsolationEnv, buildWorkspaceIsolation, getSpawnIsolationOptions, prepareWorkspaceIsolation } from './runtime-isolation.mjs';
import { buildRuntimeSandboxLaunch, getRuntimeSandboxPolicy } from './runtime-sandbox.mjs';
import { applyRuntimeEgressHooks } from './runtime-egress.mjs';
import { acquireStartupLock, appendRecoveryJournal, releaseStartupLock } from './runtime-recovery.mjs';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';

const STUB_WORKSPACE_DRIVER = 'workspace-service-stub';
const REMOTE_EXECUTOR_DRIVER = 'remote-executor';
const DEFAULT_WORKSPACE_DRIVER = REMOTE_EXECUTOR_DRIVER;
const REAL_LOCAL_EXECUTOR_DRIVER = 'real-local-executor';
const SUPPORTED_WORKSPACE_DRIVERS = new Set([STUB_WORKSPACE_DRIVER, 'stub', REAL_LOCAL_EXECUTOR_DRIVER, REMOTE_EXECUTOR_DRIVER]);

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function readInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return parsed;
}

function runtimeBaseDir(config) {
  return path.join(config.rootDir, '.skyequanta', 'workspace-runtime');
}


function resolveMachineProfile(config, explicitProfile = null) {
  const requested = String(explicitProfile || process.env.SKYEQUANTA_MACHINE_PROFILE || config.lifecycle?.defaultMachineProfile || 'standard').trim().toLowerCase();
  const profiles = config.lifecycle?.machineProfiles || {};
  return profiles[requested] || profiles.standard || { name: requested || 'standard', cpu: 4, memoryMb: 8192, diskGb: 40 };
}

function buildLifecyclePolicy(config, machineProfile) {
  return {
    idleTimeoutMs: config.lifecycle?.idleTimeoutMs || 30 * 60 * 1000,
    maxRuntimeAgeMs: config.lifecycle?.maxRuntimeAgeMs || 24 * 60 * 60 * 1000,
    retentionDays: config.lifecycle?.retentionDays || 14,
    machineProfile
  };
}

function collectInjectableSecrets(config) {
  const allowlist = Array.isArray(config.lifecycle?.secretAllowlist) ? config.lifecycle.secretAllowlist : [];
  const entries = [];
  for (const key of allowlist) {
    if (Object.prototype.hasOwnProperty.call(process.env, key)) {
      entries.push({ key, value: String(process.env[key] || '') });
    }
  }
  return entries;
}

function sha256OfFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function workspaceInstanceDir(config, workspaceId) {
  return path.join(config.rootDir, 'workspace', 'instances', workspaceId);
}

function workspaceRuntimeDir(config, workspaceId) {
  return path.join(runtimeBaseDir(config), workspaceId);
}

function workspaceStateFile(config, workspaceId) {
  return path.join(workspaceRuntimeDir(config, workspaceId), 'state.json');
}

function workspaceLogFile(config, workspaceId, role) {
  return path.join(workspaceRuntimeDir(config, workspaceId), `${role}.log`);
}

function isPortOpen(host, port) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port });
    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
  });
  return spawned.pid;
}

function collectReservedRuntimePorts(config, excludeWorkspaceId = null) {
  const reserved = new Set();
  const runtimeTable = readJson(config?.paths?.remoteExecutorRuntimesFile, { workspaces: {} }) || { workspaces: {} };
  for (const [workspaceId, runtime] of Object.entries(runtimeTable.workspaces || {})) {
    if (workspaceId === excludeWorkspaceId) continue;
    const idePid = runtime?.processes?.idePid;
    const agentPid = runtime?.processes?.agentPid;
    const pidVisibleAlive = isPidRunning(idePid) || isPidRunning(agentPid);
    const hasPorts = Number.isInteger(runtime?.ports?.ide) || Number.isInteger(runtime?.ports?.agent);
    const likelyActive = pidVisibleAlive || (hasPorts && !runtime?.stoppedAt);
    if (!likelyActive) continue;
    for (const port of [runtime?.ports?.ide, runtime?.ports?.agent]) {
      if (Number.isInteger(port) && port > 0) reserved.add(port);
    }
  }
  return reserved;
}

async function findFreePort(host, startPort, maxPort, reservedPorts = new Set()) {
  let port = startPort;
  while (port <= maxPort) {
    if (reservedPorts.has(port)) {
      port += 1;
      continue;
    }
    const open = await isPortOpen(host, port);
    if (!open) {
      return port;
    }

    port += 1;
  }

  throw new Error(`No free ports found in range ${startPort}-${maxPort}.`);
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

function isPidRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForUrl(url, timeoutMs = 15000, validate = response => response.ok) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (validate(response)) {
        return response;
      }
    } catch {
      // Service is still starting.
    }

    await new Promise(resolve => {
      setTimeout(resolve, 250);
    });
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function normalizeDriverName(rawValue) {
  const normalized = String(rawValue || '').trim().toLowerCase();
  if (!normalized) {
    return DEFAULT_WORKSPACE_DRIVER;
  }

  if (normalized === 'stub') {
    return STUB_WORKSPACE_DRIVER;
  }

  return normalized;
}

export function getWorkspaceRuntimeDriver(env = process.env) {
  const driver = normalizeDriverName(env.SKYEQUANTA_WORKSPACE_DRIVER);
  if (!SUPPORTED_WORKSPACE_DRIVERS.has(driver)) {
    throw new Error(
      `Unsupported workspace runtime driver '${driver}'. Supported drivers: ${Array.from(SUPPORTED_WORKSPACE_DRIVERS).join(', ')}`
    );
  }

  return driver;
}

function getDriverCapabilities(driver) {
  if (driver === STUB_WORKSPACE_DRIVER) {
    return {
      driver,
      serviceMode: 'stub',
      realIdeRuntime: false,
      realAgentRuntime: false,
      isolatedFilesystem: true,
      containerized: false,
      remoteExecutor: false,
      multiTenantProductionReady: false,
      proofLabel: 'stage-1-truth-and-proof'
    };
  }

  if (driver === REAL_LOCAL_EXECUTOR_DRIVER) {
    return {
      driver,
      serviceMode: 'real-local-executor',
      realIdeRuntime: true,
      realAgentRuntime: true,
      isolatedFilesystem: true,
      containerized: false,
      remoteExecutor: false,
      equivalentIsolation: false,
      durableVolume: false,
      multiTenantProductionReady: false,
      fullTheiaRuntime: false,
      fullOpenHandsRuntime: false,
      proofLabel: 'stage-2-real-local-executor'
    };
  }

  if (driver === REMOTE_EXECUTOR_DRIVER) {
    return {
      driver,
      serviceMode: 'remote-executor',
      realIdeRuntime: true,
      realAgentRuntime: true,
      isolatedFilesystem: true,
      containerized: false,
      remoteExecutor: true,
      equivalentIsolation: true,
      durableVolume: true,
      multiTenantProductionReady: true,
      fullTheiaRuntime: false,
      fullOpenHandsRuntime: false,
      machineProfiles: true,
      secretInjection: true,
      lifecyclePolicy: true,
      proofLabel: 'stage-4-remote-executor'
    };
  }

  return {
    driver,
    serviceMode: 'unknown',
    realIdeRuntime: false,
    realAgentRuntime: false,
    isolatedFilesystem: false,
    containerized: false,
    remoteExecutor: false,
    multiTenantProductionReady: false,
    proofLabel: 'unknown'
  };
}

function spawnDetachedProcess(command, args, options) {
  const requestedEnv = { ...(options.env || process.env) };
  const sandbox = buildRuntimeSandboxLaunch(command, args, {
    env: requestedEnv,
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
    env: { ...requestedEnv, ...(sandbox.envAdditions || {}) },
    ...getSpawnIsolationOptions(options.isolation)
  });

  child.unref();
  fs.closeSync(outFd);
  return { pid: child.pid, sandbox };
}

function spawnDetachedWorkspaceService(config, options) {
  const spawned = spawnDetachedProcess('node', [
    path.join(config.shellDir, 'bin', 'workspace-service.mjs'),
    '--workspace-id', options.workspaceId,
    '--workspace-name', options.workspaceName,
    '--role', options.role,
    '--port', String(options.port),
    '--root-dir', options.rootDir,
    '--driver', options.driver
  ], {
    cwd: options.rootDir,
    logFile: options.logFile,
    env: {
      ...process.env,
      SKYEQUANTA_WORKSPACE_ID: options.workspaceId,
      SKYEQUANTA_WORKSPACE_NAME: options.workspaceName,
      SKYEQUANTA_WORKSPACE_ROLE: options.role,
      SKYEQUANTA_WORKSPACE_ROOT: options.rootDir,
      SKYEQUANTA_WORKSPACE_DRIVER: options.driver,
      SKYEQUANTA_INTERNAL_RUNTIME_INVOCATION: '1'
    },
    rootDir: config.rootDir,
    workspaceId: options.workspaceId,
    label: options.role || 'service'
  });
  return spawned.pid;
}

function buildServiceUrl(config, port) {
  return `http://${config.host}:${port}`;
}

function resetLogFile(filePath) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, '', 'utf8');
}

function tailFile(filePath, maxLines = 60) {
  if (!filePath || !fs.existsSync(filePath)) {
    return [];
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  return lines.slice(-maxLines);
}

function commandVersionCheck(command, args = ['--version']) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: false
  });

  return {
    ok: result.status === 0,
    status: result.status,
    signal: result.signal,
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim()
  };
}

function pythonImportCheck(pythonCommand, env, code) {
  const result = spawnSync(pythonCommand, ['-c', code], {
    encoding: 'utf8',
    env
  });

  return {
    ok: result.status === 0,
    status: result.status,
    signal: result.signal,
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim()
  };
}

function appendToPath(originalValue, entry) {
  const current = String(originalValue || '').trim();
  if (!current) {
    return entry;
  }

  const parts = current.split(path.delimiter).filter(Boolean);
  if (parts.includes(entry)) {
    return current;
  }

  return `${entry}${path.delimiter}${current}`;
}

function mergePythonPath(existing, entries) {
  const parts = String(existing || '').split(path.delimiter).filter(Boolean);
  for (const entry of entries) {
    if (!parts.includes(entry)) {
      parts.unshift(entry);
    }
  }

  return parts.join(path.delimiter);
}

function candidatePaths(...values) {
  return values.flat().filter(Boolean).map(value => path.resolve(String(value)));
}

function firstExistingPath(paths) {
  for (const candidate of paths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function summarizeCheck(result) {
  if (!result) {
    return { ok: false, detail: 'not_run' };
  }

  return {
    ok: Boolean(result.ok),
    status: result.status ?? null,
    signal: result.signal ?? null,
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim()
  };
}

function shellQuote(value) {
  const stringValue = String(value);
  if (!stringValue) {
    return ;
  }

  if (/^[A-Za-z0-9_./:=+-]+$/.test(stringValue)) {
    return stringValue;
  }

  return `'${stringValue.replace(/'/g, `'\''`)}'`;
}

function commandToString(command, args = []) {
  return [command, ...args].map(shellQuote).join(' ');
}


function buildRealLocalLaunchPlan(config, workspace, paths, ports, driver) {
  const ideLog = workspaceLogFile(config, workspace.id, 'ide');
  const agentLog = workspaceLogFile(config, workspace.id, 'agent');
  const runtimeDepsDir = path.join(config.rootDir, '.skyequanta', 'runtime-deps');
  const theiaRuntimeDir = path.join(runtimeDepsDir, 'theia-browser');
  const agentVenvDir = path.join(runtimeDepsDir, 'agent-venv');
  const dependencyPython = process.platform === 'win32'
    ? path.join(agentVenvDir, 'Scripts', 'python.exe')
    : path.join(agentVenvDir, 'bin', 'python');
  const pythonCommand = process.env.SKYEQUANTA_PYTHON_COMMAND || (fs.existsSync(dependencyPython) ? dependencyPython : 'python3');
  const theiaCliCandidates = candidatePaths(
    process.env.SKYEQUANTA_THEIA_CLI,
    config.paths.isolatedTheiaCli,
    path.join(config.paths.ideExampleDir, 'node_modules', '.bin', process.platform === 'win32' ? 'theia.cmd' : 'theia'),
    path.join(config.paths.ideCoreDir, 'node_modules', '.bin', process.platform === 'win32' ? 'theia.cmd' : 'theia'),
    path.join(theiaRuntimeDir, 'theia-browser', 'node_modules', '.bin', process.platform === 'win32' ? 'theia.cmd' : 'theia'),
    path.join(theiaRuntimeDir, 'node_modules', '.bin', process.platform === 'win32' ? 'theia.cmd' : 'theia')
  );
  const resolvedTheiaCli = firstExistingPath(theiaCliCandidates);
  const isolation = prepareWorkspaceIsolation(buildWorkspaceIsolation(config, workspace.id, {
    instanceDir: paths.instanceDir,
    rootDir: paths.instanceDir,
    fsDir: paths.fsDir,
    homeDir: paths.homeDir,
    runtimeDir: paths.runtimeDir,
    logsDir: paths.logsDir,
    configDir: paths.configDir,
    volumeDir: paths.volumeDir,
    retentionDir: paths.retentionDir,
    secretStoreDir: paths.secretStoreDir,
    prebuildDir: paths.prebuildDir
  }), {
    instanceDir: paths.instanceDir,
    rootDir: paths.instanceDir,
    fsDir: paths.fsDir,
    homeDir: paths.homeDir,
    runtimeDir: paths.runtimeDir,
    logsDir: paths.logsDir,
    configDir: paths.configDir,
    volumeDir: paths.volumeDir,
    retentionDir: paths.retentionDir,
    secretStoreDir: paths.secretStoreDir,
    prebuildDir: paths.prebuildDir
  });

  const baseEnv = applyWorkspaceIsolationEnv({
    ...process.env,
    HOME: paths.homeDir,
    SKYEQUANTA_WORKSPACE_ID: workspace.id,
    SKYEQUANTA_WORKSPACE_NAME: workspace.name,
    SKYEQUANTA_WORKSPACE_ROOT: paths.fsDir,
    SKYEQUANTA_WORKSPACE_HOME: paths.homeDir,
    SKYEQUANTA_WORKSPACE_DRIVER: driver,
    SKYEQUANTA_INTERNAL_RUNTIME_INVOCATION: '1'
  }, isolation);

  const sandboxPolicy = getRuntimeSandboxPolicy(process.env);

  let ideEnv = {
    ...baseEnv,
    SKYEQUANTA_RUNTIME_CONTRACT_URL: `http://${config.host}:${ports.ide}`,
    SKYEQUANTA_IDE_INTERNAL_URL: `http://${config.host}:${ports.ide}`,
    THEIA_DEFAULT_WORKSPACE_URI: paths.fsDir,
    THEIA_WEBVIEW_EXTERNAL_ENDPOINT: `http://${config.host}:${ports.ide}`,
    npm_config_cache: path.join(config.paths.ideRuntimeDepsDir, '.npm-cache'),
    PUPPETEER_SKIP_DOWNLOAD: '1',
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
    UV_THREADPOOL_SIZE: String(process.env.UV_THREADPOOL_SIZE || '1'),
    MALLOC_CONF: String(process.env.MALLOC_CONF || 'background_thread:false,narenas:1'),
    NODE_OPTIONS: [String(baseEnv.NODE_OPTIONS || '').trim(), '--v8-pool-size=1', '--max-old-space-size=512'].filter(Boolean).join(' ')
  };

  let agentEnv = {
    ...baseEnv,
    BACKEND_HOST: config.host,
    BACKEND_PORT: String(ports.agent),
    PYTHONWARNINGS: 'ignore',
    OPENHANDS_SUPPRESS_BANNER: '1',
    PYTHONPATH: mergePythonPath(baseEnv.PYTHONPATH, [config.paths.agentCoreDir, config.paths.agentServerAppDir]),
    OPENBLAS_NUM_THREADS: String(process.env.OPENBLAS_NUM_THREADS || '1'),
    OMP_NUM_THREADS: String(process.env.OMP_NUM_THREADS || '1'),
    MKL_NUM_THREADS: String(process.env.MKL_NUM_THREADS || '1'),
    NUMEXPR_NUM_THREADS: String(process.env.NUMEXPR_NUM_THREADS || '1'),
    GOTO_NUM_THREADS: String(process.env.GOTO_NUM_THREADS || '1'),
    BLIS_NUM_THREADS: String(process.env.BLIS_NUM_THREADS || '1'),
    VECLIB_MAXIMUM_THREADS: String(process.env.VECLIB_MAXIMUM_THREADS || '1'),
    MALLOC_CONF: String(process.env.MALLOC_CONF || 'background_thread:false,narenas:1'),
    PYTHONDONTWRITEBYTECODE: '1'
  };

  const ideRuntimeEgress = applyRuntimeEgressHooks(config, ideEnv);
  ideEnv = ideRuntimeEgress.env;
  const agentRuntimeEgress = applyRuntimeEgressHooks(config, agentEnv);
  agentEnv = agentRuntimeEgress.env;

  const openHandsImportCode = [
    'import os, sys',
    `sys.path.insert(0, ${JSON.stringify(config.paths.agentCoreDir)})`,
    `sys.path.insert(0, ${JSON.stringify(config.paths.agentServerAppDir)})`,
    'from openhands.app_server.v1_router import router',
    'assert router is not None',
    'print("ok")'
  ].join('; ');
  const openHandsImport = pythonImportCheck(pythonCommand, agentEnv, openHandsImportCode);
  const fullOpenHandsRuntime = Boolean(openHandsImport.ok);
  const isolatedTheiaBackendPresent = fs.existsSync(config.paths.isolatedTheiaBackendEntrypoint);
  const upstreamTheiaBackendPresent = fs.existsSync(config.paths.ideBrowserBackendEntrypoint);
  const fullTheiaRuntime = Boolean(resolvedTheiaCli && (isolatedTheiaBackendPresent || upstreamTheiaBackendPresent));
  const ideMode = fullTheiaRuntime ? 'upstream-theia' : 'foundation-ide-surface';
  const agentMode = fullOpenHandsRuntime ? 'upstream-openhands' : 'foundation-fastapi';
  const ideCommand = fullTheiaRuntime ? resolvedTheiaCli : (process.env.SKYEQUANTA_IDE_COMMAND || 'node');
  const ideArgs = fullTheiaRuntime
    ? [
        'start',
        '--hostname', config.host,
        '--port', String(ports.ide),
        paths.fsDir
      ]
    : process.env.SKYEQUANTA_IDE_COMMAND
      ? []
      : [
          path.join(config.shellDir, 'bin', 'real-ide-runtime.mjs'),
          '--workspace-id', workspace.id,
          '--workspace-name', workspace.name,
          '--root-dir', paths.fsDir,
          '--host', config.host,
          '--port', String(ports.ide),
          '--driver', driver
        ];

  return {
    isolation,
    sandboxPolicy,
    egressPolicy: agentRuntimeEgress.policy,
    ide: {
      label: 'ide',
      mode: ideMode,
      command: ideCommand,
      args: ideArgs,
      cwd: fullTheiaRuntime ? (fs.existsSync(config.paths.isolatedTheiaPackageJson) ? config.paths.isolatedTheiaDir : config.paths.ideExampleDir) : paths.fsDir,
      env: ideEnv,
      logFile: ideLog,
      healthUrl: `http://${config.host}:${ports.ide}`,
      preflight: [
        {
          id: 'node_available',
          kind: 'command-version',
          command: 'node',
          args: ['--version']
        },
        {
          id: 'real_ide_runtime_script_present',
          kind: 'path-exists',
          path: path.join(config.shellDir, 'bin', 'real-ide-runtime.mjs'),
          detail: 'The real IDE runtime surface entrypoint must exist before stage 2 can pass.'
        }
      ],
      upstreamPreflight: [
        {
          id: 'theia_cli_present',
          kind: 'path-exists',
          path: resolvedTheiaCli || theiaCliCandidates[0] || config.paths.isolatedTheiaCli,
          detail: 'A real upstream Theia CLI must be installed before Stage 2B can pass.'
        },
        {
          id: 'theia_backend_entrypoint_present',
          kind: 'path-exists',
          path: fs.existsSync(config.paths.isolatedTheiaPackageJson) ? config.paths.isolatedTheiaBackendEntrypoint : config.paths.ideBrowserBackendEntrypoint,
          detail: 'A real upstream Theia backend entrypoint must exist before Stage 2B can pass.'
        }
      ]
    },
    agent: {
      label: 'agent',
      mode: agentMode,
      command: process.env.SKYEQUANTA_AGENT_COMMAND || pythonCommand,
      args: process.env.SKYEQUANTA_AGENT_COMMAND
        ? []
        : [path.join(config.paths.agentServerAppDir, 'skyequanta_app_server.py'), '--host', config.host, '--port', String(ports.agent)],
      cwd: config.paths.agentCoreDir,
      env: agentEnv,
      logFile: agentLog,
      healthUrl: `http://${config.host}:${ports.agent}/health`,
      docsUrl: `http://${config.host}:${ports.agent}/docs`,
      preflight: [
        {
          id: 'python_available',
          kind: 'command-version',
          command: pythonCommand,
          args: ['--version']
        },
        {
          id: 'app_server_importable',
          kind: 'python-import',
          command: pythonCommand,
          code: [
            'import os, sys',
            `sys.path.insert(0, ${JSON.stringify(config.paths.agentCoreDir)})`,
            `sys.path.insert(0, ${JSON.stringify(config.paths.agentServerAppDir)})`,
            'import skyequanta_app_server',
            'print("ok")'
          ].join('; '),
          env: agentEnv
        }
      ],
      upstreamPreflight: [
        {
          id: 'openhands_v1_router_importable',
          kind: 'python-import',
          command: pythonCommand,
          code: openHandsImportCode,
          env: agentEnv
        }
      ]
    },
    dependencyLanes: {
      ideMode,
      agentMode,
      fullTheiaRuntime: Boolean(fullTheiaRuntime),
      fullOpenHandsRuntime,
      resolvedTheiaCli,
      theiaCliCandidates,
      agentPython: pythonCommand,
      openHandsImport: summarizeCheck(openHandsImport),
      installCommands: {
        theia: [
          'node apps/skyequanta-shell/bin/repair-stage2b.mjs --install-theia --build-theia'
        ],
        openHands: [
          'node apps/skyequanta-shell/bin/repair-stage2b.mjs --install-openhands'
        ]
      },
      launchCommands: {
        ide: commandToString(ideCommand, ideArgs),
        agent: commandToString(process.env.SKYEQUANTA_AGENT_COMMAND || pythonCommand, process.env.SKYEQUANTA_AGENT_COMMAND ? [] : [path.join(config.paths.agentServerAppDir, 'skyequanta_app_server.py'), '--host', config.host, '--port', String(ports.agent)])
      }
    }
  };
}

function executePreflightCheck(check) {
  if (check.kind === 'path-exists') {
    const exists = fs.existsSync(check.path);
    return {
      id: check.id,
      pass: exists,
      kind: check.kind,
      detail: exists ? `found ${check.path}` : check.detail || `missing ${check.path}`,
      path: check.path
    };
  }

  if (check.kind === 'command-version') {
    const version = commandVersionCheck(check.command, check.args);
    return {
      id: check.id,
      pass: version.ok,
      kind: check.kind,
      command: check.command,
      args: check.args,
      detail: version.ok ? version.stdout || 'command ok' : version.stderr || version.stdout || 'command failed',
      output: version
    };
  }

  if (check.kind === 'python-import') {
    const result = pythonImportCheck(check.command, check.env, check.code);
    return {
      id: check.id,
      pass: result.ok,
      kind: check.kind,
      command: check.command,
      detail: result.ok ? result.stdout || 'import ok' : result.stderr || result.stdout || 'python import failed',
      output: result
    };
  }

  return {
    id: check.id,
    pass: false,
    kind: check.kind,
    detail: `Unsupported preflight check kind '${check.kind}'`
  };
}

function evaluateLaunchPlan(plan) {
  const checks = [];
  const upstreamChecks = [];
  for (const check of plan.ide.preflight) {
    checks.push({ role: 'ide', ...executePreflightCheck(check) });
  }

  for (const check of plan.agent.preflight) {
    checks.push({ role: 'agent', ...executePreflightCheck(check) });
  }

  for (const check of (plan.ide.upstreamPreflight || [])) {
    upstreamChecks.push({ role: 'ide', ...executePreflightCheck(check) });
  }

  for (const check of (plan.agent.upstreamPreflight || [])) {
    upstreamChecks.push({ role: 'agent', ...executePreflightCheck(check) });
  }

  const blockers = checks.filter(check => !check.pass);
  const upstreamBlockers = upstreamChecks.filter(check => !check.pass);
  return {
    checks,
    blockers,
    ok: blockers.length === 0,
    upstreamChecks,
    upstreamBlockers,
    upstreamOk: upstreamBlockers.length === 0
  };
}

function persistState(config, workspaceId, state) {
  writeJson(workspaceStateFile(config, workspaceId), state);
  return state;
}


async function requestJson(url, options = {}) {
  const attempts = Number.parseInt(String(options.attempts || 4), 10);
  const retryDelayMs = Number.parseInt(String(options.retryDelayMs || 350), 10);
  const timeoutMs = Number.parseInt(String(options.timeoutMs || 30000), 10);
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`Timed out waiting for ${url}`)), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          ...(options.headers || {})
        }
      });
      const rawText = await response.text();
      let body = null;
      try {
        body = rawText ? JSON.parse(rawText) : null;
      } catch {
        body = null;
      }
      if (!response.ok) {
        throw new Error(body?.error || rawText || `Request failed: ${response.status}`);
      }
      return body;
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) break;
      await delay(retryDelayMs * attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError || 'request failed'));
}

async function probeRemoteExecutorHealth(url, timeoutMs = 3000) {
  try {
    await waitForUrl(`${url.replace(/\/+$/, '')}/health`, timeoutMs, response => response.ok);
    return true;
  } catch {
    return false;
  }
}

async function ensureRemoteExecutorDaemon(config) {
  const scriptPath = config.paths.remoteExecutorScript;
  const stateDir = config.paths.remoteExecutorDir;
  ensureDirectory(stateDir);
  const stateFile = config.paths.remoteExecutorStateFile;
  const existing = readJson(stateFile, null);
  const forceRestart = String(process.env.SKYEQUANTA_REMOTE_EXECUTOR_FORCE_RESTART || '').trim() === '1';
  const desiredUrl = `http://${config.remoteExecutor.host}:${config.remoteExecutor.port}`;
  const existingUrl = existing?.url || desiredUrl;
  const portMatches = Number.parseInt(String(existing?.port || config.remoteExecutor.port), 10) === config.remoteExecutor.port;
  if (!forceRestart && portMatches && await probeRemoteExecutorHealth(existingUrl, 4000)) {
    const adoptedState = {
      ...(existing || {}),
      pid: existing?.pid && isPidRunning(existing.pid) ? existing.pid : null,
      host: config.remoteExecutor.host,
      port: config.remoteExecutor.port,
      url: existingUrl,
      stateDir,
      lastStartedAt: existing?.lastStartedAt || nowIso(),
      lastObservedHealthyAt: nowIso(),
      status: 'running'
    };
    writeJson(stateFile, adoptedState);
    return { ...adoptedState, stateFile };
  }
  if (existing?.pid && isPidRunning(existing.pid) && !forceRestart && portMatches) {
    try {
      await waitForUrl(existingUrl, 10000, response => response.ok);
      return {
        ...existing,
        stateDir,
        stateFile,
        url: existingUrl
      };
    } catch {
      // fall through and restart
    }
  }
  if (existing?.pid && isPidRunning(existing.pid) && (forceRestart || !portMatches)) {
    try { process.kill(existing.pid, 'SIGTERM'); } catch {}
    await waitForPidExit(existing.pid, 5000);
    try { fs.rmSync(stateFile, { force: true }); } catch {}
  }

  spawnSync('node', [
    scriptPath,
    'ensure-daemon',
    '--host', config.remoteExecutor.host,
    '--port', String(config.remoteExecutor.port),
    '--state-dir', stateDir
  ], {
    cwd: config.rootDir,
    encoding: 'utf8'
  });

  await waitForUrl(`http://${config.remoteExecutor.host}:${config.remoteExecutor.port}/health`, 15000, response => response.ok);
  const healthyState = {
    ...(readJson(stateFile, null) || {}),
    host: config.remoteExecutor.host,
    port: config.remoteExecutor.port,
    url: `http://${config.remoteExecutor.host}:${config.remoteExecutor.port}`,
    stateDir,
    lastObservedHealthyAt: nowIso(),
    status: 'running'
  };
  writeJson(stateFile, healthyState);
  return { ...healthyState, stateFile };
}

async function provisionStubRuntime(config, workspace, paths, current, driver, capabilities, idePort, agentPort) {
  const ideLog = workspaceLogFile(config, workspace.id, 'ide');
  const agentLog = workspaceLogFile(config, workspace.id, 'agent');
  resetLogFile(ideLog);
  resetLogFile(agentLog);

  const idePid = spawnDetachedWorkspaceService(config, {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    role: 'ide',
    port: idePort,
    rootDir: paths.fsDir,
    logFile: ideLog,
    driver
  });
  const agentPid = spawnDetachedWorkspaceService(config, {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    role: 'agent',
    port: agentPort,
    rootDir: paths.fsDir,
    logFile: agentLog,
    driver
  });

  const state = persistState(config, workspace.id, {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    driver,
    capabilities,
    startedAt: nowIso(),
    updatedAt: nowIso(),
    ports: {
      ide: idePort,
      agent: agentPort
    },
    urls: {
      ide: buildServiceUrl(config, idePort),
      agent: buildServiceUrl(config, agentPort)
    },
    paths: {
      rootDir: paths.instanceDir,
      fsDir: paths.fsDir,
      homeDir: paths.homeDir,
      runtimeDir: paths.runtimeDir,
      logsDir: paths.logsDir,
      configDir: paths.configDir,
      envFile: paths.envFile,
      provisionFile: paths.provisionFile
    },
    logs: {
      ide: ideLog,
      agent: agentLog
    },
    processes: {
      idePid,
      agentPid
    },
    launchPlan: null,
    preflight: null,
    lastProvisionError: null,
    previousDriver: current?.driver || null
  });

  await waitForUrl(`${state.urls.ide}/health`);
  await waitForUrl(`${state.urls.agent}/health`);

  return {
    state,
    created: true
  };
}

async function provisionRealLocalRuntime(config, workspace, paths, current, driver, capabilities, idePort, agentPort) {
  const plan = buildRealLocalLaunchPlan(config, workspace, paths, { ide: idePort, agent: agentPort }, driver);
  const preflight = evaluateLaunchPlan(plan);
  resetLogFile(plan.ide.logFile);
  resetLogFile(plan.agent.logFile);

  const stateBase = {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    driver,
    capabilities,
    startedAt: nowIso(),
    updatedAt: nowIso(),
    ports: {
      ide: idePort,
      agent: agentPort
    },
    urls: {
      ide: buildServiceUrl(config, idePort),
      agent: buildServiceUrl(config, agentPort)
    },
    paths: {
      rootDir: paths.instanceDir,
      fsDir: paths.fsDir,
      homeDir: paths.homeDir,
      runtimeDir: paths.runtimeDir,
      logsDir: paths.logsDir,
      configDir: paths.configDir,
      envFile: paths.envFile,
      provisionFile: paths.provisionFile
    },
    logs: {
      ide: plan.ide.logFile,
      agent: plan.agent.logFile
    },
    launchPlan: {
      ide: {
        command: plan.ide.command,
        args: plan.ide.args,
        cwd: plan.ide.cwd,
        healthUrl: plan.ide.healthUrl
      },
      agent: {
        command: plan.agent.command,
        args: plan.agent.args,
        cwd: plan.agent.cwd,
        healthUrl: plan.agent.healthUrl,
        docsUrl: plan.agent.docsUrl
      }
    },
    preflight,
    dependencyLanes: {
      ...plan.dependencyLanes,
      ideCoreNodeModulesPresent: fs.existsSync(path.join(config.paths.ideCoreDir, 'node_modules')),
      ideCoreLockfilePresent: fs.existsSync(path.join(config.paths.ideCoreDir, 'package-lock.json')),
      ideExampleNodeModulesPresent: fs.existsSync(path.join(config.paths.ideExampleDir, 'node_modules')),
      agentVenvPresent: fs.existsSync(path.join(config.rootDir, '.skyequanta', 'runtime-deps', 'agent-venv')),
      note: 'Stage 2 proves a real local executor foundation. Stage 2B separately proves full upstream Theia/OpenHands parity.'
    },
    provisioning: readJson(paths.provisionFile, null),
    runtimeMode: {
      ide: plan.ide.mode,
      agent: plan.agent.mode
    },
    lifecycle: readJson(paths.lifecyclePolicyFile, null),
    secrets: readJson(paths.secretManifestFile, null),
    prebuild: readJson(paths.prebuildManifestFile, null),
    previousDriver: current?.driver || null,
    isolation: plan.isolation,
    sandbox: { ide: plan.sandboxPolicy, agent: plan.sandboxPolicy },
    egressPolicy: plan.egressPolicy
  };

  stateBase.capabilities = {
    ...capabilities,
    fullTheiaRuntime: Boolean(stateBase.dependencyLanes.fullTheiaRuntime),
    fullOpenHandsRuntime: Boolean(stateBase.dependencyLanes.fullOpenHandsRuntime)
  };

  if (!preflight.ok) {
    const state = persistState(config, workspace.id, {
      ...stateBase,
      processes: {
        idePid: null,
        agentPid: null
      },
      lastProvisionError: 'Real local executor is blocked by missing prerequisites.',
      blockers: preflight.blockers
    });

    return {
      state,
      created: false,
      blocked: true
    };
  }

  resetLogFile(plan.ide.logFile);
  resetLogFile(plan.agent.logFile);

  const ideSpawn = spawnDetachedProcess(plan.ide.command, plan.ide.args, {
    cwd: plan.ide.cwd,
    logFile: plan.ide.logFile,
    env: plan.ide.env,
    isolation: plan.isolation,
    sandboxPolicy: plan.sandboxPolicy,
    rootDir: config.rootDir,
    workspaceId: workspace.id,
    label: 'ide'
  });
  const agentSpawn = spawnDetachedProcess(plan.agent.command, plan.agent.args, {
    cwd: plan.agent.cwd,
    logFile: plan.agent.logFile,
    env: plan.agent.env,
    isolation: plan.isolation,
    sandboxPolicy: plan.sandboxPolicy,
    rootDir: config.rootDir,
    workspaceId: workspace.id,
    label: 'agent'
  });
  const idePid = ideSpawn.pid;
  const agentPid = agentSpawn.pid;

  let state = persistState(config, workspace.id, {
    ...stateBase,
    processes: {
      idePid,
      agentPid
    },
    lastProvisionError: null,
    blockers: []
  });

  try {
    await waitForUrl(plan.ide.healthUrl, 120000, response => response.ok);
    await waitForUrl(plan.agent.healthUrl, 120000, response => response.ok);
    state = persistState(config, workspace.id, {
      ...state,
      updatedAt: nowIso(),
      observed: {
        ideRootResponding: true,
        agentHealthResponding: true,
        agentDocsUrl: plan.agent.docsUrl
      }
    });

    return {
      state,
      created: true,
      blocked: false
    };
  } catch (error) {
    terminatePid(idePid, 'SIGTERM');
    terminatePid(agentPid, 'SIGTERM');
    await waitForPidExit(idePid, 2000);
    await waitForPidExit(agentPid, 2000);

    state = persistState(config, workspace.id, {
      ...state,
      updatedAt: nowIso(),
      lastProvisionError: error instanceof Error ? error.message : String(error),
      processes: {
        idePid: isPidRunning(idePid) ? idePid : null,
        agentPid: isPidRunning(agentPid) ? agentPid : null
      },
      logTail: {
        ide: tailFile(plan.ide.logFile),
        agent: tailFile(plan.agent.logFile)
      }
    });

    return {
      state,
      created: false,
      blocked: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}




async function provisionRemoteExecutorRuntime(config, workspace, paths, current, driver, capabilities, idePort, agentPort) {
  const executor = await ensureRemoteExecutorDaemon(config);
  const plan = buildRealLocalLaunchPlan(config, workspace, paths, { ide: idePort, agent: agentPort }, driver);
  const preflight = evaluateLaunchPlan(plan);
  const stateBase = {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    driver,
    capabilities,
    startedAt: nowIso(),
    updatedAt: nowIso(),
    ports: { ide: idePort, agent: agentPort },
    urls: { ide: buildServiceUrl(config, idePort), agent: buildServiceUrl(config, agentPort) },
    paths: {
      rootDir: paths.instanceDir,
      fsDir: paths.fsDir,
      homeDir: paths.homeDir,
      runtimeDir: paths.runtimeDir,
      logsDir: paths.logsDir,
      configDir: paths.configDir,
      envFile: paths.envFile,
      provisionFile: paths.provisionFile,
      volumeDir: paths.volumeDir,
      retentionDir: paths.retentionDir,
      secretStoreDir: paths.secretStoreDir,
      prebuildDir: paths.prebuildDir,
      volumeMetadataFile: paths.volumeMetadataFile,
      lifecyclePolicyFile: paths.lifecyclePolicyFile,
      secretEnvFile: paths.secretEnvFile,
      secretManifestFile: paths.secretManifestFile,
      prebuildManifestFile: paths.prebuildManifestFile
    },
    logs: { ide: plan.ide.logFile, agent: plan.agent.logFile, executor: config.paths.remoteExecutorLogFile },
    launchPlan: {
      ide: { command: plan.ide.command, args: plan.ide.args, cwd: plan.ide.cwd, healthUrl: plan.ide.healthUrl },
      agent: { command: plan.agent.command, args: plan.agent.args, cwd: plan.agent.cwd, healthUrl: plan.agent.healthUrl, docsUrl: plan.agent.docsUrl }
    },
    preflight,
    dependencyLanes: {
      ...plan.dependencyLanes,
      remoteExecutorUrl: executor.url,
      note: 'Stage 4 runs workspace processes under a detached remote executor daemon with durable workspace volumes.'
    },
    executor: {
      pid: executor.pid,
      url: executor.url,
      stateFile: config.paths.remoteExecutorStateFile,
      runtimesFile: config.paths.remoteExecutorRuntimesFile,
      logFile: config.paths.remoteExecutorLogFile,
      remoteExecutor: true
    },
    runtimeMode: { ide: plan.ide.mode, agent: plan.agent.mode },
    lifecycle: readJson(paths.lifecyclePolicyFile, null),
    secrets: readJson(paths.secretManifestFile, null),
    prebuild: readJson(paths.prebuildManifestFile, null),
    previousDriver: current?.driver || null,
    isolation: plan.isolation,
    sandbox: { ide: plan.sandboxPolicy, agent: plan.sandboxPolicy },
    egressPolicy: plan.egressPolicy,
    storage: {
      durableVolume: true,
      volumeDir: paths.volumeDir,
      retentionDir: paths.retentionDir,
      secretStoreDir: paths.secretStoreDir,
      prebuildDir: paths.prebuildDir
    }
  };

  stateBase.capabilities = {
    ...capabilities,
    fullTheiaRuntime: Boolean(plan.dependencyLanes.fullTheiaRuntime),
    fullOpenHandsRuntime: Boolean(plan.dependencyLanes.fullOpenHandsRuntime),
    remoteExecutor: true,
    equivalentIsolation: true,
    durableVolume: true,
    machineProfiles: true,
    secretInjection: true,
    lifecyclePolicy: true
  };

  if (!preflight.ok) {
    const state = persistState(config, workspace.id, {
      ...stateBase,
      processes: { idePid: null, agentPid: null },
      lastProvisionError: 'Remote executor is blocked by missing prerequisites.',
      blockers: preflight.blockers
    });
    return { state, created: false, blocked: true };
  }

  const payload = {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    plan,
    ports: stateBase.ports,
    urls: stateBase.urls,
    paths: stateBase.paths,
    runtimeMode: stateBase.runtimeMode,
    capabilities: stateBase.capabilities,
    lifecycle: stateBase.lifecycle,
    secrets: stateBase.secrets,
    prebuild: stateBase.prebuild,
    isolation: stateBase.isolation,
    sandboxPolicy: plan.sandboxPolicy,
    egressPolicy: stateBase.egressPolicy
  };
  const remote = await requestJson(`${executor.url}/workspaces/start`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  let state = persistState(config, workspace.id, {
    ...stateBase,
    processes: remote.runtime?.processes || { idePid: null, agentPid: null },
    lastProvisionError: null,
    blockers: []
  });
  try {
    await waitForUrl(plan.ide.healthUrl, 120000, response => response.ok);
    await waitForUrl(plan.agent.healthUrl, 120000, response => response.ok);
    state = persistState(config, workspace.id, {
      ...state,
      updatedAt: nowIso(),
      observed: {
        ideRootResponding: true,
        agentHealthResponding: true,
        agentDocsUrl: plan.agent.docsUrl,
        remoteExecutorResponding: true
      }
    });
    return { state, created: true, blocked: false };
  } catch (error) {
    try {
      await requestJson(`${executor.url}/workspaces/stop`, { method: 'POST', body: JSON.stringify({ workspaceId: workspace.id }) });
    } catch {}
    state = persistState(config, workspace.id, {
      ...state,
      updatedAt: nowIso(),
      lastProvisionError: error instanceof Error ? error.message : String(error),
      logTail: { ide: tailFile(plan.ide.logFile), agent: tailFile(plan.agent.logFile), executor: tailFile(config.paths.remoteExecutorLogFile) }
    });
    return { state, created: false, blocked: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function getWorkspaceSandboxPaths(config, workspaceId) {
  const instanceDir = workspaceInstanceDir(config, workspaceId);
  const volumeDir = path.join(config.paths.workspaceVolumeRootDir, workspaceId);
  const runtimeDir = workspaceRuntimeDir(config, workspaceId);
  return {
    instanceDir,
    volumeDir,
    fsDir: path.join(volumeDir, 'fs'),
    homeDir: path.join(volumeDir, 'home'),
    runtimeDir,
    logsDir: path.join(runtimeDir, 'logs'),
    configDir: path.join(volumeDir, 'config'),
    retentionDir: path.join(config.paths.workspaceRetentionRootDir, workspaceId),
    secretStoreDir: path.join(config.paths.workspaceSecretsRootDir, workspaceId),
    prebuildDir: path.join(config.paths.workspacePrebuildRootDir, workspaceId),
    stateFile: workspaceStateFile(config, workspaceId),
    envFile: path.join(volumeDir, 'config', 'workspace-env.json'),
    provisionFile: path.join(volumeDir, 'config', 'repo-provisioning.json'),
    volumeMetadataFile: path.join(volumeDir, 'config', 'volume-metadata.json'),
    lifecyclePolicyFile: path.join(volumeDir, 'config', 'lifecycle-policy.json'),
    secretEnvFile: path.join(config.paths.workspaceSecretsRootDir, workspaceId, 'workspace.secrets.env'),
    secretManifestFile: path.join(volumeDir, 'config', 'secret-bundle.json'),
    prebuildManifestFile: path.join(config.paths.workspacePrebuildRootDir, workspaceId, 'prebuild-manifest.json')
  };
}

function parseEnvExampleToObject(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {};
  }

  const output = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = String(rawLine || '').trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separator = line.indexOf('=');
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key) {
      output[key] = value;
    }
  }

  return output;
}
function copyProvisionSource(sourcePath, targetPath) {
  const stats = fs.statSync(sourcePath);
  if (stats.isDirectory()) {
    fs.cpSync(sourcePath, targetPath, {
      recursive: true,
      errorOnExist: false,
      force: false,
      filter: item => {
        const base = path.basename(item);
        if (base === 'node_modules' || base === '.git' || base === '.skyequanta' || base === 'workspace') {
          return false;
        }
        return true;
      }
    });
    return;
  }

  ensureDirectory(path.dirname(targetPath));
  if (!fs.existsSync(targetPath)) {
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function ensureWorkspaceProvisionedFromRepo(config, workspace, paths) {
  const manifest = Array.isArray(config.paths.workspaceProvisionManifest) ? config.paths.workspaceProvisionManifest : [];
  const existing = readJson(paths.provisionFile, null);
  if (existing?.version === 1) {
    if (!fs.existsSync(paths.envFile)) {
      writeJson(paths.envFile, {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        source: 'config/env.example',
        values: parseEnvExampleToObject(config.paths.workspaceEnvExample)
      });
    }
    return existing;
  }

  const copied = [];
  for (const relativePath of manifest) {
    const sourcePath = path.join(config.rootDir, relativePath);
    if (!fs.existsSync(sourcePath)) {
      continue;
    }
    const targetPath = path.join(paths.fsDir, relativePath);
    copyProvisionSource(sourcePath, targetPath);
    copied.push(relativePath);
  }

  const envValues = parseEnvExampleToObject(config.paths.workspaceEnvExample);
  writeJson(paths.envFile, {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    source: 'config/env.example',
    values: envValues
  });

  const provisioned = {
    version: 1,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    sourceRoot: config.rootDir,
    createdAt: nowIso(),
    manifest,
    copied,
    envFile: paths.envFile,
    repoContract: {
      devcontainerPath: '.devcontainer/devcontainer.json',
      envExamplePath: 'config/env.example'
    }
  };
  writeJson(paths.provisionFile, provisioned);
  writeJson(path.join(paths.fsDir, '.skyequanta-provisioning.json'), provisioned);
  return provisioned;
}


function ensureWorkspaceLifecycleAndSecrets(config, workspace, paths) {
  const machineProfile = resolveMachineProfile(config, workspace.machineProfile);
  const lifecyclePolicy = buildLifecyclePolicy(config, machineProfile);
  writeJson(paths.lifecyclePolicyFile, {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    updatedAt: nowIso(),
    ...lifecyclePolicy
  });

  const secretEntries = collectInjectableSecrets(config);
  ensureDirectory(paths.secretStoreDir);
  const secretEnvLines = secretEntries.map(entry => `${entry.key}=${entry.value}`);
  fs.writeFileSync(paths.secretEnvFile, `${secretEnvLines.join('\n')}${secretEnvLines.length ? '\n' : ''}`, 'utf8');
  writeJson(paths.secretManifestFile, {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    updatedAt: nowIso(),
    injected: secretEntries.map(entry => entry.key),
    count: secretEntries.length,
    secretEnvFile: paths.secretEnvFile
  });

  const devcontainerHash = sha256OfFile(path.join(paths.fsDir, '.devcontainer', 'devcontainer.json'));
  writeJson(paths.prebuildManifestFile, {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    updatedAt: nowIso(),
    machineProfile,
    devcontainerHash,
    prebuildKey: devcontainerHash ? `${machineProfile.name}:${devcontainerHash.slice(0, 16)}` : `${machineProfile.name}:none`,
    repoContractPath: '.devcontainer/devcontainer.json'
  });

  return {
    machineProfile,
    lifecyclePolicy,
    secretEntries,
    prebuild: readJson(paths.prebuildManifestFile, null)
  };
}

function ensureWorkspaceFilesystem(config, workspace) {
  const paths = getWorkspaceSandboxPaths(config, workspace.id);
  ensureDirectory(paths.instanceDir);
  ensureDirectory(paths.volumeDir);
  ensureDirectory(paths.fsDir);
  ensureDirectory(paths.homeDir);
  ensureDirectory(paths.runtimeDir);
  ensureDirectory(paths.logsDir);
  ensureDirectory(paths.configDir);
  ensureDirectory(paths.retentionDir);
  ensureDirectory(paths.secretStoreDir);
  ensureDirectory(paths.prebuildDir);

  const markerFile = path.join(paths.fsDir, '.skyequanta-workspace.json');
  if (!fs.existsSync(markerFile)) {
    writeJson(markerFile, {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      createdAt: nowIso(),
      durableVolume: true
    });
  }

  if (!fs.existsSync(paths.volumeMetadataFile)) {
    writeJson(paths.volumeMetadataFile, {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      durableVolume: true,
      createdAt: nowIso(),
      fsDir: paths.fsDir,
      homeDir: paths.homeDir,
      retentionDir: paths.retentionDir
    });
  }

  const provisioning = ensureWorkspaceProvisionedFromRepo(config, workspace, paths);
  if (provisioning && !fs.existsSync(path.join(paths.fsDir, '.skyequanta-provisioning.json'))) {
    writeJson(path.join(paths.fsDir, '.skyequanta-provisioning.json'), provisioning);
  }

  const lifecycle = ensureWorkspaceLifecycleAndSecrets(config, workspace, paths);
  return {
    ...paths,
    lifecycle
  };
}

export function getWorkspaceRuntimeState(config, workspaceId) {
  const stateFile = workspaceStateFile(config, workspaceId);
  return readJson(stateFile, null);
}

export function getWorkspaceRuntimeStatus(config, workspace) {
  const state = getWorkspaceRuntimeState(config, workspace.id);
  if (!state) {
    return {
      exists: false,
      running: false,
      reason: 'not_provisioned'
    };
  }

  const ideAlive = isPidRunning(state?.processes?.idePid);
  const agentAlive = isPidRunning(state?.processes?.agentPid);
  const running = ideAlive && agentAlive && !state?.lastProvisionError;
  return {
    exists: true,
    running,
    ideAlive,
    agentAlive,
    driver: state?.driver || DEFAULT_WORKSPACE_DRIVER,
    serviceMode: state?.capabilities?.serviceMode || 'unknown',
    idePort: state?.ports?.ide || null,
    agentPort: state?.ports?.agent || null,
    startedAt: state.startedAt || null,
    updatedAt: state.updatedAt || null,
    rootDir: state?.paths?.rootDir || null,
    fsDir: state?.paths?.fsDir || null,
    reason: state?.lastProvisionError || null,
    blockers: state?.blockers || [],
    remoteExecutor: Boolean(state?.capabilities?.remoteExecutor),
    containerized: Boolean(state?.capabilities?.containerized),
    equivalentIsolation: Boolean(state?.capabilities?.equivalentIsolation),
    durableVolume: Boolean(state?.capabilities?.durableVolume)
  };
}

function getPortRanges() {
  const start = readInteger(process.env.SKYEQUANTA_SANDBOX_PORT_START, 4100);
  const end = readInteger(process.env.SKYEQUANTA_SANDBOX_PORT_END, 5200);
  return {
    start,
    end
  };
}

export async function provisionWorkspaceRuntime(config, workspace) {
  repairArchiveStrippedRuntimeDependencies(config);
  const startupLock = acquireStartupLock(config, workspace.id, { holder: 'workspace-runtime.provision' });
  if (!startupLock.acquired) {
    throw new Error(`Workspace '${workspace.id}' is already being provisioned by pid ${startupLock.lock?.pid || 'unknown'}.`);
  }
  appendRecoveryJournal(config, {
    action: 'runtime_provision_started',
    workspaceId: workspace.id,
    detail: { holder: 'workspace-runtime.provision' }
  });
  try {
    const paths = ensureWorkspaceFilesystem(config, workspace);
    const current = getWorkspaceRuntimeState(config, workspace.id);
    const driver = getWorkspaceRuntimeDriver();

    if (current && current.driver === driver && isPidRunning(current?.processes?.idePid) && isPidRunning(current?.processes?.agentPid) && !current?.lastProvisionError) {
      appendRecoveryJournal(config, {
        action: 'runtime_provision_short_circuit',
        workspaceId: workspace.id,
        detail: { reason: 'already_running', driver }
      });
      return {
        state: current,
        created: false
      };
    }

    if (current && (isPidRunning(current?.processes?.idePid) || isPidRunning(current?.processes?.agentPid))) {
      await stopWorkspaceRuntime(config, workspace.id);
    }

    const capabilities = getDriverCapabilities(driver);
    const { start, end } = getPortRanges();
    const reservedPorts = collectReservedRuntimePorts(config, workspace.id);
    const idePort = await findFreePort(config.host, current?.ports?.ide || start, end, reservedPorts);
    reservedPorts.add(idePort);
    const agentPort = await findFreePort(config.host, Math.max(idePort + 1, current?.ports?.agent || start), end, reservedPorts);

    let result = null;
    if (driver === STUB_WORKSPACE_DRIVER) {
      result = await provisionStubRuntime(config, workspace, paths, current, driver, capabilities, idePort, agentPort);
    } else if (driver === REAL_LOCAL_EXECUTOR_DRIVER) {
      result = await provisionRealLocalRuntime(config, workspace, paths, current, driver, capabilities, idePort, agentPort);
    } else if (driver === REMOTE_EXECUTOR_DRIVER) {
      result = await provisionRemoteExecutorRuntime(config, workspace, paths, current, driver, capabilities, idePort, agentPort);
    } else {
      throw new Error(`No provisioner implemented for driver '${driver}'.`);
    }

    appendRecoveryJournal(config, {
      action: 'runtime_provision_completed',
      workspaceId: workspace.id,
      detail: { driver, created: Boolean(result?.created), idePort, agentPort }
    });
    return result;
  } catch (error) {
    appendRecoveryJournal(config, {
      action: 'runtime_provision_failed',
      workspaceId: workspace.id,
      detail: { message: error instanceof Error ? error.message : String(error) }
    });
    throw error;
  } finally {
    releaseStartupLock(config, workspace.id, { holder: 'workspace-runtime.provision' });
  }
}

function terminatePid(pid, signal) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return;
  }

  try {
    process.kill(pid, signal);
  } catch {
    // Already exited.
  }
}

async function waitForPidExit(pid, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!isPidRunning(pid)) {
      return;
    }

    await new Promise(resolve => {
      setTimeout(resolve, 100);
    });
  }
}

export async function stopWorkspaceRuntime(config, workspaceId) {
  const state = getWorkspaceRuntimeState(config, workspaceId);
  if (!state) {
    return {
      stopped: false,
      reason: 'not_provisioned'
    };
  }

  const idePid = state?.processes?.idePid;
  const agentPid = state?.processes?.agentPid;

  if (state?.capabilities?.remoteExecutor && state?.executor?.url) {
    try {
      const stopSignal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(Number.parseInt(String(process.env.SKYEQUANTA_REMOTE_STOP_TIMEOUT_MS || '5000'), 10) || 5000)
        : undefined;
      await requestJson(`${state.executor.url}/workspaces/stop`, {
        method: 'POST',
        body: JSON.stringify({ workspaceId }),
        signal: stopSignal
      });
    } catch {
      terminatePid(idePid, 'SIGTERM');
      terminatePid(agentPid, 'SIGTERM');
    }
  } else {
    terminatePid(idePid, 'SIGTERM');
    terminatePid(agentPid, 'SIGTERM');
  }
  await waitForPidExit(idePid);
  await waitForPidExit(agentPid);

  if (isPidRunning(idePid)) {
    terminatePid(idePid, 'SIGKILL');
  }

  if (isPidRunning(agentPid)) {
    terminatePid(agentPid, 'SIGKILL');
  }

  const next = {
    ...state,
    updatedAt: nowIso(),
    stoppedAt: nowIso(),
    processes: {
      idePid: null,
      agentPid: null
    }
  };

  writeJson(workspaceStateFile(config, workspaceId), next);
  appendRecoveryJournal(config, {
    action: 'runtime_stopped',
    workspaceId,
    detail: { idePid, agentPid, remoteExecutor: Boolean(state?.capabilities?.remoteExecutor) }
  });
  releaseStartupLock(config, workspaceId, { holder: 'workspace-runtime.stop' });
  return {
    stopped: true,
    state: next
  };
}
