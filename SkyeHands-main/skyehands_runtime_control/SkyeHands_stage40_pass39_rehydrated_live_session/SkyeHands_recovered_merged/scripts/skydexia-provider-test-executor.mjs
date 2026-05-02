#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const generatedRoot = path.join(root, 'skydexia', 'generated-projects');
const outDir = path.join(root, 'skydexia', 'proofs');
const outPath = path.join(outDir, 'provider-test-execution.json');

const projects = fs.existsSync(generatedRoot)
  ? fs.readdirSync(generatedRoot, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  : [];

const results = [];
for (const project of projects) {
  const runtimeConfigPath = path.join(generatedRoot, project, 'config', 'donor-runtime.json');
  const smokeScriptPath = path.join(generatedRoot, project, 'scripts', 'smoke.sh');
  if (!fs.existsSync(runtimeConfigPath) || !fs.existsSync(smokeScriptPath)) continue;

  const runtime = JSON.parse(fs.readFileSync(runtimeConfigPath, 'utf8'));
  const requiredVars = runtime.providerVars || [];
  const missing = requiredVars.filter((v) => !process.env[v]);

  if (missing.length) {
    results.push({ project, status: 'FAIL', reason: 'missing-required-provider-vars', missing });
    continue;
  }

  const run = spawnSync('bash', [smokeScriptPath], {
    cwd: path.join(generatedRoot, project),
    encoding: 'utf8',
    env: process.env
  });

  results.push({
    project,
    status: run.status === 0 ? 'PASS' : 'FAIL',
    command: `bash ${path.relative(root, smokeScriptPath)}`,
    exitCode: run.status,
    stdout: run.stdout?.trim() || '',
    stderr: run.stderr?.trim() || ''
  });
}

const summary = {
  version: 1,
  executedAt: new Date().toISOString(),
  projectsEvaluated: results.length,
  passCount: results.filter((r) => r.status === 'PASS').length,
  failCount: results.filter((r) => r.status === 'FAIL').length,
  results
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(summary, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ output: path.relative(root, outPath), passCount: summary.passCount, failCount: summary.failCount }, null, 2));
if (summary.failCount) process.exit(1);
