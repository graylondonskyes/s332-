'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

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
// Scoring
// ---------------------------------------------------------------------------

/**
 * Returns { score, highlights } for a single asset against the query terms.
 * Scoring:
 *   - Title word match:       +10 per matching query word
 *   - Tag exact match:        +15 per matching tag
 *   - Description word match: +5  per matching query word
 */
function scoreAsset(asset, queryWords) {
  let score = 0;
  const highlights = {};

  const titleLower = (asset.title || '').toLowerCase();
  const descLower = (asset.description || '').toLowerCase();
  const tagsLower = (Array.isArray(asset.tags) ? asset.tags : []).map((t) => t.toLowerCase());

  const titleMatches = [];
  const descMatches = [];
  const tagMatches = [];

  for (const word of queryWords) {
    // Title matching
    if (titleLower.includes(word)) {
      score += 10;
      titleMatches.push(word);
    }

    // Description matching
    if (descLower.includes(word)) {
      score += 5;
      descMatches.push(word);
    }

    // Tag exact matching
    for (const tag of tagsLower) {
      if (tag === word) {
        score += 15;
        tagMatches.push(tag);
        break; // count each matching tag query word once
      }
    }
  }

  // Build highlights: wrap first occurrence of each matched word in <mark>...</mark>
  if (titleMatches.length > 0) {
    let highlighted = asset.title || '';
    for (const word of titleMatches) {
      const re = new RegExp(`(${escapeRegex(word)})`, 'gi');
      highlighted = highlighted.replace(re, '<mark>$1</mark>');
    }
    highlights.title = highlighted;
  }

  if (descMatches.length > 0) {
    let highlighted = asset.description || '';
    for (const word of descMatches) {
      const re = new RegExp(`(${escapeRegex(word)})`, 'gi');
      highlighted = highlighted.replace(re, '<mark>$1</mark>');
    }
    // Truncate long descriptions to a snippet around first match
    if (highlighted.length > 300) {
      const firstMark = highlighted.indexOf('<mark>');
      const snippetStart = Math.max(0, firstMark - 80);
      highlighted =
        (snippetStart > 0 ? '...' : '') +
        highlighted.slice(snippetStart, snippetStart + 300) +
        '...';
    }
    highlights.description = highlighted;
  }

  if (tagMatches.length > 0) {
    highlights.tags = tagMatches;
  }

  return { score, highlights };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokenize(text) {
  // Split on non-word characters, lowercase, filter empties and very short tokens
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length >= 2);
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

module.exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return respond(204, {});
  }

  if (event.httpMethod !== 'GET') {
    return respond(405, { error: 'Method not allowed' });
  }

  const query = event.queryStringParameters || {};
  const { q, type, tag, status } = query;

  try {
    let assets = readAssets();

    // Pre-filter by type
    if (type) {
      assets = assets.filter((a) => a.type === type);
    }

    // Pre-filter by status
    if (status) {
      assets = assets.filter((a) => a.status === status);
    }

    // Pre-filter by tag
    if (tag) {
      const tagLower = tag.toLowerCase();
      assets = assets.filter(
        (a) =>
          Array.isArray(a.tags) &&
          a.tags.some((t) => t.toLowerCase() === tagLower)
      );
    }

    // If no query string, return filtered assets sorted by newest
    if (!q || !q.trim()) {
      assets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return respond(200, {
        results: assets.map((a) => ({ asset: a, score: 0, highlights: {} })),
        total: assets.length,
        query: q || '',
      });
    }

    const queryWords = tokenize(q);

    if (queryWords.length === 0) {
      return respond(200, { results: [], total: 0, query: q });
    }

    // Score all assets
    const scored = assets
      .map((asset) => {
        const { score, highlights } = scoreAsset(asset, queryWords);
        return { asset, score, highlights };
      })
      .filter((item) => item.score > 0);

    // Sort by score descending, then by newest for ties
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.asset.createdAt) - new Date(a.asset.createdAt);
    });

    return respond(200, {
      results: scored,
      total: scored.length,
      query: q,
      queryWords,
    });
  } catch (err) {
    console.error('[media-search] Unhandled error:', err);
    return respond(500, { error: 'Internal server error', detail: err.message });
  }
};
