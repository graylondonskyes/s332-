'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const MUSIC_NEXUS_DIR =
  process.env.MUSIC_NEXUS_DATA_DIR || path.join(os.tmpdir(), 'skye-music-nexus');

function ensureFile(filePath, defaultValue) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2) + '\n', 'utf8');
  }
}

function loadFile(filePath) {
  ensureFile(filePath, []);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return [];
  }
}

function loadArtists() {
  return loadFile(path.join(MUSIC_NEXUS_DIR, 'artists.json'));
}

function loadReleases() {
  return loadFile(path.join(MUSIC_NEXUS_DIR, 'releases.json'));
}

function loadPayouts() {
  return loadFile(path.join(MUSIC_NEXUS_DIR, 'payouts.json'));
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

// ---------------------------------------------------------------------------
// Build analytics summary
// ---------------------------------------------------------------------------

function buildAnalytics() {
  const artists = loadArtists();
  const releases = loadReleases();
  const payouts = loadPayouts();

  const totalArtists = artists.length;
  const activeArtists = artists.filter((a) => a.status === 'active').length;

  const totalReleases = releases.length;
  const liveReleases = releases.filter((r) => r.status === 'live').length;

  // Compute per-artist stream totals (needed for topArtists)
  const artistStreamMap = {};
  for (const artist of artists) {
    artistStreamMap[artist.id] = 0;
  }

  let totalStreams = 0;
  for (const release of releases) {
    const streams = (release.analytics && Number(release.analytics.streams)) || 0;
    totalStreams += streams;
    if (artistStreamMap[release.artistId] !== undefined) {
      artistStreamMap[release.artistId] += streams;
    } else {
      artistStreamMap[release.artistId] = streams;
    }
  }

  // Top 5 artists by streams
  const topArtists = artists
    .map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      streams: artistStreamMap[a.id] || 0,
    }))
    .sort((a, b) => b.streams - a.streams)
    .slice(0, 5);

  // Top 5 releases by streams
  const topReleases = releases
    .map((r) => ({
      id: r.id,
      artistId: r.artistId,
      title: r.title,
      type: r.type,
      status: r.status,
      streams: (r.analytics && Number(r.analytics.streams)) || 0,
    }))
    .sort((a, b) => b.streams - a.streams)
    .slice(0, 5);

  // Pending payouts
  const pendingPayoutsList = payouts.filter((p) => p.status === 'pending');
  const pendingPayouts = pendingPayoutsList.length;
  const totalPayoutAmount = pendingPayoutsList.reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0
  );

  return {
    totalArtists,
    activeArtists,
    totalReleases,
    liveReleases,
    totalStreams,
    topArtists,
    topReleases,
    pendingPayouts,
    totalPayoutAmount,
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

module.exports.handler = async (event) => {
  try {
    const method = (event.httpMethod || 'GET').toUpperCase();

    if (method !== 'GET') {
      return respond(405, { ok: false, error: 'Method not allowed' });
    }

    const analytics = buildAnalytics();

    return respond(200, { ok: true, ...analytics });
  } catch (err) {
    return respond(500, { ok: false, error: err.message || 'Internal server error' });
  }
};
