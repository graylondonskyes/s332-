#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const productRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(productRoot, '../..');
const catalogPath = path.join(repoRoot, 'design-vault/library/templates/donor-backed-webcreator-templates.json');
const runtimePath = path.join(productRoot, 'js/donor-template-library.js');

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const runtime = fs.readFileSync(runtimePath, 'utf8');
globalThis.window = {};
await import(pathToFileURL(runtimePath).href);
const runtimeTemplates = globalThis.window.SkyeWebCreatorTemplates?.all || [];
const enabledTemplates = runtimeTemplates.filter((template) => template.enabledForGeneration !== false);

const checkedRefs = [];
const missingRefs = [];
const missingRuntimeIds = [];
const badEnabledTemplates = [];
const missingExportFiles = [];
const deadAnchors = [];
const missingHashTargets = [];

for (const template of catalog.templates) {
  if (!runtime.includes(template.id)) missingRuntimeIds.push(template.id);
  for (const ref of template.sourceRefs) {
    checkedRefs.push(ref);
    const absolute = path.join(repoRoot, ref);
    if (!fs.existsSync(absolute)) missingRefs.push(ref);
  }
}

for (const template of runtimeTemplates) {
  if (template.enabledForGeneration !== false && template.qualityTier !== 'house-standard') {
    badEnabledTemplates.push({ templateId: template.id, qualityTier: template.qualityTier || null });
  }
  if (template.enabledForGeneration !== false && template.exportPath) {
    for (const file of ['index.html', 'styles.css', 'app.js', 'README.md']) {
      const absolute = path.join(productRoot, template.exportPath.replace(/^\.\//, ''), file);
      if (!fs.existsSync(absolute)) missingExportFiles.push(path.relative(repoRoot, absolute));
    }
  }
  const html = template.files?.['index.html'] || '';
  if (!html) continue;
  const ids = new Set([...html.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]));
  const anchors = [...html.matchAll(/<a\b([^>]*)>/g)];
  for (const anchor of anchors) {
    const attrs = anchor[1];
    const href = attrs.match(/\shref=["']([^"']*)["']/)?.[1];
    if (!href) {
      deadAnchors.push({ templateId: template.id, anchor: anchor[0] });
      continue;
    }
    if (href.startsWith('#') && href.length > 1 && !ids.has(href.slice(1))) {
      missingHashTargets.push({ templateId: template.id, href });
    }
  }
}

const checks = {
  hasTemplates: catalog.templates.length >= 3,
  hasEnabledHouseTemplate: enabledTemplates.length >= 1,
  onlyHouseStandardCanGenerate: badEnabledTemplates.length === 0,
  enabledExportFilesExist: missingExportFiles.length === 0,
  allRuntimeIdsPresent: missingRuntimeIds.length === 0,
  allSourceRefsExist: missingRefs.length === 0,
  coversShadcn: checkedRefs.some((ref) => ref.includes('shadcn-ui')),
  coversTailGrids: checkedRefs.some((ref) => ref.includes('tailgrids')),
  coversR3F: checkedRefs.some((ref) => ref.includes('react-three-fiber')),
  coversDrei: checkedRefs.some((ref) => ref.includes('/drei/')),
  coversTriplex: checkedRefs.some((ref) => ref.includes('/triplex/')),
  noDeadAnchors: deadAnchors.length === 0,
  allHashTargetsExist: missingHashTargets.length === 0,
};

const result = {
  generatedAt: new Date().toISOString(),
  smoke: 'skyewebcreator-donor-templates',
  checkedRefCount: checkedRefs.length,
  missingRefs,
  missingRuntimeIds,
  badEnabledTemplates,
  missingExportFiles,
  deadAnchors,
  missingHashTargets,
  checks,
  passed: Object.values(checks).every(Boolean),
};

console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exit(1);
