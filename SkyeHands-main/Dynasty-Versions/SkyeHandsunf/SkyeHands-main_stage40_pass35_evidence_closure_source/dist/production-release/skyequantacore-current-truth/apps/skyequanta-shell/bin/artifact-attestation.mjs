import path from 'node:path';
import { getStackConfig } from './config.mjs';
import { writeArtifactAttestationBundle } from '../lib/artifact-attestation.mjs';

function parseArgs(argv) {
  const options = {
    artifactFile: null,
    outputDir: null,
    environment: process.env.SKYEQUANTA_DEPLOY_ENV || 'local-proof',
    deployTarget: process.env.SKYEQUANTA_DEPLOY_TARGET || 'self-hosted',
    json: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if ((value === '--artifact' || value === '--artifact-file') && argv[index + 1]) { options.artifactFile = argv[++index]; continue; }
    if ((value === '--output-dir' || value === '--output') && argv[index + 1]) { options.outputDir = argv[++index]; continue; }
    if (value === '--environment' && argv[index + 1]) { options.environment = argv[++index]; continue; }
    if (value === '--deploy-target' && argv[index + 1]) { options.deployTarget = argv[++index]; continue; }
    if (value === '--json') { options.json = true; continue; }
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = getStackConfig();
  const artifactFile = path.resolve(config.rootDir, options.artifactFile || 'dist/production-release/skyequantacore-current-truth.tar.gz');
  const outputDir = path.resolve(config.rootDir, options.outputDir || 'dist/artifact-attestation');
  const bundle = writeArtifactAttestationBundle(config.rootDir, artifactFile, outputDir, {
    productName: config.productName,
    environment: options.environment,
    deployTarget: options.deployTarget
  });
  console.log(JSON.stringify(bundle, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
