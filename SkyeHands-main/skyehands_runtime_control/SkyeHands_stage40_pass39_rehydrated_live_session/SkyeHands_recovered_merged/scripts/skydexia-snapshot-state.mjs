#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const snapshotsRoot = path.join(root, 'skydexia', 'snapshots');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const snapshotDir = path.join(snapshotsRoot, timestamp);
fs.mkdirSync(snapshotDir, { recursive: true });

const targets = [
  'ULTIMATE_SYSTEM_DIRECTIVE.md',
  'DIRECTIVE_RELEASE_NOTES.md',
  'skydexia/knowledge-updates/latest-batch.json',
  'skydexia/knowledge-updates/source-trust-policy.json',
  'skydexia/alerts/delivery-log.json'
];

const files = [];
for (const rel of targets) {
  const src = path.join(root, rel);
  if (!fs.existsSync(src)) continue;
  const dst = path.join(snapshotDir, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  const data = fs.readFileSync(src);
  fs.writeFileSync(dst, data);
  files.push({ file: rel, sha256: crypto.createHash('sha256').update(data).digest('hex'), bytes: data.length });
}

const manifest = { version: 1, createdAt: new Date().toISOString(), snapshotDir: path.relative(root, snapshotDir), files };
fs.writeFileSync(path.join(snapshotDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(snapshotsRoot, 'latest.json'), JSON.stringify({ latest: path.relative(root, snapshotDir), createdAt: manifest.createdAt }, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ snapshot: path.relative(root, snapshotDir), files: files.length }, null, 2));
if (!files.length) process.exit(1);
