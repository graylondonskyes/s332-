import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';
import { getStackConfig } from './config.mjs';
import { assertLegacyEntrypointAllowed } from '../lib/canonical-runtime.mjs';

const canonicalConfig = getStackConfig();
assertLegacyEntrypointAllowed(canonicalConfig, 'real-ide-runtime.mjs');

function parseArgs(argv) {
  const options = {
    workspaceId: null,
    workspaceName: null,
    port: null,
    rootDir: process.cwd(),
    host: '127.0.0.1',
    driver: process.env.SKYEQUANTA_WORKSPACE_DRIVER || 'real-local-executor'
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--workspace-id') {
      options.workspaceId = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (value === '--workspace-name') {
      options.workspaceName = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (value === '--port') {
      options.port = Number.parseInt(argv[index + 1], 10);
      index += 1;
      continue;
    }
    if (value === '--root-dir') {
      options.rootDir = path.resolve(argv[index + 1] || process.cwd());
      index += 1;
      continue;
    }
    if (value === '--host' || value === '--hostname') {
      options.host = argv[index + 1] || options.host;
      index += 1;
      continue;
    }
    if (value === '--driver') {
      options.driver = argv[index + 1] || options.driver;
      index += 1;
      continue;
    }
  }

  if (!options.workspaceId) {
    throw new Error('workspace-id is required');
  }
  if (!options.workspaceName) {
    options.workspaceName = options.workspaceId;
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
    throw new Error('port must be a valid integer in range 1-65535');
  }
  return options;
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload, null, 2));
}

function sanitizeWorkspacePath(rootDir, relativePath = '') {
  const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const resolved = path.resolve(rootDir, normalized || '.');
  const base = path.resolve(rootDir);
  if (!resolved.startsWith(base)) {
    throw new Error('path_outside_workspace');
  }
  return resolved;
}

function listDirectory(rootDir, relativePath = '') {
  const target = sanitizeWorkspacePath(rootDir, relativePath);
  const entries = fs.existsSync(target)
    ? fs.readdirSync(target, { withFileTypes: true }).map(entry => {
        const fullPath = path.join(target, entry.name);
        const stats = fs.statSync(fullPath);
        return {
          name: entry.name,
          path: path.relative(rootDir, fullPath).replace(/\\/g, '/'),
          kind: entry.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modifiedAt: stats.mtime.toISOString()
        };
      }).sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind.localeCompare(b.kind)))
    : [];
  return {
    path: relativePath || '',
    exists: fs.existsSync(target),
    entries
  };
}

function readFilePayload(rootDir, relativePath) {
  const target = sanitizeWorkspacePath(rootDir, relativePath);
  if (!fs.existsSync(target)) {
    throw new Error('file_not_found');
  }
  if (fs.statSync(target).isDirectory()) {
    throw new Error('path_is_directory');
  }
  const body = fs.readFileSync(target, 'utf8');
  return {
    path: relativePath,
    content: body,
    size: Buffer.byteLength(body, 'utf8')
  };
}

function writeFilePayload(rootDir, relativePath, content) {
  const target = sanitizeWorkspacePath(rootDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, String(content ?? ''), 'utf8');
  const stats = fs.statSync(target);
  return {
    path: relativePath,
    size: stats.size,
    modifiedAt: stats.mtime.toISOString()
  };
}

function getCapabilities(context) {
  return {
    driver: context.driver,
    serviceMode: 'real-ide-surface',
    role: 'ide',
    realIdeRuntime: true,
    realAgentRuntime: false,
    workspaceBound: true,
    isolatedFilesystem: true,
    containerized: false,
    remoteExecutor: false,
    fullTheiaRuntime: false,
    endpoints: ['/', '/health', '/capabilities', '/api/files', '/api/file']
  };
}

function writeIdeRoot(response, context) {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${context.workspaceName} Local IDE Surface</title>
    <style>
      :root { color-scheme: dark; }
      body { margin: 0; font-family: Inter, Arial, sans-serif; background: #0b1020; color: #e5e7eb; }
      header { padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.12); display:flex; justify-content:space-between; align-items:center; background: rgba(13,18,34,0.96); position:sticky; top:0; }
      .badge { display:inline-block; padding:6px 10px; border-radius:999px; font-size:12px; font-weight:700; background:#14532d; color:#dcfce7; }
      .wrap { display:grid; grid-template-columns: 320px 1fr; min-height: calc(100vh - 58px); }
      aside { border-right:1px solid rgba(255,255,255,0.12); padding:14px; overflow:auto; background: rgba(13,18,34,0.88); }
      main { padding:14px; display:grid; grid-template-rows:auto auto 1fr auto; gap:12px; }
      button, input { font: inherit; }
      button { cursor:pointer; border:none; border-radius:10px; padding:10px 14px; background:#7c3aed; color:white; }
      button.secondary { background:#1f2937; }
      .muted { color:#9ca3af; font-size:12px; }
      ul { list-style:none; padding:0; margin:10px 0 0; }
      li { margin:0; }
      li button { width:100%; text-align:left; background:transparent; padding:8px 10px; border-radius:10px; color:#e5e7eb; }
      li button:hover { background:rgba(255,255,255,0.08); }
      textarea { width:100%; min-height:60vh; border-radius:14px; border:1px solid rgba(255,255,255,0.14); background:#060b18; color:#f8fafc; padding:14px; resize:vertical; box-sizing:border-box; }
      code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      .panel { border:1px solid rgba(255,255,255,0.14); border-radius:16px; padding:12px; background: rgba(255,255,255,0.03); }
      .row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
      .row > * { flex:0 0 auto; }
      input[type="text"] { flex:1 1 420px; min-width:240px; padding:10px 12px; border-radius:10px; border:1px solid rgba(255,255,255,0.14); background:#0b1222; color:#fff; }
      .status { font-size:13px; color:#93c5fd; }
    </style>
  </head>
  <body>
    <header>
      <div>
        <div class="badge">REAL LOCAL IDE SURFACE</div>
        <div style="margin-top:8px; font-size:22px; font-weight:800;">${context.workspaceName}</div>
        <div class="muted">Workspace ID: ${context.workspaceId} · Driver: ${context.driver}</div>
      </div>
      <div class="panel">
        <div><strong>Root</strong></div>
        <div class="muted" id="root-label">${context.rootDir}</div>
      </div>
    </header>
    <div class="wrap">
      <aside>
        <div class="row">
          <button id="refresh">Refresh</button>
          <button id="new-file" class="secondary">New File</button>
        </div>
        <div class="muted" style="margin-top:10px;">Files in workspace root</div>
        <ul id="file-list"></ul>
      </aside>
      <main>
        <div class="panel row">
          <input type="text" id="file-path" placeholder="relative/path/to/file.txt" />
          <button id="load-file" class="secondary">Load</button>
          <button id="save-file">Save</button>
        </div>
        <div class="status" id="status">Ready.</div>
        <textarea id="editor" spellcheck="false"></textarea>
        <div class="panel">
          <div><strong>Strict proof note</strong></div>
          <div class="muted">This is a real workspace-bound editor surface with live file read/write endpoints. It is not the old stub service. Full upstream Theia parity remains a later stage.</div>
        </div>
      </main>
    </div>
    <script>
      const listEl = document.getElementById('file-list');
      const editorEl = document.getElementById('editor');
      const pathEl = document.getElementById('file-path');
      const statusEl = document.getElementById('status');

      function setStatus(message) { statusEl.textContent = message; }
      async function readJson(url, options) {
        const response = await fetch(url, options);
        if (!response.ok) {
          const body = await response.text();
          throw new Error(body || 'request_failed');
        }
        return response.json();
      }
      async function refreshList() {
        setStatus('Refreshing workspace file list...');
        const payload = await readJson('/api/files');
        listEl.innerHTML = '';
        for (const entry of payload.entries) {
          const li = document.createElement('li');
          const button = document.createElement('button');
          button.textContent = entry.kind === 'directory' ? '📁 ' + entry.name : '📄 ' + entry.name;
          button.addEventListener('click', async () => {
            if (entry.kind === 'file') {
              pathEl.value = entry.path;
              await loadFile();
            }
          });
          li.appendChild(button);
          listEl.appendChild(li);
        }
        setStatus('File list refreshed.');
      }
      async function loadFile() {
        const filePath = pathEl.value.trim();
        if (!filePath) {
          setStatus('Enter a file path first.');
          return;
        }
        setStatus('Loading ' + filePath + ' ...');
        const payload = await readJson('/api/file?path=' + encodeURIComponent(filePath));
        editorEl.value = payload.content;
        setStatus('Loaded ' + filePath + '.');
      }
      async function saveFile() {
        const filePath = pathEl.value.trim();
        if (!filePath) {
          setStatus('Enter a file path first.');
          return;
        }
        setStatus('Saving ' + filePath + ' ...');
        await readJson('/api/file', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ path: filePath, content: editorEl.value })
        });
        setStatus('Saved ' + filePath + '.');
        await refreshList();
      }
      document.getElementById('refresh').addEventListener('click', () => refreshList().catch(error => setStatus(String(error.message || error))));
      document.getElementById('new-file').addEventListener('click', () => { pathEl.value = 'notes/new-file.txt'; editorEl.value = ''; setStatus('Ready to create notes/new-file.txt'); });
      document.getElementById('load-file').addEventListener('click', () => loadFile().catch(error => setStatus(String(error.message || error))));
      document.getElementById('save-file').addEventListener('click', () => saveFile().catch(error => setStatus(String(error.message || error))));
      refreshList().catch(error => setStatus(String(error.message || error)));
    </script>
  </body>
</html>`);
}

function createServer(context) {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url || '/', `http://${context.host}:${context.port}`);

    if (url.pathname === '/health') {
      writeJson(response, 200, {
        status: 'ok',
        workspaceId: context.workspaceId,
        workspaceName: context.workspaceName,
        role: 'ide',
        rootDir: context.rootDir,
        pid: process.pid,
        driver: context.driver,
        serviceMode: 'real-ide-surface',
        capabilities: getCapabilities(context),
        now: new Date().toISOString()
      });
      return;
    }

    if (url.pathname === '/capabilities') {
      writeJson(response, 200, {
        ok: true,
        workspaceId: context.workspaceId,
        workspaceName: context.workspaceName,
        capabilities: getCapabilities(context)
      });
      return;
    }

    if (url.pathname === '/api/files') {
      const relativePath = url.searchParams.get('path') || '';
      try {
        writeJson(response, 200, { ok: true, ...listDirectory(context.rootDir, relativePath) });
      } catch (error) {
        writeJson(response, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
      }
      return;
    }

    if (url.pathname === '/api/file' && request.method === 'GET') {
      const relativePath = url.searchParams.get('path') || '';
      try {
        writeJson(response, 200, { ok: true, ...readFilePayload(context.rootDir, relativePath) });
      } catch (error) {
        writeJson(response, 404, { ok: false, error: error instanceof Error ? error.message : String(error), path: relativePath });
      }
      return;
    }

    if (url.pathname === '/api/file' && request.method === 'PUT') {
      let body = '';
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          writeJson(response, 200, { ok: true, ...writeFilePayload(context.rootDir, payload.path || '', payload.content || '') });
        } catch (error) {
          writeJson(response, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      });
      return;
    }

    if (url.pathname === '/') {
      writeIdeRoot(response, context);
      return;
    }

    writeJson(response, 404, { ok: false, error: 'not_found', route: url.pathname, workspaceId: context.workspaceId, role: 'ide', driver: context.driver, serviceMode: 'real-ide-surface' });
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  process.chdir(args.rootDir);
  const context = {
    workspaceId: args.workspaceId,
    workspaceName: args.workspaceName,
    role: 'ide',
    rootDir: args.rootDir,
    port: args.port,
    host: args.host,
    driver: args.driver
  };
  const server = createServer(context);
  server.listen(args.port, args.host, () => {
    console.log(JSON.stringify({ event: 'real_ide_surface_started', workspaceId: context.workspaceId, role: context.role, port: context.port, rootDir: context.rootDir, driver: context.driver, serviceMode: 'real-ide-surface', pid: process.pid }));
  });
  const shutdown = signal => {
    console.log(JSON.stringify({ event: 'real_ide_surface_stopping', workspaceId: context.workspaceId, role: context.role, signal }));
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
