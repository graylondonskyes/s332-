#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const giftsLane = path.join(root, 'skydexia', 'knowledge-base', 'GiftsFromtheSkyes');
const outDir = path.join(root, 'skydexia', 'templates');
const outPath = path.join(outDir, 'donor-template-catalog.json');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function inferRuntime(fileName) {
  if (fileName.endsWith('.mjs') || fileName.endsWith('.js')) return { runtime: 'node', entrypointType: 'script' };
  if (fileName.endsWith('.json')) return { runtime: 'data', entrypointType: 'config' };
  return { runtime: 'agnostic', entrypointType: 'asset' };
}

if (!fs.existsSync(giftsLane)) {
  console.error(`Missing donor lane: ${path.relative(root, giftsLane)}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
const entries = fs.readdirSync(giftsLane).filter((name) => !name.endsWith('.meta.json'));

const templates = entries.map((entry, idx) => {
  const donorPath = path.join(giftsLane, entry);
  const metaPath = `${donorPath}.meta.json`;
  if (!fs.existsSync(metaPath)) {
    throw new Error(`Missing metadata sidecar for donor asset: ${entry}`);
  }

  const raw = fs.readFileSync(donorPath);
  const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const runtimeHint = inferRuntime(entry);
  return {
    templateId: `donor-template-${String(idx + 1).padStart(4, '0')}`,
    donorAsset: path.relative(root, donorPath),
    metadataAsset: path.relative(root, metaPath),
    templateChecksum: sha256(raw),
    sourceChecksum: metadata.checksum,
    importedAt: metadata.importedAt,
    provenance: {
      source: metadata.source,
      classification: metadata.classification,
      compatibility: metadata.compatibility ?? ['node18']
    },
    runtimeHint,
    smokeable: true,
    qualityScore: metadata.qualityScore ?? 0.75,
    extractionPolicy: 'validated-only'
  };
}).sort((a, b) => a.donorAsset.localeCompare(b.donorAsset));

const catalog = {
  version: 1,
  generatedAt: new Date().toISOString(),
  lane: path.relative(root, giftsLane),
  totalTemplates: templates.length,
  templates
};

fs.writeFileSync(outPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ok: true, catalog: path.relative(root, outPath), totalTemplates: templates.length }, null, 2));
