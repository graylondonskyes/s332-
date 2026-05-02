#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const runs = ['smoke:p017', 'smoke:p020', 'smoke:p026'].map((script) => {
  const run = spawnSync('npm', ['run', script, '--silent'], { cwd: root, encoding: 'utf8' });
  return { script, exit: run.status };
});
const pass = runs.every((r) => r.exit === 0);
const artifact = path.join(root, 'SMOKE_P015_AE_PIPELINE_RESTORED.md');
fs.writeFileSync(artifact, `# P015 Smoke Proof — AE Smoke Pipeline Restored\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nResults: ${JSON.stringify(runs)}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact), runs }, null, 2));
if (!pass) process.exit(1);
