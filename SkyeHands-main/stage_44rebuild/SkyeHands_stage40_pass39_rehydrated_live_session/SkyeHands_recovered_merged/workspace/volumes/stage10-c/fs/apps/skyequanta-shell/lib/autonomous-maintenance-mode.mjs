import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { getRuntimePaths } from './runtime.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return filePath;
}

function writeText(filePath, value) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, String(value), 'utf8');
  return filePath;
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(item => canonicalJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function stableHash(value) {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function getMaintenancePaths(config) {
  const runtimePaths = getRuntimePaths(config);
  const baseDir = path.join(runtimePaths.runtimeDir, 'autonomous-maintenance');
  return {
    baseDir,
    policyFile: path.join(baseDir, 'policy.json'),
    queueFile: path.join(baseDir, 'queue.json'),
    ledgerFile: path.join(baseDir, 'ledger.json'),
    stateFile: path.join(baseDir, 'state.json')
  };
}

export function ensureAutonomousMaintenanceStore(config) {
  const paths = getMaintenancePaths(config);
  ensureDirectory(paths.baseDir);
  if (!fs.existsSync(paths.policyFile)) {
    writeJson(paths.policyFile, {
      version: 1,
      unattendedMutationAllowed: true,
      allowedWindows: ['00:00-23:59'],
      maxRetries: 2,
      autoRollbackOnFailure: true
    });
  }
  if (!fs.existsSync(paths.queueFile)) writeJson(paths.queueFile, { version: 1, tasks: [] });
  if (!fs.existsSync(paths.ledgerFile)) writeJson(paths.ledgerFile, { version: 1, entries: [] });
  if (!fs.existsSync(paths.stateFile)) writeJson(paths.stateFile, { version: 1, lastRunAt: null, recurringIssues: [] });
  return paths;
}

export function resetAutonomousMaintenanceStore(config) {
  const paths = getMaintenancePaths(config);
  fs.rmSync(paths.baseDir, { recursive: true, force: true });
  return ensureAutonomousMaintenanceStore(config);
}

function readQueue(config) {
  const paths = ensureAutonomousMaintenanceStore(config);
  return readJson(paths.queueFile, { version: 1, tasks: [] });
}

function writeQueue(config, queue) {
  const paths = ensureAutonomousMaintenanceStore(config);
  writeJson(paths.queueFile, queue);
}

function appendLedgerEntry(config, entry) {
  const paths = ensureAutonomousMaintenanceStore(config);
  const ledger = readJson(paths.ledgerFile, { version: 1, entries: [] });
  ledger.entries = [...(ledger.entries || []), entry];
  writeJson(paths.ledgerFile, ledger);
  return entry;
}

export function setMaintenancePolicy(config, patch = {}) {
  const paths = ensureAutonomousMaintenanceStore(config);
  const current = readJson(paths.policyFile, {});
  const next = { ...current, ...patch };
  writeJson(paths.policyFile, next);
  return next;
}

export function detectMaintenanceCandidates(projectRoot) {
  const tasks = [];
  const packageJson = readJson(path.join(projectRoot, 'package.json'), null);
  if (packageJson?.dependencies) {
    for (const [name, version] of Object.entries(packageJson.dependencies)) {
      if (String(version).includes('0.0.1') || String(version).includes('beta') || String(version).includes('legacy')) {
        tasks.push({
          taskType: 'dependency-upgrade',
          severity: 'medium',
          summary: `Upgrade stale dependency ${name}`,
          dependencyName: name,
          currentVersion: version,
          proposedVersion: '^1.0.0',
          targetFile: 'package.json'
        });
      }
    }
  }
  const flakyFile = path.join(projectRoot, 'tests', 'flaky-tests.json');
  if (fs.existsSync(flakyFile)) {
    const flaky = readJson(flakyFile, { tests: [] });
    for (const testName of flaky.tests || []) {
      tasks.push({ taskType: 'flaky-test', severity: 'high', summary: `Quarantine flaky test ${testName}`, testName, targetFile: 'tests/flaky-tests.json' });
    }
  }
  const staleDocFile = path.join(projectRoot, 'docs', 'stale-docs.json');
  if (fs.existsSync(staleDocFile)) {
    const staleDocs = readJson(staleDocFile, { docs: [] });
    for (const doc of staleDocs.docs || []) {
      tasks.push({ taskType: 'doc-refresh', severity: 'low', summary: `Refresh stale doc ${doc}`, docPath: doc, targetFile: doc });
    }
  }
  const driftFile = path.join(projectRoot, 'infra', 'drift.json');
  if (fs.existsSync(driftFile)) {
    const drift = readJson(driftFile, { items: [] });
    for (const item of drift.items || []) {
      tasks.push({ taskType: 'infra-drift', severity: 'high', summary: `Resolve infra drift ${item}`, driftItem: item, targetFile: 'infra/drift.json' });
    }
  }
  return tasks.map((task, index) => ({
    taskId: `${task.taskType}-${index + 1}`,
    createdAt: new Date().toISOString(),
    status: 'queued',
    attempts: 0,
    fingerprint: stableHash(task),
    ...task
  }));
}

export function queueMaintenanceTasks(config, tasks = []) {
  const queue = readQueue(config);
  const existing = new Map((queue.tasks || []).map(task => [task.taskId, task]));
  for (const task of tasks) {
    existing.set(task.taskId, task);
  }
  const next = { version: 1, tasks: [...existing.values()] };
  writeQueue(config, next);
  return next;
}

function snapshotFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

function restoreSnapshot(filePath, snapshot) {
  if (snapshot === null) return;
  writeText(filePath, snapshot);
}

function markRecurringIssue(config, task) {
  const paths = ensureAutonomousMaintenanceStore(config);
  const state = readJson(paths.stateFile, { version: 1, lastRunAt: null, recurringIssues: [] });
  const existing = new Map((state.recurringIssues || []).map(item => [item.taskId, item]));
  const current = existing.get(task.taskId) || { taskId: task.taskId, count: 0, lastSummary: task.summary };
  current.count += 1;
  current.lastSeenAt = new Date().toISOString();
  current.lastSummary = task.summary;
  current.reopened = current.count > 1;
  existing.set(task.taskId, current);
  state.recurringIssues = [...existing.values()];
  state.lastRunAt = new Date().toISOString();
  writeJson(paths.stateFile, state);
  return current;
}

export function executeMaintenanceTask(config, task, options = {}) {
  const paths = ensureAutonomousMaintenanceStore(config);
  const policy = readJson(paths.policyFile, {});
  const projectRoot = path.resolve(options.projectRoot || config.rootDir);
  const unattended = options.unattended !== false;
  if (unattended && policy.unattendedMutationAllowed === false) {
    const denied = { ok: false, reason: 'unattended_mutation_denied', taskId: task.taskId, summary: task.summary };
    appendLedgerEntry(config, { at: new Date().toISOString(), type: 'policy-denial', denied });
    return denied;
  }
  const targetPath = path.join(projectRoot, task.targetFile || '');
  const before = snapshotFile(targetPath);
  const entry = {
    at: new Date().toISOString(),
    type: 'maintenance-execution',
    taskId: task.taskId,
    taskType: task.taskType,
    summary: task.summary,
    unattended,
    attempts: (task.attempts || 0) + 1,
    targetPath: normalizePath(path.relative(projectRoot, targetPath))
  };
  try {
    if (options.forceFailure) {
      throw new Error('forced_failure_for_smoke');
    }
    if (task.taskType === 'dependency-upgrade') {
      const packageJson = readJson(targetPath, null);
      if (!packageJson?.dependencies?.[task.dependencyName]) {
        throw new Error(`dependency_missing:${task.dependencyName}`);
      }
      packageJson.dependencies[task.dependencyName] = task.proposedVersion || '^1.0.0';
      writeJson(targetPath, packageJson);
      entry.mutation = { dependencyName: task.dependencyName, updatedTo: packageJson.dependencies[task.dependencyName] };
    } else if (task.taskType === 'flaky-test') {
      const quarantineFile = path.join(projectRoot, 'tests', 'quarantine.log');
      fs.appendFileSync(quarantineFile, `${task.testName}\n`, 'utf8');
      entry.mutation = { quarantineFile: normalizePath(path.relative(projectRoot, quarantineFile)), testName: task.testName };
    } else if (task.taskType === 'doc-refresh') {
      const current = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : '';
      writeText(targetPath, `${current}\n\nRefreshed by Autonomous Maintenance Mode at ${new Date().toISOString()}\n`);
      entry.mutation = { docPath: task.docPath };
    } else if (task.taskType === 'infra-drift') {
      const drift = readJson(targetPath, { items: [] });
      drift.resolved = [...(drift.resolved || []), task.driftItem];
      writeJson(targetPath, drift);
      entry.mutation = { driftItem: task.driftItem };
    } else {
      throw new Error(`unsupported_task_type:${task.taskType}`);
    }
    entry.ok = true;
    task.status = 'completed';
    task.attempts = entry.attempts;
    task.completedAt = entry.at;
    task.lastResult = entry.mutation;
    const recurring = markRecurringIssue(config, task);
    entry.recurring = recurring;
    appendLedgerEntry(config, entry);
    return { ok: true, task, entry, recurring };
  } catch (error) {
    if (policy.autoRollbackOnFailure !== false) {
      restoreSnapshot(targetPath, before);
    }
    task.status = 'failed';
    task.attempts = entry.attempts;
    task.lastError = String(error.message || error);
    entry.ok = false;
    entry.error = task.lastError;
    entry.rollbackApplied = policy.autoRollbackOnFailure !== false;
    appendLedgerEntry(config, entry);
    return { ok: false, task, entry, rollbackApplied: entry.rollbackApplied };
  }
}

export function retryFailedMaintenanceTask(config, task, options = {}) {
  const maxRetries = readJson(getMaintenancePaths(config).policyFile, { maxRetries: 2 }).maxRetries || 2;
  if ((task.attempts || 0) >= maxRetries + 1) {
    return { ok: false, reason: 'max_retries_exhausted', taskId: task.taskId };
  }
  return executeMaintenanceTask(config, task, options);
}

export function reopenRecurringIssue(config, task) {
  const recurring = markRecurringIssue(config, task);
  const reopened = { ...task, status: 'queued', reopenedAt: new Date().toISOString(), reopenedBecauseRecurring: recurring.count > 1 };
  const queue = readQueue(config);
  queue.tasks = [...(queue.tasks || []).filter(item => item.taskId !== task.taskId), reopened];
  writeQueue(config, queue);
  return reopened;
}

export function renderMaintenanceSurface(queue, ledger) {
  const taskRows = (queue.tasks || []).map(task => `<tr><td>${task.taskId}</td><td>${task.taskType}</td><td>${task.status}</td><td>${task.summary}</td><td>${task.attempts || 0}</td></tr>`).join('');
  const ledgerRows = (ledger.entries || []).slice(-12).map(entry => `<tr><td>${entry.at}</td><td>${entry.taskId || ''}</td><td>${entry.ok ? 'PASS' : 'FAIL'}</td><td>${entry.summary || entry.type}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>Autonomous Maintenance Mode</title><style>body{font-family:Inter,Arial,sans-serif;background:#020617;color:#e2e8f0;padding:24px;}table{width:100%;border-collapse:collapse;margin-bottom:28px;}td,th{border:1px solid rgba(255,255,255,.12);padding:10px;}th{background:#111827;}</style></head><body><h1>Autonomous Maintenance Mode</h1><h2>Queue</h2><table><thead><tr><th>ID</th><th>Type</th><th>Status</th><th>Summary</th><th>Attempts</th></tr></thead><tbody>${taskRows}</tbody></table><h2>Ledger</h2><table><thead><tr><th>At</th><th>Task</th><th>Pass</th><th>Detail</th></tr></thead><tbody>${ledgerRows}</tbody></table></body></html>`;
}

export function summarizeMaintenanceSignals(projectRoot) {
  const tasks = detectMaintenanceCandidates(projectRoot);
  return {
    maintenanceCandidateCount: tasks.length,
    candidateTypes: [...new Set(tasks.map(task => task.taskType))],
    unattendedWorthwhile: tasks.some(task => ['dependency-upgrade', 'doc-refresh', 'infra-drift'].includes(task.taskType))
  };
}
