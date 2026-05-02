#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P029_SKYDEXIA_ARCHITECTURE.md');
const archMd = path.join(root, 'docs', 'SKYDEXIA_CANONICAL_ARCHITECTURE.md');
const boundaries = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'SKYDEXIA_RUNTIME_BOUNDARIES.json'), 'utf8'));
const pass = fs.existsSync(archMd) && boundaries.identity === 'SkyDexia model by Skyes Over London' && boundaries.lanes.includes('ae');
fs.writeFileSync(artifact, `# P029 Smoke Proof — SkyDexia Canonical Architecture\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2));
if (!pass) process.exit(1);
