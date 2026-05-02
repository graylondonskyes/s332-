import fs from 'node:fs';
import path from 'node:path';

import { observeLinuxProcessConfinement } from './runtime-sandbox.mjs';
import { signProvenancePayload, verifyProvenanceAttestation } from './release-provenance.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readString(value) {
  return String(value ?? '').trim();
}

function readProcFile(pid, suffix) {
  const target = pid === 'self'
    ? path.join('/proc', 'self', suffix)
    : path.join('/proc', String(pid), suffix);
  try {
    return fs.readFileSync(target, 'utf8');
  } catch {
    return '';
  }
}

function parseCgroupEntries(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [hierarchy, controllers, cgroupPath] = line.split(':');
      return {
        hierarchy: hierarchy ?? null,
        controllers: String(controllers || '').split(',').map(item => item.trim()).filter(Boolean),
        path: cgroupPath || null
      };
    });
}

export function buildExecutionAttestation(pid = 'self', options = {}) {
  const observation = observeLinuxProcessConfinement(pid);
  const cgroupText = readProcFile(pid, 'cgroup');
  const cgroupEntries = parseCgroupEntries(cgroupText);
  const unsignedPayload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    receiptType: 'runtime-execution-attestation',
    productName: readString(options.productName || 'SkyeQuantaCore') || 'SkyeQuantaCore',
    workspaceId: readString(options.workspaceId || 'shared') || 'shared',
    label: readString(options.label || 'runtime') || 'runtime',
    host: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version
    },
    runtime: {
      requestedMode: readString(options.requestedMode || options.sandboxMode || process.env.SKYEQUANTA_RUNTIME_SANDBOX_MODE) || null,
      effectiveMode: readString(options.effectiveMode || process.env.SKYEQUANTA_RUNTIME_SANDBOX_EFFECTIVE_MODE) || null,
      strict: Boolean(options.strict ?? false)
    },
    process: {
      pid: observation.pid,
      uid: observation.uid,
      gid: observation.gid,
      pidInNamespace: observation.pidInNamespace,
      seccompMode: observation.seccompMode,
      noNewPrivs: observation.noNewPrivs,
      appArmorCurrent: observation.appArmorCurrent,
      namespaces: observation.namespaces,
      cgroupEntries,
      cgroupText: String(cgroupText || '').trim() || null
    },
    evidence: options.evidence || {}
  };
  const signed = signProvenancePayload(unsignedPayload, { generateKeypair: true });
  return {
    receipt: signed.attestation,
    privateKeyPem: signed.privateKeyPem || null,
    observation,
    cgroupText,
    cgroupEntries
  };
}

export function verifyExecutionAttestation(receipt, options = {}) {
  const signature = verifyProvenanceAttestation(receipt);
  const processInfo = receipt?.process || {};
  const runtimeInfo = receipt?.runtime || {};
  const expectedSeccompMode = readString(options.expectedSeccompMode);
  const expectedEffectiveMode = readString(options.expectedEffectiveMode);
  const requireCgroupEvidence = Boolean(options.requireCgroupEvidence);
  const requirePid = Boolean(options.requirePid ?? true);
  const checks = {
    signature: signature.ok,
    pidPresent: !requirePid || Number.isInteger(processInfo.pid),
    cgroupEvidence: !requireCgroupEvidence || (Array.isArray(processInfo.cgroupEntries) && processInfo.cgroupEntries.length > 0),
    seccompMode: !expectedSeccompMode || String(processInfo.seccompMode || '') == expectedSeccompMode,
    effectiveMode: !expectedEffectiveMode || String(runtimeInfo.effectiveMode || '') === expectedEffectiveMode
  };
  const ok = Object.values(checks).every(Boolean);
  return {
    ok,
    reason: ok ? 'verified' : 'constraint_mismatch',
    signature,
    checks,
    receipt: {
      generatedAt: receipt?.generatedAt || null,
      workspaceId: receipt?.workspaceId || null,
      label: receipt?.label || null,
      runtime: runtimeInfo,
      process: processInfo
    }
  };
}

export function writeExecutionAttestationBundle(rootDir, outputDir, options = {}) {
  ensureDirectory(outputDir);
  const built = buildExecutionAttestation(options.pid || 'self', options);
  const attestationFile = path.join(outputDir, 'EXECUTION_ATTESTATION.json');
  const verifyFile = path.join(outputDir, 'EXECUTION_ATTESTATION_VERIFY.json');
  fs.writeFileSync(attestationFile, `${JSON.stringify(built.receipt, null, 2)}\n`, 'utf8');
  const verification = verifyExecutionAttestation(built.receipt, options.verify || {});
  fs.writeFileSync(verifyFile, `${JSON.stringify(verification, null, 2)}\n`, 'utf8');
  return {
    ok: verification.ok,
    outputDir,
    attestationFile,
    verifyFile,
    verification,
    privateKeyPem: built.privateKeyPem || null,
    receipt: built.receipt
  };
}
