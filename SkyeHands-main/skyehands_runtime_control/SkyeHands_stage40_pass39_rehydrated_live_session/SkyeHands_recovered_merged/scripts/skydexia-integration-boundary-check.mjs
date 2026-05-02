#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const matrix = JSON.parse(fs.readFileSync(path.join(root, 'skydexia', 'donors', 'compatibility-matrix.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(root, 'skydexia', 'providers', 'provider-var-contract.json'), 'utf8'));
const latestBatch = JSON.parse(fs.readFileSync(path.join(root, 'skydexia', 'knowledge-updates', 'latest-batch.json'), 'utf8'));
const review = JSON.parse(fs.readFileSync(path.join(root, 'skydexia', 'knowledge-updates', 'semantic-diff-review.json'), 'utf8'));
const outbox = JSON.parse(fs.readFileSync(path.join(root, 'skydexia', 'alerts', 'admin-outbox.json'), 'utf8'));
const output = path.join(root, 'skydexia', 'proofs', 'integration-boundary-check.json');

const providerVars = new Set((contract.vars || []).map((v) => v.providerVar));
const missingProviderBoundary = [];
for (const row of matrix.matrix || []) {
  for (const pv of row.providerVars || []) {
    if (!providerVars.has(pv)) missingProviderBoundary.push({ donorId: row.donorId, providerVar: pv });
  }
}

const syncBoundaryOk = review.batch === latestBatch.latestBatch;
const queueBoundaryOk = (outbox.totalDispatches || 0) >= 1;
const pass = missingProviderBoundary.length === 0 && syncBoundaryOk && queueBoundaryOk;

const report = {
  version: 1,
  checkedAt: new Date().toISOString(),
  providerBoundary: { missing: missingProviderBoundary.length, details: missingProviderBoundary },
  syncBoundary: { expectedBatch: latestBatch.latestBatch, reviewedBatch: review.batch, ok: syncBoundaryOk },
  queueBoundary: { dispatches: outbox.totalDispatches || 0, ok: queueBoundaryOk },
  status: pass ? 'PASS' : 'FAIL'
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ output: path.relative(root, output), status: report.status }, null, 2));
if (!pass) process.exit(1);
