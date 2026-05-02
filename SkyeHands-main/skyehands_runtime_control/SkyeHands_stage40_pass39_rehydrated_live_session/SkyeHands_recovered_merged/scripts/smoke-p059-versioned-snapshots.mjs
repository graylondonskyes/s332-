#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P059_VERSIONED_SNAPSHOTS.md');
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-snapshot-state.mjs')], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const pass = run.status === 0 && payload.files >= 1;
fs.writeFileSync(artifact, `# P059 Smoke Proof — Versioned Snapshots\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nFiles Snapshotted: ${payload.files ?? 0}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2)); if (!pass) process.exit(1);
