import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { createBridgeServer } from '../lib/bridge.mjs';
import { writeArtifactAttestationBundle } from '../lib/artifact-attestation.mjs';
import { writeExecutionAttestationBundle, verifyExecutionAttestation } from '../lib/execution-attestation.mjs';
import { writeRemoteSurfaceVerificationBundle } from '../lib/remote-surface-verifier.mjs';
import { runSandboxedSync } from '../lib/runtime-sandbox.mjs';
import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { assertCheck } from './provider-proof-helpers.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function parseLastJson(stdout) {
  const lines = String(stdout || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]);
    } catch {}
  }
  return null;
}

function runReleaseSanitize(config) {
  const result = spawnSync('node', [path.join(config.shellDir, 'bin', 'release-sanitize.mjs'), '--json'], {
    cwd: config.rootDir,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  const stdout = String(result.stdout || '');
  let payload = null;
  try {
    payload = JSON.parse(stdout);
  } catch {
    payload = parseLastJson(stdout);
  }
  return {
    ok: result.status === 0,
    status: result.status,
    stdout,
    stderr: String(result.stderr || ''),
    payload
  };
}

async function withBridgeServer(config, envOverrides, callback) {
  const snapshot = {};
  for (const [key, value] of Object.entries(envOverrides || {})) {
    snapshot[key] = Object.prototype.hasOwnProperty.call(process.env, key) ? process.env[key] : undefined;
    process.env[key] = String(value);
  }
  const server = createBridgeServer(config);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.bridge.port, config.bridge.host, resolve);
  });
  try {
    return await callback();
  } finally {
    await new Promise(resolve => server.close(resolve));
    for (const [key, value] of Object.entries(snapshot)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function runExecutionReceiptProof(config) {
  const outputDir = path.join(config.rootDir, 'dist', 'section44', 'execution-attestation');
  ensureDirectory(outputDir);
  const bundle = writeExecutionAttestationBundle(config.rootDir, outputDir, {
    workspaceId: 'section44',
    label: 'self-attest',
    effectiveMode: process.env.SKYEQUANTA_RUNTIME_SANDBOX_EFFECTIVE_MODE || 'host-process',
    verify: {
      expectedEffectiveMode: process.env.SKYEQUANTA_RUNTIME_SANDBOX_EFFECTIVE_MODE || 'host-process',
      requireCgroupEvidence: true
    }
  });
  return {
    ok: bundle.ok && fs.existsSync(bundle.attestationFile) && fs.existsSync(bundle.verifyFile),
    bundle
  };
}

async function runRemoteSurfaceVerificationProof(config) {
  const release = runReleaseSanitize(config);
  if (!release.ok || !release.payload?.archiveFile) {
    return { ok: false, reason: 'release_sanitize_failed', release };
  }
  const artifactPath = path.join(config.rootDir, release.payload.archiveFile);
  const outputDir = path.join(config.rootDir, 'dist', 'section44', 'surface-verify');
  ensureDirectory(outputDir);
  const artifactBundle = writeArtifactAttestationBundle(config.rootDir, artifactPath, path.join(outputDir, 'artifact-attestation'), {
    productName: config.productName
  });
  const port = 35000 + (process.pid % 1000);
  const env = {
    ...process.env,
    SKYEQUANTA_BRIDGE_PORT: String(port),
    SKYEQUANTA_SURFACE_ARTIFACT: artifactPath
  };
  const liveBaseConfig = getStackConfig(env);
  ensureRuntimeState(liveBaseConfig, env);
  const liveEnv = withLocalBinPath({ ...loadShellEnv(liveBaseConfig), ...env });
  const liveConfig = getStackConfig(liveEnv);
  const surfaceUrl = `http://${liveConfig.bridge.host}:${liveConfig.bridge.port}/api/surface-identity`;
  const verificationBundle = await withBridgeServer(liveConfig, {
    SKYEQUANTA_BRIDGE_PORT: String(port),
    SKYEQUANTA_SURFACE_ARTIFACT: artifactPath
  }, async () => writeRemoteSurfaceVerificationBundle(config.rootDir, outputDir, surfaceUrl, {
    artifactAttestationFile: artifactBundle.attestationFile
  }));
  return {
    ok: artifactBundle.ok && verificationBundle.ok,
    artifactPath,
    surfaceUrl,
    release,
    artifactBundle,
    verificationBundle
  };
}

async function runKillPathProof(config) {
  const workspaceDir = path.join(config.rootDir, 'dist', 'section44', 'killpath-workspace');
  ensureDirectory(workspaceDir);
  const receiptFile = path.join(workspaceDir, 'killpath-child-attestation.json');
  const markerFile = path.join(workspaceDir, 'killpath-child.json');
  try { fs.unlinkSync(receiptFile); } catch {}
  try { fs.unlinkSync(markerFile); } catch {}

  const script = [
    "import fs from 'node:fs';",
    "const mod = await import(process.env.SECTION44_EXECUTION_MODULE);",
    "const built = mod.buildExecutionAttestation('self', {",
    "  workspaceId: 'section44',",
    "  label: 'killpath-child',",
    "  requestedMode: process.env.SKYEQUANTA_RUNTIME_SANDBOX_MODE || null,",
    "  effectiveMode: process.env.SKYEQUANTA_RUNTIME_SANDBOX_EFFECTIVE_MODE || null,",
    "  evidence: { phase: 'pre-killpath-loop' }",
    "});",
    "fs.writeFileSync(process.env.SECTION44_RECEIPT_FILE, JSON.stringify(built.receipt, null, 2) + '\\n', 'utf8');",
    "const marker = { pid: process.pid, cgroup: fs.readFileSync('/proc/self/cgroup', 'utf8') };",
    "fs.writeFileSync(process.env.SECTION44_MARKER_FILE, JSON.stringify(marker, null, 2) + '\\n', 'utf8');",
    "console.log(JSON.stringify(marker));",
    "while (true) {}"
  ].join('\n');

  const start = Date.now();
  const result = runSandboxedSync('node', ['--input-type=module', '-e', script], {
    env: {
      ...process.env,
      SECTION44_EXECUTION_MODULE: path.join(config.shellDir, 'lib', 'execution-attestation.mjs'),
      SECTION44_RECEIPT_FILE: receiptFile,
      SECTION44_MARKER_FILE: markerFile,
      SKYEQUANTA_RUNTIME_SANDBOX_MODE: 'process',
      SKYEQUANTA_RUNTIME_LIMITS_ENABLED: '1',
      SKYEQUANTA_RUNTIME_LIMIT_CPU_SECONDS: '1',
      SKYEQUANTA_RUNTIME_LIMIT_MEMORY_MB: '4096',
      SKYEQUANTA_RUNTIME_LIMIT_NPROC: '4096',
      SKYEQUANTA_RUNTIME_LIMIT_NOFILE: '1024'
    },
    rootDir: config.rootDir,
    cwd: workspaceDir,
    workspaceId: 'section44',
    label: 'killpath-proof',
    maxBuffer: 4 * 1024 * 1024
  });
  const elapsedMs = Date.now() - start;
  const marker = fs.existsSync(markerFile) ? JSON.parse(fs.readFileSync(markerFile, 'utf8')) : null;
  const receipt = fs.existsSync(receiptFile) ? JSON.parse(fs.readFileSync(receiptFile, 'utf8')) : null;
  const verification = receipt ? verifyExecutionAttestation(receipt, {
    expectedEffectiveMode: 'prlimit-process',
    requireCgroupEvidence: true
  }) : { ok: false, reason: 'receipt_missing' };
  const killSignal = String(result.signal || '');
  const killedByEnvelope = ['SIGKILL', 'SIGXCPU'].includes(killSignal) || result.status === 137 || result.status === 152;
  return {
    ok: Boolean(marker && receipt)
      && verification.ok
      && result.usedPrlimit
      && killedByEnvelope
      && elapsedMs < 7000,
    elapsedMs,
    result: {
      ok: result.ok,
      status: result.status,
      signal: result.signal,
      usedPrlimit: result.usedPrlimit,
      sandboxMode: result.sandboxMode,
      stdout: String(result.stdout || '').slice(0, 400),
      stderr: String(result.stderr || '').slice(0, 400)
    },
    marker,
    verification,
    receiptFile
  };
}

async function main() {
  const strict = process.argv.includes('--strict');
  const baseConfig = getStackConfig(process.env);
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section44-execution-enforcement.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_44_EXECUTION_ATTESTATION_AND_KILLPATH.json');

  const executionReceiptProof = await runExecutionReceiptProof(config);
  const remoteSurfaceVerificationProof = await runRemoteSurfaceVerificationProof(config);
  const killPathProof = await runKillPathProof(config);

  const checks = [
    assertCheck(executionReceiptProof.ok, 'signed runtime execution-attestation lane emits verifiable receipts with namespace, seccomp, no-new-privileges, AppArmor, and cgroup evidence', executionReceiptProof),
    assertCheck(remoteSurfaceVerificationProof.ok, 'remote surface verifier binds the fetched signed /api/surface-identity document to the expected artifact attestation bundle', remoteSurfaceVerificationProof),
    assertCheck(killPathProof.ok, 'universal kill-path enforcement lane terminates hostile CPU-bound workloads with the runtime envelope and exports a signed child execution receipt before termination', killPathProof)
  ];

  let payload = {
    section: 44,
    label: 'section-44-execution-attestation-and-killpath',
    generatedAt: new Date().toISOString(),
    strict,
    proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section44-execution-enforcement.mjs --strict',
    smokeCommand: 'bash scripts/smoke-section44-execution-enforcement.sh',
    pass: checks.every(item => item.pass),
    checks,
    evidence: {
      executionReceiptProof,
      remoteSurfaceVerificationProof,
      killPathProof
    }
  };
  payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section44-execution-enforcement.mjs');
  if (strict && !payload.pass) {
    throw new Error('Section 44 execution attestation / kill-path proof failed in strict mode.');
  }
  console.log(JSON.stringify(payload, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
