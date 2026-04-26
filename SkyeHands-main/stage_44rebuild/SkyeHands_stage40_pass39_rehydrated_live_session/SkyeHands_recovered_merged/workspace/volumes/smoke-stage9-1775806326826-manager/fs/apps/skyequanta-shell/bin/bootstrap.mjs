import { getStackConfig, getPublicSummary, withLocalBinPath } from './config.mjs';
import { runStep } from '../lib/process.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { ensureRuntimeDependencies } from '../lib/system-deps.mjs';
import { printCanonicalRuntimeBannerForCommand } from '../lib/proof-runtime.mjs';

function parseArgs(argv) {
  return {
    skipSystem: argv.includes('--skip-system'),
    skipAgent: argv.includes('--skip-agent'),
    skipIde: argv.includes('--skip-ide')
  };
}

async function main() {
  const baseConfig = getStackConfig();
  const options = parseArgs(process.argv.slice(2));
  let childEnv = withLocalBinPath(loadShellEnv(baseConfig));

  ensureRuntimeState(baseConfig, childEnv);

  if (!options.skipIde || !options.skipSystem) {
    await ensureRuntimeDependencies(baseConfig, childEnv, { mode: 'local' });
  }

  childEnv = withLocalBinPath(loadShellEnv(baseConfig, childEnv));
  const config = getStackConfig(childEnv);

  printCanonicalRuntimeBannerForCommand(config, 'bootstrap.mjs');
  console.log(`Bootstrapping ${config.productName}`);
  console.log(JSON.stringify(getPublicSummary(config), null, 2));

  if (!options.skipIde) {
    await runStep('IDE prepare', 'node', ['apps/skyequanta-shell/bin/ide.mjs', 'prepare'], config.rootDir, childEnv);
  }

  if (!options.skipAgent) {
    await runStep(
      'Agent Python dependency install',
      'make',
      ['install-python-dependencies'],
      config.paths.agentCoreDir,
      childEnv
    );
  }

  console.log('Bootstrap completed successfully.');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});