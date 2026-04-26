#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { resolveSafeTargetDir } from './graychunks-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number.parseInt(process.env.GRAYCHUNKS_PORT || '4726', 10);
const token = process.env.GRAYCHUNKS_API_TOKEN || '';

const findingsPath = path.join(root, 'skydexia', 'alerts', 'graychunks-findings.json');
const queuePath = path.join(root, 'skydexia', 'alerts', 'graychunks-priority-queue.json');
const dispatchPath = path.join(root, 'skydexia', 'alerts', 'graychunks-alert-dispatch.json');

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function runScript(script, args = [], extraEnv = {}) {
  const run = spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv }
  });
  return {
    script,
    exitCode: run.status,
    ok: run.status === 0 || (script === 'graychunks-scan.mjs' && run.status === 2),
    stdout: String(run.stdout || '').trim().slice(0, 2000),
    stderr: String(run.stderr || '').trim().slice(0, 2000)
  };
}

function send(res, statusCode, payload) {
  res.writeHead(statusCode, { 'content-type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); }
    });
  });
}

function authorized(req) {
  if (!token) return true;
  const supplied = String(req.headers['x-graychunks-token'] || '');
  return supplied && supplied === token;
}

const server = http.createServer(async (req, res) => {
  if (!authorized(req)) {
    return send(res, 401, { ok: false, error: 'unauthorized' });
  }

  if (req.method === 'GET' && req.url === '/status') {
    return send(res, 200, {
      ok: true,
      findings: readJson(findingsPath),
      queue: readJson(queuePath),
      dispatch: readJson(dispatchPath)
    });
  }

  if (req.method !== 'POST') {
    return send(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const body = await parseBody(req);
  const action = String(body.action || '').toLowerCase();
  let steps = [];
  let targetArg = [];
  if (body.target != null && String(body.target).trim()) {
    try {
      const target = resolveSafeTargetDir(root, String(body.target));
      targetArg = [`--target=${target}`];
    } catch (error) {
      return send(res, 400, { ok: false, error: 'invalid_target', detail: String(error?.message || error) });
    }
  }

  if (req.url === '/scan' || action === 'scan') {
    steps = [runScript('graychunks-scan.mjs', targetArg)];
  } else if (req.url === '/queue' || action === 'queue') {
    steps = [runScript('graychunks-priority-queue.mjs')];
  } else if (req.url === '/alert' || action === 'alert') {
    steps = [runScript('graychunks-alert-resend.mjs', [], { GRAYCHUNKS_ALERT_DRY_RUN: body.dryRun ? '1' : (process.env.GRAYCHUNKS_ALERT_DRY_RUN || '0') })];
  } else if (req.url === '/cycle' || action === 'cycle') {
    steps = [runScript('graychunks-runtime-cycle.mjs', targetArg, { GRAYCHUNKS_ALERT_DRY_RUN: body.dryRun ? '1' : (process.env.GRAYCHUNKS_ALERT_DRY_RUN || '0') })];
  } else {
    return send(res, 400, { ok: false, error: 'unsupported_action_or_route' });
  }

  const ok = steps.every((step) => step.ok);
  return send(res, ok ? 200 : 500, {
    ok,
    steps,
    findings: readJson(findingsPath),
    queue: readJson(queuePath),
    dispatch: readJson(dispatchPath)
  });
});

server.listen(port, () => {
  console.log(JSON.stringify({ status: 'LISTENING', port, tokenRequired: Boolean(token) }));
});
