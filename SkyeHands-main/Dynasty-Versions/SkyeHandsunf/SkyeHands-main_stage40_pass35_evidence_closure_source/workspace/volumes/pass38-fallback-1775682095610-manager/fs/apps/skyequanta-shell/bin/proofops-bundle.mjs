#!/usr/bin/env node
import path from 'node:path';
import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { createProofOpsBundle } from '../lib/proofops.mjs';

function parseArgs(argv) {
  const options = { json: false, outputDir: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--json') options.json = true;
    else if ((value === '--output-dir' || value === '--output') && argv[index + 1]) { options.outputDir = argv[index + 1]; index += 1; }
    else if (value.startsWith('--output-dir=')) options.outputDir = value.split('=').slice(1).join('=');
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
const baseConfig = getStackConfig(process.env);
ensureRuntimeState(baseConfig, process.env);
const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
printCanonicalRuntimeBannerForCommand(config, 'proofops-bundle.mjs');
const payload = createProofOpsBundle(config.rootDir, {
  outputDir: options.outputDir ? path.resolve(config.rootDir, options.outputDir) : null
});
if (options.json) console.log(JSON.stringify(payload, null, 2));
else console.log(`proofops bundle: ${payload.ok ? 'OK' : 'FAIL'}`);
if (!payload.ok) process.exitCode = 1;
