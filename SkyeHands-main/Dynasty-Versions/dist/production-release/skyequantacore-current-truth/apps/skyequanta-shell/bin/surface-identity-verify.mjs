import path from 'node:path';

import { getStackConfig, getPublicUrls } from './config.mjs';
import { writeRemoteSurfaceVerificationBundle } from '../lib/remote-surface-verifier.mjs';

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    json: false,
    url: null,
    outputDir: null,
    artifactAttestationFile: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--json') options.json = true;
    else if (token === '--url') options.url = argv[++index] || null;
    else if (token === '--output') options.outputDir = argv[++index] || null;
    else if (token === '--artifact-attestation') options.artifactAttestationFile = argv[++index] || null;
  }
  return options;
}

async function main() {
  const options = parseArgs();
  const config = getStackConfig(process.env);
  const publicUrls = getPublicUrls(config);
  const surfaceUrl = options.url || publicUrls.surfaceIdentity;
  const outputDir = path.resolve(options.outputDir || path.join(config.rootDir, 'dist', 'section44', 'surface-verify'));
  const result = await writeRemoteSurfaceVerificationBundle(config.rootDir, outputDir, surfaceUrl, {
    artifactAttestationFile: options.artifactAttestationFile
  });
  if (options.json) console.log(JSON.stringify(result, null, 2));
  else console.log(result.verifyFile);
  if (!result.ok) process.exit(1);
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
