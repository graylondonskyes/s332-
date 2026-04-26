import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

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

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(item => canonicalJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function stableHash(value) {
  return sha256Text(canonicalJson(value));
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function getPackPaths(packDir) {
  return {
    packDir,
    manifestFile: path.join(packDir, 'APPARMOR_LIVE_PROOF_PACK.json'),
    expectationsFile: path.join(packDir, 'APPARMOR_LIVE_PROOF_EXPECTATIONS.json')
  };
}

export function loadAppArmorLiveProofPack(packDir) {
  const paths = getPackPaths(packDir);
  const manifest = readJson(paths.manifestFile, null);
  const expectations = readJson(paths.expectationsFile, null);
  return {
    ok: Boolean(manifest && expectations),
    reason: manifest && expectations ? 'loaded' : (!manifest ? 'manifest_missing' : 'expectations_missing'),
    ...paths,
    manifest,
    expectations,
    manifestHash: manifest ? stableHash(manifest) : null,
    expectationsHash: expectations ? stableHash(expectations) : null
  };
}

function fileMapFromManifest(manifest) {
  const entries = Array.isArray(manifest?.files) ? manifest.files : [];
  return Object.fromEntries(entries.map(item => [item.relativePath, item.sha256]));
}

function buildIntegritySnapshot(packDir, manifest) {
  const files = [];
  for (const entry of manifest?.files || []) {
    const absolutePath = path.join(packDir, entry.relativePath);
    files.push({
      relativePath: entry.relativePath,
      exists: fs.existsSync(absolutePath),
      sha256: fs.existsSync(absolutePath) ? sha256File(absolutePath) : null,
      expectedSha256: entry.sha256
    });
  }
  return {
    files,
    missing: files.filter(item => !item.exists).map(item => item.relativePath),
    mismatched: files.filter(item => item.exists && item.sha256 !== item.expectedSha256).map(item => item.relativePath)
  };
}

function buildTrustSurfaceHtml(payload) {
  const rows = (payload.checks || []).map(item => `<tr><td>${escapeHtml(item.label)}</td><td>${item.pass ? 'PASS' : 'FAIL'}</td><td>${escapeHtml(item.reason || '')}</td></tr>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>AppArmor Host Proof Attestation</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { margin: 0; font-family: Inter, Arial, sans-serif; background: #090b12; color: #f5f7fb; }
    main { max-width: 1120px; margin: 0 auto; padding: 32px; }
    .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 18px; padding: 18px 20px; margin-bottom: 18px; }
    .good { color: #87f0b4; }
    .bad { color: #ff9f9f; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; border-bottom: 1px solid rgba(255,255,255,0.08); padding: 10px 8px; }
    code { white-space: pre-wrap; }
  </style>
</head>
<body>
  <main>
    <div class="card">
      <h1>AppArmor Host Proof Attestation</h1>
      <p>Status: <strong class="${payload.ok ? 'good' : 'bad'}">${payload.ok ? 'ATTESTED' : 'DENIED'}</strong></p>
      <p>Report ID: ${escapeHtml(payload.reportId || '')}</p>
      <p>Profile: ${escapeHtml(payload.profileName || '')}</p>
    </div>
    <div class="card">
      <h2>Evidence binding</h2>
      <p>Manifest hash: <code>${escapeHtml(payload.manifestHash || '')}</code></p>
      <p>Expectations hash: <code>${escapeHtml(payload.expectationsHash || '')}</code></p>
      <p>Report hash: <code>${escapeHtml(payload.reportHash || '')}</code></p>
      <p>Attestation verification: <strong class="${payload.attestationVerified ? 'good' : 'bad'}">${payload.attestationVerified ? 'PASS' : 'FAIL'}</strong></p>
    </div>
    <div class="card">
      <h2>Checks</h2>
      <table>
        <thead><tr><th>Check</th><th>Status</th><th>Reason</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </main>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function createFixtureAppArmorHostProofReport(packDir, options = {}) {
  const pack = loadAppArmorLiveProofPack(packDir);
  if (!pack.ok) {
    throw new Error(`Unable to build fixture AppArmor host proof report: ${pack.reason}`);
  }
  const reportId = String(options.reportId || `section45-host-proof-${Date.now()}`);
  const files = fileMapFromManifest(pack.manifest);
  const report = {
    reportId,
    mode: 'fixture',
    generatedAt: new Date().toISOString(),
    generatedBy: 'createFixtureAppArmorHostProofReport',
    manifestHash: pack.manifestHash,
    expectationsHash: pack.expectationsHash,
    bundleVersion: pack.manifest.packVersion,
    profileName: pack.manifest.profileName,
    host: {
      hostname: String(options.hostname || 'fixture-apparmor-host'),
      platform: 'linux',
      kernelRelease: String(options.kernelRelease || '6.8.0-fixture-apparmor'),
      appArmorEnabled: true,
      parserPath: String(options.parserPath || '/usr/sbin/apparmor_parser'),
      aaExecPath: String(options.aaExecPath || '/usr/bin/aa-exec')
    },
    executedAssertions: [
      'profile loads through apparmor_parser',
      'aa-exec launches node under the generated profile',
      'allowed workspace file stays readable',
      'forbidden path read is blocked',
      '/proc/self/attr/current includes the generated profile name'
    ],
    parser: {
      status: 0,
      stdout: 'profile_loaded',
      stderr: ''
    },
    result: {
      status: 0,
      stdout: JSON.stringify({ current: pack.manifest.profileName, allowed: 'section45-allowed', forbiddenRead: 'EACCES' }),
      stderr: ''
    },
    payload: {
      current: pack.manifest.profileName,
      allowed: 'section45-allowed',
      forbiddenRead: 'EACCES'
    },
    forbiddenBlocked: true,
    bundleFileHashes: files,
    notes: {
      fixture: true,
      purpose: 'local attestation smoke for remote AppArmor host-proof intake'
    }
  };
  report.reportHash = stableHash(report);
  return report;
}

export function verifyAppArmorHostProofReport(packDir, reportInput) {
  const pack = loadAppArmorLiveProofPack(packDir);
  if (!pack.ok) {
    return { ok: false, reason: pack.reason, pack };
  }
  const report = typeof reportInput === 'string' ? readJson(reportInput, null) : reportInput;
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    return { ok: false, reason: 'invalid_report', pack, report: null };
  }
  const expectedFiles = fileMapFromManifest(pack.manifest);
  const integrity = buildIntegritySnapshot(packDir, pack.manifest);
  const bundleFileHashes = report.bundleFileHashes && typeof report.bundleFileHashes === 'object' ? report.bundleFileHashes : {};
  const check = (pass, label, reason = '') => ({ pass: Boolean(pass), label, reason: String(reason || '') });
  const checks = [
    check(report.manifestHash === pack.manifestHash, 'report manifest hash matches pack manifest', report.manifestHash === pack.manifestHash ? 'matched' : 'manifest_hash_mismatch'),
    check(report.expectationsHash === pack.expectationsHash, 'report expectations hash matches pack expectations', report.expectationsHash === pack.expectationsHash ? 'matched' : 'expectations_hash_mismatch'),
    check(report.profileName === pack.manifest.profileName, 'report profile name matches generated profile', report.profileName === pack.manifest.profileName ? 'matched' : 'profile_name_mismatch'),
    check(report.host?.platform === 'linux', 'report host platform is linux', report.host?.platform === 'linux' ? 'linux' : 'not_linux'),
    check(Boolean(report.host?.appArmorEnabled), 'report host states AppArmor is enabled', report.host?.appArmorEnabled ? 'enabled' : 'disabled'),
    check((report.parser?.status ?? -1) === 0, 'report parser status is zero', report.parser?.status === 0 ? 'parser_ok' : 'parser_failed'),
    check((report.result?.status ?? -1) === 0, 'report aa-exec result status is zero', report.result?.status === 0 ? 'result_ok' : 'result_failed'),
    check(report.payload?.allowed === 'section45-allowed', 'allowed workspace file stays readable', report.payload?.allowed === 'section45-allowed' ? 'allowed_read_ok' : 'allowed_read_mismatch'),
    check(Boolean(report.forbiddenBlocked), 'forbidden path read is blocked', report.forbiddenBlocked ? 'blocked' : 'not_blocked'),
    check(String(report.payload?.current || '').includes(pack.manifest.profileName), 'proc current label includes generated profile', String(report.payload?.current || '').includes(pack.manifest.profileName) ? 'current_label_ok' : 'current_label_missing'),
    check(integrity.missing.length === 0 && integrity.mismatched.length === 0, 'pack files still match manifest hashes at import time', integrity.missing.length || integrity.mismatched.length ? 'pack_integrity_failed' : 'pack_integrity_ok'),
    check(Object.keys(expectedFiles).every(key => bundleFileHashes[key] === expectedFiles[key]), 'report bundle file hashes match manifest file hashes', Object.keys(expectedFiles).every(key => bundleFileHashes[key] === expectedFiles[key]) ? 'bundle_hashes_ok' : 'bundle_hashes_mismatch')
  ];
  const executedAssertions = Array.isArray(report.executedAssertions) ? report.executedAssertions : [];
  const requiredAssertions = Array.isArray(pack.expectations?.assertions) ? pack.expectations.assertions : [];
  checks.push(check(requiredAssertions.every(item => executedAssertions.includes(item)), 'report executed all expected live assertions', requiredAssertions.every(item => executedAssertions.includes(item)) ? 'assertions_complete' : 'assertions_missing'));

  const unsignedAttestation = {
    version: 1,
    generatedAt: new Date().toISOString(),
    label: 'section45-apparmor-host-proof-attestation',
    reportId: report.reportId || null,
    profileName: pack.manifest.profileName,
    manifestHash: pack.manifestHash,
    expectationsHash: pack.expectationsHash,
    reportHash: stableHash({ ...report, reportHash: undefined }),
    bundleFileHashSet: stableHash(expectedFiles),
    checkDigest: stableHash(checks.map(item => ({ label: item.label, pass: item.pass, reason: item.reason })))
  };
  const signed = signProvenancePayload(unsignedAttestation, { generateKeypair: true });
  const attestation = signed.attestation;
  const attestationVerified = verifyProvenanceAttestation(attestation);
  const ok = checks.every(item => item.pass) && attestationVerified.ok;
  return {
    ok,
    reason: ok ? 'verified' : 'verification_failed',
    pack,
    report,
    checks,
    integrity,
    attestation,
    attestationVerified,
    unsignedAttestation
  };
}

export function importAppArmorHostProof(packDir, reportInput, options = {}) {
  const verification = verifyAppArmorHostProofReport(packDir, reportInput);
  const rootDir = path.resolve(options.rootDir || path.join(packDir, '..', '..', '..'));
  const reportId = verification.report?.reportId || String(options.reportId || `host-proof-${Date.now()}`);
  const outputDir = path.join(rootDir, 'dist', 'section45', 'apparmor-live-proof-ingest', reportId);
  ensureDirectory(outputDir);
  const sourceReportFile = writeJson(path.join(outputDir, 'source-report.json'), verification.report || { ok: false, missing: true });
  const verificationFile = writeJson(path.join(outputDir, 'verification.json'), {
    generatedAt: new Date().toISOString(),
    ok: verification.ok,
    reason: verification.reason,
    reportId,
    profileName: verification.pack?.manifest?.profileName || null,
    manifestHash: verification.pack?.manifestHash || null,
    expectationsHash: verification.pack?.expectationsHash || null,
    reportHash: verification.unsignedAttestation?.reportHash || null,
    checks: verification.checks,
    integrity: verification.integrity,
    attestationVerified: verification.attestationVerified,
    sourceReportFile: normalizePath(path.relative(rootDir, sourceReportFile))
  });
  const attestationFile = writeJson(path.join(outputDir, 'attestation.json'), verification.attestation || { ok: false });
  const trustSurfaceFile = writeText(path.join(outputDir, 'trust-surface.html'), buildTrustSurfaceHtml({
    ok: verification.ok,
    reportId,
    profileName: verification.pack?.manifest?.profileName || null,
    manifestHash: verification.pack?.manifestHash || null,
    expectationsHash: verification.pack?.expectationsHash || null,
    reportHash: verification.unsignedAttestation?.reportHash || null,
    attestationVerified: verification.attestationVerified?.ok,
    checks: verification.checks || []
  }));
  return {
    ok: verification.ok,
    reason: verification.reason,
    outputDir,
    sourceReportFile,
    verificationFile,
    attestationFile,
    trustSurfaceFile,
    verification
  };
}
