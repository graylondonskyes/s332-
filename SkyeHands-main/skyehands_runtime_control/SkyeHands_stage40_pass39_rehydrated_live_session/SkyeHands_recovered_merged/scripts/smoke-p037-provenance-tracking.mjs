#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P037_PROVENANCE_TRACKING.md');
const buildCatalog = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-donor-index.mjs')], { cwd: root, encoding: 'utf8' });
if (buildCatalog.status !== 0) {
  fs.writeFileSync(artifact, '# P037 Smoke Proof — Provenance Tracking\n\nStatus: FAIL\nReason: donor indexing failed\n', 'utf8');
  console.log(JSON.stringify({ pass: false, artifact: path.relative(root, artifact) }, null, 2));
  process.exit(1);
}
const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-provenance-audit.mjs')], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const ledgerPath = path.join(root, payload.ledger || '');
let pass = run.status === 0 && payload.ok === true && fs.existsSync(ledgerPath);
let ledger;
if (pass) {
  ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  const missingCount = Array.isArray(ledger.missing) ? ledger.missing.length : Number.POSITIVE_INFINITY;
  pass = missingCount === 0 && ledger.completeTemplates === ledger.totalTemplates;
}
fs.writeFileSync(
  artifact,
  `# P037 Smoke Proof — Provenance Tracking\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nLedger: ${payload.ledger || 'n/a'}\nComplete Templates: ${ledger?.completeTemplates ?? 0}/${ledger?.totalTemplates ?? 0}\n`,
  'utf8'
);
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact), ledger: payload.ledger }, null, 2));
if (!pass) process.exit(1);
