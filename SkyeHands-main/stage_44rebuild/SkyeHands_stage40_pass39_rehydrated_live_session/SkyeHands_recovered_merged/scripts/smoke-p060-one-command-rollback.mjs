#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P060_ONE_COMMAND_ROLLBACK.md');
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-rollback-from-snapshot.mjs')], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const pass = run.status === 0 && payload.restored >= 1;
fs.writeFileSync(artifact, `# P060 Smoke Proof — One-Command Rollback\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nRestored Files: ${payload.restored ?? 0}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2)); if (!pass) process.exit(1);
