#!/usr/bin/env node
import { getStackConfig, withLocalBinPath } from './config.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { printCanonicalRuntimeBannerForCommand } from '../lib/proof-runtime.mjs';
import { queryMemoryGraph } from '../lib/skye-memory-fabric.mjs';

function parseArgs(argv) {
  const args = { queryType: argv[0] || '', json: argv.includes('--json') };
  for (let index = 1; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) continue;
    const name = value.slice(2);
    if (name === 'json') continue;
    const nextValue = argv[index + 1];
    if (nextValue && !nextValue.startsWith('--')) {
      args[name] = nextValue;
      index += 1;
    } else {
      args[name] = true;
    }
  }
  return args;
}

const options = parseArgs(process.argv.slice(2));
const baseConfig = getStackConfig(process.env);
ensureRuntimeState(baseConfig, process.env);
const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
printCanonicalRuntimeBannerForCommand(config, 'memory-query.mjs');

const result = queryMemoryGraph(config, options.queryType, {
  failureSignature: options.failureSignature,
  filePath: options.filePath,
  ruleKey: options.ruleKey
});

if (options.json) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  process.stdout.write(`${result.queryType}: ${result.count}\n`);
}
