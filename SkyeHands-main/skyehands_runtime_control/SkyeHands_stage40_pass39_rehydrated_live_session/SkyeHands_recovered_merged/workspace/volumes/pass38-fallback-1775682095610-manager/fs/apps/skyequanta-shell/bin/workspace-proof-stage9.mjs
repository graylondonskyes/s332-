import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { getStackConfig } from './config.mjs';
import { runWorkspaceLifecycleSmoke } from './workspace-smoke-lifecycle.mjs';
import { writeDeploymentReadinessReport } from '../lib/deployment-packaging.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
function ensureDirectory(dirPath) { fs.mkdirSync(dirPath, { recursive: true }); }
function writeJson(filePath, payload) { ensureDirectory(path.dirname(filePath)); fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8'); }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function assertCheck(condition, message, detail = null) { return { pass: Boolean(condition), message, detail }; }
async function fetchJson(url, options = {}) { const response = await fetch(url, options); const text = await response.text(); let json = null; try { json = JSON.parse(text); } catch {} return { response, status: response.status, ok: response.ok, json, text }; }
async function waitForJson(url, options = {}, timeoutMs = 20000, validate = payload => payload?.ok) { const started = Date.now(); let last = null; while (Date.now() - started < timeoutMs) { try { const result = await fetchJson(url, options); if (result.ok && validate(result.json || result)) return result; last = result; } catch (error) { last = error; } await delay(250); } throw last instanceof Error ? last : new Error(`Timed out waiting for ${url}`); }
async function terminateChild(child, signal = 'SIGTERM') { if (!child || child.exitCode !== null || child.killed) return; await new Promise(resolve => { let settled = false; const done = () => { if (!settled) { settled = true; resolve(); } }; child.once('exit', done); child.once('close', done); try { child.kill(signal); } catch { done(); } setTimeout(done, 1000); }); }
function spawnBridge(config, logBuffer) { const child = spawn(process.execPath, [path.join(config.shellDir, 'bin', 'bridge.mjs')], { cwd: config.shellDir, env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'], detached: true }); child.stdout.on('data', chunk => logBuffer.push(chunk.toString('utf8'))); child.stderr.on('data', chunk => logBuffer.push(chunk.toString('utf8'))); return child; }
async function main() {
  const strict = process.argv.includes('--strict');
  process.env.SKYEQUANTA_ADMIN_TOKEN = process.env.SKYEQUANTA_ADMIN_TOKEN || 'stage9-admin-token';
  process.env.SKYEQUANTA_GATE_TOKEN = process.env.SKYEQUANTA_GATE_TOKEN || 'stage9-gate-token';
  process.env.SKYEQUANTA_GATE_URL = process.env.SKYEQUANTA_GATE_URL || 'http://127.0.0.1:5999';
  process.env.SKYEQUANTA_BRIDGE_PORT = process.env.SKYEQUANTA_BRIDGE_PORT || '4830';
  process.env.SKYEQUANTA_REMOTE_EXECUTOR_PORT = process.env.SKYEQUANTA_REMOTE_EXECUTOR_PORT || '4831';
  const config = getStackConfig(process.env);
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-stage9.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'STAGE_9_DEPLOYMENT_READINESS.json');
  const stage8Artifact = path.join(config.rootDir, 'docs', 'proof', 'STAGE_8_PREVIEW_FORWARDING.json');
  const skipStage8Prereq = process.env.SKYEQUANTA_SKIP_STAGE8_PREREQ === '1';
  const doctorPath = path.join(config.shellDir, 'bin', 'doctor.mjs');
  const bridgeScriptPath = path.join(config.shellDir, 'bin', 'bridge.mjs');
  const bridgeLogs = [];
  let bridgeChild = null;
  const existingStage8Payload = fs.existsSync(stage8Artifact) ? readJson(stage8Artifact) : null;
  const shouldReuseStage8Artifact = Boolean(skipStage8Prereq || existingStage8Payload?.pass);
  const stage8Run = shouldReuseStage8Artifact ? { status: 0, stdout: '', stderr: '', skipped: true } : spawnSync(process.execPath, [path.join(config.shellDir, 'bin', 'workspace-proof-stage8.mjs'), '--strict'], {
    cwd: config.shellDir,
    env: { ...process.env },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  const stage8Payload = fs.existsSync(stage8Artifact) ? readJson(stage8Artifact) : existingStage8Payload;
  try {
    spawnSync('pkill', ['-f', bridgeScriptPath], { stdio: 'ignore' });
    bridgeChild = spawnBridge(config, bridgeLogs);
    await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/status`, {}, 20000, payload => payload?.productName === config.productName);
    const doctorRun = spawnSync(process.execPath, [doctorPath, '--mode', 'deploy', '--probe-active', '--json', '--bridge-url', `http://${config.bridge.host}:${config.bridge.port}`], { cwd: config.rootDir, env: { ...process.env }, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    const doctorPayload = doctorRun.stdout?.trim() ? JSON.parse(doctorRun.stdout) : null;
    const lifecycleSmoke = await runWorkspaceLifecycleSmoke(config, {
      adminToken: process.env.SKYEQUANTA_ADMIN_TOKEN,
      bridgeBaseUrl: `http://${config.bridge.host}:${config.bridge.port}`,
      workspaceId: `smoke-stage9-${Date.now()}`,
      tenantId: 'stage9-smoke'
    });
    const identityResponse = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/product/identity`);
    const statusResponse = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/status`);
    const catalogResponse = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/control-plane/catalog`, { headers: { authorization: `Bearer ${process.env.SKYEQUANTA_ADMIN_TOKEN}` } });
    const checks = [
      assertCheck(stage8Run.status === 0, shouldReuseStage8Artifact ? 'stage 8 preview forwarding artifact remained clean while stage 9 reused the current canonical prerequisite state' : 'stage 8 preview forwarding proof reran cleanly before stage 9 assertions begin', { status: stage8Run.status, skipped: Boolean(stage8Run.skipped), stdoutTail: String(stage8Run.stdout || '').split(/\r?\n/).filter(Boolean).slice(-20), stderrTail: String(stage8Run.stderr || '').split(/\r?\n/).filter(Boolean).slice(-20) }),
      assertCheck(Boolean(stage8Payload?.pass), 'stage 8 proof artifact still reports pass after code changes', stage8Payload?.pass),
      assertCheck(doctorRun.status === 0 && Boolean(doctorPayload?.ok), 'deploy-mode doctor passes with active bridge probing', doctorPayload),
      assertCheck(Array.isArray(doctorPayload?.checks) && doctorPayload.checks.some(item => item.label === 'probe:product-identity' && item.ok), 'doctor deploy probes include passing product identity endpoint check', doctorPayload?.checks),
      assertCheck(Boolean(lifecycleSmoke?.ok), 'workspace lifecycle smoke passes through create/start/runtime/stop/delete cycle', lifecycleSmoke),
      assertCheck(identityResponse.ok && identityResponse.json?.identity?.companyName === config.companyName, 'public product identity endpoint exposes the branded company name', identityResponse.json),
      assertCheck(identityResponse.json?.identity?.componentNames?.shellApp === 'SkyeQuanta Shell', 'public product identity endpoint exposes branded component names', identityResponse.json?.identity),
      assertCheck(identityResponse.json?.identity?.routeTemplates?.workspaceForwardedPort === '/w/:workspaceId/p/:port', 'public product identity endpoint exposes workspace forwarded port contract', identityResponse.json?.identity),
      assertCheck(statusResponse.ok && statusResponse.json?.urls?.productIdentity?.endsWith('/api/product/identity'), 'status endpoint exposes product identity URL metadata', statusResponse.json?.urls),
      assertCheck(catalogResponse.ok && catalogResponse.json?.catalog?.routes?.productIdentity?.endsWith('/api/product/identity'), 'control plane catalog exposes product identity route metadata', catalogResponse.json?.catalog)
    ];
    let payload = { stage: 9, label: 'stage-9-deployment-readiness', strict, generatedAt: new Date().toISOString(), proofCommand: 'npm run workspace:proof:stage9 -- --strict', prerequisiteProofCommand: 'npm run workspace:proof:stage8 -- --strict', doctorCommand: 'node apps/skyequanta-shell/bin/doctor.mjs --mode deploy --probe-active --json', lifecycleSmokeCommand: 'node apps/skyequanta-shell/bin/workspace-smoke-lifecycle.mjs', artifacts: { stage8Proof: stage8Payload, doctor: doctorPayload, lifecycleSmoke, identityResponse: identityResponse.json, statusResponse: statusResponse.json, catalogResponse: catalogResponse.json }, bridgeLogs, checks, pass: checks.every(item => item.pass) };
    payload = writeProofJson(proofFile, payload, config, 'workspace-proof-stage9.mjs');
    writeDeploymentReadinessReport(config, payload);
    if (strict && !payload.pass) { console.error(JSON.stringify(payload, null, 2)); process.exitCode = 1; return; }
    console.log(JSON.stringify(payload, null, 2));
  } finally { await terminateChild(bridgeChild, 'SIGTERM'); }
}
main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : String(error)); process.exitCode = 1; });
