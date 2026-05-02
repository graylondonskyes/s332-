#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P044_SMOKE_SUITES_BY_CLASS.md');
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-donor-smoke-classifier.mjs')], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const suites = JSON.parse(fs.readFileSync(path.join(root, payload.suites || ''), 'utf8'));
const pass = run.status === 0 && payload.ok === true && suites.totalClasses >= 3 && suites.suites.every((s) => s.donors.length > 0);
fs.writeFileSync(artifact, `# P044 Smoke Proof — Donor-Class Smoke Suites\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nClasses: ${suites.totalClasses ?? 0}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact), classes: suites.totalClasses }, null, 2));
if (!pass) process.exit(1);
