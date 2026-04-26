#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { resolveSafeTargetDir } from './graychunks-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targetArg = process.argv.find((arg) => arg.startsWith('--target='));
let target = '.';
try {
  const targetPath = resolveSafeTargetDir(root, targetArg ? targetArg.slice('--target='.length) : '.', { enforceWithinRoot: false });
  target = path.relative(root, targetPath) || '.';
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', error: 'invalid_target', detail: String(error?.message || error) }, null, 2));
  process.exit(1);
}

function run(script, args = [], env = {}) {
  const proc = spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...env }
  });
  return {
    script,
    status: proc.status,
    stdout: proc.stdout?.trim() || '',
    stderr: proc.stderr?.trim() || ''
  };
}

const steps = [];
steps.push(run('graychunks-scan.mjs', [`--target=${target}`]));
steps.push(run('graychunks-autofix.mjs', [`--target=${target}`]));
steps.push(run('graychunks-scan.mjs', [`--target=${target}`]));
steps.push(run('graychunks-priority-queue.mjs'));
steps.push(run('graychunks-alert-resend.mjs', [], { GRAYCHUNKS_ALERT_DRY_RUN: process.env.GRAYCHUNKS_ALERT_DRY_RUN || '1' }));
steps.push(run('graychunks-progress-dashboard.mjs'));

const pass = steps.every((s) => s.status === 0 || (s.script === 'graychunks-scan.mjs' && s.status === 2));
console.log(JSON.stringify({ status: pass ? 'PASS' : 'FAIL', steps }, null, 2));
if (!pass) process.exit(1);
