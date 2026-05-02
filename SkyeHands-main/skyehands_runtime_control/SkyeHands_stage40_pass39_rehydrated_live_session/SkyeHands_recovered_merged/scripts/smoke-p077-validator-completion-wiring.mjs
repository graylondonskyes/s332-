#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifactPath = path.join(root, 'SMOKE_P077_VALIDATOR_COMPLETION_WIRING.md');

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const hasValidate = typeof pkg.scripts?.['directive:validate'] === 'string';
const hasCompletion = typeof pkg.scripts?.['directive:completion'] === 'string';

const validateRun = spawnSync('npm', ['run', 'directive:validate', '--silent'], { cwd: root, encoding: 'utf8' });
const completionRun = spawnSync('npm', ['run', 'directive:completion', '--silent'], { cwd: root, encoding: 'utf8' });

const pass = hasValidate && hasCompletion && validateRun.status === 0 && completionRun.status === 0;

const body = [
  '# P077 Smoke Proof — Validator + Completion Wiring',
  '',
  `Status: ${pass ? 'PASS' : 'FAIL'}`,
  `Has directive:validate script: ${hasValidate}`,
  `Has directive:completion script: ${hasCompletion}`,
  `directive:validate exit code: ${validateRun.status ?? 1}`,
  `directive:completion exit code: ${completionRun.status ?? 1}`,
  ''
].join('\n');

fs.writeFileSync(artifactPath, body, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifactPath) }, null, 2));
if (!pass) process.exit(1);
