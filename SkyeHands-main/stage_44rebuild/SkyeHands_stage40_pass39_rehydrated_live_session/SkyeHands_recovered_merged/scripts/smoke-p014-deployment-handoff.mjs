#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifactPath = path.join(root, 'SMOKE_P014_DEPLOYMENT_HANDOFF.md');
const section8ProofPath = path.join(root, 'docs', 'proof', 'SECTION_8_DEPLOYMENT_PACKAGING.json');

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

const run = spawnSync(process.execPath, [path.join(root, 'apps', 'skyequanta-shell', 'bin', 'workspace-proof-section8-deployment-packaging.mjs')], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 128 * 1024 * 1024
});

const proof = readJson(section8ProofPath, {});
const checks = Array.isArray(proof?.checks) ? proof.checks.map((item) => ({ pass: Boolean(item?.pass), message: item?.message || 'unknown' })) : [];
const failed = checks.filter((item) => !item.pass);

const shipCandidate = proof?.artifacts?.shipCandidate || {};
const archivePath = shipCandidate?.outputs?.handoffArchive ? path.join(root, shipCandidate.outputs.handoffArchive) : null;
const handoffDirPath = shipCandidate?.outputs?.handoffDirectory ? path.join(root, shipCandidate.outputs.handoffDirectory) : null;
const reportPath = shipCandidate?.outputs?.reportFile ? path.join(root, shipCandidate.outputs.reportFile) : null;

const pass = run.status === 0
  && proof?.pass === true
  && failed.length === 0
  && Boolean(shipCandidate?.ok)
  && Boolean(archivePath && fs.existsSync(archivePath))
  && Boolean(handoffDirPath && fs.existsSync(handoffDirPath))
  && Boolean(reportPath && fs.existsSync(reportPath));

const lines = [
  '# P014 Smoke Proof — Deployment Packaging & Operator Handoff',
  '',
  `Generated: ${new Date().toISOString()}`,
  `Command: node ./apps/skyequanta-shell/bin/workspace-proof-section8-deployment-packaging.mjs`,
  `Exit Code: ${run.status}`,
  `Section8 Proof: ${path.relative(root, section8ProofPath)}`,
  `Handoff Archive Exists: ${Boolean(archivePath && fs.existsSync(archivePath))}`,
  `Handoff Directory Exists: ${Boolean(handoffDirPath && fs.existsSync(handoffDirPath))}`,
  `Readiness Report Exists: ${Boolean(reportPath && fs.existsSync(reportPath))}`,
  `Checks: ${checks.length}`,
  `Failed Checks: ${failed.length}`,
  `Status: ${pass ? 'PASS' : 'FAIL'}`,
  '',
  '## Check Summary',
  ...(checks.length ? checks.map((item) => `- ${item.pass ? 'PASS' : 'FAIL'} | ${item.message}`) : ['- none']),
  '',
  '## Summary JSON',
  '```json',
  JSON.stringify({
    pass,
    exitCode: run.status,
    section8ProofPath: path.relative(root, section8ProofPath),
    handoffArchive: archivePath ? path.relative(root, archivePath) : null,
    handoffDirectory: handoffDirPath ? path.relative(root, handoffDirPath) : null,
    readinessReport: reportPath ? path.relative(root, reportPath) : null,
    checks,
    failed
  }, null, 2),
  '```',
  ''
];

fs.writeFileSync(artifactPath, lines.join('\n'), 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifactPath), checks: checks.length, failed: failed.length }, null, 2));
if (!pass) process.exit(1);
