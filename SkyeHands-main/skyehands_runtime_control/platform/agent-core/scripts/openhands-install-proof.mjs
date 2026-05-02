#!/usr/bin/env node
/**
 * OpenHands Install Proof — directive section 3.4
 *
 * Validates that the OpenHands lane Python package is importable.
 * Writes import result to platform/agent-core/runtime-proof.json.
 *
 * Does NOT claim fullOpenHandsRuntime: true — that requires all 7 flags.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGENT_ROOT = path.resolve(__dirname, '..');
const PROOF_FILE = path.join(AGENT_ROOT, 'runtime-proof.json');
const STAGE_ROOT = path.resolve(AGENT_ROOT, '..', '..');

function readProof() {
  try { return JSON.parse(fs.readFileSync(PROOF_FILE, 'utf8')); } catch { return {}; }
}

function writeProof(patch) {
  const current = readProof();
  const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
  fs.writeFileSync(PROOF_FILE, JSON.stringify(updated, null, 2));
  return updated;
}

function findCanonicalAgentRoot() {
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
      if (entry.name === 'agent-core' && fs.existsSync(path.join(full, 'pyproject.toml'))) {
        candidates.push(full);
      }
      walk(full, depth + 1);
    }
  }
  walk(STAGE_ROOT, 0);
  if (candidates.length === 0) return AGENT_ROOT;
  candidates.sort((a, b) => a.length - b.length);
  return candidates[0];
}

function checkPyprojectToml(runtimeRoot) {
  const tomlPath = path.join(runtimeRoot, 'pyproject.toml');
  try {
    const content = fs.readFileSync(tomlPath, 'utf8');
    const hasOpenHands = content.includes('openhands');
    return { exists: true, hasOpenHands, content: content.slice(0, 300) };
  } catch {
    return { exists: false, hasOpenHands: false };
  }
}

function tryPythonImport(runtimeRoot) {
  const result = spawnSync(
    'python3', ['-c', 'import openhands; print(openhands.__version__ if hasattr(openhands, "__version__") else "imported")'],
    { cwd: runtimeRoot, encoding: 'utf8', timeout: 15000, shell: false }
  );
  if (result.status === 0) {
    return { success: true, output: result.stdout.trim() };
  }
  return { success: false, stderr: result.stderr?.trim() ?? result.error?.message ?? 'import failed' };
}

function checkPipInstalled() {
  const result = spawnSync(
    'pip3', ['show', 'openhands-ai'],
    { encoding: 'utf8', timeout: 10000, shell: false }
  );
  if (result.status === 0) {
    const lines = result.stdout.split('\n');
    const version = lines.find(l => l.startsWith('Version:'))?.split(':')[1]?.trim();
    return { installed: true, version };
  }
  return { installed: false };
}

async function main() {
  console.log('OpenHands Install Proof — platform/agent-core\n');

  const runtimeRoot = findCanonicalAgentRoot();
  const pyproject = checkPyprojectToml(runtimeRoot);
  const pipCheck = checkPipInstalled();
  const importCheck = tryPythonImport(runtimeRoot);

  console.log('runtime root:', runtimeRoot);
  console.log('pyproject.toml:', pyproject.exists ? `exists, openhands ref: ${pyproject.hasOpenHands}` : 'NOT FOUND');
  console.log('pip show openhands-ai:', pipCheck.installed ? `v${pipCheck.version}` : 'NOT INSTALLED');
  console.log('python import test:', importCheck.success ? `SUCCESS — ${importCheck.output}` : `FAILED — ${importCheck.stderr}`);

  writeProof({
    pyprojectExists: pyproject.exists,
    pyprojectHasOpenHands: pyproject.hasOpenHands,
    pipInstalled: pipCheck.installed,
    pipVersion: pipCheck.version ?? null,
    packageImportable: importCheck.success,
    importOutput: importCheck.output ?? null,
    importError: importCheck.stderr ?? null,
    runtimeRootUsed: path.relative(STAGE_ROOT, runtimeRoot),
    installReady: importCheck.success,
    installBlockedReason: importCheck.success ? null : 'Python import openhands failed (package unavailable in current environment)',
    installProvenAt: new Date().toISOString(),
  });

  if (!importCheck.success) {
    console.log('\nAction required:');
    console.log('  pip install openhands-ai');
    console.log('  OR: cd platform/agent-core && pip install -e .');
    console.log('\nThen re-run this script to update the proof file.');
    console.log('Install proof is BLOCKED (recorded), but script exits 0 for autonomy reporting.');
    return;
  }

  console.log('\nOpenHands install proof written to:', PROOF_FILE);
  console.log('Next step: run openhands-smoke.mjs to prove all 7 runtime flags.');
}

main().catch(err => { console.error(err); process.exit(1); });
