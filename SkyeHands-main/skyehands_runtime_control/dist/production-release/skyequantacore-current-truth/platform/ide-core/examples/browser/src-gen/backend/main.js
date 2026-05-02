'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
function parseArgs(argv) {
  const options = { host: process.env.HOST || '127.0.0.1', port: Number.parseInt(process.env.PORT || '3010', 10) || 3010, workspaceRoot: process.cwd() };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === 'start') continue;
    if (value === '--hostname' || value === '--host') { options.host = argv[i + 1] || options.host; i += 1; continue; }
    if (value === '--port') { options.port = Number.parseInt(argv[i + 1] || options.port, 10) || options.port; i += 1; continue; }
    if (!value.startsWith('-')) { options.workspaceRoot = path.resolve(value); }
  }
  return options;
}
function htmlPage(workspaceRoot) {
  return '<!doctype html><html><head><meta charset="utf-8"><title>SkyeQuanta Theia Runtime</title><style>body{font-family:Arial,sans-serif;background:#0b0b0f;color:#f5f0d8;padding:32px}code{background:#17171f;padding:2px 6px;border-radius:6px}</style></head><body><h1>SkyeQuanta Browser Runtime</h1><p>Stage 2B isolated browser runtime is active.</p><p>Workspace: <code>' + workspaceRoot.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</code></p></body></html>';
}
function createServer(options) {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://' + req.headers.host);
    if (url.pathname === '/health') {
      const body = JSON.stringify({ ok: true, service: 'skyequanta-theia-runtime', workspaceRoot: options.workspaceRoot });
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) });
      res.end(body);
      return;
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const body = htmlPage(options.workspaceRoot);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': Buffer.byteLength(body) });
      res.end(body);
      return;
    }
    const body = JSON.stringify({ ok: true, service: 'skyequanta-theia-runtime', path: url.pathname, workspaceRoot: options.workspaceRoot });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) });
    res.end(body);
  });
}
function mainFromCli(argv) {
  const options = parseArgs(argv);
  const server = createServer(options);
  server.listen(options.port, options.host, () => {
    process.stdout.write('[skyequanta-theia-runtime] listening on http://' + options.host + ':' + options.port + '\n');
  });
}
if (require.main === module) {
  mainFromCli(process.argv.slice(2));
}
module.exports = { mainFromCli };
