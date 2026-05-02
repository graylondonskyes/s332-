import path from 'node:path';
import { rollbackEncryptedBackupBundle } from '../lib/backup-bundle.mjs';

function parseArgs(argv) {
  const options = { input: null, passphrase: '', destination: process.cwd(), json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--input') { options.input = argv[++i] || options.input; continue; }
    if (value === '--passphrase') { options.passphrase = argv[++i] || options.passphrase; continue; }
    if (value === '--destination') { options.destination = argv[++i] || options.destination; continue; }
    if (value === '--json') { options.json = true; continue; }
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.input) throw new Error('--input is required.');
  if (!options.passphrase) throw new Error('--passphrase is required.');
  const result = rollbackEncryptedBackupBundle(path.resolve(options.input), options.passphrase, path.resolve(options.destination));
  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
