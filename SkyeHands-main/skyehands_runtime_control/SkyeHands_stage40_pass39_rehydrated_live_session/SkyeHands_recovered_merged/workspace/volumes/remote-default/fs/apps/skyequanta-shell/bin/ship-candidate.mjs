import { getStackConfig } from './config.mjs';
import { ensureRuntimeState } from '../lib/runtime.mjs';
import { buildShipCandidatePackage } from '../lib/deployment-packaging.mjs';

async function main() {
  const strict = process.argv.includes('--strict');
  const json = process.argv.includes('--json');
  const config = getStackConfig(process.env);
  ensureRuntimeState(config);
  const payload = buildShipCandidatePackage(config, { strict });
  if (json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`ship candidate archive: ${payload.outputs.handoffArchive}`);
    console.log(`artifact manifest: ${payload.outputs.manifestFile}`);
    console.log(`deployment report: ${payload.outputs.reportFile}`);
  }
  if (strict && !payload.ok) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
