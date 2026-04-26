import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

import { getProductIdentity, getStackConfig, getPublicSummary, getPublicUrls, withLocalBinPath } from './config.mjs';
import { ensureRuntimeState, getRuntimePaths, loadShellEnv } from '../lib/runtime.mjs';
import { commandAvailable, pkgConfigHas, ensureRuntimeDependencies, getDependencyEvidence } from '../lib/system-deps.mjs';
import { ensureDefaultWorkspace } from '../lib/workspace-manager.mjs';
import { getWorkspaceRegistryPath } from '../lib/workspace-registry.mjs';
import { getAuditLogPath, getGovernancePolicyPath } from '../lib/governance-manager.mjs';
import { getSessionStorePath } from '../lib/session-manager.mjs';
import { getSnapshotIndexPath, getSnapshotRetentionPolicyPath, getSnapshotRootDir } from '../lib/snapshot-manager.mjs';
import { getWorkspaceSchedulerPolicyPath, getWorkspaceSchedulerStatePath } from '../lib/workspace-scheduler.mjs';
import { buildProofPayloadWithCanonicalRuntime, printCanonicalRuntimeBannerForCommand } from '../lib/proof-runtime.mjs';

function parseArgs(argv) {
  const options = { mode: 'local', json: false, probeActive: false, bridgeUrl: null, repair: false, autoBridgeStart: true };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--json') { options.json = true; continue; }
    if (value === '--probe-active') { options.probeActive = true; continue; }
    if (value === '--repair') { options.repair = true; continue; }
    if (value === '--no-auto-bridge-start') { options.autoBridgeStart = false; continue; }
    if (value === '--mode' && argv[index + 1]) { options.mode = String(argv[index + 1] || 'local').trim().toLowerCase() || 'local'; index += 1; continue; }
    if (value.startsWith('--mode=')) { options.mode = String(value.split('=')[1] || 'local').trim().toLowerCase() || 'local'; continue; }
    if (value === '--bridge-url' && argv[index + 1]) { options.bridgeUrl = String(argv[index + 1] || '').trim() || null; index += 1; continue; }
    if (value.startsWith('--bridge-url=')) { options.bridgeUrl = String(value.split('=').slice(1).join('=') || '').trim() || null; }
  }
  if (!['local', 'deploy'].includes(options.mode)) throw new Error(`Unsupported doctor mode: ${options.mode}`);
  return options;
}
function checkPath(label, filePath, required = true) { return { label, ok: fs.existsSync(filePath), detail: filePath, required }; }
function checkCommand(command, required = true) { return { label: `command:${command}`, ok: commandAvailable(command, withLocalBinPath()), detail: command, required }; }
function checkSystemPackage(label, ok, detail, required = true) { return { label, ok, detail, required }; }
function checkDependencyEvidence(label, evidence, required = true) { return { label, ok: Boolean(evidence?.ok), detail: evidence?.detail || 'missing', required, source: evidence?.source || null }; }
function checkConfigValue(label, value, detail = value, required = true) { return { label, ok: Boolean(String(value || '').trim()), detail: String(detail || ''), required }; }
function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}
function checkNodeVersion() { const major = Number.parseInt(process.versions.node.split('.')[0], 10); return { label: 'node-version', ok: Number.isInteger(major) && major >= 22, detail: process.versions.node }; }
function printResult(result) { const prefix = result.ok ? '[ok]' : result.required === false ? '[warn]' : '[fail]'; console.log(`${prefix} ${result.label}: ${result.detail}`); }
function makeHeaderValue(token) { return token ? `Bearer ${token}` : ''; }
function buildRequiredHeaders(config) { const adminToken = String(config.auth?.adminToken || '').trim(); return adminToken ? { authorization: makeHeaderValue(adminToken) } : {}; }
async function fetchJson(url, options = {}) { const response = await fetch(url, options); const text = await response.text(); let json = null; try { json = JSON.parse(text); } catch {} return { response, status: response.status, ok: response.ok, text, json }; }
async function probeJson(label, url, validate, options = {}) {
  try {
    const result = await fetchJson(url, { headers: options.headers || {} });
    const payload = result.json;
    return { label, ok: Boolean(result.ok && validate(payload, result)), detail: `${url} -> ${result.status}`, required: options.required !== false, probe: { url, status: result.status, payload } };
  } catch (error) {
    return { label, ok: false, detail: `${url} -> ${error instanceof Error ? error.message : String(error)}`, required: options.required !== false, probe: { url, error: error instanceof Error ? error.message : String(error) } };
  }
}

async function canReachJson(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForBridge(bridgeUrl, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await canReachJson(`${bridgeUrl}/api/status`)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return false;
}

async function ensureBridgeForProbes(config, options) {
  if (!options.probeActive || options.autoBridgeStart === false) {
    return { attempted: false, started: false, detail: 'bridge auto-start disabled or probes not requested' };
  }
  const bridgeUrl = options.bridgeUrl || getPublicUrls(config).bridge;
  const alreadyUp = await canReachJson(`${bridgeUrl}/api/status`);
  if (alreadyUp) {
    return { attempted: false, started: true, detail: 'bridge already reachable' };
  }
  const runtimePaths = getRuntimePaths(config);
  const bridgeLogPath = path.join(runtimePaths.runtimeDir, 'doctor-auto-bridge.log');
  fs.mkdirSync(path.dirname(bridgeLogPath), { recursive: true });
  const out = fs.openSync(bridgeLogPath, 'a');
  const child = spawn(process.execPath, [path.join(config.shellDir, 'bin', 'bridge.mjs')], {
    cwd: config.rootDir,
    detached: true,
    stdio: ['ignore', out, out],
    env: withLocalBinPath(loadShellEnv(config))
  });
  child.unref();
  fs.closeSync(out);
  const started = await waitForBridge(bridgeUrl, 15000);
  return {
    attempted: true,
    started,
    detail: started ? `bridge auto-started (pid ${child.pid})` : `bridge auto-start attempted but status probe did not become healthy; see ${bridgeLogPath}`,
    logPath: bridgeLogPath,
    pid: child.pid
  };
}

function buildStaticResults(config, env, options) {
  const runtimePaths = getRuntimePaths(config);
  const defaultWorkspaceState = ensureDefaultWorkspace(config);
  const workspaceRegistryPath = getWorkspaceRegistryPath(config);
  const sessionStorePath = getSessionStorePath(config);
  const governancePolicyPath = getGovernancePolicyPath(config);
  const auditLogPath = getAuditLogPath(config);
  const snapshotRootDir = getSnapshotRootDir(config);
  const snapshotIndexPath = getSnapshotIndexPath(config);
  const snapshotRetentionPolicyPath = getSnapshotRetentionPolicyPath(config);
  const workspaceSchedulerPolicyPath = getWorkspaceSchedulerPolicyPath(config);
  const workspaceSchedulerStatePath = getWorkspaceSchedulerStatePath(config);
  const gateRequired = config.gateRuntime.mode === 'remote-gated';
  const publicUrls = getPublicUrls(config);
  const productIdentity = getProductIdentity(config);
  const defaultMachineProfile = config.lifecycle?.machineProfiles?.[config.lifecycle?.defaultMachineProfile || 'standard'];
  const buildToolRequired = options.mode !== 'deploy';
  const ideBundleRequired = options.mode !== 'deploy';
  const dependencyEvidence = getDependencyEvidence(config, env);
  const baseResults = [
    checkNodeVersion(), checkCommand('npm'), checkCommand('make'), checkDependencyEvidence('command:poetry', dependencyEvidence.poetry, buildToolRequired), checkCommand('pkg-config'), checkDependencyEvidence('pkg-config:xkbfile', dependencyEvidence.xkbfile, buildToolRequired),
    checkPath('root', config.rootDir), checkPath('agent-core', config.paths.agentCoreDir), checkPath('agent-server-app', config.paths.agentServerAppDir), checkPath('ide-core', config.paths.ideCoreDir), checkPath('ide-browser-example', config.paths.ideExampleDir), checkPath('runtime-env', runtimePaths.runtimeEnvFile), checkPath('workspace-registry', workspaceRegistryPath), checkPath('session-store', sessionStorePath), checkPath('governance-policy', governancePolicyPath), checkPath('audit-log', auditLogPath), checkPath('snapshot-root', snapshotRootDir), checkPath('snapshot-index', snapshotIndexPath), checkPath('snapshot-retention-policy', snapshotRetentionPolicyPath), checkPath('workspace-scheduler-policy', workspaceSchedulerPolicyPath), checkPath('workspace-scheduler-state', workspaceSchedulerStatePath),
    checkConfigValue('bridge-admin-token', config.auth?.adminToken || '', config.auth?.adminToken ? '[configured]' : 'missing SKYEQUANTA_ADMIN_TOKEN / OH_SECRET_KEY'),
    checkConfigValue('gate-runtime-mode', config.gateRuntime.mode, config.gateRuntime.mode),
    checkConfigValue('workspace-default-id', defaultWorkspaceState.workspace?.id || '', defaultWorkspaceState.workspace?.id || 'missing default workspace id'),
    checkPath('agent-config', runtimePaths.agentConfigTarget),
    checkConfigValue('gate-url', config.gate.url, config.gate.url || (gateRequired ? 'missing SKYEQUANTA_GATE_URL / OMEGA_GATE_URL' : 'not required for current mode'), gateRequired),
    checkConfigValue('gate-token', config.gate.token, config.gate.token ? '[configured]' : (gateRequired ? 'missing SKYEQUANTA_GATE_TOKEN / SKYEQUANTA_OSKEY' : 'not required for current mode'), gateRequired),
    checkConfigValue('gate-model', config.gate.model, config.gate.model),
    checkPath('ide-config-dir', runtimePaths.ideConfigDir), checkPath('ide-config-plugin-dir', runtimePaths.ideConfigPluginsDir), checkPath('ide-plugin-dir', runtimePaths.idePluginsDir), checkPath('ide-backend-settings', runtimePaths.ideBackendSettingsFile), checkPath('ide-cli-entrypoint', config.paths.ideCliEntrypoint, ideBundleRequired), checkDependencyEvidence('ide-browser-backend-entrypoint', dependencyEvidence.ideBrowserBackendEntrypoint, ideBundleRequired), checkPath('ide-webpack-config', config.paths.ideWebpackConfig), checkDependencyEvidence('ide-ripgrep-postinstall', dependencyEvidence.ideRipgrepPostinstall, ideBundleRequired), checkDependencyEvidence('ide-ripgrep-binary', dependencyEvidence.ideRipgrepBinary, ideBundleRequired), checkDependencyEvidence('ide-keytar-binding', dependencyEvidence.ideKeytarBinding, ideBundleRequired), checkDependencyEvidence('ide-frontend-index', dependencyEvidence.ideFrontendIndexHtml, ideBundleRequired), checkDependencyEvidence('ide-frontend-bundle', dependencyEvidence.ideFrontendBundle, ideBundleRequired), checkDependencyEvidence('ide-editor-worker-bundle', dependencyEvidence.ideEditorWorkerBundle, ideBundleRequired), checkDependencyEvidence('ide-backend-bundle', dependencyEvidence.ideBackendBundle, ideBundleRequired), checkDependencyEvidence('ide-node-pty-binding', dependencyEvidence.ideNodePtyBinding, ideBundleRequired), checkDependencyEvidence('ide-drivelist-binding', dependencyEvidence.ideDriveListBinding, ideBundleRequired)
  ];
  const deployResults = [
    checkPath('remote-executor-dir', runtimePaths.remoteExecutorDir), checkPath('remote-executor-script', config.paths.remoteExecutorScript), checkPath('remote-executor-state', runtimePaths.remoteExecutorStateFile), checkPath('remote-executor-runtimes', runtimePaths.remoteExecutorRuntimesFile), checkPath('remote-executor-log', runtimePaths.remoteExecutorLogFile), checkPath('workspace-runtime-root', runtimePaths.workspaceRuntimeRootDir), checkPath('workspace-volume-root', config.paths.workspaceVolumeRootDir), checkPath('workspace-retention-root', config.paths.workspaceRetentionRootDir), checkPath('workspace-secrets-root', config.paths.workspaceSecretsRootDir), checkPath('workspace-prebuild-root', config.paths.workspacePrebuildRootDir), checkConfigValue('control-plane-route-catalog', publicUrls.bridge ? `${publicUrls.bridge}/api/control-plane/catalog` : '', `${publicUrls.bridge}/api/control-plane/catalog`), checkConfigValue('product-identity-route', publicUrls.productIdentity, publicUrls.productIdentity), checkConfigValue('default-machine-profile', defaultMachineProfile?.name || '', defaultMachineProfile?.name || 'missing default machine profile'), checkConfigValue('component-name-shell', config.componentNames?.shellApp || '', config.componentNames?.shellApp || 'missing shell component name'), checkConfigValue('route-template-workspace-root', productIdentity.routeTemplates?.workspaceRoot || '', productIdentity.routeTemplates?.workspaceRoot || 'missing workspace route template'), checkConfigValue('route-template-forwarded-port', productIdentity.routeTemplates?.workspaceForwardedPort || '', productIdentity.routeTemplates?.workspaceForwardedPort || 'missing forwarded port route template')
  ];
  return options.mode === 'deploy' ? [...baseResults, ...deployResults] : baseResults;
}

async function buildProbeResults(config, options) {
  if (!options.probeActive) return [];
  const bridgeUrl = options.bridgeUrl || getPublicUrls(config).bridge;
  const headers = buildRequiredHeaders(config);
  const bridgeState = await ensureBridgeForProbes(config, options);
  const bridgeResult = {
    label: 'probe:bridge-auto-start',
    ok: bridgeState.started,
    detail: bridgeState.detail,
    required: false,
    probe: bridgeState
  };
  return [
    bridgeResult,
    await probeJson('probe:status', `${bridgeUrl}/api/status`, payload => Boolean(payload?.productName)),
    await probeJson('probe:runtime-contract', `${bridgeUrl}/api/runtime-contract`, payload => String(payload?.routes?.runtimeContract || '').endsWith('/api/runtime-contract')),
    await probeJson('probe:product-identity', `${bridgeUrl}/api/product/identity`, payload => payload?.identity?.routeTemplates?.workspaceForwardedPort === '/w/:workspaceId/p/:port'),
    await probeJson('probe:control-plane-catalog', `${bridgeUrl}/api/control-plane/catalog`, payload => Boolean(payload?.catalog?.routes?.productIdentity), { headers }),
    await probeJson('probe:workspaces', `${bridgeUrl}/api/workspaces`, payload => Array.isArray(payload?.workspaces), { headers })
  ];
}
async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseConfig = getStackConfig();
  ensureRuntimeState(baseConfig, process.env);
  const env = withLocalBinPath(loadShellEnv(baseConfig));
  const config = getStackConfig(env);

  if (options.repair) {
    await ensureRuntimeDependencies(config, env, { mode: options.mode });
  }

  printCanonicalRuntimeBannerForCommand(config, 'doctor.mjs', { stderr: options.json });
  const checks = [...buildStaticResults(config, env, options), ...await buildProbeResults(config, options)];
  const ok = checks.every(result => result.ok || result.required === false);
  const payload = buildProofPayloadWithCanonicalRuntime({ ok, mode: options.mode, probeActive: options.probeActive, repair: options.repair, generatedAt: new Date().toISOString(), summary: getPublicSummary(config), checks }, config, 'doctor.mjs');
  if (options.json) console.log(JSON.stringify(payload, null, 2));
  else { console.log(JSON.stringify(payload.summary, null, 2)); checks.forEach(printResult); if (ok) console.log('Doctor checks passed.'); }
  if (!ok) process.exitCode = 1;
}
main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : String(error)); process.exitCode = 1; });
