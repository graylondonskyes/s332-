#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { appendAuditEvent, ensureGovernanceStores } from '../lib/governance-manager.mjs';
import { assertCheck } from './provider-proof-helpers.mjs';
import { createProofOpsBundle, validateEvidencePack, verifyProofOpsAttestation, validateRedactedExport } from '../lib/proofops.mjs';

function parseArgs(argv) {
  return {
    strict: argv.includes('--strict')
  };
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseConfig = getStackConfig(process.env);
  ensureRuntimeState(baseConfig, process.env);
  ensureGovernanceStores(baseConfig);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section49-proofops.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_49_PROOFOPS.json');
  const outputDir = path.join(config.rootDir, 'dist', 'section49', 'proofops-bundle');

  appendAuditEvent(config, {
    action: 'section49-proofops-start',
    outcome: 'success',
    actorType: 'proof',
    actorId: 'section49-proofops',
    tenantId: 'local',
    workspaceId: 'section49',
    detail: { phase: 'initialization', section: 49 }
  });

  const bundle = createProofOpsBundle(config.rootDir, { outputDir });
  const validation = validateEvidencePack(bundle.bundleFile);
  const attestation = verifyProofOpsAttestation(bundle.attestationFile, bundle.bundleFile);
  const redacted = validateRedactedExport(bundle.redactedBundleFile, config.rootDir, { requiredReplayRefs: 1, requireAuditVerification: true });

  const missingArtifactDir = path.join(outputDir, 'failure-missing-artifact');
  fs.rmSync(missingArtifactDir, { recursive: true, force: true });
  fs.mkdirSync(missingArtifactDir, { recursive: true });
  for (const name of fs.readdirSync(outputDir)) {
    const source = path.join(outputDir, name);
    if (name === 'failure-missing-artifact') continue;
    const target = path.join(missingArtifactDir, name);
    fs.cpSync(source, target, { recursive: true });
  }
  fs.rmSync(path.join(missingArtifactDir, 'hostile-checks.json'), { force: true });
  const missingArtifactFailure = validateEvidencePack(path.join(missingArtifactDir, 'evidence-pack.json'));

  const tamperDir = path.join(outputDir, 'failure-tampered-attestation');
  fs.rmSync(tamperDir, { recursive: true, force: true });
  fs.mkdirSync(tamperDir, { recursive: true });
  fs.copyFileSync(bundle.bundleFile, path.join(tamperDir, 'evidence-pack.json'));
  const tamperedAttestationPath = path.join(tamperDir, 'evidence-attestation.json');
  const tamperedAttestation = JSON.parse(fs.readFileSync(bundle.attestationFile, 'utf8'));
  tamperedAttestation.bundleSha256 = 'deadbeef' + String(tamperedAttestation.bundleSha256 || '').slice(8);
  writeJson(tamperedAttestationPath, tamperedAttestation);
  const tamperedAttestationFailure = verifyProofOpsAttestation(tamperedAttestationPath, path.join(tamperDir, 'evidence-pack.json'));

  const badRedactionDir = path.join(outputDir, 'failure-bad-redaction');
  fs.rmSync(badRedactionDir, { recursive: true, force: true });
  fs.mkdirSync(badRedactionDir, { recursive: true });
  const badRedactedPayload = JSON.parse(fs.readFileSync(bundle.redactedBundleFile, 'utf8'));
  badRedactedPayload.policyTrace = { authorization: 'proof-secret-token', decision: 'allow' };
  const badRedactedFile = path.join(badRedactionDir, 'evidence-pack-redacted.json');
  writeJson(badRedactedFile, badRedactedPayload);
  const badRedactionFailure = validateRedactedExport(badRedactedFile, config.rootDir, { requiredReplayRefs: 1, requireAuditVerification: true });

  const missingRefsDir = path.join(outputDir, 'failure-missing-refs');
  fs.rmSync(missingRefsDir, { recursive: true, force: true });
  fs.mkdirSync(missingRefsDir, { recursive: true });
  const invalidRedacted = JSON.parse(fs.readFileSync(bundle.redactedBundleFile, 'utf8'));
  delete invalidRedacted.auditVerification;
  invalidRedacted.replayRefs = [];
  const invalidRedactedFile = path.join(missingRefsDir, 'evidence-pack-redacted.json');
  writeJson(invalidRedactedFile, invalidRedacted);
  const missingRefsFailure = validateRedactedExport(invalidRedactedFile, config.rootDir, { requiredReplayRefs: 1, requireAuditVerification: true });

  appendAuditEvent(config, {
    action: 'section49-proofops-complete',
    outcome: validation.ok && attestation.ok && redacted.ok ? 'success' : 'failure',
    actorType: 'proof',
    actorId: 'section49-proofops',
    tenantId: 'local',
    workspaceId: 'section49',
    detail: {
      bundle: validation.ok,
      attestation: attestation.ok,
      redacted: redacted.ok
    }
  });

  const checks = [
    assertCheck(bundle.ok, 'Run a real code change, run regression checks, build an evidence pack, generate attestation, generate redacted procurement-safe export, and verify hashes', { bundle, validation, attestation, redacted }),
    assertCheck(validation.ok, 'Add proof pipeline that can emit baseline, post-change verification, hostile checks, rollback check, and evidence export for a run', validation),
    assertCheck(fs.existsSync(path.join(outputDir, 'artifact-hashes.json')) && fs.existsSync(path.join(outputDir, 'audit-verification.json')) && fs.existsSync(path.join(outputDir, 'replay', 'replay-refs.json')) && fs.existsSync(path.join(outputDir, 'policy-traces.json')), 'Add evidence packager for logs, diffs, replay refs, test results, audit verification, artifact hashes, and policy traces', {
      artifactHashes: path.join(outputDir, 'artifact-hashes.json'),
      auditVerification: path.join(outputDir, 'audit-verification.json'),
      replayRefs: path.join(outputDir, 'replay', 'replay-refs.json'),
      policyTraces: path.join(outputDir, 'policy-traces.json')
    }),
    assertCheck(attestation.ok, 'Add attestation generation for release or deployable change sets', attestation),
    assertCheck(redacted.ok, 'Add redacted procurement-safe export mode', redacted),
    assertCheck(fs.existsSync(path.join(outputDir, 'proofops-trust-surface.html')), 'Add UI trust surface showing proof complete, missing evidence, export bundle, and chain verification', { trustSurface: path.join(outputDir, 'proofops-trust-surface.html') }),
    assertCheck(!missingArtifactFailure.ok && missingArtifactFailure.reason === 'missing_artifacts', 'Remove one evidence artifact and prove pack validation fails', missingArtifactFailure),
    assertCheck(!tamperedAttestationFailure.ok, 'Tamper one hash and prove attestation fails', tamperedAttestationFailure),
    assertCheck(!badRedactionFailure.ok, 'Redact incorrectly and prove export validator fails', badRedactionFailure),
    assertCheck(!missingRefsFailure.ok, 'Attempt export with missing replay/audit references and fail loudly', missingRefsFailure)
  ];

  let payload = {
    section: 49,
    label: 'section-49-proofops',
    generatedAt: new Date().toISOString(),
    pass: checks.every(item => item.pass),
    strict: options.strict,
    proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section49-proofops.mjs --strict',
    smokeCommand: 'bash scripts/smoke-section49-proofops.sh',
    checks,
    evidence: {
      bundle,
      validation,
      attestation,
      redacted,
      failureProofs: {
        missingArtifactFailure,
        tamperedAttestationFailure,
        badRedactionFailure,
        missingRefsFailure
      },
      artifacts: {
        bundleFile: path.relative(config.rootDir, bundle.bundleFile),
        attestationFile: path.relative(config.rootDir, bundle.attestationFile),
        redactedBundleFile: path.relative(config.rootDir, bundle.redactedBundleFile),
        trustSurfaceFile: path.relative(config.rootDir, bundle.trustSurfaceFile)
      }
    }
  };

  payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section49-proofops.mjs');
  if (options.strict && !payload.pass) {
    throw new Error('Section 49 ProofOps proof failed in strict mode.');
  }
  console.log(JSON.stringify(payload, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
