#!/usr/bin/env node
import path from 'node:path';
import { repoRoot } from './repo-paths.mjs';
import { runQualityGate } from '../platform/seven-donor-platform/quality-gate-service.mjs';

function parseArgs(argv) {
  const result = { ids: [], failOnFindings: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--donor' || token === '--platform') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error(`${token} requires an id`);
      result.ids.push(value);
      i += 1;
    } else if (token === '--fail-on-findings') {
      result.failOnFindings = true;
    } else if (token === '--help') {
      result.help = true;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  return result;
}

function usage() {
  return [
    'SkyeHands Seven Donor Quality Gate',
    '',
    'Usage:',
    '  node scripts/seven-quality-gate-scan.mjs',
    '  node scripts/seven-quality-gate-scan.mjs --donor skye-quality-gate',
    '  node scripts/seven-quality-gate-scan.mjs --donor skye.ae.central --fail-on-findings',
    '',
    'Outputs:',
    '  .skyequanta/proofs/seven-donor-quality-gate/<run-id>/*.json',
    '  .skyequanta/proofs/seven-donor-quality-gate/<run-id>/*.md',
    '  .skyequanta/proofs/seven-donor-quality-gate/<run-id>/*.sarif.json',
    '  .skyequanta/proofs/seven-donor-quality-gate-latest.json'
  ].join('\n');
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }
  const { manifest, manifestPath, latestPath } = runQualityGate({ platformIds: args.ids });
  console.log(JSON.stringify({
    ok: true,
    runId: manifest.runId,
    scannedDonorCount: manifest.scannedDonorCount,
    totalFindings: manifest.totalFindings,
    manifest: path.relative(repoRoot(), manifestPath),
    latest: path.relative(repoRoot(), latestPath),
    results: manifest.results.map((result) => ({
      platformId: result.platformId,
      filesScanned: result.summary.filesScanned,
      totalFindings: result.summary.totalFindings,
      markdown: result.artifacts.markdown
    }))
  }, null, 2));
  if (args.failOnFindings && manifest.totalFindings > 0) process.exit(2);
} catch (error) {
  console.error(error.message || String(error));
  console.error(usage());
  process.exit(1);
}
