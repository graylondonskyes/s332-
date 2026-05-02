#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const text = fs.readFileSync(path.join(root, 'ULTIMATE_SYSTEM_DIRECTIVE.md'), 'utf8');
const pass = /Directive Rules \(non-negotiable\)/.test(text) && /SMOKE:/.test(text);
const artifact = path.join(root, 'SMOKE_P006_SMOKE_RULES_DECLARED.md');
fs.writeFileSync(artifact, `# P006 Smoke Proof — Smoke Rules Declared in Directive\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nRules section + smoke refs present: ${pass}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2));
if (!pass) process.exit(1);
