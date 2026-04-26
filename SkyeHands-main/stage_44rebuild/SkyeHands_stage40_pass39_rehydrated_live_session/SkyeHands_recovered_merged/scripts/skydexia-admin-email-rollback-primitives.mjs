#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outPath = path.join(root, 'skydexia', 'alerts', 'admin-email-rollback-primitives.json');

const steps = [
  { name: 'knowledge-email-alerts', cmd: ['node', './scripts/skydexia-knowledge-email-alerts.mjs'] },
  { name: 'admin-notification-service', cmd: ['node', './scripts/skydexia-admin-notification-service.mjs'] },
  { name: 'knowledge-rollback', cmd: ['node', './scripts/skydexia-knowledge-rollback.mjs'] }
];

const results = steps.map((s) => {
  const run = spawnSync(s.cmd[0], s.cmd.slice(1), { cwd: root, encoding: 'utf8' });
  return { step: s.name, exit: run.status, ok: run.status === 0 };
});

const pass = results.every((r) => r.ok);
const payload = { version: 1, executedAt: new Date().toISOString(), results, status: pass ? 'PASS' : 'FAIL' };
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ output: path.relative(root, outPath), status: payload.status }, null, 2));
if (!pass) process.exit(1);
