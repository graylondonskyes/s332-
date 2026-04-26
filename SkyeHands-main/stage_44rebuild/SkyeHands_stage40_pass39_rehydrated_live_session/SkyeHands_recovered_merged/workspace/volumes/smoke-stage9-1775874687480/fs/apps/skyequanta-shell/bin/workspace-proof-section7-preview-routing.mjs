import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

import { getStackConfig } from './config.mjs';
import { createWorkspace, createSnapshot, getWorkspaceRuntime, restoreSnapshot, selectWorkspace, setWorkspacePorts, startWorkspace, stopWorkspace } from '../lib/workspace-manager.mjs';
import { openSession } from '../lib/session-manager.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';

function ensureDirectory(dirPath) { fs.mkdirSync(dirPath, { recursive: true }); }
function writeJson(filePath, payload) { ensureDirectory(path.dirname(filePath)); fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8'); }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function terminateChild(child, signal = 'SIGTERM') {
  if (!child || child.exitCode !== null || child.killed) return;
  await new Promise(resolve => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    child.once('exit', finish);
    child.once('close', finish);
    try { child.kill(signal); } catch { finish(); }
    setTimeout(finish, 1000);
  });
}
function assertCheck(condition, message, detail = null) { return { pass: Boolean(condition), message, detail }; }
function getNpmCommand() { return process.platform === 'win32' ? 'npm.cmd' : 'npm'; }
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
async function isPortFree(host, port) {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(port, host, () => server.close(() => resolve(true)));
  });
}
async function findFreePort(host, start, end) {
  for (let port = start; port <= end; port += 1) {
    if (await isPortFree(host, port)) return port;
  }
  throw new Error(`No free port found in range ${start}-${end}`);
}
async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { response, status: response.status, ok: response.ok, json, text };
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
async function fetchText(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  return { status: response.status, ok: response.ok, text };
}
function spawnBridge(config, logs) {
  const child = spawn(process.execPath, [path.join(config.shellDir, 'bin', 'bridge.mjs')], { cwd: config.shellDir, env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'], detached: false });
  child.stdout.on('data', chunk => logs.push(`bridge:${chunk.toString('utf8')}`));
  child.stderr.on('data', chunk => logs.push(`bridge:${chunk.toString('utf8')}`));
  return child;
}
function spawnAgentGeneratedApp(config, options, logs) {
  const child = spawn(process.execPath, [path.join(config.shellDir, 'bin', 'workspace-agent-preview-app.mjs'), '--host', config.host, '--port', String(options.appPort), '--api-port', String(options.apiPort), '--root-dir', options.rootDir, '--workspace-id', options.workspaceId, '--label', options.label, '--title', options.title], { cwd: options.rootDir, env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'], detached: false });
  child.stdout.on('data', chunk => logs.push(`app:${chunk.toString('utf8')}`));
  child.stderr.on('data', chunk => logs.push(`app:${chunk.toString('utf8')}`));
  return child;
}
function writePreviewFiles(rootDir, payload) {
  ensureDirectory(path.join(rootDir, '.well-known'));
  fs.writeFileSync(path.join(rootDir, 'index.html'), payload.html, 'utf8');
  fs.writeFileSync(path.join(rootDir, 'preview-data.json'), `${JSON.stringify(payload.data, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(rootDir, '.well-known', 'preview-contract.json'), `${JSON.stringify(payload.contract, null, 2)}\n`, 'utf8');
}
function buildPreviewPayload({ workspaceId, appPort, apiPort, version }) {
  const versionTag = String(version || 'v1');
  return {
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>section7-${versionTag}</title></head><body><h1>section7-${versionTag}</h1><p>${workspaceId}</p><p>app:${appPort}</p><p>api:${apiPort}</p></body></html>`,
    data: { ok: true, version: versionTag, workspaceId, appPort, apiPort, message: `section7-${versionTag}-data` },
    contract: { ok: true, appKind: 'agent-generated-preview-app', workspaceId, version: versionTag, appPort, apiPort, routes: { health: '/health', appContract: '/.well-known/preview-contract.json', appData: '/api/data', apiHealth: '/health', apiData: '/data', apiContract: '/contract' } }
  };
}
async function main() {
  const strict = process.argv.includes('--strict');
  process.env.SKYEQUANTA_ADMIN_TOKEN = process.env.SKYEQUANTA_ADMIN_TOKEN || 'section7-admin-token';
  process.env.SKYEQUANTA_BRIDGE_PORT = process.env.SKYEQUANTA_BRIDGE_PORT || '4820';
  process.env.SKYEQUANTA_REMOTE_EXECUTOR_PORT = process.env.SKYEQUANTA_REMOTE_EXECUTOR_PORT || '4821';
  process.env.SKYEQUANTA_MACHINE_PROFILE = process.env.SKYEQUANTA_MACHINE_PROFILE || 'standard';
  const config = getStackConfig(process.env);
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section7-preview-routing.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_7_PREVIEW_ROUTING.json');
  const stage10PreviewFile = path.join(config.rootDir, 'docs', 'proof', 'STAGE_10_AGENT_APP_PREVIEW.json');
  const stage8Artifact = path.join(config.rootDir, 'docs', 'proof', 'STAGE_8_PREVIEW_FORWARDING.json');
  const npmCommand = getNpmCommand();
  const executorScript = path.join(config.shellDir, 'bin', 'remote-executor.mjs');
  const preReap = spawnSync(process.execPath, [executorScript, 'reap', '--json', '--remove-stale'], { cwd: config.rootDir, env: { ...process.env }, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const stage8Run = spawnSync(npmCommand, ['run', 'workspace:proof:stage8', '--', '--strict'], { cwd: config.rootDir, env: { ...process.env }, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const postStage8Reap = spawnSync(process.execPath, [executorScript, 'reap', '--json', '--remove-stale'], { cwd: config.rootDir, env: { ...process.env }, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const stage8Payload = fs.existsSync(stage8Artifact) ? readJson(stage8Artifact) : null;
  const workspaceId = 'section7-preview';
  const logs = [];
  let bridgeChild = null;
  let previewChild = null;
  const adminHeaders = { authorization: `Bearer ${process.env.SKYEQUANTA_ADMIN_TOKEN}`, 'content-type': 'application/json' };
  const bridgeScriptPath = path.join(config.shellDir, 'bin', 'bridge.mjs');
  const appScriptPath = path.join(config.shellDir, 'bin', 'workspace-agent-preview-app.mjs');
  spawnSync('pkill', ['-f', bridgeScriptPath], { stdio: 'ignore' });
  spawnSync('pkill', ['-f', appScriptPath], { stdio: 'ignore' });
  try {
    createWorkspace(config, workspaceId, { name: 'Section 7 Preview', tenantId: 'section7', source: 'section7-proof' });
    selectWorkspace(config, workspaceId);
    setWorkspacePorts(config, workspaceId, []);
    await startWorkspace(config, workspaceId, 'section7_preview_start');
    const runtime = getWorkspaceRuntime(config, workspaceId);
    const fsDir = runtime?.state?.paths?.fsDir;
    if (!fsDir) throw new Error('Workspace fsDir missing from runtime state.');
    const appPort = await findFreePort(config.host, 4900, 4990);
    const apiPort = await findFreePort(config.host, 5000, 5090);
    writePreviewFiles(fsDir, buildPreviewPayload({ workspaceId, appPort, apiPort, version: 'v1' }));
    previewChild = spawnAgentGeneratedApp(config, { appPort, apiPort, rootDir: fsDir, workspaceId, label: 'section7-agent-app', title: 'Section 7 Agent Preview' }, logs);
    await waitForJson(`http://${config.host}:${appPort}/health`, {}, 10000, payload => payload?.ok === true && payload?.kind === 'app');
    await waitForJson(`http://${config.host}:${apiPort}/health`, {}, 10000, payload => payload?.ok === true && payload?.kind === 'api');
    bridgeChild = spawnBridge(config, logs);
    await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/status`, {}, 20000, payload => payload?.productName);
    const setPortsResponse = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/workspaces/${workspaceId}/ports`, { method: 'POST', headers: adminHeaders, body: JSON.stringify({ ports: [appPort, apiPort], forwardedHost: config.host }) }, 10000, payload => payload?.ok === true);
    const session = openSession(config, { workspaceId, tenantId: 'section7', clientName: 'section7-proof', authSource: 'section7-local-proof' });
    const sessionHeaders = { authorization: `Bearer ${session.accessToken}` };
    const portsResponse = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/workspaces/${workspaceId}/ports`, { headers: adminHeaders }, 10000, payload => payload?.ok === true && Array.isArray(payload?.forwardedPorts));
    const previewContractResponse = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/workspaces/${workspaceId}/preview-contract`, { headers: adminHeaders }, 10000, payload => payload?.ok === true && payload?.previewContract?.multiPortSupported === true);
    const statusResponse = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/status`, {}, 10000, payload => Array.isArray(payload?.workspace?.previewUrls));
    const directAppHtml = await fetchText(`http://${config.host}:${appPort}/`);
    const directApiData = await fetchJson(`http://${config.host}:${apiPort}/data`);
    const aliasAppHtml = await fetchText(`http://${config.bridge.host}:${config.bridge.port}/p/${appPort}/`);
    const aliasApiData = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/p/${apiPort}/data`);
    const workspaceAppHtml = await fetchText(`http://${config.bridge.host}:${config.bridge.port}/w/${workspaceId}/p/${appPort}/`, { headers: sessionHeaders });
    const workspaceContractJson = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/w/${workspaceId}/p/${appPort}/.well-known/preview-contract.json`, { headers: sessionHeaders });
    const workspaceApiData = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/w/${workspaceId}/p/${apiPort}/data`, { headers: sessionHeaders });
    const snapshotResult = await createSnapshot(config, workspaceId, { label: 'section7-preview-v1', restartAfter: true, createdBy: 'section7-proof' });
    writePreviewFiles(fsDir, buildPreviewPayload({ workspaceId, appPort, apiPort, version: 'v2' }));
    const mutatedAliasContract = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/p/${appPort}/api/contract`, {}, 10000, payload => payload?.version === 'v2');
    const mutatedWorkspaceHtml = await fetchText(`http://${config.bridge.host}:${config.bridge.port}/w/${workspaceId}/p/${appPort}/`, { headers: sessionHeaders });
    await stopWorkspace(config, workspaceId, 'section7_restart_before_preview_check');
    await startWorkspace(config, workspaceId, 'section7_restart_after_preview_check');
    const previewAfterWorkspaceRestart = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/p/${appPort}/api/contract`, {}, 10000, payload => payload?.version === 'v2');
    await terminateChild(bridgeChild, 'SIGTERM');
    await delay(500);
    bridgeChild = spawnBridge(config, logs);
    await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/status`, {}, 20000, payload => payload?.productName);
    const previewAfterBridgeRestart = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/p/${appPort}/api/contract`, {}, 10000, payload => payload?.version === 'v2');
    const restoreResult = await restoreSnapshot(config, workspaceId, snapshotResult.snapshot.id, { restartAfter: true, restoredBy: 'section7-proof' });
    await terminateChild(previewChild, 'SIGTERM');
    await delay(250);
    previewChild = spawnAgentGeneratedApp(config, { appPort, apiPort, rootDir: fsDir, workspaceId, label: 'section7-agent-app', title: 'Section 7 Agent Preview' }, logs);
    await waitForJson(`http://${config.host}:${appPort}/health`, {}, 10000, payload => payload?.ok === true && payload?.kind === 'app');
    await waitForJson(`http://${config.host}:${apiPort}/health`, {}, 10000, payload => payload?.ok === true && payload?.kind === 'api');
    const restoredAliasContract = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/p/${appPort}/api/contract`, {}, 10000, payload => payload?.version === 'v1');
    const restoredWorkspaceHtml = await fetchText(`http://${config.bridge.host}:${config.bridge.port}/w/${workspaceId}/p/${appPort}/`, { headers: sessionHeaders });
    await stopWorkspace(config, workspaceId, 'section7_post_restore_restart');
    await startWorkspace(config, workspaceId, 'section7_post_restore_restart');
    const restoredAfterRestart = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/p/${appPort}/api/contract`, {}, 10000, payload => payload?.version === 'v1');
    const previewUrls = Array.isArray(previewContractResponse.json?.previewContract?.previewUrls) ? previewContractResponse.json.previewContract.previewUrls : [];
    const sortedPorts = Array.isArray(portsResponse.json?.forwardedPorts) ? [...portsResponse.json.forwardedPorts].sort((a, b) => a - b) : [];
    const checks = [
      assertCheck(preReap.status === 0, 'remote executor stale-runtime reap succeeds before section 7 proof begins', { status: preReap.status, stdout: preReap.stdout, stderr: preReap.stderr }),
      assertCheck(stage8Run.status === 0, 'stage 8 preview forwarding proof reran cleanly before section 7 assertions begin', { status: stage8Run.status, stdoutTail: String(stage8Run.stdout || '').split(/\r?\n/).filter(Boolean).slice(-20), stderrTail: String(stage8Run.stderr || '').split(/\r?\n/).filter(Boolean).slice(-20) }),
      assertCheck(Boolean(stage8Payload?.pass), 'stage 8 preview forwarding artifact still reports pass after section 7 changes', stage8Payload?.pass),
      assertCheck(postStage8Reap.status === 0, 'remote executor stale-runtime reap succeeds after stage 8 prerequisite proof', { status: postStage8Reap.status, stdout: postStage8Reap.stdout, stderr: postStage8Reap.stderr }),
      assertCheck(setPortsResponse.json?.ok === true, 'multi-port preview allowance succeeds through the canonical ports endpoint', setPortsResponse.json),
      assertCheck(sortedPorts.length === 2 && sortedPorts[0] === appPort && sortedPorts[1] === apiPort, 'workspace ports endpoint stores both preview ports canonically', portsResponse.json),
      assertCheck(previewContractResponse.json?.previewContract?.operatorDefault?.mode === 'workspace-scoped', 'preview contract marks workspace-scoped preview path as the canonical operator route', previewContractResponse.json?.previewContract),
      assertCheck(previewContractResponse.json?.previewContract?.multiPortSupported === true, 'preview contract declares multi-port forwarding support', previewContractResponse.json?.previewContract),
      assertCheck(previewUrls.some(item => item.port === appPort && item.defaultPublicPath === `/w/${workspaceId}/p/${appPort}` && item.deployPreviewPath === `/w/${workspaceId}/p/${appPort}`), 'preview contract exposes deploy-preview parity metadata for the app port', previewUrls),
      assertCheck(previewUrls.some(item => item.port === apiPort && item.defaultPublicPath === `/w/${workspaceId}/p/${apiPort}` && item.deployPreviewPath === `/w/${workspaceId}/p/${apiPort}`), 'preview contract exposes deploy-preview parity metadata for the API port', previewUrls),
      assertCheck(directAppHtml.ok && aliasAppHtml.ok && workspaceAppHtml.ok && directAppHtml.text === aliasAppHtml.text && aliasAppHtml.text === workspaceAppHtml.text, 'direct origin, current alias, and workspace-scoped preview all serve identical app HTML', { direct: directAppHtml, alias: aliasAppHtml, workspace: workspaceAppHtml }),
      assertCheck(directApiData.ok && aliasApiData.ok && workspaceApiData.ok && JSON.stringify(directApiData.json) === JSON.stringify(aliasApiData.json) && JSON.stringify(aliasApiData.json) === JSON.stringify(workspaceApiData.json), 'direct origin, current alias, and workspace-scoped preview all serve identical API payloads', { direct: directApiData.json, alias: aliasApiData.json, workspace: workspaceApiData.json }),
      assertCheck(workspaceContractJson.ok && workspaceContractJson.json?.appKind === 'agent-generated-preview-app', 'workspace-scoped preview route serves the agent-generated preview contract', workspaceContractJson.json),
      assertCheck(statusResponse.json?.workspace?.previewContract?.operatorDefault?.mode === 'workspace-scoped', 'status endpoint reports preview contract metadata for the current workspace', statusResponse.json?.workspace),
      assertCheck(mutatedAliasContract.json?.version === 'v2' && mutatedWorkspaceHtml.text.includes('section7-v2'), 'preview routes update when the agent-generated app changes inside the workspace filesystem', { alias: mutatedAliasContract.json, workspace: mutatedWorkspaceHtml.text }),
      assertCheck(previewAfterWorkspaceRestart.json?.version === 'v2', 'preview forwarding remains live after workspace restart', previewAfterWorkspaceRestart.json),
      assertCheck(previewAfterBridgeRestart.json?.version === 'v2', 'preview forwarding remains live after bridge restart', previewAfterBridgeRestart.json),
      assertCheck(restoredAliasContract.json?.version === 'v1' && restoredWorkspaceHtml.text.includes('section7-v1'), 'preview content restores to the snapshotted agent-generated app state', { alias: restoredAliasContract.json, workspace: restoredWorkspaceHtml.text }),
      assertCheck(restoredAfterRestart.json?.version === 'v1', 'restored snapshot preview remains correct after a subsequent workspace restart', restoredAfterRestart.json)
    ];
    let payload = { section: 7, label: 'section-7-preview-routing-and-agent-app-contract', strict, generatedAt: new Date().toISOString(), proofCommand: 'npm run workspace:proof:section7 -- --strict', prerequisiteProofCommand: 'npm run workspace:proof:stage8 -- --strict', workspaceId, appPort, apiPort, artifacts: { preReap: preReap.stdout || preReap.stderr || null, postStage8Reap: postStage8Reap.stdout || postStage8Reap.stderr || null, stage8: stage8Payload, session: { id: session.id, workspaceId: session.workspaceId, tenantId: session.tenantId }, portsResponse: portsResponse.json, previewContractResponse: previewContractResponse.json, statusResponse: statusResponse.json, directAppHtml, aliasAppHtml, workspaceAppHtml, directApiData: directApiData.json, aliasApiData: aliasApiData.json, workspaceApiData: workspaceApiData.json, workspaceContractJson: workspaceContractJson.json, snapshot: snapshotResult.snapshot, mutatedAliasContract: mutatedAliasContract.json, previewAfterWorkspaceRestart: previewAfterWorkspaceRestart.json, previewAfterBridgeRestart: previewAfterBridgeRestart.json, restoreSnapshot: restoreResult.snapshot, restoredAliasContract: restoredAliasContract.json, restoredAfterRestart: restoredAfterRestart.json }, logs, checks, pass: checks.every(item => item.pass) };
    payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section7-preview-routing.mjs');
    writeJson(stage10PreviewFile, payload);
    if (strict && !payload.pass) { console.error(JSON.stringify(payload, null, 2)); process.exitCode = 1; return; }
    console.log(JSON.stringify(payload, null, 2));
  } finally {
    await terminateChild(previewChild, 'SIGTERM');
    await terminateChild(bridgeChild, 'SIGTERM');
    await delay(250);
    await stopWorkspace(config, workspaceId, 'section7_cleanup').catch(() => {});
    try { setWorkspacePorts(config, workspaceId, []); } catch {}
  }
}
main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : String(error)); process.exitCode = 1; });
