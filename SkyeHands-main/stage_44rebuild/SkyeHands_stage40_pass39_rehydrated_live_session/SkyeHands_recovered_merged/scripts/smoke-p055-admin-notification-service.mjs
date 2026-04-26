#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P055_ADMIN_NOTIFICATION_SERVICE.md');
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-admin-notification-service.mjs')], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const pass = run.status === 0 && payload.delivered >= 1;
fs.writeFileSync(artifact, `# P055 Smoke Proof — Admin Notification Service\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nDelivered: ${payload.delivered ?? 0}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2));
if (!pass) process.exit(1);
