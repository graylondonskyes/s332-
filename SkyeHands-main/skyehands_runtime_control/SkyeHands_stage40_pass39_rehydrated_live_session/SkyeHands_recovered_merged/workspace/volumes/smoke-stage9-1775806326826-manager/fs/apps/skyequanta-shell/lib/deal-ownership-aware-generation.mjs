import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { getRuntimePaths } from './runtime.mjs';

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

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(item => canonicalJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function stableHash(value) {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function getDealPaths(config) {
  const runtimePaths = getRuntimePaths(config);
  const baseDir = path.join(runtimePaths.runtimeDir, 'deal-ownership-generation');
  return {
    baseDir,
    profilesFile: path.join(baseDir, 'profiles.json'),
    exportsDir: path.join(baseDir, 'exports')
  };
}

export function ensureDealOwnershipStore(config) {
  const paths = getDealPaths(config);
  ensureDirectory(paths.baseDir);
  ensureDirectory(paths.exportsDir);
  if (!fs.existsSync(paths.profilesFile)) writeJson(paths.profilesFile, { version: 1, profiles: [] });
  return paths;
}

export function resetDealOwnershipStore(config) {
  const paths = getDealPaths(config);
  fs.rmSync(paths.baseDir, { recursive: true, force: true });
  return ensureDealOwnershipStore(config);
}

function buildProfileFingerprint(profile) {
  return stableHash({
    profileId: profile.profileId,
    kind: profile.kind,
    founderOnlyModules: profile.founderOnlyModules,
    reusableModules: profile.reusableModules,
    exportRestrictions: profile.exportRestrictions,
    whiteLabelAllowed: profile.whiteLabelAllowed,
    owner: profile.owner
  });
}

function readProfiles(config) {
  const paths = ensureDealOwnershipStore(config);
  return readJson(paths.profilesFile, { version: 1, profiles: [] });
}

function writeProfiles(config, payload) {
  const paths = ensureDealOwnershipStore(config);
  writeJson(paths.profilesFile, payload);
}

export function createCommercialProfile(config, request = {}) {
  const table = readProfiles(config);
  const profile = {
    version: 1,
    createdAt: new Date().toISOString(),
    profileId: request.profileId || crypto.randomUUID(),
    label: request.label || request.kind || 'commercial-profile',
    kind: request.kind || 'internal-product',
    owner: request.owner || 'Skyes Over London',
    founderOnlyModules: [...new Set(request.founderOnlyModules || [])],
    reusableModules: [...new Set(request.reusableModules || [])],
    exportRestrictions: [...new Set(request.exportRestrictions || [])],
    whiteLabelAllowed: Boolean(request.whiteLabelAllowed),
    resaleRestricted: Boolean(request.resaleRestricted),
    regulatedInternalOnly: Boolean(request.regulatedInternalOnly),
    license: request.license || 'proprietary',
    notes: request.notes || null
  };
  profile.fingerprint = buildProfileFingerprint(profile);
  const nextProfiles = [...(table.profiles || []).filter(item => item.profileId !== profile.profileId), profile];
  writeProfiles(config, { version: 1, profiles: nextProfiles });
  return profile;
}

export function verifyCommercialProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    return { ok: false, reason: 'profile_missing' };
  }
  const expected = buildProfileFingerprint(profile);
  if (expected !== profile.fingerprint) {
    return { ok: false, reason: 'commercial_profile_fingerprint_mismatch', expected, actual: profile.fingerprint || null };
  }
  return { ok: true, fingerprint: expected };
}

export function planCommercialGeneration(config, request = {}) {
  const profile = request.profile;
  const verification = verifyCommercialProfile(profile);
  if (!verification.ok) {
    return { ok: false, reason: verification.reason, profileId: profile?.profileId || null };
  }
  const requestedAction = request.requestedAction || 'export';
  const consumerType = request.consumerType || 'internal';
  const targetModules = [...new Set(request.targetModules || [])];
  const blocked = [];
  for (const modulePath of targetModules) {
    if ((profile.founderOnlyModules || []).includes(modulePath) && consumerType !== 'founder') {
      blocked.push({ modulePath, reason: 'founder_only_module' });
    }
    if ((profile.exportRestrictions || []).includes(modulePath) && requestedAction === 'export' && consumerType !== 'founder') {
      blocked.push({ modulePath, reason: 'export_restricted_module' });
    }
  }
  if (profile.regulatedInternalOnly && consumerType !== 'internal' && consumerType !== 'founder') {
    blocked.push({ modulePath: '*profile*', reason: 'regulated_internal_only' });
  }
  if (consumerType === 'white-label' && profile.whiteLabelAllowed === false) {
    blocked.push({ modulePath: '*profile*', reason: 'white_label_not_allowed' });
  }
  return {
    ok: blocked.length === 0,
    profileId: profile.profileId,
    requestedAction,
    consumerType,
    allowedModules: targetModules.filter(modulePath => !blocked.some(item => item.modulePath === modulePath)),
    blocked,
    explanation: blocked.length === 0
      ? 'Commercial profile permits this generation/export request.'
      : `Commercial profile denied ${blocked.length} requested module lane(s).`
  };
}

export function exportCommercialPackage(config, request = {}) {
  const profile = request.profile;
  const plan = planCommercialGeneration(config, {
    profile,
    requestedAction: 'export',
    consumerType: request.consumerType || 'white-label',
    targetModules: request.modules || []
  });
  if (!plan.ok) {
    return { ok: false, reason: 'commercial_export_denied', plan };
  }
  const projectRoot = path.resolve(request.projectRoot || config.rootDir);
  const outputDir = path.resolve(request.outputDir || path.join(config.rootDir, 'dist', 'section57', profile.profileId, 'export-package'));
  fs.rmSync(outputDir, { recursive: true, force: true });
  ensureDirectory(outputDir);
  const copied = [];
  for (const relativePath of plan.allowedModules) {
    const source = path.join(projectRoot, relativePath);
    if (!fs.existsSync(source)) continue;
    const target = path.join(outputDir, relativePath);
    ensureDirectory(path.dirname(target));
    fs.copyFileSync(source, target);
    copied.push({ relativePath: normalizePath(relativePath), sizeBytes: fs.statSync(target).size });
  }
  const manifest = {
    version: 1,
    exportedAt: new Date().toISOString(),
    profileId: profile.profileId,
    consumerType: request.consumerType || 'white-label',
    copied,
    blocked: plan.blocked,
    packageFingerprint: stableHash({ profile: profile.fingerprint, copied: copied.map(item => item.relativePath) })
  };
  const manifestFile = writeJson(path.join(outputDir, 'commercial-manifest.json'), manifest);
  return {
    ok: true,
    outputDir,
    copied,
    manifest,
    artifactReferences: {
      manifestFile: normalizePath(path.relative(config.rootDir, manifestFile))
    }
  };
}

export function renderCommercialSurface(profiles, plans) {
  const profileRows = profiles.map(profile => `<tr><td>${profile.profileId}</td><td>${profile.kind}</td><td>${profile.owner}</td><td>${profile.license}</td><td>${profile.whiteLabelAllowed ? 'yes' : 'no'}</td></tr>`).join('');
  const planRows = plans.map(plan => `<tr><td>${plan.profileId}</td><td>${plan.consumerType}</td><td>${plan.ok ? 'PASS' : 'FAIL'}</td><td>${(plan.blocked || []).map(item => `${item.modulePath}:${item.reason}`).join(', ') || 'none'}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>Deal Ownership Aware Generation</title><style>body{font-family:Inter,Arial,sans-serif;background:#020617;color:#e2e8f0;padding:24px;}table{width:100%;border-collapse:collapse;margin-bottom:28px;}td,th{border:1px solid rgba(255,255,255,.12);padding:10px;}th{background:#111827;}</style></head><body><h1>Deal / Ownership-Aware Code Generation</h1><h2>Profiles</h2><table><thead><tr><th>ID</th><th>Kind</th><th>Owner</th><th>License</th><th>White-label</th></tr></thead><tbody>${profileRows}</tbody></table><h2>Plans</h2><table><thead><tr><th>Profile</th><th>Consumer</th><th>Pass</th><th>Blocked</th></tr></thead><tbody>${planRows}</tbody></table></body></html>`;
}

export function inferCommercialSignals(projectRoot) {
  const licenseFile = path.join(projectRoot, 'LICENSE');
  const readmeFile = path.join(projectRoot, 'README.md');
  const license = fs.existsSync(licenseFile) ? fs.readFileSync(licenseFile, 'utf8').slice(0, 120).toLowerCase() : '';
  const readme = fs.existsSync(readmeFile) ? fs.readFileSync(readmeFile, 'utf8').toLowerCase() : '';
  const kind = readme.includes('white-label') ? 'white-label-branch'
    : readme.includes('community edition') ? 'community-edition'
    : readme.includes('internal') ? 'regulated-internal-tool'
    : 'internal-product';
  return {
    inferredKind: kind,
    proprietarySignals: [license.includes('proprietary'), readme.includes('founder only'), readme.includes('restricted')].filter(Boolean).length,
    whiteLabelSignals: [readme.includes('white-label'), readme.includes('resale'), readme.includes('tenant')].filter(Boolean).length
  };
}
