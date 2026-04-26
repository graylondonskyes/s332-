#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P048_PROOF_ARTIFACT_CAPTURE.md');
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-proof-artifact-capture.mjs')], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const pass = run.status === 0 && payload.artifactsCaptured >= 3;
fs.writeFileSync(artifact, `# P048 Smoke Proof — Proof Artifact Capture\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nArtifacts Captured: ${payload.artifactsCaptured ?? 0}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2));
if (!pass) process.exit(1);
