#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P067_NEGATIVE_PATH_CHECKS.md');
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-negative-path-checks.mjs')], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const pass = run.status === 0 && payload.pass === true;
fs.writeFileSync(artifact, `# P067 Smoke Proof — Negative Path Checks\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nChecks Executed: ${payload.checks ?? 0}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2)); if (!pass) process.exit(1);
