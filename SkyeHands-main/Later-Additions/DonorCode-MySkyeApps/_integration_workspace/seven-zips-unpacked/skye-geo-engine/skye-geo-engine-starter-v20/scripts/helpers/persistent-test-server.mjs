import http from 'node:http';
import { promises as fs } from 'node:fs';
import { appFetch } from '../../src/index.ts';
import { loadMemoryDbSnapshotForTests, resetMemoryDbForTests, snapshotMemoryDbForTests } from '../../src/lib/db.ts';
import { loadPlatformStoreSnapshotForTests, resetPlatformStore, snapshotPlatformStoreForTests } from '../../src/lib/platformStore.ts';

function fixtureHtmlFor(port) {
  return `<!doctype html><html lang="en"><head><title>Skye GEO Engine Persistent Fixture</title><meta name="description" content="Persistent smoke fixture page for durable ledger validation." /><link rel="canonical" href="http://127.0.0.1:${port}/fixtures/source" /><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage"}</script></head><body><h1>Persistent Fixture</h1><h2>Audit Evidence</h2><h2>Source Ledger</h2><p>This fixture exists so the durable ledger smoke can prove read-after-restart persistence.</p></body></html>`;
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

async function loadSnapshot(snapshotFile) {
  resetMemoryDbForTests();
  resetPlatformStore();
  try {
    const raw = await fs.readFile(snapshotFile, 'utf8');
    const parsed = JSON.parse(raw);
    loadMemoryDbSnapshotForTests(parsed.memory || {});
    loadPlatformStoreSnapshotForTests(parsed.platform || {});
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

async function persistSnapshot(snapshotFile) {
  const payload = {
    persistedAt: new Date().toISOString(),
    memory: snapshotMemoryDbForTests(),
    platform: snapshotPlatformStoreForTests()
  };
  await fs.writeFile(snapshotFile, JSON.stringify(payload, null, 2), 'utf8');
}

export async function startPersistentTestServer({ port = 8789, snapshotFile, runtimeEnv = { DB_MODE: 'memory' } } = {}) {
  if (!snapshotFile) throw new Error('snapshotFile is required');
  await loadSnapshot(snapshotFile);
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
        const response = new Response(JSON.stringify({ ok: true, id: `remote_${slug}`, liveUrl: `${url.origin}/published/${slug}` }), { status: 200, headers: { 'content-type': 'application/json' } });
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
      await persistSnapshot(snapshotFile);
      await pipeWebResponse(response, res);
    } catch (error) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: String(error?.stack || error) }));
    }
  });

  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(undefined));
  });

  return {
    port,
    origin: `http://127.0.0.1:${port}`,
    snapshotFile,
    close: () => new Promise((resolve, reject) => {
      for (const socket of sockets) {
        try { socket.destroy(); } catch {}
      }
      server.close((error) => error ? reject(error) : resolve(undefined));
    })
  };
}
