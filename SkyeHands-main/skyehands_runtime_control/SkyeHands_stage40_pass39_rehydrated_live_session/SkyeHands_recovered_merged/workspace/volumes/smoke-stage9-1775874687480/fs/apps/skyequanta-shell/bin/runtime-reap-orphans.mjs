import { getStackConfig, withLocalBinPath } from './config.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { reapOrphanWorkspaceProcesses } from '../lib/runtime-recovery.mjs';

function main() {
  const baseConfig = getStackConfig(process.env);
  const env = withLocalBinPath(loadShellEnv(baseConfig));
  const config = getStackConfig(env);
  ensureRuntimeState(config, env);
  const payload = reapOrphanWorkspaceProcesses(config, {
    includeUnknownOnly: !process.argv.includes('--all')
  });
  console.log(JSON.stringify(payload, null, 2));
}

main();
