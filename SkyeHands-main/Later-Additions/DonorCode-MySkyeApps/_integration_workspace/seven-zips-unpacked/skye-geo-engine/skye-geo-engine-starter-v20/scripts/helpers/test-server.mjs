import http from 'node:http';
import { appFetch } from '../../src/index.ts';

function fixtureHtmlFor(port) {
  return `<!doctype html><html lang="en"><head><title>Skye GEO Engine Fixture</title><meta name="description" content="Proof-backed AI search growth fixture page for browser smoke." /><link rel="canonical" href="http://127.0.0.1:${port}/fixtures/source" /><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage"}</script></head><body><h1>Skye GEO Engine Fixture</h1><h2>Audit Evidence</h2><h2>Source Ledger</h2><p>This fixture page exists so the browser smoke can run a real audit, a real research ingest, a real article brief, a real draft, a real generic publish, and a real bundle export/import/clone cycle against one operator surface.</p></body></html>`;
}

function makeJsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
}

export async function startTestServer({ port = 8787, runtimeEnv = { DB_MODE: 'memory' } } = {}) {
  const sockets = new Set();
  const server = http.createServer(async (req, res) => {
    try {
      const host = req.headers.host || `127.0.0.1:${port}`;
      const url = new URL(req.url || '/', `http://${host}`);

      if (url.pathname === '/fixtures/source') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(fixtureHtmlFor(port));
        return;
      }

      if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/neon.local/sql') {
        const response = new Response(JSON.stringify({ ok: true, service: 'neon-fixture' }), { status: 200, headers: { 'content-type': 'application/json' } });
        await pipeWebResponse(response, res);
        return;
      }

      if ((req.method === 'GET' || req.method === 'HEAD') && (
        url.pathname === '/publisher.local/content/publish' ||
        url.pathname === '/wp-json/wp/v2/posts' ||
        /\/collections\/[^/]+\/items$/.test(url.pathname) ||
        /\/admin\/api\/[^/]+\/blogs\/[^/]+\/articles\.json$/.test(url.pathname) ||
        url.pathname === '/blog/v3/draft-posts' ||
        url.pathname === '/ghost/api/admin/posts/'
      )) {
        const response = new Response(JSON.stringify({ ok: true, service: 'target-probe-fixture' }), { status: 200, headers: { 'content-type': 'application/json' } });
        await pipeWebResponse(response, res);
        return;
      }

      if (req.method === 'POST' && (
        url.pathname === '/publisher.local/content/publish' ||
        url.pathname === '/wp-json/wp/v2/posts' ||
        /\/collections\/[^/]+\/items$/.test(url.pathname) ||
        /\/admin\/api\/[^/]+\/blogs\/[^/]+\/articles\.json$/.test(url.pathname) ||
        url.pathname === '/blog/v3/draft-posts' ||
        url.pathname === '/ghost/api/admin/posts/'
      )) {
        const bodyText = await readNodeBody(req);
        const parsed = bodyText ? JSON.parse(bodyText) : {};
        const slug = parsed.slug || parsed.title?.toLowerCase?.().replace(/[^a-z0-9]+/g, '-') || parsed.post?.slug || parsed.item?.slug || 'published-entry';
        const response = makeJsonResponse({ ok: true, id: `remote_${slug}`, liveUrl: `${url.origin}/published/${slug}` }, 200);
        await pipeWebResponse(response, res);
        return;
      }

      const bodyText = await readNodeBody(req);
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) {
          for (const part of value) headers.append(key, part);
        } else if (value != null) {
          headers.set(key, String(value));
        }
      }
      const request = new Request(url.toString(), {
        method: req.method || 'GET',
        headers,
        body: bodyText.length ? bodyText : undefined
      });
      const response = await appFetch(request, runtimeEnv);
      await pipeWebResponse(response, res);
    } catch (error) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: String(error?.stack || error) }));
    }
  });

  server.on('connection', (socket) => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(undefined));
  });

  return {
    port,
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => {
      for (const socket of sockets) { try { socket.destroy(); } catch {} }
      server.close((error) => error ? reject(error) : resolve(undefined));
    })
  };
}

async function readNodeBody(req) {
  const parts = [];
  for await (const chunk of req) parts.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(parts).toString('utf8');
}

async function pipeWebResponse(response, res) {
  const headers = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  res.writeHead(response.status, headers);
  const ab = await response.arrayBuffer();
  res.end(Buffer.from(ab));
}
