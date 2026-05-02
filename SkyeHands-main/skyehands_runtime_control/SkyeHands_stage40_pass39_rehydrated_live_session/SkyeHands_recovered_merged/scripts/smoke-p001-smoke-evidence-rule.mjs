#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const directive = fs.readFileSync(path.join(root, 'ULTIMATE_SYSTEM_DIRECTIVE.md'), 'utf8');
const checked = directive.split('\n').filter((l) => /^✅\s+P\d{3}/.test(l));
const pass = checked.every((l) => /`SMOKE:\s*[^`]+`/.test(l));
const artifact = path.join(root, 'SMOKE_P001_SMOKE_EVIDENCE_RULE.md');
fs.writeFileSync(artifact, `# P001 Smoke Proof — Smoke Evidence Requirement\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nChecked Items: ${checked.length}\nAll checked items include SMOKE refs: ${pass}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact), checkedItems: checked.length }, null, 2));
if (!pass) process.exit(1);
