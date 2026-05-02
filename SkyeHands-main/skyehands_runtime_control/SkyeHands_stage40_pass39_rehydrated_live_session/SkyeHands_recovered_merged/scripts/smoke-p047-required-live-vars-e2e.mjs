#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P047_REQUIRED_LIVE_VARS_E2E.md');
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-e2e-required-vars-proof.mjs')], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const pass = run.status === 0 && payload.passCount >= 1 && payload.failCount === 0;
fs.writeFileSync(artifact, `# P047 Smoke Proof — Required Live Vars E2E\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nPass Count: ${payload.passCount ?? 0}\nFail Count: ${payload.failCount ?? 0}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2));
if (!pass) process.exit(1);
