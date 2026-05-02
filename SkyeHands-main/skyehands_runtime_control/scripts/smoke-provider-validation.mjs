#!/usr/bin/env node
/**
 * Directive 16 smoke:
 * - missing env vars create blocked states
 * - dry-run validation path executes without network credentials
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT = path.join(ROOT, 'PROVIDER_VALIDATION_REPORT.json');
const OUT = path.join(ROOT, '.skyequanta', 'proofs', 'provider-validation-smoke.json');

function runValidate(args = [], extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  const run = spawnSync('node', ['./scripts/validate-providers.mjs', ...args], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
  });
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  return { code: run.status ?? 1, stdout: run.stdout, stderr: run.stderr, report };
}

function main() {
  const dry = runValidate(['--dry-run'], { AE_DRY_RUN: 'true' });
  const live = runValidate([], { AE_DRY_RUN: 'false' });

  const dryHasProviders = (dry.report.results || []).length > 0;
  const dryModeCorrect = dry.report.mode === 'dry-run';
  const liveModeCorrect = live.report.mode === 'live';
  const liveBlocked = (live.report.summary?.blocked ?? 0) > 0;

  const result = {
    generatedAt: new Date().toISOString(),
    smoke: 'provider-validation',
    checks: {
      dryRunCommandSucceeded: dry.code === 0,
      liveCommandSucceeded: live.code === 0,
      dryModeCorrect,
      liveModeCorrect,
      dryHasProviders,
      liveBlockedStatesDetected: liveBlocked,
    },
    metrics: {
      providerCount: dry.report.results?.length ?? 0,
      liveBlocked: live.report.summary?.blocked ?? 0,
      liveReady: live.report.summary?.liveReady ?? 0,
    },
  };

  result.passed = Object.values(result.checks).every(Boolean);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));

  if (!result.passed) process.exit(1);
}

main();
