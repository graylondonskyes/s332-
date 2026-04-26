#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const updatesDir = path.join(root, 'skydexia', 'knowledge-updates');
const alertsDir = path.join(root, 'skydexia', 'alerts');
const latestPath = path.join(updatesDir, 'latest-batch.json');
const outPath = path.join(alertsDir, 'knowledge-update-alerts.json');

const latest = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
const recipients = (process.env.SKYDEXIA_ALERT_RECIPIENTS || 'ultimate-admin@skyehands.local').split(',').map((s) => s.trim()).filter(Boolean);

const pending = (latest.updates || []).filter((u) => u.status !== 'APPLIED');
const payload = {
  version: 1,
  generatedAt: new Date().toISOString(),
  channel: 'email',
  recipients,
  subject: `[SkyDexia] Knowledge update batch ${latest.ranAt}`,
  body: {
    applied: latest.applied,
    failed: latest.failed,
    totalSources: latest.totalSources,
    pending
  },
  priority: pending.length ? 'high' : 'normal'
};

fs.mkdirSync(alertsDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ output: path.relative(root, outPath), recipients: recipients.length, pending: pending.length }, null, 2));
