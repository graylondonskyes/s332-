#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const rollbackStatePath = path.join(root, 'skydexia', 'snapshots', 'rollback-last.json');
if (!fs.existsSync(rollbackStatePath)) {
  console.error('No rollback state found. Run rollback command first.');
  process.exit(1);
}

const rollback = JSON.parse(fs.readFileSync(rollbackStatePath, 'utf8'));
const validate = spawnSync(process.execPath, [path.join(root, 'scripts', 'validate-ultimate-directive.mjs')], { cwd: root, encoding: 'utf8' });
const pass = validate.status === 0 && rollback.restoredFiles > 0;

const out = path.join(root, 'skydexia', 'snapshots', 'rollback-verify.json');
fs.writeFileSync(out, JSON.stringify({ version: 1, verifiedAt: new Date().toISOString(), rollbackState: path.relative(root, rollbackStatePath), restoredFiles: rollback.restoredFiles, directiveValidationExit: validate.status, status: pass ? 'PASS' : 'FAIL' }, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ output: path.relative(root, out), pass }, null, 2));
if (!pass) process.exit(1);
