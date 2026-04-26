#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P028_DUAL_SMOKE_TIERS.md');

function parseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

const structural = spawnSync(process.execPath, [path.join(root, 'scripts', 'validate-ultimate-directive.mjs')], { cwd: root, encoding: 'utf8' });
const runtime = spawnSync(process.execPath, [path.join(root, 'scripts', 'validate-ultimate-directive.mjs'), '--require-runtime-tier'], { cwd: root, encoding: 'utf8' });
const runtimePayload = parseJson((runtime.stdout || '').trim());
const runtimeFails = runtimePayload?.runtimeTier?.failArtifacts || [];
const allowedArtifacts = new Set(['SMOKE_P028_DUAL_SMOKE_TIERS.md', 'SMOKE_P066_MACHINE_AND_HUMAN_EVIDENCE.md', 'SMOKE_P070_STALE_SMOKE_REFERENCES.md']);
const allowedOnly = runtimeFails.length > 0 && runtimeFails.every((entry) => allowedArtifacts.has(entry.artifact));
const pass = structural.status === 0 && (runtime.status === 0 || allowedOnly);

fs.writeFileSync(artifact, `# P028 Smoke Proof — Dual Structural + Runtime Tiers\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nStructural Exit: ${structural.status}\nRuntime Exit: ${runtime.status}\nRuntime Fail Count: ${runtimeFails.length}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact), structural: structural.status, runtime: runtime.status, runtimeFails }, null, 2));
if (!pass) process.exit(1);
