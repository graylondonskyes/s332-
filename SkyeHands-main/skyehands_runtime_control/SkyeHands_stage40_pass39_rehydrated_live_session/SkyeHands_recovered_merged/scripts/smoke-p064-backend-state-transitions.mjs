#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P064_BACKEND_STATE_TRANSITIONS.md');
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-backend-transition-check.mjs')], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const pass = run.status === 0 && payload.status === 'PASS';
fs.writeFileSync(artifact, `# P064 Smoke Proof — Backend State Transitions\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nTransition Status: ${payload.status ?? 'unknown'}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2)); if (!pass) process.exit(1);
