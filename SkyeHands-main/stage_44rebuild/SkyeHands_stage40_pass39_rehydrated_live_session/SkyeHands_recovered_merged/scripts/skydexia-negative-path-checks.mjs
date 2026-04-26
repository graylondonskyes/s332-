#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skydexia-neg-'));
const output = path.join(root, 'skydexia', 'proofs', 'negative-path-checks.json');

function runExpectFail(scriptName, missingFiles = []) {
  const work = path.join(tmp, scriptName.replace(/\.mjs$/, ''));
  fs.mkdirSync(work, { recursive: true });
  fs.mkdirSync(path.join(work, 'scripts'), { recursive: true });
  fs.copyFileSync(path.join(root, 'scripts', scriptName), path.join(work, 'scripts', scriptName));
  for (const rel of missingFiles) {
    const p = path.join(work, rel);
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
  }
  const run = spawnSync(process.execPath, [path.join(work, 'scripts', scriptName)], { cwd: work, encoding: 'utf8' });
  return { script: scriptName, exitCode: run.status, stderr: (run.stderr || '').trim(), stdout: (run.stdout || '').trim(), expectedFailure: run.status !== 0 };
}

const checks = [
  runExpectFail('skydexia-knowledge-diff-review.mjs', ['skydexia/knowledge-updates/latest-batch.json']),
  runExpectFail('skydexia-alert-audit-trail.mjs', ['skydexia/alerts/delivery-log.json'])
];

const pass = checks.every((c) => c.expectedFailure);
const report = { version: 1, checkedAt: new Date().toISOString(), pass, checks };
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ output: path.relative(root, output), pass, checks: checks.length }, null, 2));
if (!pass) process.exit(1);
