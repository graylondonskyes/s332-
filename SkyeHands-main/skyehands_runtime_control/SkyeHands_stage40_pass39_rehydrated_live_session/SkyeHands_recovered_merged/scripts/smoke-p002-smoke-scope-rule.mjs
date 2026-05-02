#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const text = fs.readFileSync(path.join(root, 'ULTIMATE_SYSTEM_DIRECTIVE.md'), 'utf8');
const line = text.split('\n').find((l) => l.startsWith('✅ P002 ')) || '';
const pass = /real flow/i.test(line) && /controls\/buttons/i.test(line) && /data path/i.test(line) && /output behavior/i.test(line);
const artifact = path.join(root, 'SMOKE_P002_SMOKE_SCOPE_RULE.md');
fs.writeFileSync(artifact, `# P002 Smoke Proof — Smoke Scope Requirement\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nDirective line contains scope terms: ${pass}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2));
if (!pass) process.exit(1);
