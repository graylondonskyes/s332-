'use strict';
const fs = require('fs');
const path = require('path');

const WORKSPACE_ROOT = process.env.SKYEHANDS_WORKSPACE_ROOT || '/tmp/skyehands-workspace';

function safePath(rel) {
  const abs = path.resolve(WORKSPACE_ROOT, rel || '');
  if (!abs.startsWith(WORKSPACE_ROOT)) throw new Error('Path traversal blocked');
  return abs;
}

const LANG_MAP = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript', jsx: 'javascript',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
  html: 'html', css: 'css', scss: 'scss', less: 'less',
  json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml',
  md: 'markdown', sh: 'shell', bash: 'shell', sql: 'sql',
  xml: 'xml', svg: 'xml', graphql: 'graphql',
};

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  try {
    const rel = (event.queryStringParameters || {}).path;
    if (!rel) return { statusCode: 400, headers, body: JSON.stringify({ error: 'path required' }) };
    const abs = safePath(rel);
    const stat = fs.statSync(abs);
    if (stat.size > 2 * 1024 * 1024) {
      return { statusCode: 413, headers, body: JSON.stringify({ error: 'File too large (> 2MB)' }) };
    }
    const content = fs.readFileSync(abs, 'utf8');
    const ext = path.extname(rel).slice(1).toLowerCase();
    const language = LANG_MAP[ext] || 'plaintext';
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ path: rel, content, language, size: stat.size, mtime: stat.mtimeMs }),
    };
  } catch (err) {
    const status = err.code === 'ENOENT' ? 404 : 400;
    return { statusCode: status, headers, body: JSON.stringify({ error: err.message }) };
  }
};
