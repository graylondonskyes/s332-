#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const catalogPath = path.join(root, 'skydexia', 'templates', 'donor-template-catalog.json');

if (!fs.existsSync(catalogPath)) {
  console.error('Template catalog missing. Run scripts/skydexia-donor-index.mjs first.');
  process.exit(1);
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

function scoreTemplate(template) {
  let score = 0.4;
  if (template.sourceChecksum && template.sourceChecksum.length >= 32) score += 0.2;
  if (template.provenance?.source) score += 0.1;
  if (Array.isArray(template.provenance?.compatibility) && template.provenance.compatibility.length > 0) score += 0.1;
  if (template.runtimeHint?.runtime && template.runtimeHint.runtime !== 'agnostic') score += 0.1;
  if (template.extractionPolicy === 'validated-only') score += 0.1;
  return Math.min(1, Number(score.toFixed(2)));
}

for (const template of catalog.templates) {
  const score = scoreTemplate(template);
  template.qualityScore = score;
  template.smokeable = score >= 0.7;
}

catalog.generatedAt = new Date().toISOString();
fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ok: true, catalog: path.relative(root, catalogPath), smokeableTemplates: catalog.templates.filter((t) => t.smokeable).length }, null, 2));
