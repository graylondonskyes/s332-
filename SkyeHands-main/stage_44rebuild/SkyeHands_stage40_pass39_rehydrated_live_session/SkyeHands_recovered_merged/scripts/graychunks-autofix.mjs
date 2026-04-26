#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGrayChunksConfig, resolveSafeTargetDir } from './graychunks-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targetArg = process.argv.find((arg) => arg.startsWith('--target='));
let targetDir = root;
try {
  targetDir = resolveSafeTargetDir(root, targetArg ? targetArg.slice('--target='.length) : '', { enforceWithinRoot: false });
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', error: 'invalid_target', detail: String(error?.message || error) }, null, 2));
  process.exit(1);
}
const reportPath = path.join(root, 'skydexia', 'alerts', 'graychunks-autofix.json');
const config = loadGrayChunksConfig(root);

const extensions = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.json']);
const ignored = new Set(config.ignoreSegments || []);

function shouldSkipPath(fullPath) {
  const parts = fullPath.split(path.sep);
  return parts.some((part) => ignored.has(part));
}

function listFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (shouldSkipPath(full)) continue;
    if (entry.isDirectory()) {
      out.push(...listFiles(full));
      continue;
    }
    if (extensions.has(path.extname(full))) out.push(full);
  }
  return out;
}

function dedupeImports(content) {
  const lines = content.split(/\r?\n/);
  const seen = new Set();
  let removed = 0;
  const next = lines.filter((line) => {
    const normalized = line.trim().replace(/\s+/g, ' ');
    if (!normalized.startsWith('import ')) return true;
    if (seen.has(normalized)) {
      removed += 1;
      return false;
    }
    seen.add(normalized);
    return true;
  });
  return { content: next.join('\n'), removed };
}

function dedupeJsonKeys(content) {
  const lines = content.split(/\r?\n/);
  const keyRegex = /^\s*"([^"\\]+)"\s*:/;
  const keyStack = [];
  let removed = 0;

  const next = lines.filter((line) => {
    for (const _ of line.match(/\{/g) || []) keyStack.push(new Set());

    let keep = true;
    const match = line.match(keyRegex);
    if (match && keyStack.length) {
      const key = match[1];
      const keys = keyStack[keyStack.length - 1];
      if (keys.has(key)) {
        removed += 1;
        keep = false;
      } else {
        keys.add(key);
      }
    }

    for (const _ of line.match(/\}/g) || []) keyStack.pop();
    return keep;
  });

  return { content: next.join('\n'), removed };
}

const fileResults = [];
let totalRemovedImports = 0;
let totalRemovedJsonKeys = 0;

for (const filePath of listFiles(targetDir)) {
  const ext = path.extname(filePath).toLowerCase();
  const original = fs.readFileSync(filePath, 'utf8');
  let transformed = original;
  let removedDuplicateImports = 0;
  let removedDuplicateJsonKeys = 0;

  if (['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx'].includes(ext)) {
    const fixed = dedupeImports(transformed);
    transformed = fixed.content;
    removedDuplicateImports = fixed.removed;
  }

  if (ext === '.json') {
    const fixedJson = dedupeJsonKeys(transformed);
    transformed = fixedJson.content;
    removedDuplicateJsonKeys = fixedJson.removed;
  }

  if (removedDuplicateImports > 0 || removedDuplicateJsonKeys > 0) {
    fs.writeFileSync(filePath, transformed, 'utf8');
    const relative = path.relative(root, filePath).replace(/\\/g, '/');
    fileResults.push({ file: relative, removedDuplicateImports, removedDuplicateJsonKeys });
    totalRemovedImports += removedDuplicateImports;
    totalRemovedJsonKeys += removedDuplicateJsonKeys;
  }
}

const payload = {
  generatedAt: new Date().toISOString(),
  targetDir: path.relative(root, targetDir).replace(/\\/g, '/'),
  filesChanged: fileResults.length,
  removedDuplicateImports: totalRemovedImports,
  removedDuplicateJsonKeys: totalRemovedJsonKeys,
  fileResults
};

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: 'PASS', ...payload, report: path.relative(root, reportPath).replace(/\\/g, '/') }, null, 2));
