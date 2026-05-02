#!/usr/bin/env node
/**
 * Theia Install Proof — directive section 3.4
 *
 * Validates that the Theia lane install is real, not just a package.json claim.
 * Writes resolved CLI path (or null) to platform/ide-core/runtime-proof.json.
 *
 * This script does NOT claim fullTheiaRuntime: true.
 * That requires all 7 proof flags — see theia-smoke.mjs.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IDE_ROOT = path.resolve(__dirname, '..');
const PROOF_FILE = path.join(IDE_ROOT, 'runtime-proof.json');
const STAGE_ROOT = path.resolve(IDE_ROOT, '..', '..');

function readProof() {
  try { return JSON.parse(fs.readFileSync(PROOF_FILE, 'utf8')); } catch { return {}; }
}

function writeProof(patch) {
  const current = readProof();
  const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
  fs.writeFileSync(PROOF_FILE, JSON.stringify(updated, null, 2));
  return updated;
}

function findCanonicalIdeRoot() {
  const candidates = [];
  const skip = new Set(['node_modules', '.git', '.next', 'build', 'dist', '__pycache__']);
  function walk(dir, depth = 0) {
    if (depth > 6) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (skip.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.name === 'ide-core' && fs.existsSync(path.join(full, 'package.json'))) {
        candidates.push(full);
      }
      walk(full, depth + 1);
    }
  }
  walk(STAGE_ROOT, 0);
  if (candidates.length === 0) return IDE_ROOT;
  candidates.sort((a, b) => a.length - b.length);
  return candidates[0];
}

function tryResolveTheiaCli(runtimeRoot) {
  // Try 1: local node_modules .bin
  const localBin = path.join(runtimeRoot, 'node_modules', '.bin', 'theia');
  if (fs.existsSync(localBin)) return localBin;

  // Try 2: yarn workspaces bin
  const result = spawnSync('yarn', ['bin', 'theia'], {
    cwd: runtimeRoot, encoding: 'utf8', shell: true,
  });
  if (result.status === 0 && result.stdout.trim()) {
    const candidate = result.stdout.trim();
    if (fs.existsSync(candidate)) return candidate;
  }

  // Try 3: npx theia --version
  const npxResult = spawnSync('npx', ['--no-install', 'theia', '--version'], {
    cwd: runtimeRoot, encoding: 'utf8', shell: true, timeout: 10000,
  });
  if (npxResult.status === 0) return 'npx theia';

  return null;
}

function checkPackageJson(runtimeRoot) {
  const pkgPath = path.join(runtimeRoot, 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return { exists: true, name: pkg.name, version: pkg.version };
  } catch {
    return { exists: false };
  }
}

function checkNodeModules(runtimeRoot) {
  const nm = path.join(runtimeRoot, 'node_modules');
  if (!fs.existsSync(nm)) return { exists: false };
  const entries = fs.readdirSync(nm);
  const theiaPackages = entries.filter(e => e.startsWith('@theia'));
  return { exists: true, count: entries.length, theiaPackages };
}

async function main() {
  console.log('Theia Install Proof — platform/ide-core\n');

  const runtimeRoot = findCanonicalIdeRoot();
  const pkg = checkPackageJson(runtimeRoot);
  const nodeModules = checkNodeModules(runtimeRoot);
  const resolvedCli = tryResolveTheiaCli(runtimeRoot);

  const result = {
    packageJsonExists: pkg.exists,
    packageName: pkg.name ?? null,
    nodeModulesExists: nodeModules.exists,
    theiaPackagesFound: nodeModules.theiaPackages ?? [],
    resolvedTheiaCli: resolvedCli,
    runtimeRootUsed: path.relative(STAGE_ROOT, runtimeRoot),
    installReady: Boolean(resolvedCli),
    installBlockedReason: resolvedCli ? null : 'resolvedTheiaCli is null (dependencies/CLI not installed)',
    installProvenAt: new Date().toISOString(),
  };

  console.log('runtime root:', runtimeRoot);
  console.log('package.json:', pkg.exists ? `${pkg.name}@${pkg.version}` : 'NOT FOUND');
  console.log('node_modules:', nodeModules.exists ? `${nodeModules.count} entries, Theia packages: ${(nodeModules.theiaPackages ?? []).length}` : 'NOT FOUND');
  console.log('Resolved Theia CLI:', resolvedCli ?? 'NULL — run: cd platform/ide-core && yarn install');
  console.log();

  const proof = writeProof(result);

  if (!resolvedCli) {
    console.warn('WARNING: resolvedTheiaCli is null.');
    console.warn('Action required: cd platform/ide-core && yarn install');
    console.warn('Then re-run this script to update the proof file.');
    console.warn('Install proof is BLOCKED (recorded), but script exits 0 for autonomy reporting.');
    return;
  }

  console.log('Theia install proof written to:', PROOF_FILE);
  console.log('Next step: run theia-smoke.mjs to prove all 7 runtime flags.');
}

main().catch(err => { console.error(err); process.exit(1); });
