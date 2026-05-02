import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { buildSurfaceIdentityDocument, fetchAndVerifySurfaceIdentity, verifySurfaceIdentityDocument } from '../lib/surface-identity.mjs';

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    json: argv.includes('--json'),
    verifyUrl: null,
    artifactFile: null,
    outputFile: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--verify-url') options.verifyUrl = argv[index + 1] || null;
    if (value === '--artifact') options.artifactFile = argv[index + 1] || null;
    if (value === '--output') options.outputFile = argv[index + 1] || null;
  }
  return options;
}

async function main() {
  const options = parseArgs();
  const baseConfig = getStackConfig(process.env);
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));

  if (options.verifyUrl) {
    const result = await fetchAndVerifySurfaceIdentity(options.verifyUrl, {
      expectedArtifactFile: options.artifactFile || undefined
    });
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  const bundle = buildSurfaceIdentityDocument(config.rootDir, config, {
    artifactFile: options.artifactFile || undefined
  });
  if (options.outputFile) {
    fs.mkdirSync(path.dirname(path.resolve(options.outputFile)), { recursive: true });
    fs.writeFileSync(options.outputFile, `${JSON.stringify(bundle.document, null, 2)}\n`, 'utf8');
  }
  const verification = verifySurfaceIdentityDocument(bundle.document, {
    expectedArtifactFile: bundle.artifactFile || undefined
  });
  const payload = {
    ok: verification.ok,
    document: bundle.document,
    artifactFile: bundle.artifactFile,
    verification,
    outputFile: options.outputFile ? path.resolve(options.outputFile) : null
  };
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = payload.ok ? 0 : 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
