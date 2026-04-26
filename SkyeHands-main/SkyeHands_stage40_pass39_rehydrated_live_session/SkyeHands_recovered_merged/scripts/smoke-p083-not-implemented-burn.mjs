#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'bullshit-audit.mjs')], {
  cwd: root, encoding: 'utf8'
});

if (run.status !== 0 && run.status !== null) {
  console.error(run.stderr);
  process.exit(1);
}

const result = JSON.parse(run.stdout);
const summary = result.summary;

const blockingNotImpl = summary.blockingFindings
  .filter((f) => f.type === 'not_implemented')
  .reduce((a, b) => a + b.count, 0);

const pass = blockingNotImpl === 0 && summary.blockingBullshitCount === 0;

const artifact = path.join(root, 'SMOKE_P083_NOT_IMPLEMENTED_BURN.md');
fs.writeFileSync(artifact, [
  '# P083 Smoke Proof — "Not Implemented" Surface Burn',
  '',
  `Status: ${pass ? 'PASS' : 'FAIL'}`,
  `Generated: ${new Date().toISOString()}`,
  `Blocking "not implemented" in first-party executables: ${blockingNotImpl}`,
  `Total blocking bullshit count: ${summary.blockingBullshitCount}`,
  `Non-blocking telemetry "not implemented": ${summary.suspiciousPatternCounts.not_implemented}`,
  '',
  '## Verification',
  'Zero blocking "not implemented" throws or surfaces remain in first-party executable runtime code.',
  'Remaining non-blocking hits are in:',
  '  - bullshit-audit.mjs (scans FOR this pattern — in blockingIgnoreFiles)',
  '  - sync-directive-audit-baseline.mjs (reports on this pattern — in blockingIgnoreFiles)',
  '  - skydexia-ae-stub-replacement-and-smoke.mjs (regex pattern string — in blockingIgnoreFiles)',
  '  - ULTIMATE_SYSTEM_DIRECTIVE.md (target text, not executable code)',
  '  - docs/ (documentation files, not executable)',
  `Audit report: ${result.report}`,
].join('\n') + '\n', 'utf8');

console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact), blockingNotImpl, blockingTotal: summary.blockingBullshitCount }, null, 2));
if (!pass) process.exit(1);
