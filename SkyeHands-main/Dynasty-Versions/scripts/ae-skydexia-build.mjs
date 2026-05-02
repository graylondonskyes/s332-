#!/usr/bin/env node
/**
 * ae-skydexia-build.mjs
 *
 * AE agent entry point — trigger a full SkyeDexia website build.
 *
 * Usage:
 *   node ae-skydexia-build.mjs "Brief describing the website"
 *   node ae-skydexia-build.mjs "Brief" --name "My Site" --tenant myco --actor ae-brain
 *
 * Env vars:
 *   SKYDEXIA_WORKER_URL    (default: http://localhost:4120)
 *   SKYDEXIA_WORKER_SECRET (optional bearer token)
 *
 * Stdout: JSON result  Exit: 0 success / 1 error
 */

const args  = process.argv.slice(2);
const brief = args.find(a => !a.startsWith('--')) || '';
if (!brief.trim()) {
  console.error('Usage: node ae-skydexia-build.mjs "<brief>" [--name "..."] [--tenant "..."] [--actor "..."]');
  process.exit(1);
}

function flag(name) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
}

const workerUrl = (process.env.SKYDEXIA_WORKER_URL || 'http://localhost:4120').replace(/\/$/, '');
const secret    = process.env.SKYDEXIA_WORKER_SECRET || '';

const body = {
  brief: brief.trim(),
  name:     (flag('name') || brief).slice(0, 140),
  tenantId: flag('tenant') || 'ae-commandhub',
  actorId:  flag('actor')  || 'ae-brain',
};

const headers = { 'Content-Type': 'application/json' };
if (secret) headers['x-worker-secret'] = secret;

const t0 = Date.now();
try {
  const res  = await fetch(`${workerUrl}/build-website`, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(`Worker ${res.status}: ${data.error || JSON.stringify(data)}`);

  const out = {
    ok:                   true,
    ms:                   Date.now() - t0,
    projectId:            data.projectId,
    orchestratorProjectId:data.orchestratorProjectId,
    siteName:             data.siteName,
    qualityScore:         data.qualityScore,
    previewScreenshot:    data.previewScreenshot || null,
    artifactsDir:         data.artifactsDir,
    files:                data.files,
  };
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  process.exit(0);
} catch (err) {
  process.stdout.write(JSON.stringify({ ok: false, error: String(err.message), ms: Date.now() - t0 }, null, 2) + '\n');
  process.exit(1);
}
