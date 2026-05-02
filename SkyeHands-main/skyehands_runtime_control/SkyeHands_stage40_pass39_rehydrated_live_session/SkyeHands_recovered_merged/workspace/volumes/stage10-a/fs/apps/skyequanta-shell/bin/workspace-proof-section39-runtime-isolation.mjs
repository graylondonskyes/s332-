#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { createWorkspace, deleteWorkspace } from '../lib/workspace-manager.mjs';
import { closeSession, openSession } from '../lib/session-manager.mjs';
import { applyRuntimeEgressHooks } from '../lib/runtime-egress.mjs';
import { buildWorkspaceIsolation, prepareWorkspaceIsolation, runIsolatedCommand } from '../lib/runtime-isolation.mjs';

function assertCheck(pass, message, detail = null) { return { pass: Boolean(pass), message, detail }; }

async function waitForUrl(url, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { ok: response.ok, status: response.status, json, text };
}

function spawnBridge(config, env) {
  const child = spawn(process.execPath, [path.join(config.shellDir, 'bin', 'bridge.mjs')], {
    cwd: config.shellDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const logs = [];
  child.stdout.on('data', chunk => logs.push(chunk.toString('utf8')));
  child.stderr.on('data', chunk => logs.push(chunk.toString('utf8')));
  return { child, logs };
}

function buildSandboxPaths(config) {
  const base = path.join(config.rootDir, 'dist', 'section39', 'workspace-sandbox');
  return {
    instanceDir: path.join(base, 'instance'),
    rootDir: path.join(base, 'instance'),
    fsDir: path.join(base, 'instance', 'fs'),
    homeDir: path.join(base, 'instance', 'home'),
    runtimeDir: path.join(base, 'instance', 'runtime'),
    logsDir: path.join(base, 'instance', 'logs'),
    configDir: path.join(base, 'instance', 'config'),
    volumeDir: path.join(base, 'volume'),
    retentionDir: path.join(base, 'retention'),
    secretStoreDir: path.join(base, 'secrets'),
    prebuildDir: path.join(base, 'prebuild')
  };
}

function runRuntimeIsolationSmoke(config, env) {
  const sandboxPaths = buildSandboxPaths(config);
  const isolation = prepareWorkspaceIsolation(buildWorkspaceIsolation(config, 'section39-isolated', sandboxPaths, env), sandboxPaths);
  const protectedDir = path.join(config.rootDir, 'dist', 'section39', 'protected');
  const protectedFile = path.join(protectedDir, 'root-only.txt');
  fs.mkdirSync(protectedDir, { recursive: true });
  fs.writeFileSync(protectedFile, 'root-only\n', 'utf8');
  fs.chmodSync(protectedDir, 0o700);
  fs.chmodSync(protectedFile, 0o600);

  const inspect = runIsolatedCommand(process.execPath, ['-e', 'console.log(JSON.stringify({uid:process.getuid(),gid:process.getgid(),cwd:process.cwd()}))'], {
    cwd: sandboxPaths.fsDir,
    env,
    isolation
  });
  const identity = JSON.parse(String(inspect.stdout || '{}').trim() || '{}');
  const writeDenied = runIsolatedCommand(process.execPath, ['-e', `require('node:fs').appendFileSync(${JSON.stringify(protectedFile)}, 'should-not-write')`], {
    cwd: sandboxPaths.fsDir,
    env,
    isolation
  });
  const writeAllowed = runIsolatedCommand(process.execPath, ['-e', `require('node:fs').writeFileSync(${JSON.stringify(path.join(sandboxPaths.fsDir, 'allowed.txt'))}, 'ok')`], {
    cwd: sandboxPaths.fsDir,
    env,
    isolation
  });

  return {
    ok: isolation.mode === 'os-user'
      && isolation.prepared
      && identity.uid === isolation.uid
      && identity.gid === isolation.gid
      && writeDenied.status !== 0
      && /EACCES|EPERM|permission/i.test(`${writeDenied.stderr} ${writeDenied.stdout}`)
      && writeAllowed.status === 0,
    isolation,
    identity,
    writeDenied,
    writeAllowed,
    protectedFile
  };
}

function runRuntimeEgressSmoke(config, env) {
  const runtimeHook = applyRuntimeEgressHooks(config, {
    ...env,
    SKYEQUANTA_RUNTIME_EGRESS_ALLOWED_HOSTS: 'api.github.com',
    SKYEQUANTA_RUNTIME_EGRESS_ALLOW_HTTP: '0'
  });
  const hookedEnv = runtimeHook.env;
  const pythonHookDirLiteral = JSON.stringify(runtimeHook.pythonHookDir);
  const nodeResult = spawnSync(process.execPath, ['-e', "fetch('http://127.0.0.1:9').catch(error => { console.error(error.message); process.exit(1); })"], {
    cwd: config.rootDir,
    env: hookedEnv,
    encoding: 'utf8'
  });
  const pythonHookFileLiteral = JSON.stringify(path.join(runtimeHook.pythonHookDir, 'sitecustomize.py'));
  const pythonResult = spawnSync('python3', ['-c', `import importlib.util, socket; spec = importlib.util.spec_from_file_location('skyehands_runtime_hook', ${pythonHookFileLiteral}); mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); socket.create_connection(('127.0.0.1', 9))`], {
    cwd: config.rootDir,
    env: hookedEnv,
    encoding: 'utf8'
  });
  return {
    ok: nodeResult.status !== 0
      && pythonResult.status !== 0
      && /runtime_egress_blocked/.test(`${nodeResult.stderr} ${nodeResult.stdout}`)
      && /runtime_egress_blocked/.test(`${pythonResult.stderr} ${pythonResult.stdout}`),
    node: { status: nodeResult.status, stdout: nodeResult.stdout, stderr: nodeResult.stderr },
    python: { status: pythonResult.status, stdout: pythonResult.stdout, stderr: pythonResult.stderr }
  };
}

async function runTenantIsolationSmoke(config, env) {
  const workspaceA = createWorkspace(config, 'section39-tenant-a', { source: 'section39', tenantId: 'tenant-one' }).workspace;
  const workspaceB = createWorkspace(config, 'section39-tenant-b', { source: 'section39', tenantId: 'tenant-two' }).workspace;
  const sessionA = openSession(config, { workspaceId: workspaceA.id, tenantId: 'tenant-one', clientName: 'section39-client-a', authSource: 'section39-proof' });
  const { child, logs } = spawnBridge(config, env);
  await waitForUrl(`http://${config.bridge.host}:${config.bridge.port}/health`);
  const sessionHeaders = { 'x-skyequanta-session-token': sessionA.accessToken, 'content-type': 'application/json' };
  const adminHeaders = { authorization: `Bearer ${env.SKYEQUANTA_ADMIN_TOKEN}`, 'content-type': 'application/json' };
  try {
    const matrix = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/security/tenant-isolation?workspaceId=${workspaceA.id}`, { headers: sessionHeaders });
    const crossTenant = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/workspaces/${workspaceB.id}`, { headers: sessionHeaders });
    const revoke = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/sessions/revoke-all`, {
      method: 'POST', headers: adminHeaders, body: JSON.stringify({ tenantId: 'tenant-one', workspaceId: workspaceA.id })
    });
    const afterRevoke = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/security/tenant-isolation?workspaceId=${workspaceA.id}`, { headers: sessionHeaders });
    return {
      ok: matrix.ok
        && matrix.json?.matrix?.denied?.crossTenantMutation === true
        && [401, 403].includes(crossTenant.status)
        && revoke.ok
        && revoke.json?.revoked >= 1
        && afterRevoke.status === 401,
      matrix,
      crossTenant,
      revoke,
      afterRevoke,
      bridgeLogsTail: logs.slice(-40)
    };
  } finally {
    child.kill('SIGTERM');
    try { closeSession(config, sessionA.id, null); } catch {}
  }
}

async function main() {
  const strict = process.argv.includes('--strict');
  const seed = Date.now() % 1000;
  const seededEnv = {
    ...process.env,
    SKYEQUANTA_BRIDGE_PORT: String(3500 + seed),
    SKYEQUANTA_REMOTE_EXECUTOR_PORT: String(3900 + seed),
    SKYEQUANTA_ADMIN_TOKEN: 'section39-admin-token',
    SKYEQUANTA_RUNTIME_ISOLATION_MODE: 'os-user',
    SKYEQUANTA_RUNTIME_ISOLATION_STRICT: '1',
    SKYEQUANTA_RUNTIME_EGRESS_ENABLED: '1',
    SKYEQUANTA_RUNTIME_EGRESS_ALLOW_HTTP: '0'
  };
  Object.assign(process.env, seededEnv);
  const baseConfig = getStackConfig(seededEnv);
  ensureRuntimeState(baseConfig, seededEnv);
  const env = withLocalBinPath(loadShellEnv(baseConfig));
  Object.assign(env, seededEnv);
  const config = getStackConfig(env);
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_39_RUNTIME_ISOLATION_AND_TENANT_PROOF.json');
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section39-runtime-isolation.mjs');

  let runtimeIsolation = null;
  let runtimeEgress = null;
  let tenantIsolation = null;
  try {
    runtimeIsolation = runRuntimeIsolationSmoke(config, env);
    runtimeEgress = runRuntimeEgressSmoke(config, env);
    tenantIsolation = await runTenantIsolationSmoke(config, env);

    const checks = [
      assertCheck(runtimeIsolation.ok, 'workspace isolation lane allocates dedicated OS user ids and blocks writes to root-only host paths', runtimeIsolation),
      assertCheck(runtimeEgress.ok, 'node and python runtime egress hooks block local/private outbound targets before connection', runtimeEgress),
      assertCheck(tenantIsolation.ok, 'tenant isolation matrix endpoint proves scope and revoked sessions lose access immediately', tenantIsolation)
    ];

    let payload = {
      section: 39,
      label: 'section-39-runtime-isolation-and-tenant-proof',
      generatedAt: new Date().toISOString(),
      strict,
      proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section39-runtime-isolation.mjs --strict',
      smokeCommand: 'bash scripts/smoke-section39-runtime-isolation.sh',
      pass: checks.every(item => item.pass),
      checks,
      evidence: { runtimeIsolation, runtimeEgress, tenantIsolation }
    };
    payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section39-runtime-isolation.mjs');
    if (strict && !payload.pass) throw new Error('Section 39 runtime isolation proof failed in strict mode.');
    console.log(JSON.stringify(payload, null, 2));
  } finally {
    for (const workspaceId of ['section39-tenant-a', 'section39-tenant-b']) {
      try { deleteWorkspace(config, workspaceId, { deletedBy: 'section39-cleanup' }); } catch {}
    }
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
