#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const workflow = path.join(root, '.github', 'workflows', 'directive-guard.yml');
const exists = fs.existsSync(workflow);
const content = exists ? fs.readFileSync(workflow, 'utf8') : '';
const pass = exists && /directive/i.test(content) && /smoke|validate/i.test(content);
const artifact = path.join(root, 'SMOKE_P008_CI_GUARD_JOB.md');
fs.writeFileSync(artifact, `# P008 Smoke Proof — CI Guard Job\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nWorkflow exists: ${exists}\nGuard terms present: ${pass}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact), workflow: path.relative(root, workflow) }, null, 2));
if (!pass) process.exit(1);
