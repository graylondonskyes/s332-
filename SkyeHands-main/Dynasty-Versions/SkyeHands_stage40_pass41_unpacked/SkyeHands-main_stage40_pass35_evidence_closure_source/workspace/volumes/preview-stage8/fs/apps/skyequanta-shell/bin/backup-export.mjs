#!/usr/bin/env node
import path from 'node:path';

import { getStackConfig } from './config.mjs';
import { exportEncryptedBackupBundle } from '../lib/backup-bundle.mjs';

function parseArgs(argv) {
  const options = { json: false, outputFile: null, passphrase: null, includePaths: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--json') { options.json = true; continue; }
    if ((value === '--output' || value === '--output-file') && argv[index + 1]) { options.outputFile = argv[++index]; continue; }
    if ((value === '--passphrase' || value === '--secret') && argv[index + 1]) { options.passphrase = argv[++index]; continue; }
    if ((value === '--include' || value === '--path') && argv[index + 1]) { options.includePaths.push(argv[++index]); continue; }
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = getStackConfig(process.env);
  const outputFile = path.resolve(config.rootDir, options.outputFile || 'dist/backups/skyequanta-backup.sqbkp');
  const result = exportEncryptedBackupBundle(config.rootDir, outputFile, {
    passphrase: options.passphrase || process.env.SKYEQUANTA_BACKUP_PASSPHRASE || '',
    includePaths: options.includePaths
  });
  const payload = {
    ok: result.ok,
    outputFile: path.relative(config.rootDir, result.outputFile),
    manifest: result.manifest,
    ciphertextSha256: result.ciphertextSha256,
    generatedAt: new Date().toISOString()
  };
  if (options.json) console.log(JSON.stringify(payload, null, 2));
  else console.log(`Encrypted backup bundle written to ${payload.outputFile}`);
}

main();
