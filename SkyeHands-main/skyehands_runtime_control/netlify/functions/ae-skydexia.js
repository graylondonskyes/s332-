/**
 * ae-skydexia.js — AE → SkyeDexia Worker Bridge
 *
 * Netlify function that lets AE brain agents trigger SkyeDexia website builds,
 * check worker health, take previews, and drain the bus queue.
 *
 * Routes (POST body: { action, ...params }):
 *   action: 'build'    → POST /build-website  { brief, name, tenantId, actorId }
 *   action: 'threejs'  → POST /build-threejs   { brief, name }
 *   action: 'preview'  → POST /preview         { projectId }
 *   action: 'health'   → GET  /health
 *   action: 'status'   → GET  /status
 *   action: 'drain'    → POST /queue/drain
 *
 * Auth: passes SKYDEXIA_WORKER_SECRET from env to worker x-worker-secret header.
 * Dry-run: if SKYDEXIA_WORKER_URL is unset, returns a dry-run manifest so AE brains
 *   are never blocked by a downed worker.
 */

'use strict';

const WORKER_URL = (process.env.SKYDEXIA_WORKER_URL || '').replace(/\/$/, '');
const WORKER_SECRET = process.env.SKYDEXIA_WORKER_SECRET || '';

function json(code, payload) {
  return {
    statusCode: code,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    body: JSON.stringify(payload),
  };
}

function parseBody(event) {
  try { return JSON.parse(event.body || '{}'); } catch { return {}; }
}

function workerHeaders(extra = {}) {
  const h = { 'content-type': 'application/json', ...extra };
  if (WORKER_SECRET) h['x-worker-secret'] = WORKER_SECRET;
  return h;
}

async function workerGet(path) {
  const res = await fetch(`${WORKER_URL}${path}`, {
    headers: workerHeaders(),
    signal: AbortSignal.timeout(12000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Worker ${res.status}: ${data.error || JSON.stringify(data)}`);
  return data;
}

async function workerPost(path, body) {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method: 'POST',
    headers: workerHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Worker ${res.status}: ${data.error || JSON.stringify(data)}`);
  return data;
}

function dryRunManifest(action, params) {
  const id = `wcr-dryrun-${Date.now().toString(36)}`;
  const base = {
    ok: true,
    dryRun: true,
    reason: 'SKYDEXIA_WORKER_URL not set',
    projectId: id,
    orchestratorProjectId: `${id}-orch`,
    siteName: params.name || params.brief?.slice(0, 60) || 'Dry Run Site',
    qualityScore: 90,
    files: ['index.html', 'styles.css', 'app.js', 'README.md'],
    artifactsDir: `.skyequanta/webcreator/projects/${id}/artifacts`,
    previewScreenshot: null,
    mode: action === 'threejs' ? 'threejs' : 'standard',
  };
  if (action === 'health') return { ok: true, dryRun: true, service: 'skydexia-webcreator-worker', uptime: 0 };
  if (action === 'status') return { ok: true, dryRun: true, projects: [], totalProjects: 0 };
  if (action === 'preview') return { ok: true, dryRun: true, projectId: params.projectId, previewScreenshot: null };
  if (action === 'drain')   return { ok: true, dryRun: true, processed: 0 };
  return base;
}

module.exports.handler = async (event = {}) => {
  const method = (event.httpMethod || 'POST').toUpperCase();
  if (method === 'OPTIONS') return json(204, {});
  if (method !== 'POST' && method !== 'GET') return json(405, { ok: false, error: 'method_not_allowed' });

  const body   = parseBody(event);
  const action = String(body.action || event.queryStringParameters?.action || 'health').toLowerCase();
  const t0     = Date.now();

  // If worker URL is not configured → dry-run mode so AE brains are never blocked
  if (!WORKER_URL) {
    const manifest = dryRunManifest(action, body);
    return json(200, { ...manifest, ms: Date.now() - t0 });
  }

  try {
    let result;

    switch (action) {
      case 'build':
        result = await workerPost('/build-website', {
          brief:    body.brief,
          name:     body.name,
          tenantId: body.tenantId || 'ae-commandhub',
          actorId:  body.actorId  || 'ae-brain',
          audience: body.audience || null,
        });
        break;

      case 'threejs':
        result = await workerPost('/build-threejs', {
          brief:    body.brief,
          name:     body.name,
          tenantId: body.tenantId || 'ae-commandhub',
          actorId:  body.actorId  || 'ae-brain',
        });
        break;

      case 'preview':
        if (!body.projectId) return json(400, { ok: false, error: 'projectId required for preview' });
        result = await workerPost('/preview', { projectId: body.projectId });
        break;

      case 'health':
        result = await workerGet('/health');
        break;

      case 'status':
        result = await workerGet('/status');
        break;

      case 'drain':
        result = await workerPost('/queue/drain', {});
        break;

      default:
        return json(400, { ok: false, error: `Unknown action: ${action}. Valid: build, threejs, preview, health, status, drain` });
    }

    return json(200, { ...result, ms: Date.now() - t0 });

  } catch (err) {
    return json(502, {
      ok:     false,
      error:  `SkyeDexia worker unreachable: ${err.message}`,
      action,
      ms:     Date.now() - t0,
      workerUrl: WORKER_URL,
    });
  }
};
