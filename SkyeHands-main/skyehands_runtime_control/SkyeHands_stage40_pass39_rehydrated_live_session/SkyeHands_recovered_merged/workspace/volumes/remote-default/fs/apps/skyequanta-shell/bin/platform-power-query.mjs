#!/usr/bin/env node
import { getStackConfig, withLocalBinPath } from './config.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { queryPlatformPowerMesh } from '../lib/platform-power-mesh.mjs';

const baseConfig = getStackConfig();
ensureRuntimeState(baseConfig, process.env);
const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
const query = process.argv.slice(2).join(' ');
const results = queryPlatformPowerMesh(config, query);
console.log(JSON.stringify({ query, count: results.length, results }, null, 2));
