#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const smokeFiles = fs.readdirSync(root).filter((name) => /^SMOKE_.*\.md$/i.test(name)).sort();
const outJson = path.join(root, 'skydexia', 'proofs', 'smoke-evidence-summary.json');
const outMd = path.join(root, 'skydexia', 'proofs', 'SMOKE_EVIDENCE_SUMMARY.md');

const items = smokeFiles.map((file) => {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const pass = /Status:\s*PASS/i.test(text);
  return { artifact: file, pass, lines: text.split('\n').length };
});

const summary = { version: 1, generatedAt: new Date().toISOString(), total: items.length, pass: items.filter((i) => i.pass).length, fail: items.filter((i) => !i.pass).length, items };
fs.mkdirSync(path.join(root, 'skydexia', 'proofs'), { recursive: true });
fs.writeFileSync(outJson, JSON.stringify(summary, null, 2) + '\n', 'utf8');

const md = ['# Smoke Evidence Summary', '', `Generated: ${summary.generatedAt}`, '', `Total: ${summary.total}`, `PASS: ${summary.pass}`, `FAIL: ${summary.fail}`, '', '## Artifacts', ...items.map((i) => `- ${i.artifact}: ${i.pass ? 'PASS' : 'FAIL'}`), ''].join('\n');
fs.writeFileSync(outMd, md, 'utf8');
console.log(JSON.stringify({ json: path.relative(root, outJson), markdown: path.relative(root, outMd), fail: summary.fail }, null, 2));
if (summary.fail) process.exit(1);
