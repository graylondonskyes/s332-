#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig } from './config.mjs';
import { createReplaySession, appendReplayEvent, createReplayCheckpoint, exportReplayBundle, createReplayExportBundle } from '../lib/skye-replay.mjs';

const json = process.argv.includes('--json');
const config = getStackConfig();
const outputDir = path.join(config.rootDir, 'dist', 'section47', 'replay-cli-export');
fs.rmSync(outputDir, { recursive: true, force: true });
const session = createReplaySession({
  runId: 'section47-cli-export',
  workspaceId: 'section47',
  policyMode: 'debug',
  budgetMode: 'balanced',
  initialFiles: {
    'src/app.js': 'export const answer = 41;\n'
  }
});
appendReplayEvent(session, 'planning', { summary: 'Replay export CLI example.' });
appendReplayEvent(session, 'file-write', { filePath: 'src/app.js', content: 'export const answer = 42;\n', reason: 'raise value' });
appendReplayEvent(session, 'command-exit', { terminalAppend: 'node test.js\nPASS\n' });
createReplayCheckpoint(session, 'after-cli-example', { phase: 'export' });
const bundleInfo = exportReplayBundle(session, outputDir);
const exportInfo = createReplayExportBundle(config.rootDir, bundleInfo, outputDir);
const payload = { ok: true, outputDir, bundleFile: bundleInfo.bundleFile, exportFile: exportInfo.exportFile };
if (json) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  console.log(payload.bundleFile);
}
