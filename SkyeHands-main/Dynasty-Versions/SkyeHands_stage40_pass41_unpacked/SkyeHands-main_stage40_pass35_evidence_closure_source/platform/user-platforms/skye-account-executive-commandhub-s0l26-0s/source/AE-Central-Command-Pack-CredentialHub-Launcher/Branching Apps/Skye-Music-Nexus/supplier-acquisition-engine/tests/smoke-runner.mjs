import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'supplier-engine-smoke-'));
process.env.DB_PATH = path.join(tmpDir, 'db.json');
process.env.OPENAI_MOCK = process.env.OPENAI_MOCK || '1';
process.env.PORT = '0';

const { createApp } = await import('../server.mjs');
const { resetDb } = await import('../lib/store.mjs');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function listen(target) {
  return new Promise((resolve) => {
    const server = target.listen(0, () => resolve(server));
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
}

function headers() {
  return { 'content-type': 'application/json' };
}

function startFixtureServer() {
  const server = http.createServer((req, res) => {
    if (req.url === '/marketplace') {
      res.setHeader('content-type', 'text/html');
      res.end(`
        <html>
          <body>
            <div class="market-grid">
              <article class="product-card">
                <a href="/product-a" class="product-title">Techwear tactical shell jacket</a>
                <div class="supplier">Abyss Works Manufacturer</div>
                <div class="meta">OEM ODM custom outerwear supplier · MOQ 20 pieces · $18 - $29</div>
              </article>
              <article class="product-card">
                <a href="/product-b" class="product-title">Dark cyberpunk wash hoodie</a>
                <div class="supplier">Night Circuit Factory</div>
                <div class="meta">Low MOQ 2 pieces · sample available · $11 - $18</div>
              </article>
              <article class="product-card">
                <a href="/product-c" class="product-title">Punk cargo strap pants</a>
                <div class="supplier">Iron Vein Apparel</div>
                <div class="meta">Private label streetwear manufacturer · MOQ 50 pieces · $16 - $24</div>
              </article>
              <article class="product-card">
                <a href="/product-d" class="product-title">Silicone kitchen sink rack</a>
                <div class="supplier">Home Utility Depot</div>
                <div class="meta">MOQ 100 pieces · $4 - $7</div>
              </article>
            </div>
          </body>
        </html>
      `);
      return;
    }
    if (req.url === '/product-a') {
      res.setHeader('content-type', 'text/html');
      res.end('<html><head><title>Abyss Works</title></head><body><h1>Abyss Works</h1><p>OEM/ODM techwear jacket manufacturer. MOQ 20 pieces. Price $18 - $29.</p></body></html>');
      return;
    }
    if (req.url === '/product-b') {
      res.setHeader('content-type', 'text/html');
      res.end('<html><head><title>Night Circuit</title></head><body><h1>Night Circuit</h1><p>Dark cyberpunk hoodie supplier. Low MOQ 2 pieces. Price $11 - $18.</p></body></html>');
      return;
    }
    if (req.url === '/product-c') {
      res.setHeader('content-type', 'text/html');
      res.end('<html><head><title>Iron Vein Apparel</title></head><body><h1>Iron Vein Apparel</h1><p>Punk cargo manufacturer. MOQ 50 pieces. Price $16 - $24.</p></body></html>');
      return;
    }
    if (req.url === '/product-d') {
      res.setHeader('content-type', 'text/html');
      res.end('<html><head><title>Home Utility Depot</title></head><body><h1>Home Utility Depot</h1><p>Kitchen rack supplier. MOQ 100 pieces. Price $4 - $7.</p></body></html>');
      return;
    }
    res.statusCode = 404;
    res.end('not found');
  });
  return listen(server);
}

resetDb();
const fixtureServer = await startFixtureServer();
const fixturePort = fixtureServer.address().port;
const appServer = await listen(createApp());
const port = appServer.address().port;

try {
  console.log(`Smoke target: http://127.0.0.1:${port}`);

  const healthRes = await fetch(`http://127.0.0.1:${port}/api/health`);
  const health = await healthRes.json();
  assert(health.ok === true, 'health failed');
  console.log('✓ health');

  const diagRes = await fetch(`http://127.0.0.1:${port}/api/diagnostics/url`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ url: `http://127.0.0.1:${fixturePort}/marketplace` })
  });
  const diag = await diagRes.json();
  assert(diagRes.status === 200, 'diagnostics failed');
  assert(diag.report.candidateCount >= 4, 'expected diagnostic candidates');
  console.log(`✓ diagnostics (${diag.report.candidateCount} marketplace candidates)`);

  const pipelineRes = await fetch(`http://127.0.0.1:${port}/api/pipeline/search`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ searchUrl: `http://127.0.0.1:${fixturePort}/marketplace`, minFitScore: 50 })
  });
  const pipeline = await pipelineRes.json();
  assert(pipelineRes.status === 201, 'pipeline search failed');
  assert(pipeline.created === 4, 'expected 4 created leads');
  assert(pipeline.extractedCount === 4, 'expected 4 extracted leads');
  assert(pipeline.draftedCount >= 1, 'expected at least one drafted lead');
  console.log(`✓ full pipeline (${pipeline.created} created, ${pipeline.draftedCount} drafted)`);

  const nextRes = await fetch(`http://127.0.0.1:${port}/api/leads/next-draft-ready`);
  const next = await nextRes.json();
  assert(next.lead, 'expected next draft-ready lead');
  console.log('✓ next draft-ready lead');

  const markRes = await fetch(`http://127.0.0.1:${port}/api/leads/mark-contacted`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ ids: [next.lead.id], channel: 'manual' })
  });
  const mark = await markRes.json();
  assert(markRes.status === 200, 'mark contacted failed');
  assert(mark.updatedCount === 1, 'expected one updated lead');
  console.log('✓ mark contacted');

  const exportRes = await fetch(`http://127.0.0.1:${port}/api/export.csv`);
  const csv = await exportRes.text();
  assert(/Techwear tactical shell jacket|Dark cyberpunk wash hoodie/.test(csv), 'csv export missing expected lead');
  console.log('✓ export csv');

  console.log('SMOKE PASS');
} finally {
  await closeServer(appServer);
  await closeServer(fixtureServer);
}
