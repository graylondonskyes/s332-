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
  .filter((row) => row.match && row.match[1] === '✅');

const stale = [];
for (const task of checkedTasks) {
  const smokeRef = task.line.match(smokeRefRegex)?.[1] ?? '';
  const tokens = String(smokeRef).split('+').map((token) => token.trim()).filter(Boolean);
  const artifacts = tokens.filter((token) => /^SMOKE_.*\.(md|json)$/i.test(token));
  for (const artifact of artifacts) {
    const absolute = path.join(root, artifact);
    if (!fs.existsSync(absolute)) {
      stale.push({ patch: task.match[2], lineNumber: task.lineNumber, artifact, reason: 'missing-file' });
      continue;
    }
    const text = fs.readFileSync(absolute, 'utf8');
    const passMarker = /Status:\s*PASS/i.test(text) || /"status"\s*:\s*"PASS"/i.test(text);
    if (!passMarker) {
      stale.push({ patch: task.match[2], lineNumber: task.lineNumber, artifact, reason: 'missing-pass-marker' });
    }
  }
}

const pass = stale.length === 0;
console.log(JSON.stringify({
  directivePath: path.relative(root, directivePath),
  checkedTasks: checkedTasks.length,
  staleReferences: stale,
  status: pass ? 'PASS' : 'FAIL'
}, null, 2));

if (!pass) process.exit(1);
