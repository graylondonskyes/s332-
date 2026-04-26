#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const registryPath = path.join(root, 'skydexia', 'donors', 'ingestion-registry.json');
const outDir = path.join(root, 'skydexia', 'donors', 'normalized');
const indexPath = path.join(root, 'skydexia', 'donors', 'normalized-index.json');

if (!fs.existsSync(registryPath)) {
  console.error('Missing ingestion registry. Run scripts/skydexia-donor-ingest.mjs first.');
  process.exit(1);
}

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

const normalized = registry.donors.map((donor) => {
  const payload = {
    donorId: donor.donorId,
    class: donor.class,
    normalized: {
      runtime: String(donor.runtime).toLowerCase(),
      entrypoint: donor.entrypoint,
      scripts: donor.scripts || { build: 'npm run build', start: 'npm run start', smoke: 'npm run smoke' },
      providerVars: donor.providerVars,
      compatibility: donor.compatibility,
      expectations: {
        requiresNetwork: donor.expectations?.requiresNetwork ?? true,
        requiresStorage: donor.expectations?.requiresStorage ?? true,
        healthEndpoint: donor.expectations?.healthEndpoint ?? '/health'
      }
    }
  };

  const outPath = path.join(outDir, `${donor.donorId}.normalized.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return { donorId: donor.donorId, class: donor.class, path: path.relative(root, outPath) };
});

fs.writeFileSync(indexPath, `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), total: normalized.length, donors: normalized }, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ok: true, index: path.relative(root, indexPath), total: normalized.length }, null, 2));
