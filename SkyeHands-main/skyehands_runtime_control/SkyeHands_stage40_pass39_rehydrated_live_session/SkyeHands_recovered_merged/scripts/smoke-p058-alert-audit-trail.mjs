#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P058_ALERT_AUDIT_TRAIL.md');
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-alert-audit-trail.mjs')], { cwd: root, encoding: 'utf8', env: { ...process.env, SKYDEXIA_ACK_DELIVERIES: '1' } });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const pass = run.status === 0 && payload.totalRecords >= 1;
fs.writeFileSync(artifact, `# P058 Smoke Proof — Alert Audit Trail\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nTotal Records: ${payload.totalRecords ?? 0}\nAcknowledged: ${payload.acknowledged ?? 0}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2));
if (!pass) process.exit(1);
