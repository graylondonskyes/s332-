import path from 'node:path';

import { getPublicSummary, getStackConfig, withLocalBinPath } from './config.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { writeRedactedSupportDump } from '../lib/gate-config.mjs';

function parseArgs(argv) {
  const options = { json: false, output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--json') {
      options.json = true;
      continue;
    }
    if (value === '--output' && argv[index + 1]) {
      options.output = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (value.startsWith('--output=')) {
      options.output = String(value.split('=').slice(1).join('=')).trim();
    }
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseConfig = getStackConfig();
  ensureRuntimeState(baseConfig, process.env);
  const env = withLocalBinPath(loadShellEnv(baseConfig));
  const config = getStackConfig(env);
  const outputName = options.output ? path.basename(options.output) : `support-dump-${Date.now()}.json`;
  const filePath = writeRedactedSupportDump(config.rootDir, outputName, {
    runtimeSummary: getPublicSummary(config),
    environment: {
      SKYEQUANTA_RUNTIME_MODE: process.env.SKYEQUANTA_RUNTIME_MODE || config.gateRuntime.mode,
      SKYEQUANTA_GATE_URL: process.env.SKYEQUANTA_GATE_URL || process.env.OMEGA_GATE_URL || null,
      SKYEQUANTA_GATE_TOKEN: process.env.SKYEQUANTA_GATE_TOKEN || process.env.SKYEQUANTA_OSKEY || null,
      SKYEQUANTA_GATE_MODEL: process.env.SKYEQUANTA_GATE_MODEL || config.gateRuntime.gate.model
    }
  }, config.gateRuntime, process.env);
  const payload = {
    ok: true,
    output: filePath,
    gateRuntimeMode: config.gateRuntime.mode
  };
  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(`Support dump written to ${filePath}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
