#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifactPath = path.join(root, 'SMOKE_P068_COMPLETION_CALCULATOR.md');

const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'directive-completion.mjs')], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const pass = run.status === 0 && Number.isInteger(payload.totalItems) && Number.isInteger(payload.checkedItems) && Number.isInteger(payload.completionPercent);

const body = [
  '# P068 Smoke Proof — Completion Calculator',
  '',
  `Status: ${pass ? 'PASS' : 'FAIL'}`,
  `Total Items: ${payload.totalItems ?? 0}`,
  `Checked Items: ${payload.checkedItems ?? 0}`,
  `Completion Percent: ${payload.completionPercent ?? 0}`,
  ''
].join('\n');

fs.writeFileSync(artifactPath, body, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifactPath) }, null, 2));
if (!pass) process.exit(1);
