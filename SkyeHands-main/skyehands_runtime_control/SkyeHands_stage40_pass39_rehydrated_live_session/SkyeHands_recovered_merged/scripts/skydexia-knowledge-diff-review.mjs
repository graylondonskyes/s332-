#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const updatesDir = path.join(root, 'skydexia', 'knowledge-updates');
const latestPath = path.join(updatesDir, 'latest-batch.json');
const reviewPath = path.join(updatesDir, 'semantic-diff-review.json');
const gatePath = path.join(updatesDir, 'safe-apply-gate.json');

if (!fs.existsSync(latestPath)) {
  console.error('Missing latest knowledge batch:', path.relative(root, latestPath));
  process.exit(1);
}

const latest = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
const previousPath = path.join(updatesDir, 'previous-batch-fingerprint.json');
const previous = fs.existsSync(previousPath) ? JSON.parse(fs.readFileSync(previousPath, 'utf8')) : { fingerprints: {} };

const updates = latest.updates || [];
const changes = updates.map((entry) => {
  const previousHash = previous.fingerprints[entry.sourceId] || null;
  const changed = previousHash !== entry.sha256;
  return {
    sourceId: entry.sourceId,
    status: entry.status,
    previousHash,
    currentHash: entry.sha256,
    changed,
    semanticDelta: changed ? 'content-hash-changed' : 'no-change',
    risk: changed ? 'review-required' : 'low'
  };
});

const review = {
  version: 1,
  reviewedAt: new Date().toISOString(),
  batch: latest.latestBatch || null,
  changeCount: changes.filter((c) => c.changed).length,
  unchangedCount: changes.filter((c) => !c.changed).length,
  changes
};

const safeToApply = review.changes.every((change) => change.status === 'APPLIED');
const gate = {
  version: 1,
  evaluatedAt: new Date().toISOString(),
  safeToApply,
  reason: safeToApply ? 'all-sources-applied' : 'contains-failed-updates',
  requiredManualReview: review.changeCount > 0
};

const newFingerprints = {};
for (const entry of updates) {
  if (entry.sourceId && entry.sha256) newFingerprints[entry.sourceId] = entry.sha256;
}

fs.writeFileSync(reviewPath, JSON.stringify(review, null, 2) + '\n', 'utf8');
fs.writeFileSync(gatePath, JSON.stringify(gate, null, 2) + '\n', 'utf8');
fs.writeFileSync(previousPath, JSON.stringify({ updatedAt: new Date().toISOString(), fingerprints: newFingerprints }, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ review: path.relative(root, reviewPath), gate: path.relative(root, gatePath), safeToApply }, null, 2));
if (!safeToApply) process.exit(1);
