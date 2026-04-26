import http from 'node:http';

export function createAgentCoreRuntime(options = {}) {
  const host = options.host || '127.0.0.1';
  const port = Number.parseInt(String(options.port || 8953), 10);
  const server = http.createServer((request, response) => {
    if (request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: true, runtime: 'agent-core-runtime', version: '0.1.0' }));
      return;
    }
    if (request.url === '/manifest') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({
        ok: true,
        runtime: 'agent-core-runtime',
        capabilities: ['health', 'manifest', 'bundle-proof']
      }));
      return;
    }
    response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: false, error: 'not_found' }));
  });

  return {
    host,
    port,
    listen: () => new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, resolve);
    }),
    close: () => new Promise(resolve => server.close(resolve))
  };
}
