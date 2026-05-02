import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const out = { host: '127.0.0.1', port: 4899, rootDir: process.cwd(), workspaceId: 'unknown', label: 'preview-fixture' };
  for (let i = 2; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--host') out.host = argv[i + 1] || out.host;
    if (value === '--port') out.port = Number.parseInt(argv[i + 1] || String(out.port), 10);
    if (value === '--root-dir') out.rootDir = path.resolve(argv[i + 1] || out.rootDir);
    if (value === '--workspace-id') out.workspaceId = argv[i + 1] || out.workspaceId;
    if (value === '--label') out.label = argv[i + 1] || out.label;
  }
  return out;
}

const args = parseArgs(process.argv);
const markerFile = path.join(args.rootDir, '.stage8-preview-marker.txt');
const htmlFile = path.join(args.rootDir, '.stage8-preview.html');

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || `${args.host}:${args.port}`}`);
  if (url.pathname === '/health') {
    writeJson(response, 200, {
      ok: true,
      label: args.label,
      workspaceId: args.workspaceId,
      rootDir: args.rootDir,
      markerFile,
      htmlFile,
      markerExists: fs.existsSync(markerFile),
      htmlExists: fs.existsSync(htmlFile)
    });
    return;
  }

  if (url.pathname === '/marker') {
    writeJson(response, 200, {
      ok: true,
      marker: fs.existsSync(markerFile) ? fs.readFileSync(markerFile, 'utf8') : null
    });
    return;
  }

  const html = fs.existsSync(htmlFile)
    ? fs.readFileSync(htmlFile, 'utf8')
    : `<!doctype html><html><body><h1>${args.label}</h1><p>${args.workspaceId}</p></body></html>`;
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(html);
});

server.listen(args.port, args.host, () => {
  process.stdout.write(JSON.stringify({ ok: true, host: args.host, port: args.port, rootDir: args.rootDir, workspaceId: args.workspaceId }) + '\n');
});
