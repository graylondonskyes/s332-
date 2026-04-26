import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getStackConfig } from './config.mjs';
import { ensureRuntimeState } from '../lib/runtime.mjs';
import { createWorkspace, startWorkspace, stopWorkspace, deleteWorkspace, getWorkspaceRuntime } from '../lib/workspace-manager.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';

function parseArgs(argv) {
  const options = { workspaceId: 'remote-default', outFile: null, strict: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--workspace' || value === '--workspace-id') {
      options.workspaceId = argv[index + 1] || options.workspaceId;
      index += 1;
      continue;
    }
    if (value === '--out') {
      options.outFile = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (value === '--strict') {
      options.strict = true;
    }
  }
  return options;
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function assertCondition(assertions, id, pass, detail) {
  assertions.push({ id, pass, detail });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForJson(url, timeoutMs = 15000, validate = payload => payload?.ok === true) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      const json = await response.json();
      if (response.ok && validate(json)) {
        return json;
      }
      lastError = new Error(`Unexpected response from ${url}: ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  process.env.SKYEQUANTA_WORKSPACE_DRIVER = 'remote-executor';
  const config = getStackConfig();
  ensureRuntimeState(config);
  spawnSync('pkill', ['-f', path.join(config.shellDir, 'bin', 'remote-executor.mjs')], { stdio: 'ignore' });
  spawnSync('pkill', ['-f', path.join(config.shellDir, 'bin', 'workspace-service.mjs')], { stdio: 'ignore' });
  fs.rmSync(config.paths.remoteExecutorStateFile, { force: true });
  fs.rmSync(config.paths.remoteExecutorRuntimesFile, { force: true });
  fs.rmSync(config.paths.remoteExecutorLogFile, { force: true });
  const existingRuntime = getWorkspaceRuntime(config, options.workspaceId);
  const staleRootDir = existingRuntime?.state?.paths?.rootDir;
  if (typeof staleRootDir === 'string' && staleRootDir && !staleRootDir.startsWith(config.rootDir)) {
    await deleteWorkspace(config, options.workspaceId, { deletedBy: 'stage4-proof-reset' });
  }
  await deleteWorkspace(config, options.workspaceId, { deletedBy: 'stage4-proof-reset', force: true }).catch(() => {});
  createWorkspace(config, options.workspaceId, { name: 'Remote Executor Proof', source: 'stage4-proof' });

  await startWorkspace(config, options.workspaceId, 'stage_4_remote_executor_start_1');
  let first = getWorkspaceRuntime(config, options.workspaceId);
  let state = first.state || {};
  let executorBaseUrl = state?.executor?.url || `http://${config.remoteExecutor.host}:${config.remoteExecutor.port}`;
  const health = await waitForJson(`${executorBaseUrl}/health`, 30000, payload => payload?.ok === true);
  first = getWorkspaceRuntime(config, options.workspaceId);
  state = first.state || {};
  executorBaseUrl = state?.executor?.url || executorBaseUrl;
  const notePath = path.join(state?.paths?.fsDir || '', 'notes', 'stage4-remote.txt');
  const persistedContent = `stage4-remote-proof:${new Date().toISOString()}`;
  fs.mkdirSync(path.dirname(notePath), { recursive: true });
  fs.writeFileSync(notePath, persistedContent, 'utf8');

  await stopWorkspace(config, options.workspaceId, 'stage_4_remote_executor_stop');
  await startWorkspace(config, options.workspaceId, 'stage_4_remote_executor_start_2');
  const second = getWorkspaceRuntime(config, options.workspaceId);
  const secondState = second.state || {};
  const reopenedNote = fs.existsSync(notePath)
    ? { ok: true, path: notePath, content: fs.readFileSync(notePath, 'utf8') }
    : { ok: false, path: notePath };
  const volumeMeta = secondState?.paths?.volumeMetadataFile && fs.existsSync(secondState.paths.volumeMetadataFile)
    ? JSON.parse(fs.readFileSync(secondState.paths.volumeMetadataFile, 'utf8'))
    : null;

  const assertions = [];
  assertCondition(assertions, 'workspace_runtime_running_initial', Boolean(first.runtime?.running), first.runtime);
  assertCondition(assertions, 'workspace_runtime_running_reopen', Boolean(second.runtime?.running), second.runtime);
  assertCondition(assertions, 'remote_executor_enabled', Boolean(state?.capabilities?.remoteExecutor), state?.capabilities || null);
  assertCondition(assertions, 'equivalent_isolation_or_containerized', Boolean(state?.capabilities?.containerized || state?.capabilities?.equivalentIsolation), state?.capabilities || null);
  assertCondition(assertions, 'remote_executor_process_is_external', Boolean(state?.executor?.pid && state.executor.pid !== process.pid), state?.executor || null);
  assertCondition(assertions, 'remote_executor_health_responding', Boolean(health?.ok), health);
  assertCondition(assertions, 'workspace_processes_external', Boolean(state?.processes?.idePid && state?.processes?.agentPid && state.processes.idePid !== process.pid && state.processes.agentPid !== process.pid), state?.processes || null);
  assertCondition(assertions, 'durable_volume_present', Boolean(secondState?.paths?.volumeDir && fs.existsSync(secondState.paths.volumeDir)), secondState?.paths || null);
  assertCondition(assertions, 'volume_metadata_present', Boolean(volumeMeta?.durableVolume), volumeMeta);
  assertCondition(assertions, 'persisted_file_survives_restart', Boolean(reopenedNote.ok && reopenedNote.content === persistedContent), reopenedNote);

  const passed = assertions.every(item => item.pass);
  let report = {
    proof: 'stage-4-remote-executor',
    generatedAt: new Date().toISOString(),
    workspaceId: options.workspaceId,
    passed,
    strict: options.strict,
    runtime: {
      first: first.runtime,
      second: second.runtime
    },
    state: {
      first: state,
      second: secondState
    },
    health,
    reopenedNote,
    volumeMeta,
    assertions
  };
  const outFile = options.outFile || path.join(config.rootDir, 'docs', 'proof', 'STAGE_4_REMOTE_EXECUTOR.json');
  const emittedReport = writeProofJson(outFile, report, config, 'workspace-proof-stage4.mjs');
  console.log(JSON.stringify({ ok: passed, outFile, proof: report.proof }, null, 2));
  if (options.strict && !passed) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
