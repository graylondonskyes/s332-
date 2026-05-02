'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { requireSkyGate } = require('./_lib/skygate-auth');

const MEDIA_CENTER_DIR =
  process.env.MEDIA_CENTER_DATA_DIR || path.join(os.tmpdir(), 'skye-media-center');
const ASSETS_FILE = path.join(MEDIA_CENTER_DIR, 'assets.json');

function readAssets() {
  if (!fs.existsSync(ASSETS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(ASSETS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

function safeRelativePath(value) {
  const relative = String(value || '').replace(/\\/g, '/');
  if (!relative || relative.startsWith('/') || relative.includes('..')) return '';
  return relative;
}

module.exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, OPTIONS' }, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  const query = event.queryStringParameters || {};
  const id = String(query.id || '').trim();
  if (!id) return json(400, { error: 'id is required' });

  const asset = readAssets().find((entry) => entry.id === id);
  if (!asset || asset.status === 'archived') {
    return json(404, { error: 'Asset not found' });
  }

  if (asset.status !== 'published') {
    const denied = requireSkyGate(event);
    if (denied) return denied;
  }

  const relativeFile = safeRelativePath(asset.filePath);
  if (!relativeFile) return json(500, { error: 'Asset file path is invalid' });

  const filePath = path.join(MEDIA_CENTER_DIR, relativeFile);
  if (!fs.existsSync(filePath)) {
    return json(404, { error: 'Stored asset file is missing' });
  }

  const fileBody = fs.readFileSync(filePath);
  return {
    statusCode: 200,
    isBase64Encoded: true,
    headers: {
      'Content-Type': asset.mimeType || 'application/octet-stream',
      'Content-Length': String(fileBody.length),
      'Cache-Control': asset.status === 'published' ? 'public, max-age=60' : 'no-store',
      'Content-Disposition': `inline; filename="${String(asset.filename || `${asset.id}.bin`).replace(/"/g, '')}"`,
      'Access-Control-Allow-Origin': '*',
    },
    body: fileBody.toString('base64'),
  };
};
