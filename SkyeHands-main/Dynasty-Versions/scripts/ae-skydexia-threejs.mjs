#!/usr/bin/env node
/**
 * ae-skydexia-threejs.mjs
 *
 * AE agent entry point — build a website with Three.js forced on.
 * Forces has3D:true in the design brief regardless of the brief content.
 * Uses Three.js r169 CDN, WebGLRenderer alpha+antialias, pixel ratio,
 * resize listener, slow animation (0.0003x), max 3 meshes.
 *
 * Usage:
 *   node ae-skydexia-threejs.mjs "Brief describing the 3D experience"
 *   node ae-skydexia-threejs.mjs "Brief" --name "My 3D Site" --tenant myco
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
  console.error('Usage: node ae-skydexia-threejs.mjs "<brief>" [--name "..."] [--tenant "..."] [--actor "..."]');
  process.exit(1);
}

function flag(name) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
}

const workerUrl = (process.env.SKYDEXIA_WORKER_URL || 'http://localhost:4120').replace(/\/$/, '');
const secret    = process.env.SKYDEXIA_WORKER_SECRET || '';

const body = {
  brief:      brief.trim(),
  name:       (flag('name') || brief).slice(0, 140),
  tenantId:   flag('tenant') || 'ae-commandhub',
  actorId:    flag('actor')  || 'ae-brain',
  forceHas3D: true,
};

const headers = { 'Content-Type': 'application/json' };
if (secret) headers['x-worker-secret'] = secret;

const t0 = Date.now();
try {
  const res  = await fetch(`${workerUrl}/build-threejs`, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(`Worker ${res.status}: ${data.error || JSON.stringify(data)}`);

  const out = {
    ok:                   true,
    ms:                   Date.now() - t0,
    mode:                 'threejs',
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
  process.stdout.write(JSON.stringify({ ok: false, mode: 'threejs', error: String(err.message), ms: Date.now() - t0 }, null, 2) + '\n');
  process.exit(1);
}
