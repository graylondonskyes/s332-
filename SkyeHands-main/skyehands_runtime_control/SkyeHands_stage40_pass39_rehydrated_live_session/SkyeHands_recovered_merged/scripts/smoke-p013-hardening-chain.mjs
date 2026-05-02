#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifactPath = path.join(root, 'SMOKE_P013_HARDENING_CHAIN.md');
const section37ProofPath = path.join(root, 'docs', 'proof', 'SECTION_37_SKEPTIC_PROOF_HARDENING.json');

function parseJson(text) {
  try { return JSON.parse(String(text || '').trim()); } catch { return null; }
}

function compactCheckList(checks) {
  return Array.isArray(checks)
    ? checks.map((item) => ({ pass: Boolean(item?.pass), message: item?.message || 'unknown' }))
    : [];
}

const result = spawnSync(process.execPath, [path.join(root, 'apps', 'skyequanta-shell', 'bin', 'workspace-proof-section37-hardening.mjs'), '--json'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024
});

const payload = parseJson(result.stdout);
const checks = compactCheckList(payload?.checks);
const failed = checks.filter((item) => !item.pass);
const hasProofFile = fs.existsSync(section37ProofPath);
const pass = result.status === 0 && Boolean(payload?.ok) && failed.length === 0 && hasProofFile;

const lines = [
  '# P013 Smoke Proof — Hardening Chain',
  '',
  `Generated: ${new Date().toISOString()}`,
  `Command: node ./apps/skyequanta-shell/bin/workspace-proof-section37-hardening.mjs --json`,
  `Exit Code: ${result.status}`,
  `Proof File Exists: ${hasProofFile}`,
  `Checks: ${checks.length}`,
  `Failed Checks: ${failed.length}`,
  `Status: ${pass ? 'PASS' : 'FAIL'}`,
  '',
  '## Check Summary',
  ...(checks.length ? checks.map((item) => `- ${item.pass ? 'PASS' : 'FAIL'} | ${item.message}`) : ['- none']),
  '',
  '## Failure Reasons',
  ...(failed.length ? failed.map((item) => `- ${item.message}`) : ['- none']),
  '',
  '## Summary JSON',
  '```json',
  JSON.stringify({
    pass,
    exitCode: result.status,
    proofFile: path.relative(root, section37ProofPath),
    checks,
    failed
  }, null, 2),
  '```',
  ''
];

fs.writeFileSync(artifactPath, lines.join('\n'), 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifactPath), checks: checks.length, failed: failed.length }, null, 2));
if (!pass) process.exit(1);
