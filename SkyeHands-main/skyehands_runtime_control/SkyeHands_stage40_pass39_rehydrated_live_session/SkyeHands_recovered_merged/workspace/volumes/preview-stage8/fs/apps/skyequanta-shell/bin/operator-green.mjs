#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { getStackConfig } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { parseJsonFromMixedOutput } from '../lib/deployment-packaging.mjs';

function parseArgs(argv) {
  return {
    json: argv.includes('--json'),
    smoke: argv.includes('--smoke'),
    skipShip: argv.includes('--skip-ship'),
    runRegression: argv.includes('--with-regression') || argv.includes('--smoke')
  };
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function withOperatorDefaults(env = process.env) {
  return {
    ...env,
    SKYEQUANTA_ADMIN_TOKEN: String(env.SKYEQUANTA_ADMIN_TOKEN || env.OH_SECRET_KEY || 'cold-machine-admin-token').trim(),
    SKYEQUANTA_GATE_TOKEN: String(env.SKYEQUANTA_GATE_TOKEN || env.SKYEQUANTA_OSKEY || 'cold-machine-gate-token').trim(),
    SKYEQUANTA_GATE_URL: String(env.SKYEQUANTA_GATE_URL || env.OMEGA_GATE_URL || 'http://127.0.0.1:5999').trim(),
    SKYEQUANTA_GATE_MODEL: String(env.SKYEQUANTA_GATE_MODEL || 'kaixu/deep').trim() || 'kaixu/deep'
  };
}

function runJsonCommand(command, args, cwd, env) {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024
  });
  return {
    command: [command, ...args].join(' '),
    cwd,
    startedAt,
    endedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    status: result.status,
    signal: result.signal,
    payload: parseJsonFromMixedOutput(result.stdout),
    stdoutTail: String(result.stdout || '').split(/\r?\n/).filter(Boolean).slice(-40),
    stderrTail: String(result.stderr || '').split(/\r?\n/).filter(Boolean).slice(-40)
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const env = withOperatorDefaults(process.env);
  const config = getStackConfig(env);
  const reportsDir = path.join(config.rootDir, '.skyequanta', 'reports');
  const latestFile = path.join(reportsDir, 'OPERATOR_GREEN_LATEST.json');
  const failureFile = path.join(reportsDir, 'OPERATOR_GREEN_FAILURE.json');

  printCanonicalRuntimeBannerForCommand(config, 'operator-green.mjs', { stderr: options.json });

  const coldMachineArgs = ['apps/skyequanta-shell/bin/cold-machine-bootstrap.mjs'];
  if (options.smoke) coldMachineArgs.push('--smoke');
  coldMachineArgs.push('--json');
  const coldMachine = runJsonCommand(process.execPath, coldMachineArgs, config.rootDir, env);

  const runtimeSeal = runJsonCommand(
    process.execPath,
    ['apps/skyequanta-shell/bin/runtime-seal.mjs', '--strict', '--json'],
    config.rootDir,
    env
  );

  const regression = options.runRegression
    ? runJsonCommand(
        'bash',
        ['scripts/smoke-proof-regression.sh'],
        config.rootDir,
        env
      )
    : null;

  const supportDump = runJsonCommand(
    process.execPath,
    ['apps/skyequanta-shell/bin/support-dump.mjs', '--output', 'operator-green-support-dump.json', '--json'],
    config.rootDir,
    env
  );

  const shipCandidate = options.skipShip
    ? null
    : runJsonCommand(
        process.execPath,
        ['apps/skyequanta-shell/bin/ship-candidate.mjs', '--strict', '--json'],
        config.rootDir,
        env
      );

  const checks = [
    {
      pass: coldMachine.status === 0 && Boolean(coldMachine.payload?.ok),
      message: 'canonical cold-machine bootstrap passes from the single operator entrypoint',
      detail: coldMachine.payload
    },
    {
      pass: Boolean(coldMachine.payload?.checks?.find(item => item.message === 'deploy-mode doctor passes cleanly from canonical boot flow')?.pass),
      message: 'deploy-mode doctor remains green inside the one-command operator lane',
      detail: coldMachine.payload?.checks
    },
    {
      pass: runtimeSeal.status === 0 && Boolean(runtimeSeal.payload?.ok),
      message: 'gate/runtime seal passes inside the one-command operator lane',
      detail: runtimeSeal.payload
    },
    {
      pass: !options.runRegression || (regression?.status === 0 && Boolean(regression?.payload?.pass)),
      message: options.runRegression ? 'fresh stage-11 regression smoke passes when explicitly requested from the operator lane' : 'fresh stage-11 regression smoke remains an optional heavy lane outside the default one-command operator path',
      detail: regression?.payload
    },
    {
      pass: supportDump.status === 0 && Boolean(supportDump.payload?.ok) && String(supportDump.payload?.output || '').includes('support-dumps'),
      message: 'redacted support dump is emitted for the operator-safe handoff lane',
      detail: supportDump.payload
    },
    {
      pass: options.skipShip || (shipCandidate?.status === 0 && Boolean(shipCandidate?.payload?.ok)),
      message: 'ship-candidate packaging passes inside the one-command operator lane',
      detail: shipCandidate?.payload
    }
  ];

  const payload = {
    ok: checks.every(item => item.pass),
    label: 'operator-green',
    strict: true,
    generatedAt: new Date().toISOString(),
    canonicalStartCommand: './START_HERE.sh',
    canonicalOperatorCommand: 'npm run operator:green:json',
    inputs: {
      smoke: options.smoke,
      skipShip: options.skipShip,
      runRegression: options.runRegression
    },
    checks,
    steps: {
      coldMachine,
      runtimeSeal,
      regression,
      supportDump,
      shipCandidate
    },
    outputs: {
      latestReport: path.relative(config.rootDir, latestFile),
      failureReport: path.relative(config.rootDir, failureFile),
      coldMachineReport: '.skyequanta/reports/COLD_MACHINE_BOOTSTRAP_LATEST.json',
      runtimeSealReport: runtimeSeal.payload?.outputs?.latestReport || null,
      stage11RegressionReport: regression?.payload?.artifacts?.proofArtifactHashes ? 'docs/proof/STAGE_11_REGRESSION_PROOF.json' : null,
      supportDump: supportDump.payload?.output ? path.relative(config.rootDir, supportDump.payload.output) : null,
      shipCandidateReport: shipCandidate?.payload?.outputs?.reportFile || null,
      handoffArchive: shipCandidate?.payload?.outputs?.handoffArchive || null
    }
  };

  writeJson(latestFile, payload);
  if (!payload.ok) {
    writeJson(failureFile, payload);
  }

  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log('SkyeQuanta operator-green lane');
    console.log(`- start: ${payload.canonicalStartCommand}`);
    console.log(`- command: ${payload.canonicalOperatorCommand}`);
    checks.forEach(item => console.log(`- ${item.pass ? 'PASS' : 'FAIL'}: ${item.message}`));
    console.log(`- report: ${payload.outputs.latestReport}`);
    if (payload.outputs.handoffArchive) console.log(`- handoff archive: ${payload.outputs.handoffArchive}`);
  }

  if (!payload.ok) {
    process.exitCode = 1;
  }
}

main();
