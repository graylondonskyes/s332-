import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { signProvenancePayload, verifyProvenanceAttestation, writeReleaseProvenanceBundle } from './release-provenance.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

export function describeArtifact(filePath) {
  const absolute = path.resolve(filePath);
  const stat = fs.statSync(absolute);
  return {
    path: absolute,
    relativePath: path.basename(absolute),
    sizeBytes: stat.size,
    sha256: sha256File(absolute),
    modifiedAt: stat.mtime.toISOString()
  };
}

export function writeArtifactAttestationBundle(rootDir, artifactFile, outputDir, options = {}) {
  const artifact = describeArtifact(artifactFile);
  ensureDirectory(outputDir);
  const provenanceDir = path.join(outputDir, 'provenance-source');
  const provenanceBundle = writeReleaseProvenanceBundle(rootDir, provenanceDir, {
    signing: { generateKeypair: true }
  });
  const unsignedPayload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    productName: String(options.productName || 'SkyeQuantaCore').trim() || 'SkyeQuantaCore',
    environment: String(options.environment || process.env.SKYEQUANTA_DEPLOY_ENV || 'local-proof').trim() || 'local-proof',
    deployTarget: String(options.deployTarget || process.env.SKYEQUANTA_DEPLOY_TARGET || 'self-hosted').trim() || 'self-hosted',
    artifact,
    provenance: {
      sourceTreeHash: provenanceBundle.sourceTreeHash,
      manifestPath: path.relative(outputDir, provenanceBundle.manifestPath).replace(/\\/g, '/'),
      sbomPath: path.relative(outputDir, provenanceBundle.sbomPath).replace(/\\/g, '/'),
      attestationPath: path.relative(outputDir, provenanceBundle.attestationPath).replace(/\\/g, '/')
    }
  };
  const signed = signProvenancePayload(unsignedPayload, { generateKeypair: true });
  const attestationFile = path.join(outputDir, 'ARTIFACT_ATTESTATION.json');
  const verifyFile = path.join(outputDir, 'ARTIFACT_ATTESTATION_VERIFY.json');
  fs.writeFileSync(attestationFile, `${JSON.stringify(signed.attestation, null, 2)}\n`, 'utf8');
  const verification = verifyArtifactAttestation(attestationFile, artifactFile);
  fs.writeFileSync(verifyFile, `${JSON.stringify(verification, null, 2)}\n`, 'utf8');
  return {
    ok: verification.ok,
    outputDir,
    attestationFile,
    verifyFile,
    provenanceBundle,
    verification,
    privateKeyPem: signed.privateKeyPem || null
  };
}

export function verifyArtifactAttestation(attestationFile, artifactFile) {
  const attestation = readJson(attestationFile, null);
  if (!attestation) {
    return { ok: false, reason: 'attestation_missing' };
  }
  const signature = verifyProvenanceAttestation(attestation);
  const artifact = describeArtifact(artifactFile);
  const matches = signature.ok && attestation?.artifact?.sha256 === artifact.sha256 && attestation?.artifact?.sizeBytes === artifact.sizeBytes;
  return {
    ok: matches,
    reason: matches ? 'verified' : (signature.ok ? 'artifact_mismatch' : signature.reason),
    signature,
    artifact,
    attestedArtifact: attestation?.artifact || null
  };
}
