#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from './repo-paths.mjs';
import { runQualityGate, writeInventoryProof, PROOFS_DIR } from '../platform/seven-donor-platform/quality-gate-service.mjs';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

const startedAt = new Date().toISOString();
const inventory = writeInventoryProof();
const qualityGate = runQualityGate();
const missingArtifacts = [];

for (const result of qualityGate.manifest.results) {
  for (const artifactPath of Object.values(result.artifacts)) {
    const absolute = path.join(repoRoot(), artifactPath);
    if (!fs.existsSync(absolute)) missingArtifacts.push(artifactPath);
  }
}

const smoke = {
  proofType: 'skye-forge-max-smoke',
  startedAt,
  completedAt: new Date().toISOString(),
  ok: inventory.proof.missingDonorCount === 0 && missingArtifacts.length === 0,
  inventory: {
    donorCount: inventory.proof.donorCount,
    missingDonorCount: inventory.proof.missingDonorCount,
    artifact: path.relative(repoRoot(), inventory.outputPath)
  },
  qualityGate: {
    runId: qualityGate.manifest.runId,
    scannedDonorCount: qualityGate.manifest.scannedDonorCount,
    totalFindings: qualityGate.manifest.totalFindings,
    manifest: path.relative(repoRoot(), qualityGate.manifestPath),
    latest: path.relative(repoRoot(), qualityGate.latestPath)
  },
  missingArtifacts
};

const outputPath = path.join(PROOFS_DIR, 'skye-forge-max-smoke.json');
writeJson(outputPath, smoke);
console.log(JSON.stringify({
  ok: smoke.ok,
  output: path.relative(repoRoot(), outputPath),
  scannedDonorCount: smoke.qualityGate.scannedDonorCount,
  totalFindings: smoke.qualityGate.totalFindings,
  missingArtifacts: smoke.missingArtifacts.length
}, null, 2));

if (!smoke.ok) process.exit(1);
