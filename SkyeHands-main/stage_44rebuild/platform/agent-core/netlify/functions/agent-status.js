'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const crypto = require('crypto');

const AGENT_ROOT = path.resolve(__dirname, '../..');
const PROOF_FILE = path.join(AGENT_ROOT, 'runtime-proof.json');
const TASK_LEDGER = path.join(AGENT_ROOT, 'task-ledger.ndjson');
const WORKSPACE_DIR = process.env.OPENHANDS_WORKSPACE || path.join(AGENT_ROOT, 'workspace');
const BASE_URL = (process.env.OPENHANDS_BASE_URL || 'http://localhost:3101').replace(/\/$/, '');

function readProof() {
  try { return JSON.parse(fs.readFileSync(PROOF_FILE, 'utf8')); } catch { return {}; }
}
function writeProof(patch) {
  const cur = readProof();
  fs.writeFileSync(PROOF_FILE, JSON.stringify({ ...cur, ...patch, updatedAt: new Date().toISOString() }, null, 2));
}
function appendLedger(entry) {
  try { fs.appendFileSync(TASK_LEDGER, JSON.stringify({ ...entry, ts: new Date().toISOString() }) + '\n'); } catch {}
}
function readLedger(limit = 50) {
  try {
    return fs.readFileSync(TASK_LEDGER, 'utf8').trim().split('\n').filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean).slice(-limit).reverse();
  } catch { return []; }
}
function respond(code, body) {
  return { statusCode: code, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' }, body: JSON.stringify(body) };
}

async function checkServer() {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch { return false; }
}

function walkDir(dir) {
  const files = [];
  function walk(d) {
    try {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) walk(full);
        else files.push({ path: path.relative(dir, full), size: (() => { try { return fs.statSync(full).size; } catch { return 0; } })() });
      }
    } catch {}
  }
  walk(dir);
  return files;
}

function localExec(command, cwd) {
  const parts = command.trim().split(/\s+/);
  const result = spawnSync(parts[0], parts.slice(1), { cwd, encoding: 'utf8', timeout: 30000, env: { ...process.env } });
  return { stdout: result.stdout || '', stderr: result.stderr || '', exitCode: result.status ?? -1 };
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  const qs = event.queryStringParameters || {};
  const action = qs.action || (event.httpMethod === 'POST' ? (JSON.parse(event.body || '{}').action) : 'status');

  if (action === 'status') {
    const proof = readProof();
    const live = await checkServer();
    if (live) writeProof({ serverLaunches: true });
    return respond(200, {
      mode: live ? 'live' : 'local-fallback',
      serverReachable: live,
      baseUrl: BASE_URL,
      workspaceDir: WORKSPACE_DIR,
      proofFlags: {
        packageImportable: proof.packageImportable ?? false,
        serverLaunches: live || (proof.serverLaunches ?? false),
        taskReceived: proof.taskReceived ?? false,
        workspaceFileSeen: proof.workspaceFileSeen ?? false,
        fileEditedOrGenerated: proof.fileEditedOrGenerated ?? false,
        commandOrTestRun: proof.commandOrTestRun ?? false,
        resultReturnedToSkyeHands: proof.resultReturnedToSkyeHands ?? false,
      },
      fullOpenHandsRuntime: proof.fullOpenHandsRuntime === true,
    });
  }

  if (action === 'ledger') {
    return respond(200, { entries: readLedger(50) });
  }

  if (action === 'workspace') {
    if (!fs.existsSync(WORKSPACE_DIR)) fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
    const files = walkDir(WORKSPACE_DIR);
    if (files.length) writeProof({ workspaceFileSeen: true });
    return respond(200, { files, dir: WORKSPACE_DIR });
  }

  if (action === 'dispatch' && event.httpMethod === 'POST') {
    const body = JSON.parse(event.body || '{}');
    const { command, workingDir, taskType } = body;
    const taskId = crypto.randomUUID();
    const cwd = workingDir || WORKSPACE_DIR;
    fs.mkdirSync(cwd, { recursive: true });

    appendLedger({ taskId, action: 'received', taskType, command });
    writeProof({ taskReceived: true });

    const live = await checkServer();
    let result;

    if (live) {
      try {
        const res = await fetch(`${BASE_URL}/api/task`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId, command, workingDir: cwd, taskType }),
          signal: AbortSignal.timeout(30000),
        });
        result = await res.json();
        result.mode = 'live';
      } catch (err) {
        result = { ...localExec(command, cwd), mode: 'local-fallback', taskId };
      }
    } else {
      result = { ...localExec(command, cwd), mode: 'local-fallback', taskId };
      writeProof({ commandOrTestRun: true });
    }

    appendLedger({ taskId, action: 'completed', mode: result.mode, exitCode: result.exitCode });
    writeProof({ resultReturnedToSkyeHands: true });
    return respond(200, { ...result, taskId });
  }

  return respond(400, { error: `Unknown action: ${action}` });
};
