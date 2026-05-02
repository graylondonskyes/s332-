import { getStackConfig, withLocalBinPath } from './config.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { writeAppArmorProfileBundle } from '../lib/apparmor-policy.mjs';

function parseArgs(argv = process.argv.slice(2)) {
  const options = { workspaceId: 'shared', label: 'runtime', workspaceDir: process.cwd() };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--workspace') options.workspaceId = argv[index + 1] || options.workspaceId;
    if (value === '--label') options.label = argv[index + 1] || options.label;
    if (value === '--workspace-dir') options.workspaceDir = argv[index + 1] || options.workspaceDir;
  }
  return options;
}

async function main() {
  const options = parseArgs();
  const baseConfig = getStackConfig(process.env);
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  const bundle = writeAppArmorProfileBundle(config.rootDir, {
    workspaceId: options.workspaceId,
    label: options.label,
    workspaceDir: options.workspaceDir
  });
  console.log(JSON.stringify(bundle, null, 2));
  process.exitCode = bundle.ok ? 0 : 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
