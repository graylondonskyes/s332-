/**
 * OpenHands connector — platform/agent-core/runtime/lib/server.mjs
 *
 * Real HTTP connector to OpenHands server. Operates in two modes:
 *   1. LIVE — when OPENHANDS_BASE_URL is set and server is reachable
 *   2. LOCAL FALLBACK — when server is not reachable, uses local execution
 *      via child_process (node, python3) with file-backed task ledger
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGENT_ROOT = path.resolve(__dirname, '../..');
const PROOF_FILE = path.join(AGENT_ROOT, 'runtime-proof.json');
const TASK_LEDGER = path.join(AGENT_ROOT, 'task-ledger.ndjson');
const WORKSPACE_DIR = process.env.OPENHANDS_WORKSPACE || path.join(AGENT_ROOT, 'workspace');

const BASE_URL = (process.env.OPENHANDS_BASE_URL || 'http://localhost:3101').replace(/\/$/, '');
const TIMEOUT_MS = parseInt(process.env.OPENHANDS_TIMEOUT_MS || '30000', 10);

function readProof() {
  try { return JSON.parse(fs.readFileSync(PROOF_FILE, 'utf8')); } catch { return {}; }
}

function writeProof(patch) {
  const current = readProof();
  fs.writeFileSync(PROOF_FILE, JSON.stringify({ ...current, ...patch, updatedAt: new Date().toISOString() }, null, 2));
}

function appendLedger(entry) {
  try {
    fs.appendFileSync(TASK_LEDGER, JSON.stringify({ ...entry, ts: new Date().toISOString() }) + '\n');
  } catch {}
}

async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function isServerReachable() {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/api/health`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Local fallback execution ─────────────────────────────────────────────

function localExecuteTask(task) {
  const taskId = crypto.randomUUID();
  const taskDir = path.join(WORKSPACE_DIR, taskId);
  fs.mkdirSync(taskDir, { recursive: true });

  // Write task spec to workspace
  const specFile = path.join(taskDir, 'task.json');
  fs.writeFileSync(specFile, JSON.stringify(task, null, 2));

  const outputs = [];
  let finalStatus = 'completed';

  // If task contains a command, execute it
  if (task.command) {
    const cmd = task.command.trim().split(/\s+/);
    const result = spawnSync(cmd[0], cmd.slice(1), {
      cwd: task.workspaceDir || taskDir,
      encoding: 'utf8',
      timeout: TIMEOUT_MS,
      env: { ...process.env },
    });
    const out = { type: 'command', command: task.command, stdout: result.stdout, stderr: result.stderr, exitCode: result.status };
    outputs.push(out);
    fs.writeFileSync(path.join(taskDir, 'output.json'), JSON.stringify(out, null, 2));
    if (result.status !== 0) finalStatus = 'failed';
  }

  // If task has code to write, write it
  if (task.files) {
    for (const [filename, content] of Object.entries(task.files)) {
      const dest = path.join(taskDir, filename);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, content, 'utf8');
      outputs.push({ type: 'file_created', path: filename, size: Buffer.byteLength(content) });
    }
    writeProof({ fileEditedOrGenerated: true });
  }

  const result = {
    taskId,
    status: finalStatus,
    workspaceDir: taskDir,
    outputs,
    completedAt: new Date().toISOString(),
    mode: 'local-fallback',
  };
  fs.writeFileSync(path.join(taskDir, 'result.json'), JSON.stringify(result, null, 2));
  appendLedger({ taskId, action: 'completed', status: finalStatus, mode: 'local' });
  writeProof({ taskReceived: true, resultReturnedToSkyeHands: true });
  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────

export async function getStatus() {
  const proof = readProof();
  const serverReachable = await isServerReachable();

  const status = {
    mode: serverReachable ? 'live' : 'local-fallback',
    serverReachable,
    baseUrl: BASE_URL,
    workspaceDir: WORKSPACE_DIR,
    proofFlags: {
      packageImportable: proof.packageImportable ?? false,
      serverLaunches: serverReachable,
      taskReceived: proof.taskReceived ?? false,
      workspaceFileSeen: proof.workspaceFileSeen ?? false,
      fileEditedOrGenerated: proof.fileEditedOrGenerated ?? false,
      commandOrTestRun: proof.commandOrTestRun ?? false,
      resultReturnedToSkyeHands: proof.resultReturnedToSkyeHands ?? false,
    },
    fullOpenHandsRuntime: proof.fullOpenHandsRuntime === true,
    taskLedgerPath: TASK_LEDGER,
  };

  if (serverReachable) {
    writeProof({ serverLaunches: true });
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/api/status`);
      if (res.ok) status.serverStatus = await res.json();
    } catch {}
  }

  return status;
}

export async function sendTask(taskPayload) {
  const taskId = taskPayload.taskId || crypto.randomUUID();
  const task = { ...taskPayload, taskId };
  appendLedger({ taskId, action: 'received', payload: task });
  writeProof({ taskReceived: true });

  const live = await isServerReachable();

  if (live) {
    // Route to real OpenHands server
    const res = await fetchWithTimeout(`${BASE_URL}/api/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-SkyeHands-Source': 'agent-core' },
      body: JSON.stringify(task),
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`OpenHands server returned ${res.status}: ${errBody}`);
    }
    const result = await res.json();
    appendLedger({ taskId, action: 'completed', mode: 'live', result });
    writeProof({ resultReturnedToSkyeHands: true });
    return { ...result, mode: 'live', taskId };
  } else {
    // Local fallback
    const result = localExecuteTask(task);
    return result;
  }
}

export async function getWorkspaceFiles(workspaceDir) {
  const dir = workspaceDir || WORKSPACE_DIR;

  const live = await isServerReachable();
  if (live) {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/api/workspace/files?dir=${encodeURIComponent(dir)}`);
      if (res.ok) {
        const data = await res.json();
        writeProof({ workspaceFileSeen: true });
        return data;
      }
    } catch {}
  }

  // Local fallback: read filesystem
  const files = [];
  function walk(d) {
    try {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) walk(full);
        else files.push({ path: path.relative(WORKSPACE_DIR, full), size: fs.statSync(full).size });
      }
    } catch {}
  }
  if (fs.existsSync(dir)) {
    walk(dir);
    writeProof({ workspaceFileSeen: true });
  }
  return { files, dir, mode: 'local-fallback' };
}

export async function runCommand(command, workingDir) {
  const cwd = workingDir || WORKSPACE_DIR;
  fs.mkdirSync(cwd, { recursive: true });

  const live = await isServerReachable();
  if (live) {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/api/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, cwd }),
      });
      if (res.ok) {
        const data = await res.json();
        writeProof({ commandOrTestRun: true });
        return data;
      }
    } catch {}
  }

  // Local fallback
  const parts = command.trim().split(/\s+/);
  const result = spawnSync(parts[0], parts.slice(1), {
    cwd,
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
    env: { ...process.env },
  });
  writeProof({ commandOrTestRun: true });
  appendLedger({ action: 'command', command, exitCode: result.status, mode: 'local' });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status ?? -1,
    mode: 'local-fallback',
  };
}

export async function readTaskLedger(limit = 50) {
  try {
    const lines = fs.readFileSync(TASK_LEDGER, 'utf8').trim().split('\n').filter(Boolean);
    return lines.slice(-limit).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).reverse();
  } catch { return []; }
}

export default { getStatus, sendTask, getWorkspaceFiles, runCommand, readTaskLedger };
