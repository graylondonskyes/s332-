#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const directivePath = path.join(root, 'ULTIMATE_SYSTEM_DIRECTIVE.md');
const outPath = path.join(root, 'DIRECTIVE_CHANGELOG.md');
const taskRegex = /^(✅|⬜)\s+(P\d{3})\s+\|\s+(Easy|Medium|Complex)\s+\|\s+(.+)$/;

const lines = fs.readFileSync(directivePath, 'utf8').split('\n');
const checked = lines
  .map((line) => line.match(taskRegex))
  .filter(Boolean)
  .filter((m) => m[1] === '✅')
  .map((m) => ({ patch: m[2], complexity: m[3], detail: m[4] }));

const now = new Date().toISOString();
const body = [
  '# Directive Changelog',
  '',
  `Generated: ${now}`,
  '',
  '## Checked Items (Smoke-backed)',
  ...checked.map((item) => `- ${item.patch} | ${item.complexity} | ${item.detail}`),
  '',
].join('\n');

fs.writeFileSync(outPath, body, 'utf8');
console.log(JSON.stringify({ generatedAt: now, checkedItems: checked.length, output: path.relative(root, outPath) }, null, 2));
