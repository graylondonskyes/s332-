#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifactPath = path.join(root, 'SMOKE_P069_SMOKE_EVIDENCE_VALIDATION.md');

const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'directive-smoke-evidence-check.mjs')], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const pass = run.status === 0 && payload.status === 'PASS';

const body = [
  '# P069 Smoke Proof — Checked Items Smoke Evidence Validation',
  '',
  `Status: ${pass ? 'PASS' : 'FAIL'}`,
  `Checked Tasks: ${payload.checkedTasks ?? 0}`,
  `Failures: ${Array.isArray(payload.failures) ? payload.failures.length : 'unknown'}`,
  ''
].join('\n');

fs.writeFileSync(artifactPath, body, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifactPath) }, null, 2));
if (!pass) process.exit(1);
