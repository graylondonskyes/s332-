'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { requireSkyGate } = require('./_lib/skygate-auth');

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const MUSIC_NEXUS_DIR =
  process.env.MUSIC_NEXUS_DATA_DIR || path.join(os.tmpdir(), 'skye-music-nexus');

function releasesFile() {
  return path.join(MUSIC_NEXUS_DIR, 'releases.json');
}

function ensureFile(filePath, defaultValue) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2) + '\n', 'utf8');
  }
}

function loadReleases() {
  const file = releasesFile();
  ensureFile(file, []);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function saveReleases(releases) {
  const file = releasesFile();
  ensureFile(file, []);
  fs.writeFileSync(file, JSON.stringify(releases, null, 2) + '\n', 'utf8');
}

function makeId() {
  return crypto.randomBytes(8).toString('hex');
}

function nowIso() {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// JSON response helper
// ---------------------------------------------------------------------------

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function parseBody(event) {
  try {
    return event.body ? JSON.parse(event.body) : {};
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Action: submit release
// ---------------------------------------------------------------------------

function handleSubmit(payload) {
  const { artistId, title, type, tracks, releaseDate, distributionTargets } = payload;

  if (!artistId || !title || !type) {
    return respond(400, { ok: false, error: 'artistId, title, and type are required' });
  }

  const validTypes = ['single', 'ep', 'album'];
  if (!validTypes.includes(type)) {
    return respond(400, { ok: false, error: `type must be one of: ${validTypes.join(', ')}` });
  }

  const releases = loadReleases();

  const release = {
    id: makeId(),
    artistId: String(artistId).trim(),
    title: String(title).trim(),
    type,
    tracks: Array.isArray(tracks)
      ? tracks.map((t) => ({
          title: String(t.title || '').trim(),
          duration: t.duration !== undefined ? t.duration : null,
        }))
      : [],
    releaseDate: releaseDate ? String(releaseDate) : null,
    distributionTargets: Array.isArray(distributionTargets) ? distributionTargets : [],
    status: 'submitted',
    analytics: { streams: 0, downloads: 0, saves: 0 },
    submittedAt: nowIso(),
    publishedAt: null,
  };

  releases.push(release);
  saveReleases(releases);

  return respond(201, { ok: true, release });
}

// ---------------------------------------------------------------------------
// Action: list releases
// ---------------------------------------------------------------------------

function handleList(params) {
  let releases = loadReleases();

  const artistId = params.artistId ? params.artistId.trim() : '';
  const status = params.status ? params.status.trim() : '';

  if (artistId) {
    releases = releases.filter((r) => r.artistId === artistId);
  }

  if (status) {
    releases = releases.filter((r) => r.status === status);
  }

  return respond(200, { ok: true, releases, total: releases.length });
}

// ---------------------------------------------------------------------------
// Action: get release
// ---------------------------------------------------------------------------

function handleGet(params) {
  const { id } = params;
  if (!id) {
    return respond(400, { ok: false, error: 'id is required' });
  }

  const releases = loadReleases();
  const release = releases.find((r) => r.id === id);
  if (!release) {
    return respond(404, { ok: false, error: 'Release not found' });
  }

  return respond(200, { ok: true, release });
}

// ---------------------------------------------------------------------------
// Action: review release
// ---------------------------------------------------------------------------

function handleReview(payload, params) {
  const id = (payload && payload.id) || (params && params.id);
  const decision = (payload && payload.decision) || (params && params.decision);
  const notes = (payload && payload.notes) || '';

  if (!id) {
    return respond(400, { ok: false, error: 'id is required' });
  }

  if (!decision || !['approve', 'reject'].includes(decision)) {
    return respond(400, { ok: false, error: 'decision must be "approve" or "reject"' });
  }

  const releases = loadReleases();
  const idx = releases.findIndex((r) => r.id === id);
  if (idx === -1) {
    return respond(404, { ok: false, error: 'Release not found' });
  }

  releases[idx].status = decision === 'approve' ? 'approved' : 'rejected';
  releases[idx].reviewNotes = notes ? String(notes) : '';
  releases[idx].reviewedAt = nowIso();

  saveReleases(releases);

  return respond(200, { ok: true, release: releases[idx] });
}

// ---------------------------------------------------------------------------
// Action: publish release
// ---------------------------------------------------------------------------

function handlePublish(payload, params) {
  const id = (payload && payload.id) || (params && params.id);

  if (!id) {
    return respond(400, { ok: false, error: 'id is required' });
  }

  const releases = loadReleases();
  const idx = releases.findIndex((r) => r.id === id);
  if (idx === -1) {
    return respond(404, { ok: false, error: 'Release not found' });
  }

  if (releases[idx].status !== 'approved') {
    return respond(409, {
      ok: false,
      error: `Release must be in "approved" status before publishing (current: "${releases[idx].status}")`,
    });
  }

  releases[idx].status = 'live';
  releases[idx].publishedAt = nowIso();

  saveReleases(releases);

  return respond(200, { ok: true, release: releases[idx] });
}

// ---------------------------------------------------------------------------
// Action: report-streams
// ---------------------------------------------------------------------------

function handleReportStreams(payload, params) {
  const id = (payload && payload.id) || (params && params.id);

  if (!id) {
    return respond(400, { ok: false, error: 'id is required' });
  }

  const releases = loadReleases();
  const idx = releases.findIndex((r) => r.id === id);
  if (idx === -1) {
    return respond(404, { ok: false, error: 'Release not found' });
  }

  const { streams, downloads, saves } = payload || {};

  const analytics = releases[idx].analytics || { streams: 0, downloads: 0, saves: 0 };

  if (streams !== undefined && !isNaN(Number(streams))) {
    analytics.streams = (analytics.streams || 0) + Number(streams);
  }
  if (downloads !== undefined && !isNaN(Number(downloads))) {
    analytics.downloads = (analytics.downloads || 0) + Number(downloads);
  }
  if (saves !== undefined && !isNaN(Number(saves))) {
    analytics.saves = (analytics.saves || 0) + Number(saves);
  }

  releases[idx].analytics = analytics;
  releases[idx].lastStreamReport = nowIso();

  saveReleases(releases);

  return respond(200, { ok: true, release: releases[idx] });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

module.exports.handler = async (event) => {
  try {
    const method = (event.httpMethod || 'GET').toUpperCase();
    const params = event.queryStringParameters || {};

    if (method === 'GET') {
      const action = params.action || 'list';
      if (action === 'list') return handleList(params);
      if (action === 'get') return handleGet(params);
      return respond(400, { ok: false, error: `Unknown GET action: ${action}` });
    }

    if (method === 'POST') {
      const denied = requireSkyGate(event);
      if (denied) return denied;
      const payload = parseBody(event);
      if (payload === null) {
        return respond(400, { ok: false, error: 'Invalid JSON body' });
      }
      const action = payload.action || params.action || '';
      if (action === 'submit') return handleSubmit(payload);
      if (action === 'review') return handleReview(payload, params);
      if (action === 'publish') return handlePublish(payload, params);
      if (action === 'report-streams') return handleReportStreams(payload, params);
      return respond(400, { ok: false, error: `Unknown POST action: ${action}` });
    }

    return respond(405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    return respond(500, { ok: false, error: err.message || 'Internal server error' });
  }
};
