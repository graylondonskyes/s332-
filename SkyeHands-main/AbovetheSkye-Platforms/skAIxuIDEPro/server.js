#!/usr/bin/env node
// server.js — Static file server with explicit optional gateway proxy
// By default this server only serves static assets and local helper endpoints.
// To proxy AI traffic to a remote gateway, set KAIXU_GATEWAY_URL explicitly.
// Run: node server.js

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 8080;
const GATEWAY = process.env.KAIXU_GATEWAY_URL || '';
const IS_DIRECT_RUN = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === __filename;
const ROOT_DIR = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
  '.ttf':  'font/ttf',
  '.mp4':  'video/mp4',
  '.webp': 'image/webp',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
const BLOCKED_STATIC_BASENAMES = new Set([
  'package.json',
  'package-lock.json',
  'server.js',
  'netlify.toml',
  '.env',
  '.env.example',
  '.gitignore',
]);

function json(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    ...CORS_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

function workspaceProjectCatalog(rootDir = ROOT_DIR) {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules')
    .map((entry) => {
      const dirPath = path.join(rootDir, entry.name);
      const children = fs.readdirSync(dirPath, { withFileTypes: true });
      const hasIndex = children.some((child) => child.isFile() && child.name.toLowerCase() === 'index.html');
      return {
        name: entry.name,
        path: hasIndex ? `/${encodeURI(entry.name)}/index.html` : null,
        has_index: hasIndex,
        entry_count: children.length,
      };
    })
    .sort((a, b) => {
      if (a.has_index !== b.has_index) return a.has_index ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

function resolveStaticPath(rootDir, pathname) {
  const sanitizedPath = pathname === '/' ? '/index.html' : pathname;
  const decoded = decodeURIComponent(sanitizedPath);
  const rawSegments = decoded.split('/');
  if (rawSegments.some((segment) => segment === '..')) {
    const err = new Error('Forbidden path');
    err.statusCode = 403;
    throw err;
  }
  const normalized = path.posix.normalize(decoded);
  const relative = normalized.replace(/^\/+/, '');
  const candidate = path.resolve(rootDir, relative);
  const rootWithSep = rootDir.endsWith(path.sep) ? rootDir : `${rootDir}${path.sep}`;

  if (candidate !== rootDir && !candidate.startsWith(rootWithSep)) {
    const err = new Error('Forbidden path');
    err.statusCode = 403;
    throw err;
  }

  let filePath = candidate;
  if (!path.extname(filePath)) {
    const tryIndex = path.join(filePath, 'index.html');
    const tryHtml = `${filePath}.html`;
    if (fs.existsSync(tryIndex)) filePath = tryIndex;
    else if (fs.existsSync(tryHtml)) filePath = tryHtml;
  }
  if (BLOCKED_STATIC_BASENAMES.has(path.basename(filePath).toLowerCase())) {
    const err = new Error('Forbidden path');
    err.statusCode = 403;
    throw err;
  }
  return filePath;
}

function proxyToGateway(req, res, upstreamPath) {
  if (!GATEWAY) {
    json(res, 501, {
      error: 'Remote gateway proxy disabled',
      detail: 'Use `netlify dev` for local functions or set KAIXU_GATEWAY_URL to enable explicit remote proxying.'
    });
    return;
  }
  const gatewayBase = new URL(GATEWAY);
  const url = new URL(upstreamPath, gatewayBase);
  const transport = url.protocol === 'http:' ? http : url.protocol === 'https:' ? https : null;
  if (!transport) {
    json(res, 500, { error: 'Unsupported gateway protocol', detail: url.protocol });
    return;
  }

  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'http:' ? 80 : 443),
      path: url.pathname + url.search,
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'Content-Length': body.length,
        ...(req.headers['authorization'] ? { 'Authorization': req.headers['authorization'] } : {}),
      }
    };

    const proxy = transport.request(options, (upRes) => {
      res.writeHead(upRes.statusCode, { ...CORS_HEADERS, 'Content-Type': upRes.headers['content-type'] || 'application/json' });
      upRes.pipe(res);
    });

    proxy.on('error', (err) => {
      console.error('[proxy error]', err.message);
      json(res, 502, { error: 'Gateway unreachable', detail: err.message });
    });

    proxy.write(body);
    proxy.end();
  });
}

export function createServer(rootDir = ROOT_DIR) {
  return http.createServer((req, res) => {
  const rawUrl = String(req.url || '');
  const rawUrlLower = rawUrl.toLowerCase();
  if (rawUrlLower.includes('/..') || rawUrlLower.includes('%2e%2e')) {
    json(res, 403, { error: 'Forbidden path' });
    return;
  }
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // ── /api/fs/projects → list top-level project directories in workspace ──
  if (pathname === '/api/fs/projects') {
    try {
      json(res, 200, workspaceProjectCatalog(rootDir));
    } catch (err) {
      json(res, 500, { error: err.message });
    }
    return;
  }

  // ── /api/* → optional proxy to remote gateway (stripping /api prefix) ──
  if (pathname.startsWith('/api/')) {
    const upstreamPath = pathname.slice(4); // strip /api
    console.log(`[proxy] ${req.method} ${pathname} → ${GATEWAY || '[disabled]'}${upstreamPath}`);
    proxyToGateway(req, res, upstreamPath);
    return;
  }

  // ── /.netlify/functions/* → optional proxy to remote gateway ──
  if (pathname.startsWith('/.netlify/functions/')) {
    console.log(`[proxy] ${req.method} ${pathname} → ${GATEWAY || '[disabled]'}${pathname}`);
    proxyToGateway(req, res, pathname);
    return;
  }

  // ── Static file serving ──
  let filePath;
  try {
    filePath = resolveStaticPath(rootDir, pathname);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode === 403) {
      json(res, statusCode, { error: 'Forbidden path' });
    } else {
      json(res, statusCode, { error: error.message || 'Path resolution failed' });
    }
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found: ' + pathname);
      } else {
        res.writeHead(500);
        res.end('500 Server Error');
      }
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', ...CORS_HEADERS });
    res.end(data);
  });
  });
}

export const server = createServer();

if (IS_DIRECT_RUN) {
  server.listen(PORT, () => {
    console.log(`\n  SkAIxuide Server running on http://localhost:${PORT}`);
    if (GATEWAY) console.log(`  Proxying /api/* and /.netlify/functions/* → ${GATEWAY}`);
    else console.log('  Remote gateway proxy disabled; use `netlify dev` for local function execution.');
    console.log(`  Press Ctrl+C to stop\n`);
  });
}
