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

function artistsFile() {
  return path.join(MUSIC_NEXUS_DIR, 'artists.json');
}

function releasesFile() {
  return path.join(MUSIC_NEXUS_DIR, 'releases.json');
}

function ensureFile(filePath, defaultValue) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2) + '\n', 'utf8');
  }
}

function loadArtists() {
  const file = artistsFile();
  ensureFile(file, []);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function saveArtists(artists) {
  const file = artistsFile();
  ensureFile(file, []);
  fs.writeFileSync(file, JSON.stringify(artists, null, 2) + '\n', 'utf8');
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

// ---------------------------------------------------------------------------
// Parse body helper
// ---------------------------------------------------------------------------

function parseBody(event) {
  try {
    return event.body ? JSON.parse(event.body) : {};
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Action: register artist
// ---------------------------------------------------------------------------

function handleRegister(payload) {
  const { name, email, phone, genre, bio, socialLinks } = payload;

  if (!name || !email) {
    return respond(400, { ok: false, error: 'name and email are required' });
  }

  const artists = loadArtists();

  const existing = artists.find((a) => a.email === email);
  if (existing) {
    return respond(409, { ok: false, error: `Artist with email "${email}" already exists` });
  }

  const artist = {
    id: makeId(),
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    phone: phone ? String(phone).trim() : '',
    genre: Array.isArray(genre) ? genre.map((g) => String(g).trim()) : [],
    bio: bio ? String(bio).trim() : '',
    socialLinks: socialLinks && typeof socialLinks === 'object' ? socialLinks : {},
    status: 'pending_review',
    balance: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  artists.push(artist);
  saveArtists(artists);

  return respond(201, { ok: true, artist, artistId: artist.id });
}

// ---------------------------------------------------------------------------
// Action: list artists
// ---------------------------------------------------------------------------

function handleList(params) {
  let artists = loadArtists();

  const genre = params.genre ? params.genre.trim() : '';
  const status = params.status ? params.status.trim() : '';

  if (genre) {
    artists = artists.filter((a) =>
      Array.isArray(a.genre) && a.genre.some((g) => g.toLowerCase() === genre.toLowerCase())
    );
  }

  if (status) {
    artists = artists.filter((a) => a.status === status);
  }

  return respond(200, { ok: true, artists, total: artists.length });
}

// ---------------------------------------------------------------------------
// Action: get artist profile + their releases
// ---------------------------------------------------------------------------

function handleGet(params) {
  const { id } = params;
  if (!id) {
    return respond(400, { ok: false, error: 'id is required' });
  }

  const artists = loadArtists();
  const artist = artists.find((a) => a.id === id);
  if (!artist) {
    return respond(404, { ok: false, error: 'Artist not found' });
  }

  const releases = loadReleases().filter((r) => r.artistId === id);

  return respond(200, { ok: true, artist, releases });
}

// ---------------------------------------------------------------------------
// Action: update artist profile
// ---------------------------------------------------------------------------

function handleUpdate(payload) {
  const { id, ...fields } = payload;
  if (!id) {
    return respond(400, { ok: false, error: 'id is required' });
  }

  const artists = loadArtists();
  const idx = artists.findIndex((a) => a.id === id);
  if (idx === -1) {
    return respond(404, { ok: false, error: 'Artist not found' });
  }

  const protected_fields = ['id', 'createdAt', 'balance'];
  const artist = { ...artists[idx] };

  for (const [key, value] of Object.entries(fields)) {
    if (protected_fields.includes(key)) continue;
    if (key === 'email') {
      const normalized = String(value).trim().toLowerCase();
      const conflict = artists.find((a, i) => i !== idx && a.email === normalized);
      if (conflict) {
        return respond(409, { ok: false, error: `Email "${normalized}" is already in use` });
      }
      artist.email = normalized;
    } else if (key === 'genre') {
      artist.genre = Array.isArray(value) ? value.map((g) => String(g).trim()) : artist.genre;
    } else if (key === 'socialLinks') {
      artist.socialLinks = value && typeof value === 'object' ? value : artist.socialLinks;
    } else {
      artist[key] = value;
    }
  }

  artist.updatedAt = nowIso();
  artists[idx] = artist;
  saveArtists(artists);

  return respond(200, { ok: true, artist });
}

// ---------------------------------------------------------------------------
// Action: approve artist
// ---------------------------------------------------------------------------

function handleApprove(payload, params) {
  const id = (payload && payload.id) || (params && params.id);
  if (!id) {
    return respond(400, { ok: false, error: 'id is required' });
  }

  const artists = loadArtists();
  const idx = artists.findIndex((a) => a.id === id);
  if (idx === -1) {
    return respond(404, { ok: false, error: 'Artist not found' });
  }

  artists[idx].status = 'active';
  artists[idx].updatedAt = nowIso();
  saveArtists(artists);

  return respond(200, { ok: true, artist: artists[idx] });
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
      if (action === 'register') return handleRegister(payload);
      if (action === 'approve') return handleApprove(payload, params);
      return respond(400, { ok: false, error: `Unknown POST action: ${action}` });
    }

    if (method === 'PUT') {
      const denied = requireSkyGate(event);
      if (denied) return denied;
      const payload = parseBody(event);
      if (payload === null) {
        return respond(400, { ok: false, error: 'Invalid JSON body' });
      }
      const action = payload.action || params.action || 'update';
      if (action === 'update') return handleUpdate(payload);
      return respond(400, { ok: false, error: `Unknown PUT action: ${action}` });
    }

    return respond(405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    return respond(500, { ok: false, error: err.message || 'Internal server error' });
  }
};
