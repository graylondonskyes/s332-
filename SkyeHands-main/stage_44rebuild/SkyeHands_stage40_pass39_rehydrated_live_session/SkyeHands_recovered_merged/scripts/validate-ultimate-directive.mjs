#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const directivePath = path.join(root, 'ULTIMATE_SYSTEM_DIRECTIVE.md');
const requireRuntimeTier = process.argv.includes('--require-runtime-tier');

if (!fs.existsSync(directivePath)) {
  console.error('Directive not found:', directivePath);
  process.exit(1);
}

const content = fs.readFileSync(directivePath, 'utf8');
const lines = content.split('\n');

const taskRegex = /^(✅|⬜)\s+P(\d{3})\s+\|\s+(Easy|Medium|Complex)\s+\|\s+(.+)$/;
const smokeRefRegex = /`SMOKE:\s*([^`]+)`/;
const tasks = lines
  .map((line, index) => ({ line, index: index + 1, match: line.match(taskRegex) }))
  .filter((row) => row.match)
  .map((row) => {
    const smokeMatch = row.line.match(smokeRefRegex);
    return {
      line: row.line,
      lineNumber: row.index,
      status: row.match[1],
      patchNumber: Number(row.match[2]),
      complexity: row.match[3],
      body: row.match[4],
      smokeRef: smokeMatch ? smokeMatch[1] : null
    };
  });

const checked = tasks.filter((task) => task.status === '✅');
const unchecked = tasks.filter((task) => task.status === '⬜');
const missingSmoke = checked.filter((task) => !task.smokeRef);

const total = tasks.length;
const done = checked.length;
const pct = total ? Math.round((done / total) * 100) : 0;

const completionLine = lines.find((line) => line.startsWith('**Completion Status:**')) || '';
const expectedCompletion = `**Completion Status:** **${pct}%** (**${done}/${total} items complete)**`;

let ok = true;

if (missingSmoke.length) {
  ok = false;
  console.error('Checked items missing SMOKE evidence:');
  missingSmoke.forEach((task) => console.error(`  - L${task.lineNumber}: ${task.line}`));
}

if (completionLine && completionLine.trim() !== expectedCompletion.trim()) {
  ok = false;
  console.error('Completion line mismatch.');
  console.error('  Found:   ', completionLine.trim());
  console.error('  Expected:', expectedCompletion.trim());
}

const patchNumbers = tasks.map((task) => task.patchNumber);
for (let i = 0; i < patchNumbers.length; i += 1) {
  if (patchNumbers[i] !== i + 1) {
    ok = false;
    console.error(`Patch numbering mismatch at task index ${i + 1}: expected P${String(i + 1).padStart(3, '0')} got P${String(patchNumbers[i]).padStart(3, '0')}`);
    break;
  }
}

const rank = { Easy: 1, Medium: 2, Complex: 3 };
for (let i = 1; i < tasks.length; i += 1) {
  const prev = rank[tasks[i - 1].complexity];
  const curr = rank[tasks[i].complexity];
  if (curr < prev) {
    ok = false;
    console.error(`Complexity ordering regression between L${tasks[i - 1].lineNumber} and L${tasks[i].lineNumber}.`);
    break;
  }
}

const structuralTier = { checkedWithSmokeReference: checked.length - missingSmoke.length, missingSmokeReference: missingSmoke.length };
let runtimeTier = { enforced: requireRuntimeTier, checkedArtifacts: 0, passArtifacts: 0, failArtifacts: [] };

if (requireRuntimeTier) {
  for (const task of checked) {
    const tokens = String(task.smokeRef || '').split('+').map((item) => item.trim());
    const artifactToken = tokens.find((item) => /^SMOKE_.*\.(md|json)$/i.test(item));
    if (!artifactToken) continue;
    runtimeTier.checkedArtifacts += 1;
    const artifactPath = path.join(root, artifactToken);
    if (!fs.existsSync(artifactPath)) {
      ok = false;
      runtimeTier.failArtifacts.push({ task: `P${String(task.patchNumber).padStart(3, '0')}`, artifact: artifactToken, reason: 'missing' });
      continue;
    }
    const artifactText = fs.readFileSync(artifactPath, 'utf8');
    const runtimePass = /Status:\s*PASS/i.test(artifactText) || /"status"\s*:\s*"PASS"/i.test(artifactText);
    if (!runtimePass) {
      ok = false;
      runtimeTier.failArtifacts.push({ task: `P${String(task.patchNumber).padStart(3, '0')}`, artifact: artifactToken, reason: 'non-pass-status' });
      continue;
    }
    runtimeTier.passArtifacts += 1;
  }
}

console.log(JSON.stringify({
  directivePath: path.relative(root, directivePath),
  totalItems: total,
  checkedItems: done,
  uncheckedItems: unchecked.length,
  completionPercent: pct,
  checkedWithSmokeEvidence: checked.length - missingSmoke.length,
  statusVocabulary: ['✅', '⬜'],
  patchNumbering: 'contiguous',
  complexityOrder: 'Easy->Medium->Complex',
  structuralTier,
  runtimeTier
}, null, 2));

if (!ok) process.exit(1);
