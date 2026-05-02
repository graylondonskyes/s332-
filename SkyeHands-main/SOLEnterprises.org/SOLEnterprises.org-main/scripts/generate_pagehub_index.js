#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'data');
const OUT_FILE = path.join(OUT_DIR, 'pages.json');

const SKIP_DIRS = new Set(['.git', 'node_modules', 'netlify', 'functions', 'contact_api', '.next', '.venv']);
const HTML_EXTS = new Set(['.html', '.htm']);

function shouldSkipDir(name) {
  if (SKIP_DIRS.has(name)) return true;
  if (name.startsWith('.') && name !== '.well-known') return true;
  return false;
}

function titleCase(value) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function readTitle(file) {
  try {
    const txt = fs.readFileSync(file, 'utf8');
    const m = txt.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (m && m[1]) return m[1].trim();
  } catch (e) {}
  return null;
}

function walk(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (shouldSkipDir(ent.name)) continue;
      results.push(...walk(full));
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase();
      if (!HTML_EXTS.has(ext)) continue;
      const rel = path.relative(ROOT, full).split(path.sep).join('/');
      if (rel === 'Pages/PageHub.html') continue;
      const title = readTitle(full) || titleCase(path.basename(rel));
      const parts = rel.split('/').filter(Boolean);
      const category = parts.length > 1 ? parts[0] : 'Root';
      results.push({ path: rel, category, title });
    }
  }
  return results;
}

function writeOut(data) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function main() {
  const items = walk(ROOT);
  // stable sort
  items.sort((a, b) => (a.category === b.category ? a.path.localeCompare(b.path) : a.category.localeCompare(b.category)));
  writeOut(items);
  console.log('Wrote', OUT_FILE, 'with', items.length, 'entries');
}

if (require.main === module) main();
