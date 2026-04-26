import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildRuntimeContainment, detectRuntimeContainmentSupport, getRuntimeContainmentPolicy } from './runtime-containment.mjs';
import { prepareAppArmorExecutionPolicy } from './apparmor-policy.mjs';

function readString(value) {
  return String(value ?? '').trim();
}

function readBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  const normalized = readString(value).toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function readInteger(value, fallback) {
  const parsed = Number.parseInt(readString(value), 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function shellQuote(value) {
  const stringValue = String(value ?? '');
  if (!stringValue) return "''";
  if (/^[A-Za-z0-9_./:=+\-]+$/.test(stringValue)) return stringValue;
  return `'${stringValue.replace(/'/g, `'\\''`)}'`;
}

function resolveBinary(command) {
  const result = spawnSync('bash', ['-lc', `command -v ${shellQuote(command)} || true`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  });
  const resolved = String(result.stdout || '').trim().split(/\r?\n/).filter(Boolean)[0] || null;
  return resolved && fs.existsSync(resolved) ? resolved : null;
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function normalizeMode(rawMode) {
  const normalized = readString(rawMode).toLowerCase();
  if (!normalized) return 'auto';
  if (['auto', 'off', 'rootless-namespace', 'process'].includes(normalized)) return normalized;
  return 'auto';
}

export function getRuntimeSandboxPolicy(env = process.env) {
  return {
    requestedMode: normalizeMode(env.SKYEQUANTA_RUNTIME_SANDBOX_MODE),
    strict: readBoolean(env.SKYEQUANTA_RUNTIME_SANDBOX_STRICT, false),
    userNamespace: readBoolean(env.SKYEQUANTA_RUNTIME_SANDBOX_USER_NS, true),
    mountNamespace: readBoolean(env.SKYEQUANTA_RUNTIME_SANDBOX_MOUNT_NS, true),
    pidNamespace: readBoolean(env.SKYEQUANTA_RUNTIME_SANDBOX_PID_NS, true),
    blockNetwork: readBoolean(env.SKYEQUANTA_RUNTIME_SANDBOX_BLOCK_NETWORK, true),
    mountScratchTmpfs: readBoolean(env.SKYEQUANTA_RUNTIME_SANDBOX_TMPFS, true),
    scratchSizeMb: Math.max(16, readInteger(env.SKYEQUANTA_RUNTIME_SANDBOX_TMPFS_MB, 64)),
    cpuSeconds: Math.max(1, readInteger(env.SKYEQUANTA_RUNTIME_LIMIT_CPU_SECONDS, 10)),
    memoryMb: Math.max(256, readInteger(env.SKYEQUANTA_RUNTIME_LIMIT_MEMORY_MB, 2048)),
    processCount: Math.max(8, readInteger(env.SKYEQUANTA_RUNTIME_LIMIT_NPROC, 256)),
    fileHandles: Math.max(32, readInteger(env.SKYEQUANTA_RUNTIME_LIMIT_NOFILE, 256)),
    enableResourceLimits: readBoolean(env.SKYEQUANTA_RUNTIME_LIMITS_ENABLED, true),
    appArmorProfile: readString(env.SKYEQUANTA_RUNTIME_APPARMOR_PROFILE),
    appArmorStrict: readBoolean(env.SKYEQUANTA_RUNTIME_APPARMOR_STRICT, false)
  };
}

export function detectRuntimeSandboxSupport(env = process.env) {
  const isLinux = process.platform === 'linux';
  return {
    isLinux,
    unshare: isLinux ? resolveBinary(readString(env.SKYEQUANTA_UNSHARE_BIN) || 'unshare') : null,
    prlimit: isLinux ? resolveBinary(readString(env.SKYEQUANTA_PRLIMIT_BIN) || 'prlimit') : null,
    setpriv: isLinux ? resolveBinary(readString(env.SKYEQUANTA_SETPRIV_BIN) || 'setpriv') : null,
    bash: resolveBinary(readString(env.SKYEQUANTA_BASH_BIN) || 'bash') || resolveBinary('sh')
  };
}

export function resolveRuntimeSandboxMode(policy = {}, support = detectRuntimeSandboxSupport()) {
  if (policy.requestedMode === 'off') return 'off';
  if (policy.requestedMode === 'process') return 'process';
  if (policy.requestedMode === 'rootless-namespace') {
    if (!support.isLinux || !support.unshare || !support.bash) {
      if (policy.strict) throw new Error('Runtime sandbox strict mode failed: rootless namespace tooling is unavailable.');
      return 'process';
    }
    return 'rootless-namespace';
  }
  if (policy.requestedMode === 'auto') {
    return 'process';
  }
  if (support.isLinux && support.unshare && support.bash) return 'rootless-namespace';
  return 'process';
}

export function getRuntimeResourceLimits(policy = {}) {
  return {
    enabled: Boolean(policy.enableResourceLimits),
    cpuSeconds: Math.max(1, readInteger(policy.cpuSeconds, 10)),
    memoryBytes: Math.max(256 * 1024 * 1024, readInteger(policy.memoryMb, 2048) * 1024 * 1024),
    processCount: Math.max(8, readInteger(policy.processCount, 128)),
    fileHandles: Math.max(32, readInteger(policy.fileHandles, 256))
  };
}

function commandNeedsWideAddressSpace(command = '') {
  const name = path.basename(String(command || '')).toLowerCase();
  return ['node', 'nodejs', 'python', 'python3', 'python3.10', 'python3.11', 'python3.12', 'python3.13'].includes(name);
}

function buildPrlimitArgs(limits, options = {}) {
  if (!limits?.enabled) return [];
  const args = [
    `--cpu=${limits.cpuSeconds}`,
    `--nproc=${limits.processCount}`,
    `--nofile=${limits.fileHandles}:${limits.fileHandles}`
  ];
  if (!options.disableAddressSpaceLimit && Number.isFinite(limits.memoryBytes) && limits.memoryBytes > 0) {
    args.splice(1, 0, `--as=${limits.memoryBytes}`);
  }
  return args;
}


function applyAppArmorLaunch(launch, appArmorPolicy) {
  if (!appArmorPolicy) {
    return { ...launch, appArmor: null };
  }
  if (!appArmorPolicy.active || !appArmorPolicy.wrapperCommand) {
    return {
      ...launch,
      appArmor: {
        enabled: Boolean(appArmorPolicy.enabled),
        active: false,
        strict: Boolean(appArmorPolicy.strict),
        reason: appArmorPolicy.reason || 'inactive',
        profileName: appArmorPolicy.profileName || null,
        bundle: appArmorPolicy.bundle
      }
    };
  }
  return {
    ...launch,
    command: appArmorPolicy.wrapperCommand,
    args: [...(appArmorPolicy.wrapperArgs || []), launch.command, ...(launch.args || [])],
    appArmor: {
      enabled: true,
      active: true,
      strict: Boolean(appArmorPolicy.strict),
      reason: appArmorPolicy.reason || 'ready',
      profileName: appArmorPolicy.profileName || null,
      bundle: appArmorPolicy.bundle
    }
  };
}

function buildInnerShellCommand(command, args, options = {}) {
  const cwd = path.resolve(String(options.cwd || process.cwd()));
  const scratchDir = path.resolve(String(options.scratchDir || path.join(cwd, '.skyequanta-sandbox')));
  const quotedScratch = shellQuote(scratchDir);
  const mountScratch = options.policy?.mountScratchTmpfs
    ? `mkdir -p ${quotedScratch}; (command -v mountpoint >/dev/null 2>&1 && mountpoint -q ${quotedScratch}) || mount -t tmpfs -o size=${Math.max(16, options.policy.scratchSizeMb || 64)}m skyequanta-sandbox ${quotedScratch} >/dev/null 2>&1 || true; `
    : '';
  const prlimit = options.support?.prlimit && options.limits?.enabled
    ? `${shellQuote(options.support.prlimit)} ${buildPrlimitArgs(options.limits, { disableAddressSpaceLimit: commandNeedsWideAddressSpace(command) }).map(shellQuote).join(' ')} -- `
    : '';
  const containment = buildRuntimeContainment(command, args, {
    env: options.env || process.env,
    rootDir: options.rootDir || cwd,
    cwd,
    scratchDir,
    workspaceId: options.workspaceId,
    label: options.label,
    sandboxMode: options.sandboxMode,
    policy: options.containmentPolicy || getRuntimeContainmentPolicy(options.env || process.env),
    support: options.containmentSupport || detectRuntimeContainmentSupport(options.env || process.env)
  });
  let containmentShell = containment.shellCommand || '';
  if (containmentShell && prlimit && !containment.metadata?.rootfs?.enabled) {
    containmentShell = containmentShell.replace('exec ', `exec ${prlimit}`);
  }
  const execCommand = containmentShell || `cd ${shellQuote(cwd)}; exec ${prlimit}${[shellQuote(command), ...args.map(shellQuote)].join(' ')}`;
  return {
    command: `${mountScratch}${execCommand}`,
    containment
  };
}

export function buildRuntimeSandboxLaunch(command, args = [], options = {}) {
  const env = options.env || process.env;
  const policy = options.policy || getRuntimeSandboxPolicy(env);
  const support = options.support || detectRuntimeSandboxSupport(env);
  const effectiveMode = resolveRuntimeSandboxMode(policy, support);
  const limits = getRuntimeResourceLimits(policy);
  const workspaceId = readString(options.workspaceId) || 'shared';
  const label = readString(options.label) || 'runtime';
  const scratchDir = path.resolve(String(options.scratchDir || path.join(options.rootDir || process.cwd(), '.skyequanta', 'runtime-sandbox', workspaceId, label)));
  ensureDirectory(scratchDir);

  const containmentPolicy = getRuntimeContainmentPolicy(env);
  const containmentSupport = detectRuntimeContainmentSupport(env);
  const appArmorPolicy = prepareAppArmorExecutionPolicy(options.rootDir || process.cwd(), {
    env,
    workspaceId,
    label,
    workspaceDir: options.cwd || process.cwd(),
    requestedProfile: policy.appArmorProfile,
    strict: policy.appArmorStrict
  });

  if (effectiveMode === 'off' || effectiveMode === 'process') {
    const processContainment = buildRuntimeContainment(command, args, {
      env,
      rootDir: options.rootDir || process.cwd(),
      cwd: options.cwd,
      scratchDir,
      workspaceId,
      label,
      sandboxMode: support.prlimit && limits.enabled ? 'prlimit-process' : 'process',
      policy: containmentPolicy,
      support: containmentSupport
    });
    const envAdditions = {
      SKYEQUANTA_SANDBOX_SCRATCH_DIR: scratchDir,
      SKYEQUANTA_RUNTIME_LIMIT_MEMORY_BYTES: String(limits.memoryBytes),
      SKYEQUANTA_RUNTIME_LIMIT_CPU_SECONDS: String(limits.cpuSeconds),
      SKYEQUANTA_RUNTIME_LIMIT_NPROC: String(limits.processCount),
      SKYEQUANTA_RUNTIME_LIMIT_NOFILE: String(limits.fileHandles),
      SKYEQUANTA_RUNTIME_SANDBOX_EFFECTIVE_MODE: support.prlimit && limits.enabled ? 'prlimit-process' : 'process',
      ...(processContainment.envAdditions || {})
    };
    const wrappedProcessCommand = processContainment.shellCommand
      ? `${support.prlimit && limits.enabled ? `${shellQuote(support.prlimit)} ${buildPrlimitArgs(limits, { disableAddressSpaceLimit: commandNeedsWideAddressSpace(command) }).map(shellQuote).join(' ')} -- ` : ''}${shellQuote(support.bash || 'bash')} -c ${shellQuote(processContainment.shellCommand)}`
      : null;
    if (wrappedProcessCommand) {
      return applyAppArmorLaunch({
        policy,
        support,
        limits,
        effectiveMode: support.prlimit ? 'prlimit-process' : 'process',
        command: support.bash || 'bash',
        args: ['-c', wrappedProcessCommand],
        cwd: options.cwd,
        scratchDir,
        envAdditions,
        containment: processContainment.metadata,
        usedRootlessNamespace: false,
        usedPrlimit: Boolean(support.prlimit && limits.enabled)
      }, appArmorPolicy);
    }
    if (support.prlimit && limits.enabled) {
      return applyAppArmorLaunch({
        policy,
        support,
        limits,
        effectiveMode: support.prlimit ? 'prlimit-process' : 'process',
        command: support.prlimit || command,
        args: support.prlimit ? [...buildPrlimitArgs(limits, { disableAddressSpaceLimit: commandNeedsWideAddressSpace(command) }), '--', command, ...args] : args,
        cwd: options.cwd,
        scratchDir,
        envAdditions,
        containment: processContainment.metadata,
        usedRootlessNamespace: false,
        usedPrlimit: Boolean(support.prlimit && limits.enabled)
      }, appArmorPolicy);
    }
    return applyAppArmorLaunch({
      policy,
      support,
      limits,
      effectiveMode: 'process',
      command,
      args,
      cwd: options.cwd,
      scratchDir,
      envAdditions,
      containment: processContainment.metadata,
      usedRootlessNamespace: false,
      usedPrlimit: false
    }, appArmorPolicy);
  }

  const unshareArgs = [];
  if (policy.userNamespace) unshareArgs.push('--user', '--map-current-user');
  if (policy.mountNamespace) unshareArgs.push('--mount');
  if (policy.pidNamespace) unshareArgs.push('--pid', '--fork', '--mount-proc');
  if (policy.blockNetwork) unshareArgs.push('--net');
  const innerCommand = buildInnerShellCommand(command, args, {
    cwd: options.cwd,
    rootDir: options.rootDir || process.cwd(),
    scratchDir,
    policy,
    limits,
    support,
    env,
    workspaceId,
    label,
    sandboxMode: 'rootless-namespace',
    containmentPolicy,
    containmentSupport
  });
  const execChain = [];
  if (support.setpriv) {
    execChain.push(support.setpriv, '--no-new-privs');
  }
  execChain.push(support.bash, '-c', innerCommand.command);
  return applyAppArmorLaunch({
    policy,
    support,
    limits,
    effectiveMode: 'rootless-namespace',
    command: support.unshare,
    args: [...unshareArgs, ...execChain],
    cwd: options.cwd || process.cwd(),
    scratchDir,
    envAdditions: {
      SKYEQUANTA_SANDBOX_SCRATCH_DIR: scratchDir,
      SKYEQUANTA_RUNTIME_LIMIT_MEMORY_BYTES: String(limits.memoryBytes),
      SKYEQUANTA_RUNTIME_LIMIT_CPU_SECONDS: String(limits.cpuSeconds),
      SKYEQUANTA_RUNTIME_LIMIT_NPROC: String(limits.processCount),
      SKYEQUANTA_RUNTIME_LIMIT_NOFILE: String(limits.fileHandles),
      SKYEQUANTA_RUNTIME_SANDBOX_EFFECTIVE_MODE: 'rootless-namespace',
      ...(innerCommand.containment?.envAdditions || {})
    },
    innerCommand: innerCommand.command,
    containment: innerCommand.containment?.metadata || innerCommand.containment || null,
    usedRootlessNamespace: true,
    usedPrlimit: Boolean(support.prlimit && limits.enabled)
  }, appArmorPolicy);
}

function readProcFile(procPath) {
  try {
    return fs.readFileSync(procPath, 'utf8');
  } catch {
    return '';
  }
}

function readNamespaceLink(pid, nsType) {
  const target = pid === 'self' ? `/proc/self/ns/${nsType}` : `/proc/${pid}/ns/${nsType}`;
  try {
    return fs.readlinkSync(target);
  } catch {
    return null;
  }
}

export function observeLinuxProcessConfinement(pid = 'self') {
  const statusPath = pid === 'self' ? '/proc/self/status' : `/proc/${pid}/status`;
  const status = readProcFile(statusPath);
  const statusMap = {};
  for (const line of status.split(/\r?\n/)) {
    const index = line.indexOf(':');
    if (index === -1) continue;
    statusMap[line.slice(0, index)] = line.slice(index + 1).trim();
  }
  const appArmorCurrent = readProcFile(pid === 'self' ? '/proc/self/attr/current' : `/proc/${pid}/attr/current`).trim() || null;
  return {
    pid: pid === 'self' ? process.pid : Number.parseInt(String(pid), 10) || null,
    uid: statusMap.Uid || null,
    gid: statusMap.Gid || null,
    pidInNamespace: statusMap.Pid || null,
    seccompMode: statusMap.Seccomp || null,
    noNewPrivs: statusMap.NoNewPrivs || null,
    appArmorCurrent,
    namespaces: {
      user: readNamespaceLink(pid, 'user'),
      pid: readNamespaceLink(pid, 'pid'),
      net: readNamespaceLink(pid, 'net'),
      mnt: readNamespaceLink(pid, 'mnt')
    }
  };
}

export function runSandboxedSync(command, args = [], options = {}) {
  const launch = buildRuntimeSandboxLaunch(command, args, options);
  const result = spawnSync(launch.command, launch.args, {
    cwd: launch.cwd,
    env: { ...(options.env || process.env), ...(launch.envAdditions || {}) },
    encoding: options.encoding || 'utf8',
    maxBuffer: options.maxBuffer || 16 * 1024 * 1024
  });
  return {
    ...launch,
    ok: result.status === 0,
    status: result.status,
    signal: result.signal,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || '')
  };
}
