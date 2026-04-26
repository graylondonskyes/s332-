#!/usr/bin/env node
import path from 'node:path';

import { getStackConfig } from './config.mjs';
import { writeReleaseProvenanceBundle } from '../lib/release-provenance.mjs';

function parseArgs(argv) {
  const options = {
    json: false,
    outputDir: null,
    generateKey: false,
    privateKeyPem: null,
    publicKeyPem: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--json') { options.json = true; continue; }
    if (value === '--generate-key' || value === '--generate-keypair') { options.generateKey = true; continue; }
    if ((value === '--output-dir' || value === '--output') && argv[index + 1]) { options.outputDir = argv[++index]; continue; }
    if ((value === '--private-key' || value === '--private-key-pem') && argv[index + 1]) { options.privateKeyPem = argv[++index]; continue; }
    if ((value === '--public-key' || value === '--public-key-pem') && argv[index + 1]) { options.publicKeyPem = argv[++index]; continue; }
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = getStackConfig(process.env);
  const outputDir = path.resolve(config.rootDir, options.outputDir || 'dist/release-provenance');
  const result = writeReleaseProvenanceBundle(config.rootDir, outputDir, {
    signing: {
      generateKeypair: options.generateKey,
      privateKeyPem: options.privateKeyPem || process.env.SKYEQUANTA_PROVENANCE_SIGNING_PRIVATE_KEY || null,
      publicKeyPem: options.publicKeyPem || process.env.SKYEQUANTA_PROVENANCE_SIGNING_PUBLIC_KEY || null
    }
  });
  const payload = {
    ok: result.ok,
    generatedAt: new Date().toISOString(),
    outputDir: path.relative(config.rootDir, result.outputDir),
    manifestPath: path.relative(config.rootDir, result.manifestPath),
    sbomPath: path.relative(config.rootDir, result.sbomPath),
    attestationPath: path.relative(config.rootDir, result.attestationPath),
    sourceTreeHash: result.sourceTreeHash,
    fileCount: result.fileCount,
    verification: result.verification,
    generatedSigningPrivateKeyPem: result.generatedSigningPrivateKeyPem
  };
  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`Release provenance written to ${payload.outputDir}`);
    console.log(`Attestation verification: ${payload.verification.reason}`);
  }
  if (!payload.ok) process.exitCode = 1;
}

main();
