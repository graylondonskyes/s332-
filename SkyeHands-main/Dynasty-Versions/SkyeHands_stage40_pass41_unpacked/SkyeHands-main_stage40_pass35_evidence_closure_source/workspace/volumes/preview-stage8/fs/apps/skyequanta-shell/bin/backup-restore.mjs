#!/usr/bin/env node
import path from 'node:path';

import { getStackConfig } from './config.mjs';
import { restoreEncryptedBackupBundle } from '../lib/backup-bundle.mjs';

function parseArgs(argv) {
  const options = { json: false, inputFile: null, passphrase: null, destinationRoot: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--json') { options.json = true; continue; }
    if ((value === '--input' || value === '--input-file') && argv[index + 1]) { options.inputFile = argv[++index]; continue; }
    if ((value === '--passphrase' || value === '--secret') && argv[index + 1]) { options.passphrase = argv[++index]; continue; }
    if ((value === '--dest' || value === '--destination-root') && argv[index + 1]) { options.destinationRoot = argv[++index]; continue; }
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.inputFile) {
    throw new Error('Backup input file is required. Use --input <file>.');
  }
  const config = getStackConfig(process.env);
  const inputFile = path.resolve(config.rootDir, options.inputFile);
  const destinationRoot = path.resolve(config.rootDir, options.destinationRoot || 'dist/backups/restore-target');
  const result = restoreEncryptedBackupBundle(inputFile, options.passphrase || process.env.SKYEQUANTA_BACKUP_PASSPHRASE || '', destinationRoot);
  const payload = {
    ...result,
    inputFile: path.relative(config.rootDir, inputFile),
    destinationRoot: path.relative(config.rootDir, destinationRoot)
  };
  if (options.json) console.log(JSON.stringify(payload, null, 2));
  else console.log(`Encrypted backup restored into ${payload.destinationRoot}`);
}

main();
