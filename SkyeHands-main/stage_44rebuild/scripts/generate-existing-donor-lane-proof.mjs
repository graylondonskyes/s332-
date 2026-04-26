#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(ROOT, '..', '..');

function findDirs(name) {
  const results = [];
  const skip = new Set(['node_modules', '.git', '.next', 'dist', 'build', '__pycache__']);
  function walk(dir, depth = 0) {
    if (depth > 6) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (skip.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.name === name) results.push(full);
      walk(full, depth + 1);
    }
  }
  walk(REPO_ROOT, 0);
  return results;
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function classifyTheia(dir) {
  const pkgPath = path.join(dir, 'package.json');
  const runtimeProof = readJson(path.join(dir, 'runtime-proof.json')) ?? {};
  const hasPkg = fs.existsSync(pkgPath);
  const pkg = hasPkg ? readJson(pkgPath) : null;
  const hasMonorepoName = pkg?.name === '@theia/monorepo';
  const flags = ['resolvedTheiaCli','backendLaunches','browserLaunches','workspaceOpens','fileSave','terminalCommand','previewOutput'];
  const fullRuntime = flags.every(f => runtimeProof[f] === true);
  const classification = fullRuntime ? 'fully-wired' : (hasMonorepoName ? 'existing-source' : 'metadata-only');
  return { classification, hasPkg, hasMonorepoName, runtimeProof, fullRuntime };
}

function classifyOpenHands(dir) {
  const pyproject = path.join(dir, 'pyproject.toml');
  const serverShim = path.join(dir, 'runtime', 'lib', 'server.mjs');
  const runtimeProof = readJson(path.join(dir, 'runtime-proof.json')) ?? {};
  const hasPyproject = fs.existsSync(pyproject);
  const hasServerShim = fs.existsSync(serverShim);
  const flags = ['packageImportable','serverLaunches','taskReceived','workspaceFileSeen','fileEditedOrGenerated','commandOrTestRun','resultReturnedToSkyeHands'];
  const fullRuntime = flags.every(f => runtimeProof[f] === true);
  let classification = 'metadata-only';
  if (hasServerShim && !fullRuntime) classification = 'runtime-shim';
  if (fullRuntime) classification = 'fully-wired';
  return { classification, hasPyproject, hasServerShim, runtimeProof, fullRuntime };
}

function formatFlags(runtimeProof, flags) {
  return flags.map(f => `- ${runtimeProof[f] === true ? '✅' : '☐'} \`${f}\``).join('\n');
}

function main() {
  const theiaDirs = findDirs('ide-core');
  const openHandsDirs = findDirs('agent-core');

  const theiaScan = theiaDirs.map(dir => ({ dir, ...classifyTheia(dir) }));
  const openScan = openHandsDirs.map(dir => ({ dir, ...classifyOpenHands(dir) }));

  const now = new Date().toISOString();
  let md = '# EXISTING DONOR LANE PROOF\n\n';
  md += `_Generated: ${now}_\n\n`;
  md += 'This file is generated from code inspection. It inventories existing Theia/OpenHands lanes and runtime proof status.\n\n';

  md += '## Theia lanes discovered\n\n';
  for (const lane of theiaScan) {
    md += `### ${path.relative(REPO_ROOT, lane.dir)}\n`;
    md += `- classification: \`${lane.classification}\`\n`;
    md += `- package.json present: ${lane.hasPkg ? '✅' : '☐'}\n`;
    md += `- @theia/monorepo identity proven: ${lane.hasMonorepoName ? '✅' : '☐'}\n`;
    md += `- fullTheiaRuntime: ${lane.fullRuntime ? '✅' : '☐'}\n`;
    md += `${formatFlags(lane.runtimeProof, ['resolvedTheiaCli','backendLaunches','browserLaunches','workspaceOpens','fileSave','terminalCommand','previewOutput'])}\n\n`;
  }

  md += '## OpenHands lanes discovered\n\n';
  for (const lane of openScan) {
    md += `### ${path.relative(REPO_ROOT, lane.dir)}\n`;
    md += `- classification: \`${lane.classification}\`\n`;
    md += `- pyproject.toml present: ${lane.hasPyproject ? '✅' : '☐'}\n`;
    md += `- boundary shim present: ${lane.hasServerShim ? '✅' : '☐'}\n`;
    md += `- fullOpenHandsRuntime: ${lane.fullRuntime ? '✅' : '☐'}\n`;
    md += `${formatFlags(lane.runtimeProof, ['packageImportable','serverLaunches','taskReceived','workspaceFileSeen','fileEditedOrGenerated','commandOrTestRun','resultReturnedToSkyeHands'])}\n\n`;
  }

  const output = path.join(ROOT, 'EXISTING_DONOR_LANE_PROOF.md');
  fs.writeFileSync(output, md);
  console.log(`Generated ${output}`);
}

main();
