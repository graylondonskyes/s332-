#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifactPath = path.join(root, 'SMOKE_P070_STALE_SMOKE_REFERENCES.md');

const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'directive-stale-smoke-check.mjs')], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const staleCount = Array.isArray(payload.staleReferences) ? payload.staleReferences.length : 0;
const pass = run.status === 0 && payload.status === 'PASS' && staleCount === 0;

const body = [
  '# P070 Smoke Proof — Stale Smoke Evidence References',
  '',
  `Status: ${pass ? 'PASS' : 'FAIL'}`,
  `Checked Tasks: ${payload.checkedTasks ?? 0}`,
  `Stale References: ${staleCount}`,
  ''
].join('\n');

fs.writeFileSync(artifactPath, body, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifactPath), staleCount }, null, 2));
if (!pass) process.exit(1);
