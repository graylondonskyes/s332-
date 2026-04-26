import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { getRuntimePaths } from './runtime.mjs';
import { buildProviderGraph, routeSovereignTask } from './skye-sovereign-runtime.mjs';

export const MODE_PRESETS = {
  finance: {
    modeId: 'finance',
    label: 'Finance Mode',
    toolAccess: ['workspace-read', 'workspace-write', 'tests', 'audit-export', 'attestation'],
    loggingDepth: 'forensic',
    dataRetentionDays: 2555,
    providerPolicy: {
      trustFloor: 'private',
      privateOnly: true,
      enterprisePolicyMode: true,
      allowEgress: false,
      routeMode: 'enterprise_policy'
    },
    approvalWorkflow: {
      requiredApprovers: ['security-reviewer', 'finance-approver'],
      humanApprovalRequired: true
    },
    exportPolicy: {
      profile: 'redacted-procurement',
      externalShareAllowed: false,
      redaction: 'strict'
    },
    forbiddenActions: ['public-share', 'unapproved-egress']
  },
  healthcare: {
    modeId: 'healthcare',
    label: 'Healthcare Mode',
    toolAccess: ['workspace-read', 'workspace-write', 'tests', 'audit-export'],
    loggingDepth: 'patient-safe-forensic',
    dataRetentionDays: 2190,
    providerPolicy: {
      trustFloor: 'private',
      privateOnly: true,
      enterprisePolicyMode: true,
      allowEgress: false,
      routeMode: 'enterprise_policy'
    },
    approvalWorkflow: {
      requiredApprovers: ['security-reviewer', 'privacy-approver'],
      humanApprovalRequired: true
    },
    exportPolicy: {
      profile: 'phi-redacted',
      externalShareAllowed: false,
      redaction: 'strict'
    },
    forbiddenActions: ['public-share', 'unapproved-egress']
  },
  government: {
    modeId: 'government',
    label: 'Government Mode',
    toolAccess: ['workspace-read', 'workspace-write', 'tests', 'audit-export', 'attestation'],
    loggingDepth: 'chain-of-custody',
    dataRetentionDays: 3650,
    providerPolicy: {
      trustFloor: 'sovereign',
      privateOnly: true,
      enterprisePolicyMode: true,
      allowEgress: false,
      routeMode: 'highest_trust'
    },
    approvalWorkflow: {
      requiredApprovers: ['security-reviewer', 'government-approver'],
      humanApprovalRequired: true
    },
    exportPolicy: {
      profile: 'classified-safe-export',
      externalShareAllowed: false,
      redaction: 'strict'
    },
    forbiddenActions: ['public-share', 'unapproved-egress']
  },
  education: {
    modeId: 'education',
    label: 'Education Mode',
    toolAccess: ['workspace-read', 'workspace-write', 'tests', 'preview'],
    loggingDepth: 'standard',
    dataRetentionDays: 365,
    providerPolicy: {
      trustFloor: 'standard',
      privateOnly: false,
      enterprisePolicyMode: false,
      allowEgress: true,
      routeMode: 'lowest_cost'
    },
    approvalWorkflow: {
      requiredApprovers: ['operator'],
      humanApprovalRequired: false
    },
    exportPolicy: {
      profile: 'standard-export',
      externalShareAllowed: true,
      redaction: 'moderate'
    },
    forbiddenActions: []
  },
  'air-gapped': {
    modeId: 'air-gapped',
    label: 'Air-Gapped Mode',
    toolAccess: ['workspace-read', 'workspace-write', 'tests', 'attestation'],
    loggingDepth: 'forensic',
    dataRetentionDays: 1825,
    providerPolicy: {
      trustFloor: 'private',
      privateOnly: true,
      enterprisePolicyMode: true,
      allowEgress: false,
      routeMode: 'private_only'
    },
    approvalWorkflow: {
      requiredApprovers: ['security-reviewer'],
      humanApprovalRequired: true
    },
    exportPolicy: {
      profile: 'air-gap-export',
      externalShareAllowed: false,
      redaction: 'strict'
    },
    forbiddenActions: ['public-share', 'network-egress', 'unapproved-egress']
  }
};

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath, fallback) {
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

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(item => canonicalJson(item)).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function stableHash(value) {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function getModePaths(config) {
  const runtimePaths = getRuntimePaths(config);
  const baseDir = path.join(runtimePaths.runtimeDir, 'compliance-native-modes');
  return {
    baseDir,
    profilesFile: path.join(baseDir, 'profiles.json'),
    runsFile: path.join(baseDir, 'runs.json')
  };
}

export function ensureComplianceModeStore(config) {
  const paths = getModePaths(config);
  ensureDirectory(paths.baseDir);
  if (!fs.existsSync(paths.profilesFile)) {
    const profiles = Object.fromEntries(Object.entries(MODE_PRESETS).map(([modeId, profile]) => [modeId, stampComplianceProfile(profile)]));
    writeJson(paths.profilesFile, { version: 1, profiles });
  }
  if (!fs.existsSync(paths.runsFile)) {
    writeJson(paths.runsFile, { version: 1, runs: [] });
  }
  return paths;
}

export function resetComplianceModeStore(config) {
  const paths = getModePaths(config);
  fs.rmSync(paths.baseDir, { recursive: true, force: true });
  return ensureComplianceModeStore(config);
}

export function stampComplianceProfile(profile = {}) {
  const normalized = {
    modeId: profile.modeId,
    label: profile.label,
    toolAccess: [...(profile.toolAccess || [])],
    loggingDepth: profile.loggingDepth,
    dataRetentionDays: profile.dataRetentionDays,
    providerPolicy: { ...(profile.providerPolicy || {}) },
    approvalWorkflow: { ...(profile.approvalWorkflow || {}) },
    exportPolicy: { ...(profile.exportPolicy || {}) },
    forbiddenActions: [...(profile.forbiddenActions || [])]
  };
  return {
    ...normalized,
    fingerprint: stableHash(normalized)
  };
}

export function verifyComplianceProfile(profile = {}) {
  const stamped = stampComplianceProfile(profile);
  return {
    ok: profile.fingerprint === stamped.fingerprint,
    expectedFingerprint: stamped.fingerprint,
    actualFingerprint: profile.fingerprint || null
  };
}

export function loadComplianceProfiles(config) {
  const paths = ensureComplianceModeStore(config);
  const payload = readJson(paths.profilesFile, { version: 1, profiles: {} });
  payload.profiles = payload.profiles || {};
  return { paths, payload };
}

function saveComplianceRun(config, run) {
  const { paths } = loadComplianceProfiles(config);
  const payload = readJson(paths.runsFile, { version: 1, runs: [] });
  payload.runs = Array.isArray(payload.runs) ? payload.runs : [];
  payload.runs.push(run);
  writeJson(paths.runsFile, payload);
  return paths.runsFile;
}

function denial(reason, modeProfile, detail = {}) {
  return {
    ok: false,
    reason,
    modeId: modeProfile.modeId,
    modeLabel: modeProfile.label,
    explanation: detail.explanation || reason,
    effectivePolicy: modeProfile,
    detail
  };
}

export function evaluateComplianceMode(config, modeId, task = {}, providerFixtures = []) {
  const { payload } = loadComplianceProfiles(config);
  const modeProfile = payload.profiles[modeId];
  if (!modeProfile) {
    throw new Error(`Unknown compliance mode '${modeId}'.`);
  }

  const verified = verifyComplianceProfile(modeProfile);
  if (!verified.ok) {
    return denial('tampered_profile', modeProfile, {
      explanation: `Compliance profile fingerprint mismatch for ${modeId}.`,
      verified
    });
  }

  const action = String(task.action || 'patch').trim();
  const requiresEgress = Boolean(task.requiresEgress);
  if ((modeProfile.forbiddenActions || []).includes(action)) {
    return denial('forbidden_action', modeProfile, {
      explanation: `${modeProfile.label} denies action ${action}.`,
      action
    });
  }

  if (requiresEgress && modeProfile.providerPolicy.allowEgress === false) {
    return denial('egress_denied', modeProfile, {
      explanation: `${modeProfile.label} forbids network egress for this task.`,
      action,
      requiresEgress
    });
  }

  const graph = buildProviderGraph(providerFixtures);
  const routing = routeSovereignTask(graph, {
    capability: task.capability || 'patch',
    mode: modeProfile.providerPolicy.routeMode,
    trustFloor: modeProfile.providerPolicy.trustFloor,
    privateOnly: modeProfile.providerPolicy.privateOnly,
    enterprisePolicyMode: modeProfile.providerPolicy.enterprisePolicyMode,
    requireHealthy: true,
    requireSecrets: true
  });

  if (!routing.ok) {
    return denial('route_denied', modeProfile, {
      explanation: routing.explanation,
      routing
    });
  }

  const run = {
    version: 1,
    generatedAt: new Date().toISOString(),
    modeId,
    task: {
      taskId: task.taskId || `${modeId}-task`,
      action,
      capability: task.capability || 'patch',
      requiresEgress,
      summary: task.summary || ''
    },
    effectivePolicy: modeProfile,
    routing,
    behavior: {
      allowedTools: modeProfile.toolAccess,
      loggingDepth: modeProfile.loggingDepth,
      dataRetentionDays: modeProfile.dataRetentionDays,
      humanApprovalRequired: Boolean(modeProfile.approvalWorkflow?.humanApprovalRequired),
      exportProfile: modeProfile.exportPolicy?.profile || 'standard-export'
    },
    runFingerprint: stableHash({ modeId, task, routing, behavior: modeProfile })
  };

  saveComplianceRun(config, run);
  return {
    ok: true,
    ...run
  };
}

export function buildComplianceExportPackage(filePath, evaluation) {
  const payload = {
    generatedAt: new Date().toISOString(),
    modeId: evaluation.modeId,
    exportProfile: evaluation.behavior.exportProfile,
    loggingDepth: evaluation.behavior.loggingDepth,
    retentionDays: evaluation.behavior.dataRetentionDays,
    routedProvider: evaluation.routing?.provider?.providerId || null,
    redaction: evaluation.effectivePolicy?.exportPolicy?.redaction || null,
    externalShareAllowed: Boolean(evaluation.effectivePolicy?.exportPolicy?.externalShareAllowed),
    artifactFingerprint: stableHash({ evaluation })
  };
  writeJson(filePath, payload);
  return payload;
}

export function renderComplianceModeSurface(evaluations = [], options = {}) {
  const title = options.title || 'Compliance-Native Development Modes';
  const cards = evaluations.map(item => `
    <article class="card">
      <h3>${item.modeLabel || item.effectivePolicy?.label || item.modeId}</h3>
      <p><strong>Status:</strong> ${item.ok ? 'allowed' : item.reason}</p>
      <p><strong>Logging depth:</strong> ${item.behavior?.loggingDepth || item.effectivePolicy?.loggingDepth}</p>
      <p><strong>Retention:</strong> ${item.behavior?.dataRetentionDays || item.effectivePolicy?.dataRetentionDays} days</p>
      <p><strong>Route:</strong> ${item.routing?.provider?.providerId || 'none'}</p>
      <p><strong>Explanation:</strong> ${item.explanation || item.detail?.explanation || ''}</p>
      <pre>${JSON.stringify(item.effectivePolicy || {}, null, 2)}</pre>
    </article>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  body{margin:0;background:#0b1120;color:#f5f8ff;font-family:Inter,Arial,sans-serif}
  main{max-width:1280px;margin:0 auto;padding:24px}
  .card{background:#121c31;border:1px solid #324b75;border-radius:18px;padding:16px;margin-bottom:16px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
  pre{white-space:pre-wrap;word-break:break-word;background:#0b1427;padding:12px;border-radius:12px;max-height:260px;overflow:auto}
</style>
</head>
<body>
<main>
  <section class="card">
    <h1>${title}</h1>
    <p>Mode selection, effective policy view, and denial explanation surface.</p>
  </section>
  <section class="grid">${cards}</section>
</main>
</body>
</html>\n`;
}

export function writeComplianceModeSurface(filePath, evaluations = [], options = {}) {
  ensureDirectory(path.dirname(filePath));
  const html = renderComplianceModeSurface(evaluations, options);
  fs.writeFileSync(filePath, html, 'utf8');
  return { filePath, html };
}
