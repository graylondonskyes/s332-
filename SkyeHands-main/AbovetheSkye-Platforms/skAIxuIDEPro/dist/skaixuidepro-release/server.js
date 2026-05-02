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

function proxyToGateway(req, res, upstreamPath) {
  if (!GATEWAY) {
    res.writeHead(501, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Remote gateway proxy disabled',
      detail: 'Use `netlify dev` for local functions or set KAIXU_GATEWAY_URL to enable explicit remote proxying.'
    }));
    return;
  }
  const url = new URL(GATEWAY + upstreamPath);

  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'Content-Length': body.length,
        ...(req.headers['authorization'] ? { 'Authorization': req.headers['authorization'] } : {}),
      }
    };

    const proxy = https.request(options, (upRes) => {
      res.writeHead(upRes.statusCode, { ...CORS_HEADERS, 'Content-Type': upRes.headers['content-type'] || 'application/json' });
      upRes.pipe(res);
    });

    proxy.on('error', (err) => {
      console.error('[proxy error]', err.message);
      res.writeHead(502, CORS_HEADERS);
      res.end(JSON.stringify({ error: 'Gateway unreachable', detail: err.message }));
    });

    proxy.write(body);
    proxy.end();
  });
}

const server = http.createServer((req, res) => {
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
      const entries = fs.readdirSync(__dirname, { withFileTypes: true });
      const dirs = entries
        .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
        .map(e => e.name);
      res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
      res.end(JSON.stringify(dirs));
    } catch (err) {
      res.writeHead(500, CORS_HEADERS);
      res.end(JSON.stringify({ error: err.message }));
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
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

  // Directory index fallback
  if (!path.extname(filePath)) {
    const tryIndex = path.join(filePath, 'index.html');
    const tryHtml = filePath + '.html';
    if (fs.existsSync(tryIndex)) filePath = tryIndex;
    else if (fs.existsSync(tryHtml)) filePath = tryHtml;
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

if (IS_DIRECT_RUN) {
  server.listen(PORT, () => {
    console.log(`\n  SkAIxuide Server running on http://localhost:${PORT}`);
    if (GATEWAY) console.log(`  Proxying /api/* and /.netlify/functions/* → ${GATEWAY}`);
    else console.log('  Remote gateway proxy disabled; use `netlify dev` for local function execution.');
    console.log(`  Press Ctrl+C to stop\n`);
  });
}
