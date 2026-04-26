#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const text = fs.readFileSync(path.join(root, 'ULTIMATE_SYSTEM_DIRECTIVE.md'), 'utf8');
const line = text.split('\n').find((l) => l.startsWith('✅ P003 ')) || '';
const pass = /cannot prove/i.test(line) && /stays unchecked/i.test(line);
const artifact = path.join(root, 'SMOKE_P003_CHECKMARK_GATE_RULE.md');
fs.writeFileSync(artifact, `# P003 Smoke Proof — Checkmark Gate Rule\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nDirective enforces unchecked-on-missing-proof rule: ${pass}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2));
if (!pass) process.exit(1);
