#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const scanPath = path.join(root, 'AE_COMMANDHUB_REALITY_SCAN_2026-04-16.md');
const artifact = path.join(root, 'SMOKE_P025_CLASSIFICATION_REAL_VS_STUBBED.md');

function extractNumber(regex, text) {
  const match = text.match(regex);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

const exists = fs.existsSync(scanPath);
const text = exists ? fs.readFileSync(scanPath, 'utf8') : '';

const hasSectionReal = /## 1\) What is real/i.test(text);
const hasSectionStubbed = /## 2\) What is stubbed/i.test(text);
const hasSectionRealityCall = /## 3\) Reality call/i.test(text);

const scannedJsFiles = extractNumber(/Total JS files scanned[^\n]*:\s*(\d+)/i, text);
const stubLikeFiles = extractNumber(/Stub-like\/minimal files:\s*(\d+)/i, text);
const substantialFiles = extractNumber(/More substantial files:\s*(\d+)/i, text);
const manifestMissingTargets = extractNumber(/Scripts with `commandTargetExists: false`:\s*(\d+)/i, text);

const hasClassificationCoverage = hasSectionReal && hasSectionStubbed && hasSectionRealityCall;
const hasRuntimeSplitEvidence = Number.isInteger(scannedJsFiles)
  && Number.isInteger(stubLikeFiles)
  && Number.isInteger(substantialFiles)
  && scannedJsFiles === stubLikeFiles + substantialFiles;
const hasMissingTargetEvidence = Number.isInteger(manifestMissingTargets) && manifestMissingTargets > 0;

const pass = exists && hasClassificationCoverage && hasRuntimeSplitEvidence && hasMissingTargetEvidence;

const details = {
  exists,
  hasClassificationCoverage,
  hasRuntimeSplitEvidence,
  hasMissingTargetEvidence,
  metrics: {
    scannedJsFiles,
    stubLikeFiles,
    substantialFiles,
    manifestMissingTargets
  }
};

fs.writeFileSync(
  artifact,
  [
    '# P025 Smoke Proof — Classification Real vs Stubbed vs Missing',
    '',
    `Status: ${pass ? 'PASS' : 'FAIL'}`,
    `Reality scan exists: ${exists}`,
    `Classification sections present: ${hasClassificationCoverage}`,
    `Runtime split evidence valid: ${hasRuntimeSplitEvidence}`,
    `Missing command target evidence present: ${hasMissingTargetEvidence}`,
    '',
    '## Extracted Metrics',
    `- Total JS files scanned: ${scannedJsFiles ?? 'n/a'}`,
    `- Stub-like/minimal files: ${stubLikeFiles ?? 'n/a'}`,
    `- More substantial files: ${substantialFiles ?? 'n/a'}`,
    `- Scripts with commandTargetExists: false: ${manifestMissingTargets ?? 'n/a'}`,
    ''
  ].join('\n'),
  'utf8'
);

console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact), scanPath: path.relative(root, scanPath), details }, null, 2));
if (!pass) process.exit(1);
