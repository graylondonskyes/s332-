#!/usr/bin/env node
import path from 'node:path';
import { repoRoot } from './repo-paths.mjs';
import { runSevenPlatformE2E } from '../platform/seven-donor-platform/seven-platform-runtime.mjs';

const result = runSevenPlatformE2E({ reset: true });

console.log(JSON.stringify({
  ok: result.proof.ok,
  productName: result.proof.brand.productName,
  tagline: result.proof.brand.tagline,
  workspaceId: result.proof.workspaceId,
  flow: result.proof.flow,
  liveVarStatus: result.proof.liveVarStatus,
  qualitySummary: result.proof.qualitySummary,
  valuationSummary: result.proof.valuationSummary,
  proofPath: path.relative(repoRoot(), result.proofPath)
}, null, 2));

if (!result.proof.ok) process.exit(1);
