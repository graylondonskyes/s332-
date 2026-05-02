import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

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

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resolveBinary(command) {
  const result = spawnSync('bash', ['-lc', `command -v ${shellQuote(command)} || true`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  });
  const resolved = String(result.stdout || '').trim().split(/\r?\n/).filter(Boolean)[0] || null;
  return resolved && fs.existsSync(resolved) ? resolved : null;
}

function sanitizeSegment(value) {
  const normalized = readString(value).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || 'shared';
}

function sha1Text(value) {
  return crypto.createHash('sha1').update(String(value || ''), 'utf8').digest('hex');
}

function readFileIfExists(filePath, fallback = '') {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return fallback;
  }
}

function translatePathForPivot(value, cwd) {
  const raw = String(value ?? '');
  if (!raw) return raw;
  const absoluteCwd = path.resolve(String(cwd || process.cwd()));
  if (!path.isAbsolute(raw)) return raw;
  const absoluteValue = path.resolve(raw);
  if (absoluteValue === absoluteCwd) return '/workspace';
  if (absoluteValue.startsWith(`${absoluteCwd}${path.sep}`)) {
    return `/workspace/${path.relative(absoluteCwd, absoluteValue).replace(/\\/g, '/')}`;
  }
  return absoluteValue;
}

function quoteCommand(command, args = []) {
  return [command, ...args].map(shellQuote).join(' ');
}

function buildCgroupName(workspaceId, label, scratchDir) {
  const basis = `${workspaceId}:${label}:${path.resolve(String(scratchDir || ''))}`;
  return `skq-${sanitizeSegment(workspaceId)}-${sanitizeSegment(label)}-${sha1Text(basis).slice(0, 12)}`;
}

export function getRuntimeContainmentPolicy(env = process.env) {
  return {
    enablePivotRootfs: readBoolean(env.SKYEQUANTA_RUNTIME_PIVOT_ROOTFS, false),
    enableCgroups: readBoolean(env.SKYEQUANTA_RUNTIME_CGROUPS_ENABLED, false),
    cgroupCpuQuotaPercent: Math.max(5, readInteger(env.SKYEQUANTA_RUNTIME_CGROUP_CPU_PERCENT, 60)),
    cgroupMemoryMb: Math.max(64, readInteger(env.SKYEQUANTA_RUNTIME_CGROUP_MEMORY_MB, 256)),
    cgroupPidsMax: Math.max(8, readInteger(env.SKYEQUANTA_RUNTIME_CGROUP_PIDS_MAX, 64)),
    enableSeccompBasic: readBoolean(env.SKYEQUANTA_RUNTIME_SECCOMP_BASIC, false)
  };
}

export function detectRuntimeContainmentSupport(env = process.env) {
  const isLinux = process.platform === 'linux';
  const cgroupRoots = {
    cpu: '/sys/fs/cgroup/cpu',
    memory: '/sys/fs/cgroup/memory',
    pids: '/sys/fs/cgroup/pids'
  };
  return {
    isLinux,
    chroot: isLinux ? resolveBinary(readString(env.SKYEQUANTA_CHROOT_BIN) || 'chroot') : null,
    mount: isLinux ? resolveBinary(readString(env.SKYEQUANTA_MOUNT_BIN) || 'mount') : null,
    gcc: isLinux ? resolveBinary(readString(env.SKYEQUANTA_GCC_BIN) || 'gcc') : null,
    node: resolveBinary(readString(env.SKYEQUANTA_NODE_BIN) || 'node'),
    python3: resolveBinary(readString(env.SKYEQUANTA_PYTHON_BIN) || 'python3') || resolveBinary('python'),
    cgroupRoots,
    cgroupCpu: isLinux && fs.existsSync(cgroupRoots.cpu),
    cgroupMemory: isLinux && fs.existsSync(cgroupRoots.memory),
    cgroupPids: isLinux && fs.existsSync(cgroupRoots.pids),
    appArmorEnabled: readFileIfExists('/sys/module/apparmor/parameters/enabled', 'N').trim() === 'Y'
  };
}

const BASIC_SECCOMP_WRAPPER_C = `#include <errno.h>
#include <linux/filter.h>
#include <linux/seccomp.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/syscall.h>
#include <unistd.h>

#define DENY_ERRNO(code) (SECCOMP_RET_ERRNO | ((code) & SECCOMP_RET_DATA))
#define ALLOW SECCOMP_RET_ALLOW
#define DENY_SYSCALL(num) BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, num, 0, 1), BPF_STMT(BPF_RET | BPF_K, DENY_ERRNO(EPERM))

static int install_filter(void) {
  struct sock_filter filter[] = {
    BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, nr)),
#ifdef __NR_socket
    DENY_SYSCALL(__NR_socket),
#endif
#ifdef __NR_socketpair
    DENY_SYSCALL(__NR_socketpair),
#endif
#ifdef __NR_connect
    DENY_SYSCALL(__NR_connect),
#endif
#ifdef __NR_accept
    DENY_SYSCALL(__NR_accept),
#endif
#ifdef __NR_accept4
    DENY_SYSCALL(__NR_accept4),
#endif
#ifdef __NR_bind
    DENY_SYSCALL(__NR_bind),
#endif
#ifdef __NR_listen
    DENY_SYSCALL(__NR_listen),
#endif
#ifdef __NR_mount
    DENY_SYSCALL(__NR_mount),
#endif
#ifdef __NR_umount2
    DENY_SYSCALL(__NR_umount2),
#endif
#ifdef __NR_pivot_root
    DENY_SYSCALL(__NR_pivot_root),
#endif
#ifdef __NR_ptrace
    DENY_SYSCALL(__NR_ptrace),
#endif
#ifdef __NR_setns
    DENY_SYSCALL(__NR_setns),
#endif
#ifdef __NR_unshare
    DENY_SYSCALL(__NR_unshare),
#endif
#ifdef __NR_clone3
    DENY_SYSCALL(__NR_clone3),
#endif
#ifdef __NR_process_vm_readv
    DENY_SYSCALL(__NR_process_vm_readv),
#endif
#ifdef __NR_process_vm_writev
    DENY_SYSCALL(__NR_process_vm_writev),
#endif
#ifdef __NR_bpf
    DENY_SYSCALL(__NR_bpf),
#endif
#ifdef __NR_perf_event_open
    DENY_SYSCALL(__NR_perf_event_open),
#endif
    BPF_STMT(BPF_RET | BPF_K, ALLOW)
  };
  struct sock_fprog prog = { .len = (unsigned short)(sizeof(filter) / sizeof(filter[0])), .filter = filter };
  if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0) {
    perror("PR_SET_NO_NEW_PRIVS");
    return -1;
  }
  if (prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER, &prog) != 0) {
    perror("PR_SET_SECCOMP");
    return -1;
  }
  return 0;
}

int main(int argc, char **argv) {
  int index = 1;
  if (argc > 1 && strcmp(argv[1], "--") == 0) index = 2;
  if (index >= argc) {
    fprintf(stderr, "usage: %s -- command [args...]\\n", argv[0]);
    return 64;
  }
  if (install_filter() != 0) return 111;
  execvp(argv[index], &argv[index]);
  perror("execvp");
  return 127;
}
`;

export function ensureBasicSeccompWrapper(rootDir, support = detectRuntimeContainmentSupport()) {
  if (!support.isLinux || !support.gcc) return { ok: false, reason: 'gcc_unavailable', binaryPath: null, sourcePath: null };
  const sourceDir = path.join(rootDir, '.skyequanta', 'cache', 'src');
  const binDir = path.join(rootDir, '.skyequanta', 'cache', 'bin');
  ensureDirectory(sourceDir);
  ensureDirectory(binDir);
  const sourcePath = path.join(sourceDir, 'skyequanta-seccomp-basic.c');
  const binaryPath = path.join(binDir, 'skyequanta-seccomp-basic');
  if (!fs.existsSync(sourcePath) || fs.readFileSync(sourcePath, 'utf8') !== BASIC_SECCOMP_WRAPPER_C) {
    fs.writeFileSync(sourcePath, BASIC_SECCOMP_WRAPPER_C, 'utf8');
  }
  const sourceStat = fs.statSync(sourcePath);
  const binaryStat = fs.existsSync(binaryPath) ? fs.statSync(binaryPath) : null;
  if (!binaryStat || binaryStat.mtimeMs < sourceStat.mtimeMs || binaryStat.size === 0) {
    const compile = spawnSync(support.gcc, ['-O2', '-Wall', '-o', binaryPath, sourcePath], {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024
    });
    if (compile.status !== 0 || !fs.existsSync(binaryPath)) {
      return {
        ok: false,
        reason: `gcc_failed:${String(compile.stderr || compile.stdout || '').trim()}`,
        binaryPath: null,
        sourcePath
      };
    }
  }
  if (fs.existsSync(binaryPath)) {
    fs.chmodSync(binaryPath, 0o755);
  }
  return { ok: true, binaryPath, sourcePath };
}

function buildCgroupAttachmentCommands(support, policy, workspaceId, label, scratchDir) {
  if (!(support.cgroupCpu && support.cgroupMemory && support.cgroupPids)) {
    return { enabled: false, commands: [], metadata: { enabled: false, reason: 'cgroup_controllers_unavailable' } };
  }
  const name = buildCgroupName(workspaceId, label, scratchDir);
  const groupPaths = {
    cpu: path.join(support.cgroupRoots.cpu, name),
    memory: path.join(support.cgroupRoots.memory, name),
    pids: path.join(support.cgroupRoots.pids, name)
  };
  const cpuPeriod = 100000;
  const cpuQuota = Math.max(1000, Math.floor((cpuPeriod * Math.max(5, policy.cgroupCpuQuotaPercent)) / 100));
  const commands = [
    `mkdir -p ${shellQuote(groupPaths.cpu)} ${shellQuote(groupPaths.memory)} ${shellQuote(groupPaths.pids)}`,
    `printf '%s' ${shellQuote(String(cpuPeriod))} > ${shellQuote(path.join(groupPaths.cpu, 'cpu.cfs_period_us'))}`,
    `printf '%s' ${shellQuote(String(cpuQuota))} > ${shellQuote(path.join(groupPaths.cpu, 'cpu.cfs_quota_us'))}`,
    `printf '%s' ${shellQuote(String(policy.cgroupMemoryMb * 1024 * 1024))} > ${shellQuote(path.join(groupPaths.memory, 'memory.limit_in_bytes'))}`,
    `printf '%s' ${shellQuote(String(policy.cgroupPidsMax))} > ${shellQuote(path.join(groupPaths.pids, 'pids.max'))}`,
    `printf '%s' "$$" > ${shellQuote(path.join(groupPaths.cpu, 'cgroup.procs'))}`,
    `printf '%s' "$$" > ${shellQuote(path.join(groupPaths.memory, 'cgroup.procs'))}`,
    `printf '%s' "$$" > ${shellQuote(path.join(groupPaths.pids, 'cgroup.procs'))}`
  ];
  return {
    enabled: true,
    commands,
    metadata: {
      enabled: true,
      name,
      groupPaths,
      cpuPeriod,
      cpuQuota,
      memoryBytes: policy.cgroupMemoryMb * 1024 * 1024,
      pidsMax: policy.cgroupPidsMax
    }
  };
}

function buildRootfsSetupCommands(command, args, support, scratchDir, cwd, seccompBinaryPath) {
  const rootfs = path.join(scratchDir, 'rootfs');
  const bindings = [
    ['/usr', path.join(rootfs, 'usr'), true],
    ['/opt', path.join(rootfs, 'opt'), true],
    ['/dev', path.join(rootfs, 'dev'), false],
    [cwd, path.join(rootfs, 'workspace'), false]
  ].filter(([source]) => fs.existsSync(source));
  const commands = [
    `mkdir -p ${shellQuote(rootfs)} ${shellQuote(path.join(rootfs, 'usr'))} ${shellQuote(path.join(rootfs, 'opt'))} ${shellQuote(path.join(rootfs, 'dev'))} ${shellQuote(path.join(rootfs, 'proc'))} ${shellQuote(path.join(rootfs, 'workspace'))} ${shellQuote(path.join(rootfs, 'tmp'))} ${shellQuote(path.join(rootfs, 'usr', 'local', 'bin'))}`,
    `rm -f ${shellQuote(path.join(rootfs, 'bin'))} ${shellQuote(path.join(rootfs, 'lib'))} ${shellQuote(path.join(rootfs, 'lib64'))}`,
    `ln -s usr/bin ${shellQuote(path.join(rootfs, 'bin'))}`,
    `ln -s usr/lib ${shellQuote(path.join(rootfs, 'lib'))}`,
    `ln -s usr/lib64 ${shellQuote(path.join(rootfs, 'lib64'))} >/dev/null 2>&1 || true`
  ];
  for (const [source, destination, readOnly] of bindings) {
    commands.push(`mkdir -p ${shellQuote(destination)}`);
    if (source === '/dev') commands.push(`mount --rbind ${shellQuote(source)} ${shellQuote(destination)}`);
    else commands.push(`mount --bind ${shellQuote(source)} ${shellQuote(destination)}`);
    if (readOnly) commands.push(`mount -o remount,bind,ro ${shellQuote(destination)} >/dev/null 2>&1 || true`);
  }
  commands.push(`mount -t proc proc ${shellQuote(path.join(rootfs, 'proc'))}`);
  if (seccompBinaryPath && fs.existsSync(seccompBinaryPath)) {
    const seccompTarget = path.join(rootfs, 'usr', 'local', 'bin', path.basename(seccompBinaryPath));
    commands.push(`mount --bind ${shellQuote(seccompBinaryPath)} ${shellQuote(seccompTarget)}`);
    commands.push(`mount -o remount,bind,ro ${shellQuote(seccompTarget)} >/dev/null 2>&1 || true`);
  }
  const translatedCommand = translatePathForPivot(command, cwd);
  const translatedArgs = args.map(arg => translatePathForPivot(arg, cwd));
  const chrootWrapper = seccompBinaryPath ? `/usr/local/bin/${path.basename(seccompBinaryPath)}` : null;
  const innerExec = quoteCommand(chrootWrapper || translatedCommand, chrootWrapper ? [translatedCommand, ...translatedArgs] : translatedArgs);
  const chrootShell = `cd /workspace; exec ${innerExec}`;
  commands.push(`exec ${shellQuote(support.chroot)} ${shellQuote(rootfs)} /bin/sh -lc ${shellQuote(chrootShell)}`);
  return {
    enabled: true,
    rootfs,
    bindings: bindings.map(([source, destination, readOnly]) => ({ source, destination, readOnly })),
    commands
  };
}

export function buildRuntimeContainment(command, args = [], options = {}) {
  const env = options.env || process.env;
  const policy = options.policy || getRuntimeContainmentPolicy(env);
  const support = options.support || detectRuntimeContainmentSupport(env);
  const workspaceId = sanitizeSegment(options.workspaceId || 'shared');
  const label = sanitizeSegment(options.label || 'runtime');
  const rootDir = path.resolve(String(options.rootDir || process.cwd()));
  const cwd = path.resolve(String(options.cwd || process.cwd()));
  const scratchDir = path.resolve(String(options.scratchDir || path.join(rootDir, '.skyequanta', 'runtime-sandbox', workspaceId, label)));
  const sandboxMode = readString(options.sandboxMode || 'process');

  const seccomp = policy.enableSeccompBasic
    ? ensureBasicSeccompWrapper(rootDir, support)
    : { ok: false, reason: 'disabled', binaryPath: null, sourcePath: null };

  const cgroups = policy.enableCgroups
    ? buildCgroupAttachmentCommands(support, policy, workspaceId, label, scratchDir)
    : { enabled: false, commands: [], metadata: { enabled: false, reason: 'disabled' } };

  const canPivot = Boolean(policy.enablePivotRootfs && sandboxMode === 'rootless-namespace' && support.mount && support.chroot);
  const rootfs = canPivot
    ? buildRootfsSetupCommands(command, args, support, scratchDir, cwd, seccomp.ok ? seccomp.binaryPath : null)
    : { enabled: false, commands: [] };

  let execChain = '';
  if (rootfs.enabled) {
    execChain = rootfs.commands.join('; ');
  } else {
    const execCommand = quoteCommand(seccomp.ok ? seccomp.binaryPath : command, seccomp.ok ? [command, ...args] : args);
    execChain = `cd ${shellQuote(cwd)}; exec ${execCommand}`;
  }

  const prelude = [...cgroups.commands, execChain].filter(Boolean).join('; ');
  return {
    policy,
    support,
    metadata: {
      cgroups: cgroups.metadata,
      rootfs: rootfs.enabled ? { enabled: true, rootfs: rootfs.rootfs, bindings: rootfs.bindings } : { enabled: false },
      seccomp: seccomp.ok ? { enabled: true, binaryPath: seccomp.binaryPath, sourcePath: seccomp.sourcePath } : { enabled: false, reason: seccomp.reason || 'disabled' }
    },
    shellCommand: prelude,
    envAdditions: {
      SKYEQUANTA_RUNTIME_PIVOT_ROOTFS_EFFECTIVE: rootfs.enabled ? '1' : '0',
      SKYEQUANTA_RUNTIME_CGROUPS_EFFECTIVE: cgroups.enabled ? '1' : '0',
      SKYEQUANTA_RUNTIME_CGROUP_NAME: cgroups.metadata?.name || '',
      SKYEQUANTA_RUNTIME_SECCOMP_EFFECTIVE: seccomp.ok ? '1' : '0',
      SKYEQUANTA_RUNTIME_SECCOMP_BINARY: seccomp.binaryPath || ''
    }
  };
}
