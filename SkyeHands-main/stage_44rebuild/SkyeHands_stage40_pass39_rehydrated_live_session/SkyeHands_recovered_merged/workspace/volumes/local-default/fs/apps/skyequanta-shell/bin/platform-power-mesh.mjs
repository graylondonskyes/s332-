#!/usr/bin/env node
import { getStackConfig, withLocalBinPath } from './config.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { buildPlatformPowerMesh } from '../lib/platform-power-mesh.mjs';

const baseConfig = getStackConfig();
ensureRuntimeState(baseConfig, process.env);
const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
const slug = process.argv[2] || 'skye-account-executive-commandhub-s0l26-0s';
const result = buildPlatformPowerMesh(config, slug);
console.log(JSON.stringify({
  slug,
  powerFile: result.powerFile.replace(config.rootDir + '/', ''),
  capsuleCount: result.power.capsuleCount,
  launchableCapsuleCount: result.power.launchableCapsuleCount
}, null, 2));
