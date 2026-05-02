import path from 'node:path';

import { getStackConfig } from './config.mjs';
import { writeExecutionAttestationBundle } from '../lib/execution-attestation.mjs';

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    json: false,
    outputDir: null,
    workspaceId: 'manual',
    label: 'manual',
    effectiveMode: null,
    requestedMode: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--json') options.json = true;
    else if (token === '--output') options.outputDir = argv[++index] || null;
    else if (token === '--workspace') options.workspaceId = argv[++index] || options.workspaceId;
    else if (token === '--label') options.label = argv[++index] || options.label;
    else if (token === '--effective-mode') options.effectiveMode = argv[++index] || null;
    else if (token === '--requested-mode') options.requestedMode = argv[++index] || null;
  }
  return options;
}

async function main() {
  const options = parseArgs();
  const config = getStackConfig(process.env);
  const outputDir = path.resolve(options.outputDir || path.join(config.rootDir, 'dist', 'section44', 'execution-attestation'));
  const result = writeExecutionAttestationBundle(config.rootDir, outputDir, {
    workspaceId: options.workspaceId,
    label: options.label,
    effectiveMode: options.effectiveMode,
    requestedMode: options.requestedMode,
    verify: {
      expectedEffectiveMode: options.effectiveMode || undefined,
      requireCgroupEvidence: true
    }
  });
  if (options.json) console.log(JSON.stringify(result, null, 2));
  else console.log(result.attestationFile);
  if (!result.ok) process.exit(1);
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
