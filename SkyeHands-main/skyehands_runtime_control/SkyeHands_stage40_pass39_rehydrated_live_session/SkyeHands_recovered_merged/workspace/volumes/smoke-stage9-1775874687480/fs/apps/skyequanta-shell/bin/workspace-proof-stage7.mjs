import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getStackConfig } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
function ensureDirectory(dirPath) { fs.mkdirSync(dirPath, { recursive: true }); }
function writeJson(filePath, payload) { ensureDirectory(path.dirname(filePath)); fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8'); }
function getNpmCommand() { return process.platform === 'win32' ? 'npm.cmd' : 'npm'; }
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function verifyArtifact(artifactPath) {
  if (!fs.existsSync(artifactPath)) return { pass: false, reason: 'artifact_missing', artifactPath };
  const payload = readJson(artifactPath); const baseName = path.basename(artifactPath);
  if (baseName === 'STAGE_2_DEPENDENCY_LANES.json') return { pass: Boolean(payload?.theia?.fullTheiaRuntime && payload?.openHands?.fullOpenHandsRuntime), reason: 'dependency_lane_truth', artifactPath, payload };
  if (typeof payload?.pass === 'boolean') return { pass: payload.pass, reason: 'pass_field', artifactPath, payload };
  if (typeof payload?.passed === 'boolean') return { pass: payload.passed, reason: 'passed_field', artifactPath, payload };
  if (typeof payload?.ok === 'boolean') return { pass: payload.ok, reason: 'ok_field', artifactPath, payload };
  return { pass: false, reason: 'no_supported_truth_field', artifactPath, payload };
}
function cleanupResidualProcesses(config) {
  const targets = [
    path.join(config.shellDir, 'bin', 'bridge.mjs'),
    path.join(config.shellDir, 'bin', 'remote-executor.mjs'),
    path.join(config.shellDir, 'bin', 'workspace-service.mjs')
  ];
  for (const target of targets) {
    spawnSync('pkill', ['-f', target], { stdio: 'ignore' });
  }
}
function executeStep(npmCommand, shellDir, step) {
  const startedAt = new Date().toISOString(); const started = Date.now();
  const result = spawnSync(npmCommand, ['run', ...step.command], { cwd: shellDir, env: { ...process.env }, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const endedAt = new Date().toISOString(); const artifactChecks = step.artifacts.map(verifyArtifact);
  return { name: step.name, command: ['npm','run',...step.command].join(' '), startedAt, endedAt, durationMs: Date.now()-started, status: result.status, signal: result.signal, stdoutTail: (result.stdout||'').split(/\r?\n/).filter(Boolean).slice(-20), stderrTail: (result.stderr||'').split(/\r?\n/).filter(Boolean).slice(-20), commandPassed: result.status===0 && !result.error, artifactsPassed: artifactChecks.every(x=>x.pass), artifactChecks, pass: result.status===0 && !result.error && artifactChecks.every(x=>x.pass), error: result.error? String(result.error): null };
}
function main() {
  const strict = process.argv.includes('--strict'); const config = getStackConfig(process.env);
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-stage7.mjs'); const proofFile = path.join(config.rootDir, 'docs', 'proof', 'STAGE_7_SMOKE_MATRIX.json'); const npmCommand = getNpmCommand();
  const steps = [
    { name: 'stage1_truth_and_proof', command: ['workspace:proof'], artifacts: [path.join(config.rootDir, 'docs','proof','STAGE_1_TRUTH_AND_PROOF.json')] },
    { name: 'stage2_real_local_executor', command: ['workspace:proof:stage2','--','--strict'], artifacts: [path.join(config.rootDir, 'docs','proof','STAGE_2_REAL_LOCAL_EXECUTOR.json')] },
    { name: 'stage2b_dependency_lanes', command: ['stage2b:deps'], artifacts: [path.join(config.rootDir, 'docs','proof','STAGE_2_DEPENDENCY_LANES.json')] },
    { name: 'stage2b_upstream_parity', command: ['workspace:proof:stage2b','--','--strict'], artifacts: [path.join(config.rootDir, 'docs','proof','STAGE_2B_UPSTREAM_PARITY.json')] },
    { name: 'stage3_repo_provisioning', command: ['workspace:proof:stage3','--','--strict'], artifacts: [path.join(config.rootDir, 'docs','proof','STAGE_3_REPO_PROVISIONING.json')] },
    { name: 'stage4_remote_executor', command: ['workspace:proof:stage4','--','--strict'], artifacts: [path.join(config.rootDir, 'docs','proof','STAGE_4_REMOTE_EXECUTOR.json')] },
    { name: 'stage5_lifecycle_and_secrets', command: ['workspace:proof:stage5','--','--strict'], artifacts: [path.join(config.rootDir, 'docs','proof','STAGE_5_LIFECYCLE_AND_SECRETS.json')] },
    { name: 'stage6_admin_control_plane', command: ['workspace:proof:stage6','--','--strict'], artifacts: [path.join(config.rootDir, 'docs','proof','STAGE_6_ADMIN_CONTROL_PLANE.json')] }
  ];
  const checks = steps.map(step => { cleanupResidualProcesses(config); const result = executeStep(npmCommand, config.shellDir, step); cleanupResidualProcesses(config); return result; }); const pass = checks.every(step => step.pass);
  let payload = { stage: 7, label: 'stage-7-smoke-matrix', strict, generatedAt: new Date().toISOString(), proofCommand: 'npm run workspace:proof:stage7 -- --strict', smokeCommands: steps.map(step => ['npm','run',...step.command].join(' ')), checks, pass };
  payload = writeProofJson(proofFile, payload, config, 'workspace-proof-stage7.mjs');
  if (strict && !pass) { console.error(JSON.stringify(payload, null, 2)); process.exitCode = 1; return; }
  console.log(JSON.stringify(payload, null, 2));
}
main();
