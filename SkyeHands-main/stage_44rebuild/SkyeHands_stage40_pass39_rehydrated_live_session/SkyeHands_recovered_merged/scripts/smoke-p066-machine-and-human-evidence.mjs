#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P066_MACHINE_AND_HUMAN_EVIDENCE.md');
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-smoke-evidence-packager.mjs')], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const pass = run.status === 0 && payload.fail === 0;
fs.writeFileSync(artifact, `# P066 Smoke Proof — Machine + Human Evidence\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nMachine JSON: ${payload.json ?? 'n/a'}\nHuman Summary: ${payload.markdown ?? 'n/a'}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2)); if (!pass) process.exit(1);
