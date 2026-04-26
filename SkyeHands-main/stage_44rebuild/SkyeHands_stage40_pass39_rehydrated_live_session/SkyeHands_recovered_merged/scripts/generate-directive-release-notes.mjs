#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const directivePath = path.join(root, 'ULTIMATE_SYSTEM_DIRECTIVE.md');
const outPath = path.join(root, 'DIRECTIVE_RELEASE_NOTES.md');
const taskRegex = /^(✅|⬜)\s+(P\d{3})\s+\|\s+(Easy|Medium|Complex)\s+\|\s+(.+)$/;
const smokeRefRegex = /`SMOKE:\s*([^`]+)`/;

const tasks = fs.readFileSync(directivePath, 'utf8')
  .split('\n')
  .map((line) => line.match(taskRegex))
  .filter(Boolean)
  .map((m) => ({ status: m[1], patch: m[2], complexity: m[3], detail: m[4], smokeRef: m[4].match(smokeRefRegex)?.[1] ?? null }));

const checked = tasks.filter((task) => task.status === '✅');
const grouped = checked.reduce((acc, task) => {
  if (!acc[task.complexity]) acc[task.complexity] = [];
  acc[task.complexity].push(task);
  return acc;
}, {});

const lines = [
  '# Directive Release Notes',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  '## Smoke-backed completed work only',
  ''
];

for (const level of ['Easy', 'Medium', 'Complex']) {
  const entries = grouped[level] || [];
  if (!entries.length) continue;
  lines.push(`### ${level} (${entries.length})`);
  for (const entry of entries) {
    const smoke = entry.smokeRef ? ` | SMOKE: ${entry.smokeRef}` : '';
    lines.push(`- ${entry.patch}: ${entry.detail}${smoke}`);
  }
  lines.push('');
}

fs.writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
console.log(JSON.stringify({ output: path.relative(root, outPath), checkedItems: checked.length }, null, 2));
