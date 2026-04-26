#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P050_KNOWLEDGE_REFRESH_LOOP.md');
const trust = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-knowledge-source-trust.mjs')], { cwd: root, encoding: 'utf8' });
if (trust.status !== 0) process.exit(trust.status || 1);
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-knowledge-refresh-loop.mjs')], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const pass = run.status === 0 && payload.applied >= 1 && payload.failed === 0;
fs.writeFileSync(artifact, `# P050 Smoke Proof — Knowledge Refresh Loop\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nApplied: ${payload.applied ?? 0}\nFailed: ${payload.failed ?? 0}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2));
if (!pass) process.exit(1);
