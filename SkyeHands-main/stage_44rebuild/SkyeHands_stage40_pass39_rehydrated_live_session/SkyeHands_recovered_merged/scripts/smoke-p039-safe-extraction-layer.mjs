#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P039_SAFE_EXTRACTION_LAYER.md');
spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-template-quality.mjs')], { cwd: root, encoding: 'utf8' });
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-safe-extract.mjs')], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const report = JSON.parse(fs.readFileSync(path.join(root, payload.report || ''), 'utf8'));
const pass = run.status === 0 && payload.ok === true && report.extractedCount >= 1;
fs.writeFileSync(artifact, `# P039 Smoke Proof — Safe Extraction Layer\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nExtracted Templates: ${report.extractedCount ?? 0}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact), extractedCount: report.extractedCount }, null, 2));
if (!pass) process.exit(1);
