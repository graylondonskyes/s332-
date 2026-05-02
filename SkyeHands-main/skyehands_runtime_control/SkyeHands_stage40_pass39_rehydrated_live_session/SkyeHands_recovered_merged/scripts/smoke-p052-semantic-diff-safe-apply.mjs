#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P052_SEMANTIC_DIFF_SAFE_APPLY.md');
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-knowledge-diff-review.mjs')], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const pass = run.status === 0 && payload.safeToApply === true;
fs.writeFileSync(artifact, `# P052 Smoke Proof — Semantic Diff + Safe Apply\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nSafe To Apply: ${payload.safeToApply ?? false}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2));
if (!pass) process.exit(1);
