import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { assertCheck } from './provider-proof-helpers.mjs';
import {
  attachPidToDelegatedControllerPlan,
  buildDelegatedControllerPlan,
  cleanupDelegatedControllerPlan,
  detectDelegatedCgroupSupport,
  killDelegatedControllerPlan,
  materializeDelegatedControllerPlan,
  renderDelegatedControllerKillPlan,
  verifyPidAttachedToDelegatedControllerPlan
} from '../lib/cgroup-delegation.mjs';
import { runAppArmorCapabilityGate } from '../lib/apparmor-proof.mjs';
import { buildAppArmorLiveProofPack, runAppArmorLiveProofPackVerifier } from '../lib/apparmor-live-proof-pack.mjs';
import { createFixtureAppArmorHostProofReport, importAppArmorHostProof, verifyAppArmorHostProofReport } from '../lib/apparmor-live-proof-attestation.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
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
async function waitForFile(filePath, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.existsSync(filePath)) return true;
    await sleep(50);
  }
  return fs.existsSync(filePath);
}
async function waitForChildExit(child, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      return { exited: true, exitCode: child.exitCode, signalCode: child.signalCode };
    }
    await sleep(50);
  }
  return { exited: child.exitCode !== null || child.signalCode !== null, exitCode: child.exitCode, signalCode: child.signalCode };
}

async function runDelegatedControllerKillPathProof(config, delegatedPlan) {
  const workspaceDir = path.join(config.rootDir, 'dist', 'section45', 'delegated-controller-workspace');
  ensureDirectory(workspaceDir);
  const markerFile = path.join(workspaceDir, 'delegated-controller-child.json');
  try { fs.unlinkSync(markerFile); } catch {}

  const materialized = materializeDelegatedControllerPlan(delegatedPlan);
  if (!materialized.ok) {
    return { ok: false, reason: 'materialize_failed', materialized, delegatedPlan };
  }

  const script = [
    "import fs from 'node:fs';",
    'const marker = { pid: process.pid, startedAt: new Date().toISOString() };',
    "fs.writeFileSync(process.env.SECTION45_MARKER_FILE, JSON.stringify(marker, null, 2) + '\\n', 'utf8');",
    'console.log(JSON.stringify(marker));',
    'setInterval(() => {}, 1000);'
  ].join('\n');

  const child = spawn(process.execPath, ['--input-type=module', '-e', script], {
    cwd: workspaceDir,
    env: { ...process.env, SECTION45_MARKER_FILE: markerFile },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => { stdout += String(chunk); });
  child.stderr.on('data', chunk => { stderr += String(chunk); });

  try {
    const markerReady = await waitForFile(markerFile, 2000);
    const marker = markerReady ? JSON.parse(fs.readFileSync(markerFile, 'utf8')) : null;
    const attach = marker?.pid ? attachPidToDelegatedControllerPlan(delegatedPlan, marker.pid) : { ok: false, reason: 'marker_missing' };
    const membership = marker?.pid ? verifyPidAttachedToDelegatedControllerPlan(delegatedPlan, marker.pid) : { ok: false, reason: 'marker_missing' };
    const killPlan = renderDelegatedControllerKillPlan(delegatedPlan);
    const killResult = marker?.pid ? await killDelegatedControllerPlan(delegatedPlan, { skipPid: process.pid, timeoutMs: 3000 }) : { ok: false, reason: 'marker_missing' };
    const childExit = await waitForChildExit(child, 2000);
    const childGone = marker?.pid ? !processExists(marker.pid) : false;
    const cleanup = cleanupDelegatedControllerPlan(delegatedPlan);
    return {
      ok: Boolean(marker?.pid)
        && attach.ok
        && membership.ok
        && killPlan.ok
        && killResult.ok
        && childGone
        && (childExit.exited || childGone),
      marker,
      materialized,
      attach,
      membership,
      killPlan,
      killResult,
      childExit,
      childGone,
      cleanup,
      stdout: stdout.slice(0, 400),
      stderr: stderr.slice(0, 400)
    };
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      try { child.kill('SIGKILL'); } catch {}
      await waitForChildExit(child, 500);
    }
  }
}

async function main() {
  const strict = process.argv.includes('--strict');
  const baseConfig = getStackConfig(process.env);
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section45-apparmor-delegated.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_45_APPARMOR_AND_DELEGATED_CONTROLLER.json');
  const appArmorProof = runAppArmorCapabilityGate(config.rootDir, { workspaceId: 'section45', label: 'apparmor-live-proof' });
  const appArmorLiveProofPack = buildAppArmorLiveProofPack(config.rootDir, { workspaceId: 'section45', label: 'apparmor-live-proof' });
  const appArmorLiveProofPackVerify = runAppArmorLiveProofPackVerifier(appArmorLiveProofPack.packDir, { execute: false });
  const appArmorFixtureReport = createFixtureAppArmorHostProofReport(appArmorLiveProofPack.packDir, { reportId: 'section45-local-fixture-report' });
  const appArmorHostProofAttestation = importAppArmorHostProof(appArmorLiveProofPack.packDir, appArmorFixtureReport, { rootDir: config.rootDir, reportId: appArmorFixtureReport.reportId });
  const appArmorHostProofTamper = verifyAppArmorHostProofReport(appArmorLiveProofPack.packDir, { ...appArmorFixtureReport, manifestHash: 'tampered-manifest-hash' });
  const delegatedSupport = detectDelegatedCgroupSupport();
  const delegatedPlan = buildDelegatedControllerPlan({
    support: delegatedSupport,
    workspaceId: 'section45',
    label: 'delegated-controller-proof',
    scratchDir: config.rootDir,
    memoryLimitMb: 96,
    pidsMax: 24,
    cpuQuotaPercent: 40
  });
  const delegatedKillPathProof = await runDelegatedControllerKillPathProof(config, delegatedPlan);
  const checks = [
    assertCheck(appArmorProof.ok, 'AppArmor launch-proof lane now performs real profile-load / aa-exec capability gating and fails closed with an explicit kernel-capability reason when live enforcement is unavailable', appArmorProof),
    assertCheck(appArmorLiveProofPack.ok && appArmorLiveProofPackVerify.ok, 'AppArmor live-proof transport pack now exists as a self-verifying host bundle with hashed policy artifacts, standalone verifier, and runnable host execution script', { appArmorLiveProofPack, appArmorLiveProofPackVerify }),
    assertCheck(appArmorHostProofAttestation.ok, 'AppArmor host-proof intake and attestation lane now imports a manifest-bound host execution report, verifies it against the pack expectations, signs an attestation, and renders a trust surface for replay/procurement carry-forward', appArmorHostProofAttestation),
    assertCheck(!appArmorHostProofTamper.ok, 'tampered AppArmor host-proof reports are now denied when their manifest or expectation binding is altered', appArmorHostProofTamper),
    assertCheck(delegatedPlan.ok && Boolean(delegatedPlan.metadata?.groupPaths) && Boolean(delegatedPlan.prelude), 'delegated-controller planner now resolves v1/v2-aware delegated controller paths and emits concrete quota / attachment commands for cpu, memory, and pids controllers', { delegatedSupport, delegatedPlan }),
    assertCheck(delegatedKillPathProof.ok, 'delegated-controller live kill-path lane now attaches a real child workload to the delegated controller group, verifies membership, terminates the group through the kernel controller path, and cleans the delegated group back down', delegatedKillPathProof)
  ];
  let payload = {
    section: 45,
    label: 'section-45-apparmor-and-delegated-controller',
    generatedAt: new Date().toISOString(),
    strict,
    proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section45-apparmor-delegated.mjs --strict',
    smokeCommand: 'bash scripts/smoke-section45-apparmor-delegated.sh',
    pass: checks.every(item => item.pass),
    checks,
    evidence: {
      appArmorProof,
      appArmorLiveProofPack,
      appArmorLiveProofPackVerify,
      appArmorFixtureReport,
      appArmorHostProofAttestation,
      appArmorHostProofTamper,
      delegatedSupport,
      delegatedPlan,
      delegatedKillPathProof
    }
  };
  payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section45-apparmor-delegated.mjs');
  if (strict && !payload.pass) throw new Error('Section 45 AppArmor / delegated-controller proof failed in strict mode.');
  console.log(JSON.stringify(payload, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : String(error)); process.exit(1); });
