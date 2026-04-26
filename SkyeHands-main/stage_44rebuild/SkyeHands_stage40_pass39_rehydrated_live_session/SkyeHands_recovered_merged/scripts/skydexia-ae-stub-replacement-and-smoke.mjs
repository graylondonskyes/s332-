#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const aeRoots = [
  path.join(root, 'platform', 'user-platforms', 'skye-account-executive-commandhub-s0l26-0s'),
  path.join(root, 'platform', 'user-platforms', 'ae-autonomous-store-system-maggies')
];
const outPath = path.join(root, 'skydexia', 'proofs', 'ae-stub-replacement-smoke.json');

const stubPatterns = [
  /statusCode\s*:\s*501/i,
  /not\s+implemented/i,
  /TODO\s*:?\s*implement/i,
  /throw\s+new\s+Error\(['"]not implemented/i
];

const candidates = [];
for (const aeRoot of aeRoots) {
  if (!fs.existsSync(aeRoot)) continue;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        walk(full);
      } else if (/netlify\/functions|functions\//.test(full) && /\.(js|mjs|ts)$/i.test(entry.name)) {
        candidates.push(full);
      }
    }
  };
  walk(aeRoot);
}

const stubHits = [];
for (const file of candidates) {
  const text = fs.readFileSync(file, 'utf8');
  if (stubPatterns.some((rx) => rx.test(text))) stubHits.push(path.relative(root, file));
}

const smokes = ['smoke:p017', 'smoke:p020', 'smoke:p026'];
const smokeResults = smokes.map((script) => {
  const run = spawnSync('npm', ['run', script, '--silent'], { cwd: root, encoding: 'utf8' });
  return { script, exit: run.status };
});

const pass = stubHits.length === 0 && smokeResults.every((r) => r.exit === 0);
const report = { version: 1, checkedAt: new Date().toISOString(), scannedFiles: candidates.length, stubHits, smokeResults, status: pass ? 'PASS' : 'FAIL' };
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ output: path.relative(root, outPath), status: report.status, stubHits: stubHits.length, scannedFiles: candidates.length }, null, 2));
if (!pass) process.exit(1);
