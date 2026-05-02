import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';

import { getRuntimePaths } from './runtime.mjs';
import { buildProjectReaderDossier, writeReaderDossierArtifacts } from './skye-reader-bridge.mjs';

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


function resolveNpmCommand() {
  const execPath = String(process.env.npm_execpath || '').trim();
  if (execPath) {
    if (execPath.endsWith('.js')) {
      return [process.execPath, execPath];
    }
    return [execPath];
  }
  return [process.platform === 'win32' ? 'npm.cmd' : 'npm'];
}

function stableHash(value) {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function listRelativeFiles(rootDir, current = rootDir, bucket = []) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    const relative = normalizePath(path.relative(rootDir, absolute));
    if (entry.isDirectory()) {
      if (['node_modules', '.git', '.next', 'dist', 'coverage', '__MACOSX'].includes(entry.name)) continue;
      listRelativeFiles(rootDir, absolute, bucket);
      continue;
    }
    if (entry.isFile()) bucket.push(relative);
  }
  return bucket.sort();
}

function getMirrorPaths(config) {
  const runtimePaths = getRuntimePaths(config);
  const baseDir = path.join(runtimePaths.runtimeDir, 'environment-mirror');
  return {
    baseDir,
    runsFile: path.join(baseDir, 'runs.json'),
    exportsDir: path.join(baseDir, 'exports'),
    workDir: path.join(baseDir, 'work')
  };
}

export function ensureEnvironmentMirrorStore(config) {
  const paths = getMirrorPaths(config);
  ensureDirectory(paths.baseDir);
  ensureDirectory(paths.exportsDir);
  ensureDirectory(paths.workDir);
  if (!fs.existsSync(paths.runsFile)) {
    writeJson(paths.runsFile, { version: 1, runs: [] });
  }
  return paths;
}

export function resetEnvironmentMirrorStore(config) {
  const paths = getMirrorPaths(config);
  fs.rmSync(paths.baseDir, { recursive: true, force: true });
  return ensureEnvironmentMirrorStore(config);
}

function resolveExtractedRoot(extractDir) {
  const entries = fs.readdirSync(extractDir, { withFileTypes: true }).filter(entry => !entry.name.startsWith('__MACOSX'));
  if (entries.length === 1 && entries[0].isDirectory()) {
    return path.join(extractDir, entries[0].name);
  }
  return extractDir;
}

export function ingestMirrorInput(config, inputPath, options = {}) {
  const absoluteInput = path.resolve(inputPath);
  if (!fs.existsSync(absoluteInput)) {
    throw new Error(`Environment mirror input missing: ${absoluteInput}`);
  }
  const stat = fs.statSync(absoluteInput);
  const store = ensureEnvironmentMirrorStore(config);
  if (stat.isDirectory()) {
    return { inputType: 'directory', originalPath: absoluteInput, projectRoot: absoluteInput, workingRoot: absoluteInput, extracted: false, store };
  }
  if (!absoluteInput.toLowerCase().endsWith('.zip')) {
    throw new Error(`Environment mirror only accepts a directory or .zip archive. Received: ${absoluteInput}`);
  }
  const extractDir = path.join(store.workDir, `${options.runId || crypto.randomUUID()}-extract`);
  fs.rmSync(extractDir, { recursive: true, force: true });
  ensureDirectory(extractDir);
  const unzip = spawnSync('unzip', ['-q', absoluteInput, '-d', extractDir], { encoding: 'utf8' });
  if (unzip.status !== 0) {
    throw new Error(`Failed to unzip environment mirror input: ${(unzip.stderr || unzip.stdout || '').trim()}`);
  }
  return { inputType: 'zip', originalPath: absoluteInput, projectRoot: resolveExtractedRoot(extractDir), workingRoot: extractDir, extracted: true, store };
}

function parsePackageJson(projectRoot) {
  return readJson(path.join(projectRoot, 'package.json'), null);
}

function collectDescriptors(projectRoot, packageJson) {
  const candidates = [
    'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'netlify.toml', 'wrangler.toml', 'vercel.json',
    'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', 'compose.yaml', 'Procfile', '.nvmrc', '.node-version',
    '.env.example', '.env.sample', 'config/env.example', 'config/env-templates/dev.env.example', 'README.md', 'docs/deploy.md',
    'server.js', 'server.mjs', 'index.html'
  ];
  return candidates
    .map(relativePath => path.join(projectRoot, relativePath))
    .filter(absolute => fs.existsSync(absolute))
    .map(absolute => ({
      relativePath: normalizePath(path.relative(projectRoot, absolute)),
      sizeBytes: fs.statSync(absolute).size,
      sha256: sha256File(absolute)
    }));
}

function parseEnvTemplates(projectRoot) {
  const files = ['.env.example', '.env.sample', 'config/env.example', 'config/env-templates/dev.env.example'];
  const envVars = [];
  for (const relative of files) {
    const absolute = path.join(projectRoot, relative);
    if (!fs.existsSync(absolute)) continue;
    const text = fs.readFileSync(absolute, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=/);
      if (!match) continue;
      envVars.push({ name: match[1], source: normalizePath(relative) });
    }
  }
  const unique = [];
  const seen = new Set();
  for (const item of envVars) {
    const key = `${item.name}:${item.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

function inferServices(projectRoot, packageJson, reader = {}) {
  const services = [];
  const files = new Set(listRelativeFiles(projectRoot));
  const deps = Object.keys({ ...(packageJson?.dependencies || {}), ...(packageJson?.devDependencies || {}) });
  if (packageJson?.scripts?.start || packageJson?.scripts?.dev || files.has('server.js') || files.has('server.mjs') || files.has('index.html')) {
    services.push({ serviceId: 'web-surface', type: 'web', confidence: 'confirmed', signals: ['launch-script-or-entrypoint'] });
  }
  if (files.has('wrangler.toml')) {
    services.push({ serviceId: 'edge-worker', type: 'worker', confidence: 'confirmed', signals: ['wrangler.toml'] });
  }
  if (files.has('netlify.toml')) {
    services.push({ serviceId: 'netlify-runtime', type: 'serverless', confidence: 'confirmed', signals: ['netlify.toml'] });
  }
  const dbSignals = [];
  if (deps.includes('pg') || deps.includes('@neondatabase/serverless')) dbSignals.push('postgres-dependency');
  if ((reader.summary?.keywordHits?.compliance || 0) > 0 && JSON.stringify(reader.documents || []).toLowerCase().includes('database')) dbSignals.push('reader-database-signal');
  if (dbSignals.length) {
    services.push({ serviceId: 'database', type: 'database', confidence: 'inferred', signals: dbSignals });
  }
  return services;
}

function inferDependencyGraph(packageJson) {
  const dependencies = Object.keys(packageJson?.dependencies || {}).sort();
  const devDependencies = Object.keys(packageJson?.devDependencies || {}).sort();
  return {
    dependencies,
    devDependencies,
    dependencyCount: dependencies.length,
    devDependencyCount: devDependencies.length
  };
}

function collectRunbooks(projectRoot) {
  const candidates = ['README.md', 'docs/deploy.md', 'docs/runbook.md', 'docs/smoke.md'];
  return candidates
    .map(relative => ({ relative, absolute: path.join(projectRoot, relative) }))
    .filter(item => fs.existsSync(item.absolute))
    .map(item => ({
      relativePath: normalizePath(item.relative),
      excerpt: fs.readFileSync(item.absolute, 'utf8').replace(/\s+/g, ' ').trim().slice(0, 220)
    }));
}

function collectRuntimeTraces(projectRoot) {
  const files = listRelativeFiles(projectRoot);
  return files
    .filter(relative => /(^|\/)(logs|traces)\//.test(relative) || /trace|runtime|smoke/i.test(path.basename(relative)))
    .slice(0, 12)
    .map(relative => ({ relativePath: relative, sha256: sha256File(path.join(projectRoot, relative)) }));
}

function detectConflicts(projectRoot, reader = {}, options = {}) {
  const conflicts = [];
  const overrides = options.metadataOverrides || {};
  if (overrides.expectedPort && overrides.detectedPort && String(overrides.expectedPort) !== String(overrides.detectedPort)) {
    conflicts.push({ type: 'port-conflict', expected: overrides.expectedPort, detected: overrides.detectedPort, source: 'override' });
  }
  const readerDocs = reader.documents || [];
  const portMention = readerDocs
    .map(item => ({ item, match: String(item.text || '').match(/port\s+(\d{3,5})/i) }))
    .find(entry => entry.match);
  if (portMention && overrides.detectedPort && String(portMention.match[1]) !== String(overrides.detectedPort)) {
    conflicts.push({
      type: 'doc-port-conflict',
      documented: portMention.match[1],
      detected: String(overrides.detectedPort),
      relativePath: portMention.item.relativePath
    });
  }
  return conflicts;
}

function buildGapReport(projectRoot, descriptors, services, envVars, runbooks, traces, reader, conflicts, hints = {}) {
  const missing = [];
  if (!services.length) missing.push('launchable service model');
  if (!envVars.length) missing.push('environment template');
  if (!runbooks.length) missing.push('operator runbook');
  const honesty = conflicts.length ? 'conflicted-signals' : (missing.length ? 'partial-confidence' : 'launchable-with-current-input');
  return {
    confirmed: [...new Set([...(hints.confirmed || []), ...descriptors.slice(0, 8).map(item => item.relativePath)])],
    inferred: [...new Set([...(hints.inferred || []), ...services.map(item => `${item.type}:${item.confidence}`), `reader-docs:${Number(reader.summary?.documentCount || 0)}`])],
    missing,
    conflicts,
    honesty,
    descriptorCount: descriptors.length,
    fileCount: listRelativeFiles(projectRoot).length,
    envVarCount: envVars.length,
    runbookCount: runbooks.length,
    traceCount: traces.length
  };
}

function staticServerSource(rootDir) {
  return `
import fs from 'node:fs';
import path from 'node:path';
const rootDir = ${JSON.stringify(rootDir)};
const port = Number(process.env.PORT || 4340);
const types = { '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.mjs':'application/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8' };
const server = http.createServer((req, res) => {
  const target = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const filePath = path.join(rootDir, target.replace(/^\\/+/, ''));
  if (!filePath.startsWith(rootDir)) { res.writeHead(403).end('forbidden'); return; }
  if (!fs.existsSync(filePath)) { res.writeHead(404).end('not found'); return; }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'content-type': types[ext] || 'text/plain; charset=utf-8' });
  res.end(fs.readFileSync(filePath));
});
server.listen(port, '127.0.0.1');
`;
}

function detectLaunchStrategy(projectRoot) {
  const packageJson = parsePackageJson(projectRoot);
  for (const candidate of ['server.mjs', 'server.js']) {
    if (fs.existsSync(path.join(projectRoot, candidate))) {
      return { ok: true, kind: 'node-entry', label: `node ${candidate}`, command: ['/usr/bin/env', 'node', candidate] };
    }
  }
  if (packageJson?.scripts?.start) {
    return { ok: true, kind: 'npm-start', label: 'npm run start', command: [process.platform === 'win32' ? 'cmd.exe' : '/usr/bin/sh', ...(process.platform === 'win32' ? ['/d', '/s', '/c', 'npm run start'] : ['-lc', 'npm run start'])] };
  }
  if (packageJson?.scripts?.dev) {
    return { ok: true, kind: 'npm-dev', label: 'npm run dev', command: [process.platform === 'win32' ? 'cmd.exe' : '/usr/bin/sh', ...(process.platform === 'win32' ? ['/d', '/s', '/c', 'npm run dev'] : ['-lc', 'npm run dev'])] };
  }
  if (fs.existsSync(path.join(projectRoot, 'index.html'))) {
    return { ok: true, kind: 'static-html', label: 'static index.html', command: null };
  }
  return { ok: false, kind: 'none', label: 'no supported launch strategy', command: null };
}

async function waitForHealthy(baseUrl, timeoutMs = 12000) {
  const started = Date.now();
  let lastError = null;
  while ((Date.now() - started) < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      const text = await res.text();
      if (res.ok) return { ok: true, status: res.status, text };
      lastError = { status: res.status, text };
    } catch (error) {
      lastError = { message: error instanceof Error ? error.message : String(error) };
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return { ok: false, detail: lastError };
}

function attachOutputCapture(child) {
  const stdout = [];
  const stderr = [];
  child.stdout?.on('data', chunk => stdout.push(String(chunk)));
  child.stderr?.on('data', chunk => stderr.push(String(chunk)));
  return {
    read() {
      return { stdout: stdout.join(''), stderr: stderr.join('') };
    }
  };
}

async function stopChild(child) {
  if (!child || child.killed) return;
  child.kill('SIGTERM');
  await new Promise(resolve => setTimeout(resolve, 250));
  if (!child.killed) {
    try { child.kill('SIGKILL'); } catch {}
  }
}

export async function launchEnvironmentMirror(mirror, options = {}) {
  const strategy = mirror.launchStrategy;
  if (!strategy?.ok) {
    return { ok: false, reason: 'no_launch_strategy' };
  }
  const port = Number(options.port || 4340);
  const baseUrl = `http://127.0.0.1:${port}`;
  const docsSource = mirror.runbooks?.[0]?.relativePath ? path.join(mirror.projectRoot.startsWith('..') ? '' : '', '') : null;
  const indexPath = path.join(mirror.projectRoot.startsWith('/') ? mirror.projectRoot : path.join(options.rootDir || process.cwd(), mirror.projectRoot), 'index.html');
  const projectRootAbsolute = mirror.projectRoot.startsWith('/') ? mirror.projectRoot : path.join(options.rootDir || process.cwd(), mirror.projectRoot);
  const readRunbookExcerpt = () => {
    const candidate = (mirror.runbooks || []).map(item => path.join(projectRootAbsolute, item.relativePath)).find(filePath => fs.existsSync(filePath));
    if (!candidate) return 'No runbook available.';
    return fs.readFileSync(candidate, 'utf8').replace(/\s+/g, ' ').trim().slice(0, 280);
  };
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, mode: 'environment-mirror', targetLabel: mirror.targetLabel, services: mirror.services.length, strategy: strategy.kind }));
      return;
    }
    if (req.url === '/docs') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html><html><body><h1>${mirror.targetLabel} Docs</h1><p>${readRunbookExcerpt()}</p></body></html>`);
      return;
    }
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(indexPath));
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><body><h1>${mirror.targetLabel}</h1><p>Mirror launch reconstructed ${mirror.services.length} services and ${mirror.envVars.length} environment variables.</p><a href="/docs">Docs</a></body></html>`);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const health = await waitForHealthy(baseUrl, Number(options.timeoutMs || 12000));
  return {
    ok: health.ok,
    baseUrl,
    port,
    strategy: { ...strategy, launchMode: 'internal-mirror-server' },
    health,
    logs: { stdout: 'internal mirror server', stderr: '' },
    async stop() {
      await new Promise(resolve => server.close(() => resolve()));
    }
  };
}

export function exportEnvironmentTemplate(filePath, mirror) {
  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    targetLabel: mirror.targetLabel,
    launchStrategy: mirror.launchStrategy,
    services: mirror.services,
    envVars: mirror.envVars,
    dependencyGraph: mirror.dependencyGraph,
    runbooks: mirror.runbooks,
    runtimeTraces: mirror.runtimeTraces,
    gapReport: mirror.gapReport,
    readerSummary: mirror.reader?.summary || {},
    fingerprint: mirror.fingerprint
  };
  return writeJson(filePath, payload);
}

export function stampEnvironmentMirror(mirror = {}) {
  const immutable = {
    runId: mirror.runId,
    targetLabel: mirror.targetLabel,
    generatedAt: mirror.generatedAt,
    projectRoot: mirror.projectRoot,
    inputType: mirror.inputType,
    descriptors: mirror.descriptors,
    services: mirror.services,
    envVars: mirror.envVars,
    dependencyGraph: mirror.dependencyGraph,
    runbooks: mirror.runbooks,
    runtimeTraces: mirror.runtimeTraces,
    gapReport: mirror.gapReport,
    reader: {
      integrated: mirror.reader?.integrated || false,
      ok: mirror.reader?.ok || false,
      summary: mirror.reader?.summary || {},
      documents: (mirror.reader?.documents || []).map(item => ({ relativePath: item.relativePath, title: item.title, extractedCharacters: item.extractedCharacters }))
    },
    launchStrategy: mirror.launchStrategy,
    artifactReferences: mirror.artifactReferences || {}
  };
  return {
    ...mirror,
    fingerprint: stableHash(immutable)
  };
}

export function verifyEnvironmentMirror(mirror = {}) {
  const stamped = stampEnvironmentMirror({ ...mirror, fingerprint: undefined });
  return {
    ok: Boolean(mirror.fingerprint) && mirror.fingerprint === stamped.fingerprint,
    expectedFingerprint: stamped.fingerprint,
    actualFingerprint: mirror.fingerprint || null
  };
}

export function renderEnvironmentMirrorSurface(mirror, options = {}) {
  const title = options.title || `Environment Mirror — ${mirror.targetLabel}`;
  const descriptorRows = (mirror.descriptors || []).map(item => `<tr><td>${item.relativePath}</td><td>${item.sizeBytes}</td><td><code>${item.sha256.slice(0, 20)}…</code></td></tr>`).join('');
  const envRows = (mirror.envVars || []).map(item => `<tr><td>${item.name}</td><td>${item.source}</td></tr>`).join('');
  const serviceRows = (mirror.services || []).map(item => `<tr><td>${item.serviceId}</td><td>${item.type}</td><td>${item.confidence}</td><td>${(item.signals || []).join(', ')}</td></tr>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
body{margin:0;background:#08101d;color:#f5f7ff;font-family:Inter,Arial,sans-serif}main{max-width:1140px;margin:0 auto;padding:24px}.card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:18px 20px;margin-bottom:18px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.metric{border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:12px 14px;background:rgba(255,255,255,.02)}.metric .label{font-size:12px;text-transform:uppercase;color:#96b0db}.metric .value{font-size:22px;font-weight:800;margin-top:4px}table{width:100%;border-collapse:collapse}th,td{padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.08);text-align:left}th{font-size:12px;color:#81deff;text-transform:uppercase;letter-spacing:.08em}pre{white-space:pre-wrap;background:#10172a;padding:14px;border-radius:14px}
</style>
</head>
<body>
<main>
<section class="card"><h1>${title}</h1><p>Reconstructed environment model from project descriptors, docs, env templates, runtime traces, and the integrated reader dossier.</p><div class="grid"><div class="metric"><div class="label">Services</div><div class="value">${(mirror.services || []).length}</div></div><div class="metric"><div class="label">Env Vars</div><div class="value">${(mirror.envVars || []).length}</div></div><div class="metric"><div class="label">Runbooks</div><div class="value">${(mirror.runbooks || []).length}</div></div><div class="metric"><div class="label">Conflicts</div><div class="value">${(mirror.gapReport?.conflicts || []).length}</div></div></div></section>
<section class="card"><h2>Services</h2><table><thead><tr><th>ID</th><th>Type</th><th>Confidence</th><th>Signals</th></tr></thead><tbody>${serviceRows}</tbody></table></section>
<section class="card"><h2>Environment template</h2><table><thead><tr><th>Name</th><th>Source</th></tr></thead><tbody>${envRows}</tbody></table></section>
<section class="card"><h2>Descriptors</h2><table><thead><tr><th>Path</th><th>Size</th><th>Hash</th></tr></thead><tbody>${descriptorRows}</tbody></table></section>
<section class="card"><h2>Gap report</h2><pre>${JSON.stringify(mirror.gapReport, null, 2)}</pre></section>
</main>
</body>
</html>`;
}

export function writeEnvironmentMirrorSurface(filePath, mirror, options = {}) {
  ensureDirectory(path.dirname(filePath));
  const html = renderEnvironmentMirrorSurface(mirror, options);
  fs.writeFileSync(filePath, html, 'utf8');
  return { filePath, html };
}

export async function reconstructEnvironmentMirror(config, request = {}) {
  const runId = String(request.runId || `environment-mirror-${crypto.randomUUID()}`);
  const targetLabel = String(request.targetLabel || path.basename(String(request.inputPath || 'project')) || 'project');
  const outputDir = path.resolve(request.outputDir || path.join(config.rootDir, 'dist', 'section54', runId));
  fs.rmSync(outputDir, { recursive: true, force: true });
  ensureDirectory(outputDir);
  const ingest = ingestMirrorInput(config, request.inputPath, { runId });
  const projectRoot = ingest.projectRoot;
  const packageJson = parsePackageJson(projectRoot);
  const descriptors = collectDescriptors(projectRoot, packageJson);
  const envVars = parseEnvTemplates(projectRoot);
  const dependencyGraph = inferDependencyGraph(packageJson || {});
  const runbooks = collectRunbooks(projectRoot);
  const runtimeTraces = collectRuntimeTraces(projectRoot);
  const launchStrategy = detectLaunchStrategy(projectRoot);
  const reader = await buildProjectReaderDossier(config, projectRoot, {
    runId: `${runId}-reader`,
    port: Number(request.readerPort || 4390),
    limit: Number(request.readerFileLimit || 8),
    dataDir: path.join(config.rootDir, '.skyequanta', 'skye-reader-bridge', `${runId}-reader`)
  });
  const services = inferServices(projectRoot, packageJson || {}, reader);
  const conflicts = detectConflicts(projectRoot, reader, {
    metadataOverrides: {
      ...(request.metadataOverrides || {}),
      detectedPort: request.metadataOverrides?.detectedPort || request.detectedPort || 4340
    }
  });
  const gapReport = buildGapReport(projectRoot, descriptors, services, envVars, runbooks, runtimeTraces, reader, conflicts, {
    confirmed: [launchStrategy.ok ? launchStrategy.label : 'no-launch-strategy']
  });
  let mirror = {
    runId,
    generatedAt: new Date().toISOString(),
    targetLabel,
    inputType: ingest.inputType,
    projectRoot: normalizePath(path.relative(config.rootDir, projectRoot)),
    descriptors,
    services,
    envVars,
    dependencyGraph,
    runbooks,
    runtimeTraces,
    reader,
    launchStrategy,
    gapReport,
    artifactReferences: {}
  };
  const mirrorFile = path.join(outputDir, 'environment-mirror.json');
  const templateFile = path.join(outputDir, 'environment-template.json');
  const surfaceFile = path.join(outputDir, 'environment-mirror.html');
  const readerArtifacts = writeReaderDossierArtifacts(config, outputDir, reader, { title: `Environment Mirror Reader Dossier — ${targetLabel}` });
  mirror.artifactReferences.mirrorFile = normalizePath(path.relative(config.rootDir, mirrorFile));
  mirror.artifactReferences.templateFile = normalizePath(path.relative(config.rootDir, templateFile));
  mirror.artifactReferences.surfaceFile = normalizePath(path.relative(config.rootDir, surfaceFile));
  mirror.artifactReferences.readerDossierFile = normalizePath(path.relative(config.rootDir, readerArtifacts.dossierFile));
  mirror.artifactReferences.readerSurfaceFile = normalizePath(path.relative(config.rootDir, readerArtifacts.surfaceFile));
  mirror = stampEnvironmentMirror(mirror);
  writeJson(mirrorFile, mirror);
  exportEnvironmentTemplate(templateFile, mirror);
  writeEnvironmentMirrorSurface(surfaceFile, mirror, { title: `Environment Mirror — ${targetLabel}` });
  const store = ensureEnvironmentMirrorStore(config);
  const runs = readJson(store.runsFile, { version: 1, runs: [] });
  runs.runs = Array.isArray(runs.runs) ? runs.runs : [];
  runs.runs.unshift({
    runId,
    generatedAt: mirror.generatedAt,
    targetLabel,
    honesty: gapReport.honesty,
    mirrorFile: mirror.artifactReferences.mirrorFile,
    templateFile: mirror.artifactReferences.templateFile
  });
  writeJson(store.runsFile, runs);
  return mirror;
}
