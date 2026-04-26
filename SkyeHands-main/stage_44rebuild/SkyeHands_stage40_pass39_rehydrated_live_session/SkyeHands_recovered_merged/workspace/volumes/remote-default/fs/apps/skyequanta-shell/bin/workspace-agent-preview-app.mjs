import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

function parseArgs(argv) {
  const args = {
    host: '127.0.0.1',
    port: 4899,
    apiPort: null,
    rootDir: process.cwd(),
    workspaceId: 'unknown',
    label: 'agent-preview-app',
    title: 'SkyeQuanta Preview App'
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--host') {
      args.host = argv[index + 1] || args.host;
      index += 1;
      continue;
    }
    if (value === '--port') {
      args.port = Number.parseInt(argv[index + 1], 10) || args.port;
      index += 1;
      continue;
    }
    if (value === '--api-port') {
      args.apiPort = Number.parseInt(argv[index + 1], 10) || null;
      index += 1;
      continue;
    }
    if (value === '--root-dir') {
      args.rootDir = argv[index + 1] || args.rootDir;
      index += 1;
      continue;
    }
    if (value === '--workspace-id') {
      args.workspaceId = argv[index + 1] || args.workspaceId;
      index += 1;
      continue;
    }
    if (value === '--label') {
      args.label = argv[index + 1] || args.label;
      index += 1;
      continue;
    }
    if (value === '--title') {
      args.title = argv[index + 1] || args.title;
      index += 1;
      continue;
    }
  }

  return args;
}

function ensureDir(dirPath) { fs.mkdirSync(dirPath, { recursive: true }); }
function jsonResponse(response, statusCode, payload) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}
function fileResponse(response, filePath, contentType = 'text/plain; charset=utf-8') {
  if (!fs.existsSync(filePath)) {
    jsonResponse(response, 404, { ok: false, error: 'not_found', filePath });
    return;
  }
  response.writeHead(200, { 'content-type': contentType });
  fs.createReadStream(filePath).pipe(response);
}
function buildGeneratedFiles(args) {
  const contract = {
    ok: true,
    appKind: 'agent-generated-preview-app',
    workspaceId: args.workspaceId,
    label: args.label,
    title: args.title,
    appPort: args.port,
    apiPort: args.apiPort,
    files: {
      indexHtml: 'index.html',
      data: 'preview-data.json',
      contract: '.well-known/preview-contract.json'
    }
  };
  const data = {
    ok: true,
    workspaceId: args.workspaceId,
    label: args.label,
    title: args.title,
    appPort: args.port,
    apiPort: args.apiPort,
    generatedAt: new Date().toISOString()
  };
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${args.title}</title>
    <style>
      body{font-family:Arial,sans-serif;background:#0c1220;color:#f5f7fb;margin:0;padding:32px;}
      main{max-width:720px;margin:0 auto;background:#111a2e;border:1px solid #223353;border-radius:20px;padding:24px;}
      code{display:block;padding:12px;background:#0a1020;border-radius:12px;color:#9cc0ff;overflow:auto;}
      .meta{color:#aeb8cc;}
    </style>
  </head>
  <body>
    <main>
      <h1>${args.title}</h1>
      <p class="meta">workspace: ${args.workspaceId}</p>
      <p class="meta">label: ${args.label}</p>
      <p>This preview surface is generated inside the workspace filesystem and served back through routed port forwarding.</p>
      <code>/.well-known/preview-contract.json</code>
      <code>/api/contract</code>
      <code>/api/data</code>
    </main>
  </body>
</html>`;
  return { contract, data, html };
}
function writeGeneratedFiles(args) {
  ensureDir(args.rootDir);
  ensureDir(path.join(args.rootDir, '.well-known'));
  const { contract, data, html } = buildGeneratedFiles(args);
  const indexPath = path.join(args.rootDir, 'index.html');
  const dataPath = path.join(args.rootDir, 'preview-data.json');
  const contractPath = path.join(args.rootDir, '.well-known', 'preview-contract.json');
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, html, 'utf8');
  }
  if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  }
  if (!fs.existsSync(contractPath)) {
    fs.writeFileSync(contractPath, `${JSON.stringify(contract, null, 2)}\n`, 'utf8');
  }
}
function createAppServer(args) {
  return http.createServer((request, response) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || `${args.host}:${args.port}`}`);
    if (url.pathname === '/health') {
      jsonResponse(response, 200, { ok: true, kind: 'app', workspaceId: args.workspaceId, label: args.label, port: args.port });
      return;
    }
    if (url.pathname === '/api/contract') {
      fileResponse(response, path.join(args.rootDir, '.well-known', 'preview-contract.json'), 'application/json; charset=utf-8');
      return;
    }
    if (url.pathname === '/api/data') {
      fileResponse(response, path.join(args.rootDir, 'preview-data.json'), 'application/json; charset=utf-8');
      return;
    }
    if (url.pathname === '/.well-known/preview-contract.json') {
      fileResponse(response, path.join(args.rootDir, '.well-known', 'preview-contract.json'), 'application/json; charset=utf-8');
      return;
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      fileResponse(response, path.join(args.rootDir, 'index.html'), 'text/html; charset=utf-8');
      return;
    }
    jsonResponse(response, 404, { ok: false, error: 'not_found', pathname: url.pathname });
  });
}
function createApiServer(args) {
  return http.createServer((request, response) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || `${args.host}:${args.apiPort}`}`);
    if (url.pathname === '/health') {
      jsonResponse(response, 200, { ok: true, kind: 'api', workspaceId: args.workspaceId, label: args.label, port: args.apiPort });
      return;
    }
    if (url.pathname === '/data') {
      fileResponse(response, path.join(args.rootDir, 'preview-data.json'), 'application/json; charset=utf-8');
      return;
    }
    if (url.pathname === '/contract') {
      fileResponse(response, path.join(args.rootDir, '.well-known', 'preview-contract.json'), 'application/json; charset=utf-8');
      return;
    }
    jsonResponse(response, 404, { ok: false, error: 'not_found', pathname: url.pathname });
  });
}
async function listen(server, host, port) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
}
async function close(server) { if (server?.listening) await new Promise(resolve => server.close(resolve)); }
async function main() {
  const args = parseArgs(process.argv.slice(2));
  writeGeneratedFiles(args);
  const appServer = createAppServer(args);
  const apiServer = args.apiPort ? createApiServer(args) : null;
  const cleanup = async () => {
    await close(appServer);
    await close(apiServer);
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  await listen(appServer, args.host, args.port);
  if (apiServer) await listen(apiServer, args.host, args.apiPort);
  process.stdout.write(`${JSON.stringify({ ok: true, kind: 'agent-generated-preview-app', workspaceId: args.workspaceId, appPort: args.port, apiPort: args.apiPort })}\n`);
}
main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : String(error)); process.exitCode = 1; });
