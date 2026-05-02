#!/usr/bin/env node
/**
 * ae-skydexia-status.mjs
 *
 * AE agent entry point — check SkyeDexia worker health and provider availability.
 * Hits /health for liveness then /status for full provider + recent project info.
 * AE agents should call this before dispatching long builds to fail fast.
 *
 * Usage:
 *   node ae-skydexia-status.mjs
 *   node ae-skydexia-status.mjs --health-only
 *
 * Env vars:
 *   SKYDEXIA_WORKER_URL    (default: http://localhost:4120)
 *   SKYDEXIA_WORKER_SECRET (optional bearer token)
 *
 * Stdout: JSON result  Exit: 0 worker reachable / 1 unreachable
 */

const args       = process.argv.slice(2);
const healthOnly = args.includes('--health-only');
const workerUrl  = (process.env.SKYDEXIA_WORKER_URL || 'http://localhost:4120').replace(/\/$/, '');
const secret     = process.env.SKYDEXIA_WORKER_SECRET || '';

const headers = {};
if (secret) headers['x-worker-secret'] = secret;

async function probe(endpoint) {
  const res  = await fetch(`${workerUrl}${endpoint}`, { headers, signal: AbortSignal.timeout(8000) });
  const data = await res.json();
  if (!res.ok) throw new Error(`${endpoint} ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

const t0 = Date.now();
try {
  const health = await probe('/health');
  let status   = null;
  if (!healthOnly) {
    try { status = await probe('/status'); } catch { /* non-fatal */ }
  }

  const out = {
    ok:             true,
    ms:             Date.now() - t0,
    workerUrl,
    uptime:         health.uptime,
    startedAt:      health.startedAt,
    providers:      status?.providers   || null,
    recentProjects: status?.recentProjects?.slice(-5) || null,
  };
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  process.exit(0);
} catch (err) {
  process.stdout.write(JSON.stringify({ ok: false, workerUrl, error: String(err.message), ms: Date.now() - t0 }, null, 2) + '\n');
  process.exit(1);
}
