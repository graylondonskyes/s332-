#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const base = path.join(root, 'skydexia', 'knowledge-base');
const dirs = [
  'GiftsFromtheSkyes',
  'trusted-sources',
  'pending-review',
  'applied',
  'rejected',
  'rollback-points'
];
for (const d of dirs) fs.mkdirSync(path.join(base, d), { recursive: true });

const indexPath = path.join(base, 'KNOWLEDGE_SKELETON_INDEX.json');
const index = { version: 1, generatedAt: new Date().toISOString(), root: path.relative(root, base), lanes: dirs.map((d) => path.join('skydexia/knowledge-base', d)) };
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ output: path.relative(root, indexPath), lanes: dirs.length }, null, 2));
