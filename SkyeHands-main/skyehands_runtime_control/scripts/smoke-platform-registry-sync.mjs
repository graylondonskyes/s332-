#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runtimeRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(runtimeRoot, '..');
const dynastyRoot = path.join(repoRoot, 'Dynasty-Versions');
const proofDir = path.join(runtimeRoot, '.skyequanta', 'proofs');
const outFile = path.join(proofDir, 'platform-registry-sync-smoke.json');
const canonicalRegistryPath = path.join(dynastyRoot, 'platform/user-platforms/REGISTRY.json');
const runtimeRegistryPath = path.join(dynastyRoot, '.skyequanta/platform-launchpad/registry.json');

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function sorted(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function profileTargetStatus(platform, manifest, profile) {
  if (!profile?.commandTarget) return null;
  const sourceRoot = path.resolve(dynastyRoot, platform.sourceRoot);
  const packageDirectory = profile.packageDirectory || '';
  const targetPath = path.resolve(sourceRoot, packageDirectory, profile.commandTarget);
  return {
    slug: platform.slug,
    profileId: profile.profileId || profile.label || 'unknown-profile',
    commandTarget: profile.commandTarget,
    packageDirectory,
    exists: fs.existsSync(targetPath),
    resolvedTarget: path.relative(repoRoot, targetPath),
    manifestPath: platform.manifestPath,
  };
}

const canonical = readJson(canonicalRegistryPath, { platforms: [] });
const runtime = readJson(runtimeRegistryPath, { platforms: [] });
const canonicalPlatforms = Array.isArray(canonical.platforms) ? canonical.platforms : [];
const runtimePlatforms = Array.isArray(runtime.platforms) ? runtime.platforms : [];
const canonicalSlugs = new Set(canonicalPlatforms.map((platform) => platform.slug));
const runtimeSlugs = new Set(runtimePlatforms.map((platform) => platform.slug));

const missingFromRuntime = sorted([...canonicalSlugs].filter((slug) => !runtimeSlugs.has(slug)));
const runtimeOnly = sorted([...runtimeSlugs].filter((slug) => !canonicalSlugs.has(slug)));
const missingRoots = [];
const missingManifests = [];
const brokenCommandTargets = [];

for (const platform of canonicalPlatforms) {
  const sourceRoot = path.resolve(dynastyRoot, platform.sourceRoot || '');
  const manifestPath = path.join(dynastyRoot, platform.manifestPath || '');
  if (!fs.existsSync(sourceRoot)) missingRoots.push({ slug: platform.slug, sourceRoot: platform.sourceRoot });
  if (!fs.existsSync(manifestPath)) {
    missingManifests.push({ slug: platform.slug, manifestPath: platform.manifestPath });
    continue;
  }

  const manifest = readJson(manifestPath, {});
  const profiles = [
    ...(Array.isArray(manifest.launchProfiles) ? manifest.launchProfiles : []),
    ...(Array.isArray(manifest.smokeProfiles) ? manifest.smokeProfiles : []),
  ];
  for (const profile of profiles) {
    const target = profileTargetStatus(platform, manifest, profile);
    if (target && !target.exists) brokenCommandTargets.push(target);
  }
}

const checks = {
  canonicalReadable: Boolean(canonical),
  runtimeReadable: Boolean(runtime),
  registrySlugSetsMatch: missingFromRuntime.length === 0 && runtimeOnly.length === 0,
  platformRootsExist: missingRoots.length === 0,
  manifestsExist: missingManifests.length === 0,
  commandTargetsResolve: brokenCommandTargets.length === 0,
};

const result = {
  generatedAt: new Date().toISOString(),
  smoke: 'platform-registry-sync',
  canonicalCount: canonicalPlatforms.length,
  runtimeCount: runtimePlatforms.length,
  missingFromRuntime,
  runtimeOnly,
  missingRoots,
  missingManifests,
  brokenCommandTargets,
  checks,
  passed: Object.values(checks).every(Boolean),
};

fs.mkdirSync(proofDir, { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ...result, proof: path.relative(runtimeRoot, outFile) }, null, 2));

if (!result.passed) process.exit(1);
