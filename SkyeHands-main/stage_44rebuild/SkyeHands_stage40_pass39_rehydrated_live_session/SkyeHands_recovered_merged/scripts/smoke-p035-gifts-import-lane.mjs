#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P035_GIFTS_IMPORT_LANE.md');
const fixture = path.join(root, 'skydexia', 'knowledge-base', 'import-fixture.txt');
fs.writeFileSync(fixture, 'donor-import-fixture\n', 'utf8');
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-knowledge-import.mjs'), fixture], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const pass = run.status === 0 && payload.ok === true && fs.existsSync(path.join(root, payload.target || '')) && fs.existsSync(path.join(root, payload.metadata || ''));
fs.writeFileSync(artifact, `# P035 Smoke Proof — GiftsFromtheSkyes Import Lane\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2));
if (!pass) process.exit(1);
