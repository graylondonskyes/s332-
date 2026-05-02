#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P042_AUTONOMOUS_PROJECT_SPINUP.md');
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-template-spinup.mjs'), 'donor-pack-01'], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const manifestPath = path.join(root, payload.manifest || '');
const pass = run.status === 0 && payload.ok === true && fs.existsSync(manifestPath);
fs.writeFileSync(artifact, `# P042 Smoke Proof — Autonomous Project Spin-Up\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nProject: ${payload.project || 'n/a'}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact), project: payload.project }, null, 2));
if (!pass) process.exit(1);
