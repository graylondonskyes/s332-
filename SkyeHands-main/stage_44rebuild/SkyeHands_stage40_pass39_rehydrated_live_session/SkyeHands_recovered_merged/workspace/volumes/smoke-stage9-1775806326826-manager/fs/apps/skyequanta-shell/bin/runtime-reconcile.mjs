import { getStackConfig, withLocalBinPath } from './config.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { reconcileAllWorkspaceRuntimes, reconcileWorkspaceRuntime } from '../lib/runtime-recovery.mjs';

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

function main() {
  const baseConfig = getStackConfig(process.env);
  const env = withLocalBinPath(loadShellEnv(baseConfig));
  const config = getStackConfig(env);
  ensureRuntimeState(config, env);
  const workspaceId = String(getArg('--workspace-id') || '').trim();
  const payload = workspaceId ? reconcileWorkspaceRuntime(config, workspaceId) : reconcileAllWorkspaceRuntimes(config);
  console.log(JSON.stringify(payload, null, 2));
}

main();
