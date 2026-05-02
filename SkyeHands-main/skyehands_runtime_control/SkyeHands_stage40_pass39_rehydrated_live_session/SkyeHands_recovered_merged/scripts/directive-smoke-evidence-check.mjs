#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const directivePath = path.join(root, 'ULTIMATE_SYSTEM_DIRECTIVE.md');
const taskRegex = /^(✅|⬜)\s+(P\d{3})\s+\|\s+(Easy|Medium|Complex)\s+\|\s+(.+)$/;
const smokeRefRegex = /`SMOKE:\s*([^`]+)`/;

const lines = fs.readFileSync(directivePath, 'utf8').split('\n');
const checkedTasks = lines
  .map((line, index) => ({ match: line.match(taskRegex), line, lineNumber: index + 1 }))
  .filter((row) => row.match && row.match[1] === '✅')
  .map((row) => ({
    patch: row.match[2],
    lineNumber: row.lineNumber,
    smokeRef: row.line.match(smokeRefRegex)?.[1] ?? null,
    hasSmokeRef: Boolean(row.line.match(smokeRefRegex)?.[1])
  }));

const failures = checkedTasks.filter((task) => !task.hasSmokeRef);
const pass = failures.length === 0;

console.log(JSON.stringify({
  directivePath: path.relative(root, directivePath),
  checkedTasks: checkedTasks.length,
  failures,
  status: pass ? 'PASS' : 'FAIL'
}, null, 2));

if (!pass) process.exit(1);
