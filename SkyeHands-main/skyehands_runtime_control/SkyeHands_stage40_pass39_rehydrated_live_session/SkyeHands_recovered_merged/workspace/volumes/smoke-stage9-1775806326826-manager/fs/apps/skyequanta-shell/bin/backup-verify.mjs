import path from 'node:path';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { verifyEncryptedBackupBundle, previewEncryptedBackupBundle } from '../lib/backup-bundle.mjs';
import { loadShellEnv } from '../lib/runtime.mjs';

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

function resolveConfig() {
  const baseConfig = getStackConfig(process.env);
  const env = withLocalBinPath(loadShellEnv(baseConfig));
  return { env, config: getStackConfig(env) };
}

function main() {
  const { config } = resolveConfig();
  const inputFile = path.resolve(getArg('--file') || path.join(config.rootDir, 'dist', 'backups', 'skyequanta-backup.json'));
  const passphrase = String(getArg('--passphrase') || process.env.SKYEQUANTA_BACKUP_PASSPHRASE || '').trim();
  const preview = process.argv.includes('--preview');
  const payload = preview
    ? previewEncryptedBackupBundle(inputFile)
    : verifyEncryptedBackupBundle(inputFile, passphrase);
  console.log(JSON.stringify(payload, null, 2));
}

main();
