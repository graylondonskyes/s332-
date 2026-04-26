import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath, fallback = null) {
  if (!filePath || !fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function readText(filePath, fallback = '') {
  if (!filePath || !fs.existsSync(filePath)) return fallback;
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return fallback;
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(item => canonicalJson(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

function normalizeRelativePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

export function shouldIncludeProvenancePath(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  const segments = normalized.split('/');
  const bannedSegments = new Set(['.git', '.skyequanta', 'logs', 'reports', 'node_modules', '__pycache__', 'dist']);
  if (segments.some(segment => bannedSegments.has(segment))) return false;
  if (normalized.startsWith('workspace/')) return false;
  return Boolean(normalized) && fs.existsSync(relativePath) !== false;
}

function walkFiles(rootDir, rel = '.', bucket = []) {
  const current = rel === '.' ? rootDir : path.join(rootDir, rel);
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const childRel = rel === '.' ? entry.name : path.join(rel, entry.name);
    const normalized = normalizeRelativePath(childRel);
    if (!shouldIncludeProvenancePath(path.join(rootDir, normalized))) continue;
    const absolute = path.join(rootDir, normalized);
    if (entry.isDirectory()) {
      walkFiles(rootDir, normalized, bucket);
      continue;
    }
    if (entry.isFile()) {
      bucket.push(normalized);
    }
  }
  return bucket;
}

function exportPublicKeyPem(publicKey) {
  return publicKey.export({ type: 'spki', format: 'pem' }).toString();
}

function exportPrivateKeyPem(privateKey) {
  return privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
}

function loadPrivateKey(signing) {
  const pem = String(signing?.privateKeyPem || '').trim();
  if (!pem) return null;
  return crypto.createPrivateKey(pem);
}

function loadPublicKey(signing) {
  const pem = String(signing?.publicKeyPem || '').trim();
  if (!pem) return null;
  return crypto.createPublicKey(pem);
}

export function parsePyprojectDependencies(filePath) {
  const text = readText(filePath, '');
  const lines = text.split(/\r?\n/);
  const deps = [];
  let inSection = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('[')) {
      inSection = line === '[tool.poetry.dependencies]' || line === '[project]';
      continue;
    }
    if (!inSection) continue;
    const match = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
    if (match) {
      deps.push({ name: match[1], spec: match[2].replace(/[",']/g, '').trim() });
      continue;
    }
    if (line.startsWith('dependencies = [')) {
      // project.dependencies array style (best-effort)
      continue;
    }
    const arrayMatch = line.match(/^["']([^"']+)["'],?$/);
    if (arrayMatch) {
      deps.push({ name: arrayMatch[1].split(/[<>=!~ ]/)[0], spec: arrayMatch[1] });
    }
  }
  return deps.filter(item => item.name.toLowerCase() !== 'python');
}

export function collectDependencyInventory(rootDir) {
  const packageJsonTargets = [
    'apps/skyequanta-shell/package.json',
    'platform/ide-core/package.json'
  ];
  const pythonTargets = [
    'platform/agent-core/pyproject.toml'
  ];
  const npmPackages = [];
  for (const relativePath of packageJsonTargets) {
    const absolutePath = path.join(rootDir, relativePath);
    const parsed = readJson(absolutePath, null);
    if (!parsed) continue;
    const allDeps = {
      ...(parsed.dependencies || {}),
      ...(parsed.devDependencies || {})
    };
    npmPackages.push({
      packagePath: relativePath,
      packageName: parsed.name || path.basename(path.dirname(relativePath)),
      version: parsed.version || null,
      dependencies: Object.entries(allDeps).sort(([a], [b]) => a.localeCompare(b)).map(([name, spec]) => ({ name, spec }))
    });
  }
  const pythonPackages = [];
  for (const relativePath of pythonTargets) {
    const absolutePath = path.join(rootDir, relativePath);
    if (!fs.existsSync(absolutePath)) continue;
    pythonPackages.push({
      packagePath: relativePath,
      dependencies: parsePyprojectDependencies(absolutePath).sort((a, b) => a.name.localeCompare(b.name))
    });
  }
  return {
    npmPackages,
    pythonPackages,
    packageCount: npmPackages.length + pythonPackages.length
  };
}

export function collectSourceInventory(rootDir) {
  const files = walkFiles(rootDir)
    .map(relativePath => {
      const absolutePath = path.join(rootDir, relativePath);
      const stat = fs.statSync(absolutePath);
      return {
        path: relativePath,
        sizeBytes: stat.size,
        sha256: sha256File(absolutePath)
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
  const sourceTreeHash = sha256Buffer(Buffer.from(files.map(item => `${item.path}:${item.sha256}`).join('\n'), 'utf8'));
  return {
    fileCount: files.length,
    sourceTreeHash,
    files
  };
}

export function signProvenancePayload(unsignedPayload, signing = {}) {
  let privateKey = loadPrivateKey(signing);
  let publicKey = loadPublicKey(signing);
  let generated = false;
  if (!privateKey && signing.generateKeypair) {
    const pair = crypto.generateKeyPairSync('ed25519');
    privateKey = pair.privateKey;
    publicKey = pair.publicKey;
    generated = true;
  }
  if (!privateKey) {
    return {
      signed: false,
      attestation: {
        ...unsignedPayload,
        signing: {
          mode: 'unsigned',
          generatedKeypair: false,
          publicKeyPem: null,
          signature: null,
          verified: false
        }
      },
      privateKeyPem: null
    };
  }
  if (!publicKey) {
    publicKey = crypto.createPublicKey(privateKey);
  }
  const serialized = canonicalJson(unsignedPayload);
  const signature = crypto.sign(null, Buffer.from(serialized, 'utf8'), privateKey).toString('base64');
  const publicKeyPem = exportPublicKeyPem(publicKey);
  const attestation = {
    ...unsignedPayload,
    signing: {
      mode: 'ed25519',
      generatedKeypair: generated,
      publicKeyPem,
      signature,
      verified: crypto.verify(null, Buffer.from(serialized, 'utf8'), publicKey, Buffer.from(signature, 'base64'))
    }
  };
  return {
    signed: true,
    attestation,
    privateKeyPem: generated ? exportPrivateKeyPem(privateKey) : null
  };
}

export function verifyProvenanceAttestation(attestation) {
  const signing = attestation?.signing || {};
  if (!signing.signature || !signing.publicKeyPem) {
    return { ok: false, reason: 'missing_signature' };
  }
  const unsignedPayload = { ...attestation };
  delete unsignedPayload.signing;
  try {
    const publicKey = crypto.createPublicKey(signing.publicKeyPem);
    const verified = crypto.verify(null, Buffer.from(canonicalJson(unsignedPayload), 'utf8'), publicKey, Buffer.from(String(signing.signature), 'base64'));
    return {
      ok: verified,
      reason: verified ? 'verified' : 'signature_mismatch',
      publicKeyFingerprint: sha256Buffer(Buffer.from(String(signing.publicKeyPem), 'utf8'))
    };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

export function writeReleaseProvenanceBundle(rootDir, outputDir, options = {}) {
  ensureDirectory(outputDir);
  const sourceInventory = collectSourceInventory(rootDir);
  const dependencies = collectDependencyInventory(rootDir);
  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    rootDir,
    sourceTreeHash: sourceInventory.sourceTreeHash,
    fileCount: sourceInventory.fileCount,
    dependencies,
    files: sourceInventory.files
  };
  const sbom = {
    format: 'skyehands-sbom-v1',
    generatedAt: manifest.generatedAt,
    sourceTreeHash: manifest.sourceTreeHash,
    components: [
      ...dependencies.npmPackages.map(item => ({ ecosystem: 'npm', packagePath: item.packagePath, packageName: item.packageName, version: item.version, dependencies: item.dependencies })),
      ...dependencies.pythonPackages.map(item => ({ ecosystem: 'python', packagePath: item.packagePath, dependencies: item.dependencies }))
    ]
  };
  const unsignedAttestation = {
    version: 1,
    generatedAt: manifest.generatedAt,
    sourceTreeHash: manifest.sourceTreeHash,
    fileCount: manifest.fileCount,
    manifestSha256: sha256Buffer(Buffer.from(canonicalJson(manifest), 'utf8')),
    sbomSha256: sha256Buffer(Buffer.from(canonicalJson(sbom), 'utf8')),
    builder: {
      runtime: 'node',
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    }
  };
  const signed = signProvenancePayload(unsignedAttestation, options.signing || {});
  const attestation = signed.attestation;
  const verification = verifyProvenanceAttestation(attestation);

  const manifestPath = path.join(outputDir, 'RELEASE_PROVENANCE_MANIFEST.json');
  const sbomPath = path.join(outputDir, 'RELEASE_SBOM.json');
  const attestationPath = path.join(outputDir, 'RELEASE_PROVENANCE_ATTESTATION.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  fs.writeFileSync(sbomPath, `${JSON.stringify(sbom, null, 2)}\n`, 'utf8');
  fs.writeFileSync(attestationPath, `${JSON.stringify(attestation, null, 2)}\n`, 'utf8');

  return {
    ok: verification.ok,
    outputDir,
    manifestPath,
    sbomPath,
    attestationPath,
    sourceTreeHash: manifest.sourceTreeHash,
    fileCount: manifest.fileCount,
    verification,
    generatedSigningPrivateKeyPem: signed.privateKeyPem || null
  };
}
