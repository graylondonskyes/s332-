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

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function getDevGlowPaths(config) {
  const runtimePaths = getRuntimePaths(config);
  const baseDir = path.join(runtimePaths.runtimeDir, 'devglow');
  return {
    baseDir,
    registryFile: path.join(baseDir, 'registry.json'),
    eventsFile: path.join(baseDir, 'events.ndjson'),
    bugLogFile: path.join(baseDir, 'bug-log.json'),
    clipboardFile: path.join(baseDir, 'clipboard.txt')
  };
}

export function ensureDevGlowStore(config) {
  const paths = getDevGlowPaths(config);
  ensureDirectory(paths.baseDir);
  if (!fs.existsSync(paths.registryFile)) writeJson(paths.registryFile, { version: 1, surfaces: [] });
  if (!fs.existsSync(paths.eventsFile)) writeText(paths.eventsFile, '');
  if (!fs.existsSync(paths.bugLogFile)) writeJson(paths.bugLogFile, { version: 1, entries: [] });
  if (!fs.existsSync(paths.clipboardFile)) writeText(paths.clipboardFile, '');
  return paths;
}

export function resetDevGlowStore(config) {
  const paths = getDevGlowPaths(config);
  fs.rmSync(paths.baseDir, { recursive: true, force: true });
  return ensureDevGlowStore(config);
}

function appendEvent(config, event) {
  const paths = ensureDevGlowStore(config);
  const line = { at: new Date().toISOString(), ...event };
  line.eventHash = stableHash(line);
  fs.appendFileSync(paths.eventsFile, `${JSON.stringify(line)}\n`, 'utf8');
  return line;
}

export function verifyDevGlowEvents(config) {
  const paths = ensureDevGlowStore(config);
  const lines = fs.readFileSync(paths.eventsFile, 'utf8').split(/\r?\n/).filter(Boolean);
  const parsed = [];
  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      const { eventHash, ...unsigned } = event;
      if (stableHash(unsigned) !== eventHash) {
        return { ok: false, reason: 'event_hash_mismatch', event };
      }
      parsed.push(event);
    } catch (error) {
      return { ok: false, reason: 'event_parse_failed', detail: String(error.message || error) };
    }
  }
  return { ok: true, eventCount: parsed.length, events: parsed };
}

export function getKeyboardCommandsRegistry() {
  return [
    { id: 'devglow.open', binding: 'Ctrl+Shift+G', description: 'Open DevGlow overlay for the active surface' },
    { id: 'devglow.copyPath', binding: 'Ctrl+Shift+C', description: 'Copy resolved backing file path' },
    { id: 'devglow.bugLog', binding: 'Ctrl+Shift+B', description: 'Append the active path to the persistent bug log' }
  ];
}

export function getTerminalCommandsRegistry() {
  return [
    { id: 'proof.section58', command: 'npm run workspace:proof:section58' },
    { id: 'smoke.section58', command: 'bash scripts/smoke-section58-devglow.sh' },
    { id: 'proof.section59', command: 'npm run workspace:proof:section59' },
    { id: 'proof.section60', command: 'npm run workspace:proof:section60' },
    { id: 'recovery.reader', command: 'node apps/skye-reader-hardened/server.js' }
  ];
}

export function registerDevGlowSurfaces(config, surfaces = []) {
  const paths = ensureDevGlowStore(config);
  const registry = { version: 1, surfaces: surfaces.map(surface => ({
    surfaceId: surface.surfaceId,
    route: surface.route,
    panel: surface.panel || null,
    runtimeType: surface.runtimeType || 'local',
    sourceFile: normalizePath(surface.sourceFile),
    restricted: Boolean(surface.restricted),
    explanationSource: surface.explanationSource || 'route-registry',
    fileHash: surface.sourceFile && fs.existsSync(surface.sourceFile) ? sha256File(surface.sourceFile) : null
  })) };
  writeJson(paths.registryFile, registry);
  appendEvent(config, { type: 'registry-written', surfaceCount: registry.surfaces.length });
  return registry;
}

export function resolveDevGlowPath(config, request = {}) {
  const paths = ensureDevGlowStore(config);
  const registry = readJson(paths.registryFile, { surfaces: [] });
  const matches = (registry.surfaces || []).filter(surface => surface.route === request.route && (request.panel ? surface.panel === request.panel : true));
  if (matches.length === 0) {
    const denied = { ok: false, reason: 'surface_not_found', route: request.route, panel: request.panel || null };
    appendEvent(config, { type: 'resolve-denied', ...denied });
    return denied;
  }
  if (matches.length > 1) {
    const denied = { ok: false, reason: 'ambiguous_surface', route: request.route, panel: request.panel || null, candidates: matches.map(item => item.sourceFile) };
    appendEvent(config, { type: 'resolve-denied', ...denied });
    return denied;
  }
  const match = matches[0];
  if (match.restricted && request.allowRestricted !== true) {
    const denied = { ok: false, reason: 'restricted_surface', route: request.route, redactedPath: '[REDACTED]' };
    appendEvent(config, { type: 'resolve-denied', ...denied });
    return denied;
  }
  const absolutePath = path.isAbsolute(match.sourceFile) ? match.sourceFile : path.join(config.rootDir, match.sourceFile);
  if (!fs.existsSync(absolutePath)) {
    const denied = { ok: false, reason: 'resolved_file_missing', route: request.route, sourceFile: match.sourceFile };
    appendEvent(config, { type: 'resolve-denied', ...denied });
    return denied;
  }
  const currentHash = sha256File(absolutePath);
  if (match.fileHash && match.fileHash !== currentHash) {
    const denied = { ok: false, reason: 'stale_route_metadata', route: request.route, expectedHash: match.fileHash, actualHash: currentHash };
    appendEvent(config, { type: 'resolve-denied', ...denied });
    return denied;
  }
  const resolved = {
    ok: true,
    route: request.route,
    panel: request.panel || null,
    sourceFile: normalizePath(path.relative(config.rootDir, absolutePath)),
    runtimeType: match.runtimeType,
    explanation: `Resolved from ${match.explanationSource} registry for ${match.route}`
  };
  appendEvent(config, { type: 'resolve-ok', route: request.route, sourceFile: resolved.sourceFile, runtimeType: resolved.runtimeType });
  return resolved;
}

export function copyDevGlowPath(config, resolution) {
  const paths = ensureDevGlowStore(config);
  if (!resolution?.ok) return { ok: false, reason: 'resolution_required' };
  writeText(paths.clipboardFile, `${resolution.sourceFile}\n`);
  appendEvent(config, { type: 'clipboard-copy', sourceFile: resolution.sourceFile });
  return { ok: true, clipboardFile: paths.clipboardFile, value: fs.readFileSync(paths.clipboardFile, 'utf8').trim() };
}

export function appendDevGlowBugLog(config, request = {}) {
  const paths = ensureDevGlowStore(config);
  const bugLog = readJson(paths.bugLogFile, { version: 1, entries: [] });
  const entry = {
    entryId: request.entryId || stableHash({ path: request.path, notes: request.notes }),
    path: request.path,
    notes: request.notes || '',
    createdAt: new Date().toISOString()
  };
  const exists = (bugLog.entries || []).some(item => item.entryId === entry.entryId);
  if (!exists) {
    bugLog.entries = [...(bugLog.entries || []), entry];
    writeJson(paths.bugLogFile, bugLog);
    appendEvent(config, { type: 'bug-log-write', entryId: entry.entryId, path: entry.path });
    return { ok: true, duplicate: false, entry, bugLogFile: paths.bugLogFile };
  }
  appendEvent(config, { type: 'bug-log-duplicate', entryId: entry.entryId, path: entry.path });
  return { ok: true, duplicate: true, entry, bugLogFile: paths.bugLogFile };
}

export function renderDevGlowOverlay(resolution) {
  const keyboard = getKeyboardCommandsRegistry().map(item => `<tr><td>${item.id}</td><td>${item.binding}</td><td>${item.description}</td></tr>`).join('');
  const terminal = getTerminalCommandsRegistry().map(item => `<tr><td>${item.id}</td><td><code>${item.command}</code></td></tr>`).join('');
  const source = resolution?.ok ? resolution.sourceFile : '[UNRESOLVED]';
  const explanation = resolution?.ok ? resolution.explanation : resolution?.reason || 'resolution failed';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>DevGlow Overlay</title><style>body{font-family:Inter,Arial,sans-serif;background:#020617;color:#e2e8f0;padding:20px}.tabs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:18px}.tab{padding:10px 12px;border-radius:12px;background:#111827}.panel{margin-bottom:18px;padding:16px;border-radius:16px;background:#0f172a;border:1px solid rgba(255,255,255,.12)}table{width:100%;border-collapse:collapse}td,th{border:1px solid rgba(255,255,255,.12);padding:8px}th{background:#111827}</style></head><body><h1>DevGlow Overlay</h1><div class="tabs"><div class="tab">Path</div><div class="tab">Keyboard Commands</div><div class="tab">Terminal Commands</div></div><div class="panel"><h2>Resolved path</h2><p><code>${source}</code></p><p>${explanation}</p></div><div class="panel"><h2>Keyboard Commands</h2><table><thead><tr><th>ID</th><th>Binding</th><th>Description</th></tr></thead><tbody>${keyboard}</tbody></table></div><div class="panel"><h2>Terminal Commands</h2><table><thead><tr><th>ID</th><th>Command</th></tr></thead><tbody>${terminal}</tbody></table></div></body></html>`;
}

export function buildDevGlowProjectSignals(projectRoot) {
  const signals = [];
  const candidates = ['index.html', 'server.js', 'server.mjs', 'README.md'];
  for (const relative of candidates) {
    const absolute = path.join(projectRoot, relative);
    if (fs.existsSync(absolute)) {
      signals.push({ route: relative === 'index.html' ? '/' : `/${relative.replace(/\.(m?js|md)$/,'')}`, sourceFile: normalizePath(relative) });
    }
  }
  return {
    devGlowReady: signals.length > 0,
    surfaceCount: signals.length,
    surfaces: signals
  };
}
