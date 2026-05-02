#!/usr/bin/env node
import path from 'node:path';
import { getStackConfig } from './config.mjs';
import { verifyReplayBundle } from '../lib/skye-replay.mjs';

const config = getStackConfig();
const json = process.argv.includes('--json');
const fileArgIndex = process.argv.findIndex(item => item === '--file');
const target = fileArgIndex >= 0 ? process.argv[fileArgIndex + 1] : path.join(config.rootDir, 'dist', 'section47', 'replay-proof', 'replay-bundle.json');
const payload = verifyReplayBundle(target);
if (json) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  console.log(payload.ok ? 'verified' : payload.reason);
}
process.exit(payload.ok ? 0 : 1);
