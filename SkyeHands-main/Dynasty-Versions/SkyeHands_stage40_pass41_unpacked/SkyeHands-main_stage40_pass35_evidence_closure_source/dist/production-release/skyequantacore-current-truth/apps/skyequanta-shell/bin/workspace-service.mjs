import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { getStackConfig } from './config.mjs';
import { assertLegacyEntrypointAllowed } from '../lib/canonical-runtime.mjs';

const canonicalConfig = getStackConfig();
assertLegacyEntrypointAllowed(canonicalConfig, 'workspace-service.mjs');

function parseArgs(argv) {
  const options = {
    workspaceId: null,
    workspaceName: null,
    role: null,
    port: null,
    rootDir: process.cwd(),
    driver: process.env.SKYEQUANTA_WORKSPACE_DRIVER || 'workspace-service-stub'
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

    if (value === '--role') {
      options.role = argv[index + 1] || null;
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

  if (!options.role || !['ide', 'agent'].includes(options.role)) {
    throw new Error('role must be one of: ide, agent');
  }

  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
    throw new Error('port must be a valid integer in range 1-65535');
  }

  return options;
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(payload));
}

function listRootEntries(rootDir) {
  try {
    return fs.readdirSync(rootDir).slice(0, 50);
  } catch {
    return [];
  }
}

function getCapabilities(context) {
  return {
    driver: context.driver,
    serviceMode: 'stub',
    role: context.role,
    realIdeRuntime: false,
    realAgentRuntime: false,
    containerized: false,
    remoteExecutor: false,
    isolatedFilesystem: true,
    rootDirReadable: fs.existsSync(context.rootDir),
    endpoints: context.role === 'ide'
      ? ['/health', '/capabilities', '/api/files']
      : ['/health', '/capabilities', '/docs', '/api/*']
  };
}

function writeIdeRoot(response, context) {
  response.writeHead(200, {
    'content-type': 'text/html; charset=utf-8'
  });

  response.end(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${context.workspaceName} stub workspace service</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 2rem; line-height: 1.5; }
      .flag { display: inline-block; padding: 0.25rem 0.5rem; background: #7f1d1d; color: #fff; border-radius: 0.35rem; font-weight: 700; }
      code { background: #f3f4f6; padding: 0.1rem 0.3rem; border-radius: 0.25rem; }
    </style>
  </head>
  <body>
    <div class="flag">STUB WORKSPACE SERVICE</div>
    <h1>${context.workspaceName}</h1>
    <p>This process is a proof and control-plane placeholder. It is <strong>not</strong> a real Theia workspace runtime.</p>
    <ul>
      <li>Workspace ID: <code>${context.workspaceId}</code></li>
      <li>Role: <code>${context.role}</code></li>
      <li>Driver: <code>${context.driver}</code></li>
      <li>Root: <code>${context.rootDir}</code></li>
      <li>Port: <code>${context.port}</code></li>
    </ul>
    <p>Probe <code>/health</code> and <code>/capabilities</code> before marking any execution checklist item complete.</p>
  </body>
</html>`);
}

function createServer(context) {
  return http.createServer((request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');

    if (url.pathname === '/health') {
      writeJson(response, 200, {
        status: 'ok',
        workspaceId: context.workspaceId,
        workspaceName: context.workspaceName,
        role: context.role,
        rootDir: context.rootDir,
        pid: process.pid,
        driver: context.driver,
        serviceMode: 'stub',
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

    if (context.role === 'agent' && (url.pathname === '/' || url.pathname === '/docs')) {
      writeJson(response, 200, {
        ok: true,
        service: 'workspace-agent',
        workspaceId: context.workspaceId,
        workspaceName: context.workspaceName,
        rootDir: context.rootDir,
        driver: context.driver,
        serviceMode: 'stub',
        entries: listRootEntries(context.rootDir)
      });
      return;
    }

    if (context.role === 'agent' && url.pathname.startsWith('/api/')) {
      writeJson(response, 200, {
        ok: true,
        service: 'workspace-agent',
        route: url.pathname,
        workspaceId: context.workspaceId,
        method: request.method,
        rootDir: context.rootDir,
        driver: context.driver,
        serviceMode: 'stub'
      });
      return;
    }

    if (context.role === 'ide' && url.pathname === '/') {
      writeIdeRoot(response, context);
      return;
    }

    if (context.role === 'ide' && url.pathname === '/api/files') {
      writeJson(response, 200, {
        ok: true,
        service: 'workspace-ide',
        workspaceId: context.workspaceId,
        rootDir: context.rootDir,
        driver: context.driver,
        serviceMode: 'stub',
        entries: listRootEntries(context.rootDir)
      });
      return;
    }

    writeJson(response, 404, {
      ok: false,
      error: 'not_found',
      route: url.pathname,
      workspaceId: context.workspaceId,
      role: context.role,
      driver: context.driver,
      serviceMode: 'stub'
    });
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  process.chdir(args.rootDir);

  const context = {
    workspaceId: args.workspaceId,
    workspaceName: args.workspaceName,
    role: args.role,
    rootDir: args.rootDir,
    port: args.port,
    driver: args.driver
  };

  const server = createServer(context);
  server.listen(args.port, '127.0.0.1', () => {
    console.log(
      JSON.stringify({
        event: 'workspace_service_started',
        workspaceId: context.workspaceId,
        role: context.role,
        port: context.port,
        rootDir: context.rootDir,
        driver: context.driver,
        serviceMode: 'stub',
        pid: process.pid
      })
    );
  });

  const shutdown = signal => {
    console.log(JSON.stringify({ event: 'workspace_service_stopping', workspaceId: context.workspaceId, role: context.role, signal }));
    server.close(() => {
      process.exit(0);
    });

    setTimeout(() => {
      process.exit(0);
    }, 2000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
