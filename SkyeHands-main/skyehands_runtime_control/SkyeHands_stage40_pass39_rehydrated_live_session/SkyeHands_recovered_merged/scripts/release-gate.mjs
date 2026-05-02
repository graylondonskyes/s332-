#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const directivePath = path.join(root, 'ULTIMATE_SYSTEM_DIRECTIVE.md');

const validator = spawnSync(process.execPath, [path.join(root, 'scripts/validate-ultimate-directive.mjs'), '--require-runtime-tier'], {
  stdio: 'pipe',
  encoding: 'utf8',
});

const smokeArtifacts = fs.readdirSync(root).filter((file) => /^SMOKE_P\d{3}.*\.(md|json)$/i.test(file));
const smokeStatuses = smokeArtifacts.map((file) => {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const pass = /Status:\s*PASS/i.test(text) || /"status"\s*:\s*"PASS"/i.test(text);
  return { file, pass };
});

const directiveSha256 = fs.existsSync(directivePath)
  ? crypto.createHash('sha256').update(fs.readFileSync(directivePath)).digest('hex')
  : null;

const report = {
  directiveValidated: validator.status === 0,
  runtimeTierValidated: validator.status === 0,
  smokeArtifactsChecked: smokeStatuses.length,
  failingSmokeArtifacts: smokeStatuses.filter((item) => !item.pass).map((item) => item.file),
  directiveSha256
};

console.log(JSON.stringify(report, null, 2));

if (validator.status !== 0 || report.failingSmokeArtifacts.length > 0) {
  if (validator.stdout) process.stderr.write(validator.stdout);
  if (validator.stderr) process.stderr.write(validator.stderr);
  process.exit(1);
}
