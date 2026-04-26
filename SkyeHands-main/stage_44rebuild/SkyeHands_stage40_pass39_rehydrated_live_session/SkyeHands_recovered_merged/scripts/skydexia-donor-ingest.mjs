#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const inbox = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'skydexia', 'donors', 'inbox');
const outDir = path.join(root, 'skydexia', 'donors');
const outPath = path.join(outDir, 'ingestion-registry.json');

if (!fs.existsSync(inbox)) {
  console.error(`Donor inbox not found: ${inbox}`);
  process.exit(1);
}

const manifests = fs.readdirSync(inbox)
  .filter((file) => file.endsWith('.donor.json'))
  .map((file) => JSON.parse(fs.readFileSync(path.join(inbox, file), 'utf8')));

const required = ['donorId', 'name', 'class', 'runtime', 'entrypoint', 'compatibility', 'providerVars'];
const invalid = [];
const valid = manifests.filter((m) => {
  const missing = required.filter((key) => m[key] == null || (Array.isArray(m[key]) && m[key].length === 0));
  if (missing.length > 0) {
    invalid.push({ donorId: m.donorId || 'unknown', missing });
    return false;
  }
  return true;
});

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify({
  version: 1,
  ingestedAt: new Date().toISOString(),
  sourceInbox: path.relative(root, inbox),
  totalManifests: manifests.length,
  validCount: valid.length,
  invalidCount: invalid.length,
  invalid,
  donors: valid
}, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({ ok: invalid.length === 0, registry: path.relative(root, outPath), total: manifests.length, valid: valid.length, invalid: invalid.length }, null, 2));
if (invalid.length > 0) process.exit(1);
