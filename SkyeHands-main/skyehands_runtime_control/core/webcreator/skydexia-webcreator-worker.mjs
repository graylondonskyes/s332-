#!/usr/bin/env node
/**
 * SkyeDexia WebCreator Worker
 *
 * Long-running HTTP worker that bridges AE CommandHub → SkyeDexia → SkyeWebCreatorMax.
 *
 * An AE agent posts a website brief here. This worker:
 *   1. Registers the project on the platform bus (requestWebCreatorProject)
 *   2. Runs the full SkyeDexia 5-step AI pipeline (buildWebsite)
 *   3. Persists artifacts and fires delivery events (persistGeneratedWebCreatorArtifact)
 *   4. Returns the artifact to the caller
 *
 * Port:   SKYDEXIA_WORKER_PORT   (default 4120)
 * Auth:   SKYDEXIA_WORKER_SECRET (bearer token, required when set)
 *
 * Routes:
 *   GET  /health              — liveness + uptime
 *   GET  /status              — provider health + recent projects
 *   POST /build-website       — body: {name, brief, tenantId?, actorId?, audience?}
 *   POST /queue/drain         — process pending bus-queue webcreator.project.requested events
 */

import http     from 'node:http';
import fs       from 'node:fs';
import path     from 'node:path';
import crypto   from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  requestWebCreatorProject,
  persistGeneratedWebCreatorArtifact,
  listWebCreatorProjects,
  getWebCreatorRuntimePaths,
} from './skyewebcreator-bridge.mjs';

import {
  buildWebsite,
  showStatus,
} from '../../../AbovetheSkye-Platforms/SkyDexia/skydexia-orchestrator.mjs';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME_ROOT = path.resolve(__dirname, '../..');
const BUS_QUEUE   = path.join(RUNTIME_ROOT, '.skyequanta', 'bus-queue');

const PORT   = Number(process.env.SKYDEXIA_WORKER_PORT || 4120);
const SECRET = String(process.env.SKYDEXIA_WORKER_SECRET || '');

const STARTED_AT = new Date().toISOString();

// ─────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────

function isAuthorized(req) {
  if (!SECRET) return true;
  const header = req.headers['authorization'] || req.headers['x-worker-secret'] || '';
  const token  = header.replace(/^Bearer\s+/i, '').trim();
  const tokenBuffer = Buffer.from(token);
  const secretBuffer = Buffer.from(SECRET);
  return tokenBuffer.length === secretBuffer.length && crypto.timingSafeEqual(tokenBuffer, secretBuffer);
}

// ─────────────────────────────────────────────────────
// HTTP HELPERS
// ─────────────────────────────────────────────────────

function sendJSON(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function log(msg) {
  process.stderr.write(`[skydexia-worker] ${msg}\n`);
}

// ─────────────────────────────────────────────────────
// CORE BUILD HANDLER
// Registers the project on the bus, runs the orchestrator
// pipeline, then fires delivery events.
// ─────────────────────────────────────────────────────

async function handleBuildWebsite(body) {
  const { name, brief, tenantId, actorId, audience, forceHas3D } = body;

  if (!brief || typeof brief !== 'string' || !brief.trim()) {
    return { status: 400, payload: { ok: false, error: 'brief is required' } };
  }

  const siteName = (name || brief.slice(0, 60)).trim();
  log(`build-website → name:"${siteName}" brief:"${brief.slice(0, 80)}..."`);

  // Step A: register on the bridge / platform bus so AE knows a job started
  let bridgeResult;
  try {
    bridgeResult = await requestWebCreatorProject({
      name: siteName,
      brief,
      audience: audience || null,
      tenantId: tenantId || 'ae-commandhub',
      actorId:  actorId  || 'ae-brain',
      deliveryTarget: 'ae-commandhub',
    });
    log(`bridge project registered: ${bridgeResult.projectId}`);
  } catch (err) {
    log(`bridge registration failed (non-fatal): ${err.message}`);
    bridgeResult = { ok: false, projectId: null };
  }

  const bridgeProjectId = bridgeResult.projectId;

  // Step B: run the full SkyeDexia 6-step AI pipeline
  const enrichedBrief = forceHas3D
    ? `${brief.trim()} [THREEJS_REQUIRED: use Three.js r169 CDN with particle field or floating geometry background]`
    : brief;
  let projectManifest;
  try {
    projectManifest = await buildWebsite(enrichedBrief);
    log(`orchestrator done: ${projectManifest.id} | score:${projectManifest.qualityResult?.score}`);
  } catch (err) {
    log(`buildWebsite failed: ${err.message}`);
    return { status: 500, payload: { ok: false, error: `Build failed: ${err.message}`, bridgeProjectId } };
  }

  // Step C: persist via bridge so platform bus events fire (app.generated, delivery.queued)
  const fileList = (projectManifest.artifacts || []).map((filename) => ({
    filename,
    path: path.join(projectManifest.artifactsDir, filename),
    kind: filename.endsWith('.html') ? 'html'
        : filename.endsWith('.css')  ? 'css'
        : filename.endsWith('.js')   ? 'js'
        : 'text',
  }));

  let deliveryResult = { ok: false, artifactId: null, appGeneratedEventId: null };
  if (bridgeProjectId) {
    try {
      deliveryResult = await persistGeneratedWebCreatorArtifact(
        bridgeProjectId,
        {
          kind:  'website-package',
          title: projectManifest.siteName,
          files: fileList,
        },
        {
          actorId:        'skydexia',
          sourcePlatform: 'skydexia',
          status:         'generated',
        }
      );
      log(`delivery events fired: artifactId:${deliveryResult.artifactId}`);
    } catch (err) {
      log(`persistGeneratedWebCreatorArtifact failed (non-fatal): ${err.message}`);
    }
  }

  return {
    status: 200,
    payload: {
      ok: true,
      projectId:             bridgeProjectId,
      orchestratorProjectId: projectManifest.id,
      artifactId:            deliveryResult.artifactId,
      appGeneratedEventId:   deliveryResult.appGeneratedEventId || null,
      siteName:              projectManifest.siteName,
      qualityScore:          projectManifest.qualityResult?.score ?? null,
      previewScreenshot:     projectManifest.previewScreenshot || null,
      files:                 projectManifest.artifacts,
      artifactsDir:          projectManifest.artifactsDir,
      requestEventId:        bridgeResult.requestEventId || null,
    },
  };
}

// ─────────────────────────────────────────────────────
// PREVIEW HANDLER
// Serves existing artifacts locally, screenshots with Puppeteer.
// ─────────────────────────────────────────────────────

async function handlePreview(projectId) {
  const runtimePaths  = getWebCreatorRuntimePaths();
  const artifactsDir  = path.join(runtimePaths.projectsDir, projectId, 'artifacts');

  if (!fs.existsSync(artifactsDir)) {
    return { status: 404, payload: { ok: false, error: `Artifacts not found for project: ${projectId}` } };
  }

  let puppeteer;
  try { puppeteer = (await import('puppeteer')).default; }
  catch {
    log(`preview: puppeteer not installed — skipping screenshot for ${projectId}`);
    return { status: 200, payload: { ok: true, projectId, previewScreenshot: null, skipped: 'puppeteer not installed' } };
  }

  const port        = 42000 + Math.floor(Math.random() * 8000);
  const previewPath = path.join(artifactsDir, 'preview.png');

  const srv = http.createServer((req, res) => {
    const safeName = path.basename(req.url === '/' ? 'index.html' : req.url);
    const fp = path.join(artifactsDir, safeName);
    try {
      const content = fs.readFileSync(fp);
      const ext  = path.extname(safeName);
      const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' }[ext] || 'text/plain';
      res.writeHead(200, { 'Content-Type': mime }); res.end(content);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  await new Promise((r) => srv.listen(port, '127.0.0.1', r));

  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle0', timeout: 15000 })
      .catch(() => page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 10000 }));
    await new Promise((r) => setTimeout(r, 1200));
    await page.screenshot({ path: previewPath, fullPage: false });
    const relPath = path.relative(RUNTIME_ROOT, previewPath);
    log(`preview saved: ${relPath}`);
    return { status: 200, payload: { ok: true, projectId, previewScreenshot: relPath } };
  } catch (err) {
    log(`preview screenshot failed: ${err.message}`);
    return { status: 500, payload: { ok: false, error: err.message, projectId } };
  } finally {
    if (browser) await browser.close().catch(() => {});
    srv.close();
  }
}

// ─────────────────────────────────────────────────────
// QUEUE DRAIN
// Processes pending bus-queue webcreator.project.requested events.
// ─────────────────────────────────────────────────────

async function handleQueueDrain() {
  if (!fs.existsSync(BUS_QUEUE)) {
    return { status: 200, payload: { ok: true, processed: 0, message: 'bus queue empty' } };
  }

  const files = fs.readdirSync(BUS_QUEUE).filter((f) => f.endsWith('.json'));
  const results = [];

  for (const file of files) {
    const filePath = path.join(BUS_QUEUE, file);
    let envelope;
    try {
      envelope = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      continue;
    }

    if (envelope.eventType !== 'webcreator.project.requested') continue;

    const { brief, name } = envelope.payload || {};
    if (!brief) continue;

    log(`draining queued event ${envelope.eventId} — brief:"${brief.slice(0, 60)}"`);
    try {
      const { payload } = await handleBuildWebsite({ brief, name });
      results.push({ eventId: envelope.eventId, ok: payload.ok, projectId: payload.projectId });
      fs.unlinkSync(filePath);
    } catch (err) {
      results.push({ eventId: envelope.eventId, ok: false, error: err.message });
    }
  }

  return { status: 200, payload: { ok: true, processed: results.length, results } };
}

// ─────────────────────────────────────────────────────
// HTTP SERVER
// ─────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url    = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method?.toUpperCase();

  // Auth check on every route except /health
  if (url.pathname !== '/health' && !isAuthorized(req)) {
    return sendJSON(res, 401, { ok: false, error: 'unauthorized' });
  }

  // GET /health
  if (method === 'GET' && url.pathname === '/health') {
    return sendJSON(res, 200, {
      ok:      true,
      service: 'skydexia-webcreator-worker',
      version: '1.0.0',
      uptime:  Math.floor((Date.now() - new Date(STARTED_AT).getTime()) / 1000),
      startedAt: STARTED_AT,
    });
  }

  // GET /status
  if (method === 'GET' && url.pathname === '/status') {
    const projects = listWebCreatorProjects();
    const paths    = getWebCreatorRuntimePaths();
    const providers = {
      anthropic:  !!process.env.ANTHROPIC_API_KEY,
      openai:     !!process.env.OPENAI_API_KEY,
      groq:       !!process.env.GROQ_API_KEY,
      deepseek:   !!process.env.DEEPSEEK_API_KEY,
      openrouter: !!process.env.OPENROUTER_API_KEY,
      mistral:    !!process.env.MISTRAL_API_KEY,
      perplexity: !!process.env.PERPLEXITY_API_KEY,
    };
    const availableProviders = Object.entries(providers).filter(([,v])=>v).map(([k])=>k);
    const mode = availableProviders.length === 0 ? 'template-only' : 'ai+template';
    return sendJSON(res, 200, {
      ok:            true,
      mode,
      providers,
      availableProviders,
      projects:      projects.slice(-10),
      totalProjects: projects.length,
      runtimePaths:  paths,
    });
  }

  // POST /build-website
  if (method === 'POST' && url.pathname === '/build-website') {
    const body = await readBody(req);
    const { status, payload } = await handleBuildWebsite(body);
    return sendJSON(res, status, payload);
  }

  // POST /build-threejs — full build with has3D forced true
  if (method === 'POST' && url.pathname === '/build-threejs') {
    const body = await readBody(req);
    body.forceHas3D = true;
    const { status, payload } = await handleBuildWebsite(body);
    return sendJSON(res, status, { ...payload, mode: 'threejs' });
  }

  // POST /preview — screenshot existing project artifacts with Puppeteer
  if (method === 'POST' && url.pathname === '/preview') {
    const { projectId } = await readBody(req);
    if (!projectId) return sendJSON(res, 400, { ok: false, error: 'projectId is required' });
    const { status, payload } = await handlePreview(projectId);
    return sendJSON(res, status, payload);
  }

  // POST /queue/drain
  if (method === 'POST' && url.pathname === '/queue/drain') {
    const { status, payload } = await handleQueueDrain();
    return sendJSON(res, status, payload);
  }

  // 404
  sendJSON(res, 404, { ok: false, error: `Unknown route: ${method} ${url.pathname}` });
});

server.listen(PORT, '127.0.0.1', () => {
  log(`listening on http://127.0.0.1:${PORT}`);
  log(`auth: ${SECRET ? 'enabled (SKYDEXIA_WORKER_SECRET set)' : 'disabled (no secret — set one for production)'}`);
  log('routes: GET /health  GET /status  POST /build-website  POST /build-threejs  POST /preview  POST /queue/drain');
});

server.on('error', (err) => {
  log(`server error: ${err.message}`);
  process.exit(1);
});

process.on('SIGTERM', () => { log('SIGTERM received — shutting down'); server.close(() => process.exit(0)); });
process.on('SIGINT',  () => { log('SIGINT received — shutting down');  server.close(() => process.exit(0)); });
