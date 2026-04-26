#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const exists = fs.existsSync(path.join(root, 'ULTIMATE_SYSTEM_DIRECTIVE.md'));
const artifact = path.join(root, 'SMOKE_P005_MASTER_DIRECTIVE_AT_ROOT.md');
fs.writeFileSync(artifact, `# P005 Smoke Proof — Master Directive at Repository Root\n\nStatus: ${exists ? 'PASS' : 'FAIL'}\nULTIMATE_SYSTEM_DIRECTIVE.md exists at root: ${exists}\n`, 'utf8');
console.log(JSON.stringify({ pass: exists, artifact: path.relative(root, artifact) }, null, 2));
if (!exists) process.exit(1);
