'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const MEDIA_CENTER_DIR =
  process.env.MEDIA_CENTER_DATA_DIR || path.join(os.tmpdir(), 'skye-media-center');
const ASSETS_FILE = path.join(MEDIA_CENTER_DIR, 'assets.json');
const FILES_DIR = path.join(MEDIA_CENTER_DIR, 'files');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDirs() {
  if (!fs.existsSync(MEDIA_CENTER_DIR)) fs.mkdirSync(MEDIA_CENTER_DIR, { recursive: true });
  if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });
}

function readAssets() {
  ensureDirs();
  if (!fs.existsSync(ASSETS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(ASSETS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeAssets(assets) {
  ensureDirs();
  fs.writeFileSync(ASSETS_FILE, JSON.stringify(assets, null, 2), 'utf8');
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body;
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function generateId() {
  return crypto.randomBytes(12).toString('hex');
}

function now() {
  return new Date().toISOString();
}

const VALID_TYPES = new Set(['image', 'video', 'audio', 'document']);

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

function handleList(query) {
  let assets = readAssets().filter((a) => a.status !== 'archived');

  const { type, search, tag } = query;

  if (type && VALID_TYPES.has(type)) {
    assets = assets.filter((a) => a.type === type);
  }

  if (tag) {
    const tagLower = tag.toLowerCase();
    assets = assets.filter(
      (a) => Array.isArray(a.tags) && a.tags.some((t) => t.toLowerCase() === tagLower)
    );
  }

  if (search) {
    const term = search.toLowerCase();
    assets = assets.filter(
      (a) =>
        (a.title && a.title.toLowerCase().includes(term)) ||
        (a.description && a.description.toLowerCase().includes(term)) ||
        (Array.isArray(a.tags) && a.tags.some((t) => t.toLowerCase().includes(term)))
    );
  }

  // Sort newest first
  assets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return respond(200, { assets });
}

function handleGet(query) {
  const { id } = query;
  if (!id) return respond(400, { error: 'id is required' });

  const assets = readAssets();
  const asset = assets.find((a) => a.id === id);
  if (!asset) return respond(404, { error: 'Asset not found' });

  return respond(200, { asset });
}

function handleUpload(body) {
  const { title, type, content_base64, filename, tags, description } = body;

  if (!title) return respond(400, { error: 'title is required' });
  if (!type || !VALID_TYPES.has(type))
    return respond(400, { error: 'type must be one of: image, video, audio, document' });
  if (!filename) return respond(400, { error: 'filename is required' });
  if (!content_base64) return respond(400, { error: 'content_base64 is required' });

  ensureDirs();

  const id = generateId();
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storedName = `${id}-${safeFilename}`;
  const filePath = path.join(FILES_DIR, storedName);

  let fileBuffer;
  try {
    fileBuffer = Buffer.from(content_base64, 'base64');
  } catch {
    return respond(400, { error: 'content_base64 is not valid base64' });
  }

  fs.writeFileSync(filePath, fileBuffer);

  const asset = {
    id,
    title,
    type,
    filename: safeFilename,
    filePath: path.relative(MEDIA_CENTER_DIR, filePath),
    fileSize: fileBuffer.length,
    tags: Array.isArray(tags) ? tags : [],
    description: description || '',
    status: 'active',
    publishedAt: null,
    createdAt: now(),
    updatedAt: now(),
    url: `/.netlify/functions/media-file?id=${id}`,
  };

  const assets = readAssets();
  assets.push(asset);
  writeAssets(assets);

  return respond(201, { asset });
}

function handleUpdate(body) {
  const { id, title, tags, description, status } = body;
  if (!id) return respond(400, { error: 'id is required' });

  const assets = readAssets();
  const idx = assets.findIndex((a) => a.id === id);
  if (idx === -1) return respond(404, { error: 'Asset not found' });

  const asset = assets[idx];

  if (title !== undefined) asset.title = title;
  if (tags !== undefined) asset.tags = Array.isArray(tags) ? tags : [];
  if (description !== undefined) asset.description = description;
  if (status !== undefined) {
    const VALID_STATUSES = new Set(['active', 'archived', 'published', 'scheduled']);
    if (!VALID_STATUSES.has(status)) return respond(400, { error: 'Invalid status value' });
    asset.status = status;
  }
  asset.updatedAt = now();

  assets[idx] = asset;
  writeAssets(assets);

  return respond(200, { asset });
}

function handleDelete(query) {
  const { id } = query;
  if (!id) return respond(400, { error: 'id is required' });

  const assets = readAssets();
  const idx = assets.findIndex((a) => a.id === id);
  if (idx === -1) return respond(404, { error: 'Asset not found' });

  assets[idx].status = 'archived';
  assets[idx].updatedAt = now();
  writeAssets(assets);

  return respond(200, { message: 'Asset archived', id, asset: assets[idx] });
}

// ---------------------------------------------------------------------------
// Handler entry point
// ---------------------------------------------------------------------------

module.exports.handler = async function handler(event) {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return respond(204, {});
  }

  const method = event.httpMethod;
  const query = event.queryStringParameters || {};
  const action = query.action;

  try {
    if (method === 'GET') {
      if (!action || action === 'list') return handleList(query);
      if (action === 'get') return handleGet(query);
      return respond(400, { error: `Unknown GET action: ${action}` });
    }

    if (method === 'POST') {
      const body = parseBody(event);
      const bodyAction = body.action || action;
      if (!bodyAction || bodyAction === 'upload') return handleUpload(body);
      return respond(400, { error: `Unknown POST action: ${bodyAction}` });
    }

    if (method === 'PUT') {
      const body = parseBody(event);
      const bodyAction = body.action || action;
      if (!bodyAction || bodyAction === 'update') return handleUpdate(body);
      return respond(400, { error: `Unknown PUT action: ${bodyAction}` });
    }

    if (method === 'DELETE') {
      return handleDelete(query);
    }

    return respond(405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('[media-assets] Unhandled error:', err);
    return respond(500, { error: 'Internal server error', detail: err.message });
  }
};
