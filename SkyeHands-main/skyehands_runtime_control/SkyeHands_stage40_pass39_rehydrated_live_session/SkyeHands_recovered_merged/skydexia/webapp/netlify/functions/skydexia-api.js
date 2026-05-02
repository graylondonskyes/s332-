'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SKYDEXIA_ROOT = path.resolve(__dirname, '../../../../');
const PROJECTS_DIR = path.join(SKYDEXIA_ROOT, 'generated-projects');
const DONORS_DIR = path.join(SKYDEXIA_ROOT, 'donors');
const PROOFS_DIR = path.join(SKYDEXIA_ROOT, 'proofs');
const PROVENANCE_DIR = path.join(SKYDEXIA_ROOT, 'provenance');
const REGISTRY_FILE = path.join(DONORS_DIR, 'ingestion-registry.json');
const ALERTS_DIR = path.join(SKYDEXIA_ROOT, 'alerts');

function readJson(p, fallback = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function listDir(dir) {
  try { return fs.readdirSync(dir); } catch { return []; }
}

function respond(code, body) {
  return {
    statusCode: code,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  const qs = event.queryStringParameters || {};
  const action = qs.action || (event.httpMethod === 'POST' ? (JSON.parse(event.body || '{}').action) : 'overview');

  // ── GET overview ───────────────────────────────────────────────────────────
  if (action === 'overview') {
    const projects = listDir(PROJECTS_DIR).map(name => {
      const dir = path.join(PROJECTS_DIR, name);
      const manifest = readJson(path.join(dir, 'manifest.json')) || readJson(path.join(dir, 'skydexia-manifest.json')) || {};
      const files = (() => { try { return fs.readdirSync(dir).length; } catch { return 0; } })();
      return { name, status: manifest.status || 'complete', createdAt: manifest.createdAt, files };
    });

    const donors = readJson(REGISTRY_FILE, { donors: [] });
    const alerts = listDir(ALERTS_DIR).filter(f => f.endsWith('.json')).map(f => {
      return readJson(path.join(ALERTS_DIR, f), {});
    }).filter(Boolean);

    const proofs = listDir(PROOFS_DIR).filter(f => f.endsWith('.json')).length;
    const provenance = listDir(PROVENANCE_DIR).filter(f => f.endsWith('.json')).length;

    return respond(200, {
      projects,
      projectCount: projects.length,
      donorCount: (donors.donors || []).length,
      alertCount: alerts.length,
      proofCount: proofs,
      provenanceEntries: provenance,
    });
  }

  // ── GET projects list ──────────────────────────────────────────────────────
  if (action === 'projects') {
    const projects = listDir(PROJECTS_DIR).map(name => {
      const dir = path.join(PROJECTS_DIR, name);
      const manifest = readJson(path.join(dir, 'manifest.json')) ||
                       readJson(path.join(dir, 'skydexia-manifest.json')) || {};
      const scripts = listDir(path.join(dir, 'scripts'));
      const filePaths = (() => {
        try { return fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isFile()).map(e => e.name); } catch { return []; }
      })();
      return { name, manifest, scripts, files: filePaths };
    });
    return respond(200, { projects });
  }

  // ── GET donors ─────────────────────────────────────────────────────────────
  if (action === 'donors') {
    const registry = readJson(REGISTRY_FILE, { donors: [] });
    const normalized = (() => {
      try { return fs.readdirSync(path.join(DONORS_DIR, 'normalized')).filter(f => f.endsWith('.json')); } catch { return []; }
    })();
    return respond(200, { donors: registry.donors || [], normalizedCount: normalized.length });
  }

  // ── GET proofs ─────────────────────────────────────────────────────────────
  if (action === 'proofs') {
    const files = listDir(PROOFS_DIR).filter(f => f.endsWith('.json'));
    const proofs = files.map(f => {
      const data = readJson(path.join(PROOFS_DIR, f), {});
      return { file: f, ...data };
    });
    return respond(200, { proofs });
  }

  // ── GET provenance ─────────────────────────────────────────────────────────
  if (action === 'provenance') {
    const files = listDir(PROVENANCE_DIR).filter(f => f.endsWith('.json')).slice(0, 50);
    const entries = files.map(f => readJson(path.join(PROVENANCE_DIR, f), {}));
    return respond(200, { entries });
  }

  // ── GET alerts ─────────────────────────────────────────────────────────────
  if (action === 'alerts') {
    const files = listDir(ALERTS_DIR).filter(f => f.endsWith('.json'));
    const alerts = files.map(f => ({ file: f, ...readJson(path.join(ALERTS_DIR, f), {}) }));
    return respond(200, { alerts });
  }

  // ── POST run generate ─────────────────────────────────────────────────────
  if (action === 'generate' && event.httpMethod === 'POST') {
    const body = JSON.parse(event.body || '{}');
    const { projectId, dryRun = true } = body;
    if (!projectId) return respond(400, { error: 'projectId required' });
    const result = spawnSync('node', [
      path.join(SKYDEXIA_ROOT, 'skydexia-generate.mjs'),
      projectId, dryRun ? '--dry-run' : '',
    ].filter(Boolean), {
      cwd: SKYDEXIA_ROOT,
      encoding: 'utf8',
      timeout: 60000,
      env: { ...process.env },
    });
    return respond(200, {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.status,
      projectId,
      dryRun,
    });
  }

  // ── POST run ingest ───────────────────────────────────────────────────────
  if (action === 'ingest' && event.httpMethod === 'POST') {
    const body = JSON.parse(event.body || '{}');
    const { donorId } = body;
    const result = spawnSync('node', [
      path.join(SKYDEXIA_ROOT, 'skydexia-ingest.mjs'),
      donorId || '',
    ].filter(Boolean), {
      cwd: SKYDEXIA_ROOT,
      encoding: 'utf8',
      timeout: 60000,
    });
    return respond(200, { stdout: result.stdout, stderr: result.stderr, exitCode: result.status });
  }

  return respond(400, { error: `Unknown action: ${action}` });
};
