import fs from 'node:fs';
import path from 'node:path';

import { fetchAndVerifySurfaceIdentity } from './surface-identity.mjs';
import { verifyProvenanceAttestation } from './release-provenance.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readString(value) {
  return String(value ?? '').trim();
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function loadExpectedArtifact(options = {}) {
  const attestationFile = readString(options.artifactAttestationFile);
  if (!attestationFile) {
    return {
      ok: false,
      reason: 'artifact_attestation_missing',
      attestationFile: null,
      signature: { ok: false, reason: 'artifact_attestation_missing' },
      artifact: null
    };
  }
  const attestation = readJson(attestationFile, null);
  if (!attestation) {
    return {
      ok: false,
      reason: 'artifact_attestation_invalid',
      attestationFile,
      signature: { ok: false, reason: 'artifact_attestation_invalid' },
      artifact: null
    };
  }
  const signature = verifyProvenanceAttestation(attestation);
  const artifact = attestation?.artifact || null;
  return {
    ok: signature.ok && Boolean(artifact?.sha256 && Number.isFinite(artifact?.sizeBytes)),
    reason: signature.ok ? (artifact ? 'loaded' : 'artifact_missing') : signature.reason,
    attestationFile: path.resolve(attestationFile),
    signature,
    artifact,
    attestation
  };
}

export async function verifyRemoteSurfaceIdentity(surfaceUrl, options = {}) {
  const expected = loadExpectedArtifact(options);
  const fetchResult = await fetchAndVerifySurfaceIdentity(surfaceUrl, expected.ok ? {
    expectedArtifactSha256: expected.artifact.sha256,
    expectedArtifactSizeBytes: expected.artifact.sizeBytes,
    headers: options.headers || {}
  } : {
    headers: options.headers || {}
  });
  const remoteArtifact = fetchResult.document?.artifact || null;
  const attestationMatch = Boolean(expected.ok && remoteArtifact)
    && remoteArtifact.sha256 === expected.artifact.sha256
    && remoteArtifact.sizeBytes === expected.artifact.sizeBytes;
  return {
    ok: expected.ok && fetchResult.ok && attestationMatch,
    reason: expected.ok ? (fetchResult.ok ? (attestationMatch ? 'verified' : 'artifact_attestation_mismatch') : fetchResult.verification?.reason || 'surface_fetch_failed') : expected.reason,
    surfaceUrl,
    expected,
    fetchResult,
    attestationMatch,
    remoteArtifact
  };
}

export async function writeRemoteSurfaceVerificationBundle(rootDir, outputDir, surfaceUrl, options = {}) {
  ensureDirectory(outputDir);
  const verification = await verifyRemoteSurfaceIdentity(surfaceUrl, options);
  const verifyFile = path.join(outputDir, 'REMOTE_SURFACE_VERIFY.json');
  fs.writeFileSync(verifyFile, `${JSON.stringify(verification, null, 2)}\n`, 'utf8');
  return {
    ok: verification.ok,
    outputDir,
    verifyFile,
    verification
  };
}
