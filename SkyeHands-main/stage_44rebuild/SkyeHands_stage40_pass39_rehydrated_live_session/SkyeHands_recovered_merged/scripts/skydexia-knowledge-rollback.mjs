#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const updatesDir = path.join(root, 'skydexia', 'knowledge-updates');
const latestPath = path.join(updatesDir, 'latest-batch.json');
const rollbackDir = path.join(updatesDir, 'rollbacks');
const rollbackStatePath = path.join(updatesDir, 'rollback-state.json');

if (!fs.existsSync(latestPath)) {
  console.error('Cannot rollback without latest batch.');
  process.exit(1);
}

const latest = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
const rollback = {
  version: 1,
  rolledBackAt: new Date().toISOString(),
  sourceBatch: latest.latestBatch,
  restoredStatus: 'ROLLED_BACK',
  updates: (latest.updates || []).map((u) => ({ sourceId: u.sourceId, fromStatus: u.status, toStatus: 'ROLLED_BACK' }))
};

fs.mkdirSync(rollbackDir, { recursive: true });
const rollbackPath = path.join(rollbackDir, `${Date.now()}-rollback.json`);
fs.writeFileSync(rollbackPath, JSON.stringify(rollback, null, 2) + '\n', 'utf8');
fs.writeFileSync(rollbackStatePath, JSON.stringify({ latestRollback: path.relative(root, rollbackPath), ...rollback }, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ rollback: path.relative(root, rollbackPath), state: path.relative(root, rollbackStatePath), entries: rollback.updates.length }, null, 2));
