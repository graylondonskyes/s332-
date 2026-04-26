#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig } from './config.mjs';
import { forkReplaySession, appendReplayEvent, createReplayCheckpoint, exportReplayBundle } from '../lib/skye-replay.mjs';

const config = getStackConfig();
const json = process.argv.includes('--json');
const outputDir = path.join(config.rootDir, 'dist', 'section47', 'replay-cli-fork');
const sourceArgIndex = process.argv.findIndex(item => item === '--file');
const orderArgIndex = process.argv.findIndex(item => item === '--order');
const sourceFile = sourceArgIndex >= 0 ? process.argv[sourceArgIndex + 1] : path.join(config.rootDir, 'dist', 'section47', 'replay-proof', 'replay-bundle.json');
const order = orderArgIndex >= 0 ? Number.parseInt(String(process.argv[orderArgIndex + 1] || ''), 10) : 5;
fs.rmSync(outputDir, { recursive: true, force: true });
const fork = forkReplaySession(sourceFile, order, {
  runId: 'section47-cli-fork',
  policyMode: 'strict-security',
  budgetMode: 'fastest-fix-under-budget'
});
appendReplayEvent(fork, 'file-write', { filePath: 'src/app.js', content: 'export const answer = 43;\n', reason: 'fork divergence' });
appendReplayEvent(fork, 'approval', { message: 'Fork approved under stricter policy.', terminalAppend: 'approval granted\n' });
createReplayCheckpoint(fork, 'fork-diverged', { phase: 'fork' });
const bundleInfo = exportReplayBundle(fork, outputDir);
const payload = { ok: true, outputDir, bundleFile: bundleInfo.bundleFile, order };
if (json) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  console.log(payload.bundleFile);
}
