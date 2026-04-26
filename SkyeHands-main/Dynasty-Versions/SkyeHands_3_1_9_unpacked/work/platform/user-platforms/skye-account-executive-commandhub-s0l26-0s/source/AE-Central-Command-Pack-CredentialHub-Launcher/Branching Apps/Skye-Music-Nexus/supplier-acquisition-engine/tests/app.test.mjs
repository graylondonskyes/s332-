import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'supplier-engine-test-'));
process.env.DB_PATH = path.join(tmpDir, 'db.json');
process.env.OPENAI_MOCK = '1';
process.env.PORT = '0';

const { createApp } = await import('../server.mjs');
const { resetDb } = await import('../lib/store.mjs');

function jsonHeaders() {
  return { 'content-type': 'application/json' };
}

function listen(target) {
  return new Promise((resolve) => {
    const server = target.listen(0, () => resolve(server));
  });
}

function stopServer(server) {
  return new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
}

function startFixtureServer() {
  const server = http.createServer((req, res) => {
    if (req.url === '/search') {
      res.setHeader('content-type', 'text/html');
      res.end(`
        <html><body>
          <a href="/supplier-a">Techwear OEM supplier jackets</a>
          <a href="/supplier-b">Dark hoodie manufacturer low MOQ</a>
        </body></html>
      `);
      return;
    }

    if (req.url === '/marketplace-grid') {
      res.setHeader('content-type', 'text/html');
      res.end(`
        <html>
          <body>
            <div class="search-result-list">
              <div class="search-card search-card-1">
                <div class="thumb"><a href="/grid-product-a">View</a></div>
                <div class="content"><a href="/grid-product-a" class="title-link">Techwear utility bomber jacket</a></div>
                <div class="company-row"><a href="/supplier-grid-a" class="company-name">Black Halo Garments</a></div>
                <div class="badges">OEM ODM custom supplier</div>
                <div class="pricing">MOQ 10 pieces · $22 - $34</div>
              </div>
              <div class="search-card search-card-2">
                <div class="thumb"><a href="/grid-product-b">View</a></div>
                <div class="content"><a href="/grid-product-b" class="title-link">Dark washed oversized hoodie</a></div>
                <div class="company-row"><a href="/supplier-grid-b" class="company-name">Night Forge Apparel</a></div>
                <div class="badges">Sample available · low MOQ · private label</div>
                <div class="pricing">MOQ 2 pieces · $12 - $19</div>
              </div>
              <div class="search-card search-card-3">
                <div class="thumb"><a href="/grid-product-c">View</a></div>
                <div class="content"><a href="/grid-product-c" class="title-link">Kitchen utensil holder rack</a></div>
                <div class="company-row"><a href="/supplier-grid-c" class="company-name">Domestic Home Utility</a></div>
                <div class="badges">general goods</div>
                <div class="pricing">MOQ 100 pieces · $3 - $6</div>
              </div>
            </div>
          </body>
        </html>
      `);
      return;
    }


    if (req.url === "/marketplace-json") {
      res.setHeader("content-type", "text/html");
      res.end(`
        <html>
          <body>
            <script type="application/json" id="market-data">
              {
                "items": [
                  {
                    "productTitle": "Techwear modular shell jacket",
                    "supplierName": "Apex Null Apparel",
                    "productUrl": "/json-product-a",
                    "price": "$28 - $41",
                    "moq": "MOQ 5 pieces",
                    "signals": ["OEM", "ODM", "custom"]
                  },
                  {
                    "productTitle": "Dark distressed hoodie",
                    "supplierName": "Night Process Garments",
                    "productUrl": "/json-product-b",
                    "price": "$14 - $22",
                    "moq": "MOQ 2 pieces",
                    "signals": ["sample available", "private label"]
                  },
                  {
                    "productTitle": "Kitchen ladle rack",
                    "supplierName": "Home Utility Depot",
                    "productUrl": "/json-product-c",
                    "price": "$3 - $6",
                    "moq": "MOQ 100 pieces"
                  }
                ]
              }
            </script>
          </body>
        </html>
      `);
      return;
    }
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
    if (req.url === '/supplier-a' || req.url === '/product-a') {
      res.setHeader('content-type', 'text/html');
      res.end('<html><head><title>Abyss Works</title></head><body><h1>Abyss Works</h1><p>OEM/ODM techwear jacket manufacturer. MOQ 20 pieces. Price $18 - $29.</p></body></html>');
      return;
    }
    if (req.url === '/supplier-b' || req.url === '/product-b') {
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

test.beforeEach(() => {
  resetDb();
});

test('health route returns ok', async () => {
  const server = await listen(createApp());
  const port = server.address().port;
  const res = await fetch(`http://127.0.0.1:${port}/api/health`);
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.ok, true);
  await stopServer(server);
});

test('manual capture creates one lead', async () => {
  const server = await listen(createApp());
  const port = server.address().port;

  const createRes = await fetch(`http://127.0.0.1:${port}/api/capture/manual`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      title: 'Manual Supplier',
      rawText: 'Dark techwear OEM manufacturer with MOQ 10 pieces and sample support.'
    })
  });
  const created = await createRes.json();
  assert.equal(createRes.status, 201);
  assert.equal(created.lead.title, 'Manual Supplier');

  const listRes = await fetch(`http://127.0.0.1:${port}/api/leads`);
  const listData = await listRes.json();
  assert.equal(listData.leads.length, 1);
  await stopServer(server);
});

test('full pipeline from search url creates extracted drafted leads', async () => {
  const fixtureServer = await startFixtureServer();
  const fixturePort = fixtureServer.address().port;
  const server = await listen(createApp());
  const port = server.address().port;

  const pipelineRes = await fetch(`http://127.0.0.1:${port}/api/pipeline/search`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ searchUrl: `http://127.0.0.1:${fixturePort}/search`, minFitScore: 50 })
  });
  const pipeline = await pipelineRes.json();
  assert.equal(pipelineRes.status, 201);
  assert.equal(pipeline.created, 2);
  assert.equal(pipeline.extractedCount, 2);
  assert.ok(pipeline.draftedCount >= 1);

  const listRes = await fetch(`http://127.0.0.1:${port}/api/leads`);
  const list = await listRes.json();
  assert.equal(list.leads.length, 2);
  assert.ok(list.leads.some((lead) => lead.status === 'draft_ready'));
  assert.ok(list.leads.some((lead) => /per-unit quote/i.test(lead?.drafts?.alibaba_opener || '')));

  await stopServer(server);
  await stopServer(fixtureServer);
});

test('full pipeline from pasted html works', async () => {
  const fixtureServer = await startFixtureServer();
  const fixturePort = fixtureServer.address().port;
  const server = await listen(createApp());
  const port = server.address().port;

  const htmlRes = await fetch(`http://127.0.0.1:${fixturePort}/search`);
  const html = await htmlRes.text();
  const res = await fetch(`http://127.0.0.1:${port}/api/pipeline/search-html`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ html, baseUrl: `http://127.0.0.1:${fixturePort}/search`, minFitScore: 50 })
  });
  const data = await res.json();
  assert.equal(res.status, 201);
  assert.equal(data.created, 2);
  assert.equal(data.extractedCount, 2);
  await stopServer(server);
  await stopServer(fixtureServer);
});

test('full pipeline from url list works and next draft ready returns one lead', async () => {
  const fixtureServer = await startFixtureServer();
  const fixturePort = fixtureServer.address().port;
  const server = await listen(createApp());
  const port = server.address().port;

  const res = await fetch(`http://127.0.0.1:${port}/api/pipeline/urls`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      urlsText: `http://127.0.0.1:${fixturePort}/supplier-a\nhttp://127.0.0.1:${fixturePort}/supplier-b`,
      minFitScore: 50
    })
  });
  const data = await res.json();
  assert.equal(res.status, 201);
  assert.equal(data.created, 2);

  const nextRes = await fetch(`http://127.0.0.1:${port}/api/leads/next-draft-ready`);
  const next = await nextRes.json();
  assert.equal(nextRes.status, 200);
  assert.ok(next.lead);
  assert.equal(next.lead.status, 'draft_ready');

  await stopServer(server);
  await stopServer(fixtureServer);
});



test('marketplace parser splits repeated cards into many leads and only drafts stronger fits', async () => {
  const fixtureServer = await startFixtureServer();
  const fixturePort = fixtureServer.address().port;
  const server = await listen(createApp());
  const port = server.address().port;

  const pipelineRes = await fetch(`http://127.0.0.1:${port}/api/pipeline/search`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ searchUrl: `http://127.0.0.1:${fixturePort}/marketplace`, minFitScore: 55 })
  });
  const pipeline = await pipelineRes.json();
  assert.equal(pipelineRes.status, 201);
  assert.equal(pipeline.created, 4);
  assert.equal(pipeline.extractedCount, 4);
  assert.ok(pipeline.draftedCount >= 3);

  const listRes = await fetch(`http://127.0.0.1:${port}/api/leads`);
  const list = await listRes.json();
  assert.equal(list.leads.length, 4);
  assert.ok(list.leads.some((lead) => /Techwear tactical shell jacket/i.test(lead.title)));
  assert.ok(list.leads.some((lead) => /Dark cyberpunk wash hoodie/i.test(lead.title)));
  const kitchenLead = list.leads.find((lead) => /Silicone kitchen sink rack/i.test(lead.title));
  assert.ok(kitchenLead);
  assert.equal(kitchenLead.drafts, null);
  assert.equal(kitchenLead.extracted.style_fit, 'bad_fit');

  await stopServer(server);
  await stopServer(fixtureServer);
});

test('mark contacted updates selected leads', async () => {
  const server = await listen(createApp());
  const port = server.address().port;

  const createRes = await fetch(`http://127.0.0.1:${port}/api/capture/manual`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ title: 'Patch Lead', rawText: 'Punk apparel supplier.' })
  });
  const created = await createRes.json();
  const id = created.lead.id;

  const markRes = await fetch(`http://127.0.0.1:${port}/api/leads/mark-contacted`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ ids: [id], channel: 'manual' })
  });
  const mark = await markRes.json();
  assert.equal(markRes.status, 200);
  assert.equal(mark.updatedCount, 1);
  assert.equal(mark.leads[0].status, 'contacted');

  await stopServer(server);
});

test('diagnostics and csv export both work', async () => {
  const fixtureServer = await startFixtureServer();
  const fixturePort = fixtureServer.address().port;
  const server = await listen(createApp());
  const port = server.address().port;

  const diagRes = await fetch(`http://127.0.0.1:${port}/api/diagnostics/url`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ url: `http://127.0.0.1:${fixturePort}/search` })
  });
  const diag = await diagRes.json();
  assert.equal(diagRes.status, 200);
  assert.equal(diag.report.ok, true);
  assert.equal(diag.report.candidateCount, 2);

  await fetch(`http://127.0.0.1:${port}/api/capture/manual`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ title: 'CSV Lead', rawText: 'Dark hoodie supplier' })
  });
  const exportRes = await fetch(`http://127.0.0.1:${port}/api/export.csv`);
  const csv = await exportRes.text();
  assert.match(csv, /CSV Lead/);

  await stopServer(server);
  await stopServer(fixtureServer);
});


test('parser handles repeated marketplace grid cards with multiple anchors per card', async () => {
  const fixtureServer = await startFixtureServer();
  const fixturePort = fixtureServer.address().port;
  const server = await listen(createApp());
  const port = server.address().port;

  const pipelineRes = await fetch(`http://127.0.0.1:${port}/api/pipeline/search`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ searchUrl: `http://127.0.0.1:${fixturePort}/marketplace-grid`, minFitScore: 55 })
  });
  const pipeline = await pipelineRes.json();
  assert.equal(pipelineRes.status, 201);
  assert.equal(pipeline.created, 3);
  assert.equal(pipeline.extractedCount, 3);
  assert.ok(pipeline.draftedCount >= 2);

  const listRes = await fetch(`http://127.0.0.1:${port}/api/leads`);
  const list = await listRes.json();
  assert.equal(list.leads.length, 3);
  assert.ok(list.leads.some((lead) => /Black Halo Garments|Techwear utility bomber jacket/i.test(`${lead.title} ${lead.rawText}`)));
  const kitchenLead = list.leads.find((lead) => /Kitchen utensil holder rack/i.test(lead.title));
  assert.ok(kitchenLead);
  assert.equal(kitchenLead.drafts, null);

  await stopServer(server);
  await stopServer(fixtureServer);
});


test('parser pulls candidates from embedded marketplace json blobs', async () => {
  const fixtureServer = await startFixtureServer();
  const fixturePort = fixtureServer.address().port;
  const server = await listen(createApp());
  const port = server.address().port;

  const pipelineRes = await fetch(`http://127.0.0.1:${port}/api/pipeline/search`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ searchUrl: `http://127.0.0.1:${fixturePort}/marketplace-json`, minFitScore: 55 })
  });
  const pipeline = await pipelineRes.json();
  assert.equal(pipelineRes.status, 201);
  assert.equal(pipeline.created, 3);
  assert.ok(pipeline.draftedCount >= 2);

  const listRes = await fetch(`http://127.0.0.1:${port}/api/leads`);
  const list = await listRes.json();
  assert.equal(list.leads.length, 3);
  assert.ok(list.leads.some((lead) => /Apex Null Apparel/i.test(lead.title)));
  const kitchenLead = list.leads.find((lead) => /Kitchen ladle rack/i.test(lead.title));
  assert.ok(kitchenLead);
  assert.equal(kitchenLead.drafts, null);

  await stopServer(server);
  await stopServer(fixtureServer);
});
