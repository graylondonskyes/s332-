import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { runSandboxedSync, observeLinuxProcessConfinement } from '../lib/runtime-sandbox.mjs';
import { writeDeploymentAttestationBundle } from '../lib/deploy-attestation.mjs';
import { exportEncryptedBackupBundle, rollbackEncryptedBackupBundle } from '../lib/backup-bundle.mjs';
import { measureRecoveryOperation, getRecoveryTimingPacket } from '../lib/runtime-recovery.mjs';
import { assertCheck } from './provider-proof-helpers.mjs';

function parseLastJson(stdout) {
  const lines = String(stdout || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]);
    } catch {}
  }
  return null;
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

async function runNamespaceProof(config) {
  const host = observeLinuxProcessConfinement('self');
  const env = {
    ...process.env,
    SKYEQUANTA_RUNTIME_SANDBOX_MODE: 'rootless-namespace',
    SKYEQUANTA_RUNTIME_SANDBOX_STRICT: '1',
    SKYEQUANTA_RUNTIME_SANDBOX_BLOCK_NETWORK: '1',
    SKYEQUANTA_RUNTIME_LIMITS_ENABLED: '0'
  };
  const code = [
    "const fs = require('node:fs');",
    "const net = require('node:net');",
    "const payload = {",
    "  pid: process.pid,",
    "  sandboxMode: process.env.SKYEQUANTA_RUNTIME_SANDBOX_EFFECTIVE_MODE,",
    "  scratchDir: process.env.SKYEQUANTA_SANDBOX_SCRATCH_DIR || '',",
    "  userNs: fs.readlinkSync('/proc/self/ns/user'),",
    "  pidNs: fs.readlinkSync('/proc/self/ns/pid'),",
    "  netNs: fs.readlinkSync('/proc/self/ns/net'),",
    "  mntNs: fs.readlinkSync('/proc/self/ns/mnt')",
    "};",
    "const mounts = fs.readFileSync('/proc/self/mounts', 'utf8').split('\\n');",
    "payload.scratchMounted = payload.scratchDir ? mounts.some(line => line.includes(payload.scratchDir) && line.includes(' tmpfs ')) : false;",
    "const socket = net.createConnection({ host: '1.1.1.1', port: 80, timeout: 800 });",
    "socket.on('connect', () => { payload.networkResult = 'connected'; console.log(JSON.stringify(payload)); socket.end(); });",
    "socket.on('timeout', () => { payload.networkResult = 'timeout'; console.log(JSON.stringify(payload)); socket.destroy(); });",
    "socket.on('error', error => { payload.networkResult = `${error.name}:${error.message}`; console.log(JSON.stringify(payload)); });"
  ].join('\n');
  const result = runSandboxedSync('node', ['-e', code], {
    env,
    cwd: config.rootDir,
    rootDir: config.rootDir,
    workspaceId: 'section41-rootless',
    label: 'namespace-proof'
  });
  const payload = parseLastJson(result.stdout);
  return {
    ok: result.ok
      && result.effectiveMode === 'rootless-namespace'
      && Boolean(payload?.scratchMounted)
      && payload?.sandboxMode === 'rootless-namespace'
      && payload?.userNs && payload.userNs !== host.namespaces.user
      && payload?.netNs && payload.netNs !== host.namespaces.net
      && String(payload?.networkResult || '').toLowerCase() !== 'connected',
    host,
    result: {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      effectiveMode: result.effectiveMode,
      scratchDir: result.scratchDir
    },
    payload
  };
}

async function runResourceLimitProof(config) {
  const env = {
    ...process.env,
    SKYEQUANTA_RUNTIME_SANDBOX_MODE: 'rootless-namespace',
    SKYEQUANTA_RUNTIME_SANDBOX_STRICT: '1',
    SKYEQUANTA_RUNTIME_SANDBOX_BLOCK_NETWORK: '1',
    SKYEQUANTA_RUNTIME_LIMITS_ENABLED: '1',
    SKYEQUANTA_RUNTIME_LIMIT_MEMORY_MB: '96',
    SKYEQUANTA_RUNTIME_LIMIT_CPU_SECONDS: '4',
    SKYEQUANTA_RUNTIME_LIMIT_NPROC: '64',
    SKYEQUANTA_RUNTIME_LIMIT_NOFILE: '32'
  };
  const code = [
    'import json, resource',
    'payload = {',
    '  "cpu": resource.getrlimit(resource.RLIMIT_CPU)[0],',
    '  "as": resource.getrlimit(resource.RLIMIT_AS)[0],',
    '  "nproc": resource.getrlimit(resource.RLIMIT_NPROC)[0],',
    '  "nofile": resource.getrlimit(resource.RLIMIT_NOFILE)[0]',
    '}',
    'print(json.dumps(payload))'
  ].join('\n');
  const result = runSandboxedSync('python3', ['-S', '-c', code], {
    env,
    cwd: config.rootDir,
    rootDir: config.rootDir,
    workspaceId: 'section41-rootless',
    label: 'limit-proof'
  });
  const payload = parseLastJson(result.stdout);
  return {
    ok: result.ok
      && result.usedPrlimit
      && result.effectiveMode === 'rootless-namespace'
      && payload?.cpu === 4
      && payload?.nproc === 64
      && payload?.nofile === 32
      && payload?.as > 0
      && payload?.as <= (96 * 1024 * 1024),
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    effectiveMode: result.effectiveMode,
    usedPrlimit: result.usedPrlimit,
    limits: result.limits,
    payload
  };
}

async function runDeploymentAttestationProof(config) {
  const outputDir = path.join(config.rootDir, 'dist', 'section41', 'deployment-attestation');
  const bundle = writeDeploymentAttestationBundle(config.rootDir, outputDir, {
    environment: 'section41-proof',
    deployTarget: 'self-hosted-proof'
  });
  const attestation = JSON.parse(fs.readFileSync(bundle.attestationFile, 'utf8'));
  const verify = JSON.parse(fs.readFileSync(bundle.verifyFile, 'utf8'));
  return {
    ok: Boolean(bundle.ok
      && verify.ok
      && attestation?.deploymentIdentity?.sourceTreeHash === attestation?.provenance?.sourceTreeHash
      && attestation?.deploymentIdentity?.releaseVersion),
    bundle: {
      ok: bundle.ok,
      outputDir: bundle.outputDir,
      attestationFile: bundle.attestationFile,
      verifyFile: bundle.verifyFile,
      verification: bundle.verification,
      deploymentIdentity: bundle.deploymentIdentity
    },
    attestation,
    verify
  };
}

async function runRollbackProof(config) {
  const rollbackDir = path.join(config.rootDir, 'dist', 'section41', 'rollback-target');
  ensureDirectory(rollbackDir);
  const relativeTarget = path.join('dist', 'section41', 'rollback-target', 'runtime-state.json').replace(/\\/g, '/');
  const targetFile = path.join(config.rootDir, relativeTarget);
  const original = {
    version: 1,
    marker: 'section41-original',
    updatedAt: new Date().toISOString(),
    state: { secure: true, rollbackProof: true }
  };
  fs.writeFileSync(targetFile, `${JSON.stringify(original, null, 2)}\n`, 'utf8');
  const backupFile = path.join(rollbackDir, 'runtime-state.backup.json');
  const passphrase = 'section41-proof-passphrase';
  const exportResult = exportEncryptedBackupBundle(config.rootDir, backupFile, {
    passphrase,
    includePaths: [relativeTarget]
  });
  fs.writeFileSync(targetFile, JSON.stringify({ version: 2, marker: 'section41-mutated', compromised: true }, null, 2), 'utf8');
  const rollbackMeasured = await measureRecoveryOperation(config, 'section41_backup_rollback', async () => rollbackEncryptedBackupBundle(backupFile, passphrase, config.rootDir));
  const restored = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
  const timingPacket = getRecoveryTimingPacket(config);
  return {
    ok: exportResult.ok
      && rollbackMeasured.result.ok
      && restored.marker === original.marker
      && Array.isArray(timingPacket.timings)
      && timingPacket.timings.some(item => item.label === 'section41_backup_rollback' && Number.isFinite(item.elapsedMs)),
    exportResult,
    rollback: rollbackMeasured.result,
    elapsedMs: rollbackMeasured.elapsedMs,
    restored,
    timingPacket
  };
}

async function main() {
  const strict = process.argv.includes('--strict');
  const baseConfig = getStackConfig(process.env);
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section41-rootless-deploy.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_41_ROOTLESS_NAMESPACE_AND_DEPLOY_TRUST.json');

  const namespaceProof = await runNamespaceProof(config);
  const resourceLimitProof = await runResourceLimitProof(config);
  const deploymentProof = await runDeploymentAttestationProof(config);
  const rollbackProof = await runRollbackProof(config);

  const checks = [
    assertCheck(namespaceProof.ok, 'rootless namespace runtime launch creates isolated user/pid/net/mount namespaces and blocks outbound network by default', namespaceProof),
    assertCheck(resourceLimitProof.ok, 'live runtime resource envelope applies prlimit CPU, address-space, process-count, and file-handle ceilings before runtime code executes', resourceLimitProof),
    assertCheck(deploymentProof.ok, 'signed deployment attestation binds release identity to provenance hashes and verifies cleanly', deploymentProof),
    assertCheck(rollbackProof.ok, 'rollback timing packet restores prior runtime state and records elapsed recovery evidence', rollbackProof)
  ];

  let payload = {
    section: 41,
    label: 'section-41-rootless-namespace-and-deploy-trust',
    generatedAt: new Date().toISOString(),
    strict,
    proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section41-rootless-deploy.mjs --strict',
    smokeCommand: 'bash scripts/smoke-section41-rootless-deploy.sh',
    pass: checks.every(item => item.pass),
    checks,
    evidence: {
      namespaceProof,
      resourceLimitProof,
      deploymentProof,
      rollbackProof
    }
  };
  payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section41-rootless-deploy.mjs');
  if (strict && !payload.pass) {
    throw new Error('Section 41 rootless namespace / deploy trust proof failed in strict mode.');
  }
  console.log(JSON.stringify(payload, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
