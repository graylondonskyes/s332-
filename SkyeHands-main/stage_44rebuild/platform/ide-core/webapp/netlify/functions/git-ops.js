'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const WORKSPACE_ROOT = process.env.SKYEHANDS_WORKSPACE_ROOT || '/tmp/skyehands-workspace';

function git(args, cwd = WORKSPACE_ROOT) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    timeout: 15000,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'SkyeHands IDE',
      GIT_AUTHOR_EMAIL: 'ide@skyehands.io',
      GIT_COMMITTER_NAME: 'SkyeHands IDE',
      GIT_COMMITTER_EMAIL: 'ide@skyehands.io',
    },
  });
  return { stdout: result.stdout?.trim(), stderr: result.stderr?.trim(), code: result.status };
}

function ensureRepo(cwd) {
  const gitDir = path.join(cwd, '.git');
  if (!fs.existsSync(gitDir)) {
    git(['init'], cwd);
    git(['commit', '--allow-empty', '-m', 'Initial workspace commit'], cwd);
  }
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
    const { action, message, file, branch } = JSON.parse(event.body || '{}');
    if (!fs.existsSync(WORKSPACE_ROOT)) fs.mkdirSync(WORKSPACE_ROOT, { recursive: true });
    ensureRepo(WORKSPACE_ROOT);

    if (action === 'status') {
      const status = git(['status', '--short']);
      const log = git(['log', '--oneline', '-20']);
      const branch = git(['branch', '--show-current']);
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          status: status.stdout,
          log: log.stdout,
          branch: branch.stdout,
        }),
      };
    }

    if (action === 'diff') {
      const diff = git(['diff', file || 'HEAD'].filter(Boolean));
      const staged = git(['diff', '--cached', file || ''].filter(Boolean));
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ diff: diff.stdout, staged: staged.stdout }),
      };
    }

    if (action === 'stage') {
      const r = git(['add', file || '.']);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: r.code === 0, output: r.stdout + r.stderr }) };
    }

    if (action === 'commit') {
      if (!message) return { statusCode: 400, headers, body: JSON.stringify({ error: 'message required' }) };
      git(['add', '.']);
      const r = git(['commit', '-m', message]);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: r.code === 0, output: r.stdout + r.stderr }) };
    }

    if (action === 'checkout-branch') {
      if (!branch) return { statusCode: 400, headers, body: JSON.stringify({ error: 'branch required' }) };
      const existing = git(['branch', '--list', branch]);
      const r = existing.stdout
        ? git(['checkout', branch])
        : git(['checkout', '-b', branch]);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: r.code === 0, output: r.stdout + r.stderr }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
