#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const aeRoot = path.join(root, 'platform', 'user-platforms', 'skye-account-executive-commandhub-s0l26-0s', 'source', 'AE-Central-Command-Pack-CredentialHub-Launcher', 'netlify');
const mustExist = [
  path.join(aeRoot, 'functions'),
  path.join(aeRoot, '.ae-runtime', 'runtime-db.json'),
  path.join(aeRoot, '.ae-runtime', 'sessions.json'),
  path.join(aeRoot, '.ae-runtime', 'state.json')
];
const existence = mustExist.map((p) => ({ path: path.relative(root, p), exists: fs.existsSync(p) }));
const runs = ['smoke:p017', 'smoke:p018', 'smoke:p019'].map((script) => {
  const run = spawnSync('npm', ['run', script, '--silent'], { cwd: root, encoding: 'utf8' });
  return { script, exit: run.status };
});
const pass = existence.every((e) => e.exists) && runs.every((r) => r.exit === 0);
const artifact = path.join(root, 'SMOKE_P016_AE_RUNTIME_SURFACES.md');
fs.writeFileSync(artifact, `# P016 Smoke Proof — AE Runtime Surfaces Reinstated\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nExistence: ${JSON.stringify(existence)}\nRuns: ${JSON.stringify(runs)}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact), existence, runs }, null, 2));
if (!pass) process.exit(1);
