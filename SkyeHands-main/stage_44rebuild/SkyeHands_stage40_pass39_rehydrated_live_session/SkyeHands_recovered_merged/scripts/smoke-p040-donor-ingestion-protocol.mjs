#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const inbox = path.join(root, 'skydexia', 'donors', 'inbox');
const artifact = path.join(root, 'SMOKE_P040_DONOR_INGESTION_PROTOCOL.md');
fs.mkdirSync(inbox, { recursive: true });
for (let i = 1; i <= 30; i += 1) {
  const donor = {
    donorId: `donor-pack-${String(i).padStart(2, '0')}`,
    name: `Donor Pack ${i}`,
    class: i % 3 === 0 ? 'worker' : (i % 2 === 0 ? 'web' : 'api'),
    runtime: 'node18',
    entrypoint: 'src/index.js',
    compatibility: ['node18', 'linux-x64'],
    providerVars: ['OPENAI_API_KEY'],
    expectations: { requiresNetwork: true, requiresStorage: true, healthEndpoint: '/health' }
  };
  fs.writeFileSync(path.join(inbox, `${donor.donorId}.donor.json`), `${JSON.stringify(donor, null, 2)}\n`, 'utf8');
}
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-donor-ingest.mjs'), inbox], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const pass = run.status === 0 && payload.ok === true && payload.total >= 30 && payload.invalid === 0;
fs.writeFileSync(artifact, `# P040 Smoke Proof — Donor Ingestion Protocol\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nIngested Manifests: ${payload.total ?? 0}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact), total: payload.total }, null, 2));
if (!pass) process.exit(1);
