#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const catalogPath = path.join(root, 'skydexia', 'templates', 'donor-template-catalog.json');
const outRoot = path.join(root, 'skydexia', 'extracted-templates');

if (!fs.existsSync(catalogPath)) {
  console.error('Template catalog missing. Run donor indexing first.');
  process.exit(1);
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
fs.mkdirSync(outRoot, { recursive: true });

const extracted = [];
for (const template of catalog.templates) {
  const eligible = template.smokeable === true && template.extractionPolicy === 'validated-only' && Number(template.qualityScore || 0) >= 0.7;
  if (!eligible) continue;

  const src = path.join(root, template.donorAsset);
  if (!fs.existsSync(src)) continue;

  const targetDir = path.join(outRoot, template.templateId);
  fs.mkdirSync(targetDir, { recursive: true });
  const targetFile = path.join(targetDir, path.basename(src));
  fs.copyFileSync(src, targetFile);
  fs.writeFileSync(path.join(targetDir, 'extraction-manifest.json'), `${JSON.stringify({
    templateId: template.templateId,
    source: template.donorAsset,
    qualityScore: template.qualityScore,
    extractionPolicy: template.extractionPolicy,
    extractedAt: new Date().toISOString()
  }, null, 2)}\n`, 'utf8');
  extracted.push({ templateId: template.templateId, target: path.relative(root, targetDir) });
}

const reportPath = path.join(outRoot, 'safe-extraction-report.json');
fs.writeFileSync(reportPath, `${JSON.stringify({ version: 1, extractedCount: extracted.length, extracted }, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ok: true, extractedCount: extracted.length, report: path.relative(root, reportPath) }, null, 2));
