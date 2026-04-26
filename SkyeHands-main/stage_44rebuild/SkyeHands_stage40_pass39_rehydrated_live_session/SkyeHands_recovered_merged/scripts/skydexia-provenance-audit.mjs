#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const catalogPath = path.join(root, 'skydexia', 'templates', 'donor-template-catalog.json');
const ledgerDir = path.join(root, 'skydexia', 'provenance');
const ledgerPath = path.join(ledgerDir, 'donor-provenance-ledger.json');

if (!fs.existsSync(catalogPath)) {
  console.error('Template catalog missing. Run scripts/skydexia-donor-index.mjs first.');
  process.exit(1);
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const required = ['source', 'sourceChecksum', 'importedAt', 'compatibility'];
const entries = catalog.templates.map((template) => {
  const provenance = template.provenance || {};
  const coverage = {
    source: Boolean(provenance.source),
    sourceChecksum: Boolean(template.sourceChecksum),
    importedAt: Boolean(template.importedAt),
    compatibility: Array.isArray(provenance.compatibility) && provenance.compatibility.length > 0
  };
  return {
    templateId: template.templateId,
    donorAsset: template.donorAsset,
    metadataAsset: template.metadataAsset,
    coverage,
    complete: Object.values(coverage).every(Boolean)
  };
});

const missing = entries.filter((item) => !item.complete);
const ledger = {
  version: 1,
  required,
  generatedAt: new Date().toISOString(),
  totalTemplates: entries.length,
  completeTemplates: entries.length - missing.length,
  entries,
  missing
};

fs.mkdirSync(ledgerDir, { recursive: true });
fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ok: missing.length === 0, ledger: path.relative(root, ledgerPath), totalTemplates: entries.length, missingTemplates: missing.length }, null, 2));
if (missing.length > 0) process.exit(1);
