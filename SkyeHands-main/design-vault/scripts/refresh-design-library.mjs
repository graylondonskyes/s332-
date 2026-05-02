#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const vaultRoot = path.resolve(__dirname, '..');
const sourcesRoot = path.join(vaultRoot, 'sources');
const catalogRoot = path.join(vaultRoot, 'library', 'catalog');

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function listFiles(root, predicate, limit = 500) {
  const out = [];
  const stack = [root];
  while (stack.length && out.length < limit) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist') continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (predicate(full)) {
        out.push(path.relative(vaultRoot, full));
      }
    }
  }
  return out.sort();
}

function listDirs(root, maxDepth = 2) {
  const out = [];
  function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist') continue;
      const full = path.join(dir, entry.name);
      out.push(path.relative(vaultRoot, full));
      walk(full, depth + 1);
    }
  }
  walk(root, 1);
  return out.sort();
}

function sourceRecord(sourceName) {
  const root = path.join(sourcesRoot, sourceName);
  const pkg = readJson(path.join(root, 'package.json'), {});
  const dirs = listDirs(root, 2);
  const docs = listFiles(root, (file) => /\.(md|mdx)$/i.test(file), 300);
  const examples = listFiles(root, (file) => /examples?|sandboxes?|templates?|registry|demos?/i.test(file) && /\.(tsx|jsx|ts|js|mdx|json)$/i.test(file), 300);
  const licenses = listFiles(root, (file) => /(^|\/)licen[sc]e/i.test(file), 20);

  return {
    id: sourceName,
    root: `sources/${sourceName}`,
    package: {
      name: pkg.name || null,
      version: pkg.version || null,
      license: pkg.license || null,
      description: pkg.description || null,
      workspaces: pkg.workspaces || pkg.pnpm?.packages || null,
      scripts: Object.keys(pkg.scripts || {}).sort(),
    },
    topLevelDirectories: dirs.filter((dir) => dir.split(path.sep).length <= 3).slice(0, 80),
    docs: docs.slice(0, 120),
    examples: examples.slice(0, 120),
    licenseFiles: licenses,
  };
}

const sourceNames = fs.existsSync(sourcesRoot)
  ? fs.readdirSync(sourcesRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== 'sources')
      .map((entry) => entry.name)
      .sort()
  : [];

const catalog = {
  version: 1,
  generatedAt: new Date().toISOString(),
  vaultRoot: 'design-vault',
  sourceCount: sourceNames.length,
  sources: sourceNames.map(sourceRecord),
};

fs.mkdirSync(catalogRoot, { recursive: true });
fs.writeFileSync(path.join(catalogRoot, 'source-index.json'), JSON.stringify(catalog, null, 2));

const summary = [
  '# Design Vault Source Index',
  '',
  `Generated: ${catalog.generatedAt}`,
  '',
  '| Source | Package | License | Best For |',
  '| --- | --- | --- | --- |',
  ...catalog.sources.map((source) => {
    const bestFor = {
      'react-three-fiber': 'React Three.js scene architecture, Canvas, hooks, events, model loading examples',
      drei: 'R3F helpers, staging, controls, loaders, shaders, performance, HTML overlays',
      triplex: 'Visual R3F authoring, 3D editor workflows, example scenes, VS Code/electron ideas',
      'shadcn-ui': 'Accessible app components, templates, blocks, charts, forms, command menus',
      tailgrids: 'Tailwind UI registry, docs, core components, landing/app sections, icons',
    }[source.id] || 'General design reference';
    return `| \`${source.id}\` | \`${source.package.name || 'unknown'}\` | \`${source.package.license || 'check repo'}\` | ${bestFor} |`;
  }),
  '',
  'Machine-readable index: `design-vault/library/catalog/source-index.json`',
  '',
].join('\n');

fs.writeFileSync(path.join(catalogRoot, 'SOURCE_INDEX.md'), summary);

function filesIn(relativeRoot, matcher) {
  const root = path.join(vaultRoot, relativeRoot);
  if (!fs.existsSync(root)) return [];
  return listFiles(root, matcher, 1000);
}

function itemFromFile(filePath, source, kind, tags = []) {
  const base = path.basename(filePath).replace(/\.(tsx|ts|jsx|js|mdx|json)$/i, '');
  return {
    id: `${source}.${base}`,
    label: base,
    source,
    kind,
    path: filePath,
    tags,
  };
}

const patterns = [
  ...filesIn('sources/drei/src/core', (file) => /\.(tsx|ts)$/i.test(file))
    .map((file) => itemFromFile(file, 'drei', 'r3f-helper', ['3d', 'r3f', 'drei'])),
  ...filesIn('sources/drei/src/web', (file) => /\.(tsx|ts)$/i.test(file))
    .map((file) => itemFromFile(file, 'drei', 'r3f-web-helper', ['3d', 'r3f', 'web', 'controls'])),
  ...filesIn('sources/drei/docs', (file) => /\.mdx$/i.test(file))
    .map((file) => itemFromFile(file, 'drei', 'r3f-doc', ['3d', 'docs'])),
  ...filesIn('sources/react-three-fiber/example/src/demos', (file) => /\.tsx$/i.test(file))
    .map((file) => itemFromFile(file, 'react-three-fiber', 'r3f-demo', ['3d', 'r3f', 'demo'])),
  ...filesIn('sources/react-three-fiber/docs', (file) => /\.mdx$/i.test(file))
    .map((file) => itemFromFile(file, 'react-three-fiber', 'r3f-doc', ['3d', 'r3f', 'docs'])),
  ...filesIn('sources/shadcn-ui/apps/v4/examples/base', (file) => /\.tsx$/i.test(file))
    .map((file) => itemFromFile(file, 'shadcn-ui', 'ui-example', ['ui', 'component', 'app'])),
  ...filesIn('sources/shadcn-ui/templates', (file) => /package\.json$/i.test(file))
    .map((file) => itemFromFile(file, 'shadcn-ui', 'app-template', ['template', 'app', 'ui'])),
  ...filesIn('sources/tailgrids/apps/docs/src/registry/core', (file) => /\.tsx$/i.test(file))
    .map((file) => itemFromFile(file, 'tailgrids', 'ui-registry-component', ['ui', 'tailwind', 'component'])),
  ...filesIn('sources/tailgrids/apps/docs/content/components', (file) => /\.mdx$/i.test(file))
    .map((file) => itemFromFile(file, 'tailgrids', 'ui-doc', ['ui', 'tailwind', 'docs'])),
  ...listDirs(path.join(vaultRoot, 'sources/triplex/examples'), 1)
    .map((dir) => ({
      id: `triplex.${path.basename(dir)}`,
      label: path.basename(dir),
      source: 'triplex',
      kind: 'visual-3d-example',
      path: dir,
      tags: ['3d', 'visual-authoring', 'example'],
    })),
].sort((a, b) => a.id.localeCompare(b.id));

const patternIndex = {
  version: 1,
  generatedAt: catalog.generatedAt,
  patternCount: patterns.length,
  patterns,
};

fs.writeFileSync(path.join(catalogRoot, 'pattern-index.json'), JSON.stringify(patternIndex, null, 2));

const bySource = patterns.reduce((acc, pattern) => {
  acc[pattern.source] = (acc[pattern.source] || 0) + 1;
  return acc;
}, {});

const patternSummary = [
  '# Design Vault Pattern Index',
  '',
  `Generated: ${catalog.generatedAt}`,
  '',
  `Pattern count: ${patterns.length}`,
  '',
  '| Source | Indexed Patterns |',
  '| --- | ---: |',
  ...Object.entries(bySource).sort(([a], [b]) => a.localeCompare(b)).map(([source, count]) => `| \`${source}\` | ${count} |`),
  '',
  'Machine-readable index: `design-vault/library/catalog/pattern-index.json`',
  '',
  'Common searches: `sidebar`, `table`, `chart`, `command`, `Canvas`, `Gltf`, `Stage`, `Environment`, `TransformControls`, `ScrollControls`, `shader`, `template`.',
  '',
].join('\n');

fs.writeFileSync(path.join(catalogRoot, 'PATTERN_INDEX.md'), patternSummary);

console.log(JSON.stringify({
  ok: true,
  sourceCount: catalog.sourceCount,
  patternCount: patternIndex.patternCount,
  generated: [
    'design-vault/library/catalog/source-index.json',
    'design-vault/library/catalog/SOURCE_INDEX.md',
    'design-vault/library/catalog/pattern-index.json',
    'design-vault/library/catalog/PATTERN_INDEX.md',
  ],
}, null, 2));
