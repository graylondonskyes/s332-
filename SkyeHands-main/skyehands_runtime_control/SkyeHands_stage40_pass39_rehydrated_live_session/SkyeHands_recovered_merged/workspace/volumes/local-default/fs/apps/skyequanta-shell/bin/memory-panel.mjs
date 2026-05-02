#!/usr/bin/env node
import { getStackConfig, withLocalBinPath } from './config.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { printCanonicalRuntimeBannerForCommand } from '../lib/proof-runtime.mjs';
import { renderMemoryPanel } from '../lib/skye-memory-fabric.mjs';

const baseConfig = getStackConfig(process.env);
ensureRuntimeState(baseConfig, process.env);
const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
printCanonicalRuntimeBannerForCommand(config, 'memory-panel.mjs');
const result = renderMemoryPanel(config);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
