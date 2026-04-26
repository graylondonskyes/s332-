const fs = require('node:fs');
const path = require('node:path');

const { transcodeVideoAsset, normalizeSlug } = require('./_shared/media_center_video');
const { appendAuditEvent, writeUsageEvent } = require('./_shared/ae_state');

const MAX_LIMIT = 200;
const CATALOG_FILE = path.resolve(__dirname, '..', '.media-center-storage', 'catalog.json');

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  };
}

function parseBody(event = {}) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return {};
  }
}

function readString(value) {
  return String(value ?? '').trim();
}

function readPositiveInt(value, fallback = 25) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, MAX_LIMIT);
}

function normalizeStatus(status) {
  const normalized = readString(status).toLowerCase();
  if (!normalized) return 'draft';
  return ['draft', 'published', 'archived'].includes(normalized) ? normalized : 'draft';
}

function ensureCatalogFile() {
  fs.mkdirSync(path.dirname(CATALOG_FILE), { recursive: true });
  if (!fs.existsSync(CATALOG_FILE)) {
    fs.writeFileSync(CATALOG_FILE, `${JSON.stringify({ artists: {}, entries: {} }, null, 2)}\n`, 'utf8');
  }
}

function loadCatalog() {
  ensureCatalogFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
    return {
      artists: parsed?.artists && typeof parsed.artists === 'object' ? parsed.artists : {},
      entries: parsed?.entries && typeof parsed.entries === 'object' ? parsed.entries : {}
    };
  } catch {
    return { artists: {}, entries: {} };
  }
}

function saveCatalog(catalog) {
  ensureCatalogFile();
  fs.writeFileSync(CATALOG_FILE, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
}

async function upsertArtist(payload = {}, catalog = loadCatalog()) {
  const artistName = readString(payload.artistName) || readString(payload.name);
  if (!artistName) {
    throw new Error('artist_name_required');
  }

  const artistSlug = normalizeSlug(payload.artistSlug || payload.slug, normalizeSlug(artistName, 'artist'));

  const existing = catalog.artists[artistSlug] || {};
  const artist = {
    slug: artistSlug,
    name: artistName,
    bio: readString(payload.bio) || existing.bio || '',
    status: normalizeStatus(payload.status || existing.status || 'draft'),
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  catalog.artists[artistSlug] = artist;
  return artist;
}

async function upsertEntry(payload = {}, catalog = loadCatalog()) {
  const artistSlug = normalizeSlug(payload.artistSlug, normalizeSlug(payload.artistName, 'artist'));
  const title = readString(payload.title);
  const id = readString(payload.id);
  const existing = id ? catalog.entries[id] : null;

  const videoDataUrl = readString(payload.videoDataUrl || payload.dataUrl);
  if (!title && !existing) throw new Error('title_required');
  if (!videoDataUrl && !existing) throw new Error('video_data_url_required');

  const artist = catalog.artists[artistSlug] || await upsertArtist({ artistSlug, artistName: payload.artistName || artistSlug }, catalog);

  let mediaPayload = {
    assetKey: existing?.assetKey || '',
    poster: existing?.poster || null,
    variants: existing?.variants || [],
    durationSeconds: existing?.durationSeconds || 0,
    media: existing?.media || null
  };
  if (videoDataUrl) {
    mediaPayload = await transcodeVideoAsset({ artistSlug, title: title || existing.title || 'clip', dataUrl: videoDataUrl });
  }

  const entryId = id || mediaPayload.assetKey;
  const entry = {
    id: entryId,
    artistSlug,
    artistName: artist.name,
    title: title || existing.title,
    description: readString(payload.description) || existing?.description || '',
    tags: Array.isArray(payload.tags)
      ? payload.tags.map((tag) => readString(tag)).filter(Boolean)
      : (existing?.tags || []),
    status: normalizeStatus(payload.status || existing?.status || artist.status),
    assetKey: mediaPayload.assetKey,
    poster: mediaPayload.poster,
    variants: mediaPayload.variants,
    durationSeconds: mediaPayload.durationSeconds,
    media: mediaPayload.media,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  catalog.entries[entryId] = entry;
  return entry;
}

function listEntries(catalog, { artistSlug = '', status = '', limit = 25 } = {}) {
  const filterArtist = normalizeSlug(artistSlug, '');
  const statusQuery = readString(status);
  const filterStatus = statusQuery ? normalizeStatus(statusQuery) : '';
  const rows = Object.values(catalog.entries).filter((entry) => {
    if (filterArtist && entry.artistSlug !== filterArtist) return false;
    if (filterStatus && entry.status !== filterStatus) return false;
    return true;
  });
  rows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return rows.slice(0, readPositiveInt(limit));
}

module.exports = {
  upsertArtist,
  upsertEntry,
  handler: async (event = {}) => {
    const method = readString(event.httpMethod || 'GET').toUpperCase();
    const catalog = loadCatalog();

    if (method === 'GET') {
      const query = event.queryStringParameters || {};
      const entries = listEntries(catalog, {
        artistSlug: query.artistSlug,
        status: query.status,
        limit: query.limit
      });

      const response = {
        ok: true,
        artists: Object.values(catalog.artists),
        entries
      };

      const entryId = readString(query.id);
      if (entryId) {
        response.entry = catalog.entries[entryId] || null;
      }

      await writeUsageEvent({ route: 'media-center', action: 'list_entries', detail: { returned: entries.length, entryId } });
      return json(200, response);
    }

    if (method !== 'POST' && method !== 'PATCH') {
      return json(405, { ok: false, error: 'method_not_allowed' });
    }

    const payload = parseBody(event);
    try {
      const artist = await upsertArtist(payload, catalog);
      const entry = await upsertEntry({ ...payload, artistSlug: artist.slug }, catalog);
      saveCatalog(catalog);

      await writeUsageEvent({ route: 'media-center', action: method === 'POST' ? 'create_entry' : 'update_entry', detail: { entryId: entry.id, artistSlug: artist.slug } });
      await appendAuditEvent({
        actorId: readString(payload.actorId) || 'ae-system',
        actorType: 'system',
        action: method === 'POST' ? 'media_center_entry_created' : 'media_center_entry_updated',
        resource: entry.id,
        outcome: 'ok',
        detail: { artistSlug: artist.slug, status: entry.status }
      });

      return json(method === 'POST' ? 201 : 200, { ok: true, artist, entry });
    } catch (error) {
      return json(400, { ok: false, error: readString(error?.message || error) || 'media_center_request_invalid' });
    }
  }
};
