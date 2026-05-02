import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function readString(value) {
  return String(value ?? '').trim();
}
function readInteger(value, fallback) {
  const parsed = Number.parseInt(readString(value), 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}
function sanitizeSegment(value) {
  const normalized = readString(value).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || 'shared';
}
function shellQuote(value) {
  const stringValue = String(value ?? '');
  if (!stringValue) return "''";
  if (/^[A-Za-z0-9_./:=+\-]+$/.test(stringValue)) return stringValue;
  return `'${stringValue.replace(/'/g, `'\\''`)}'`;
}
function sha1Text(value) {
  return crypto.createHash('sha1').update(String(value || ''), 'utf8').digest('hex');
}
function parseProcSelfCgroup() {
  try {
    return fs.readFileSync('/proc/self/cgroup', 'utf8').split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
      const [hierarchy, controllers, cgroupPath] = line.split(':');
      return { hierarchy, controllers: String(controllers || '').split(',').map(item => item.trim()).filter(Boolean), path: cgroupPath || '/' };
    });
  } catch {
    return [];
  }
}
function parsePidCgroup(pid) {
  try {
    return fs.readFileSync(`/proc/${pid}/cgroup`, 'utf8').split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
      const [hierarchy, controllers, cgroupPath] = line.split(':');
      return { hierarchy, controllers: String(controllers || '').split(',').map(item => item.trim()).filter(Boolean), path: cgroupPath || '/' };
    });
  } catch {
    return [];
  }
}
function joinControllerPath(root, cgroupPath) {
  const relative = String(cgroupPath || '/').replace(/^\/+/, '');
  return relative ? path.join(root, relative) : root;
}
function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}
function writeTextFile(filePath, value) {
  fs.writeFileSync(filePath, String(value), 'utf8');
}
function readProcessIds(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8').split(/\s+/).map(item => Number.parseInt(item, 10)).filter(item => Number.isInteger(item) && item > 0);
  } catch {
    return [];
  }
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
function removeDirectoryIfEmpty(dirPath) {
  try {
    fs.rmdirSync(dirPath);
    return true;
  } catch {
    return false;
  }
}

export function buildDelegatedCgroupName(workspaceId, label, scratchDir) {
  const basis = `${workspaceId}:${label}:${path.resolve(String(scratchDir || ''))}`;
  return `skq-del-${sanitizeSegment(workspaceId)}-${sanitizeSegment(label)}-${sha1Text(basis).slice(0, 12)}`;
}
export function detectDelegatedCgroupSupport() {
  const isLinux = process.platform === 'linux';
  if (!isLinux) return { isLinux, version: 'none', available: false, entries: [], controllers: {}, unified: null };
  const entries = parseProcSelfCgroup();
  const unifiedRoot = '/sys/fs/cgroup';
  if (fs.existsSync(path.join(unifiedRoot, 'cgroup.controllers'))) {
    const currentPath = entries.find(item => item.hierarchy === '0')?.path || '/';
    const parentPath = joinControllerPath(unifiedRoot, currentPath);
    const availableControllers = fs.readFileSync(path.join(unifiedRoot, 'cgroup.controllers'), 'utf8').split(/\s+/).map(item => item.trim()).filter(Boolean);
    return {
      isLinux,
      version: 'v2',
      available: true,
      entries,
      unified: { root: unifiedRoot, currentPath, parentPath, subtreeControlFile: path.join(parentPath, 'cgroup.subtree_control') },
      controllers: { cpu: availableControllers.includes('cpu'), memory: availableControllers.includes('memory'), pids: availableControllers.includes('pids') }
    };
  }
  const roots = { cpu: '/sys/fs/cgroup/cpu', memory: '/sys/fs/cgroup/memory', pids: '/sys/fs/cgroup/pids' };
  const currentEntries = {};
  for (const entry of entries) for (const controller of entry.controllers) currentEntries[controller] = entry.path || '/';
  const controllers = {};
  for (const [name, root] of Object.entries(roots)) {
    const currentPath = currentEntries[name] || '/';
    const resolvedParentPath = fs.existsSync(root) ? joinControllerPath(root, currentPath) : null;
    const parentPath = resolvedParentPath && fs.existsSync(resolvedParentPath) ? resolvedParentPath : (fs.existsSync(root) ? root : null);
    controllers[name] = { available: Boolean(parentPath && fs.existsSync(parentPath)), root, currentPath, parentPath };
  }
  return { isLinux, version: 'v1', available: Object.values(controllers).some(item => item.available), entries, controllers, unified: null };
}
export function buildDelegatedControllerPlan(options = {}) {
  const support = options.support || detectDelegatedCgroupSupport();
  const workspaceId = sanitizeSegment(options.workspaceId || 'shared');
  const label = sanitizeSegment(options.label || 'runtime');
  const scratchDir = path.resolve(String(options.scratchDir || process.cwd()));
  const memoryLimitMb = Math.max(32, readInteger(options.memoryLimitMb, 96));
  const pidsMax = Math.max(8, readInteger(options.pidsMax, 24));
  const cpuQuotaPercent = Math.max(5, readInteger(options.cpuQuotaPercent, 40));
  const name = buildDelegatedCgroupName(workspaceId, label, scratchDir);
  if (!support.available) return { ok: false, reason: 'cgroup_unavailable', support, version: support.version, name, prelude: '', metadata: { enabled: false } };
  if (support.version === 'v2') {
    const groupPath = path.join(support.unified.parentPath, name);
    const cpuPeriod = 100000;
    const cpuQuota = Math.max(1000, Math.floor((cpuPeriod * cpuQuotaPercent) / 100));
    return {
      ok: true,
      reason: 'ready',
      support,
      version: 'v2',
      name,
      prelude: [
        support.controllers.cpu ? `printf '+cpu' > ${shellQuote(support.unified.subtreeControlFile)} >/dev/null 2>&1 || true` : null,
        support.controllers.memory ? `printf '+memory' > ${shellQuote(support.unified.subtreeControlFile)} >/dev/null 2>&1 || true` : null,
        support.controllers.pids ? `printf '+pids' > ${shellQuote(support.unified.subtreeControlFile)} >/dev/null 2>&1 || true` : null,
        `mkdir -p ${shellQuote(groupPath)}`,
        support.controllers.cpu ? `printf '%s %s' ${shellQuote(String(cpuQuota))} ${shellQuote(String(cpuPeriod))} > ${shellQuote(path.join(groupPath, 'cpu.max'))}` : null,
        support.controllers.memory ? `printf '%s' ${shellQuote(String(memoryLimitMb * 1024 * 1024))} > ${shellQuote(path.join(groupPath, 'memory.max'))}` : null,
        support.controllers.pids ? `printf '%s' ${shellQuote(String(pidsMax))} > ${shellQuote(path.join(groupPath, 'pids.max'))}` : null,
        `printf '%s' "$$" > ${shellQuote(path.join(groupPath, 'cgroup.procs'))}`
      ].filter(Boolean).join('; '),
      metadata: { version: 'v2', name, groupPaths: { cpu: groupPath, memory: groupPath, pids: groupPath }, cpuQuota, cpuPeriod, memoryBytes: memoryLimitMb * 1024 * 1024, pidsMax }
    };
  }
  const cpu = support.controllers.cpu; const memory = support.controllers.memory; const pids = support.controllers.pids;
  const cpuPath = cpu.available ? path.join(cpu.parentPath, name) : null;
  const memoryPath = memory.available ? path.join(memory.parentPath, name) : null;
  const pidsPath = pids.available ? path.join(pids.parentPath, name) : null;
  const cpuPeriod = 100000;
  const cpuQuota = Math.max(1000, Math.floor((cpuPeriod * cpuQuotaPercent) / 100));
  return {
    ok: true,
    reason: 'ready',
    support,
    version: 'v1',
    name,
    prelude: [
      cpuPath ? `mkdir -p ${shellQuote(cpuPath)}` : null,
      memoryPath ? `mkdir -p ${shellQuote(memoryPath)}` : null,
      pidsPath ? `mkdir -p ${shellQuote(pidsPath)}` : null,
      cpuPath ? `printf '%s' ${shellQuote(String(cpuPeriod))} > ${shellQuote(path.join(cpuPath, 'cpu.cfs_period_us'))}` : null,
      cpuPath ? `printf '%s' ${shellQuote(String(cpuQuota))} > ${shellQuote(path.join(cpuPath, 'cpu.cfs_quota_us'))}` : null,
      memoryPath ? `printf '%s' ${shellQuote(String(memoryLimitMb * 1024 * 1024))} > ${shellQuote(path.join(memoryPath, 'memory.limit_in_bytes'))}` : null,
      pidsPath ? `printf '%s' ${shellQuote(String(pidsMax))} > ${shellQuote(path.join(pidsPath, 'pids.max'))}` : null,
      cpuPath ? `printf '%s' "$$" > ${shellQuote(path.join(cpuPath, 'cgroup.procs'))}` : null,
      memoryPath ? `printf '%s' "$$" > ${shellQuote(path.join(memoryPath, 'cgroup.procs'))}` : null,
      pidsPath ? `printf '%s' "$$" > ${shellQuote(path.join(pidsPath, 'cgroup.procs'))}` : null
    ].filter(Boolean).join('; '),
    metadata: { version: 'v1', name, groupPaths: { cpu: cpuPath, memory: memoryPath, pids: pidsPath }, cpuQuota, cpuPeriod, memoryBytes: memoryLimitMb * 1024 * 1024, pidsMax }
  };
}

export function materializeDelegatedControllerPlan(plan) {
  if (!plan?.ok) return { ok: false, reason: 'plan_not_ready', plan };
  const operations = [];
  try {
    if (plan.version === 'v2') {
      const groupPath = plan.metadata?.groupPaths?.cpu || plan.metadata?.groupPaths?.memory || plan.metadata?.groupPaths?.pids;
      if (!groupPath) return { ok: false, reason: 'group_path_missing', plan };
      const subtreeControlFile = plan.support?.unified?.subtreeControlFile;
      if (subtreeControlFile && fs.existsSync(subtreeControlFile)) {
        for (const controller of ['cpu', 'memory', 'pids']) {
          if (!plan.support?.controllers?.[controller]) continue;
          try {
            fs.appendFileSync(subtreeControlFile, `+${controller}`);
            operations.push({ type: 'subtree-enable', controller, file: subtreeControlFile, ok: true });
          } catch (error) {
            operations.push({ type: 'subtree-enable', controller, file: subtreeControlFile, ok: false, error: error instanceof Error ? error.message : String(error) });
          }
        }
      }
      ensureDirectory(groupPath);
      operations.push({ type: 'mkdir', path: groupPath, ok: true });
      if (plan.support?.controllers?.cpu) {
        const file = path.join(groupPath, 'cpu.max');
        writeTextFile(file, `${plan.metadata.cpuQuota} ${plan.metadata.cpuPeriod}`);
        operations.push({ type: 'write', file, value: `${plan.metadata.cpuQuota} ${plan.metadata.cpuPeriod}`, ok: true });
      }
      if (plan.support?.controllers?.memory) {
        const file = path.join(groupPath, 'memory.max');
        writeTextFile(file, String(plan.metadata.memoryBytes));
        operations.push({ type: 'write', file, value: String(plan.metadata.memoryBytes), ok: true });
      }
      if (plan.support?.controllers?.pids) {
        const file = path.join(groupPath, 'pids.max');
        writeTextFile(file, String(plan.metadata.pidsMax));
        operations.push({ type: 'write', file, value: String(plan.metadata.pidsMax), ok: true });
      }
      return { ok: true, version: 'v2', operations, groupPaths: plan.metadata.groupPaths };
    }

    for (const controller of ['cpu', 'memory', 'pids']) {
      const groupPath = plan.metadata?.groupPaths?.[controller];
      if (!groupPath) continue;
      ensureDirectory(groupPath);
      operations.push({ type: 'mkdir', controller, path: groupPath, ok: true });
      if (controller === 'cpu') {
        const periodFile = path.join(groupPath, 'cpu.cfs_period_us');
        const quotaFile = path.join(groupPath, 'cpu.cfs_quota_us');
        writeTextFile(periodFile, String(plan.metadata.cpuPeriod));
        writeTextFile(quotaFile, String(plan.metadata.cpuQuota));
        operations.push({ type: 'write', controller, file: periodFile, value: String(plan.metadata.cpuPeriod), ok: true });
        operations.push({ type: 'write', controller, file: quotaFile, value: String(plan.metadata.cpuQuota), ok: true });
      }
      if (controller === 'memory') {
        const limitFile = path.join(groupPath, 'memory.limit_in_bytes');
        writeTextFile(limitFile, String(plan.metadata.memoryBytes));
        operations.push({ type: 'write', controller, file: limitFile, value: String(plan.metadata.memoryBytes), ok: true });
      }
      if (controller === 'pids') {
        const maxFile = path.join(groupPath, 'pids.max');
        writeTextFile(maxFile, String(plan.metadata.pidsMax));
        operations.push({ type: 'write', controller, file: maxFile, value: String(plan.metadata.pidsMax), ok: true });
      }
    }
    return { ok: true, version: 'v1', operations, groupPaths: plan.metadata.groupPaths };
  } catch (error) {
    return { ok: false, reason: 'materialize_failed', operations, error: error instanceof Error ? error.message : String(error), groupPaths: plan.metadata?.groupPaths || null };
  }
}

export function attachPidToDelegatedControllerPlan(plan, pid) {
  if (!plan?.ok) return { ok: false, reason: 'plan_not_ready', pid };
  const numericPid = Number.parseInt(String(pid), 10);
  if (!Number.isInteger(numericPid) || numericPid <= 0) return { ok: false, reason: 'invalid_pid', pid };
  const writes = [];
  try {
    if (plan.version === 'v2') {
      const groupPath = plan.metadata?.groupPaths?.cpu || plan.metadata?.groupPaths?.memory || plan.metadata?.groupPaths?.pids;
      const file = path.join(groupPath, 'cgroup.procs');
      writeTextFile(file, String(numericPid));
      writes.push({ file, pid: numericPid, ok: true });
      return { ok: true, version: 'v2', writes };
    }
    for (const controller of ['cpu', 'memory', 'pids']) {
      const groupPath = plan.metadata?.groupPaths?.[controller];
      if (!groupPath) continue;
      const file = path.join(groupPath, 'cgroup.procs');
      writeTextFile(file, String(numericPid));
      writes.push({ controller, file, pid: numericPid, ok: true });
    }
    return { ok: writes.length > 0, version: 'v1', writes };
  } catch (error) {
    return { ok: false, reason: 'attach_failed', writes, error: error instanceof Error ? error.message : String(error) };
  }
}

export function readDelegatedControllerMembership(pid) {
  return parsePidCgroup(pid);
}

export function verifyPidAttachedToDelegatedControllerPlan(plan, pid) {
  const membership = readDelegatedControllerMembership(pid);
  if (!Array.isArray(membership) || membership.length === 0) return { ok: false, reason: 'membership_missing', membership };
  if (plan.version === 'v2') {
    const unified = membership.find(entry => entry.hierarchy === '0');
    const ok = Boolean(unified?.path && unified.path.includes(`/${plan.name}`));
    return { ok, version: 'v2', membership, matchedPath: unified?.path || null };
  }
  const results = {};
  for (const controller of ['cpu', 'memory', 'pids']) {
    const entry = membership.find(item => Array.isArray(item.controllers) && item.controllers.includes(controller));
    results[controller] = {
      path: entry?.path || null,
      ok: Boolean(entry?.path && entry.path.includes(`/${plan.name}`))
    };
  }
  return { ok: Object.values(results).every(item => item.ok), version: 'v1', membership, results };
}

export function renderDelegatedControllerKillPlan(plan) {
  if (!plan?.ok) return { ok: false, reason: 'plan_not_ready', plan };
  if (plan.version === 'v2') {
    const groupPath = plan.metadata?.groupPaths?.cpu || plan.metadata?.groupPaths?.memory || plan.metadata?.groupPaths?.pids;
    const cgroupKillFile = path.join(groupPath, 'cgroup.kill');
    if (fs.existsSync(cgroupKillFile)) {
      return { ok: true, version: 'v2', method: 'cgroup.kill', files: { cgroupKillFile, cgroupProcsFile: path.join(groupPath, 'cgroup.procs') } };
    }
    return { ok: true, version: 'v2', method: 'signal-procs', files: { cgroupProcsFile: path.join(groupPath, 'cgroup.procs') } };
  }
  return {
    ok: true,
    version: 'v1',
    method: 'signal-procs',
    files: {
      cpu: plan.metadata?.groupPaths?.cpu ? path.join(plan.metadata.groupPaths.cpu, 'cgroup.procs') : null,
      memory: plan.metadata?.groupPaths?.memory ? path.join(plan.metadata.groupPaths.memory, 'cgroup.procs') : null,
      pids: plan.metadata?.groupPaths?.pids ? path.join(plan.metadata.groupPaths.pids, 'cgroup.procs') : null
    }
  };
}

export async function killDelegatedControllerPlan(plan, options = {}) {
  const strategy = renderDelegatedControllerKillPlan(plan);
  if (!strategy.ok) return { ok: false, reason: 'kill_strategy_unavailable', strategy };
  const timeoutMs = Math.max(500, readInteger(options.timeoutMs, 3000));
  const skipPid = Number.parseInt(String(options.skipPid || 0), 10);
  const signal = readString(options.signal) || 'SIGKILL';
  const killed = [];
  try {
    if (strategy.method === 'cgroup.kill' && strategy.files?.cgroupKillFile) {
      writeTextFile(strategy.files.cgroupKillFile, '1');
    } else {
      const filePaths = Object.values(strategy.files || {}).filter(Boolean);
      const pidSet = new Set();
      for (const filePath of filePaths) {
        for (const pid of readProcessIds(filePath)) {
          if (pid > 0 && pid !== skipPid) pidSet.add(pid);
        }
      }
      for (const pid of Array.from(pidSet)) {
        try {
          process.kill(pid, signal);
          killed.push({ pid, signal, ok: true });
        } catch (error) {
          killed.push({ pid, signal, ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }
    const deadline = Date.now() + timeoutMs;
    let remaining = [];
    do {
      const filePaths = Object.values(strategy.files || {}).filter(Boolean);
      const pidSet = new Set();
      for (const filePath of filePaths) {
        for (const pid of readProcessIds(filePath)) {
          if (pid > 0 && pid !== skipPid) pidSet.add(pid);
        }
      }
      remaining = Array.from(pidSet).filter(pid => processExists(pid));
      if (remaining.length === 0) {
        return { ok: true, strategy, killed, remaining, timeoutMs };
      }
      await sleep(100);
    } while (Date.now() < deadline);
    return { ok: false, reason: 'pids_still_alive', strategy, killed, remaining, timeoutMs };
  } catch (error) {
    return { ok: false, reason: 'kill_failed', strategy, killed, error: error instanceof Error ? error.message : String(error) };
  }
}

export function cleanupDelegatedControllerPlan(plan) {
  if (!plan?.ok) return { ok: false, reason: 'plan_not_ready' };
  const removals = [];
  const groupPaths = Array.from(new Set(Object.values(plan.metadata?.groupPaths || {}).filter(Boolean))).sort((a, b) => b.length - a.length);
  for (const groupPath of groupPaths) {
    removals.push({ path: groupPath, removed: removeDirectoryIfEmpty(groupPath) });
  }
  return { ok: removals.every(item => item.removed), removals };
}
