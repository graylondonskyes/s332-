import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

import { getStackConfig } from './config.mjs';
import { createWorkspace, selectWorkspace, startWorkspace, stopWorkspace, getWorkspaceRuntime, setWorkspacePorts } from '../lib/workspace-manager.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';

function ensureDirectory(dirPath) { fs.mkdirSync(dirPath, { recursive: true }); }
function writeJson(filePath, payload) { ensureDirectory(path.dirname(filePath)); fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8'); }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function terminatePid(pid, signal = 'SIGTERM') { if (!Number.isInteger(pid) || pid <= 0) return; try { process.kill(pid, signal); } catch {} }
async function terminateChild(child, signal = 'SIGTERM') {
  if (!child) return;
  if (child.exitCode !== null || child.killed) return;
  await new Promise(resolve => {
    let settled = false;
    const done = () => { if (!settled) { settled = true; resolve(); } };
    child.once('exit', done);
    child.once('close', done);
    try { child.kill(signal); } catch { done(); }
    setTimeout(done, 1000);
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

async function findFreePort(host, start = 4890, end = 4999) {
  for (let port = start; port <= end; port += 1) {
    if (await isPortFree(host, port)) return port;
  }
  throw new Error(`No free fixture port found in range ${start}-${end}`);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { response, status: response.status, ok: response.ok, json, text };
}

async function waitForJson(url, options = {}, timeoutMs = 20000, validate = payload => payload.ok) {
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

function spawnBridge(config, logBuffer) {
  const child = spawn(process.execPath, [path.join(config.shellDir, 'bin', 'bridge.mjs')], {
    cwd: config.shellDir,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true
  });
  child.stdout.on('data', chunk => logBuffer.push(chunk.toString('utf8')));
  child.stderr.on('data', chunk => logBuffer.push(chunk.toString('utf8')));
  return child;
}

async function main() {
  const strict = process.argv.includes('--strict');
  process.env.SKYEQUANTA_ADMIN_TOKEN = process.env.SKYEQUANTA_ADMIN_TOKEN || 'stage8-admin-token';
  process.env.SKYEQUANTA_BRIDGE_PORT = process.env.SKYEQUANTA_BRIDGE_PORT || '4820';
  process.env.SKYEQUANTA_REMOTE_EXECUTOR_PORT = process.env.SKYEQUANTA_REMOTE_EXECUTOR_PORT || '4821';
  process.env.SKYEQUANTA_MACHINE_PROFILE = process.env.SKYEQUANTA_MACHINE_PROFILE || 'standard';
  const config = getStackConfig(process.env);
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-stage8.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'STAGE_8_PREVIEW_FORWARDING.json');
  const smokeArtifact = path.join(config.rootDir, 'docs', 'proof', 'STAGE_7_SMOKE_MATRIX.json');
  const npmCommand = getNpmCommand();
  const skipStage7Prereq = process.env.SKYEQUANTA_SKIP_STAGE7_PREREQ === '1';
  const smokeRun = skipStage7Prereq ? { status: 0, stdout: '', stderr: '' } : spawnSync(npmCommand, ['run', 'workspace:proof:stage7', '--', '--strict'], {
    cwd: config.shellDir,
    env: { ...process.env },
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024
  });
  const smokePayload = fs.existsSync(smokeArtifact) ? readJson(smokeArtifact) : null;

  const workspaceId = 'preview-stage8';
  const bridgeLogs = [];
  let bridgeChild = null;
  let fixtureChild = null;
  const headers = {
    authorization: `Bearer ${process.env.SKYEQUANTA_ADMIN_TOKEN}`,
    'content-type': 'application/json'
  };

  const bridgeScriptPath = path.join(config.shellDir, 'bin', 'bridge.mjs');
  const previewFixturePath = path.join(config.shellDir, 'bin', 'workspace-preview-fixture.mjs');
  spawnSync('pkill', ['-f', bridgeScriptPath], { stdio: 'ignore' });
  spawnSync('pkill', ['-f', previewFixturePath], { stdio: 'ignore' });

  try {
    createWorkspace(config, workspaceId, { name: 'Preview Stage 8', tenantId: 'stage8', source: 'stage8-proof' });
    selectWorkspace(config, workspaceId);
    setWorkspacePorts(config, workspaceId, []);
    await startWorkspace(config, workspaceId, 'stage8_preview_start');

    const runtime = getWorkspaceRuntime(config, workspaceId);
    const fsDir = runtime?.state?.paths?.fsDir;
    if (!fsDir) throw new Error('Workspace fsDir missing from runtime state.');

    const previewPort = await findFreePort(config.host, 4890, 4999);
    const markerText = `stage8-preview-marker:${workspaceId}:${previewPort}`;
    const htmlText = `<!doctype html><html><body><h1>stage8-preview</h1><p>${workspaceId}</p><p>${previewPort}</p></body></html>`;
    fs.writeFileSync(path.join(fsDir, '.stage8-preview-marker.txt'), markerText, 'utf8');
    fs.writeFileSync(path.join(fsDir, '.stage8-preview.html'), htmlText, 'utf8');

    fixtureChild = spawn(process.execPath, [
      path.join(config.shellDir, 'bin', 'workspace-preview-fixture.mjs'),
      '--host', config.host,
      '--port', String(previewPort),
      '--root-dir', fsDir,
      '--workspace-id', workspaceId,
      '--label', 'stage8-preview-fixture'
    ], {
      cwd: fsDir,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });
    fixtureChild.stdout.on('data', chunk => bridgeLogs.push(`fixture:${chunk.toString('utf8')}`));
    fixtureChild.stderr.on('data', chunk => bridgeLogs.push(`fixture:${chunk.toString('utf8')}`));
    await waitForJson(`http://${config.host}:${previewPort}/health`, {}, 10000, payload => payload?.ok === true);
    bridgeChild = spawnBridge(config, bridgeLogs);
    await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/status`, {}, 20000, payload => payload?.productName);
    const deniedBefore = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/p/${previewPort}/health`);
    const allowResponse = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/workspaces/${workspaceId}/allow-port`, {
      method: 'POST', headers, body: JSON.stringify({ port: previewPort })
    }, 10000, payload => payload?.ok === true);
    const portsResponse = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/workspaces/${workspaceId}/ports`, { headers }, 10000, payload => payload?.ok === true);
    const statusResponse = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/status`, {}, 10000, payload => Array.isArray(payload?.workspace?.previewUrls));
    const previewHealth = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/p/${previewPort}/health`, {}, 10000, payload => payload?.ok === true && payload?.workspaceId === workspaceId);
    const previewMarker = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/p/${previewPort}/marker`, {}, 10000, payload => payload?.ok === true && payload?.marker === markerText);
    const previewHtml = await fetch(`http://${config.bridge.host}:${config.bridge.port}/p/${previewPort}/`).then(async response => ({ status: response.status, ok: response.ok, text: await response.text() }));
    await terminateChild(bridgeChild, 'SIGTERM');
    await delay(500);
    bridgeChild = spawnBridge(config, bridgeLogs);
    await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/status`, {}, 20000, payload => payload?.productName);
    const statusAfterRestart = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/status`, {}, 10000, payload => Array.isArray(payload?.workspace?.previewUrls));
    const previewAfterRestart = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/p/${previewPort}/health`, {}, 10000, payload => payload?.ok === true && payload?.workspaceId === workspaceId);
    const denyResponse = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/workspaces/${workspaceId}/deny-port`, {
      method: 'POST', headers, body: JSON.stringify({ port: previewPort })
    }, 10000, payload => payload?.ok === true);
    const deniedAfter = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/p/${previewPort}/health`);

    const previewUrls = Array.isArray(statusResponse.json?.workspace?.previewUrls) ? statusResponse.json.workspace.previewUrls : [];
    const listedPreviewUrls = Array.isArray(portsResponse.json?.previewUrls) ? portsResponse.json.previewUrls : [];
    const expectedCurrentPublicPath = `/p/${previewPort}`;
    const expectedWorkspacePublicPath = `/w/${workspaceId}/p/${previewPort}`;

    const checks = [
      assertCheck(smokeRun.status === 0, skipStage7Prereq ? 'stage 7 smoke matrix artifact remained clean while stage 8 reused the current canonical prerequisite state' : 'stage 7 smoke matrix reran cleanly before stage 8 proof', {
        status: smokeRun.status,
        stdoutTail: String(smokeRun.stdout || '').split(/\r?\n/).filter(Boolean).slice(-20),
        stderrTail: String(smokeRun.stderr || '').split(/\r?\n/).filter(Boolean).slice(-20)
      }),
      assertCheck(Boolean(smokePayload?.pass), 'stage 7 smoke artifact still reports pass after code changes', smokePayload?.pass),
      assertCheck(deniedBefore.status === 403, 'forwarded port route is forbidden before allow-port is granted', deniedBefore.json || deniedBefore.text),
      assertCheck(allowResponse.json?.ok === true, 'allow-port admin endpoint succeeds', allowResponse.json),
      assertCheck(Array.isArray(portsResponse.json?.forwardedPorts) && portsResponse.json.forwardedPorts.includes(previewPort), 'workspace ports endpoint reports allowed forwarded port', portsResponse.json),
      assertCheck(listedPreviewUrls.some(item => item.port === previewPort && item.publicPath === expectedWorkspacePublicPath && item.currentPublicPath === expectedCurrentPublicPath), 'workspace ports endpoint reports preview URL metadata', listedPreviewUrls),
      assertCheck(previewUrls.some(item => item.port === previewPort && item.publicPath === expectedWorkspacePublicPath && item.currentPublicPath === expectedCurrentPublicPath), 'status endpoint reports preview URL metadata for current workspace', statusResponse.json?.workspace),
      assertCheck(previewHealth.json?.workspaceId === workspaceId, 'bridge proxies forwarded port health endpoint to fixture', previewHealth.json),
      assertCheck(previewMarker.json?.marker === markerText, 'bridge proxies forwarded port marker endpoint with workspace content intact', previewMarker.json),
      assertCheck(previewHtml.ok && previewHtml.text.includes('stage8-preview') && previewHtml.text.includes(workspaceId), 'bridge proxies forwarded port HTML preview content', previewHtml),
      assertCheck(statusAfterRestart.json?.workspace?.previewUrls?.some(item => item.port === previewPort), 'preview URL metadata survives fresh bridge restart', statusAfterRestart.json?.workspace),
      assertCheck(previewAfterRestart.json?.workspaceId === workspaceId, 'forwarded preview route survives fresh bridge restart', previewAfterRestart.json),
      assertCheck(denyResponse.json?.ok === true, 'deny-port admin endpoint succeeds', denyResponse.json),
      assertCheck(deniedAfter.status === 403, 'forwarded port route closes again after deny-port', deniedAfter.json || deniedAfter.text)
    ];

    let payload = {
      stage: 8,
      label: 'stage-8-preview-forwarding',
      strict,
      generatedAt: new Date().toISOString(),
      proofCommand: 'npm run workspace:proof:stage8 -- --strict',
      prerequisiteSmokeCommand: 'npm run workspace:proof:stage7 -- --strict',
      workspaceId,
      previewPort,
      markerText,
      artifacts: {
        stage7Smoke: smokePayload,
        allowResponse: allowResponse.json,
        portsResponse: portsResponse.json,
        statusResponse: statusResponse.json,
        previewHealth: previewHealth.json,
        previewMarker: previewMarker.json,
        previewHtml,
        statusAfterRestart: statusAfterRestart.json,
        previewAfterRestart: previewAfterRestart.json,
        denyResponse: denyResponse.json,
        deniedBefore: deniedBefore.json || deniedBefore.text,
        deniedAfter: deniedAfter.json || deniedAfter.text
      },
      bridgeLogs,
      checks,
      pass: checks.every(item => item.pass)
    };
    payload = writeProofJson(proofFile, payload, config, 'workspace-proof-stage8.mjs');
    if (strict && !payload.pass) {
      console.error(JSON.stringify(payload, null, 2));
      process.exitCode = 1;
      return;
    }
    console.log(JSON.stringify(payload, null, 2));
  } finally {
    await terminateChild(fixtureChild, 'SIGTERM');
    await terminateChild(bridgeChild, 'SIGTERM');
    await delay(250);
    await stopWorkspace(config, workspaceId, 'stage8_cleanup').catch(() => {});
    try { setWorkspacePorts(config, workspaceId, []); } catch {}
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
