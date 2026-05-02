#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P041_DONOR_NORMALIZATION_LAYER.md');
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-donor-normalize.mjs')], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const index = JSON.parse(fs.readFileSync(path.join(root, payload.index || ''), 'utf8'));
const pass = run.status === 0 && payload.ok === true && index.total >= 30 && index.donors.every((d) => d.path.includes('normalized'));
fs.writeFileSync(artifact, `# P041 Smoke Proof — Donor Normalization Layer\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nNormalized Packs: ${index.total ?? 0}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact), total: index.total }, null, 2));
if (!pass) process.exit(1);
