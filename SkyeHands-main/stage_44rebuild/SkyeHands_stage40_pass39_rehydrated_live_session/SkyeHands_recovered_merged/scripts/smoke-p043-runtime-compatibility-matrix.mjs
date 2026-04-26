#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P043_RUNTIME_COMPATIBILITY_MATRIX.md');
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-compatibility-matrix.mjs')], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const matrix = JSON.parse(fs.readFileSync(path.join(root, payload.matrix || ''), 'utf8'));
const pass = run.status === 0 && payload.ok === true && matrix.total >= 30 && matrix.matrix.every((r) => Array.isArray(r.providerVars));
fs.writeFileSync(artifact, `# P043 Smoke Proof — Runtime Compatibility Matrix\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nRows: ${matrix.total ?? 0}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact), rows: matrix.total }, null, 2));
if (!pass) process.exit(1);
