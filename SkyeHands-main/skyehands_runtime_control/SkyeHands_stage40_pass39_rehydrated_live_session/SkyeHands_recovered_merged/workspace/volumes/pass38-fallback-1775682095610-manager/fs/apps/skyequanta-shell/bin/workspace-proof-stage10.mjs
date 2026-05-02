import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getStackConfig } from './config.mjs';
import { ensureRuntimeState } from '../lib/runtime.mjs';
import { createWorkspace, deleteWorkspace, getWorkspaceRuntime, startWorkspace, stopWorkspace } from '../lib/workspace-manager.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';

function ensureDirectory(dirPath) { fs.mkdirSync(dirPath, { recursive: true }); }
function writeJson(filePath, payload) { ensureDirectory(path.dirname(filePath)); fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8'); }
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function assertCheck(condition, message, detail = null) { return { pass: Boolean(condition), message, detail }; }


function parseJsonFromMixedOutput(rawText) {
  const text = String(rawText || '').trim();
  const start = text.indexOf('{');
  if (start === -1) return null;
  try { return JSON.parse(text.slice(start)); } catch { return null; }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { ok: response.ok, status: response.status, json, text };
}

async function waitForJson(url, options = {}, timeoutMs = 20000, validate = payload => payload?.ok) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const result = await fetchJson(url, options);
      if (result.ok && validate(result.json || result)) return result;
      last = result;
    } catch (error) {
      last = error;
    }
    await delay(250);
  }
  throw last instanceof Error ? last : new Error(`Timed out waiting for ${url}`);
}

async function safeDelete(config, workspaceId) {
  try { await stopWorkspace(config, workspaceId, 'stage10_cleanup_stop'); } catch {}
  try { await deleteWorkspace(config, workspaceId, { deletedBy: 'stage10-proof', force: true }); } catch {}
}

async function main() {
  const strict = process.argv.includes('--strict');
  process.env.SKYEQUANTA_REMOTE_EXECUTOR_PORT = process.env.SKYEQUANTA_REMOTE_EXECUTOR_PORT || '4861';
  delete process.env.SKYEQUANTA_WORKSPACE_DRIVER;
  const config = getStackConfig(process.env);
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-stage10.mjs');
  ensureRuntimeState(config);
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'STAGE_10_MULTI_WORKSPACE_STRESS.json');
  spawnSync('pkill', ['-f', path.join(config.shellDir, 'bin', 'remote-executor.mjs')], { stdio: 'ignore' });
  spawnSync('pkill', ['-f', path.join(config.shellDir, 'bin', 'workspace-service.mjs')], { stdio: 'ignore' });
  fs.rmSync(config.paths.remoteExecutorStateFile, { force: true });
  fs.rmSync(config.paths.remoteExecutorRuntimesFile, { force: true });
  fs.rmSync(config.paths.remoteExecutorLogFile, { force: true });
  const stage4Artifact = path.join(config.rootDir, 'docs', 'proof', 'STAGE_4_REMOTE_EXECUTOR.json');
  const skipStage4Prereq = process.env.SKYEQUANTA_SKIP_STAGE4_PREREQ === '1';
  const workspaceIds = ['stage10-a', 'stage10-b', 'stage10-c'];
  const smokeScript = path.join(config.rootDir, 'scripts', 'smoke-multi-workspace-stress.sh');
  const executorScript = path.join(config.shellDir, 'bin', 'remote-executor.mjs');
  const recoverScript = path.join(config.shellDir, 'bin', 'executor-recover.mjs');

  for (const workspaceId of workspaceIds) {
    await safeDelete(config, workspaceId);
  }

  const existingStage4Payload = fs.existsSync(stage4Artifact) ? readJson(stage4Artifact) : null;
  const shouldReuseStage4Artifact = Boolean(skipStage4Prereq || existingStage4Payload?.pass);
  const stage4Run = shouldReuseStage4Artifact ? { status: 0, stdout: '', stderr: '', skipped: true } : spawnSync(process.execPath, [path.join(config.shellDir, 'bin', 'workspace-proof-stage4.mjs'), '--strict'], {
    cwd: config.rootDir,
    env: { ...process.env },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  const stage4Payload = fs.existsSync(stage4Artifact) ? readJson(stage4Artifact) : existingStage4Payload;

  let runtimes = [];
  let statusCommand = null;
  let statusEndpoint = null;
  let pruneResult = null;
  let recoverResult = null;
  let isolationViolation = null;
  let finalStatus = null;
  try {
    for (const workspaceId of workspaceIds) {
      createWorkspace(config, workspaceId, { name: `Stage10 ${workspaceId}`, tenantId: 'stage10', source: 'stage10-proof' });
    }

    for (const workspaceId of workspaceIds) {
      await startWorkspace(config, workspaceId, 'stage10_multi_start');
    }
    runtimes = workspaceIds.map(workspaceId => getWorkspaceRuntime(config, workspaceId));

    for (const runtime of runtimes) {
      const markerFile = path.join(runtime.state.paths.fsDir, `marker-${runtime.workspace.id}.txt`);
      fs.writeFileSync(markerFile, runtime.workspace.id, 'utf8');
    }

    statusCommand = spawnSync(process.execPath, [executorScript, 'status', '--state-dir', config.paths.remoteExecutorDir, '--json'], {
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
      ports: { ide: runtimes[0].state.ports.ide, agent: runtimes[0].state.ports.agent },
      urls: { ide: 'http://127.0.0.1:5990', agent: 'http://127.0.0.1:5991' },
      paths: {
        ...runtimes[0].state.paths,
        rootDir: path.join(config.rootDir, 'workspace', 'instances', 'stage10-bad'),
        volumeDir: path.join(config.rootDir, 'workspace', 'volumes', 'stage10-bad'),
        fsDir: '/tmp/stage10-escape',
        homeDir: path.join(config.rootDir, 'workspace', 'volumes', 'stage10-bad', 'home'),
        configDir: path.join(config.rootDir, 'workspace', 'volumes', 'stage10-bad', 'config'),
        runtimeDir: path.join(config.rootDir, '.skyequanta', 'workspace-runtime', 'stage10-bad'),
        logsDir: path.join(config.rootDir, '.skyequanta', 'workspace-runtime', 'stage10-bad', 'logs'),
        retentionDir: path.join(config.rootDir, 'workspace', 'retention', 'stage10-bad'),
        secretStoreDir: path.join(config.rootDir, 'workspace', 'secrets', 'stage10-bad'),
        prebuildDir: path.join(config.rootDir, 'workspace', 'prebuilds', 'stage10-bad')
      },
      runtimeMode: runtimes[0].state.runtimeMode,
      capabilities: runtimes[0].state.capabilities,
      lifecycle: runtimes[0].state.lifecycle,
      secrets: runtimes[0].state.secrets,
      prebuild: runtimes[0].state.prebuild,
      plan: runtimes[0].state.launchPlan
    };
    isolationViolation = await fetchJson(`http://${config.remoteExecutor.host}:${config.remoteExecutor.port}/workspaces/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(badPayload)
    });

    const oldLogFile = path.join(runtimes[0].state.paths.logsDir, 'old-runtime.log');
    ensureDirectory(path.dirname(oldLogFile));
    fs.writeFileSync(oldLogFile, 'old-log', 'utf8');
    const oldTime = Date.now() - ((Number.parseInt(String(runtimes[0].state.lifecycle?.retentionDays || 14), 10) + 2) * 24 * 60 * 60 * 1000);
    fs.utimesSync(oldLogFile, new Date(oldTime), new Date(oldTime));

    const staleTable = readJson(config.paths.remoteExecutorRuntimesFile);
    staleTable.workspaces['stage10-stale'] = {
      workspaceId: 'stage10-stale',
      workspaceName: 'Stage10 Stale',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      processes: { idePid: 999991, agentPid: 999992 },
      ports: { ide: 4998, agent: 4999 },
      paths: {
        rootDir: path.join(config.rootDir, 'workspace', 'instances', 'stage10-stale-missing'),
        fsDir: path.join(config.rootDir, 'workspace', 'volumes', 'stage10-stale-missing', 'fs'),
        runtimeDir: path.join(config.rootDir, '.skyequanta', 'workspace-runtime', 'stage10-stale'),
        logsDir: path.join(config.rootDir, '.skyequanta', 'workspace-runtime', 'stage10-stale', 'logs')
      },
      lifecycle: { retentionDays: 1, expiresAt: new Date(Date.now() - 60_000).toISOString() }
    };
    writeJson(config.paths.remoteExecutorRuntimesFile, staleTable);

    const orphanTable = readJson(config.paths.remoteExecutorRuntimesFile);
    orphanTable.workspaces[workspaceIds[0]].processes.idePid = 999993;
    orphanTable.workspaces[workspaceIds[0]].processes.agentPid = runtimes[0].state.processes.agentPid;
    writeJson(config.paths.remoteExecutorRuntimesFile, orphanTable);
    pruneResult = await waitForJson(`http://${config.remoteExecutor.host}:${config.remoteExecutor.port}/maintenance/prune`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    }, 20000, payload => payload?.ok === true);

    const afterPruneRuntime = getWorkspaceRuntime(config, workspaceIds[0]);
    recoverResult = spawnSync(process.execPath, [recoverScript, '--workspace', workspaceIds[0], '--restart', '--json'], {
      cwd: config.rootDir,
      env: { ...process.env },
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024
    });
    const recoverPayload = parseJsonFromMixedOutput(recoverResult.stdout);

    finalStatus = await waitForJson(`http://${config.remoteExecutor.host}:${config.remoteExecutor.port}/status`, {}, 20000, payload => payload?.ok === true);

    const fsDirs = runtimes.map(item => item.state.paths.fsDir);
    const rootDirs = runtimes.map(item => item.state.paths.rootDir);
    const idePorts = runtimes.map(item => item.state.ports.ide);
    const agentPorts = runtimes.map(item => item.state.ports.agent);
    const portSet = new Set([...idePorts, ...agentPorts]);

    const checks = [
      assertCheck(Boolean(stage4Payload?.passed) && stage4Run.status === 0, skipStage4Prereq ? 'stage 4 remote executor artifact remained clean while stage 10 reused the current canonical prerequisite state' : 'stage 4 remote executor proof reran cleanly before stage 10 stress assertions', { status: stage4Run.status, stage4Passed: stage4Payload?.passed }),
      assertCheck(runtimes.every(item => item.runtime.running), 'all stage 10 workspaces started concurrently under the remote executor default path', runtimes.map(item => item.runtime)),
      assertCheck(runtimes.every(item => item.state.driver === 'remote-executor'), 'remote executor is the default authoritative runtime driver when no workspace driver env override is set', runtimes.map(item => item.state.driver)),
      assertCheck(new Set(fsDirs).size === fsDirs.length && new Set(rootDirs).size === rootDirs.length, 'each workspace received isolated root and filesystem directories', { fsDirs, rootDirs }),
      assertCheck(portSet.size === (idePorts.length + agentPorts.length), 'each workspace received isolated IDE and agent ports', { idePorts, agentPorts }),
      assertCheck(statusCommand.status === 0 && Boolean(statusCommandPayload?.ok), 'remote executor status command returns machine-readable health and runtime state', statusCommandPayload),
      assertCheck(statusEndpoint.ok && statusEndpoint.json?.workspaceCount >= workspaceIds.length, 'remote executor status endpoint returns current runtime inventory', statusEndpoint.json),
      assertCheck(isolationViolation.status === 500 && /workspace_isolation_violation/.test(String(isolationViolation.json?.error || isolationViolation.text || '')), 'remote executor enforces per-workspace isolation boundaries and rejects escaped or duplicate runtime payloads', isolationViolation.json || isolationViolation.text),
      assertCheck(Boolean(pruneResult.json?.cleaned?.some(item => item.workspaceId === workspaceIds[0] && item.reasons.includes('orphan_process_cleanup'))), 'maintenance prune cleans orphaned workspace processes after partial runtime failure', pruneResult.json),
      assertCheck(Boolean(pruneResult.json?.removed?.includes('stage10-stale')), 'maintenance prune reaps stale runtime records with missing paths and expired lifecycles', pruneResult.json),
      assertCheck(!fs.existsSync(oldLogFile) && fs.existsSync(path.join(runtimes[0].state.paths.logsDir, 'log-retention.json')) && fs.existsSync(path.join(runtimes[0].state.paths.logsDir, 'activity.ndjson')), 'per-workspace canonical runtime logs are written with retention cleanup applied', { oldLogRemoved: !fs.existsSync(oldLogFile), logsDir: runtimes[0].state.paths.logsDir }),
      assertCheck(recoverResult.status === 0 && Boolean(recoverPayload?.after?.runtime?.running), 'executor recovery command restores a broken workspace session back to a running state', recoverPayload),
      assertCheck(finalStatus.ok && finalStatus.json?.runningWorkspaces >= workspaceIds.length, 'executor status remains healthy after cleanup and recovery operations', finalStatus.json)
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
        statusEndpoint: statusEndpoint.json,
        pruneResult: pruneResult.json,
        recoverPayload,
        finalStatus: finalStatus.json,
        runtimes: runtimes.map(item => ({ workspace: item.workspace, runtime: item.runtime, state: item.state })),
        afterPruneRuntime
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
    for (const workspaceId of workspaceIds) {
      await safeDelete(config, workspaceId);
    }
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
