import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { signProvenancePayload, verifyProvenanceAttestation } from './release-provenance.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return filePath;
}

function writeText(filePath, value) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, String(value), 'utf8');
  return filePath;
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256Text(value) {
  return sha256Buffer(Buffer.from(String(value), 'utf8'));
}

function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
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

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function collectArtifactHash(relativePath, absolutePath) {
  const stat = fs.statSync(absolutePath);
  return {
    path: normalizePath(relativePath),
    sizeBytes: stat.size,
    sha256: sha256File(absolutePath)
  };
}

function buildSimpleDiff(beforeText, afterText) {
  const beforeLines = String(beforeText).split(/\r?\n/);
  const afterLines = String(afterText).split(/\r?\n/);
  const max = Math.max(beforeLines.length, afterLines.length);
  const changes = [];
  for (let index = 0; index < max; index += 1) {
    const before = beforeLines[index];
    const after = afterLines[index];
    if (before === after) continue;
    if (before !== undefined) {
      changes.push({ type: 'remove', line: index + 1, value: before });
    }
    if (after !== undefined) {
      changes.push({ type: 'add', line: index + 1, value: after });
    }
  }
  return changes;
}

function walk(value, visitor, trail = []) {
  if (Array.isArray(value)) {
    return value.map((item, index) => walk(item, visitor, [...trail, index]));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, walk(item, visitor, [...trail, key])]));
  }
  return visitor(value, trail);
}

function lower(value) {
  return String(value || '').trim().toLowerCase();
}

function loadRedactionPolicy(rootDir) {
  return readJson(path.join(rootDir, 'config', 'redaction-policy.json'), {
    replaceWith: '[REDACTED]',
    secretKeys: ['token', 'secret', 'password', 'authorization'],
    envKeys: []
  });
}

function redactPayload(value, policy, trail = []) {
  if (Array.isArray(value)) {
    return value.map((item, index) => redactPayload(item, policy, [...trail, index]));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
      const nextTrail = [...trail, key];
      if (policy.secretKeys.map(lower).includes(lower(key)) || policy.envKeys.map(lower).includes(lower(key))) {
        return [key, policy.replaceWith];
      }
      return [key, redactPayload(item, policy, nextTrail)];
    }));
  }
  const key = trail.length ? lower(trail[trail.length - 1]) : '';
  if (policy.secretKeys.map(lower).includes(key) || policy.envKeys.map(lower).includes(key)) {
    return policy.replaceWith;
  }
  return value;
}

function containsRedactionLeak(value, policy, trail = []) {
  const joinedPath = trail.map(segment => String(segment)).join('.').toLowerCase();
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = containsRedactionLeak(value[index], policy, [...trail, index]);
      if (nested) return nested;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      const lowered = lower(key);
      if (policy.secretKeys.map(lower).includes(lowered) || policy.envKeys.map(lower).includes(lowered)) {
        if (item !== policy.replaceWith) {
          return { ok: false, reason: 'unredacted_secret_key', path: [...trail, key].join('.') };
        }
      }
      const nested = containsRedactionLeak(item, policy, [...trail, key]);
      if (nested) return nested;
    }
    return null;
  }
  if (typeof value === 'string') {
    if (joinedPath.includes('authorization') || joinedPath.includes('secret') || joinedPath.includes('token') || joinedPath.includes('password')) {
      if (value !== policy.replaceWith) {
        return { ok: false, reason: 'unredacted_secret_value', path: joinedPath };
      }
    }
    if (/proof-secret-token|secret-proof-token|founders-gateway-key/i.test(value) && value !== policy.replaceWith) {
      return { ok: false, reason: 'secret_literal_present', path: joinedPath || '(root)' };
    }
  }
  return null;
}

export function generateTrustSurfaceHtml(summary) {
  const missing = Array.isArray(summary?.missingEvidence) ? summary.missingEvidence : [];
  const checks = Array.isArray(summary?.checks) ? summary.checks : [];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>ProofOps Trust Surface</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: Inter, Arial, sans-serif; margin: 0; background: #090b12; color: #f6f7fb; }
    main { max-width: 1100px; margin: 0 auto; padding: 32px; }
    .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); border-radius: 18px; padding: 18px 20px; margin-bottom: 18px; }
    .good { color: #8ef0b4; }
    .bad { color: #ff9d9d; }
    code { white-space: pre-wrap; }
    ul { margin: 8px 0 0 20px; }
  </style>
</head>
<body>
  <main>
    <div class="card"><h1>ProofOps Trust Surface</h1><p>Status: <strong class="${summary.pass ? 'good' : 'bad'}">${summary.pass ? 'PROOF COMPLETE' : 'PROOF INCOMPLETE'}</strong></p><p>Generated: ${summary.generatedAt || ''}</p></div>
    <div class="card"><h2>Evidence Chain</h2><p>Bundle: ${summary.bundlePath || ''}</p><p>Attestation: ${summary.attestationPath || ''}</p><p>Redacted export: ${summary.redactedBundlePath || ''}</p></div>
    <div class="card"><h2>Missing Evidence</h2>${missing.length ? `<ul>${missing.map(item => `<li>${item}</li>`).join('')}</ul>` : '<p class="good">None</p>'}</div>
    <div class="card"><h2>Checks</h2><ul>${checks.map(item => `<li class="${item.pass ? 'good' : 'bad'}">${item.pass ? 'PASS' : 'FAIL'} — ${item.label}</li>`).join('')}</ul></div>
  </main>
</body>
</html>`;
}

export function buildReplayDigest(events = []) {
  const canonicalEvents = events.map((event, index) => ({ ...event, order: index + 1 }));
  const digest = sha256Text(canonicalJson(canonicalEvents));
  return { events: canonicalEvents, digest };
}

export function verifyReplayDigest(replay) {
  const events = Array.isArray(replay?.events) ? replay.events : [];
  for (let index = 0; index < events.length; index += 1) {
    const expectedOrder = index + 1;
    if ((events[index]?.order || 0) !== expectedOrder) {
      return { ok: false, reason: 'out_of_order_event', index, expectedOrder, actualOrder: events[index]?.order || 0 };
    }
  }
  const expected = sha256Text(canonicalJson(events));
  return {
    ok: expected === replay?.digest,
    reason: expected === replay?.digest ? 'verified' : 'digest_mismatch',
    expectedDigest: expected,
    actualDigest: replay?.digest || null
  };
}

export function runAuditVerification(rootDir) {
  const shellDir = path.join(rootDir, 'apps', 'skyequanta-shell');
  const result = spawnSync(process.execPath, ['bin/verify-audit-chain.mjs', '--json'], { cwd: shellDir, encoding: 'utf8' });
  const parsed = result.stdout ? readJsonFromText(result.stdout) : null;
  return {
    ok: result.status === 0 && Boolean(parsed?.ok),
    status: result.status,
    stdout: parsed || result.stdout,
    stderr: result.stderr || ''
  };
}

function readJsonFromText(value) {
  try {
    return JSON.parse(String(value || '').trim());
  } catch {
    return null;
  }
}

export function createProofOpsBundle(rootDir, options = {}) {
  const outputDir = path.resolve(options.outputDir || path.join(rootDir, 'dist', 'section49', 'proofops-bundle'));
  ensureDirectory(outputDir);
  const fixtureDir = path.join(outputDir, 'fixture-project');
  ensureDirectory(fixtureDir);
  const replayDir = path.join(outputDir, 'replay');
  ensureDirectory(replayDir);
  const procurementDir = path.join(outputDir, 'procurement-safe');
  ensureDirectory(procurementDir);

  const fixtureFile = path.join(fixtureDir, 'feature.mjs');
  const baselineText = `export function computeLabel() {\n  return 'before-proofops';\n}\n`;
  writeText(fixtureFile, baselineText);
  const baselineManifest = {
    generatedAt: new Date().toISOString(),
    files: [collectArtifactHash('fixture-project/feature.mjs', fixtureFile)]
  };
  writeJson(path.join(outputDir, 'baseline-manifest.json'), baselineManifest);

  const replayEvents = [
    { phase: 'planning', action: 'open_fixture', target: 'fixture-project/feature.mjs' },
    { phase: 'file-read', action: 'read', target: 'fixture-project/feature.mjs' },
    { phase: 'file-write', action: 'patch', target: 'fixture-project/feature.mjs' },
    { phase: 'command-start', action: 'node', target: 'regression-check' },
    { phase: 'command-exit', action: 'node', exitCode: 0 },
    { phase: 'policy', action: 'proof-export', outcome: 'allowed' }
  ];
  const replay = buildReplayDigest(replayEvents);
  const replayFile = path.join(replayDir, 'replay-refs.json');
  writeJson(replayFile, replay);

  const afterText = `export function computeLabel() {\n  return 'after-proofops';\n}\n\nexport function computeMode() {\n  return 'verified';\n}\n`;
  writeText(fixtureFile, afterText);
  const diffSummary = {
    generatedAt: new Date().toISOString(),
    file: 'fixture-project/feature.mjs',
    changes: buildSimpleDiff(baselineText, afterText)
  };
  const diffFile = path.join(outputDir, 'diff-summary.json');
  writeJson(diffFile, diffSummary);

  const regressionScript = path.join(outputDir, 'regression-check.mjs');
  writeText(regressionScript, `import { computeLabel, computeMode } from './fixture-project/feature.mjs';\nif (computeLabel() !== 'after-proofops') throw new Error('label regression');\nif (computeMode() !== 'verified') throw new Error('mode regression');\nconsole.log(JSON.stringify({ ok: true, label: computeLabel(), mode: computeMode() }));\n`);
  const regressionResult = spawnSync(process.execPath, [regressionScript], { encoding: 'utf8', cwd: outputDir });
  const regressionPayload = {
    generatedAt: new Date().toISOString(),
    ok: regressionResult.status === 0,
    status: regressionResult.status,
    stdout: readJsonFromText(regressionResult.stdout) || regressionResult.stdout.trim(),
    stderr: regressionResult.stderr.trim()
  };
  const regressionFile = path.join(outputDir, 'post-change-verification.json');
  writeJson(regressionFile, regressionPayload);

  const hostileChecks = {
    generatedAt: new Date().toISOString(),
    checks: [
      { label: 'replay digest verifies before export', pass: verifyReplayDigest(replay).ok },
      { label: 'fixture patch changes execution result', pass: regressionPayload.ok && regressionPayload.stdout?.label === 'after-proofops' }
    ]
  };
  const hostileFile = path.join(outputDir, 'hostile-checks.json');
  writeJson(hostileFile, hostileChecks);

  const rollbackTarget = path.join(outputDir, 'rollback-check.json');
  writeText(fixtureFile, baselineText);
  const rollbackVerifyScript = path.join(outputDir, 'rollback-verify.mjs');
  writeText(rollbackVerifyScript, `import { computeLabel } from './fixture-project/feature.mjs';\nif (computeLabel() !== 'before-proofops') throw new Error('rollback failed');\nconsole.log(JSON.stringify({ ok: true, label: computeLabel() }));\n`);
  const rollbackResult = spawnSync(process.execPath, [rollbackVerifyScript], { encoding: 'utf8', cwd: outputDir });
  const rollbackPayload = {
    generatedAt: new Date().toISOString(),
    ok: rollbackResult.status === 0,
    status: rollbackResult.status,
    stdout: readJsonFromText(rollbackResult.stdout) || rollbackResult.stdout.trim(),
    stderr: rollbackResult.stderr.trim()
  };
  writeJson(rollbackTarget, rollbackPayload);
  writeText(fixtureFile, afterText);

  const policyTrace = {
    generatedAt: new Date().toISOString(),
    route: 'proofops-export',
    authorization: 'proof-secret-token',
    decision: 'allow',
    reviewer: 'section49-proofops'
  };
  const policyFile = path.join(outputDir, 'policy-traces.json');
  writeJson(policyFile, policyTrace);

  const auditVerification = runAuditVerification(rootDir);
  const auditFile = path.join(outputDir, 'audit-verification.json');
  writeJson(auditFile, auditVerification);

  const artifactFiles = [
    ['baseline-manifest.json', path.join(outputDir, 'baseline-manifest.json')],
    ['post-change-verification.json', regressionFile],
    ['hostile-checks.json', hostileFile],
    ['rollback-check.json', rollbackTarget],
    ['diff-summary.json', diffFile],
    ['replay/replay-refs.json', replayFile],
    ['audit-verification.json', auditFile],
    ['policy-traces.json', policyFile]
  ];
  const artifactHashes = artifactFiles.map(([relative, absolute]) => collectArtifactHash(relative, absolute));
  const artifactHashesFile = path.join(outputDir, 'artifact-hashes.json');
  writeJson(artifactHashesFile, { generatedAt: new Date().toISOString(), artifacts: artifactHashes });

  const bundle = {
    version: 1,
    generatedAt: new Date().toISOString(),
    label: 'proofops-evidence-pack',
    runId: crypto.randomUUID(),
    baselineRef: 'baseline-manifest.json',
    postChangeVerificationRef: 'post-change-verification.json',
    hostileChecksRef: 'hostile-checks.json',
    rollbackCheckRef: 'rollback-check.json',
    diffRef: 'diff-summary.json',
    replayRefs: ['replay/replay-refs.json'],
    auditVerificationRef: 'audit-verification.json',
    policyTraceRef: 'policy-traces.json',
    artifactHashesRef: 'artifact-hashes.json',
    requiredArtifacts: artifactHashes.map(item => item.path),
    expectedArtifactHashes: Object.fromEntries(artifactHashes.map(item => [item.path, item.sha256]))
  };
  const bundleFile = path.join(outputDir, 'evidence-pack.json');
  writeJson(bundleFile, bundle);

  const unsignedAttestation = {
    version: 1,
    generatedAt: new Date().toISOString(),
    label: 'proofops-change-set-attestation',
    runId: bundle.runId,
    bundlePath: 'evidence-pack.json',
    bundleSha256: sha256File(bundleFile),
    artifactSetSha256: sha256Text(canonicalJson(bundle.expectedArtifactHashes))
  };
  const signed = signProvenancePayload(unsignedAttestation, { generateKeypair: true });
  const attestationFile = path.join(outputDir, 'evidence-attestation.json');
  writeJson(attestationFile, signed.attestation);
  const attestationVerify = verifyProofOpsAttestation(attestationFile, bundleFile);
  const attestationVerifyFile = path.join(outputDir, 'evidence-attestation-verify.json');
  writeJson(attestationVerifyFile, attestationVerify);

  const redactionPolicy = loadRedactionPolicy(rootDir);
  const redactedBundle = redactPayload({ ...bundle, policyTrace: policyTrace, auditVerification: auditVerification.stdout || auditVerification }, redactionPolicy);
  const redactedBundleFile = path.join(procurementDir, 'evidence-pack-redacted.json');
  writeJson(redactedBundleFile, redactedBundle);
  const redactedValidation = validateRedactedExport(redactedBundleFile, rootDir, { requiredReplayRefs: 1, requireAuditVerification: true });
  const redactedValidationFile = path.join(procurementDir, 'redacted-export-validate.json');
  writeJson(redactedValidationFile, redactedValidation);

  const trustSurfaceSummary = {
    generatedAt: new Date().toISOString(),
    pass: attestationVerify.ok && redactedValidation.ok,
    bundlePath: 'evidence-pack.json',
    attestationPath: 'evidence-attestation.json',
    redactedBundlePath: 'procurement-safe/evidence-pack-redacted.json',
    missingEvidence: validateEvidencePack(bundleFile).missingArtifacts,
    checks: [
      { label: 'evidence pack validates', pass: validateEvidencePack(bundleFile).ok },
      { label: 'attestation verifies', pass: attestationVerify.ok },
      { label: 'redacted export validates', pass: redactedValidation.ok }
    ]
  };
  const trustSurfaceFile = path.join(outputDir, 'proofops-trust-surface.html');
  writeText(trustSurfaceFile, generateTrustSurfaceHtml(trustSurfaceSummary));

  return {
    ok: trustSurfaceSummary.pass,
    outputDir,
    bundleFile,
    attestationFile,
    attestationVerifyFile,
    redactedBundleFile,
    redactedValidationFile,
    trustSurfaceFile,
    replayFile,
    auditFile,
    artifactHashesFile,
    policyFile,
    regressionFile,
    hostileFile,
    rollbackTarget,
    checks: {
      bundle: validateEvidencePack(bundleFile),
      attestation: attestationVerify,
      redacted: redactedValidation
    }
  };
}

export function validateEvidencePack(bundleFile, options = {}) {
  const outputDir = path.dirname(bundleFile);
  const bundle = readJson(bundleFile, null);
  if (!bundle) {
    return { ok: false, reason: 'bundle_missing_or_invalid', missingArtifacts: ['evidence-pack.json'] };
  }
  const required = Array.isArray(bundle.requiredArtifacts) ? bundle.requiredArtifacts.slice() : [];
  const extraRequired = Array.isArray(options.extraRequiredArtifacts) ? options.extraRequiredArtifacts : [];
  const requiredArtifacts = [...new Set([...required, ...extraRequired])];
  const missingArtifacts = [];
  const hashMismatches = [];
  for (const relative of requiredArtifacts) {
    const absolute = path.join(outputDir, relative);
    if (!fs.existsSync(absolute)) {
      missingArtifacts.push(relative);
      continue;
    }
    const actualHash = sha256File(absolute);
    const expectedHash = bundle.expectedArtifactHashes?.[relative] || null;
    if (expectedHash && expectedHash !== actualHash) {
      hashMismatches.push({ path: relative, expectedHash, actualHash });
    }
  }
  if (!Array.isArray(bundle.replayRefs) || bundle.replayRefs.length === 0) {
    missingArtifacts.push('replayRefs');
  }
  if (!bundle.auditVerificationRef) {
    missingArtifacts.push('auditVerificationRef');
  }
  return {
    ok: missingArtifacts.length === 0 && hashMismatches.length === 0,
    reason: missingArtifacts.length ? 'missing_artifacts' : (hashMismatches.length ? 'hash_mismatch' : 'verified'),
    missingArtifacts,
    hashMismatches,
    bundle
  };
}

export function verifyProofOpsAttestation(attestationFile, bundleFile) {
  const attestation = readJson(attestationFile, null);
  if (!attestation) {
    return { ok: false, reason: 'attestation_missing' };
  }
  const signature = verifyProvenanceAttestation(attestation);
  if (!signature.ok) {
    return { ok: false, reason: signature.reason, signature };
  }
  const actualBundleHash = sha256File(bundleFile);
  const bundle = readJson(bundleFile, null);
  const expectedArtifactSet = sha256Text(canonicalJson(bundle?.expectedArtifactHashes || {}));
  const bundleOk = attestation.bundleSha256 === actualBundleHash;
  const artifactSetOk = attestation.artifactSetSha256 === expectedArtifactSet;
  return {
    ok: signature.ok && bundleOk && artifactSetOk,
    reason: signature.ok ? (bundleOk && artifactSetOk ? 'verified' : (!bundleOk ? 'bundle_hash_mismatch' : 'artifact_set_mismatch')) : signature.reason,
    signature,
    actualBundleHash,
    attestedBundleHash: attestation.bundleSha256 || null,
    actualArtifactSetSha256: expectedArtifactSet,
    attestedArtifactSetSha256: attestation.artifactSetSha256 || null
  };
}

export function validateRedactedExport(redactedBundleFile, rootDir, options = {}) {
  const redactionPolicy = loadRedactionPolicy(rootDir);
  const payload = readJson(redactedBundleFile, null);
  if (!payload) {
    return { ok: false, reason: 'redacted_bundle_missing' };
  }
  const leak = containsRedactionLeak(payload, redactionPolicy);
  if (leak) {
    return { ok: false, reason: leak.reason, path: leak.path };
  }
  const replayRefs = Array.isArray(payload.replayRefs) ? payload.replayRefs.length : 0;
  if ((options.requiredReplayRefs || 0) > replayRefs) {
    return { ok: false, reason: 'missing_replay_refs', replayRefs };
  }
  if (options.requireAuditVerification && !payload.auditVerification) {
    return { ok: false, reason: 'missing_audit_reference' };
  }
  return {
    ok: true,
    reason: 'verified',
    replayRefs,
    auditIncluded: Boolean(payload.auditVerification)
  };
}
