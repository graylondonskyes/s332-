import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getStackConfig } from './config.mjs';
import { ensureRuntimeState } from '../lib/runtime.mjs';
import { createWorkspace, deleteWorkspace, getWorkspaceRuntime, listWorkspaces, startWorkspace, stopWorkspace } from '../lib/workspace-manager.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function assertCheck(condition, message, detail = null) {
  return { pass: Boolean(condition), message, detail };
}

function proofPassed(payload) {
  return Boolean(payload?.pass ?? payload?.passed ?? payload?.ok);
}

function parseJsonFromMixedOutput(rawText) {
  const text = String(rawText || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {}
  const starts = [];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '{') starts.push(i);
  }
  for (let i = starts.length - 1; i >= 0; i -= 1) {
    try {
      return JSON.parse(text.slice(starts[i]));
    } catch {}
  }
  return null;
}

async function fetchJson(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`Timed out waiting for ${url}`)), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { ok: response.ok, status: response.status, json, text };
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForJson(url, options = {}, timeoutMs = 20000, validate = payload => payload?.ok) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const result = await fetchJson(url, options, 5000);
      if (result.ok && validate(result.json || result)) return result;
      last = result;
    } catch (error) {
      last = error;
    }
    await delay(250);
  }
  throw last instanceof Error ? last : new Error(`Timed out waiting for ${url}`);
}

async function withTimeout(promise, timeoutMs, label) {
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

function tailLines(raw, count = 20) {
  return String(raw || '').split(/\r?\n/).filter(Boolean).slice(-count);
}

async function safeDelete(config, workspaceId) {
  try {
    await withTimeout(stopWorkspace(config, workspaceId, 'stage10_cleanup_stop'), 15000, `stop ${workspaceId}`);
  } catch {}
  try {
    await withTimeout(deleteWorkspace(config, workspaceId, { deletedBy: 'stage10-proof', force: true }), 15000, `delete ${workspaceId}`);
  } catch {}
}

function readRuntimeTable(config) {
  return readJson(config.paths.remoteExecutorRuntimesFile, { version: 1, workspaces: {} }) || { version: 1, workspaces: {} };
}

async function main() {
  const strict = process.argv.includes('--strict');
  process.env.SKYEQUANTA_REMOTE_EXECUTOR_PORT = process.env.SKYEQUANTA_REMOTE_EXECUTOR_PORT || '4861';
  delete process.env.SKYEQUANTA_WORKSPACE_DRIVER;
  const config = getStackConfig(process.env);
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-stage10.mjs');
  ensureRuntimeState(config);

  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'STAGE_10_MULTI_WORKSPACE_STRESS.json');
  const stage4Artifact = path.join(config.rootDir, 'docs', 'proof', 'STAGE_4_REMOTE_EXECUTOR.json');
  const workspaceIds = ['stage10-a', 'stage10-b', 'stage10-c'];
  const cleanupPrefixes = ['stage10-', 's10x-', 'recov-', 'diag10'];
  const executorScript = path.join(config.shellDir, 'bin', 'remote-executor.mjs');
  const recoverScript = path.join(config.shellDir, 'bin', 'executor-recover.mjs');

  spawnSync('pkill', ['-f', path.join(config.shellDir, 'bin', 'remote-executor.mjs')], { stdio: 'ignore' });
  spawnSync('pkill', ['-f', path.join(config.shellDir, 'bin', 'workspace-service.mjs')], { stdio: 'ignore' });
  fs.rmSync(config.paths.remoteExecutorStateFile, { force: true });
  fs.rmSync(config.paths.remoteExecutorRuntimesFile, { force: true });
  fs.rmSync(config.paths.remoteExecutorLogFile, { force: true });

  const priorProofWorkspaceIds = (listWorkspaces(config)?.workspaces || [])
    .map(item => item?.id)
    .filter(id => typeof id === 'string' && cleanupPrefixes.some(prefix => id.startsWith(prefix)) && !workspaceIds.includes(id));
  for (const workspaceId of [...priorProofWorkspaceIds, ...workspaceIds]) {
    await safeDelete(config, workspaceId);
  }
  await delay(750);

  const existingStage4Payload = readJson(stage4Artifact);
  const skipStage4Prereq = process.env.SKYEQUANTA_SKIP_STAGE4_PREREQ === '1';
  const shouldReuseStage4Artifact = Boolean(skipStage4Prereq || proofPassed(existingStage4Payload));
  const stage4Run = shouldReuseStage4Artifact
    ? { status: 0, skipped: true, stdout: '', stderr: '' }
    : spawnSync(process.execPath, [path.join(config.shellDir, 'bin', 'workspace-proof-stage4.mjs'), '--strict'], {
        cwd: config.rootDir,
        env: { ...process.env },
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
      });
  const stage4Payload = readJson(stage4Artifact, existingStage4Payload);

  let runtimes = [];
  let statusCommand = null;
  let statusEndpoint = null;
  let isolationViolation = null;
  let pruneBeforeRecover = null;
  let pruneAfterOrphan = null;
  let recoverResult = null;
  let recoverPayload = null;
  let finalStatus = null;
  let runtimeTableAfterPrune = null;

  try {
    for (const workspaceId of workspaceIds) {
      createWorkspace(config, workspaceId, { name: `Stage10 ${workspaceId}`, tenantId: 'stage10', source: 'stage10-proof' });
    }

    for (const workspaceId of workspaceIds) {
      await withTimeout(startWorkspace(config, workspaceId, 'stage10_multi_start'), 150000, `startWorkspace(${workspaceId})`);
    }

    runtimes = workspaceIds.map(workspaceId => getWorkspaceRuntime(config, workspaceId));

    for (const runtime of runtimes) {
      const markerFile = path.join(runtime.state.paths.fsDir, `marker-${runtime.workspace.id}.txt`);
      fs.writeFileSync(markerFile, runtime.workspace.id, 'utf8');
    }

    statusCommand = spawnSync(process.execPath, [executorScript, 'status', '--state-dir', config.paths.remoteExecutorDir], {
      cwd: config.rootDir,
      env: { ...process.env },
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024
    });
    const statusCommandPayload = parseJsonFromMixedOutput(statusCommand.stdout);
    statusEndpoint = await waitForJson(`http://${config.remoteExecutor.host}:${config.remoteExecutor.port}/status`, {}, 20000, payload => payload?.ok === true);

    const badPayload = {
      workspaceId: 'stage10-bad',
      workspaceName: 'Stage10 Bad',
      plan: runtimes[0].state.launchPlan,
      ports: { ide: 5990, agent: 5991 },
      urls: { ide: 'http://127.0.0.1:5990', agent: 'http://127.0.0.1:5991' },
      paths: {
        ...runtimes[0].state.paths,
        rootDir: runtimes[0].state.paths.rootDir,
        fsDir: runtimes[0].state.paths.fsDir
      },
      runtimeMode: runtimes[0].state.runtimeMode,
      capabilities: runtimes[0].state.capabilities,
      lifecycle: runtimes[0].state.lifecycle,
      secrets: runtimes[0].state.secrets,
      prebuild: runtimes[0].state.prebuild,
      isolation: runtimes[0].state.isolation,
      sandboxPolicy: runtimes[0].state.sandbox?.ide || runtimes[0].state.sandbox,
      egressPolicy: runtimes[0].state.egressPolicy
    };
    isolationViolation = await fetchJson(`http://${config.remoteExecutor.host}:${config.remoteExecutor.port}/workspaces/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(badPayload)
    }, 20000);

    const logsDir = runtimes[0].state.paths.logsDir;
    ensureDirectory(logsDir);
    const oldLogFile = path.join(logsDir, 'old-runtime.log');
    const freshLogFile = path.join(logsDir, 'keep-runtime.log');
    fs.writeFileSync(oldLogFile, 'old-log', 'utf8');
    fs.writeFileSync(freshLogFile, 'keep-log', 'utf8');
    const retentionDays = Number.parseInt(String(runtimes[0].state.lifecycle?.retentionDays || 14), 10);
    const oldTime = Date.now() - ((retentionDays + 2) * 24 * 60 * 60 * 1000);
    fs.utimesSync(oldLogFile, new Date(oldTime), new Date(oldTime));
    pruneBeforeRecover = await fetchJson(`http://${config.remoteExecutor.host}:${config.remoteExecutor.port}/maintenance/prune`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({})
    }, 20000);

    const idePid = runtimes[0]?.state?.processes?.idePid;
    if (Number.isInteger(idePid) && idePid > 0) {
      try { process.kill(idePid, 'SIGTERM'); } catch {}
    }
    await delay(1200);

    pruneAfterOrphan = await fetchJson(`http://${config.remoteExecutor.host}:${config.remoteExecutor.port}/maintenance/prune`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({})
    }, 20000);
    runtimeTableAfterPrune = readRuntimeTable(config);
    const stage10ARuntimeAfterPrune = runtimeTableAfterPrune.workspaces?.['stage10-a'] || null;

    recoverResult = spawnSync(process.execPath, [recoverScript, '--workspace', 'stage10-a', '--restart', '--json'], {
      cwd: config.rootDir,
      env: {
        ...process.env,
        SKYEQUANTA_REMOTE_EXECUTOR_PORT: String(config.remoteExecutor.port),
        SKYEQUANTA_HOST: config.host
      },
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024
    });
    recoverPayload = parseJsonFromMixedOutput(recoverResult.stdout);
    const recoveryStatusUrl = recoverPayload?.executorStatus?.executor?.url || `http://${config.remoteExecutor.host}:${config.remoteExecutor.port}`;
    try {
      finalStatus = await waitForJson(`${recoveryStatusUrl.replace(/\/$/, '')}/status`, {}, 30000, payload => payload?.ok === true);
    } catch (error) {
      finalStatus = { ok: false, error: error instanceof Error ? error.message : String(error), json: null, text: null, status: null };
    }

    const checks = [
      assertCheck(proofPassed(stage4Payload), 'stage 4 remote executor prerequisite is green or successfully reused', { reused: shouldReuseStage4Artifact, stage4Run: { status: stage4Run.status, skipped: stage4Run.skipped || false } }),
      assertCheck(Boolean(statusCommandPayload?.ok), 'remote executor status command emits valid JSON with ok=true', statusCommandPayload),
      assertCheck(Boolean(statusEndpoint?.ok && (statusEndpoint.json?.runningWorkspaces || 0) >= workspaceIds.length), 'remote executor status endpoint reports all stage 10 workspaces as running', statusEndpoint?.json || null),
      assertCheck(runtimes.every(runtime => fs.existsSync(path.join(runtime.state.paths.fsDir, `marker-${runtime.workspace.id}.txt`))), 'multi-workspace runtime surfaces can write isolated markers into each workspace filesystem', runtimes.map(runtime => ({ workspaceId: runtime.workspace.id, markerFile: path.join(runtime.state.paths.fsDir, `marker-${runtime.workspace.id}.txt`) }))),
      assertCheck(Boolean(!isolationViolation?.ok && /workspace_isolation_violation/i.test(String(isolationViolation?.text || isolationViolation?.json?.error || ''))), 'remote executor blocks duplicate workspace path reuse as an isolation violation', isolationViolation),
      assertCheck(Boolean(pruneBeforeRecover?.ok && !fs.existsSync(oldLogFile) && fs.existsSync(freshLogFile) && fs.existsSync(path.join(logsDir, 'log-retention.json'))), 'log retention prune removes stale logs while preserving fresh logs and policy evidence', { oldLogRemoved: !fs.existsSync(oldLogFile), freshLogPresent: fs.existsSync(freshLogFile), logPolicyPresent: fs.existsSync(path.join(logsDir, 'log-retention.json')), pruneBeforeRecover: pruneBeforeRecover?.json || pruneBeforeRecover }),
      assertCheck(Boolean(pruneAfterOrphan?.ok && stage10ARuntimeAfterPrune?.cleanup?.reasons?.includes('orphan_process_cleanup')), 'maintenance prune reaps orphaned workspace processes into a recoverable runtime record', { pruneAfterOrphan: pruneAfterOrphan?.json || pruneAfterOrphan, stage10ARuntimeAfterPrune }),
      assertCheck(Boolean(recoverResult?.status === 0 && recoverPayload?.ok && recoverPayload?.restarted?.workspace?.id === 'stage10-a'), 'executor recover can restart the pruned workspace from the durable runtime record', { status: recoverResult?.status, recoverPayload, stdoutTail: tailLines(recoverResult?.stdout), stderrTail: tailLines(recoverResult?.stderr) }),
      assertCheck(Boolean(finalStatus?.ok && (finalStatus.json?.runningWorkspaces || 0) >= workspaceIds.length), 'executor status returns to a healthy three-workspace state after recovery', finalStatus?.json || finalStatus)
    ];

    let payload = {
      stage: 10,
      label: 'stage-10-multi-workspace-stress',
      strict,
      generatedAt: new Date().toISOString(),
      proofCommand: 'npm run workspace:proof:stage10 -- --strict',
      smokeCommand: 'bash scripts/smoke-multi-workspace-stress.sh',
      prerequisiteProofCommand: 'npm run workspace:proof:stage4 -- --strict',
      artifacts: {
        stage4Payload,
        statusCommand: statusCommandPayload,
        statusEndpoint: statusEndpoint?.json || null,
        isolationViolation,
        pruneBeforeRecover: pruneBeforeRecover?.json || pruneBeforeRecover,
        pruneAfterOrphan: pruneAfterOrphan?.json || pruneAfterOrphan,
        runtimeTableAfterPrune,
        recoverPayload,
        recoverResult: { status: recoverResult?.status ?? null, stdoutTail: tailLines(recoverResult?.stdout), stderrTail: tailLines(recoverResult?.stderr) },
        finalStatus: finalStatus?.json || finalStatus,
        runtimes: runtimes.map(item => ({ workspace: item.workspace, runtime: item.runtime, state: item.state }))
      },
      checks,
      pass: checks.every(item => item.pass)
    };
    payload = writeProofJson(proofFile, payload, config, 'workspace-proof-stage10.mjs');
    console.log(JSON.stringify(payload, null, 2));
    if (strict && !payload.pass) {
      process.exitCode = 1;
    }
  } finally {
    await Promise.allSettled(workspaceIds.map(workspaceId => withTimeout(safeDelete(config, workspaceId), 12000, `cleanup ${workspaceId}`)));
    spawnSync('pkill', ['-f', `${path.join(config.shellDir, 'bin', 'real-ide-runtime.mjs')} --workspace-id stage10-`], { stdio: 'ignore' });
    spawnSync('pkill', ['-f', executorScript], { stdio: 'ignore' });
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
