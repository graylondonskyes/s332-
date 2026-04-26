#!/usr/bin/env node
import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { registerPlatformFromSource } from '../lib/platform-launchpad.mjs';

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === '--source') out.sourceDir = value;
    if (key === '--slug') out.slug = value;
    if (key === '--name') out.displayName = value;
  }
  return out;
}

const baseConfig = getStackConfig(process.env);
ensureRuntimeState(baseConfig, process.env);
const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
printCanonicalRuntimeBannerForCommand(config, 'platform-import.mjs');
const result = registerPlatformFromSource(config, parseArgs(process.argv.slice(2)));
console.log(JSON.stringify({
  slug: result.manifest.slug,
  displayName: result.manifest.displayName,
  manifestFile: result.manifestFile,
  runtimeRegistryFile: result.runtimeRegistryFile,
  canonicalRegistryFile: result.canonicalRegistryFile,
  summary: result.manifest.summary
}, null, 2));
