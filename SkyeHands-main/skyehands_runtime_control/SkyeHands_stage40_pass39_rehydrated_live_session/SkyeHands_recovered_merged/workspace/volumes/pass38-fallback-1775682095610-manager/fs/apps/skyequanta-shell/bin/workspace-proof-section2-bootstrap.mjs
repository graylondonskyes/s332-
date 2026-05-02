import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getStackConfig } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertCheck(condition, message, detail = null) {
  return { pass: Boolean(condition), message, detail };
}

function runCommand(command, args, cwd, env = process.env) {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd,
    env: { ...env },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  return {
    command: [command, ...args].join(' '),
    cwd,
    startedAt,
    endedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    status: result.status,
    signal: result.signal,
    stdoutTail: String(result.stdout || '').split(/\r?\n/).filter(Boolean).slice(-40),
    stderrTail: String(result.stderr || '').split(/\r?\n/).filter(Boolean).slice(-40)
  };
}

function runFailureReportCheck(config) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skyequanta-coldboot-fail-'));
  const repoCopy = path.join(tempRoot, 'repo');
  const copyResult = runCommand('cp', ['-a', `${config.rootDir}/.`, repoCopy], config.rootDir);
  if (copyResult.status !== 0) {
    return { ...copyResult, pass: false, reason: 'copy_failed' };
  }

  const bridgeScript = path.join(repoCopy, 'apps', 'skyequanta-shell', 'bin', 'bridge.mjs');
  fs.renameSync(bridgeScript, `${bridgeScript}.bak`);

  const failureRun = runCommand(process.execPath, ['apps/skyequanta-shell/bin/cold-machine-bootstrap.mjs', '--smoke', '--json'], repoCopy);
  const failureReportPath = path.join(repoCopy, '.skyequanta', 'reports', 'COLD_MACHINE_BOOTSTRAP_FAILURE.json');
  const latestReportPath = path.join(repoCopy, '.skyequanta', 'reports', 'COLD_MACHINE_BOOTSTRAP_LATEST.json');
  const failureReport = fs.existsSync(failureReportPath) ? readJson(failureReportPath) : null;
  const latestReport = fs.existsSync(latestReportPath) ? readJson(latestReportPath) : null;
  const verifyStep = failureReport?.steps?.find(step => step.name === 'verify') || null;

  return {
    ...failureRun,
    failureReportPath,
    latestReportPath,
    failureReport,
    latestReport,
    pass: failureRun.status !== 0 && Boolean(failureReport) && failureReport.ok === false && Boolean(verifyStep) && verifyStep.pass === false
  };
}

function main() {
  const strict = process.argv.includes('--strict');
  const config = getStackConfig(process.env);
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section2-bootstrap.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_2_COLD_MACHINE_BOOTSTRAP.json');

  const rootSmoke = runCommand(process.execPath, ['apps/skyequanta-shell/bin/cold-machine-bootstrap.mjs', '--smoke', '--json'], config.rootDir);
  const rootReportPath = path.join(config.rootDir, '.skyequanta', 'reports', 'COLD_MACHINE_BOOTSTRAP_LATEST.json');
  const rootArtifactPath = path.join(config.rootDir, 'docs', 'proof', 'SECTION_2_COLD_MACHINE_BOOTSTRAP.json');
  const rootReport = fs.existsSync(rootReportPath) ? readJson(rootReportPath) : null;
  const artifactSnapshot = fs.existsSync(rootArtifactPath) ? readJson(rootArtifactPath) : null;

  const linuxWrapper = runCommand('bash', ['scripts/bootstrap-linux.sh', '--smoke', '--json'], config.rootDir);
  const linuxReport = fs.existsSync(rootReportPath) ? readJson(rootReportPath) : null;

  const devcontainerWrapper = runCommand('bash', ['scripts/bootstrap-devcontainer.sh', '--smoke', '--json'], config.rootDir);
  const devcontainerReport = fs.existsSync(rootReportPath) ? readJson(rootReportPath) : null;

  const failureReportCheck = runFailureReportCheck(config);

  const checks = [
    assertCheck(rootSmoke.status === 0 && Boolean(rootReport?.ok), 'canonical cold-machine root command passes in smoke mode', rootReport),
    assertCheck(Boolean(rootReport?.steps?.find(step => step.name === 'start')?.doctorDeploy?.pass), 'deploy-mode doctor passes from canonical cold-machine boot flow', rootReport?.steps?.find(step => step.name === 'start')?.doctorDeploy),
    assertCheck(linuxWrapper.status === 0 && Boolean(linuxReport?.ok) && linuxReport?.profile === 'linux', 'linux bootstrap wrapper passes smoke mode', linuxReport),
    assertCheck(devcontainerWrapper.status === 0 && Boolean(devcontainerReport?.ok) && devcontainerReport?.profile === 'devcontainer', 'devcontainer bootstrap wrapper passes smoke mode', devcontainerReport),
    assertCheck(failureReportCheck.pass, 'machine-readable failure report is emitted when a required bootstrap prerequisite is missing', failureReportCheck.failureReport)
  ];

  let payload = {
    section: 2,
    label: 'section-2-cold-machine-bootstrap',
    strict,
    generatedAt: new Date().toISOString(),
    proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section2-bootstrap.mjs --strict',
    checks,
    artifacts: {
      rootSmoke,
      rootReport,
      artifactSnapshot,
      linuxWrapper,
      linuxReport,
      devcontainerWrapper,
      devcontainerReport,
      failureReportCheck
    },
    pass: checks.every(item => item.pass)
  };

  payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section2-bootstrap.mjs');

  if (strict && !payload.pass) {
    console.error(JSON.stringify(payload, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify(payload, null, 2));
}

main();
