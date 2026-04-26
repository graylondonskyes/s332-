#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const skipDirs = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'coverage', '.cache', '.turbo']);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function* walk(dir, depth = 0) {
  if (depth > 7) return;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    yield full;
    yield* walk(full, depth + 1);
  }
}

export function findRecoveredAppRoot(startDir = repoRoot) {
  const candidates = [startDir, ...walk(startDir)];
  for (const dir of candidates) {
    const packagePath = path.join(dir, 'package.json');
    const cliPath = path.join(dir, 'skyequanta.mjs');
    if (!fs.existsSync(packagePath) || !fs.existsSync(cliPath)) continue;
    const pkg = readJson(packagePath);
    if (pkg?.name === 'skyequantacore-thehybrid-autonomouside') return dir;
    if (pkg?.scripts?.doctor && pkg?.scripts?.['operator:start'] && pkg?.scripts?.['graychunks:scan']) return dir;
  }
  return null;
}

export function requireRecoveredAppRoot() {
  const root = findRecoveredAppRoot();
  if (!root) {
    throw new Error('Recovered SkyeHands app root was not found. Expected package.json plus skyequanta.mjs in the recovered app tree.');
  }
  return root;
}

if (process.argv.includes('--print')) {
  const appRoot = requireRecoveredAppRoot();
  console.log(path.relative(repoRoot, appRoot) || '.');
}
