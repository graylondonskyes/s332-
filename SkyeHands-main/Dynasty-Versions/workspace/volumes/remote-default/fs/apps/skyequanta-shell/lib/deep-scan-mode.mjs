#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

import { getRuntimePaths } from './runtime.mjs';
import { evaluateComplianceMode } from './compliance-native-modes.mjs';
import { buildCostProviderGraph, planBudgetAwareRun, writeCostExplanationSurface } from './costbrain.mjs';
import { orchestrateCouncilRun } from './kaixu-council.mjs';
import { ingestMemoryEvent, explainMemoryBackedDecision } from './skye-memory-fabric.mjs';
import { createReplaySession, appendReplayEvent, createReplayCheckpoint, exportReplayBundle, verifyReplayBundle, createReplayExportBundle } from './skye-replay.mjs';
import { buildProjectReaderDossier, writeReaderDossierArtifacts } from './skye-reader-bridge.mjs';
import { evaluateAutonomyMode, simulateAutonomyRun } from './autonomy-gradient.mjs';
import { reconstructEnvironmentMirror } from './environment-mirror.mjs';
import { summarizeFoundrySignals } from './skye-foundry.mjs';
import { summarizeMaintenanceSignals } from './autonomous-maintenance-mode.mjs';
import { inferCommercialSignals } from './deal-ownership-aware-generation.mjs';
import { buildDevGlowProjectSignals } from './devglow.mjs';
import { summarizeRegisteredPlatformByPath } from './platform-launchpad.mjs';

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

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function listRelativeFiles(rootDir, current = rootDir, bucket = []) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    const relative = normalizePath(path.relative(rootDir, absolute));
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      listRelativeFiles(rootDir, absolute, bucket);
      continue;
    }
    if (entry.isFile()) bucket.push(relative);
  }
  return bucket.sort();
}

function countFiles(rootDir) {
  try {
    return listRelativeFiles(rootDir).length;
  } catch {
    return 0;
  }
}

function getDeepScanPaths(config) {
  const runtimePaths = getRuntimePaths(config);
  const baseDir = path.join(runtimePaths.runtimeDir, 'deep-scan-mode');
  return {
    baseDir,
    indexFile: path.join(baseDir, 'index.json'),
    runsDir: path.join(baseDir, 'runs')
  };
}

export function ensureDeepScanStore(config) {
  const paths = getDeepScanPaths(config);
  ensureDirectory(paths.baseDir);
  ensureDirectory(paths.runsDir);
  if (!fs.existsSync(paths.indexFile)) {
    writeJson(paths.indexFile, { version: 1, runs: [] });
  }
  return paths;
}

export function resetDeepScanStore(config) {
  const paths = getDeepScanPaths(config);
  fs.rmSync(paths.baseDir, { recursive: true, force: true });
  return ensureDeepScanStore(config);
}

function saveDeepScanRecord(config, report) {
  const paths = ensureDeepScanStore(config);
  const recordFile = path.join(paths.runsDir, `${report.scanId}.json`);
  writeJson(recordFile, report);
  const index = readJson(paths.indexFile, { version: 1, runs: [] });
  index.runs = Array.isArray(index.runs) ? index.runs : [];
  index.runs.push({
    scanId: report.scanId,
    generatedAt: report.generatedAt,
    targetLabel: report.targetLabel,
    status: report.status,
    valuationReady: report.valuationReady,
    runFile: normalizePath(path.relative(config.rootDir, recordFile))
  });
  writeJson(paths.indexFile, index);
  return { recordFile, indexFile: paths.indexFile };
}

function resolveExtractedRoot(extractDir) {
  const entries = fs.readdirSync(extractDir, { withFileTypes: true }).filter(entry => !entry.name.startsWith('__MACOSX'));
  if (entries.length === 1 && entries[0].isDirectory()) {
    return path.join(extractDir, entries[0].name);
  }
  return extractDir;
}

export function ingestProjectInput(config, inputPath, options = {}) {
  const absoluteInput = path.resolve(inputPath);
  if (!fs.existsSync(absoluteInput)) {
    throw new Error(`Deep scan input was not found: ${absoluteInput}`);
  }
  const stat = fs.statSync(absoluteInput);
  const runtimePaths = ensureDeepScanStore(config);
  if (stat.isDirectory()) {
    return {
      inputType: 'directory',
      originalPath: absoluteInput,
      projectRoot: absoluteInput,
      workingRoot: absoluteInput,
      extracted: false,
      storePaths: runtimePaths
    };
  }
  if (!absoluteInput.toLowerCase().endsWith('.zip')) {
    throw new Error(`Deep scan only supports project directories or .zip archives. Received: ${absoluteInput}`);
  }
  const extractDir = path.join(runtimePaths.baseDir, 'ingest', `${options.scanId || crypto.randomUUID()}-extract`);
  fs.rmSync(extractDir, { recursive: true, force: true });
  ensureDirectory(extractDir);
  const unzip = spawnSync('unzip', ['-q', absoluteInput, '-d', extractDir], { encoding: 'utf8' });
  if (unzip.status !== 0) {
    throw new Error(`Failed to unzip deep scan archive: ${(unzip.stderr || unzip.stdout || '').trim()}`);
  }
  const projectRoot = resolveExtractedRoot(extractDir);
  return {
    inputType: 'zip',
    originalPath: absoluteInput,
    projectRoot,
    workingRoot: extractDir,
    extracted: true,
    storePaths: runtimePaths
  };
}

function parsePackageJson(projectRoot) {
  return readJson(path.join(projectRoot, 'package.json'), null);
}

function detectFramework(packageJson) {
  const deps = {
    ...(packageJson?.dependencies || {}),
    ...(packageJson?.devDependencies || {})
  };
  const names = Object.keys(deps);
  if (names.includes('next')) return 'nextjs';
  if (names.includes('vite')) return 'vite';
  if (names.includes('react')) return 'react';
  if (names.includes('@angular/core')) return 'angular';
  if (names.includes('vue')) return 'vue';
  return 'generic-node';
}

function collectDeploymentDescriptors(projectRoot, packageJson) {
  const candidates = [
    'package.json',
    'package-lock.json',
    'npm-shrinkwrap.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'netlify.toml',
    'wrangler.toml',
    'vercel.json',
    'Dockerfile',
    'docker-compose.yml',
    'docker-compose.yaml',
    'compose.yaml',
    'Procfile',
    '.nvmrc',
    '.node-version',
    'vite.config.js',
    'vite.config.mjs',
    'next.config.js',
    'next.config.mjs',
    'server.js',
    'server.mjs',
    'index.html'
  ];
  const descriptors = [];
  for (const relative of candidates) {
    const absolute = path.join(projectRoot, relative);
    if (!fs.existsSync(absolute)) continue;
    descriptors.push({
      relativePath: normalizePath(relative),
      sha256: sha256File(absolute),
      sizeBytes: fs.statSync(absolute).size
    });
  }
  return {
    packageName: packageJson?.name || null,
    packageVersion: packageJson?.version || null,
    framework: detectFramework(packageJson),
    descriptors,
    scriptNames: Object.keys(packageJson?.scripts || {})
  };
}

export function detectLaunchStrategy(projectRoot) {
  const packageJson = parsePackageJson(projectRoot);
  const metadata = collectDeploymentDescriptors(projectRoot, packageJson);
  const dependencies = Object.keys({
    ...(packageJson?.dependencies || {}),
    ...(packageJson?.devDependencies || {})
  });
  const nodeModulesPresent = fs.existsSync(path.join(projectRoot, 'node_modules'));
  const common = {
    packageJson,
    metadata,
    dependencies,
    nodeModulesPresent
  };
  if (packageJson?.scripts?.start) {
    return {
      ok: true,
      kind: 'npm-start',
      label: 'npm run start',
      command: [process.platform === 'win32' ? 'cmd.exe' : '/usr/bin/sh', ...(process.platform === 'win32' ? ['/d', '/s', '/c', 'npm run start'] : ['-lc', 'npm run start'])],
      env: {},
      gapReport: buildEnvironmentGapReport(projectRoot, metadata, {
        confirmed: ['package.json', 'npm-start script'],
        inferred: [metadata.framework],
        missing: dependencies.length > 0 && !nodeModulesPresent ? ['dependency install may be required before scan'] : []
      }),
      ...common
    };
  }
  if (packageJson?.scripts?.dev) {
    return {
      ok: true,
      kind: 'npm-dev',
      label: 'npm run dev',
      command: [process.platform === 'win32' ? 'cmd.exe' : '/usr/bin/sh', ...(process.platform === 'win32' ? ['/d', '/s', '/c', 'npm run dev'] : ['-lc', 'npm run dev'])],
      env: {},
      gapReport: buildEnvironmentGapReport(projectRoot, metadata, {
        confirmed: ['package.json', 'npm-dev script'],
        inferred: [metadata.framework],
        missing: dependencies.length > 0 && !nodeModulesPresent ? ['dependency install may be required before scan'] : []
      }),
      ...common
    };
  }
  for (const candidate of ['server.mjs', 'server.js']) {
    if (fs.existsSync(path.join(projectRoot, candidate))) {
      return {
        ok: true,
        kind: 'node-entry',
        label: `node ${candidate}`,
        command: ['/usr/bin/env', 'node', candidate],
        env: {},
        gapReport: buildEnvironmentGapReport(projectRoot, metadata, {
          confirmed: [candidate],
          inferred: [metadata.framework],
          missing: []
        }),
        ...common
      };
    }
  }
  if (fs.existsSync(path.join(projectRoot, 'index.html'))) {
    return {
      ok: true,
      kind: 'static-html',
      label: 'static index.html preview',
      command: null,
      env: {},
      gapReport: buildEnvironmentGapReport(projectRoot, metadata, {
        confirmed: ['index.html'],
        inferred: ['static-preview'],
        missing: []
      }),
      ...common
    };
  }
  return {
    ok: false,
    kind: 'none',
    label: 'no supported launch strategy found',
    command: null,
    env: {},
    gapReport: buildEnvironmentGapReport(projectRoot, metadata, {
      confirmed: metadata.descriptors.map(item => item.relativePath),
      inferred: [metadata.framework],
      missing: ['supported launch strategy', 'previewable entrypoint']
    }),
    ...common
  };
}

export function buildEnvironmentGapReport(projectRoot, metadata = {}, hints = {}) {
  const descriptors = Array.isArray(metadata.descriptors) ? metadata.descriptors.map(item => item.relativePath) : [];
  const fileCount = countFiles(projectRoot);
  const scripts = Array.isArray(metadata.scriptNames) ? metadata.scriptNames : [];
  return {
    confirmed: [...new Set([...(hints.confirmed || []), ...descriptors.slice(0, 6)])],
    inferred: [...new Set([...(hints.inferred || []), scripts.length ? `scripts:${scripts.join(',')}` : null].filter(Boolean))],
    missing: [...new Set((hints.missing || []).filter(Boolean))],
    fileCount,
    descriptorCount: descriptors.length,
    scriptCount: scripts.length,
    packageName: metadata.packageName || null,
    framework: metadata.framework || null,
    honesty: (hints.missing || []).length === 0 ? 'launchable-with-current-input' : 'partial-confidence'
  };
}

function staticServerSource(rootDir) {
  return `
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const rootDir = ${JSON.stringify(rootDir)};
const port = Number(process.env.PORT || 4310);
const types = { '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.mjs':'application/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8' };
const server = http.createServer((req, res) => {
  const target = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const filePath = path.join(rootDir, target.replace(/^\/+/, ''));
  if (!filePath.startsWith(rootDir)) { res.writeHead(403).end('forbidden'); return; }
  if (!fs.existsSync(filePath)) { res.writeHead(404).end('not found'); return; }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'content-type': types[ext] || 'text/plain; charset=utf-8' });
  res.end(fs.readFileSync(filePath));
});
server.listen(port, '127.0.0.1', () => console.log(JSON.stringify({ ok: true, port, rootDir })));
`;
}

async function waitForHealthy(baseUrl, healthPath = '/health', timeoutMs = 12000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}${healthPath}`);
      const text = await response.text();
      let json = null;
      try { json = JSON.parse(text); } catch {}
      if (response.ok) {
        return { ok: true, status: response.status, text, json };
      }
      lastError = { status: response.status, text };
    } catch (error) {
      lastError = { message: error instanceof Error ? error.message : String(error) };
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return { ok: false, reason: 'health_timeout', detail: lastError };
}

function attachOutputCapture(child) {
  const stdout = [];
  const stderr = [];
  child.stdout?.on('data', chunk => stdout.push(String(chunk)));
  child.stderr?.on('data', chunk => stderr.push(String(chunk)));
  return {
    stdout,
    stderr,
    read() {
      return {
        stdout: stdout.join(''),
        stderr: stderr.join('')
      };
    }
  };
}

async function stopLaunchedProject(launch) {
  if (!launch?.child || launch.child.killed) return;
  launch.child.kill('SIGTERM');
  await new Promise(resolve => setTimeout(resolve, 250));
  if (!launch.child.killed) {
    try { launch.child.kill('SIGKILL'); } catch {}
  }
}

export async function launchProjectPreview(projectRoot, strategy, options = {}) {
  const port = Number(options.port || 4310);
  const baseUrl = `http://127.0.0.1:${port}`;
  let child;
  if (strategy.kind === 'static-html') {
    child = spawn(process.execPath, ['--input-type=module', '-e', staticServerSource(projectRoot)], {
      cwd: projectRoot,
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } else if ((strategy.kind === 'npm-start' || strategy.kind === 'npm-dev') && fs.existsSync(path.join(projectRoot, 'server.mjs'))) {
    child = spawn('/usr/bin/env', ['node', 'server.mjs'], {
      cwd: projectRoot,
      env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', ...(strategy.env || {}) },
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } else if ((strategy.kind === 'npm-start' || strategy.kind === 'npm-dev') && fs.existsSync(path.join(projectRoot, 'server.js'))) {
    child = spawn('/usr/bin/env', ['node', 'server.js'], {
      cwd: projectRoot,
      env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', ...(strategy.env || {}) },
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } else if (strategy.command) {
    child = spawn(strategy.command[0], strategy.command.slice(1), {
      cwd: projectRoot,
      env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', ...(strategy.env || {}) },
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } else {
    throw new Error(`Unsupported deep-scan launch strategy '${strategy.kind}'.`);
  }
  const capture = attachOutputCapture(child);
  const health = await waitForHealthy(baseUrl, options.healthPath || '/health', options.timeoutMs || 12000);
  return {
    ok: health.ok,
    child,
    port,
    baseUrl,
    health,
    logs: capture.read,
    stop: () => stopLaunchedProject({ child })
  };
}

function collectMatches(regex, text, mapper = match => match[1]) {
  const out = [];
  for (const match of text.matchAll(regex)) out.push(mapper(match));
  return [...new Set(out.filter(Boolean))];
}

export function extractHtmlSurface(html = '') {
  const safe = String(html || '');
  return {
    buttonIds: collectMatches(/<button[^>]*id=["']([^"']+)["'][^>]*>/gi, safe),
    buttons: collectMatches(/<button[^>]*>([^<]+)<\/button>/gi, safe, match => match[1].trim()),
    forms: collectMatches(/<form[^>]*action=["']([^"']+)["'][^>]*>/gi, safe),
    inputs: collectMatches(/<input[^>]*name=["']([^"']+)["'][^>]*>/gi, safe),
    links: collectMatches(/<a[^>]*href=["']([^"']+)["'][^>]*>/gi, safe),
    title: (safe.match(/<title>([^<]+)<\/title>/i) || [null, ''])[1] || ''
  };
}

async function fetchJsonOrText(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return {
    ok: response.ok,
    status: response.status,
    text,
    json,
    headers: Object.fromEntries(response.headers.entries())
  };
}

export async function probeProjectSurface(baseUrl, options = {}) {
  const routeSpecs = Array.isArray(options.routes) ? options.routes : [];
  const actionSpecs = Array.isArray(options.actions) ? options.actions : [];
  const routeResults = [];
  const actionResults = [];
  for (const spec of routeSpecs) {
    const result = await fetchJsonOrText(`${baseUrl}${spec.path}`);
    const surface = (result.headers['content-type'] || '').includes('text/html') ? extractHtmlSurface(result.text) : null;
    const expectedText = (spec.expectText || []).map(value => String(value));
    routeResults.push({
      path: spec.path,
      ok: result.ok,
      status: result.status,
      surface,
      bodyContains: expectedText.map(value => ({ value, pass: result.text.includes(value) })),
      textSample: result.text.slice(0, 300),
      json: result.json
    });
  }
  for (const spec of actionSpecs) {
    const response = await fetchJsonOrText(`${baseUrl}${spec.path}`, {
      method: spec.method || 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(spec.body || {})
    });
    const assertions = [];
    for (const [key, value] of Object.entries(spec.expectJson || {})) {
      assertions.push({ key, expected: value, actual: response.json?.[key], pass: response.json?.[key] === value });
    }
    actionResults.push({
      path: spec.path,
      method: spec.method || 'POST',
      ok: response.ok,
      status: response.status,
      json: response.json,
      assertions,
      text: response.text
    });
  }
  const controls = routeResults.reduce((acc, item) => {
    if (!item.surface) return acc;
    acc.buttonIds.push(...item.surface.buttonIds);
    acc.buttons.push(...item.surface.buttons);
    acc.forms.push(...item.surface.forms);
    acc.inputs.push(...item.surface.inputs);
    acc.links.push(...item.surface.links);
    return acc;
  }, { buttonIds: [], buttons: [], forms: [], inputs: [], links: [] });
  return {
    routeResults,
    actionResults,
    controls: {
      buttonIds: [...new Set(controls.buttonIds)],
      buttons: [...new Set(controls.buttons)],
      forms: [...new Set(controls.forms)],
      inputs: [...new Set(controls.inputs)],
      links: [...new Set(controls.links)]
    }
  };
}

export function renderDeepScanSurface(report, options = {}) {
  const title = options.title || `Deep Scan — ${report.targetLabel}`;
  const routeRows = (report.surface.routeResults || []).map(item => `
    <tr>
      <td>${item.path}</td>
      <td>${item.status}</td>
      <td>${item.ok ? 'PASS' : 'FAIL'}</td>
      <td>${item.surface ? item.surface.buttonIds.join(', ') : 'n/a'}</td>
    </tr>`).join('');
  const actionRows = (report.surface.actionResults || []).map(item => `
    <tr>
      <td>${item.method}</td>
      <td>${item.path}</td>
      <td>${item.ok ? 'PASS' : 'FAIL'}</td>
      <td>${(item.assertions || []).filter(row => row.pass).length}/${(item.assertions || []).length}</td>
    </tr>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
body{margin:0;background:#070910;color:#f5f7ff;font-family:Inter,Arial,sans-serif} main{max-width:1180px;margin:0 auto;padding:28px}
.card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);border-radius:22px;padding:18px 20px;margin-bottom:18px}
.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.metric{border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:12px 14px;background:rgba(255,255,255,.02)}
.metric .label{font-size:12px;color:#b9c3df;text-transform:uppercase;letter-spacing:.08em}.metric .value{font-size:22px;font-weight:800;margin-top:4px}
table{width:100%;border-collapse:collapse}th,td{padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.08);text-align:left}th{color:#7ee7ff;font-size:12px;text-transform:uppercase;letter-spacing:.08em}
code,pre{white-space:pre-wrap;word-break:break-word} pre{background:#0f1422;padding:12px;border-radius:14px}
</style>
</head>
<body>
<main>
  <section class="card">
    <h1>${title}</h1>
    <p>Running deployed-style deep scan with route probes, action tests, replay export, council arbitration, cost planning, and compliance posture.</p>
    <div class="grid">
      <div class="metric"><div class="label">Status</div><div class="value">${report.status}</div></div>
      <div class="metric"><div class="label">Preview URL</div><div class="value">${report.preview?.baseUrl || 'n/a'}</div></div>
      <div class="metric"><div class="label">Controls Found</div><div class="value">${(report.surface.controls.buttonIds || []).length + (report.surface.controls.forms || []).length}</div></div>
      <div class="metric"><div class="label">Replay Verified</div><div class="value">${report.replay?.verification?.ok ? 'YES' : 'NO'}</div></div>
      <div class="metric"><div class="label">Reader Docs</div><div class="value">${Number(report.reader?.summary?.documentCount || 0)}</div></div>
      <div class="metric"><div class="label">Reader Signals</div><div class="value">${Number(report.reader?.summary?.totalKeywordHits || 0)}</div></div>
      <div class="metric"><div class="label">Autonomy</div><div class="value">${report.autonomy?.decision?.effectiveModeId || 'n/a'}</div></div>
      <div class="metric"><div class="label">Mirror Services</div><div class="value">${Number(report.environmentMirror?.services?.length || 0)}</div></div>
      <div class="metric"><div class="label">Registered Platform</div><div class="value">${report.registeredPlatform ? report.registeredPlatform.slug : 'n/a'}</div></div>
    </div>
  </section>
  <section class="card">
    <h2>Environment mirror / gap report</h2>
    <pre>${JSON.stringify({ environment: report.environment, mirror: { services: report.environmentMirror?.services, envVars: report.environmentMirror?.envVars, gapReport: report.environmentMirror?.gapReport } }, null, 2)}</pre>
  </section>
  <section class="card">
    <h2>Route probes</h2>
    <table><thead><tr><th>Route</th><th>Status</th><th>Result</th><th>Controls</th></tr></thead><tbody>${routeRows}</tbody></table>
  </section>
  <section class="card">
    <h2>Action probes</h2>
    <table><thead><tr><th>Method</th><th>Path</th><th>Result</th><th>Assertions</th></tr></thead><tbody>${actionRows}</tbody></table>
  </section>
  <section class="card">
    <h2>Integrated Skye Reader dossier</h2>
    <pre>${JSON.stringify({ summary: report.reader?.summary, documents: (report.reader?.documents || []).map(item => ({ relativePath: item.relativePath, title: item.title, extractedCharacters: item.extractedCharacters })) }, null, 2)}</pre>
  </section>
  <section class="card">
    <h2>Council / compliance / cost / autonomy</h2>
    <pre>${JSON.stringify({ compliance: report.compliance?.decision, cost: report.costPlan?.status || report.costPlan?.reason, council: report.council?.run?.arbitration, autonomy: report.autonomy?.decision, autonomyRun: report.autonomy?.run }, null, 2)}</pre>
  </section>
</main>
</body>
</html>\n`;
}

export function writeDeepScanSurface(filePath, report, options = {}) {
  ensureDirectory(path.dirname(filePath));
  const html = renderDeepScanSurface(report, options);
  fs.writeFileSync(filePath, html, 'utf8');
  return { filePath, html };
}

export function stampDeepScanReport(report = {}) {
  const immutable = {
    scanId: report.scanId,
    targetLabel: report.targetLabel,
    generatedAt: report.generatedAt,
    projectFingerprint: report.projectFingerprint,
    launch: report.launch,
    environment: report.environment,
    environmentMirror: report.environmentMirror ? {
      services: report.environmentMirror.services || [],
      envVars: report.environmentMirror.envVars || [],
      gapReport: report.environmentMirror.gapReport || {},
      fingerprint: report.environmentMirror.fingerprint || null,
      artifactReferences: report.environmentMirror.artifactReferences || {}
    } : null,
    autonomy: report.autonomy ? {
      decision: report.autonomy.decision || null,
      run: report.autonomy.run ? {
        requestedModeId: report.autonomy.run.requestedModeId,
        stopReason: report.autonomy.run.stopReason,
        stateMutated: report.autonomy.run.stateMutated,
        pausedForApproval: report.autonomy.run.pausedForApproval,
        schedulerQueued: report.autonomy.run.schedulerQueued
      } : null
    } : null,
    compliance: report.compliance,
    costPlan: report.costPlan,
    councilDecision: report.council?.run?.arbitration,
    surface: {
      routeResults: (report.surface?.routeResults || []).map(item => ({
        path: item.path,
        status: item.status,
        ok: item.ok,
        bodyContains: item.bodyContains,
        json: item.json,
        surface: item.surface
      })),
      actionResults: (report.surface?.actionResults || []).map(item => ({
        path: item.path,
        method: item.method,
        status: item.status,
        ok: item.ok,
        assertions: item.assertions,
        json: item.json
      })),
      controls: report.surface?.controls || {}
    },
    replay: {
      verification: report.replay?.verification || null,
      replayDigest: report.replay?.bundle?.eventDigest || null,
      checkpointDigest: report.replay?.bundle?.checkpointDigest || null
    },
    reader: {
      integrated: report.reader?.integrated || false,
      ok: report.reader?.ok || false,
      summary: report.reader?.summary || {},
      documents: (report.reader?.documents || []).map(item => ({
        relativePath: item.relativePath,
        title: item.title,
        extractedCharacters: item.extractedCharacters
      })),
      failures: (report.reader?.failures || []).map(item => ({
        relativePath: item.relativePath,
        error: item.error || item.reason || null
      })),
      readerPaths: report.reader?.readerPaths || {}
    },
    registeredPlatform: report.registeredPlatform || null,
    valuationReady: report.valuationReady,
    artifactReferences: report.artifactReferences || {}
  };
  return {
    ...report,
    fingerprint: stableHash(immutable)
  };
}

export function verifyDeepScanReport(report = {}) {
  const stamped = stampDeepScanReport({ ...report, fingerprint: undefined });
  return {
    ok: report.fingerprint === stamped.fingerprint,
    expectedFingerprint: stamped.fingerprint,
    actualFingerprint: report.fingerprint || null
  };
}

export async function runDeepScan(config, request = {}) {
  const scanId = String(request.scanId || `deep-scan-${crypto.randomUUID()}`);
  const targetLabel = String(request.targetLabel || path.basename(String(request.inputPath || 'project')) || 'project');
  const outputDir = path.resolve(request.outputDir || path.join(config.rootDir, 'dist', 'section59', scanId));
  fs.rmSync(outputDir, { recursive: true, force: true });
  ensureDirectory(outputDir);

  const ingest = ingestProjectInput(config, request.inputPath, { scanId });
  const projectRoot = ingest.projectRoot;
  const projectFiles = listRelativeFiles(projectRoot);
  const projectFingerprint = stableHash(projectFiles.map(file => ({ file, sha256: sha256File(path.join(projectRoot, file)) })));
  const registeredPlatform = summarizeRegisteredPlatformByPath(config, projectRoot);
  const strategy = detectLaunchStrategy(projectRoot);
  const providers = Array.isArray(request.providerFixtures) ? request.providerFixtures : [];
  const complianceMode = String(request.complianceMode || 'education');
  const complianceTask = {
    taskId: `${scanId}-compliance`,
    action: 'scan',
    capability: request.capability || 'scan',
    requiresEgress: Boolean(request.requiresEgress),
    summary: `Deep scan target ${targetLabel}`
  };
  const compliance = evaluateComplianceMode(config, complianceMode, complianceTask, providers);
  const costGraph = buildCostProviderGraph(providers);
  const costTask = {
    capability: request.capability || 'scan',
    usageForecast: request.usageForecast || {
      tokens: 2800,
      computeMinutes: 2,
      buildMinutes: 1,
      deployCount: 1,
      storageGbHours: 0.2,
      rollbackRiskUnits: 0.2
    }
  };
  const costPlan = planBudgetAwareRun(costGraph, costTask, request.budgetPolicy || {
    mode: 'cheapest_acceptable',
    budgetCap: 5,
    approvalCap: 12,
    trustFloor: 'standard',
    maxCostPerUnit: 1,
    requireHealthy: true,
    requireSecrets: true
  });
  const councilTask = {
    taskId: `${scanId}-council`,
    summary: `Deep scan target ${targetLabel}`,
    objective: `Reconstruct runtime, launch, probe, and prove end-to-end behavior for ${targetLabel}`,
    filesInScope: projectFiles.slice(0, 24)
  };
  const council = orchestrateCouncilRun(config, councilTask, { runId: scanId });
  const autonomyDecision = evaluateAutonomyMode(config, request.autonomyMode || 'full-autonomous', {
    taskId: `${scanId}-autonomy`,
    summary: `Deep scan target ${targetLabel}`,
    complianceMode
  }, {
    workspaceId: 'deep-scan',
    repoPath: projectRoot,
    userId: request.userId || 'system-deep-scan',
    policyTier: request.policyTier || 'open',
    complianceMode
  });
  const autonomyRun = simulateAutonomyRun(config, request.autonomyMode || 'full-autonomous', {
    taskId: `${scanId}-autonomy`,
    summary: `Deep scan launch and verification for ${targetLabel}`,
    filesInScope: projectFiles.slice(0, 12),
    executionCommand: strategy.label,
    complianceMode
  }, {
    runId: `${scanId}-autonomy-run`,
    approvalGranted: request.autonomyApprovalGranted !== false,
    context: {
      workspaceId: 'deep-scan',
      repoPath: projectRoot,
      userId: request.userId || 'system-deep-scan',
      policyTier: request.policyTier || 'open',
      complianceMode
    }
  });
  const environmentMirror = await reconstructEnvironmentMirror(config, {
    runId: `${scanId}-mirror`,
    inputPath: projectRoot,
    targetLabel,
    outputDir: path.join(outputDir, 'environment-mirror'),
    detectedPort: request.port || 4310,
    readerPort: Number((request.readerPort || 4390) + 1),
    readerFileLimit: Number(request.readerFileLimit || 8)
  });

  const replay = createReplaySession({
    runId: scanId,
    workspaceId: 'deep-scan',
    tenantId: 'local',
    model: 'kAIxU-Prime6.7',
    policyMode: complianceMode,
    budgetMode: (request.budgetPolicy || {}).mode || 'cheapest_acceptable',
    initialFiles: {
      'scan-input.json': JSON.stringify({
        inputType: ingest.inputType,
        targetLabel,
        strategy: strategy.kind,
        projectFileCount: projectFiles.length
      }, null, 2)
    }
  });
  appendReplayEvent(replay, 'planning', { summary: `Deep scan planned for ${targetLabel}.` });
  appendReplayEvent(replay, 'file-read', { filePath: 'scan-input.json' });
  createReplayCheckpoint(replay, 'scan-plan', { targetLabel, strategy: strategy.kind });

  ingestMemoryEvent(config, 'agent-planning', {
    workspaceId: 'deep-scan',
    taskKey: scanId,
    taskLabel: targetLabel,
    summary: `Planned deep scan for ${targetLabel}`,
    repoPath: projectRoot,
    files: projectFiles.slice(0, 16),
    runId: scanId,
    eventId: `${scanId}-plan`
  }, { at: new Date().toISOString() });

  if (!strategy.ok) {
    appendReplayEvent(replay, 'policy-denial', { message: 'Deep scan denied: no supported launch strategy.' });
    createReplayCheckpoint(replay, 'launch-denied', { reason: 'no_launch_strategy' });
    const replayInfo = exportReplayBundle(replay, path.join(outputDir, 'replay'));
    const replayExport = createReplayExportBundle(config.rootDir, replayInfo, path.join(outputDir, 'replay-export'));
    let report = {
      scanId,
      generatedAt: new Date().toISOString(),
      status: 'denied',
      targetLabel,
      registeredPlatform,
      valuationReady: false,
      projectFingerprint,
      launch: { ok: false, reason: 'no_launch_strategy', strategy: strategy.kind },
      environment: { ...strategy.gapReport, mirrorHonesty: environmentMirror.gapReport?.honesty || null },
      environmentMirror,
      autonomy: { decision: autonomyDecision, run: autonomyRun },
      compliance: { decision: compliance },
      costPlan,
      council,
      foundrySignals: { foundryReady: false, brandingAssetCount: 0, configSignals: [], domainSignalCount: 0 },
      maintenanceSignals: { maintenanceCandidateCount: 0, candidateTypes: [], unattendedWorthwhile: false },
      commercialSignals: { inferredKind: 'unknown', proprietarySignals: 0, whiteLabelSignals: 0 },
      devGlowSignals: { devGlowReady: false, surfaceCount: 0, surfaces: [] },
      reader: { integrated: false, ok: false, summary: { documentCount: 0, extractedCharacters: 0, totalKeywordHits: 0 }, documents: [], failures: [] },
      surface: { routeResults: [], actionResults: [], controls: { buttonIds: [], buttons: [], forms: [], inputs: [], links: [] } },
      replay: { ...replayInfo, verification: verifyReplayBundle(replayInfo.bundleFile), replayExport },
      artifactReferences: {
        replayBundleFile: normalizePath(path.relative(config.rootDir, replayInfo.bundleFile))
      }
    };
    report = stampDeepScanReport(report);
    const saved = saveDeepScanRecord(config, report);
    report.artifactReferences.recordFile = normalizePath(path.relative(config.rootDir, saved.recordFile));
    report = stampDeepScanReport(report);
    writeJson(saved.recordFile, report);
    return report;
  }

  const launch = await launchProjectPreview(projectRoot, strategy, {
    port: request.port || 4310,
    healthPath: request.healthPath || '/health',
    timeoutMs: request.timeoutMs || 12000
  });
  appendReplayEvent(replay, 'command-start', { message: `Launch strategy ${strategy.label} on ${launch.baseUrl}` });
  createReplayCheckpoint(replay, 'launched', { baseUrl: launch.baseUrl, strategy: strategy.label });

  let surface;
  let launchLogs = launch.logs();
  try {
    surface = await probeProjectSurface(launch.baseUrl, {
      routes: request.routes || [{ path: '/', expectText: [targetLabel] }],
      actions: request.actions || []
    });
    appendReplayEvent(replay, 'command-exit', { message: 'Route probes and action checks completed.' });
    createReplayCheckpoint(replay, 'probed', {
      routes: surface.routeResults.map(item => ({ path: item.path, status: item.status })),
      actions: surface.actionResults.map(item => ({ path: item.path, status: item.status }))
    });
  } finally {
    await launch.stop();
    launchLogs = launch.logs();
  }

  ingestMemoryEvent(config, 'command-execution', {
    workspaceId: 'deep-scan',
    taskKey: scanId,
    taskLabel: targetLabel,
    summary: `Executed deep scan launch and route probes for ${targetLabel}`,
    repoPath: projectRoot,
    files: projectFiles.slice(0, 16),
    runId: scanId,
    eventId: `${scanId}-probe`
  }, { at: new Date().toISOString() });

  const explanation = explainMemoryBackedDecision(config, {
    failureQuery: { summary: 'deep scan launch' },
    correctionQuery: { summary: 'deep scan' },
    dependencyQuery: { repoPath: projectRoot }
  });

  const foundrySignals = summarizeFoundrySignals(projectRoot);
  const maintenanceSignals = summarizeMaintenanceSignals(projectRoot);
  const commercialSignals = inferCommercialSignals(projectRoot);
  const devGlowSignals = buildDevGlowProjectSignals(projectRoot);

  const reader = await buildProjectReaderDossier(config, projectRoot, {
    runId: scanId,
    port: Number(request.readerPort || 4390),
    limit: Number(request.readerFileLimit || 8),
    dataDir: path.join(config.rootDir, '.skyequanta', 'skye-reader-bridge', scanId)
  });
  appendReplayEvent(replay, 'file-read', {
    message: `Integrated Skye Reader dossier imported ${reader.summary?.documentCount || 0} project documents.`
  });
  createReplayCheckpoint(replay, 'reader-dossier', {
    documentCount: reader.summary?.documentCount || 0,
    keywordHits: reader.summary?.totalKeywordHits || 0
  });

  const replayInfo = exportReplayBundle(replay, path.join(outputDir, 'replay'));
  const replayExport = createReplayExportBundle(config.rootDir, replayInfo, path.join(outputDir, 'replay-export'));
  const replayVerification = verifyReplayBundle(replayInfo.bundleFile);
  const environment = {
    ...strategy.gapReport,
    descriptors: strategy.metadata.descriptors,
    projectRoot: normalizePath(path.relative(config.rootDir, projectRoot)),
    ingestType: ingest.inputType,
    projectFileCount: projectFiles.length,
    dependenciesPresent: strategy.dependencies.length,
    nodeModulesPresent: strategy.nodeModulesPresent,
    memoryBackedExplanation: explanation,
    readerIntegrated: Boolean(reader.integrated),
    readerDocumentCount: Number(reader.summary?.documentCount || 0),
    readerKeywordHits: Number(reader.summary?.totalKeywordHits || 0),
    mirrorHonesty: environmentMirror.gapReport?.honesty || null,
    mirrorServiceCount: Number(environmentMirror.services?.length || 0),
    mirrorEnvVarCount: Number(environmentMirror.envVars?.length || 0),
    foundrySignals,
    maintenanceSignals,
    commercialSignals,
    devGlowSignals
  };
  let report = {
    scanId,
    generatedAt: new Date().toISOString(),
    status: launch.ok ? 'scanned' : 'launch_failed',
    targetLabel,
    registeredPlatform,
    valuationReady: launch.ok && replayVerification.ok && surface.actionResults.every(item => item.ok && item.assertions.every(row => row.pass)),
    projectFingerprint,
    launch: {
      ok: launch.ok,
      strategy: strategy.kind,
      strategyLabel: strategy.label,
      logs: launchLogs,
      health: launch.health
    },
    preview: {
      baseUrl: launch.baseUrl,
      healthPath: request.healthPath || '/health'
    },
    environment,
    environmentMirror,
    autonomy: { decision: autonomyDecision, run: autonomyRun },
    compliance: { decision: compliance },
    costPlan,
    council,
    foundrySignals,
    maintenanceSignals,
    commercialSignals,
    devGlowSignals,
    reader,
    surface,
    replay: {
      ...replayInfo,
      verification: replayVerification,
      replayExport
    },
    artifactReferences: {
      projectRoot: normalizePath(path.relative(config.rootDir, projectRoot)),
      replayBundleFile: normalizePath(path.relative(config.rootDir, replayInfo.bundleFile)),
      replayTimelineFile: normalizePath(path.relative(config.rootDir, replayInfo.timelineFile)),
      replayExportFile: normalizePath(path.relative(config.rootDir, replayExport.exportFile))
    }
  };
  const surfaceFile = path.join(outputDir, 'deep-scan-surface.html');
  const costSurfaceFile = path.join(outputDir, 'deep-scan-cost-surface.html');
  const reportFile = path.join(outputDir, 'deep-scan-report.json');
  const readerArtifacts = writeReaderDossierArtifacts(config, outputDir, reader, { title: `Deep Scan Reader Dossier — ${targetLabel}` });
  report.artifactReferences.surfaceFile = normalizePath(path.relative(config.rootDir, surfaceFile));
  report.artifactReferences.costSurfaceFile = normalizePath(path.relative(config.rootDir, costSurfaceFile));
  report.artifactReferences.reportFile = normalizePath(path.relative(config.rootDir, reportFile));
  report.artifactReferences.readerDossierFile = normalizePath(path.relative(config.rootDir, readerArtifacts.dossierFile));
  report.artifactReferences.readerSurfaceFile = normalizePath(path.relative(config.rootDir, readerArtifacts.surfaceFile));
  if (environmentMirror?.artifactReferences) {
    report.artifactReferences.environmentMirrorFile = environmentMirror.artifactReferences.mirrorFile || null;
    report.artifactReferences.environmentTemplateFile = environmentMirror.artifactReferences.templateFile || null;
    report.artifactReferences.environmentMirrorSurfaceFile = environmentMirror.artifactReferences.surfaceFile || null;
  }
  report = stampDeepScanReport(report);
  writeDeepScanSurface(surfaceFile, report, { title: `Deep Scan Surface — ${targetLabel}` });
  writeCostExplanationSurface(costSurfaceFile, costPlan, { title: `Deep Scan Cost Surface — ${targetLabel}` });
  writeJson(reportFile, report);
  const saved = saveDeepScanRecord(config, report);
  report.artifactReferences.recordFile = normalizePath(path.relative(config.rootDir, saved.recordFile));
  report = stampDeepScanReport(report);
  writeJson(reportFile, report);
  writeJson(saved.recordFile, report);
  return report;
}
