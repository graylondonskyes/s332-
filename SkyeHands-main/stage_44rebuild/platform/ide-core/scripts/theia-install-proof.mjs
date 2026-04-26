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

function readProof() {
  try { return JSON.parse(fs.readFileSync(PROOF_FILE, 'utf8')); } catch { return {}; }
}

function writeProof(patch) {
  const current = readProof();
  const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
  fs.writeFileSync(PROOF_FILE, JSON.stringify(updated, null, 2));
  return updated;
}

function tryResolveTheiaCli() {
  // Try 1: local node_modules .bin
  const localBin = path.join(IDE_ROOT, 'node_modules', '.bin', 'theia');
  if (fs.existsSync(localBin)) return localBin;

  // Try 2: yarn workspaces bin
  const result = spawnSync('yarn', ['bin', 'theia'], {
    cwd: IDE_ROOT, encoding: 'utf8', shell: true,
  });
  if (result.status === 0 && result.stdout.trim()) {
    const candidate = result.stdout.trim();
    if (fs.existsSync(candidate)) return candidate;
  }

  // Try 3: npx theia --version
  const npxResult = spawnSync('npx', ['--no-install', 'theia', '--version'], {
    cwd: IDE_ROOT, encoding: 'utf8', shell: true, timeout: 10000,
  });
  if (npxResult.status === 0) return 'npx theia';

  return null;
}

function checkPackageJson() {
  const pkgPath = path.join(IDE_ROOT, 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return { exists: true, name: pkg.name, version: pkg.version };
  } catch {
    return { exists: false };
  }
}

function checkNodeModules() {
  const nm = path.join(IDE_ROOT, 'node_modules');
  if (!fs.existsSync(nm)) return { exists: false };
  const entries = fs.readdirSync(nm);
  const theiaPackages = entries.filter(e => e.startsWith('@theia'));
  return { exists: true, count: entries.length, theiaPackages };
}

async function main() {
  console.log('Theia Install Proof — platform/ide-core\n');

  const pkg = checkPackageJson();
  const nodeModules = checkNodeModules();
  const resolvedCli = tryResolveTheiaCli();

  const result = {
    packageJsonExists: pkg.exists,
    packageName: pkg.name ?? null,
    nodeModulesExists: nodeModules.exists,
    theiaPackagesFound: nodeModules.theiaPackages ?? [],
    resolvedTheiaCli: resolvedCli,
    installProvenAt: new Date().toISOString(),
  };

  console.log('package.json:', pkg.exists ? `${pkg.name}@${pkg.version}` : 'NOT FOUND');
  console.log('node_modules:', nodeModules.exists ? `${nodeModules.count} entries, Theia packages: ${(nodeModules.theiaPackages ?? []).length}` : 'NOT FOUND');
  console.log('Resolved Theia CLI:', resolvedCli ?? 'NULL — run: cd platform/ide-core && yarn install');
  console.log();

  const proof = writeProof(result);

  if (!resolvedCli) {
    console.warn('WARNING: resolvedTheiaCli is null.');
    console.warn('Action required: cd platform/ide-core && yarn install');
    console.warn('Then re-run this script to update the proof file.');
    process.exit(1);
  }

  console.log('Theia install proof written to:', PROOF_FILE);
  console.log('Next step: run theia-smoke.mjs to prove all 7 runtime flags.');
}

main().catch(err => { console.error(err); process.exit(1); });
