import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { getRuntimePaths } from './runtime.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
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

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function listRelativeFiles(rootDir, current = rootDir, bucket = [], depth = 0, maxDepth = 8) {
  if (!fs.existsSync(current) || depth > maxDepth) return bucket;
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const absolute = path.join(current, entry.name);
    const relative = normalizePath(path.relative(rootDir, absolute));
    if (entry.isDirectory()) {
      listRelativeFiles(rootDir, absolute, bucket, depth + 1, maxDepth);
    } else if (entry.isFile()) {
      bucket.push(relative);
    }
  }
  return bucket;
}

function extractEnvKeys(sourceRoot) {
  const keys = new Set();
  for (const relative of listRelativeFiles(sourceRoot).filter(item => /\.env(\.|$)|env\.example$/i.test(path.basename(item)))) {
    const text = fs.readFileSync(path.join(sourceRoot, relative), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]+)\s*=/);
      if (match) keys.add(match[1]);
    }
  }
  return Array.from(keys).sort();
}

function extractRouteTargets(sourceRoot) {
  const routes = new Set();
  for (const relative of listRelativeFiles(sourceRoot).filter(item => /\.(html|md)$/i.test(item))) {
    const text = fs.readFileSync(path.join(sourceRoot, relative), 'utf8');
    for (const match of text.matchAll(/href=["']([^"']+)["']/g)) {
      const value = match[1];
      if (!value.startsWith('http') && !value.startsWith('#')) routes.add(value);
    }
  }
  return Array.from(routes).sort();
}

function discoverCapsules(sourceRoot) {
  const capsules = [];
  const branchingAppsDir = path.join(sourceRoot, 'AE-Central-Command-Pack-CredentialHub-Launcher', 'Branching Apps');
  if (!fs.existsSync(branchingAppsDir)) return capsules;
  for (const entry of fs.readdirSync(branchingAppsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const capsuleRoot = path.join(branchingAppsDir, entry.name);
    const files = listRelativeFiles(capsuleRoot);
    const preferredEntry = [
      'skyes-music-forge-dropin/index.html',
      'index.html',
      'runtime.html',
      'public/index.html'
    ].find(candidate => fs.existsSync(path.join(capsuleRoot, candidate)));
    const docs = files.filter(item => /README|DIRECTIVE|VALUATION|BUILD/i.test(path.basename(item))).slice(0, 8);
    capsules.push({
      capsuleId: normalizePath(entry.name).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-{2,}/g, '-'),
      name: entry.name,
      relativePath: normalizePath(path.relative(sourceRoot, capsuleRoot)),
      entryFile: preferredEntry ? normalizePath(path.join(path.relative(sourceRoot, capsuleRoot), preferredEntry)) : null,
      launchable: Boolean(preferredEntry),
      docFiles: docs,
      fileCount: files.length,
      envKeys: extractEnvKeys(capsuleRoot)
    });
  }
  return capsules;
}

export function getPlatformPowerMeshPaths(config) {
  const runtimePaths = getRuntimePaths(config);
  const baseDir = path.join(runtimePaths.runtimeDir, 'platform-launchpad');
  return {
    runtimeRegistryFile: path.join(baseDir, 'power-mesh-registry.json'),
    canonicalRegistryFile: path.join(config.rootDir, 'platform', 'user-platforms', 'POWER_MESH_REGISTRY.json')
  };
}

export function buildPlatformPowerMesh(config, slug) {
  const platformRoot = path.join(config.rootDir, 'platform', 'user-platforms', slug);
  const sourceRoot = path.join(platformRoot, 'source');
  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`Missing imported platform source root for ${slug}`);
  }
  const capsules = discoverCapsules(sourceRoot);
  const docs = listRelativeFiles(sourceRoot).filter(item => /\.(md|html|json)$/i.test(item)).slice(0, 200);
  const power = {
    slug,
    sourceRoot: normalizePath(path.relative(config.rootDir, sourceRoot)),
    generatedAt: new Date().toISOString(),
    capsuleCount: capsules.length,
    launchableCapsuleCount: capsules.filter(item => item.launchable).length,
    capsules,
    envKeys: extractEnvKeys(sourceRoot),
    routeTargets: extractRouteTargets(sourceRoot),
    docFiles: docs,
    fingerprint: stableHash({ capsules, docs })
  };
  const powerFile = path.join(platformRoot, 'skyehands.power.json');
  writeJson(powerFile, power);

  const paths = getPlatformPowerMeshPaths(config);
  const registryEntry = {
    slug,
    capsuleCount: power.capsuleCount,
    launchableCapsuleCount: power.launchableCapsuleCount,
    envKeyCount: power.envKeys.length,
    routeTargetCount: power.routeTargets.length,
    fingerprint: power.fingerprint,
    powerFile: normalizePath(path.relative(config.rootDir, powerFile))
  };
  for (const registryFile of [paths.runtimeRegistryFile, paths.canonicalRegistryFile]) {
    const registry = readJson(registryFile, { version: 1, platforms: [] });
    registry.version = 1;
    registry.platforms = (registry.platforms || []).filter(item => item.slug !== slug);
    registry.platforms.push(registryEntry);
    registry.platforms.sort((a, b) => a.slug.localeCompare(b.slug));
    writeJson(registryFile, registry);
  }
  return { power, powerFile };
}

export function queryPlatformPowerMesh(config, searchTerms = '') {
  const registry = readJson(getPlatformPowerMeshPaths(config).canonicalRegistryFile, { version: 1, platforms: [] });
  const terms = String(searchTerms || '').toLowerCase().split(/\s+/).filter(Boolean);
  const results = [];
  for (const entry of registry.platforms || []) {
    const power = readJson(path.join(config.rootDir, entry.powerFile), null);
    if (!power) continue;
    for (const capsule of power.capsules || []) {
      const haystack = [capsule.name, capsule.relativePath, ...(capsule.docFiles || []), ...(capsule.envKeys || [])].join(' ').toLowerCase();
      const score = !terms.length ? 1 : terms.filter(term => haystack.includes(term)).length;
      if (!terms.length || score > 0) {
        results.push({
          slug: power.slug,
          capsuleId: capsule.capsuleId,
          name: capsule.name,
          relativePath: capsule.relativePath,
          entryFile: capsule.entryFile,
          launchable: capsule.launchable,
          score
        });
      }
    }
  }
  return results.sort((a, b) => (b.score || 0) - (a.score || 0) || a.name.localeCompare(b.name));
}

function mimeTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js' || ext === '.mjs') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

export async function launchPlatformCapsule(config, slug, capsuleId, options = {}) {
  const power = readJson(path.join(config.rootDir, 'platform', 'user-platforms', slug, 'skyehands.power.json'), null);
  if (!power) throw new Error(`Missing power mesh for ${slug}`);
  const capsule = (power.capsules || []).find(item => item.capsuleId === capsuleId);
  if (!capsule) throw new Error(`Missing capsule ${capsuleId}`);
  if (!capsule.launchable || !capsule.entryFile) throw new Error(`Capsule ${capsuleId} is not launchable`);
  const absoluteEntry = path.join(config.rootDir, 'platform', 'user-platforms', slug, 'source', capsule.entryFile);
  const serveRoot = path.dirname(absoluteEntry);
  const host = options.host || '127.0.0.1';
  const port = Number.parseInt(String(options.port || 8940), 10);
  const server = http.createServer((request, response) => {
    let requestPath = request.url || '/';
    if (requestPath === '/') requestPath = '/' + path.basename(absoluteEntry);
    const safePath = normalizePath(requestPath).replace(/^\//, '');
    const targetPath = path.join(serveRoot, safePath);
    if (!targetPath.startsWith(serveRoot) || !fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    response.writeHead(200, { 'content-type': mimeTypeFor(targetPath) });
    response.end(fs.readFileSync(targetPath));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  const baseUrl = `http://${host}:${port}`;
  return {
    slug,
    capsuleId,
    baseUrl,
    entryUrl: `${baseUrl}/${path.basename(absoluteEntry)}`,
    stop: () => new Promise(resolve => server.close(resolve))
  };
}
