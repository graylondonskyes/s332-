#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const generatedRoot = path.join(root, 'skydexia', 'generated-projects');
const outDir = path.join(root, 'skydexia', 'proofs');
const outPath = path.join(outDir, 'e2e-required-vars-proof.json');

const projects = fs.existsSync(generatedRoot)
  ? fs.readdirSync(generatedRoot, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  : [];

const checks = [];
for (const project of projects) {
  const projectRoot = path.join(generatedRoot, project);
  const runtimeConfigPath = path.join(projectRoot, 'config', 'donor-runtime.json');
  const smokeScriptPath = path.join(projectRoot, 'scripts', 'smoke.sh');
  if (!fs.existsSync(runtimeConfigPath) || !fs.existsSync(smokeScriptPath)) continue;

  const runtime = JSON.parse(fs.readFileSync(runtimeConfigPath, 'utf8'));
  const requiredVars = Array.isArray(runtime.providerVars)
    ? runtime.providerVars.filter((key) => typeof key === 'string' && key.trim().length > 0)
    : [];
  const missingRequiredVars = requiredVars.filter((key) => {
    const value = process.env[key];
    return typeof value !== 'string' || value.length === 0;
  });

  if (missingRequiredVars.length > 0) {
    checks.push({
      project,
      requiredVars,
      missingRequiredVars,
      envVarCount: 0,
      status: 'FAIL',
      exitCode: null,
      stdout: '',
      stderr: `missing_required_provider_vars:${missingRequiredVars.join(',')}`
    });
    continue;
  }

  const proofEnv = {
    PATH: process.env.PATH || '',
    HOME: process.env.HOME || '',
    LANG: process.env.LANG || 'C.UTF-8',
    ...Object.fromEntries(requiredVars.map((key) => [key, process.env[key]]))
    ...Object.fromEntries(requiredVars.map((key) => [key, process.env[key] || `required-${key.toLowerCase()}-value`]))
  };

  const run = spawnSync('bash', [smokeScriptPath], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: proofEnv
  });

  checks.push({
    project,
    requiredVars,
    envVarCount: Object.keys(proofEnv).length,
    status: run.status === 0 ? 'PASS' : 'FAIL',
    exitCode: run.status,
    stdout: run.stdout?.trim() || '',
    stderr: run.stderr?.trim() || ''
  });
}

const report = {
  version: 1,
  executedAt: new Date().toISOString(),
  totalProjects: checks.length,
  passCount: checks.filter((c) => c.status === 'PASS').length,
  failCount: checks.filter((c) => c.status === 'FAIL').length,
  checks
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ output: path.relative(root, outPath), passCount: report.passCount, failCount: report.failCount }, null, 2));
if (report.failCount) process.exit(1);
