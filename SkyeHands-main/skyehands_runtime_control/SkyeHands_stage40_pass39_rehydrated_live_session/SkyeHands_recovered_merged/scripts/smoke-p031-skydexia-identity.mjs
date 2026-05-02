#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadRuntimeBoundaries, assertIdentity } from '../apps/skyequanta-shell/lib/skydexia-orchestrator.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P031_SKYDEXIA_IDENTITY.md');
let pass = false;
try {
  const boundaries = loadRuntimeBoundaries(root);
  assertIdentity(boundaries);
  pass = true;
} catch { pass = false; }
fs.writeFileSync(artifact, `# P031 Smoke Proof — SkyDexia Model Identity\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2));
if (!pass) process.exit(1);
