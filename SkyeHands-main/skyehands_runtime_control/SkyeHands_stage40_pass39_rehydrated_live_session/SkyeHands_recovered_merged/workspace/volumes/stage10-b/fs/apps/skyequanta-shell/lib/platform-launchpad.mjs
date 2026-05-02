import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
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

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function stableHash(value) {
  const canonical = JSON.stringify(value, Object.keys(value || {}).sort());
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

function listRelativeFiles(rootDir, current = rootDir, bucket = [], depth = 0, maxDepth = 8) {
  if (depth > maxDepth || !fs.existsSync(current)) return bucket;
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const absolute = path.join(current, entry.name);
    const relative = normalizePath(path.relative(rootDir, absolute));
    if (entry.isDirectory()) {
      listRelativeFiles(rootDir, absolute, bucket, depth + 1, maxDepth);
      continue;
    }
    if (entry.isFile()) bucket.push(relative);
  }
  return bucket;
}

function findFilesByName(rootDir, fileName, maxDepth = 6) {
  return listRelativeFiles(rootDir, rootDir, [], 0, maxDepth).filter(relative => path.basename(relative) === fileName);
}

function parseCommandTarget(command = '') {
  const quotedNode = String(command).match(/node\s+["']([^"']+)["']/);
  const unquotedNode = String(command).match(/node\s+([^"'\s]+(?:\.[^"'\s]+)?)/);
  const quotedPy = String(command).match(/python(?:3)?\s+["']([^"']+)["']/);
  const unquotedPy = String(command).match(/python(?:3)?\s+([^"'\s]+(?:\.[^"'\s]+)?)/);
  return quotedNode?.[1] || unquotedNode?.[1] || quotedPy?.[1] || unquotedPy?.[1] || null;
}

function mimeTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.woff2') return 'font/woff2';
  if (ext === '.woff') return 'font/woff';
  return 'application/octet-stream';
}

function getPlatformLaunchpadPaths(config) {
  const runtimePaths = getRuntimePaths(config);
  const baseDir = path.join(runtimePaths.runtimeDir, 'platform-launchpad');
  return {
    baseDir,
    registryFile: path.join(baseDir, 'registry.json'),
    plansDir: path.join(baseDir, 'plans'),
    canonicalRoot: path.join(config.rootDir, 'platform', 'user-platforms'),
    canonicalRegistryFile: path.join(config.rootDir, 'platform', 'user-platforms', 'REGISTRY.json')
  };
}

export function ensurePlatformLaunchpadStore(config) {
  const paths = getPlatformLaunchpadPaths(config);
  ensureDirectory(paths.baseDir);
  ensureDirectory(paths.plansDir);
  ensureDirectory(paths.canonicalRoot);
  if (!fs.existsSync(paths.registryFile)) writeJson(paths.registryFile, { version: 1, platforms: [] });
  if (!fs.existsSync(paths.canonicalRegistryFile)) writeJson(paths.canonicalRegistryFile, { version: 1, platforms: [] });
  return paths;
}

export function resetPlatformLaunchpadStore(config) {
  const paths = getPlatformLaunchpadPaths(config);
  fs.rmSync(paths.baseDir, { recursive: true, force: true });
  return ensurePlatformLaunchpadStore(config);
}

function scanPackageFiles(sourceRoot) {
  return findFilesByName(sourceRoot, 'package.json', 6).map(relativePath => {
    const absolute = path.join(sourceRoot, relativePath);
    const pkg = readJson(absolute, {});
    const packageDir = normalizePath(path.dirname(relativePath) === '.' ? '' : path.dirname(relativePath));
    return {
      relativePath: normalizePath(relativePath),
      packageName: pkg.name || path.basename(packageDir || sourceRoot),
      version: pkg.version || null,
      scripts: Object.entries(pkg.scripts || {}).map(([scriptName, rawCommand]) => {
        const command = String(rawCommand || '').trim();
        const commandTarget = parseCommandTarget(command);
        const commandTargetAbsolute = commandTarget ? path.join(sourceRoot, packageDir, commandTarget) : null;
        return {
          scriptName,
          command,
          commandTarget: commandTarget ? normalizePath(path.join(packageDir, commandTarget)) : null,
          commandTargetExists: commandTargetAbsolute ? fs.existsSync(commandTargetAbsolute) : null,
          runtimeCandidate: /^(start|dev|serve|preview|runtime:service|runtime:shared-mesh)$/.test(scriptName),
          smokeCandidate: /^smoke:/.test(scriptName)
        };
      })
    };
  });
}

function inferStaticProfiles(sourceRoot) {
  return findFilesByName(sourceRoot, 'index.html', 5).map(relative => {
    const directory = normalizePath(path.dirname(relative) === '.' ? '' : path.dirname(relative));
    const label = directory ? `${directory} static surface` : 'root static surface';
    return {
      profileId: normalizeSlug(`${directory || 'root'}-static-surface`),
      kind: 'static-html',
      label,
      ready: true,
      reason: 'index.html entry detected',
      serveDirectory: normalizePath(path.join('__SOURCE_ROOT__', directory || '.')).replace('/.', ''),
      entryFile: normalizePath(path.join('__SOURCE_ROOT__', relative)),
      relativeEntry: normalizePath(relative),
      directory,
      defaultPath: '/index.html'
    };
  });
}

function inferScriptProfiles(packages) {
  const runtimeProfiles = [];
  const smokeProfiles = [];
  for (const pkg of packages) {
    const packageDir = normalizePath(path.dirname(pkg.relativePath) === '.' ? '' : path.dirname(pkg.relativePath));
    for (const script of pkg.scripts) {
      if (script.runtimeCandidate) {
        runtimeProfiles.push({
          profileId: normalizeSlug(`${pkg.packageName}-${script.scriptName}`),
          kind: 'npm-script',
          label: `${pkg.packageName} :: ${script.scriptName}`,
          packageRelativePath: pkg.relativePath,
          packageDirectory: packageDir,
          scriptName: script.scriptName,
          command: script.command,
          commandTarget: script.commandTarget,
          ready: script.commandTargetExists !== false,
          reason: script.commandTargetExists === false ? 'script target missing' : 'script target resolved or shell-native command'
        });
      }
      if (script.smokeCandidate) {
        smokeProfiles.push({
          profileId: normalizeSlug(`${pkg.packageName}-${script.scriptName}`),
          kind: 'npm-smoke',
          label: `${pkg.packageName} :: ${script.scriptName}`,
          packageRelativePath: pkg.relativePath,
          packageDirectory: packageDir,
          scriptName: script.scriptName,
          command: script.command,
          commandTarget: script.commandTarget,
          ready: script.commandTargetExists !== false,
          reason: script.commandTargetExists === false ? 'smoke target missing' : 'smoke target resolved or shell-native command'
        });
      }
    }
  }
  return { runtimeProfiles, smokeProfiles };
}

function discoverBranchApps(sourceRoot) {
  const branchingRoot = path.join(sourceRoot, 'AE-Central-Command-Pack-CredentialHub-Launcher', 'Branching Apps');
  if (!fs.existsSync(branchingRoot)) return [];
  return fs.readdirSync(branchingRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => ({
      name: entry.name,
      relativePath: normalizePath(path.relative(sourceRoot, path.join(branchingRoot, entry.name)))
    }));
}

function fingerprintSource(sourceRoot) {
  const files = listRelativeFiles(sourceRoot).sort();
  return stableHash(files.map(relative => ({ relative, sha256: sha256File(path.join(sourceRoot, relative)) })));
}

function buildManifest(config, sourceRoot, options = {}) {
  const slug = normalizeSlug(options.slug || path.basename(path.dirname(sourceRoot)));
  const displayName = String(options.displayName || slug).trim() || slug;
  const sourceRootRelative = normalizePath(path.relative(config.rootDir, sourceRoot));
  const packages = scanPackageFiles(sourceRoot);
  const staticProfiles = inferStaticProfiles(sourceRoot).map(profile => ({
    ...profile,
    serveDirectory: profile.serveDirectory.replace('__SOURCE_ROOT__', sourceRootRelative),
    entryFile: profile.entryFile.replace('__SOURCE_ROOT__', sourceRootRelative)
  }));
  const { runtimeProfiles, smokeProfiles } = inferScriptProfiles(packages);
  const branchApps = discoverBranchApps(sourceRoot);
  const profiles = [...staticProfiles, ...runtimeProfiles];
  const sourceFingerprint = fingerprintSource(sourceRoot);
  const summary = {
    packageCount: packages.length,
    launchProfileCount: profiles.length,
    readyLaunchProfileCount: profiles.filter(item => item.ready).length,
    smokeProfileCount: smokeProfiles.length,
    readySmokeProfileCount: smokeProfiles.filter(item => item.ready).length,
    branchAppCount: branchApps.length,
    missingRuntimeProfiles: profiles.filter(item => !item.ready).map(item => item.profileId)
  };
  return {
    version: 1,
    registeredAt: nowIso(),
    slug,
    displayName,
    sourceRoot: sourceRootRelative,
    sourceFingerprint,
    packages,
    launchProfiles: profiles,
    smokeProfiles,
    branchApps,
    summary,
    integrationPolicy: {
      deepScanEligible: true,
      valuationEligible: true,
      honestLaunchOnly: true,
      canonicalIntakeRoot: 'platform/user-platforms/<platform-slug>/source/'
    }
  };
}

function upsertRegistryEntry(registry, entry) {
  const index = registry.platforms.findIndex(item => item.slug === entry.slug);
  if (index >= 0) {
    registry.platforms[index] = entry;
  } else {
    registry.platforms.push(entry);
  }
  registry.platforms.sort((a, b) => a.slug.localeCompare(b.slug));
  return registry;
}

export function registerPlatformFromSource(config, options = {}) {
  const paths = ensurePlatformLaunchpadStore(config);
  const sourceDir = path.resolve(config.rootDir, options.sourceDir || '');
  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    throw new Error(`Platform source directory was not found: ${sourceDir}`);
  }
  const manifest = buildManifest(config, sourceDir, { slug: options.slug, displayName: options.displayName });
  const canonicalDir = path.join(paths.canonicalRoot, manifest.slug);
  ensureDirectory(canonicalDir);
  const manifestFile = writeJson(path.join(canonicalDir, 'skyehands.platform.json'), manifest);
  const registryEntry = {
    slug: manifest.slug,
    displayName: manifest.displayName,
    sourceRoot: manifest.sourceRoot,
    sourceFingerprint: manifest.sourceFingerprint,
    packageCount: manifest.summary.packageCount,
    launchProfileCount: manifest.summary.launchProfileCount,
    readyLaunchProfileCount: manifest.summary.readyLaunchProfileCount,
    smokeProfileCount: manifest.summary.smokeProfileCount,
    readySmokeProfileCount: manifest.summary.readySmokeProfileCount,
    branchAppCount: manifest.summary.branchAppCount,
    missingRuntimeProfiles: manifest.summary.missingRuntimeProfiles,
    manifestPath: normalizePath(path.relative(config.rootDir, manifestFile)),
    registeredAt: manifest.registeredAt
  };
  const runtimeRegistry = readJson(paths.registryFile, { version: 1, platforms: [] });
  const canonicalRegistry = readJson(paths.canonicalRegistryFile, { version: 1, platforms: [] });
  writeJson(paths.registryFile, upsertRegistryEntry(runtimeRegistry, registryEntry));
  writeJson(paths.canonicalRegistryFile, upsertRegistryEntry(canonicalRegistry, registryEntry));
  return {
    manifest,
    manifestFile,
    registryEntry,
    runtimeRegistryFile: paths.registryFile,
    canonicalRegistryFile: paths.canonicalRegistryFile
  };
}

export function loadPlatformRegistry(config) {
  const paths = ensurePlatformLaunchpadStore(config);
  return readJson(paths.canonicalRegistryFile, { version: 1, platforms: [] });
}

export function loadRegisteredPlatform(config, slug) {
  const normalizedSlug = normalizeSlug(slug);
  const manifestPath = path.join(config.rootDir, 'platform', 'user-platforms', normalizedSlug, 'skyehands.platform.json');
  if (!fs.existsSync(manifestPath)) return null;
  return readJson(manifestPath, null);
}

export function buildLaunchPlan(config, slug, profileId = null, options = {}) {
  const manifest = loadRegisteredPlatform(config, slug);
  if (!manifest) {
    return { ok: false, reason: 'platform_not_registered', slug: normalizeSlug(slug) };
  }
  const profile = profileId
    ? (manifest.launchProfiles || []).find(item => item.profileId === profileId)
    : (manifest.launchProfiles || []).find(item => item.ready) || (manifest.launchProfiles || [])[0];
  if (!profile) {
    return { ok: false, reason: 'no_launch_profile', slug: manifest.slug, manifest };
  }
  if (profile.kind === 'static-html') {
    const serveDirectory = path.join(config.rootDir, profile.serveDirectory);
    const entryFile = path.join(config.rootDir, profile.entryFile);
    const port = Number.parseInt(String(options.port || 0), 10) || 0;
    const ready = profile.ready && fs.existsSync(serveDirectory) && fs.existsSync(entryFile);
    return {
      ok: ready,
      slug: manifest.slug,
      profile,
      kind: profile.kind,
      port,
      serveDirectory,
      entryFile,
      command: ['python3', '-m', 'http.server', String(port || 0), '--directory', serveDirectory],
      reason: ready ? 'static launch plan ready' : 'static entry missing'
    };
  }
  if (profile.kind === 'npm-script') {
    const sourceRoot = path.join(config.rootDir, manifest.sourceRoot);
    return {
      ok: profile.ready,
      slug: manifest.slug,
      profile,
      kind: profile.kind,
      workingDirectory: sourceRoot,
      command: ['npm', '--prefix', sourceRoot, 'run', profile.scriptName],
      reason: profile.ready ? 'npm script launch plan ready' : profile.reason
    };
  }
  return { ok: false, reason: 'unsupported_profile_kind', slug: manifest.slug, profile };
}

export async function launchStaticPlatformProfile(config, slug, profileId, options = {}) {
  const plan = buildLaunchPlan(config, slug, profileId, options);
  if (!plan.ok || plan.kind !== 'static-html') {
    return { ok: false, reason: plan.reason || 'launch_plan_not_ready', plan };
  }
  const server = http.createServer((request, response) => {
    const requestPath = decodeURIComponent(String(request.url || '/').split('?')[0]);
    const safeRelative = requestPath === '/' ? 'index.html' : normalizePath(requestPath).replace(/^\/+/, '');
    const absolute = path.resolve(plan.serveDirectory, safeRelative);
    if (!absolute.startsWith(path.resolve(plan.serveDirectory))) {
      response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('forbidden');
      return;
    }
    const target = fs.existsSync(absolute) && fs.statSync(absolute).isFile()
      ? absolute
      : path.join(plan.serveDirectory, 'index.html');
    if (!fs.existsSync(target)) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('not found');
      return;
    }
    response.writeHead(200, { 'content-type': mimeTypeFor(target) });
    fs.createReadStream(target).pipe(response);
  });
  const port = Number.parseInt(String(options.port || 0), 10) || 0;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  const boundPort = Number(address?.port || port || 0);
  return {
    ok: true,
    slug,
    profileId,
    baseUrl: `http://127.0.0.1:${boundPort}`,
    stop: () => new Promise(resolve => server.close(() => resolve())),
    plan: { ...plan, port: boundPort }
  };
}

export function writeLaunchpadSurface(filePath, payload) {
  const profiles = (payload.manifest?.launchProfiles || []).map(item => `<tr><td>${item.profileId}</td><td>${item.kind}</td><td>${item.ready ? 'READY' : 'DENY'}</td><td>${item.reason}</td></tr>`).join('');
  const smokeRows = (payload.manifest?.smokeProfiles || []).map(item => `<tr><td>${item.profileId}</td><td>${item.ready ? 'READY' : 'DENY'}</td><td>${item.reason}</td></tr>`).join('');
  const branchRows = (payload.manifest?.branchApps || []).map(item => `<tr><td>${item.name}</td><td>${item.relativePath}</td></tr>`).join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>Platform Launchpad</title><style>body{font-family:Inter,Arial,sans-serif;background:#08111e;color:#f8fbff;padding:22px}section{margin-bottom:18px;padding:18px;border-radius:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12)}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid rgba(255,255,255,.1);padding:8px;text-align:left}th{font-size:12px;text-transform:uppercase;color:#7dd3fc}</style></head><body><section><h1>${payload.manifest.displayName}</h1><p>Canonical import lane: <code>${payload.manifest.integrationPolicy.canonicalIntakeRoot}</code></p><p>Source root: <code>${payload.manifest.sourceRoot}</code></p></section><section><h2>Launch profiles</h2><table><thead><tr><th>Profile</th><th>Kind</th><th>Status</th><th>Reason</th></tr></thead><tbody>${profiles}</tbody></table></section><section><h2>Smoke profiles</h2><table><thead><tr><th>Profile</th><th>Status</th><th>Reason</th></tr></thead><tbody>${smokeRows}</tbody></table></section><section><h2>Branch apps</h2><table><thead><tr><th>Name</th><th>Path</th></tr></thead><tbody>${branchRows}</tbody></table></section></body></html>`;
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, html, 'utf8');
  return { filePath, html };
}

export function findRegisteredPlatformByPath(config, targetPath) {
  const registry = loadPlatformRegistry(config);
  const absoluteTarget = path.resolve(targetPath);
  for (const entry of registry.platforms || []) {
    const manifest = loadRegisteredPlatform(config, entry.slug);
    if (!manifest) continue;
    const sourceRoot = path.resolve(config.rootDir, manifest.sourceRoot);
    if (absoluteTarget === sourceRoot || absoluteTarget.startsWith(`${sourceRoot}${path.sep}`)) {
      return manifest;
    }
  }
  return null;
}

export function summarizeRegisteredPlatformByPath(config, targetPath) {
  const manifest = findRegisteredPlatformByPath(config, targetPath);
  if (!manifest) return null;
  return {
    slug: manifest.slug,
    displayName: manifest.displayName,
    sourceRoot: manifest.sourceRoot,
    launchProfileCount: manifest.summary.launchProfileCount,
    readyLaunchProfileCount: manifest.summary.readyLaunchProfileCount,
    smokeProfileCount: manifest.summary.smokeProfileCount,
    readySmokeProfileCount: manifest.summary.readySmokeProfileCount,
    branchAppCount: manifest.summary.branchAppCount,
    missingRuntimeProfiles: manifest.summary.missingRuntimeProfiles
  };
}
