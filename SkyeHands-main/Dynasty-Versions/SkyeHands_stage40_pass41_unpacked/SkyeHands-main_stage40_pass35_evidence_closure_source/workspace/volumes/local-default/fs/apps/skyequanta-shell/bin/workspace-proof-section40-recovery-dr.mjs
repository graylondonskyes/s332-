import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { createWorkspace, deleteWorkspace } from '../lib/workspace-manager.mjs';
import {
  acquireStartupLock,
  appendRecoveryJournal,
  getRecoveryTimingPacket,
  measureRecoveryOperation,
  reapOrphanWorkspaceProcesses,
  readRecoveryJournal,
  reconcileWorkspaceRuntime,
  releaseStartupLock
} from '../lib/runtime-recovery.mjs';
import {
  exportEncryptedBackupBundle,
  restoreEncryptedBackupBundle,
  verifyEncryptedBackupBundle
} from '../lib/backup-bundle.mjs';

function assertCheck(pass, message, detail = null) {
  return { pass: Boolean(pass), message, detail };
}

function runtimeStateFile(config, workspaceId) {
  return path.join(config.rootDir, '.skyequanta', 'workspace-runtime', workspaceId, 'state.json');
}

function ensureJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function isPidRunning(pid) {
  const normalized = Number.parseInt(String(pid || ''), 10);
  if (!Number.isInteger(normalized) || normalized <= 0) return false;
  try {
    process.kill(normalized, 0);
    return true;
  } catch {
    return false;
  }
}

async function sleep(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForExit(pid, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!isPidRunning(pid)) return true;
    await sleep(100);
  }
  return !isPidRunning(pid);
}

function startSleepProcess(seconds = 60) {
  return spawn('sleep', [String(seconds)], { stdio: 'ignore' });
}

async function runStartupLockSmoke(config) {
  const workspaceId = 'section40-lock-test';
  createWorkspace(config, workspaceId, { source: 'section40', tenantId: 'tenant-recovery' });
  const first = acquireStartupLock(config, workspaceId, { holder: 'section40-test', ttlMs: 2000 });
  const second = acquireStartupLock(config, workspaceId, { holder: 'section40-test-duplicate', ttlMs: 2000 });
  const stalePath = path.join(config.rootDir, '.skyequanta', 'workspace-runtime', workspaceId, 'startup.lock.json');
  ensureJson(stalePath, {
    version: 1,
    workspaceId,
    pid: 999999,
    acquiredAt: new Date(Date.now() - 60_000).toISOString(),
    holder: 'stale-test',
    ttlMs: 1000
  });
  const replaced = acquireStartupLock(config, workspaceId, { holder: 'section40-test-replaced', ttlMs: 1000 });
  const released = releaseStartupLock(config, workspaceId, { holder: 'section40-test-replaced' });
  return {
    ok: first.acquired && !second.acquired && second.reason === 'active_lock' && replaced.acquired && replaced.staleReplaced && released.released,
    workspaceId,
    first,
    second,
    replaced,
    released
  };
}

async function runReconcileSmoke(config) {
  const workspaceId = 'section40-reconcile-test';
  createWorkspace(config, workspaceId, { source: 'section40', tenantId: 'tenant-recovery' });
  const live = startSleepProcess(60);
  const statePath = runtimeStateFile(config, workspaceId);
  ensureJson(statePath, {
    version: 1,
    workspaceId,
    driver: 'remote-executor',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    processes: {
      idePid: live.pid,
      agentPid: 999999
    },
    capabilities: {
      remoteExecutor: true
    }
  });
  const staleLock = acquireStartupLock(config, workspaceId, { holder: 'section40-reconcile', ttlMs: 1000 });
  const reconciled = reconcileWorkspaceRuntime(config, workspaceId, { lockTtlMs: 1000 });
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  live.kill('SIGTERM');
  await waitForExit(live.pid);
  return {
    ok: staleLock.acquired && reconciled.reconciled && state.processes.idePid === live.pid && state.processes.agentPid === null && state.recovery?.status === 'partial' && reconciled.startupLockCleared,
    workspaceId,
    staleLock,
    reconciled,
    state
  };
}

async function runOrphanReaperSmoke(config) {
  const workspaceId = 'section40-orphan-state';
  const live = startSleepProcess(60);
  const statePath = runtimeStateFile(config, workspaceId);
  ensureJson(statePath, {
    version: 1,
    workspaceId,
    driver: 'remote-executor',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    processes: {
      idePid: live.pid,
      agentPid: null
    },
    capabilities: {
      remoteExecutor: true
    }
  });
  const reaped = reapOrphanWorkspaceProcesses(config, { includeUnknownOnly: true });
  const exited = await waitForExit(live.pid);
  const nextState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  return {
    ok: reaped.reapedCount >= 1 && exited && nextState.processes.idePid === null,
    workspaceId,
    reaped,
    exited,
    state: nextState
  };
}

async function runBackupDisasterRecoverySmoke(config) {
  const distDir = path.join(config.rootDir, 'dist', 'section40');
  fs.mkdirSync(distDir, { recursive: true });
  const backupFile = path.join(distDir, 'section40-backup.json');
  const corruptFile = path.join(distDir, 'section40-backup-corrupt.json');
  const restoreDir = path.join(distDir, 'restore-target');
  const passphrase = 'section40-backup-passphrase';
  const exportTimed = await measureRecoveryOperation(config, 'backup_export', async () => exportEncryptedBackupBundle(config.rootDir, backupFile, { passphrase }));
  const verifyTimed = await measureRecoveryOperation(config, 'backup_verify', async () => verifyEncryptedBackupBundle(backupFile, passphrase));
  const raw = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  raw.ciphertext = String(raw.ciphertext || '').replace(/A/g, 'B').replace(/B/, 'A');
  fs.writeFileSync(corruptFile, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
  let corruptError = null;
  try {
    verifyEncryptedBackupBundle(corruptFile, passphrase);
  } catch (error) {
    corruptError = error instanceof Error ? error.message : String(error);
  }
  const restoreTimed = await measureRecoveryOperation(config, 'backup_restore', async () => restoreEncryptedBackupBundle(backupFile, passphrase, restoreDir));
  const restoredPolicy = path.join(restoreDir, '.skyequanta', 'governance-policy.json');
  return {
    ok: exportTimed.result.ok && verifyTimed.result.ok && Boolean(corruptError) && restoreTimed.result.ok && fs.existsSync(restoredPolicy),
    backupFile,
    corruptFile,
    restoreDir,
    exportTimed,
    verifyTimed,
    restoreTimed,
    corruptError,
    restoredPolicyExists: fs.existsSync(restoredPolicy)
  };
}

async function main() {
  const strict = process.argv.includes('--strict');
  const baseConfig = getStackConfig(process.env);
  const env = withLocalBinPath(loadShellEnv(baseConfig));
  const config = getStackConfig(env);
  ensureRuntimeState(config, env);
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section40-recovery-dr.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_40_RUNTIME_RECOVERY_AND_DR.json');

  try {
    const startupLock = await runStartupLockSmoke(config);
    const reconcile = await runReconcileSmoke(config);
    const orphanReaper = await runOrphanReaperSmoke(config);
    const backupDr = await runBackupDisasterRecoverySmoke(config);
    const journalTail = readRecoveryJournal(config, { limit: 40 });
    const timingPacket = getRecoveryTimingPacket(config);

    const checks = [
      assertCheck(startupLock.ok, 'startup lock lane blocks double-start and replaces stale locks safely', startupLock),
      assertCheck(reconcile.ok, 'runtime reconciler preserves surviving process truth, nulls dead pids, and clears stale startup locks', reconcile),
      assertCheck(orphanReaper.ok, 'orphan reaper terminates unknown workspace processes and scrubs runtime state', orphanReaper),
      assertCheck(backupDr.ok, 'encrypted backup export, integrity verification, corruption detection, and restore are smoke-proven', backupDr)
    ];

    let payload = {
      section: 40,
      label: 'section-40-runtime-recovery-and-dr',
      generatedAt: new Date().toISOString(),
      strict,
      proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section40-recovery-dr.mjs --strict',
      smokeCommand: 'bash scripts/smoke-section40-recovery-dr.sh',
      pass: checks.every(item => item.pass),
      checks,
      evidence: {
        startupLock,
        reconcile,
        orphanReaper,
        backupDr,
        journalTail,
        timingPacket
      }
    };
    payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section40-recovery-dr.mjs');
    if (strict && !payload.pass) {
      throw new Error('Section 40 runtime recovery and disaster recovery proof failed in strict mode.');
    }
    console.log(JSON.stringify(payload, null, 2));
  } finally {
    for (const workspaceId of ['section40-lock-test', 'section40-reconcile-test']) {
      try { deleteWorkspace(config, workspaceId, { deletedBy: 'section40-cleanup' }); } catch {}
    }
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
