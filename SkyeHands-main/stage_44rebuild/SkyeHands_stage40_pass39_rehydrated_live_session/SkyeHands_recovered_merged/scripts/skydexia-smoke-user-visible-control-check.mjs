#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const suitesPath = path.join(root, 'skydexia', 'donors', 'smoke-suites-by-class.json');
const outPath = path.join(root, 'skydexia', 'proofs', 'user-visible-control-check.json');
const suites = JSON.parse(fs.readFileSync(suitesPath, 'utf8'));

const checks = [];
for (const suite of suites.suites || []) {
  const donor = (suite.donors || [])[0];
  if (!donor) continue;
  const [spinupCmd, smokeCmd] = donor.smokeCommands || [];
  if (!spinupCmd || !smokeCmd) continue;

  const spinup = spawnSync('bash', ['-lc', spinupCmd], { cwd: root, encoding: 'utf8' });
  const smoke = spawnSync('bash', ['-lc', smokeCmd], { cwd: root, encoding: 'utf8' });
  checks.push({
    class: suite.class,
    donorId: donor.donorId,
    spinupExit: spinup.status,
    smokeExit: smoke.status,
    smokeOutput: (smoke.stdout || '').trim(),
    status: spinup.status === 0 && smoke.status === 0 ? 'PASS' : 'FAIL'
  });
}

const report = { version: 1, checkedAt: new Date().toISOString(), checks, passCount: checks.filter((c) => c.status === 'PASS').length, failCount: checks.filter((c) => c.status === 'FAIL').length };
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ output: path.relative(root, outPath), passCount: report.passCount, failCount: report.failCount }, null, 2));
if (report.failCount) process.exit(1);
