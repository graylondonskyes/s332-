import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { getStackConfig } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';

function ensureDirectory(dirPath) { fs.mkdirSync(dirPath, { recursive: true }); }
function writeJson(filePath, payload) { ensureDirectory(path.dirname(filePath)); fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8'); }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function assertCheck(condition, message, detail = null) { return { pass: Boolean(condition), message, detail }; }
async function fetchJson(url, options = {}) { const response = await fetch(url, options); const text = await response.text(); let json = null; try { json = JSON.parse(text); } catch {} return { response, status: response.status, ok: response.ok, json, text }; }
async function waitForJson(url, options = {}, timeoutMs = 10000, validate = payload => Boolean(payload)) { const started = Date.now(); let last = null; while (Date.now() - started < timeoutMs) { try { const result = await fetchJson(url, options); if (result.ok && validate(result.json || result)) return result; last = result; } catch (error) { last = error; } await delay(200); } throw last instanceof Error ? last : new Error(`Timed out waiting for ${url}`); }
async function terminateChild(child, signal = 'SIGTERM') { if (!child || child.exitCode !== null || child.killed) return; await new Promise(resolve => { let settled = false; const done = () => { if (!settled) { settled = true; resolve(); } }; child.once('exit', done); child.once('close', done); try { child.kill(signal); } catch { done(); } setTimeout(done, 1200); }); }
function spawnNode(scriptPath, env, logBuffer) { const child = spawn(process.execPath, [scriptPath], { cwd: path.dirname(scriptPath), env, stdio: ['ignore', 'pipe', 'pipe'] }); child.stdout.on('data', chunk => logBuffer.push(chunk.toString('utf8'))); child.stderr.on('data', chunk => logBuffer.push(chunk.toString('utf8'))); return child; }
function createGateStub(port, expectedToken) {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
    const authHeader = String(request.headers.authorization || '');
    if (url.pathname === '/v1/health') { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ ok: true, service: 'gate-stub' })); return; }
    if (url.pathname === '/v1/models') { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ data: [{ id: 'kaixu/deep' }] })); return; }
    if (url.pathname === '/v1/auth/login' && request.method === 'POST') { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ ok: true, session_token: expectedToken, auth_mode: 'founder-gateway', expires_at: '2099-01-01T00:00:00.000Z' })); return; }
    if (url.pathname === '/v1/auth/me') {
      if (authHeader !== `Bearer ${expectedToken}`) { response.writeHead(401, { 'content-type': 'application/json' }); response.end(JSON.stringify({ ok: false, error: 'unauthorized' })); return; }
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: true, session: { id: 'gate-session-1', app_id: 'stage5-proof', org_id: 'stage5-org', auth_mode: 'founder-gateway', expires_at: '2099-01-01T00:00:00.000Z' } }));
      return;
    }
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: false, error: 'not_found' }));
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

async function runModeCheck(config, mode, gateUrl = null, gateToken = '') {
  const bridgeLogs = [];
  const baseEnv = {
    ...process.env,
    SKYEQUANTA_RUNTIME_MODE: mode,
    SKYEQUANTA_ADMIN_TOKEN: 'section5-admin-token',
    SKYEQUANTA_BRIDGE_PORT: String(config.bridge.port),
    SKYEQUANTA_REMOTE_EXECUTOR_PORT: String(config.remoteExecutor.port),
    SKYEQUANTA_GATE_URL: gateUrl || '',
    OMEGA_GATE_URL: gateUrl || '',
    SKYEQUANTA_GATE_TOKEN: gateToken,
    SKYEQUANTA_OSKEY: gateToken,
    SKYEQUANTA_GATE_MODEL: 'kaixu/deep'
  };
  const bridgeScriptPath = path.join(config.shellDir, 'bin', 'bridge.mjs');
  const supportDumpPath = path.join(config.shellDir, 'bin', 'support-dump.mjs');
  const bridgeChild = spawnNode(bridgeScriptPath, baseEnv, bridgeLogs);
  try {
    const status = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/status`, {}, 15000, payload => payload?.runtimeContract?.gateRuntime?.mode === mode);
    const runtimeContract = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/runtime-contract`);
    const gateConfig = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/gate/config`, { headers: { authorization: 'Bearer section5-admin-token' } });
    const gateModels = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/gate/v1/models`);
    const supportDumpOutput = path.join(config.rootDir, '.skyequanta', 'reports', 'support-dumps', `section5-support-dump-${mode}.json`);
    const supportDumpLogs = [];
    const supportChild = spawn(process.execPath, [supportDumpPath, '--json', `--output=${supportDumpOutput}`], { cwd: config.rootDir, env: baseEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    supportChild.stdout.on('data', chunk => supportDumpLogs.push(chunk.toString('utf8')));
    supportChild.stderr.on('data', chunk => supportDumpLogs.push(chunk.toString('utf8')));
    const supportExit = await new Promise(resolve => supportChild.once('exit', code => resolve(code ?? 1)));
    const supportDump = fs.existsSync(supportDumpOutput) ? JSON.parse(fs.readFileSync(supportDumpOutput, 'utf8')) : null;
    return {
      pass: true,
      mode,
      artifacts: {
        status: status.json,
        runtimeContract: runtimeContract.json,
        gateConfig: gateConfig.json,
        gateModels: gateModels.json,
        gateModelsStatus: gateModels.status,
        supportDump,
        supportExit,
        bridgeLogsTail: bridgeLogs.slice(-20),
        supportDumpLogsTail: supportDumpLogs.slice(-20)
      }
    };
  } finally {
    await terminateChild(bridgeChild, 'SIGTERM');
  }
}

async function runBrokenRemoteGatedCheck(config) {
  const bridgeLogs = [];
  const bridgeScriptPath = path.join(config.shellDir, 'bin', 'bridge.mjs');
  const env = {
    ...process.env,
    SKYEQUANTA_RUNTIME_MODE: 'remote-gated',
    SKYEQUANTA_ADMIN_TOKEN: 'section5-admin-token',
    SKYEQUANTA_BRIDGE_PORT: String(config.bridge.port + 20),
    SKYEQUANTA_REMOTE_EXECUTOR_PORT: String(config.remoteExecutor.port + 20),
    SKYEQUANTA_GATE_URL: 'http://127.0.0.1:6999',
    SKYEQUANTA_GATE_TOKEN: '',
    SKYEQUANTA_OSKEY: ''
  };
  const child = spawnNode(bridgeScriptPath, env, bridgeLogs);
  const exitCode = await new Promise(resolve => child.once('exit', code => resolve(code ?? 1)));
  return { exitCode, bridgeLogsTail: bridgeLogs.slice(-20) };
}

async function main() {
  const strict = process.argv.includes('--strict');
  const config = getStackConfig({
    ...process.env,
    SKYEQUANTA_BRIDGE_PORT: process.env.SKYEQUANTA_BRIDGE_PORT || '4920',
    SKYEQUANTA_REMOTE_EXECUTOR_PORT: process.env.SKYEQUANTA_REMOTE_EXECUTOR_PORT || '4921'
  });
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_5_GATE_RUNTIME_SEALING.json');
  const gatePort = 6998;
  const gateToken = 'section5-gate-token';
  const gateServer = await createGateStub(gatePort, gateToken);
  try {
    const offlineResult = await runModeCheck(config, 'offline');
    const localOnlyResult = await runModeCheck(config, 'local-only');
    const remoteGatedResult = await runModeCheck(config, 'remote-gated', `http://127.0.0.1:${gatePort}`, gateToken);
    const brokenRemoteGated = await runBrokenRemoteGatedCheck(config);

    const checks = [
      assertCheck(offlineResult.artifacts.status?.runtimeContract?.gateRuntime?.mode === 'offline', 'offline mode surfaces an explicit offline gate runtime contract', offlineResult.artifacts.status?.runtimeContract?.gateRuntime),
      assertCheck(offlineResult.artifacts.gateModelsStatus === 503, 'offline mode hard-fails gate proxy requests', { status: offlineResult.artifacts.gateModelsStatus, payload: offlineResult.artifacts.gateModels }),
      assertCheck(localOnlyResult.artifacts.status?.runtimeContract?.gateRuntime?.mode === 'local-only', 'local-only mode surfaces an explicit local-only runtime contract', localOnlyResult.artifacts.status?.runtimeContract?.gateRuntime),
      assertCheck(localOnlyResult.artifacts.gateModelsStatus === 503, 'local-only mode hard-fails gate proxy requests', { status: localOnlyResult.artifacts.gateModelsStatus, payload: localOnlyResult.artifacts.gateModels }),
      assertCheck(remoteGatedResult.artifacts.status?.services?.gate?.ok === true, 'remote-gated mode reports healthy gate service status', remoteGatedResult.artifacts.status?.services?.gate),
      assertCheck(Array.isArray(remoteGatedResult.artifacts.gateModels?.data) && remoteGatedResult.artifacts.gateModels.data[0]?.id === 'kaixu/deep', 'remote-gated mode proxies gate model responses', remoteGatedResult.artifacts.gateModels),
      assertCheck(remoteGatedResult.artifacts.gateConfig?.gateRuntime?.gateTokenConfigured === true && !JSON.stringify(remoteGatedResult.artifacts.gateConfig).includes(gateToken), 'admin gate config dump confirms mode without exposing secrets', remoteGatedResult.artifacts.gateConfig),
      assertCheck(remoteGatedResult.artifacts.supportExit === 0 && remoteGatedResult.artifacts.supportDump?.payload?.environment?.SKYEQUANTA_GATE_TOKEN === '[REDACTED]', 'support dump redacts gate secrets from persisted dumps', remoteGatedResult.artifacts.supportDump),
      assertCheck(brokenRemoteGated.exitCode !== 0 && brokenRemoteGated.bridgeLogsTail.join('\n').includes('requires SKYEQUANTA_GATE_TOKEN'), 'remote-gated mode hard-fails bridge startup when required secrets are missing', brokenRemoteGated)
    ];

    let payload = {
      section: 5,
      label: 'section-5-gate-runtime-sealing',
      strict,
      generatedAt: new Date().toISOString(),
      proofCommand: 'npm run workspace:proof:section5 -- --strict',
      smokeCommand: 'bash scripts/smoke-gate-runtime-modes.sh',
      artifacts: {
        offline: offlineResult.artifacts,
        localOnly: localOnlyResult.artifacts,
        remoteGated: remoteGatedResult.artifacts,
        brokenRemoteGated
      },
      checks,
      pass: checks.every(item => item.pass)
    };
    payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section5-gate-runtime.mjs');
    if (strict && !payload.pass) {
      console.error(JSON.stringify(payload, null, 2));
      process.exitCode = 1;
      return;
    }
    console.log(JSON.stringify(payload, null, 2));
  } finally {
    await new Promise(resolve => gateServer.close(resolve));
  }
}

main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : String(error)); process.exitCode = 1; });
