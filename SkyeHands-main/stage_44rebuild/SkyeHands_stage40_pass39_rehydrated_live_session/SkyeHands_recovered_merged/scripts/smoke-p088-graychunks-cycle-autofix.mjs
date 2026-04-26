#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'graychunks-cycle-'));
const fixture = path.join(tmp, 'repo');
fs.mkdirSync(fixture, { recursive: true });

fs.writeFileSync(path.join(fixture, 'sample.mjs'), [
  "import fs from 'node:fs';",
  "import fs from 'node:fs';",
  'export const ok = true;'
].join('\n'));

fs.writeFileSync(path.join(fixture, 'sample.json'), [
  '{',
  '  "mode": "a",',
  '  "mode": "b",',
  '  "x": 1',
  '}'
].join('\n'));

const cycle = spawnSync(process.execPath, [path.join(root, 'scripts', 'graychunks-runtime-cycle.mjs'), `--target=${fixture}`], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, GRAYCHUNKS_ALERT_DRY_RUN: '1' }
});

const findings = JSON.parse(fs.readFileSync(path.join(root, 'skydexia', 'alerts', 'graychunks-findings.json'), 'utf8'));
const autofix = JSON.parse(fs.readFileSync(path.join(root, 'skydexia', 'alerts', 'graychunks-autofix.json'), 'utf8'));

const removedImports = Number(autofix.removedDuplicateImports || 0);
const removedJsonKeys = Number(autofix.removedDuplicateJsonKeys || 0);
const pass = cycle.status === 0 && removedImports > 0 && removedJsonKeys > 0 && Number(findings.issueCount || 0) === 0;

const artifact = path.join(root, 'SMOKE_P088_GRAYCHUNKS_CYCLE_AUTOFIX.md');
fs.writeFileSync(artifact, [
  '# P088 Smoke Proof — GrayChunks Cycle Autofix',
  '',
  `Status: ${pass ? 'PASS' : 'FAIL'}`,
  `Cycle exit: ${cycle.status}`,
  `Removed duplicate imports: ${removedImports}`,
  `Removed duplicate json keys: ${removedJsonKeys}`,
  `Final issue count: ${findings.issueCount || 0}`
].join('\n') + '\n', 'utf8');

// Restore canonical scan artifacts for repo-wide tracking after fixture run.
spawnSync(process.execPath, [path.join(root, 'scripts', 'graychunks-scan.mjs')], { cwd: root, encoding: 'utf8' });
spawnSync(process.execPath, [path.join(root, 'scripts', 'graychunks-priority-queue.mjs')], { cwd: root, encoding: 'utf8' });
spawnSync(process.execPath, [path.join(root, 'scripts', 'graychunks-progress-dashboard.mjs')], { cwd: root, encoding: 'utf8' });
spawnSync(process.execPath, [path.join(root, 'scripts', 'graychunks-alert-resend.mjs')], { cwd: root, encoding: 'utf8', env: { ...process.env, GRAYCHUNKS_ALERT_DRY_RUN: '1' } });

fs.rmSync(tmp, { recursive: true, force: true });

console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2));
if (!pass) process.exit(1);
