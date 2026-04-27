'use strict';
const fs = require('fs');
const path = require('path');

const WORKSPACE_ROOT = process.env.SKYEHANDS_WORKSPACE_ROOT || '/tmp/skyehands-workspace';

function safePath(rel) {
  const abs = path.resolve(WORKSPACE_ROOT, rel || '');
  if (!abs.startsWith(WORKSPACE_ROOT)) throw new Error('Path traversal blocked');
  return abs;
}

function scanDir(dir, maxDepth = 3, depth = 0) {
  const entries = [];
  let items;
  try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  for (const item of items) {
    if (item.name.startsWith('.') && !item.name.startsWith('.sky')) continue;
    const full = path.join(dir, item.name);
    const rel = path.relative(WORKSPACE_ROOT, full);
    if (item.isDirectory()) {
      const children = depth < maxDepth ? scanDir(full, maxDepth, depth + 1) : [];
      entries.push({ type: 'dir', name: item.name, path: rel, children });
    } else {
      let size = 0;
      try { size = fs.statSync(full).size; } catch {}
      entries.push({ type: 'file', name: item.name, path: rel, size });
    }
  }
  return entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  try {
    const rel = (event.queryStringParameters || {}).path || '';
    const absDir = safePath(rel);
    if (!fs.existsSync(WORKSPACE_ROOT)) {
      fs.mkdirSync(WORKSPACE_ROOT, { recursive: true });
      fs.writeFileSync(path.join(WORKSPACE_ROOT, 'README.md'), '# SkyeHands Workspace\n\nWelcome to your SkyeHands IDE workspace.\n');
    }
    const tree = scanDir(absDir);
    return { statusCode: 200, headers, body: JSON.stringify({ path: rel || '/', tree }) };
  } catch (err) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: err.message }) };
  }
};
