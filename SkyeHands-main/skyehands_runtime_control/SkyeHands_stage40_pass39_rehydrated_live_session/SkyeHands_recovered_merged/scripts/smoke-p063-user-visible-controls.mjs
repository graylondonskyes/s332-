#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P063_USER_VISIBLE_CONTROLS.md');
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-smoke-user-visible-control-check.mjs')], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const pass = run.status === 0 && payload.passCount >= 1 && payload.failCount === 0;
fs.writeFileSync(artifact, `# P063 Smoke Proof — User Visible Controls\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nPass Count: ${payload.passCount ?? 0}\nFail Count: ${payload.failCount ?? 0}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2)); if (!pass) process.exit(1);
