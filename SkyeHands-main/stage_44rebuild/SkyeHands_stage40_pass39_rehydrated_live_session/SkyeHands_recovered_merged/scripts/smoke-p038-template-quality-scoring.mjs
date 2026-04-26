#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P038_TEMPLATE_QUALITY_SCORING.md');
spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-donor-index.mjs')], { cwd: root, encoding: 'utf8' });
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-template-quality.mjs')], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const catalog = JSON.parse(fs.readFileSync(path.join(root, payload.catalog || ''), 'utf8'));
const pass = run.status === 0 && payload.ok === true && catalog.templates.every((t) => typeof t.qualityScore === 'number' && typeof t.smokeable === 'boolean');
fs.writeFileSync(artifact, `# P038 Smoke Proof — Template Quality Scoring\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2));
if (!pass) process.exit(1);
