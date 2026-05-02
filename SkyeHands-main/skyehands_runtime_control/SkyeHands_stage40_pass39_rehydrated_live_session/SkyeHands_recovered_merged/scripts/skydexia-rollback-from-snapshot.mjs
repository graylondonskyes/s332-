#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const snapshotsRoot = path.join(root, 'skydexia', 'snapshots');
const latestSnapshotRef = path.join(snapshotsRoot, 'latest.json');
if (!fs.existsSync(latestSnapshotRef)) {
  console.error('No snapshot available. Run skydexia-snapshot-state.mjs first.');
  process.exit(1);
}

const latest = JSON.parse(fs.readFileSync(latestSnapshotRef, 'utf8'));
const snapshotDir = path.join(root, latest.latest || '');
const manifestPath = path.join(snapshotDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error('Snapshot manifest missing:', path.relative(root, manifestPath));
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
let restored = 0;
for (const item of manifest.files || []) {
  const src = path.join(snapshotDir, item.file);
  const dst = path.join(root, item.file);
  if (!fs.existsSync(src)) continue;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  restored += 1;
}

const state = {
  version: 1,
  rolledBackAt: new Date().toISOString(),
  fromSnapshot: path.relative(root, snapshotDir),
  restoredFiles: restored
};
const out = path.join(root, 'skydexia', 'snapshots', 'rollback-last.json');
fs.writeFileSync(out, JSON.stringify(state, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ output: path.relative(root, out), restored }, null, 2));
if (!restored) process.exit(1);
