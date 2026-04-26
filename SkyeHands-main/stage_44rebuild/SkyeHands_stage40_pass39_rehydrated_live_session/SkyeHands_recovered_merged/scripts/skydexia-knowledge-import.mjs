#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const lane = path.join(root, 'skydexia', 'knowledge-base', 'GiftsFromtheSkyes');
const source = process.argv[2];
if (!source || !fs.existsSync(source)) {
  console.error('Usage: node ./scripts/skydexia-knowledge-import.mjs <source-file>');
  process.exit(1);
}

fs.mkdirSync(lane, { recursive: true });
const sourceName = path.basename(source);
const target = path.join(lane, `${Date.now()}-${sourceName}`);
fs.copyFileSync(source, target);
const content = fs.readFileSync(target);
const meta = {
  source: path.resolve(source),
  importedAt: new Date().toISOString(),
  checksum: crypto.createHash('sha256').update(content).digest('hex'),
  classification: 'donor-import'
};
fs.writeFileSync(`${target}.meta.json`, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ok: true, target: path.relative(root, target), metadata: path.relative(root, `${target}.meta.json`) }, null, 2));
