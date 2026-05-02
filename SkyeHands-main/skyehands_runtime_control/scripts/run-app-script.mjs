#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { requireRecoveredAppRoot } from './repo-root.mjs';

const allowed = new Set([
  'doctor',
  'operator:start',
  'ship:candidate',
  'directive:validate',
  'directive:completion',
  'graychunks:scan',
  'graychunks:queue',
  'graychunks:progress',
  'smoke:p010',
  'smoke:p017',
  'smoke:p022',
  'smoke:p080',
  'smoke:p085',
  'smoke:p086',
  'smoke:p087',
  'smoke:p088',
  'workspace:proof:section61',
  'workspace:proof:section62',
  'workspace:proof:section63'
]);

const appRoot = requireRecoveredAppRoot();
const pkgPath = path.join(appRoot, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const scripts = pkg.scripts || {};

function printList() {
  const names = Object.keys(scripts).filter((name) => allowed.has(name)).sort();
  console.log(`SkyeHands app root: ${path.relative(process.cwd(), appRoot) || '.'}`);
  console.log(`Whitelisted scripts: ${names.length}`);
  for (const name of names) console.log(`- ${name}`);
}

const scriptName = process.argv[2];
if (!scriptName || scriptName === '--list') {
  printList();
  process.exit(0);
}

if (!allowed.has(scriptName)) {
  console.error(`Blocked non-whitelisted script bridge request: ${scriptName}`);
  printList();
  process.exit(2);
}

if (!scripts[scriptName]) {
  console.error(`Missing app script in recovered package.json: ${scriptName}`);
  process.exit(3);
}

const result = spawnSync('npm', ['run', scriptName], {
  cwd: appRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 0);
