#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const compatibilityPath = path.join(root, 'skydexia', 'donors', 'compatibility-matrix.json');
const outDir = path.join(root, 'skydexia', 'providers');
const outPath = path.join(outDir, 'provider-var-contract.json');

const matrix = JSON.parse(fs.readFileSync(compatibilityPath, 'utf8'));
const rows = Array.isArray(matrix.matrix) ? matrix.matrix : [];

const byVar = new Map();
for (const row of rows) {
  for (const providerVar of row.providerVars || []) {
    if (!byVar.has(providerVar)) {
      byVar.set(providerVar, { providerVar, requiredBy: new Set(), runtimes: new Set(), classes: new Set() });
    }
    const item = byVar.get(providerVar);
    item.requiredBy.add(row.donorId);
    item.runtimes.add(row.runtime);
    item.classes.add(row.class);
  }
}

const contract = {
  version: 1,
  generatedAt: new Date().toISOString(),
  source: path.relative(root, compatibilityPath),
  totalDonors: rows.length,
  vars: [...byVar.values()].map((item) => ({
    providerVar: item.providerVar,
    required: true,
    requiredByDonors: [...item.requiredBy].sort(),
    runtimes: [...item.runtimes].sort(),
    classes: [...item.classes].sort(),
    validation: { nonEmpty: true, type: 'string' }
  }))
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(contract, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ ok: true, output: path.relative(root, outPath), vars: contract.vars.length, donors: rows.length }, null, 2));
