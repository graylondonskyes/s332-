#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P062_DISASTER_RECOVERY_PLAYBOOK.md');
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-generate-disaster-recovery-playbook.mjs')], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const playbookPath = path.join(root, payload.output || '');
const playbookExists = fs.existsSync(playbookPath);
const pass = run.status === 0 && playbookExists;
fs.writeFileSync(artifact, `# P062 Smoke Proof — Disaster Recovery Playbook\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nPlaybook: ${payload.output ?? 'n/a'}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2)); if (!pass) process.exit(1);
