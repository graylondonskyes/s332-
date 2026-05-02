#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const shellDir = path.join(rootDir, 'apps', 'skyequanta-shell');

const aliasMap = new Map([
  ['doctor', ['node', ['bin/doctor.mjs']]],
  ['operator:start', ['node', ['bin/operator-start.mjs']]],
  ['launch', ['node', ['bin/launch.mjs']]],
  ['start', ['node', ['bin/launch.mjs']]],
  ['workspace:proof:section61', ['node', ['bin/workspace-proof-section61-platform-launchpad.mjs']]],
  ['workspace:proof:section62', ['node', ['bin/workspace-proof-section62-platform-power-mesh.mjs']]],
  ['workspace:proof:stage4', ['node', ['bin/workspace-proof-stage4.mjs']]],
  ['workspace:proof:stage8', ['node', ['bin/workspace-proof-stage8.mjs']]],
  ['workspace:proof:section63', ['node', ['bin/workspace-proof-section63-agent-core-bundle.mjs']]],
  ['current:refresh', ['node', ['bin/current-chain-refresh.mjs']]],
  ['current:rerun', ['node', ['bin/current-chain-rerun.mjs']]],
  ['ship:candidate', ['node', ['bin/ship-candidate.mjs']]]
]);

const argv = process.argv.slice(2);
const command = argv[0] || 'doctor';
const rest = argv.slice(1);

let child;
if (aliasMap.has(command)) {
  const [runner, baseArgs] = aliasMap.get(command);
  child = spawnSync(runner === 'node' ? process.execPath : runner, baseArgs.concat(rest), {
    cwd: shellDir,
    stdio: 'inherit',
    env: { ...process.env, PATH: `${path.join(shellDir, 'node_modules', '.bin')}:${process.env.PATH || ''}` }
  });
} else {
  child = spawnSync('npm', ['run', command, '--', ...rest], {
    cwd: shellDir,
    stdio: 'inherit',
    env: { ...process.env, PATH: `${path.join(shellDir, 'node_modules', '.bin')}:${process.env.PATH || ''}` }
  });
}

process.exit(child.status ?? 1);
