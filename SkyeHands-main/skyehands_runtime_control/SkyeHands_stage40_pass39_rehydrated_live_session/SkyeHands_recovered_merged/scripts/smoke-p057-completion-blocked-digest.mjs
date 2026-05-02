#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P057_COMPLETION_BLOCKED_DIGEST.md');
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-completion-digest.mjs')], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const pass = run.status === 0 && payload.percent >= 1 && payload.blocked >= 0;
fs.writeFileSync(artifact, `# P057 Smoke Proof — Completion/Blocked Digest\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nCompletion Percent: ${payload.percent ?? 0}\nBlocked Items: ${payload.blocked ?? 0}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2));
if (!pass) process.exit(1);
