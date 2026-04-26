import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';

function assertCheck(condition, message, detail = null) {
  return { pass: Boolean(condition), message, detail };
}

function runNode(commandArgs, cwd, env) {
  const result = spawnSync(process.execPath, commandArgs, {
    cwd,
    env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  return {
    command: `node ${commandArgs.join(' ')}`,
    status: result.status,
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim()
  };
}

function parseJsonOutput(run) {
  try {
    return run.stdout ? JSON.parse(run.stdout) : null;
  } catch {
    return null;
  }
}

function summarizeTargetChecks(payload) {
  const labels = new Set([
    'command:poetry',
    'pkg-config:xkbfile',
    'ide-ripgrep-postinstall',
    'ide-ripgrep-binary',
    'ide-keytar-binding',
    'ide-node-pty-binding',
    'ide-drivelist-binding',
    'ide-browser-backend-entrypoint',
    'ide-frontend-index',
    'ide-frontend-bundle',
    'ide-editor-worker-bundle',
    'ide-backend-bundle'
  ]);
  return Array.isArray(payload?.checks) ? payload.checks.filter(item => labels.has(item.label)) : [];
}

function main() {
  const strict = process.argv.includes('--strict');
  const baseConfig = getStackConfig();
  ensureRuntimeState(baseConfig, process.env);
  const env = withLocalBinPath(loadShellEnv(baseConfig));
  const config = getStackConfig(env);
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section2-dependency-repair.mjs');

  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_2_DEPENDENCY_AUTOREPAIR.json');

  const doctorLocalRun = runNode(['apps/skyequanta-shell/bin/doctor.mjs', '--repair', '--json'], config.rootDir, env);
  const doctorLocalPayload = parseJsonOutput(doctorLocalRun);
  const doctorDeployRun = runNode(['apps/skyequanta-shell/bin/doctor.mjs', '--mode', 'deploy', '--repair', '--json'], config.rootDir, env);
  const doctorDeployPayload = parseJsonOutput(doctorDeployRun);
  const launchDryRun = runNode(['apps/skyequanta-shell/bin/launch.mjs', '--dry-run'], config.rootDir, env);

  const localChecks = summarizeTargetChecks(doctorLocalPayload);
  const deployChecks = summarizeTargetChecks(doctorDeployPayload);

  const checks = [
    assertCheck(doctorLocalRun.status === 0 && Boolean(doctorLocalPayload?.ok), 'local-mode doctor repair passes cleanly', doctorLocalPayload),
    assertCheck(localChecks.length >= 10 && localChecks.every(item => item.ok), 'all formerly blocked dependency checks pass after repair in local mode', localChecks),
    assertCheck(doctorDeployRun.status === 0 && Boolean(doctorDeployPayload?.ok), 'deploy-mode doctor repair passes cleanly', doctorDeployPayload),
    assertCheck(deployChecks.length >= 10 && deployChecks.every(item => item.ok), 'deploy-mode dependency checks are green with bundled/runtime fallbacks', deployChecks),
    assertCheck(launchDryRun.status === 0, 'canonical launch dry-run resolves without dependency babysitting', launchDryRun)
  ];

  const payload = writeProofJson(proofFile, {
    section: 2,
    label: 'section-2-dependency-autorepair',
    strict,
    generatedAt: new Date().toISOString(),
    proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section2-dependency-repair.mjs --strict',
    checks,
    artifacts: {
      doctorLocalRun,
      doctorLocalPayload,
      doctorDeployRun,
      doctorDeployPayload,
      launchDryRun,
      localChecks,
      deployChecks
    },
    pass: checks.every(item => item.pass)
  }, config, 'workspace-proof-section2-dependency-repair.mjs');

  if (strict && !payload.pass) {
    console.error(JSON.stringify(payload, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify(payload, null, 2));
}

main();
