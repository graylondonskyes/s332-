'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { requireSkyGate } = require('./_lib/skygate-auth');

const MEDIA_CENTER_DIR =
  process.env.MEDIA_CENTER_DATA_DIR || path.join(os.tmpdir(), 'skye-media-center');
const ASSETS_FILE = path.join(MEDIA_CENTER_DIR, 'assets.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readAssets() {
  if (!fs.existsSync(ASSETS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(ASSETS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

// ---------------------------------------------------------------------------
// Handler entry point
// ---------------------------------------------------------------------------

module.exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return respond(204, {});
  }

  if (event.httpMethod !== 'GET') {
    return respond(405, { error: 'Method not allowed' });
  }

  const denied = requireSkyGate(event);
  if (denied) return denied;

  try {
    const assets = readAssets();

    const byType = { image: 0, video: 0, audio: 0, document: 0 };
    const byStatus = { draft: 0, archived: 0, published: 0, scheduled: 0, active: 0 };
    let totalFileSize = 0;

    for (const asset of assets) {
      // byType
      if (asset.type && byType.hasOwnProperty(asset.type)) {
        byType[asset.type]++;
      }

      const s = asset.status || 'active';
      if (byStatus.hasOwnProperty(s)) {
        byStatus[s]++;
      }

      // Total file size
      if (typeof asset.fileSize === 'number') {
        totalFileSize += asset.fileSize;
      }
    }

    // Recent uploads: last 5 by createdAt (newest first), excluding archived
    const recentUploads = [...assets]
      .filter((a) => a.status !== 'archived')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    const stats = {
      totalAssets: assets.length,
      byType,
      byStatus,
      totalFileSize,
      recentUploads,
    };

    return respond(200, stats);
  } catch (err) {
    console.error('[media-stats] Unhandled error:', err);
    return respond(500, { error: 'Internal server error', detail: err.message });
  }
};
