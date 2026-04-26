#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P036_DONOR_INDEXING_PIPELINE.md');
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-donor-index.mjs')], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const catalogPath = path.join(root, payload.catalog || '');
let pass = run.status === 0 && payload.ok === true && fs.existsSync(catalogPath);
let catalog;
if (pass) {
  catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  pass = catalog.totalTemplates >= 1 && Array.isArray(catalog.templates) && catalog.templates.every((t) => t.smokeable === true && t.extractionPolicy === 'validated-only');
}
fs.writeFileSync(
  artifact,
  `# P036 Smoke Proof — Donor Indexing Pipeline\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nTemplates Indexed: ${catalog?.totalTemplates ?? 0}\nCatalog: ${payload.catalog || 'n/a'}\n`,
  'utf8'
);
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact), catalog: payload.catalog }, null, 2));
if (!pass) process.exit(1);
