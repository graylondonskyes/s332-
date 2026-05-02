#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifact = path.join(root, 'SMOKE_P085_GRAYCHUNKS_PLATFORM.md');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'graychunks-smoke-'));
const fixtureDir = path.join(tempRoot, 'fixture');
fs.mkdirSync(fixtureDir, { recursive: true });

fs.writeFileSync(path.join(fixtureDir, 'dup-imports.mjs'), [
  "import fs from 'node:fs';",
  "import fs from 'node:fs';",
  "import path from 'node:path';",
  "export const value = 1;"
].join('\n'));

fs.writeFileSync(path.join(fixtureDir, 'broken.jsx'), [
  'export function Broken(){',
  '  return (<section><Card>ok</section>);',
  '}'
].join('\n'));

fs.writeFileSync(path.join(fixtureDir, 'config.json'), [
  '{',
  '  "alpha": 1,',
  '  "alpha": 2,',
  '  "beta": 3',
  '}'
].join('\n'));

fs.writeFileSync(path.join(fixtureDir, 'repeated-chunk.js'), [
  'function repeated(){',
  '  const alphaValue = Number.parseInt("10", 10);',
  '  const betaValue = alphaValue + 20;',
  '  const gammaValue = betaValue * 3;',
  '  const deltaValue = gammaValue + betaValue;',
  '  return gammaValue + alphaValue;',
  '}',
  '',
  'function repeatedAgain(){',
  '  const alphaValue = Number.parseInt("10", 10);',
  '  const betaValue = alphaValue + 20;',
  '  const gammaValue = betaValue * 3;',
  '  const deltaValue = gammaValue + betaValue;',
  '  return gammaValue + alphaValue;',
  '}'
].join('\n'));

function run(script, args = [], env = {}) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...env }
  });
}

const firstScan = run('graychunks-scan.mjs', [`--target=${fixtureDir}`]);
const firstPayload = JSON.parse(firstScan.stdout || '{}');
const autofix = run('graychunks-autofix.mjs', [`--target=${fixtureDir}`]);
const autofixPayload = JSON.parse(autofix.stdout || '{}');
const secondScan = run('graychunks-scan.mjs', [`--target=${fixtureDir}`]);
const secondPayload = JSON.parse(secondScan.stdout || '{}');
const alert = run('graychunks-alert-resend.mjs', [], { GRAYCHUNKS_ALERT_DRY_RUN: '1' });
const alertPayload = JSON.parse(alert.stdout || '{}');

const detectedImportIssue = Number(firstPayload?.issuesByType?.duplicate_import || 0) > 0;
const reducedImportIssues = Number(secondPayload?.issuesByType?.duplicate_import || 0) < Number(firstPayload?.issuesByType?.duplicate_import || 0);
const autofixChanged = Number(autofixPayload?.removedDuplicateImports || 0) > 0;
const jsonFixChanged = Number(autofixPayload?.removedDuplicateJsonKeys || 0) > 0;
const repeatedChunkDetected = Number(firstPayload?.issuesByType?.repeated_chunk || 0) > 0;
const alertDryRun = alertPayload?.delivery === 'DRY_RUN';

const pass = firstScan.status === 2 && detectedImportIssue && repeatedChunkDetected && autofix.status === 0 && autofixChanged && jsonFixChanged && secondScan.status === 2 && reducedImportIssues && alert.status === 0 && alertDryRun;

const lines = [
  '# P085 Smoke Proof — GrayChunks Platform',
  '',
  `Status: ${pass ? 'PASS' : 'FAIL'}`,
  `Fixture: ${fixtureDir}`,
  `First scan issues: ${firstPayload.issueCount || 0}`,
  `Second scan issues: ${secondPayload.issueCount || 0}`,
  `Duplicate import issues before/after: ${(firstPayload?.issuesByType?.duplicate_import || 0)} -> ${(secondPayload?.issuesByType?.duplicate_import || 0)}`,
  `Repeated chunk issues detected: ${(firstPayload?.issuesByType?.repeated_chunk || 0)}`,
  `Autofix removed duplicate imports: ${autofixPayload.removedDuplicateImports || 0}`,
  `Autofix removed duplicate json keys: ${autofixPayload.removedDuplicateJsonKeys || 0}`,
  `Alert delivery mode: ${alertPayload.delivery || 'unknown'}`
];

fs.writeFileSync(artifact, `${lines.join('\n')}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2));

fs.rmSync(tempRoot, { recursive: true, force: true });

if (!pass) process.exit(1);
