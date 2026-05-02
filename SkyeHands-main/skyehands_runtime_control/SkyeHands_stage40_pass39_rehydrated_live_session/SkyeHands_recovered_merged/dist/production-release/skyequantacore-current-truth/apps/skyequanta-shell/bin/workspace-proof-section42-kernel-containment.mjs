import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { runSandboxedSync, observeLinuxProcessConfinement } from '../lib/runtime-sandbox.mjs';
import { writeArtifactAttestationBundle } from '../lib/artifact-attestation.mjs';
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

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
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

async function runPivotRootfsProof(config) {
  const pivotWorkspaceDir = path.join(config.rootDir, 'dist', 'section42', 'pivot-workspace');
  ensureDirectory(pivotWorkspaceDir);
  fs.writeFileSync(path.join(pivotWorkspaceDir, 'app.txt'), 'section42-pivot\n', 'utf8');
  fs.writeFileSync(path.join(config.rootDir, 'dist', 'section42', 'host-secret.txt'), 'section42-host-secret\n', 'utf8');
  const host = observeLinuxProcessConfinement('self');
  const result = runSandboxedSync('node', ['-e', [
    'const fs = require("node:fs");',
    'console.log(JSON.stringify({',
    '  cwd: process.cwd(),',
    '  pivot: process.env.SKYEQUANTA_RUNTIME_PIVOT_ROOTFS_EFFECTIVE,',
    '  workspaceFile: fs.existsSync("/workspace/app.txt"),',
    '  hostSecret: fs.existsSync("/host-secret.txt"),',
    '  rootList: fs.readdirSync("/").sort()',
    '}));'
  ].join(' ')], {
    env: {
      ...process.env,
      SKYEQUANTA_RUNTIME_SANDBOX_MODE: 'rootless-namespace',
      SKYEQUANTA_RUNTIME_SANDBOX_STRICT: '1',
      SKYEQUANTA_RUNTIME_SANDBOX_BLOCK_NETWORK: '1',
      SKYEQUANTA_RUNTIME_LIMITS_ENABLED: '0',
      SKYEQUANTA_RUNTIME_PIVOT_ROOTFS: '1'
    },
    rootDir: config.rootDir,
    cwd: pivotWorkspaceDir,
    workspaceId: 'section42-pivot',
    label: 'pivot-proof'
  });
  const payload = parseLastJson(result.stdout);
  return {
    ok: result.ok
      && result.containment?.rootfs?.enabled
      && payload?.pivot === '1'
      && payload?.cwd === '/workspace'
      && payload?.workspaceFile === true
      && payload?.hostSecret === false
      && Array.isArray(payload?.rootList)
      && !payload.rootList.includes('etc')
      && result.containment?.rootfs?.bindings?.some(item => item.source === pivotWorkspaceDir)
      && result.containment?.rootfs?.bindings?.some(item => item.source === '/usr')
      && result.containment?.rootfs?.bindings?.some(item => item.source === '/opt')
      && result.containment?.rootfs?.bindings?.some(item => item.source === '/dev')
      && result.effectiveMode === 'rootless-namespace'
      && host.namespaces.mnt !== null,
    host,
    payload,
    result: {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      containment: result.containment,
      effectiveMode: result.effectiveMode
    }
  };
}

async function runCgroupPlacementProof(config) {
  const py = 'import json; print(json.dumps({"cgroup": open("/proc/self/cgroup").read()}))';
  const result = runSandboxedSync('python3', ['-S', '-c', py], {
    env: {
      ...process.env,
      SKYEQUANTA_RUNTIME_SANDBOX_MODE: 'process',
      SKYEQUANTA_RUNTIME_LIMITS_ENABLED: '0',
      SKYEQUANTA_RUNTIME_CGROUPS_ENABLED: '1',
      SKYEQUANTA_RUNTIME_CGROUP_CPU_PERCENT: '40',
      SKYEQUANTA_RUNTIME_CGROUP_MEMORY_MB: '128',
      SKYEQUANTA_RUNTIME_CGROUP_PIDS_MAX: '12'
    },
    rootDir: config.rootDir,
    cwd: config.rootDir,
    workspaceId: 'section42-kernel',
    label: 'cgroup-proof'
  });
  const payload = parseLastJson(result.stdout);
  const groupPaths = result.containment?.cgroups?.groupPaths || {};
  const controllerState = {
    cpuQuota: groupPaths.cpu ? fs.readFileSync(path.join(groupPaths.cpu, 'cpu.cfs_quota_us'), 'utf8').trim() : null,
    cpuPeriod: groupPaths.cpu ? fs.readFileSync(path.join(groupPaths.cpu, 'cpu.cfs_period_us'), 'utf8').trim() : null,
    memoryLimit: groupPaths.memory ? fs.readFileSync(path.join(groupPaths.memory, 'memory.limit_in_bytes'), 'utf8').trim() : null,
    pidsMax: groupPaths.pids ? fs.readFileSync(path.join(groupPaths.pids, 'pids.max'), 'utf8').trim() : null
  };
  const cgroupText = String(payload?.cgroup || '');
  const name = result.containment?.cgroups?.name || '';
  return {
    ok: result.ok
      && result.containment?.cgroups?.enabled
      && Boolean(name)
      && cgroupText.includes(name)
      && controllerState.cpuQuota === String(result.containment?.cgroups?.cpuQuota)
      && controllerState.cpuPeriod === String(result.containment?.cgroups?.cpuPeriod)
      && controllerState.memoryLimit === String(result.containment?.cgroups?.memoryBytes)
      && controllerState.pidsMax === String(result.containment?.cgroups?.pidsMax),
    payload,
    result: {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      containment: result.containment
    },
    controllerState
  };
}

async function runSeccompProof(config) {
  const code = [
    'import json, socket, sys',
    'status = open("/proc/self/status").read()',
    'seccomp = None',
    'for line in status.splitlines():',
    '    if line.startswith("Seccomp:\t"):',
    '        seccomp = line.split("\t", 1)[1].strip()',
    '        break',
    'payload = {"seccomp": seccomp}',
    'try:',
    '    socket.socket()',
    '    payload["socket"] = "allowed"',
    '    print(json.dumps(payload))',
    '    sys.exit(2)',
    'except OSError as error:',
    '    payload["socket"] = f"blocked:{error.errno}:{error}"',
    '    print(json.dumps(payload))',
    '    sys.exit(0)'
  ].join('\n');
  const result = runSandboxedSync('python3', ['-S', '-c', code], {
    env: {
      ...process.env,
      SKYEQUANTA_RUNTIME_SANDBOX_MODE: 'process',
      SKYEQUANTA_RUNTIME_LIMITS_ENABLED: '0',
      SKYEQUANTA_RUNTIME_SECCOMP_BASIC: '1'
    },
    rootDir: config.rootDir,
    cwd: config.rootDir,
    workspaceId: 'section42-kernel',
    label: 'seccomp-proof'
  });
  const payload = parseLastJson(result.stdout);
  return {
    ok: result.ok
      && result.containment?.seccomp?.enabled
      && payload?.seccomp === '2'
      && String(payload?.socket || '').startsWith('blocked:1:'),
    payload,
    result: {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      containment: result.containment
    }
  };
}

async function runArtifactProof(config) {
  const release = runReleaseSanitize(config);
  if (!release.ok || !release.payload?.archiveFile) {
    return {
      ok: false,
      release
    };
  }
  const artifactPath = path.join(config.rootDir, release.payload.archiveFile);
  const outputDir = path.join(config.rootDir, 'dist', 'section42', 'artifact-attestation');
  const bundle = writeArtifactAttestationBundle(config.rootDir, artifactPath, outputDir, {
    productName: config.productName,
    environment: 'section42-proof',
    deployTarget: 'artifact-bound'
  });
  const attestation = readJson(bundle.attestationFile, null);
  const verify = readJson(bundle.verifyFile, null);
  return {
    ok: release.ok
      && bundle.ok
      && verify?.ok
      && attestation?.artifact?.sha256 === verify?.artifact?.sha256
      && attestation?.artifact?.sizeBytes === verify?.artifact?.sizeBytes,
    release,
    bundle: {
      ok: bundle.ok,
      outputDir: bundle.outputDir,
      attestationFile: bundle.attestationFile,
      verifyFile: bundle.verifyFile,
      verification: bundle.verification,
      provenanceBundle: {
        manifestPath: bundle.provenanceBundle.manifestPath,
        sbomPath: bundle.provenanceBundle.sbomPath,
        attestationPath: bundle.provenanceBundle.attestationPath,
        sourceTreeHash: bundle.provenanceBundle.sourceTreeHash
      }
    },
    attestation,
    verify
  };
}

async function main() {
  const strict = process.argv.includes('--strict');
  const baseConfig = getStackConfig(process.env);
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section42-kernel-containment.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_42_KERNEL_CONTAINMENT_AND_ARTIFACT_IDENTITY.json');

  const pivotProof = await runPivotRootfsProof(config);
  const cgroupProof = await runCgroupPlacementProof(config);
  const seccompProof = await runSeccompProof(config);
  const artifactProof = await runArtifactProof(config);

  const checks = [
    assertCheck(pivotProof.ok, 'rootfs pivot lane remounts a trimmed filesystem view and moves runtime work into /workspace under rootless namespaces', pivotProof),
    assertCheck(cgroupProof.ok, 'kernel cgroup lane writes cpu/memory/pid controller ceilings and places the runtime inside the dedicated controller paths', cgroupProof),
    assertCheck(seccompProof.ok, 'basic seccomp filter lane is active in-process and blocks forbidden socket creation with kernel seccomp mode 2', seccompProof),
    assertCheck(artifactProof.ok, 'artifact-bound attestation signs the shipped release tarball and verifies the exact artifact hash and size', artifactProof)
  ];

  let payload = {
    section: 42,
    label: 'section-42-kernel-containment-and-artifact-identity',
    generatedAt: new Date().toISOString(),
    strict,
    proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section42-kernel-containment.mjs --strict',
    smokeCommand: 'bash scripts/smoke-section42-kernel-containment.sh',
    pass: checks.every(item => item.pass),
    checks,
    evidence: {
      pivotProof,
      cgroupProof,
      seccompProof,
      artifactProof
    }
  };
  payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section42-kernel-containment.mjs');
  if (strict && !payload.pass) {
    throw new Error('Section 42 kernel containment / artifact identity proof failed in strict mode.');
  }
  console.log(JSON.stringify(payload, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
