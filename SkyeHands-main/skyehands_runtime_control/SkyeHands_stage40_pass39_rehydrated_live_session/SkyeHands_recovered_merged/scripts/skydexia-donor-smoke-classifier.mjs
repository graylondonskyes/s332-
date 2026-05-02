#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const indexPath = path.join(root, 'skydexia', 'donors', 'normalized-index.json');
const outPath = path.join(root, 'skydexia', 'donors', 'smoke-suites-by-class.json');

if (!fs.existsSync(indexPath)) {
  console.error('Missing normalized index.');
  process.exit(1);
}

const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
const grouped = new Map();
for (const donor of index.donors) {
  if (!grouped.has(donor.class)) grouped.set(donor.class, []);
  grouped.get(donor.class).push({
    donorId: donor.donorId,
    smokeCommands: [
      `node ./scripts/skydexia-template-spinup.mjs ${donor.donorId}`,
      `bash ./skydexia/generated-projects/${donor.donorId}/scripts/smoke.sh`
    ]
  });
}

const suites = Array.from(grouped.entries()).map(([klass, donors]) => ({ class: klass, donorCount: donors.length, donors }));
fs.writeFileSync(outPath, `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), totalClasses: suites.length, suites }, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ok: true, suites: path.relative(root, outPath), totalClasses: suites.length }, null, 2));
