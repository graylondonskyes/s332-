'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WORKSPACE_ROOT = process.env.SKYEHANDS_WORKSPACE_ROOT || '/tmp/skyehands-workspace';
const AUDIT_LOG = path.join(WORKSPACE_ROOT, '.sky', 'file-audit.ndjson');

function safePath(rel) {
  const abs = path.resolve(WORKSPACE_ROOT, rel || '');
  if (!abs.startsWith(WORKSPACE_ROOT)) throw new Error('Path traversal blocked');
  return abs;
}

function audit(action, rel, size) {
  try {
    fs.mkdirSync(path.dirname(AUDIT_LOG), { recursive: true });
    const entry = JSON.stringify({ ts: new Date().toISOString(), action, path: rel, size }) + '\n';
    fs.appendFileSync(AUDIT_LOG, entry);
  } catch {}
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST required' }) };

  try {
    const body = JSON.parse(event.body || '{}');
    const { path: rel, content, action = 'write' } = body;
    if (!rel) return { statusCode: 400, headers, body: JSON.stringify({ error: 'path required' }) };

    const abs = safePath(rel);

    if (action === 'delete') {
      fs.rmSync(abs, { force: true, recursive: false });
      audit('delete', rel, 0);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, action: 'deleted', path: rel }) };
    }

    if (action === 'mkdir') {
      fs.mkdirSync(abs, { recursive: true });
      audit('mkdir', rel, 0);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, action: 'mkdir', path: rel }) };
    }

    if (action === 'rename') {
      const dest = safePath(body.dest);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.renameSync(abs, dest);
      audit('rename', `${rel} → ${body.dest}`, 0);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, action: 'renamed', from: rel, to: body.dest }) };
    }

    // Default: write file
    if (content === undefined) return { statusCode: 400, headers, body: JSON.stringify({ error: 'content required for write' }) };
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    audit('write', rel, Buffer.byteLength(content, 'utf8'));
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ ok: true, path: rel, size: Buffer.byteLength(content, 'utf8'), sha256: hash }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
