#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P049_FAIL_FAST_DIAGNOSTICS.md');
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-proof-diagnostics.mjs')], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const pass = run.status === 0 && payload.status === 'PASS' && payload.totalDiagnostics === 0;
fs.writeFileSync(artifact, `# P049 Smoke Proof — Fail-Fast Diagnostics\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nDiagnostics: ${payload.totalDiagnostics ?? 'unknown'}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2));
if (!pass) process.exit(1);
