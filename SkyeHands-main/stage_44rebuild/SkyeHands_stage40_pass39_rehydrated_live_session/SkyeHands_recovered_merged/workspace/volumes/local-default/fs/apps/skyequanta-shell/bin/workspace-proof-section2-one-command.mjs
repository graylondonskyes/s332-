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

function runOperatorGreen(config) {
  const result = spawnSync(process.execPath, ['apps/skyequanta-shell/bin/operator-green.mjs', '--json'], {
    cwd: config.rootDir,
    env: { ...process.env },
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024
  });
  return {
    status: result.status,
    signal: result.signal,
    stdoutTail: String(result.stdout || '').split(/\r?\n/).filter(Boolean).slice(-40),
    stderrTail: String(result.stderr || '').split(/\r?\n/).filter(Boolean).slice(-40),
    payload: parseJsonFromMixedOutput(result.stdout)
  };
}

function main() {
  const strict = process.argv.includes('--strict');
  const config = getStackConfig(process.env);
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section2-one-command.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_2_ONE_COMMAND_INSTALL.json');

  const operatorGreen = runOperatorGreen(config);
  const startHerePath = path.join(config.rootDir, 'START_HERE.sh');
  const quickstartPath = path.join(config.rootDir, 'docs', 'NONEXPERT_OPERATOR_QUICKSTART.md');
  const packagingReportPath = path.join(config.rootDir, 'docs', 'proof', 'DEPLOYMENT_READINESS_REPORT.json');

  const startHereText = fs.existsSync(startHerePath) ? readText(startHerePath) : '';
  const quickstartText = fs.existsSync(quickstartPath) ? readText(quickstartPath) : '';

  const checks = [
    assertCheck(operatorGreen.status === 0 && Boolean(operatorGreen.payload?.ok), 'one-command operator lane passes cleanly', operatorGreen.payload),
    assertCheck(fs.existsSync(startHerePath) && startHereText.includes('npm run operator:green:json'), 'START_HERE.sh exists and delegates to the canonical operator-green command', { startHerePath: path.relative(config.rootDir, startHerePath) }),
    assertCheck(fs.existsSync(quickstartPath) && quickstartText.includes('./START_HERE.sh') && quickstartText.includes('operator:green:json'), 'non-expert quickstart points to START_HERE and the canonical operator-green command', { quickstartPath: path.relative(config.rootDir, quickstartPath) }),
    assertCheck(Boolean(operatorGreen.payload?.outputs?.handoffArchive) && fs.existsSync(path.join(config.rootDir, operatorGreen.payload.outputs.handoffArchive)), 'one-command operator lane emits the packaged handoff archive', operatorGreen.payload?.outputs?.handoffArchive),
    assertCheck(fs.existsSync(packagingReportPath), 'deployment readiness report exists after the one-command operator lane runs', { packagingReportPath: path.relative(config.rootDir, packagingReportPath) })
  ];

  let payload = {
    section: 2,
    label: 'section-2-one-command-install',
    strict,
    generatedAt: new Date().toISOString(),
    proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section2-one-command.mjs --strict',
    smokeCommand: 'bash scripts/smoke-one-command-install.sh',
    checks,
    artifacts: {
      operatorGreen,
      startHerePath: path.relative(config.rootDir, startHerePath),
      quickstartPath: path.relative(config.rootDir, quickstartPath),
      packagingReportPath: path.relative(config.rootDir, packagingReportPath)
    },
    pass: checks.every(item => item.pass)
  };

  payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section2-one-command.mjs');

  if (strict && !payload.pass) {
    console.error(JSON.stringify(payload, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify(payload, null, 2));
}

main();
