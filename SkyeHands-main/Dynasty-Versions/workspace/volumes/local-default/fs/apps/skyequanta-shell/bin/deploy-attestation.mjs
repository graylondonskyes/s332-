import path from 'node:path';
import { getStackConfig } from './config.mjs';
import { writeDeploymentAttestationBundle } from '../lib/deploy-attestation.mjs';

function parseArgs(argv) {
  const options = { outputDir: null, environment: process.env.SKYEQUANTA_DEPLOY_ENV || 'local-proof', deployTarget: process.env.SKYEQUANTA_DEPLOY_TARGET || 'self-hosted', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--output-dir') { options.outputDir = argv[++i] || options.outputDir; continue; }
    if (value === '--environment') { options.environment = argv[++i] || options.environment; continue; }
    if (value === '--deploy-target') { options.deployTarget = argv[++i] || options.deployTarget; continue; }
    if (value === '--json') { options.json = true; continue; }
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = getStackConfig();
  const outputDir = options.outputDir
    ? path.resolve(options.outputDir)
    : path.join(config.rootDir, 'dist', 'deployment-attestation');
  const bundle = writeDeploymentAttestationBundle(config.rootDir, outputDir, {
    environment: options.environment,
    deployTarget: options.deployTarget
  });
  console.log(JSON.stringify(bundle, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
