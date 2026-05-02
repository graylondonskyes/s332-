import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readString(value) {
  return String(value ?? '').trim();
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function normalizeRelativePath(value) {
  const normalized = readString(value).replace(/\\/g, '/').replace(/^\.\//, '');
  if (!normalized || normalized.startsWith('/') || normalized.includes('..')) {
    throw new Error(`Unsafe backup path '${value}'.`);
  }
  return normalized;
}

function defaultBackupPaths() {
  return [
    '.skyequanta/provider-vault.json',
    '.skyequanta/provider-vault-lockouts.json',
    '.skyequanta/workspaces.json',
    '.skyequanta/governance-policy.json',
    '.skyequanta/audit-log.json',
    '.skyequanta/audit-chain.ndjson',
    '.skyequanta/audit-chain-head.json',
    '.skyequanta/workspace-snapshots.json',
    '.skyequanta/snapshots'
  ];
}

function collectEntries(rootDir, relativePath, bucket = []) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return bucket;
  }
  const stat = fs.statSync(absolutePath);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
      collectEntries(rootDir, path.join(relativePath, entry.name), bucket);
    }
    return bucket;
  }
  const contents = fs.readFileSync(absolutePath);
  bucket.push({
    path: normalizeRelativePath(relativePath),
    mode: stat.mode & 0o777,
    sizeBytes: stat.size,
    sha256: sha256Buffer(contents),
    base64: contents.toString('base64')
  });
  return bucket;
}

function encryptBytes(plaintextBuffer, passphrase) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(passphrase, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    version: 1,
    algorithm: 'aes-256-gcm',
    kdf: 'scrypt',
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: ciphertext.toString('base64')
  };
}

function decryptBytes(envelope, passphrase) {
  const salt = Buffer.from(String(envelope.salt), 'base64');
  const iv = Buffer.from(String(envelope.iv), 'base64');
  const authTag = Buffer.from(String(envelope.authTag), 'base64');
  const ciphertext = Buffer.from(String(envelope.ciphertext), 'base64');
  const key = crypto.scryptSync(passphrase, salt, 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function exportEncryptedBackupBundle(rootDir, outputFile, options = {}) {
  const passphrase = readString(options.passphrase);
  if (!passphrase || passphrase.length < 12) {
    throw new Error('Backup passphrase must be at least 12 characters long.');
  }
  const includePaths = Array.isArray(options.includePaths) && options.includePaths.length
    ? options.includePaths.map(normalizeRelativePath)
    : defaultBackupPaths();
  const files = [];
  for (const relativePath of includePaths) {
    collectEntries(rootDir, relativePath, files);
  }
  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    rootDirLabel: path.basename(rootDir),
    fileCount: files.length,
    totalBytes: files.reduce((sum, item) => sum + item.sizeBytes, 0),
    files
  };
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const envelope = encryptBytes(plaintext, passphrase);
  envelope.manifest = {
    generatedAt: payload.generatedAt,
    rootDirLabel: payload.rootDirLabel,
    fileCount: payload.fileCount,
    totalBytes: payload.totalBytes,
    filePaths: files.map(item => item.path)
  };
  ensureDirectory(path.dirname(outputFile));
  fs.writeFileSync(outputFile, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
  return {
    ok: true,
    outputFile,
    manifest: envelope.manifest,
    ciphertextSha256: sha256Buffer(Buffer.from(String(envelope.ciphertext), 'utf8'))
  };
}


export function verifyEncryptedBackupBundle(inputFile, passphrase) {
  if (!fs.existsSync(inputFile)) {
    throw new Error(`Backup file does not exist: ${inputFile}`);
  }
  const envelope = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  const plaintext = decryptBytes(envelope, passphrase);
  const payload = JSON.parse(plaintext.toString('utf8'));
  const verifiedFiles = [];
  for (const item of payload.files || []) {
    const buffer = Buffer.from(String(item.base64), 'base64');
    const sha256 = sha256Buffer(buffer);
    if (sha256 !== String(item.sha256 || '')) {
      throw new Error(`Backup integrity verification failed for '${item.path}'.`);
    }
    verifiedFiles.push({ path: normalizeRelativePath(item.path), sha256, sizeBytes: buffer.length });
  }
  return {
    ok: true,
    verifiedAt: new Date().toISOString(),
    inputFile,
    fileCount: verifiedFiles.length,
    files: verifiedFiles,
    manifest: envelope.manifest || null
  };
}

export function previewEncryptedBackupBundle(inputFile) {
  if (!fs.existsSync(inputFile)) {
    throw new Error(`Backup file does not exist: ${inputFile}`);
  }
  const envelope = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  return {
    ok: true,
    inputFile,
    manifest: envelope.manifest || null,
    algorithm: envelope.algorithm || null,
    version: envelope.version || null
  };
}

export function restoreEncryptedBackupBundle(inputFile, passphrase, destinationRoot) {
  if (!fs.existsSync(inputFile)) {
    throw new Error(`Backup file does not exist: ${inputFile}`);
  }
  const envelope = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  const plaintext = decryptBytes(envelope, passphrase);
  const payload = JSON.parse(plaintext.toString('utf8'));
  const restoredFiles = [];
  for (const item of payload.files || []) {
    const relativePath = normalizeRelativePath(item.path);
    const targetFile = path.join(destinationRoot, relativePath);
    ensureDirectory(path.dirname(targetFile));
    const buffer = Buffer.from(String(item.base64), 'base64');
    fs.writeFileSync(targetFile, buffer);
    if (Number.isInteger(item.mode)) {
      fs.chmodSync(targetFile, item.mode);
    }
    restoredFiles.push({
      path: relativePath,
      sha256: sha256Buffer(buffer),
      sizeBytes: buffer.length
    });
  }
  return {
    ok: true,
    restoredAt: new Date().toISOString(),
    destinationRoot,
    fileCount: restoredFiles.length,
    restoredFiles
  };
}


export function rollbackEncryptedBackupBundle(inputFile, passphrase, destinationRoot, options = {}) {
  const preview = previewEncryptedBackupBundle(inputFile);
  const restored = restoreEncryptedBackupBundle(inputFile, passphrase, destinationRoot);
  const verified = verifyEncryptedBackupBundle(inputFile, passphrase);
  const touched = [];
  for (const item of verified.files || []) {
    const targetFile = path.join(destinationRoot, normalizeRelativePath(item.path));
    if (!fs.existsSync(targetFile)) {
      throw new Error(`Rollback verification failed because '${item.path}' was not restored.`);
    }
    const buffer = fs.readFileSync(targetFile);
    const sha256 = sha256Buffer(buffer);
    if (sha256 !== item.sha256) {
      throw new Error(`Rollback verification failed for '${item.path}'. Expected ${item.sha256} but found ${sha256}.`);
    }
    touched.push({ path: item.path, sha256, sizeBytes: buffer.length });
  }
  return {
    ok: true,
    rolledBackAt: new Date().toISOString(),
    destinationRoot,
    manifest: preview.manifest || null,
    restored,
    verified,
    touched
  };
}
