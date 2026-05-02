import path from 'node:path';
import { getStackConfig, withLocalBinPath } from './config.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { runAppArmorLiveProofPackVerifier } from '../lib/apparmor-live-proof-pack.mjs';

async function main() {
  const execute = process.argv.includes('--execute');
  const baseConfig = getStackConfig(process.env);
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  const packDir = path.join(config.rootDir, 'dist', 'section45', 'apparmor-live-proof-pack');
  const payload = runAppArmorLiveProofPackVerifier(packDir, { execute });
  console.log(JSON.stringify(payload, null, 2));
  process.exit(payload.ok ? 0 : 1);
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
