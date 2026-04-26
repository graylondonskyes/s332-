#!/usr/bin/env node
import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { buildLaunchPlan } from '../lib/platform-launchpad.mjs';

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === '--slug') out.slug = value;
    if (key === '--profile') out.profileId = value;
    if (key === '--port') out.port = value;
  }
  return out;
}

const baseConfig = getStackConfig(process.env);
ensureRuntimeState(baseConfig, process.env);
const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
printCanonicalRuntimeBannerForCommand(config, 'platform-launch-plan.mjs');
const args = parseArgs(process.argv.slice(2));
const plan = buildLaunchPlan(config, args.slug, args.profileId || null, { port: args.port || 0 });
console.log(JSON.stringify(plan, null, 2));
if (!plan.ok) process.exitCode = 1;
