#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P053_KNOWLEDGE_EMAIL_ALERTING.md');
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-knowledge-email-alerts.mjs')], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const pass = run.status === 0 && payload.recipients >= 1;
fs.writeFileSync(artifact, `# P053 Smoke Proof — Knowledge Email Alerting\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nRecipients: ${payload.recipients ?? 0}\nPending: ${payload.pending ?? 0}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2));
if (!pass) process.exit(1);
