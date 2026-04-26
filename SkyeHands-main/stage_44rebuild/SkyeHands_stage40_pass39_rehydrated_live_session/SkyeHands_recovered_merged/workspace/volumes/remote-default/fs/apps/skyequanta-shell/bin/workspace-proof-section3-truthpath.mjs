#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { getStackConfig } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { parseJsonFromMixedOutput } from '../lib/deployment-packaging.mjs';

function assertCheck(condition, message, detail = null) {
  return { pass: Boolean(condition), message, detail };
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function runCommand(config, command, args = []) {
  const result = spawnSync(command, args, {
    cwd: config.rootDir,
    env: { ...process.env },
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024
  });
  return {
    status: result.status,
    signal: result.signal,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
    stdoutTail: String(result.stdout || '').split(/\r?\n/).filter(Boolean).slice(-60),
    stderrTail: String(result.stderr || '').split(/\r?\n/).filter(Boolean).slice(-60),
    payload: parseJsonFromMixedOutput(result.stdout)
  };
}

function main() {
  const strict = process.argv.includes('--strict');
  const config = getStackConfig(process.env);
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section3-truthpath.mjs');

  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_3_TRUTHPATH_CONVERGENCE.json');
  const operatorCliFile = path.join(config.rootDir, 'skyequanta');
  const operatorCliNodeFile = path.join(config.rootDir, 'skyequanta.mjs');
  const startHerePath = path.join(config.rootDir, 'START_HERE.sh');
  const readmePath = path.join(config.rootDir, 'README.md');
  const quickstartPath = path.join(config.rootDir, 'docs', 'NONEXPERT_OPERATOR_QUICKSTART.md');
  const runtimeMapPath = path.join(config.rootDir, 'docs', 'CANONICAL_RUNTIME_PATHS.md');
  const operatorSurfacePath = path.join(config.rootDir, 'docs', 'CANONICAL_OPERATOR_SURFACE.md');
  const packageJsonPath = path.join(config.rootDir, 'package.json');

  const packageJson = JSON.parse(readText(packageJsonPath));
  const scripts = packageJson.scripts || {};
  const startHereText = readText(startHerePath);
  const readmeText = readText(readmePath);
  const quickstartText = readText(quickstartPath);
  const runtimeMapText = readText(runtimeMapPath);
  const operatorSurfaceText = readText(operatorSurfacePath);

  const startDryRun = runCommand(config, './skyequanta', ['start', '--dry-run']);
  const runtimeSeal = runCommand(config, './skyequanta', ['runtime-seal', '--strict', '--json']);
  const guardWorkspaceService = runCommand(config, process.execPath, ['apps/skyequanta-shell/bin/workspace-service.mjs']);

  const checks = [
    assertCheck(fs.existsSync(operatorCliFile) && (fs.statSync(operatorCliFile).mode & 0o111), 'canonical shell operator CLI exists and is executable', { file: 'skyequanta' }),
    assertCheck(fs.existsSync(operatorCliNodeFile), 'canonical node operator CLI entry exists', { file: 'skyequanta.mjs' }),
    assertCheck(startHereText.includes('./skyequanta operator-green --json'), 'START_HERE routes only through the canonical operator CLI', { file: 'START_HERE.sh' }),
    assertCheck(
      scripts.start?.includes('skyequanta.mjs start') &&
      scripts['operator:green:json']?.includes('skyequanta.mjs operator-green --json') &&
      scripts['bridge:start']?.includes('skyequanta.mjs bridge:start') &&
      scripts.doctor?.includes('skyequanta.mjs doctor') &&
      scripts['runtime:seal:strict']?.includes('skyequanta.mjs runtime-seal --strict --json'),
      'public root npm aliases converge through the canonical operator CLI instead of raw internal bins',
      {
        start: scripts.start,
        operatorGreenJson: scripts['operator:green:json'],
        bridgeStart: scripts['bridge:start'],
        doctor: scripts.doctor,
        runtimeSealStrict: scripts['runtime:seal:strict']
      }
    ),
    assertCheck(readmeText.includes('./skyequanta start') && readmeText.includes('./START_HERE.sh') && !readmeText.includes('apps/skyequanta-shell/bin/launch.mjs'), 'README exposes the canonical operator surface and does not lead with raw launcher bin paths', { file: 'README.md' }),
    assertCheck(quickstartText.includes('./START_HERE.sh') && quickstartText.includes('./skyequanta start') && !quickstartText.includes('npm run start'), 'non-expert quickstart is converged on START_HERE and the canonical operator CLI', { file: 'docs/NONEXPERT_OPERATOR_QUICKSTART.md' }),
    assertCheck(runtimeMapText.includes('./skyequanta') && runtimeMapText.includes('Compatibility alias') && operatorSurfaceText.includes('./skyequanta operator-green --json'), 'canonical docs define one public operator CLI and compatibility aliases as secondary only', { runtimeMap: 'docs/CANONICAL_RUNTIME_PATHS.md', operatorSurface: 'docs/CANONICAL_OPERATOR_SURFACE.md' }),
    assertCheck(startDryRun.status === 0 && /CANONICAL RUNTIME PATH/.test(startDryRun.stdout) && /public operator cli: \.\/skyequanta/.test(startDryRun.stdout), 'canonical operator CLI can drive the product launcher dry-run and emits the canonical runtime banner', startDryRun.stdoutTail),
    assertCheck(runtimeSeal.status === 0 && Boolean(runtimeSeal.payload?.ok), 'canonical operator CLI can drive the strict runtime-seal lane', runtimeSeal.payload),
    assertCheck(guardWorkspaceService.status !== 0 && /canonical_runtime_guard/.test(`${guardWorkspaceService.stderr}\n${guardWorkspaceService.stdout}`) && /\.\/skyequanta start/.test(`${guardWorkspaceService.stderr}\n${guardWorkspaceService.stdout}`), 'quarantined legacy runtime paths still hard-fail and redirect operators back to the canonical CLI', guardWorkspaceService.stderrTail)
  ];

  let payload = {
    section: 3,
    label: 'section-3-truthpath-convergence',
    strict,
    generatedAt: new Date().toISOString(),
    proofCommand: './skyequanta proof:truthpath --strict',
    compatibilityProofCommand: 'npm run workspace:proof:section3',
    smokeCommand: 'bash scripts/smoke-truthpath-convergence.sh',
    checks,
    artifacts: {
      operatorCli: 'skyequanta',
      operatorCliNode: 'skyequanta.mjs',
      startHere: 'START_HERE.sh',
      runtimeMap: 'docs/CANONICAL_RUNTIME_PATHS.md',
      operatorSurface: 'docs/CANONICAL_OPERATOR_SURFACE.md',
      quickstart: 'docs/NONEXPERT_OPERATOR_QUICKSTART.md',
      startDryRun,
      runtimeSeal,
      guardWorkspaceService
    },
    pass: checks.every(item => item.pass)
  };

  payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section3-truthpath.mjs');

  if (strict && !payload.pass) {
    console.error(JSON.stringify(payload, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify(payload, null, 2));
}

main();
