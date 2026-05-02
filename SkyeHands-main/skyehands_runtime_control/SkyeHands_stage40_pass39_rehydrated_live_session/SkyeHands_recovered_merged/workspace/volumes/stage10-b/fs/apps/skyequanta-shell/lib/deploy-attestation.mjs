import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { getPublicUrls, getStackConfig } from '../bin/config.mjs';
import { buildReleaseStamp } from './release-stamp.mjs';
import { collectSourceInventory, signProvenancePayload, verifyProvenanceAttestation, writeReleaseProvenanceBundle } from './release-provenance.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function readJsonIfExists(filePath, fallback = null) {
  if (!filePath || !fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(item => canonicalJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function buildDeploymentIdentity(config, options = {}) {
  const urls = getPublicUrls(config);
  const releaseStamp = buildReleaseStamp(config, { releaseVersion: options.releaseVersion });
  const sourceInventory = collectSourceInventory(config.rootDir);
  return {
    generatedAt: new Date().toISOString(),
    environment: String(options.environment || process.env.SKYEQUANTA_DEPLOY_ENV || 'local-proof').trim() || 'local-proof',
    host: config.host,
    bridgePort: config.bridge.port,
    publicUrls: urls,
    releaseVersion: releaseStamp.releaseVersion,
    rootPackage: releaseStamp.rootPackage,
    shellPackage: releaseStamp.shellPackage,
    highestPassingStage: releaseStamp.highestPassingStage,
    sourceTreeHash: sourceInventory.sourceTreeHash,
    sourceFileCount: sourceInventory.fileCount,
    proofArtifactCount: releaseStamp.proofArtifactCount,
    runtimeContractUrl: urls.runtimeContract,
    deployTarget: String(options.deployTarget || process.env.SKYEQUANTA_DEPLOY_TARGET || 'self-hosted').trim() || 'self-hosted'
  };
}

export function writeDeploymentAttestationBundle(rootDir, outputDir, options = {}) {
  ensureDirectory(outputDir);
  const config = getStackConfig(options.env || process.env);
  const deploymentIdentity = buildDeploymentIdentity(config, options);
  const provenanceDir = path.join(outputDir, 'provenance-source');
  const provenanceBundle = writeReleaseProvenanceBundle(rootDir, provenanceDir, {
    signing: { generateKeypair: true }
  });
  const provenanceManifest = readJsonIfExists(provenanceBundle.manifestPath, {});
  const provenanceAttestation = readJsonIfExists(provenanceBundle.attestationPath, {});
  const runtimeState = {
    remoteExecutorState: readJsonIfExists(config.paths.remoteExecutorStateFile, null),
    runtimeRepair: readJsonIfExists(path.join(rootDir, '.skyequanta', 'runtime-dependency-repair.json'), null)
  };
  const unsignedPayload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    deploymentIdentity,
    provenance: {
      manifestSha256: sha256Text(canonicalJson(provenanceManifest)),
      sourceTreeHash: provenanceBundle.sourceTreeHash,
      attestationPublicKeyFingerprint: provenanceBundle.verification.publicKeyFingerprint || null,
      attestationSha256: sha256Text(canonicalJson(provenanceAttestation))
    },
    runtimeState,
    boundFiles: {
      provenanceManifest: path.relative(outputDir, provenanceBundle.manifestPath).replace(/\\/g, '/'),
      provenanceAttestation: path.relative(outputDir, provenanceBundle.attestationPath).replace(/\\/g, '/'),
      provenanceSbom: path.relative(outputDir, provenanceBundle.sbomPath).replace(/\\/g, '/')
    }
  };
  const signed = signProvenancePayload(unsignedPayload, { generateKeypair: true });
  const verification = verifyProvenanceAttestation(signed.attestation);
  const attestationFile = path.join(outputDir, 'DEPLOYMENT_ATTESTATION.json');
  const verifyFile = path.join(outputDir, 'DEPLOYMENT_ATTESTATION_VERIFY.json');
  fs.writeFileSync(attestationFile, `${JSON.stringify(signed.attestation, null, 2)}\n`, 'utf8');
  fs.writeFileSync(verifyFile, `${JSON.stringify(verification, null, 2)}\n`, 'utf8');
  return {
    ok: verification.ok,
    outputDir,
    attestationFile,
    verifyFile,
    provenanceBundle,
    deploymentIdentity,
    verification,
    privateKeyPem: signed.privateKeyPem || null
  };
}
