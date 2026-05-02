#!/usr/bin/env node
import path from 'node:path';
import { repoRoot } from './repo-paths.mjs';
import { writeInventoryProof } from '../platform/seven-donor-platform/quality-gate-service.mjs';

const { proof, outputPath } = writeInventoryProof();

console.log(JSON.stringify({
  ok: proof.missingDonorCount === 0,
  donorCount: proof.donorCount,
  missingDonorCount: proof.missingDonorCount,
  output: path.relative(repoRoot(), outputPath)
}, null, 2));

if (proof.missingDonorCount > 0) process.exit(1);
