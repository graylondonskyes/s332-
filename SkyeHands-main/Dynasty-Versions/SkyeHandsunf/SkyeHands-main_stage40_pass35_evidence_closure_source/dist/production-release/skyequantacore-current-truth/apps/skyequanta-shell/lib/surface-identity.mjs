import fs from 'node:fs';
import path from 'node:path';

import { getPublicUrls } from '../bin/config.mjs';
import { describeArtifact } from './artifact-attestation.mjs';
import { buildDeploymentIdentity } from './deploy-attestation.mjs';
import { signProvenancePayload, verifyProvenanceAttestation } from './release-provenance.mjs';

function readString(value) {
  return String(value ?? '').trim();
}

function normalizeRoute(value, fallback = '/api/surface-identity') {
  const normalized = readString(value) || fallback;
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function ensureArray(values) {
  return Array.isArray(values) ? values.filter(Boolean) : [];
}

function resolveLatestFile(candidates = []) {
  const existing = ensureArray(candidates)
    .map(candidate => path.resolve(String(candidate)))
    .filter(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
    .map(candidate => ({ file: candidate, mtimeMs: fs.statSync(candidate).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return existing[0]?.file || null;
}

export function resolveSurfaceArtifactFile(rootDir, options = {}) {
  const explicit = readString(options.artifactFile || options.env?.SKYEQUANTA_SURFACE_ARTIFACT || process.env.SKYEQUANTA_SURFACE_ARTIFACT);
  if (explicit && fs.existsSync(explicit)) return path.resolve(explicit);
  const distReleaseDir = path.join(rootDir, 'dist', 'release');
  const distCandidates = fs.existsSync(distReleaseDir)
    ? fs.readdirSync(distReleaseDir)
        .filter(entry => entry.endsWith('.tar.gz') || entry.endsWith('.tgz') || entry.endsWith('.zip'))
        .map(entry => path.join(distReleaseDir, entry))
    : [];
  const fallbackCandidates = [
    path.join(rootDir, 'skyequantacore-current-truth-section42.tar.gz'),
    path.join(rootDir, 'skyequantacore-current-truth.tar.gz')
  ];
  return resolveLatestFile([...distCandidates, ...fallbackCandidates]);
}

export function buildSurfaceIdentityDocument(rootDir, config, options = {}) {
  const publicUrls = getPublicUrls(config);
  const routePath = normalizeRoute(options.routePath || options.surfacePath);
  const bridgeBase = readString(options.surfaceBaseUrl || publicUrls.bridge) || publicUrls.bridge;
  const surfaceUrl = new URL(routePath, bridgeBase).toString();
  const artifactFile = resolveSurfaceArtifactFile(rootDir, options);
  const artifact = artifactFile ? describeArtifact(artifactFile) : null;
  const unsignedPayload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    productName: readString(options.productName || config.productName) || 'SkyeQuantaCore',
    companyName: readString(options.companyName || config.companyName) || null,
    environment: readString(options.environment || process.env.SKYEQUANTA_DEPLOY_ENV || 'local-proof') || 'local-proof',
    deployTarget: readString(options.deployTarget || process.env.SKYEQUANTA_DEPLOY_TARGET || 'self-hosted') || 'self-hosted',
    surface: {
      routePath,
      surfaceUrl,
      bridgeUrl: publicUrls.bridge,
      runtimeContractUrl: publicUrls.runtimeContract,
      productIdentityUrl: publicUrls.productIdentity,
      verificationMode: artifact ? 'artifact-bound-live-surface' : 'deployment-surface'
    },
    deploymentIdentity: buildDeploymentIdentity(config, options),
    artifact,
    evidence: {
      artifactPresent: Boolean(artifact),
      artifactRelativePath: artifact ? path.relative(rootDir, artifact.path).replace(/\\/g, '/') : null,
      allowedHosts: [config.host, '127.0.0.1', 'localhost']
    }
  };
  const signed = signProvenancePayload(unsignedPayload, { generateKeypair: true });
  return {
    document: signed.attestation,
    artifactFile,
    privateKeyPem: signed.privateKeyPem || null
  };
}

export function verifySurfaceIdentityDocument(document, options = {}) {
  const signature = verifyProvenanceAttestation(document);
  if (!signature.ok) {
    return { ok: false, reason: signature.reason, signature, artifact: null, attestedArtifact: document?.artifact || null };
  }
  let artifact = null;
  let artifactMatches = true;
  let artifactReason = 'not_checked';
  const expectedArtifactFile = readString(options.expectedArtifactFile);
  const expectedArtifactSha256 = readString(options.expectedArtifactSha256);
  const expectedArtifactSizeBytes = Number.isFinite(options.expectedArtifactSizeBytes) ? Number(options.expectedArtifactSizeBytes) : null;
  const attestedArtifact = document?.artifact || null;
  if (expectedArtifactFile) {
    artifact = describeArtifact(expectedArtifactFile);
    artifactMatches = Boolean(attestedArtifact)
      && attestedArtifact.sha256 === artifact.sha256
      && attestedArtifact.sizeBytes === artifact.sizeBytes;
    artifactReason = artifactMatches ? 'artifact_file_verified' : 'artifact_file_mismatch';
  } else if (expectedArtifactSha256) {
    artifactMatches = Boolean(attestedArtifact)
      && attestedArtifact.sha256 === expectedArtifactSha256
      && (expectedArtifactSizeBytes === null || attestedArtifact.sizeBytes === expectedArtifactSizeBytes);
    artifactReason = artifactMatches ? 'artifact_hash_verified' : 'artifact_hash_mismatch';
  }
  return {
    ok: signature.ok && artifactMatches,
    reason: signature.ok ? artifactReason : signature.reason,
    signature,
    artifact,
    attestedArtifact
  };
}

export async function fetchAndVerifySurfaceIdentity(surfaceUrl, options = {}) {
  const response = await fetch(surfaceUrl, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let document = null;
  try {
    document = JSON.parse(text);
  } catch {}
  const verification = document
    ? verifySurfaceIdentityDocument(document, options)
    : { ok: false, reason: 'invalid_json', signature: { ok: false, reason: 'invalid_json' }, artifact: null, attestedArtifact: null };
  return {
    ok: response.ok && verification.ok,
    status: response.status,
    text,
    document,
    verification
  };
}
