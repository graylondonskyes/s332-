#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const directivePath = path.join(root, 'ULTIMATE_SYSTEM_DIRECTIVE.md');
const taskRegex = /^(✅|⬜)\s+P(\d{3})\s+\|\s+(Easy|Medium|Complex)\s+\|\s+(.+)$/;

const lines = fs.readFileSync(directivePath, 'utf8').split('\n');
const tasks = lines.map((line) => line.match(taskRegex)).filter(Boolean);

const totalItems = tasks.length;
const checkedItems = tasks.filter((row) => row[1] === '✅').length;
const uncheckedItems = totalItems - checkedItems;
const completionPercent = totalItems === 0 ? 0 : Math.round((checkedItems / totalItems) * 100);

const payload = {
  directivePath: path.relative(root, directivePath),
  totalItems,
  checkedItems,
  uncheckedItems,
  completionPercent,
  completionLine: `**Completion Status:** **${completionPercent}%** (**${checkedItems}/${totalItems} items complete)**`
};

console.log(JSON.stringify(payload, null, 2));
