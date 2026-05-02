#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const indexPath = path.join(root, 'skydexia', 'donors', 'normalized-index.json');
const outPath = path.join(root, 'skydexia', 'donors', 'compatibility-matrix.json');

if (!fs.existsSync(indexPath)) {
  console.error('Missing normalized index.');
  process.exit(1);
}

const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
const matrix = index.donors.map((d) => {
  const payload = JSON.parse(fs.readFileSync(path.join(root, d.path), 'utf8'));
  return {
    donorId: d.donorId,
    class: d.class,
    runtime: payload.normalized.runtime,
    compatibility: payload.normalized.compatibility,
    providerVars: payload.normalized.providerVars,
    requiresNetwork: payload.normalized.expectations.requiresNetwork,
    requiresStorage: payload.normalized.expectations.requiresStorage
  };
});

fs.writeFileSync(outPath, `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), total: matrix.length, matrix }, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ok: true, matrix: path.relative(root, outPath), total: matrix.length }, null, 2));
