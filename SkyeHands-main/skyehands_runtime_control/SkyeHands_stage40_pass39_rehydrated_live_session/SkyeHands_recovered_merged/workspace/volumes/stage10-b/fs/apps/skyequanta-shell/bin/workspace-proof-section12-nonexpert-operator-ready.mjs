#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { getStackConfig } from './config.mjs';
import { ensureRuntimeState } from '../lib/runtime.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { parseJsonFromMixedOutput } from '../lib/deployment-packaging.mjs';

function assertCheck(condition, message, detail = null) {
  return { pass: Boolean(condition), message, detail };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function main() {
  const strict = process.argv.includes('--strict');
  const config = getStackConfig(process.env);
  ensureRuntimeState(config);
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section12-nonexpert-operator-ready.mjs');

  const outputFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_12_NONEXPERT_OPERATOR_READY.json');
  const run = spawnSync('./skyequanta', ['operator-green', '--json'], {
    cwd: config.rootDir,
    env: { ...process.env },
    encoding: 'utf8',
    shell: false,
    maxBuffer: 256 * 1024 * 1024
  });
  const payload = parseJsonFromMixedOutput(run.stdout);
  const latestReportPath = path.join(config.rootDir, '.skyequanta', 'reports', 'OPERATOR_GREEN_LATEST.json');
  const latestReport = fs.existsSync(latestReportPath) ? readJson(latestReportPath) : null;
  const handoffDirRel = payload?.steps?.shipCandidate?.payload?.outputs?.handoffDirectory || payload?.outputs?.handoffDirectory;
  const handoffDir = handoffDirRel ? path.join(config.rootDir, handoffDirRel) : path.join(config.rootDir, 'dist', 'ship-candidate', 'operator-handoff');
  const supportDumpRel = payload?.outputs?.supportDump || latestReport?.outputs?.supportDump || null;
  const supportDumpPath = supportDumpRel ? path.join(config.rootDir, supportDumpRel) : null;
  const supportDump = supportDumpPath && fs.existsSync(supportDumpPath) ? readJson(supportDumpPath) : null;
  const launchReadinessPath = path.join(config.rootDir, 'docs', 'LAUNCH_READINESS.md');
  const launchReadinessText = fs.existsSync(launchReadinessPath) ? fs.readFileSync(launchReadinessPath, 'utf8') : '';
  const regressionPath = path.join(config.rootDir, 'docs', 'proof', 'STAGE_11_REGRESSION_PROOF.json');
  const regression = fs.existsSync(regressionPath) ? readJson(regressionPath) : null;

  const checks = [
    assertCheck(run.status === 0 && Boolean(payload?.ok), 'canonical operator-green lane passes from the public operator CLI', { status: run.status, payload }),
    assertCheck(Boolean(latestReport?.ok), 'operator-green latest report is persisted for support and handoff review', { latestReportPath: path.relative(config.rootDir, latestReportPath) }),
    assertCheck(Boolean(regression), 'Stage 11 regression artifact is carried in-repo for operator review', { regressionPath: path.relative(config.rootDir, regressionPath), generatedAt: regression?.generatedAt, pass: regression?.pass }),
    assertCheck(Boolean(
      supportDumpPath
      && fs.existsSync(supportDumpPath)
      && (
        supportDump?.payload?.environment?.SKYEQUANTA_GATE_TOKEN === '[REDACTED]'
        || supportDump?.payload?.environment?.gateToken === '[REDACTED]'
        || JSON.stringify(supportDump).includes('[REDACTED]')
      )
    ), 'redacted support dump is emitted and withholds gate secrets', { supportDumpPath: supportDumpRel, supportDump }),
    assertCheck(fs.existsSync(path.join(handoffDir, 'OPEN_ME_FIRST.html')), 'operator handoff includes OPEN_ME_FIRST.html', { handoffDir: path.relative(config.rootDir, handoffDir) }),
    assertCheck(fs.existsSync(path.join(handoffDir, 'START_HERE.sh')) && fs.existsSync(path.join(handoffDir, 'docs', 'NONEXPERT_OPERATOR_QUICKSTART.md')), 'operator handoff carries the start wrapper and quickstart for non-expert users', { handoffDir: path.relative(config.rootDir, handoffDir) }),
    assertCheck(fs.existsSync(path.join(handoffDir, 'docs', 'proof', 'DEPLOYMENT_READINESS_REPORT.json')) && fs.existsSync(path.join(handoffDir, 'docs', 'proof', 'STAGE_11_REGRESSION_PROOF.json')), 'operator handoff carries deployment and regression evidence', { handoffDir: path.relative(config.rootDir, handoffDir) }),
    assertCheck(launchReadinessText.includes('Regression status:') && launchReadinessText.includes('operator-green lane is green'), 'launch-readiness memo states the regression posture and the operator-green launch gate', { launchReadinessPath: path.relative(config.rootDir, launchReadinessPath) })
  ];

  const proofPayload = {
    ok: checks.every(item => item.pass),
    strict,
    generatedAt: new Date().toISOString(),
    label: 'section-12-nonexpert-operator-ready',
    proofCommand: './skyequanta operator-green --json',
    outputFile: path.relative(config.rootDir, outputFile),
    checks,
    artifacts: {
      latestOperatorGreen: path.relative(config.rootDir, latestReportPath),
      regressionProof: path.relative(config.rootDir, regressionPath),
      handoffDirectory: path.relative(config.rootDir, handoffDir),
      supportDump: supportDumpRel,
      launchReadiness: path.relative(config.rootDir, launchReadinessPath)
    },
    command: {
      status: run.status,
      stdoutTail: String(run.stdout || '').split(/\r?\n/).filter(Boolean).slice(-50),
      stderrTail: String(run.stderr || '').split(/\r?\n/).filter(Boolean).slice(-50)
    }
  };

  writeProofJson(outputFile, proofPayload, config, 'workspace-proof-section12-nonexpert-operator-ready.mjs');
  console.log(JSON.stringify(proofPayload, null, 2));
  if (strict && !proofPayload.ok) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});