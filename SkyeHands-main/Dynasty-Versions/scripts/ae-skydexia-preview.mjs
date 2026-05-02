#!/usr/bin/env node
/**
 * ae-skydexia-preview.mjs
 *
 * AE agent entry point — screenshot an existing SkyeDexia project's artifacts.
 * Finds the artifacts dir for a given projectId, serves it locally, takes a
 * Puppeteer screenshot at 1440x900, saves preview.png alongside the artifacts.
 *
 * Usage:
 *   node ae-skydexia-preview.mjs <projectId>
 *   node ae-skydexia-preview.mjs <projectId> --via-worker   (delegate to worker /preview route)
 *
 * Env vars:
 *   SKYDEXIA_WORKER_URL    (default: http://localhost:4120)
 *   SKYDEXIA_WORKER_SECRET (optional bearer token)
 *   SKYE_ROOT              (optional — path to SkyeHands-main, inferred if not set)
 *
 * Stdout: JSON result  Exit: 0 success / 1 error
 */

import http from 'node:http';
import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const args       = process.argv.slice(2);
const projectId  = args.find(a => !a.startsWith('--'));
const viaWorker  = args.includes('--via-worker');

if (!projectId) {
  console.error('Usage: node ae-skydexia-preview.mjs <projectId> [--via-worker]');
  process.exit(1);
}

const workerUrl = (process.env.SKYDEXIA_WORKER_URL || 'http://localhost:4120').replace(/\/$/, '');
const secret    = process.env.SKYDEXIA_WORKER_SECRET || '';
const t0        = Date.now();

// ── Via-worker path ──────────────────────────────────────────────────────────

if (viaWorker) {
  const headers = { 'Content-Type': 'application/json' };
  if (secret) headers['x-worker-secret'] = secret;
  try {
    const res  = await fetch(`${workerUrl}/preview`, { method: 'POST', headers, body: JSON.stringify({ projectId }) });
    const data = await res.json();
    if (!res.ok) throw new Error(`Worker ${res.status}: ${data.error || JSON.stringify(data)}`);
    process.stdout.write(JSON.stringify({ ok: true, ms: Date.now() - t0, ...data }, null, 2) + '\n');
    process.exit(0);
  } catch (err) {
    process.stdout.write(JSON.stringify({ ok: false, error: String(err.message), ms: Date.now() - t0 }, null, 2) + '\n');
    process.exit(1);
  }
}

// ── Local Puppeteer path ─────────────────────────────────────────────────────

const SKYE_ROOT    = process.env.SKYE_ROOT || path.resolve(__dirname, '..', '..', 'SkyeHands-main');
const webcreatorDir = path.join(SKYE_ROOT, '.skyequanta', 'webcreator');
const artifactsDir  = path.join(webcreatorDir, 'projects', projectId, 'artifacts');

if (!fs.existsSync(artifactsDir)) {
  process.stdout.write(JSON.stringify({ ok: false, error: `Artifacts dir not found: ${artifactsDir}`, projectId }, null, 2) + '\n');
  process.exit(1);
}

let puppeteer;
try {
  puppeteer = (await import('puppeteer')).default;
} catch {
  process.stdout.write(JSON.stringify({ ok: false, error: 'puppeteer not installed — run: npx puppeteer browsers install chrome', projectId }, null, 2) + '\n');
  process.exit(1);
}

const port = 41000 + Math.floor(Math.random() * 10000);
const previewPath = path.join(artifactsDir, 'preview.png');

const server = http.createServer((req, res) => {
  const safeName = path.basename(req.url === '/' ? 'index.html' : req.url);
  const filePath = path.join(artifactsDir, safeName);
  try {
    const content = fs.readFileSync(filePath);
    const ext  = path.extname(safeName);
    const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' }[ext] || 'text/plain';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(content);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});

await new Promise((r) => server.listen(port, '127.0.0.1', r));

let browser;
try {
  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle0', timeout: 15000 })
    .catch(() => page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 10000 }));
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: previewPath, fullPage: false });

  const relPath = path.relative(SKYE_ROOT, previewPath);
  process.stdout.write(JSON.stringify({ ok: true, ms: Date.now() - t0, projectId, previewScreenshot: relPath }, null, 2) + '\n');
  process.exit(0);
} catch (err) {
  process.stdout.write(JSON.stringify({ ok: false, error: String(err.message), projectId, ms: Date.now() - t0 }, null, 2) + '\n');
  process.exit(1);
} finally {
  if (browser) await browser.close().catch(() => {});
  server.close();
}
