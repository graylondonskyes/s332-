import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { getPublicUrls, getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, getRuntimePaths, loadShellEnv } from '../lib/runtime.mjs';
import { ensureDefaultWorkspace, getWorkspace, startWorkspace } from '../lib/workspace-manager.mjs';

function parseArgs(argv) {
  const options = { workspaceId: null, json: false, startWorkspace: true, autoBridgeStart: true, timeoutMs: 15000 };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--json') { options.json = true; continue; }
    if (value === '--no-start-workspace') { options.startWorkspace = false; continue; }
    if (value === '--no-auto-bridge-start') { options.autoBridgeStart = false; continue; }
    if (value === '--workspace' && argv[index + 1]) { options.workspaceId = String(argv[index + 1] || '').trim() || null; index += 1; continue; }
    if (value.startsWith('--workspace=')) { options.workspaceId = String(value.split('=').slice(1).join('=') || '').trim() || null; continue; }
    if (value === '--timeout-ms' && argv[index + 1]) { options.timeoutMs = Number.parseInt(String(argv[index + 1] || '15000'), 10) || 15000; index += 1; continue; }
  }
  return options;
}

async function canReach(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitFor(url, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await canReach(url)) return true;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return false;
}

async function ensureBridge(config, options) {
  const publicUrls = getPublicUrls(config);
  if (await canReach(`${publicUrls.bridge}/api/status`)) {
    return { started: false, reachable: true, detail: 'bridge already reachable', url: publicUrls.bridge };
  }
  if (!options.autoBridgeStart) {
    return { started: false, reachable: false, detail: 'bridge auto-start disabled', url: publicUrls.bridge };
  }
  const runtimePaths = getRuntimePaths(config);
  const logPath = path.join(runtimePaths.runtimeDir, 'operator-start-bridge.log');
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const out = fs.openSync(logPath, 'a');
  const child = spawn(process.execPath, [path.join(config.shellDir, 'bin', 'bridge.mjs')], {
    cwd: config.rootDir,
    detached: true,
    stdio: ['ignore', out, out],
    env: withLocalBinPath(loadShellEnv(config))
  });
  child.unref();
  fs.closeSync(out);
  const reachable = await waitFor(`${publicUrls.bridge}/api/status`, options.timeoutMs);
  return { started: true, reachable, detail: reachable ? `bridge auto-started (pid ${child.pid})` : `bridge auto-start attempted but status probe did not become healthy; see ${logPath}`, url: publicUrls.bridge, pid: child.pid, logPath };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseConfig = getStackConfig();
  ensureRuntimeState(baseConfig, process.env);
  const env = withLocalBinPath(loadShellEnv(baseConfig));
  const config = getStackConfig(env);
  printCanonicalRuntimeBannerForCommand(config, 'operator-start.mjs', { stderr: options.json });

  const defaultWorkspace = ensureDefaultWorkspace(config).workspace;
  const workspaceId = options.workspaceId || defaultWorkspace.id;
  const bridge = await ensureBridge(config, options);
  if (options.startWorkspace) await startWorkspace(config, workspaceId, 'operator_start');
  const workspace = getWorkspace(config, workspaceId);
  const base = getPublicUrls(config).bridge;
  const workspaceRunning = workspace?.status === 'running';
  const payload = {
    ok: Boolean(workspace && bridge.reachable && workspaceRunning),
    workspaceId,
    bridge,
    workspace,
    runtimeClosed: workspaceRunning,
    cockpit: {
      workspace: `${base}/workspace-center?workspaceId=${encodeURIComponent(workspaceId)}`,
      runtime: `${base}/runtime-center?workspaceId=${encodeURIComponent(workspaceId)}`,
      gate: `${base}/gate-center?workspaceId=${encodeURIComponent(workspaceId)}`,
      file: `${base}/file-center?workspaceId=${encodeURIComponent(workspaceId)}`,
      ops: `${base}/ops-center?workspaceId=${encodeURIComponent(workspaceId)}`,
      aiPatch: `${base}/ai-patch-center?workspaceId=${encodeURIComponent(workspaceId)}`,
      api: `${base}/api/workspaces/${encodeURIComponent(workspaceId)}/cockpit`
    },
    nextSteps: [
      './skyequanta doctor --mode deploy --probe-active --json',
      './skyequanta proof:workspace-cockpit --strict',
      `./skyequanta ai-patch list --workspace ${workspaceId}`
    ]
  };
  if (options.json) console.log(JSON.stringify(payload, null, 2));
  else {
    console.log(`Workspace ${workspaceId} is ready.`);
    console.log(JSON.stringify(payload.cockpit, null, 2));
  }
  if (!payload.ok) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
