#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P027_COMMANDHUB_MANIFEST_RECONCILE.md');
const manifestPath = path.join(root, 'platform', 'user-platforms', 'skye-account-executive-commandhub-s0l26-0s', 'skyehands.platform.json');
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'reconcile-commandhub-manifest-targets.mjs')], { cwd: root, encoding: 'utf8' });
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
let missing = 0;
for (const pkg of manifest.packages || []) {
  for (const script of pkg.scripts || []) if (script.commandTargetExists === false) missing += 1;
}
const pass = run.status === 0 && missing === 0;
fs.writeFileSync(artifact, `# P027 Smoke Proof — CommandHub Manifest Reconcile\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nMissing commandTargetExists:false count: ${missing}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact), missing }, null, 2));
if (!pass) process.exit(1);
