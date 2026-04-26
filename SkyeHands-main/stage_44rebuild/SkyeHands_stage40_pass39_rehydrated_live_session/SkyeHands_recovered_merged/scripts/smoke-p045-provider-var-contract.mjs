#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P045_PROVIDER_VAR_CONTRACT.md');
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-provider-var-contract.mjs')], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const pass = run.status === 0 && payload.vars >= 1 && payload.donors >= 30;
fs.writeFileSync(artifact, `# P045 Smoke Proof — Provider Var Contract\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nVars: ${payload.vars ?? 0}\nDonors: ${payload.donors ?? 0}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2));
if (!pass) process.exit(1);
