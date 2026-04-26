#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const directivePath = path.join(root, 'ULTIMATE_SYSTEM_DIRECTIVE.md');
const alertsDir = path.join(root, 'skydexia', 'alerts');
const digestPath = path.join(alertsDir, 'completion-digest.json');
const taskRegex = /^(✅|⬜)\s+(P\d{3})\s+\|\s+(Easy|Medium|Complex)\s+\|\s+(.+)$/;

const tasks = fs.readFileSync(directivePath, 'utf8')
  .split('\n')
  .map((line) => line.match(taskRegex))
  .filter(Boolean)
  .map((m) => ({ status: m[1], patch: m[2], complexity: m[3], detail: m[4] }));

const checked = tasks.filter((t) => t.status === '✅');
const blocked = tasks.filter((t) => t.status === '⬜');
const percent = tasks.length ? Math.round((checked.length / tasks.length) * 100) : 0;

const digest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  cadence: ['daily', 'weekly'],
  completion: { checked: checked.length, total: tasks.length, percent },
  blockedItems: blocked,
  blockedByComplexity: blocked.reduce((acc, item) => {
    acc[item.complexity] = (acc[item.complexity] || 0) + 1;
    return acc;
  }, {})
};

fs.mkdirSync(alertsDir, { recursive: true });
fs.writeFileSync(digestPath, JSON.stringify(digest, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ output: path.relative(root, digestPath), blocked: blocked.length, percent }, null, 2));
