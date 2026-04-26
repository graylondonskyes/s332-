#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outPath = path.join(root, 'skydexia', 'integration', 'PROOF_MAP.json');
const smokeArtifacts = fs.readdirSync(root).filter((f) => /^SMOKE_.*\.md$/i.test(f)).sort();

const map = {
  version: 1,
  generatedAt: new Date().toISOString(),
  proofSuites: [
    { capability: 'directive-governance', artifacts: smokeArtifacts.filter((n) => /P0(6|7)\d/.test(n)) },
    { capability: 'provider-proof-strategy', artifacts: smokeArtifacts.filter((n) => /P04[5-9]/.test(n)) },
    { capability: 'knowledge-update-governance', artifacts: smokeArtifacts.filter((n) => /P05[0-9]/.test(n)) },
    { capability: 'rollback-and-quality', artifacts: smokeArtifacts.filter((n) => /P06[0-7]/.test(n)) }
  ]
};

fs.writeFileSync(outPath, JSON.stringify(map, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ output: path.relative(root, outPath), suites: map.proofSuites.length }, null, 2));
