#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { appendAuditEvent } from '../lib/governance-manager.mjs';
import { ensureProviderVaultStore, saveProviderProfile, deleteProviderProfile } from '../lib/provider-vault.mjs';
import { createWorkspace, deleteWorkspace, getWorkspaceRuntime, startWorkspace, stopWorkspace } from '../lib/workspace-manager.mjs';
import { getProviderOutboundNetworkPolicy, testProviderConnection } from '../lib/provider-connectors.mjs';

function assertCheck(pass, message, detail = null) {
  return { pass: Boolean(pass), message, detail };
}

function readJson(filePath, fallback = null) {
  if (!filePath || !fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function parseJson(stdout) {
  try {
    return JSON.parse(String(stdout || '').trim());
  } catch {
    return null;
  }
}

function killPid(pid, signal = 'SIGKILL') {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}

async function runNetworkPolicySmoke() {
  const policy = getProviderOutboundNetworkPolicy({
    ...process.env,
    SKYEQUANTA_OUTBOUND_ALLOWED_HOSTS_CLOUDFLARE: 'api.cloudflare.com'
  });
  const result = await testProviderConnection(
    { provider: 'cloudflare', alias: 'section38-network', capabilities: ['deploy'] },
    {
      apiToken: 'token-section38-abcdefghijk',
      accountId: 'account-12345678',
      apiBaseUrl: 'http://127.0.0.1:8787'
    },
    { provider: 'cloudflare' }
  );
  return {
    ok: result.ok === false && /blocked/.test((result.errors || []).join(' ')),
    policy,
    result
  };
}

function runReleaseProvenanceSmoke(config, env) {
  const result = spawnSync(process.execPath, ['apps/skyequanta-shell/bin/release-provenance.mjs', '--json', '--generate-key', '--output-dir', 'dist/release-provenance/section38'], {
    cwd: config.rootDir,
    env,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024
  });
  const payload = parseJson(result.stdout);
  const attestation = readJson(path.join(config.rootDir, payload?.attestationPath || ''), {});
  return {
    ok: result.status === 0 && Boolean(payload?.ok) && Boolean(payload?.verification?.ok) && Boolean(attestation?.signing?.verified),
    commandStatus: result.status,
    payload,
    attestationSigning: attestation?.signing || null,
    stderrTail: String(result.stderr || '').split(/\r?\n/).filter(Boolean).slice(-20)
  };
}

function runBackupRestoreSmoke(config, env) {
  ensureProviderVaultStore(config);
  const profileId = 'section38-backup-profile';
  try {
    deleteProviderProfile(config, { profileId, tenantId: 'local', actorId: 'section38-cleanup' });
  } catch {}
  saveProviderProfile(config, {
    profileId,
    tenantId: 'local',
    provider: 'env_bundle',
    alias: 'section38-backup',
    unlockSecret: 'Section38-Backup-Unlock-Secret-!903',
    secretPayload: {
      bundleName: 'section38-backup',
      env: {
        SECTION38_BACKUP_SECRET: 'TOP-SECRET-SECTION38'
      }
    },
    actorId: 'section38'
  });
  appendAuditEvent(config, {
    action: 'section38.backup.marker',
    actorType: 'system',
    actorId: 'section38',
    tenantId: 'local',
    detail: { marker: true }
  });
  createWorkspace(config, 'section38-backup-workspace', { source: 'section38', tenantId: 'local' });

  const backupResult = spawnSync(process.execPath, [
    'apps/skyequanta-shell/bin/backup-export.mjs',
    '--json',
    '--output', 'dist/backups/section38/backup.sqbkp',
    '--passphrase', 'Section38-Backup-Passphrase-!903',
    '--include', '.skyequanta/provider-vault.json',
    '--include', '.skyequanta/audit-chain.ndjson',
    '--include', '.skyequanta/workspaces.json'
  ], {
    cwd: config.rootDir,
    env,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024
  });
  const backupPayload = parseJson(backupResult.stdout);

  const restoreResult = spawnSync(process.execPath, [
    'apps/skyequanta-shell/bin/backup-restore.mjs',
    '--json',
    '--input', 'dist/backups/section38/backup.sqbkp',
    '--passphrase', 'Section38-Backup-Passphrase-!903',
    '--dest', 'dist/backups/section38/restore-target'
  ], {
    cwd: config.rootDir,
    env,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024
  });
  const restorePayload = parseJson(restoreResult.stdout);
  const bundleText = fs.readFileSync(path.join(config.rootDir, 'dist/backups/section38/backup.sqbkp'), 'utf8');
  const restoredVaultPath = path.join(config.rootDir, 'dist/backups/section38/restore-target/.skyequanta/provider-vault.json');
  const restoredVaultText = fs.existsSync(restoredVaultPath) ? fs.readFileSync(restoredVaultPath, 'utf8') : '';
  return {
    ok: backupResult.status === 0 && restoreResult.status === 0 && Boolean(backupPayload?.ok) && Boolean(restorePayload?.ok) && fs.existsSync(restoredVaultPath) && !bundleText.includes('TOP-SECRET-SECTION38') && !restoredVaultText.includes('TOP-SECRET-SECTION38'),
    backupPayload,
    restorePayload,
    backupStatus: backupResult.status,
    restoreStatus: restoreResult.status,
    restoredVaultExists: fs.existsSync(restoredVaultPath)
  };
}

async function runChaosRecoverySmoke(config, env) {
  const workspaceId = 'section38-chaos';
  createWorkspace(config, workspaceId, { source: 'section38-chaos', tenantId: 'local' });
  await startWorkspace(config, workspaceId, 'section38-chaos-start');
  const before = getWorkspaceRuntime(config, workspaceId);
  const killedAgent = killPid(before?.state?.processes?.agentPid, 'SIGKILL');
  const killedIde = killPid(before?.state?.processes?.idePid, 'SIGKILL');
  const recoverResult = spawnSync(process.execPath, ['apps/skyequanta-shell/bin/executor-recover.mjs', '--workspace', workspaceId, '--restart', '--json'], {
    cwd: config.rootDir,
    env,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024
  });
  const recoverPayload = parseJson(recoverResult.stdout);
  const after = getWorkspaceRuntime(config, workspaceId);
  return {
    ok: Boolean(killedAgent || killedIde) && recoverResult.status === 0 && Boolean(recoverPayload?.after?.runtime?.running) && Boolean(after?.runtime?.running),
    before,
    after,
    killedAgent,
    killedIde,
    recoverStatus: recoverResult.status,
    recoverPayload,
    stderrTail: String(recoverResult.stderr || '').split(/\r?\n/).filter(Boolean).slice(-20)
  };
}

async function main() {
  const strict = process.argv.includes('--strict');
  const seed = Date.now() % 1000;
  const seededEnv = {
    ...process.env,
    SKYEQUANTA_REMOTE_EXECUTOR_PORT: String(3800 + seed),
    SKYEQUANTA_BRIDGE_PORT: String(3400 + seed)
  };
  const baseConfig = getStackConfig(seededEnv);
  ensureRuntimeState(baseConfig, seededEnv);
  const env = withLocalBinPath(loadShellEnv(baseConfig));
  env.SKYEQUANTA_REMOTE_EXECUTOR_PORT = seededEnv.SKYEQUANTA_REMOTE_EXECUTOR_PORT;
  env.SKYEQUANTA_BRIDGE_PORT = seededEnv.SKYEQUANTA_BRIDGE_PORT;
  const config = getStackConfig(env);
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_38_PRODUCTION_HARDENING_PLUS.json');
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section38-hardening-plus.mjs');

  let networkSmoke = null;
  let provenanceSmoke = null;
  let backupSmoke = null;
  let chaosSmoke = null;
  try {
    networkSmoke = await runNetworkPolicySmoke();
    provenanceSmoke = runReleaseProvenanceSmoke(config, env);
    backupSmoke = runBackupRestoreSmoke(config, env);
    chaosSmoke = await runChaosRecoverySmoke(config, env);

    const checks = [
      assertCheck(networkSmoke.ok, 'outbound network policy blocks local/private provider probe targets', networkSmoke),
      assertCheck(provenanceSmoke.ok, 'release provenance bundle generates manifest, SBOM, and verified attestation', provenanceSmoke),
      assertCheck(backupSmoke.ok, 'encrypted backup export and restore completes without plaintext provider secret leakage', backupSmoke),
      assertCheck(chaosSmoke.ok, 'chaos recovery rehydrates a workspace after hard-killing runtime processes', chaosSmoke)
    ];

    let payload = {
      section: 38,
      label: 'section-38-production-hardening-plus',
      generatedAt: new Date().toISOString(),
      strict,
      proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section38-hardening-plus.mjs --strict',
      smokeCommand: 'bash scripts/smoke-section38-hardening-plus.sh',
      pass: checks.every(item => item.pass),
      checks,
      evidence: {
        networkSmoke,
        provenanceSmoke,
        backupSmoke,
        chaosSmoke
      }
    };

    payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section38-hardening-plus.mjs');
    if (strict && !payload.pass) {
      throw new Error('Section 38 production hardening plus proof failed in strict mode.');
    }
    console.log(JSON.stringify(payload, null, 2));
  } finally {
    try { await stopWorkspace(config, 'section38-chaos', 'section38-cleanup'); } catch {}
    try { deleteWorkspace(config, 'section38-chaos', { deletedBy: 'section38-cleanup' }); } catch {}
    try { deleteWorkspace(config, 'section38-backup-workspace', { deletedBy: 'section38-cleanup' }); } catch {}
    try { deleteProviderProfile(config, { profileId: 'section38-backup-profile', tenantId: 'local', actorId: 'section38-cleanup' }); } catch {}
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
