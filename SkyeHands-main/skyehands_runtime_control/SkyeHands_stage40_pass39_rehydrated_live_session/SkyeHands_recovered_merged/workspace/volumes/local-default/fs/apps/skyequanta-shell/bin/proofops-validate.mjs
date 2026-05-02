#!/usr/bin/env node
import path from 'node:path';
import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { validateEvidencePack, verifyProofOpsAttestation, validateRedactedExport } from '../lib/proofops.mjs';

function parseArgs(argv) {
  const options = { json: false, bundle: null, attestation: null, redacted: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--json') options.json = true;
    else if (value === '--bundle' && argv[index + 1]) { options.bundle = argv[index + 1]; index += 1; }
    else if (value === '--attestation' && argv[index + 1]) { options.attestation = argv[index + 1]; index += 1; }
    else if (value === '--redacted' && argv[index + 1]) { options.redacted = argv[index + 1]; index += 1; }
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
const baseConfig = getStackConfig(process.env);
ensureRuntimeState(baseConfig, process.env);
const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
printCanonicalRuntimeBannerForCommand(config, 'proofops-validate.mjs');
const bundleFile = path.resolve(config.rootDir, options.bundle || 'dist/section49/proofops-bundle/evidence-pack.json');
const attestationFile = path.resolve(config.rootDir, options.attestation || 'dist/section49/proofops-bundle/evidence-attestation.json');
const redactedFile = path.resolve(config.rootDir, options.redacted || 'dist/section49/proofops-bundle/procurement-safe/evidence-pack-redacted.json');
const payload = {
  generatedAt: new Date().toISOString(),
  bundle: validateEvidencePack(bundleFile),
  attestation: verifyProofOpsAttestation(attestationFile, bundleFile),
  redacted: validateRedactedExport(redactedFile, config.rootDir, { requiredReplayRefs: 1, requireAuditVerification: true })
};
payload.ok = payload.bundle.ok && payload.attestation.ok && payload.redacted.ok;
if (options.json) console.log(JSON.stringify(payload, null, 2));
else console.log(`proofops validate: ${payload.ok ? 'OK' : 'FAIL'}`);
if (!payload.ok) process.exitCode = 1;
