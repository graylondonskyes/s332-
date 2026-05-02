import fs from 'node:fs';
import path from 'node:path';
import { getStackConfig } from './config.mjs';
import { ensureRuntimeState } from '../lib/runtime.mjs';
import { getWorkspace, getWorkspaceRuntime, startWorkspace } from '../lib/workspace-manager.mjs';
import { stopWorkspaceRuntime } from '../lib/workspace-runtime.mjs';

function parseArgs(argv) {
  const options = { workspaceId: null, restart: false, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if ((value === '--workspace' || value === '--workspace-id') && argv[index + 1]) {
      options.workspaceId = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === '--restart') {
      options.restart = true;
      continue;
    }
    if (value === '--json') {
      options.json = true;
      continue;
    }
    if (!options.workspaceId) {
      options.workspaceId = value;
    }
  }
  return options;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { ok: response.ok, status: response.status, json, text };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.workspaceId) {
    throw new Error('workspace id is required. Use --workspace <id>.');
  }
  const config = getStackConfig(process.env);
  ensureRuntimeState(config);
  const workspace = getWorkspace(config, options.workspaceId);
  if (!workspace) {
    throw new Error(`Workspace '${options.workspaceId}' is not registered.`);
  }

  const before = getWorkspaceRuntime(config, options.workspaceId);
  const stopResult = await stopWorkspaceRuntime(config, options.workspaceId);
  const logPolicyFile = path.join(before?.state?.paths?.logsDir || path.join(config.rootDir, '.skyequanta', 'workspace-runtime', options.workspaceId, 'logs'), 'log-retention.json');
  const logPolicy = fs.existsSync(logPolicyFile) ? JSON.parse(fs.readFileSync(logPolicyFile, 'utf8')) : null;

  let restarted = null;
  if (options.restart) {
    restarted = await startWorkspace(config, options.workspaceId, 'executor_recover_restart');
  }

  const after = getWorkspaceRuntime(config, options.workspaceId);
  const executorStatus = await fetchJson(`http://${config.remoteExecutor.host}:${config.remoteExecutor.port}/status`).catch(() => null);
  const payload = {
    ok: true,
    action: 'executor-recover',
    workspaceId: options.workspaceId,
    restart: options.restart,
    before,
    stopResult,
    restarted: restarted ? { workspace: restarted.workspace, runtime: restarted.runtime } : null,
    after,
    logPolicy,
    executorStatus: executorStatus?.json || null,
    generatedAt: new Date().toISOString()
  };
  console.log(JSON.stringify(payload, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
