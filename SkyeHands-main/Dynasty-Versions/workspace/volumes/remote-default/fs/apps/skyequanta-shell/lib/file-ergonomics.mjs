import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { getWorkspace } from './workspace-manager.mjs';
import { getWorkspaceSandboxPaths, getWorkspaceRuntimeState } from './workspace-runtime.mjs';
import { getWorkspaceRuntimeProjection, listRuntimeEvents } from './runtime-bus.mjs';

const TEXT_EXTENSIONS = new Set([
  '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.md', '.txt', '.html', '.css', '.scss', '.less', '.xml',
  '.yaml', '.yml', '.toml', '.env', '.py', '.sh', '.bash', '.zsh', '.go', '.rs', '.java', '.kt', '.swift', '.php', '.rb', '.sql', '.csv',
  '.svg', '.ini', '.conf', '.log'
]);

const ASSOCIATION_RULES = [
  { exts: ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx'], editor: 'code', preview: 'text', category: 'source', label: 'Code', icon: '💻', mime: 'text/javascript', language: 'javascript', fallback: 'Open in code editor' },
  { exts: ['.py'], editor: 'code', preview: 'text', category: 'source', label: 'Python', icon: '🐍', mime: 'text/x-python', language: 'python', fallback: 'Open in code editor' },
  { exts: ['.go'], editor: 'code', preview: 'text', category: 'source', label: 'Go', icon: '⚙️', mime: 'text/x-go', language: 'go', fallback: 'Open in code editor' },
  { exts: ['.rs'], editor: 'code', preview: 'text', category: 'source', label: 'Rust', icon: '🦀', mime: 'text/x-rust', language: 'rust', fallback: 'Open in code editor' },
  { exts: ['.java', '.kt', '.swift', '.php', '.rb'], editor: 'code', preview: 'text', category: 'source', label: 'Source', icon: '💻', mime: 'text/plain', language: 'source', fallback: 'Open in code editor' },
  { exts: ['.json'], editor: 'text', preview: 'json', category: 'config', label: 'JSON', icon: '🧩', mime: 'application/json', language: 'json', fallback: 'Show JSON preview' },
  { exts: ['.yaml', '.yml', '.toml', '.ini', '.conf'], editor: 'text', preview: 'text', category: 'config', label: 'Config', icon: '🛠️', mime: 'text/plain', language: 'config', fallback: 'Show config preview' },
  { exts: ['.env'], editor: 'text', preview: 'text', category: 'secret-config', label: 'Environment', icon: '🔐', mime: 'text/plain', language: 'dotenv', fallback: 'Show redacted text preview' },
  { exts: ['.md'], editor: 'text', preview: 'markdown', category: 'docs', label: 'Markdown', icon: '📝', mime: 'text/markdown', language: 'markdown', fallback: 'Show markdown preview' },
  { exts: ['.txt', '.log'], editor: 'text', preview: 'text', category: 'docs', label: 'Text', icon: '📄', mime: 'text/plain', language: 'text', fallback: 'Show text preview' },
  { exts: ['.html'], editor: 'code', preview: 'web', category: 'web', label: 'HTML', icon: '🌐', mime: 'text/html', language: 'html', fallback: 'Render as web preview or source' },
  { exts: ['.css', '.scss', '.less'], editor: 'code', preview: 'web', category: 'web', label: 'Stylesheet', icon: '🎨', mime: 'text/css', language: 'css', fallback: 'Open in code editor' },
  { exts: ['.xml', '.svg'], editor: 'text', preview: 'text', category: 'markup', label: 'Markup', icon: '🧱', mime: 'text/xml', language: 'xml', fallback: 'Show text preview' },
  { exts: ['.csv'], editor: 'text', preview: 'table', category: 'data', label: 'CSV', icon: '📊', mime: 'text/csv', language: 'csv', fallback: 'Show table preview' },
  { exts: ['.sh', '.bash', '.zsh'], editor: 'code', preview: 'text', category: 'script', label: 'Shell Script', icon: '🖥️', mime: 'text/x-shellscript', language: 'shell', fallback: 'Open in code editor' }
];

function workspaceRoot(config, workspaceId) {
  const workspace = getWorkspace(config, workspaceId);
  if (!workspace) {
    throw new Error(`Workspace '${workspaceId}' is not registered.`);
  }
  const paths = getWorkspaceSandboxPaths(config, workspace.id);
  const projectDir = path.join(paths.fsDir, 'project');
  return fs.existsSync(projectDir) && fs.statSync(projectDir).isDirectory() ? projectDir : paths.fsDir;
}

function readInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return parsed;
}

function getWorkspaceSecurityPolicy() {
  return {
    maxReadBytes: readInteger(process.env.SKYEQUANTA_WORKSPACE_MAX_READ_BYTES, 2 * 1024 * 1024),
    maxSearchFileBytes: readInteger(process.env.SKYEQUANTA_WORKSPACE_MAX_SEARCH_FILE_BYTES, 512 * 1024),
    maxScanFiles: readInteger(process.env.SKYEQUANTA_WORKSPACE_MAX_SCAN_FILES, 500)
  };
}

function isWithinRoot(rootDir, candidatePath) {
  const resolvedRoot = path.resolve(rootDir);
  const resolvedCandidate = path.resolve(candidatePath);
  return resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`);
}

function safeResolve(rootDir, rel = '') {
  const normalized = String(rel || '').trim().replace(/^\/+/, '');
  const target = path.resolve(rootDir, normalized || '.');
  const resolvedRoot = path.resolve(rootDir);
  if (!isWithinRoot(resolvedRoot, target)) {
    throw new Error(`Requested path escapes workspace root: ${rel}`);
  }
  if (fs.existsSync(target)) {
    const realRoot = fs.realpathSync(resolvedRoot);
    const realTarget = fs.realpathSync(target);
    if (!isWithinRoot(realRoot, realTarget)) {
      throw new Error(`Requested path escapes workspace root through a symlink: ${rel}`);
    }
  } else {
    const parentReal = fs.realpathSync(path.dirname(target));
    const realRoot = fs.realpathSync(resolvedRoot);
    if (!isWithinRoot(realRoot, parentReal)) {
      throw new Error(`Requested path escapes workspace root through a symlink: ${rel}`);
    }
  }
  return { target, relative: normalized || '.' };
}

function isTextPath(filePath) {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function inferAssociation(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const rule = ASSOCIATION_RULES.find(item => item.exts.includes(ext));
  if (rule) {
    return { ...rule, extension: ext || null };
  }
  const textPath = isTextPath(filePath);
  return {
    editor: textPath ? 'text' : 'download',
    preview: textPath ? 'text' : 'binary',
    category: textPath ? 'text' : 'binary',
    label: textPath ? 'Text' : 'Binary',
    icon: textPath ? '📄' : '📦',
    mime: textPath ? 'text/plain' : 'application/octet-stream',
    language: textPath ? 'text' : 'binary',
    fallback: textPath ? 'Show text preview' : 'Download or inspect metadata only',
    extension: ext || null
  };
}

function summarizeAssociationEntries(items = []) {
  const summary = { total: 0, byCategory: {}, byPreview: {} };
  for (const item of items) {
    if (!item || item.type !== 'file' || !item.association) continue;
    summary.total += 1;
    summary.byCategory[item.association.category] = (summary.byCategory[item.association.category] || 0) + 1;
    summary.byPreview[item.association.preview] = (summary.byPreview[item.association.preview] || 0) + 1;
  }
  return summary;
}

function summarizeStat(rel, stat, extra = {}) {
  return {
    path: rel,
    name: path.basename(rel === '.' ? '' : rel) || '.',
    type: stat.isDirectory() ? 'directory' : 'file',
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    createdAt: stat.birthtime.toISOString(),
    ...extra
  };
}

function readDirTree(baseDir, rel = '.', depth = 2, maxEntries = 200) {
  const { target, relative } = safeResolve(baseDir, rel);
  const stat = fs.statSync(target);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${relative}`);
  }
  let count = 0;
  function walk(dirPath, relPath, level) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      .filter((entry) => entry.name !== '.git')
      .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
    const children = [];
    for (const entry of entries) {
      if (count >= maxEntries) {
        break;
      }
      const childPath = path.join(dirPath, entry.name);
      const childRel = relPath === '.' ? entry.name : path.join(relPath, entry.name);
      const childLstat = fs.lstatSync(childPath);
      count += 1;
      if (childLstat.isSymbolicLink()) {
        children.push({
          path: childRel,
          name: entry.name,
          type: 'symlink',
          blocked: true,
          modifiedAt: childLstat.mtime.toISOString(),
          createdAt: childLstat.birthtime.toISOString(),
          size: childLstat.size,
          reason: 'Symlink traversal is blocked by workspace hardening.'
        });
        continue;
      }
      const childStat = fs.statSync(childPath);
      const summary = summarizeStat(childRel, childStat, {
        association: entry.isDirectory() ? null : inferAssociation(childPath)
      });
      if (entry.isDirectory() && level < depth) {
        summary.children = walk(childPath, childRel, level + 1);
      }
      children.push(summary);
    }
    return children;
  }
  const items = walk(target, relative, 0);
  return { root: relative, items, truncated: count >= maxEntries, count, associations: summarizeAssociationEntries(collectTreeItems(items)) };
}

function collectTreeItems(items = [], bucket = []) {
  for (const item of items) {
    bucket.push(item);
    if (Array.isArray(item.children) && item.children.length) {
      collectTreeItems(item.children, bucket);
    }
  }
  return bucket;
}

function buildTextPreview(text, maxChars = 12000) {
  const normalized = String(text || '');
  return normalized.length > maxChars ? `${normalized.slice(0, maxChars)}\n\n...[truncated]` : normalized;
}

export function listWorkspaceTree(config, workspaceId, options = {}) {
  const baseDir = workspaceRoot(config, workspaceId);
  return readDirTree(
    baseDir,
    options.path || '.',
    Number.parseInt(String(options.depth || 2), 10) || 2,
    Number.parseInt(String(options.limit || 200), 10) || 200
  );
}

export function inspectWorkspacePath(config, workspaceId, rel = '.') {
  const baseDir = workspaceRoot(config, workspaceId);
  const { target, relative } = safeResolve(baseDir, rel);
  if (!fs.existsSync(target)) {
    throw new Error(`Path does not exist: ${relative}`);
  }
  const lstat = fs.lstatSync(target);
  if (lstat.isSymbolicLink()) {
    throw new Error(`Symlink access is blocked by workspace hardening: ${relative}`);
  }
  const stat = fs.statSync(target);
  const association = stat.isFile() ? inferAssociation(target) : null;
  return {
    ...summarizeStat(relative, stat, { association }),
    absolutePath: target,
    previewable: Boolean(association && association.preview !== 'binary'),
    downloadOnly: Boolean(association && association.preview === 'binary'),
    previewKind: association?.preview || 'binary',
    editorHint: association?.editor || 'download',
    fallbackHint: association?.fallback || null
  };
}

function buildStructuredPreview(filePath, association, text) {
  if (association?.preview === 'json') {
    try {
      return { kind: 'json', parsed: JSON.parse(text), snippet: buildTextPreview(text, 4000) };
    } catch {
      return { kind: 'json', parsed: null, snippet: buildTextPreview(text, 4000), warning: 'JSON parse failed; showing raw text.' };
    }
  }
  if (association?.preview === 'markdown') {
    const headings = String(text || '').split(/\r?\n/).filter(line => /^#{1,6}\s/.test(line)).slice(0, 10);
    return { kind: 'markdown', headings, snippet: buildTextPreview(text, 4000) };
  }
  if (association?.preview === 'table') {
    const lines = String(text || '').split(/\r?\n/).filter(Boolean);
    const rows = lines.slice(0, 12).map(line => line.split(','));
    return { kind: 'table', rows, rowCount: lines.length, snippet: buildTextPreview(text, 4000) };
  }
  if (association?.preview === 'web') {
    return { kind: 'web', snippet: buildTextPreview(text, 4000), renderHint: 'Use preview route or source view.' };
  }
  return { kind: association?.preview || 'text', snippet: buildTextPreview(text, 4000) };
}

export function readWorkspaceContent(config, workspaceId, rel = '.') {
  const baseDir = workspaceRoot(config, workspaceId);
  const { target, relative } = safeResolve(baseDir, rel);
  if (!fs.existsSync(target)) {
    throw new Error(`Path does not exist: ${relative}`);
  }
  const lstat = fs.lstatSync(target);
  if (lstat.isSymbolicLink()) {
    throw new Error(`Symlink access is blocked by workspace hardening: ${relative}`);
  }
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    throw new Error(`Path is a directory: ${relative}`);
  }
  const securityPolicy = getWorkspaceSecurityPolicy();
  if (stat.size > securityPolicy.maxReadBytes) {
    throw new Error(`Path exceeds max readable size (${securityPolicy.maxReadBytes} bytes): ${relative}`);
  }
  const association = inferAssociation(target);
  if (!isTextPath(target)) {
    return {
      path: relative,
      association,
      binary: true,
      size: stat.size,
      content: null,
      preview: null,
      message: 'Binary file. Download or inspect metadata instead.'
    };
  }
  const text = fs.readFileSync(target, 'utf8');
  return {
    path: relative,
    association,
    binary: false,
    size: stat.size,
    content: buildTextPreview(text),
    fullLength: text.length,
    preview: buildStructuredPreview(target, association, text)
  };
}

function collectFiles(baseDir, rel = '.', files = [], maxFiles = 500) {
  const { target, relative } = safeResolve(baseDir, rel);
  if (!fs.existsSync(target)) {
    return files;
  }
  const lstat = fs.lstatSync(target);
  if (lstat.isSymbolicLink()) {
    return files;
  }
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    files.push({ relative, target, stat });
    return files;
  }
  const entries = fs.readdirSync(target, { withFileTypes: true });
  for (const entry of entries) {
    if (files.length >= maxFiles) {
      break;
    }
    if (entry.name === '.git') {
      continue;
    }
    const childRel = relative === '.' ? entry.name : path.join(relative, entry.name);
    const childTarget = path.join(target, entry.name);
    const childLstat = fs.lstatSync(childTarget);
    if (childLstat.isSymbolicLink()) {
      continue;
    }
    const childStat = fs.statSync(childTarget);
    if (childStat.isDirectory()) {
      collectFiles(baseDir, childRel, files, maxFiles);
    } else {
      files.push({ relative: childRel, target: childTarget, stat: childStat });
    }
  }
  return files;
}

export function searchWorkspaceFiles(config, workspaceId, query, options = {}) {
  const needle = String(query || '').trim();
  if (!needle) {
    return { query: needle, matches: [], skippedLargeFiles: [] };
  }
  const baseDir = workspaceRoot(config, workspaceId);
  const files = collectFiles(baseDir, options.path || '.', [], Number.parseInt(String(options.scanLimit || 500), 10) || 500);
  const securityPolicy = getWorkspaceSecurityPolicy();
  const matches = [];
  const skippedLargeFiles = [];
  for (const file of files) {
    if (!isTextPath(file.target)) {
      continue;
    }
    if (file.stat.size > securityPolicy.maxSearchFileBytes) {
      skippedLargeFiles.push({ path: file.relative, size: file.stat.size, limit: securityPolicy.maxSearchFileBytes });
      continue;
    }
    const text = fs.readFileSync(file.target, 'utf8');
    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      if (lines[index].toLowerCase().includes(needle.toLowerCase())) {
        matches.push({ path: file.relative, line: index + 1, preview: lines[index].slice(0, 240) });
        if (matches.length >= (Number.parseInt(String(options.limit || 50), 10) || 50)) {
          return { query: needle, matches, skippedLargeFiles };
        }
      }
    }
  }
  return { query: needle, matches, skippedLargeFiles };
}

export function listChangedWorkspaceFiles(config, workspaceId) {
  const baseDir = workspaceRoot(config, workspaceId);
  if (!fs.existsSync(path.join(baseDir, '.git'))) {
    return { base: 'workspace', files: [] };
  }
  const result = spawnSync('git', ['status', '--short'], { cwd: baseDir, encoding: 'utf8' });
  if ((result.status ?? 1) !== 0) {
    return { base: 'workspace', files: [], error: (result.stderr || result.stdout || 'git status failed').trim() };
  }
  return {
    base: 'git',
    files: (result.stdout || '')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => ({ status: line.slice(0, 2).trim() || 'M', path: line.slice(3).trim() }))
  };
}

export function diffWorkspaceFile(config, workspaceId, rel) {
  const baseDir = workspaceRoot(config, workspaceId);
  const { target, relative } = safeResolve(baseDir, rel);
  if (!fs.existsSync(target)) {
    throw new Error(`Path does not exist: ${relative}`);
  }
  if (!fs.existsSync(path.join(baseDir, '.git'))) {
    const content = isTextPath(target) ? fs.readFileSync(target, 'utf8') : '';
    return {
      path: relative,
      mode: 'workspace',
      diff: isTextPath(target) ? buildTextPreview(content) : null,
      message: 'Git metadata unavailable; returning current content preview.'
    };
  }
  const result = spawnSync('git', ['diff', '--', relative], { cwd: baseDir, encoding: 'utf8' });
  return {
    path: relative,
    mode: 'git',
    diff: buildTextPreview(result.stdout || ''),
    message: (result.stderr || '').trim() || null
  };
}

export function getWorkspaceAssociationSummary(config, workspaceId, options = {}) {
  const tree = listWorkspaceTree(config, workspaceId, {
    path: options.path || '.',
    depth: options.depth || 4,
    limit: options.limit || 400
  });
  return {
    workspaceId,
    root: tree.root,
    count: tree.count,
    truncated: tree.truncated,
    associations: tree.associations
  };
}

export function getWorkspaceDownloadTarget(config, workspaceId, rel) {
  const baseDir = workspaceRoot(config, workspaceId);
  const { target, relative } = safeResolve(baseDir, rel);
  if (!fs.existsSync(target)) {
    throw new Error(`Path does not exist: ${relative}`);
  }
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    throw new Error(`Downloads currently support files only: ${relative}`);
  }
  return {
    targetPath: target,
    downloadName: path.basename(target),
    relativePath: relative,
    size: stat.size,
    association: inferAssociation(target)
  };
}

function tailText(text, lineLimit = 200) {
  const lines = String(text || '').split(/\r?\n/);
  return lines.slice(Math.max(0, lines.length - lineLimit)).join('\n');
}

export function getWorkspaceRuntimeLogs(config, workspaceId, options = {}) {
  const paths = getWorkspaceSandboxPaths(config, workspaceId);
  const runtimeState = getWorkspaceRuntimeState(config, workspaceId);
  const lineLimit = Number.parseInt(String(options.limit || 200), 10) || 200;
  const roles = ['ide', 'agent'];
  const logs = {};
  for (const role of roles) {
    const logPath = path.join(paths.runtimeDir, `${role}.log`);
    logs[role] = {
      path: logPath,
      exists: fs.existsSync(logPath),
      tail: fs.existsSync(logPath) ? tailText(fs.readFileSync(logPath, 'utf8'), lineLimit) : ''
    };
  }
  return { workspaceId, runtimeState, logs, logsDir: paths.logsDir };
}

export function getWorkspaceRuntimeEventsPayload(config, workspaceId, options = {}) {
  return {
    workspaceId,
    events: listRuntimeEvents(config, { workspaceId, limit: Number.parseInt(String(options.limit || 50), 10) || 50 }),
    projection: getWorkspaceRuntimeProjection(config, workspaceId)
  };
}
