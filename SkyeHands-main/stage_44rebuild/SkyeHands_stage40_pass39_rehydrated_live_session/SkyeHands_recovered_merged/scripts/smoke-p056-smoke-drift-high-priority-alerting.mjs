#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P056_SMOKE_DRIFT_HIGH_PRIORITY_ALERTING.md');
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-smoke-drift-alerts.mjs')], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const pass = run.status === 0 && ['normal', 'critical'].includes(payload.priority);
fs.writeFileSync(artifact, `# P056 Smoke Proof — Smoke Drift High-Priority Alerting\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nPriority: ${payload.priority ?? 'unknown'}\nRegressions: ${payload.regressions ?? 'unknown'}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2));
if (!pass) process.exit(1);
