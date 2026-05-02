#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { getStackConfig, withLocalBinPath } from '../apps/skyequanta-shell/bin/config.mjs';
import { ensureRuntimeState, loadShellEnv } from '../apps/skyequanta-shell/lib/runtime.mjs';
import { applyRuntimeEgressHooks } from '../apps/skyequanta-shell/lib/runtime-egress.mjs';
import { buildWorkspaceIsolation } from '../apps/skyequanta-shell/lib/runtime-isolation.mjs';
import { createWorkspace, deleteWorkspace } from '../apps/skyequanta-shell/lib/workspace-manager.mjs';
import { closeSession, openSession } from '../apps/skyequanta-shell/lib/session-manager.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifactPath = path.join(root, 'SMOKE_P012_RUNTIME_ISOLATION_CONTAINMENT.md');

function check(condition, label, detail = null) {
  return { pass: Boolean(condition), label, detail };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { ok: response.ok, status: response.status, json, text };
}

async function waitForUrl(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return false;
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

function runEgressContainment(env) {
  const hook = applyRuntimeEgressHooks(getStackConfig(env), {
    ...env,
    SKYEQUANTA_RUNTIME_EGRESS_ALLOWED_HOSTS: 'api.github.com',
    SKYEQUANTA_RUNTIME_EGRESS_ALLOW_HTTP: '0'
  });
  const node = spawn(process.execPath, ['-e', "fetch('http://127.0.0.1:9').catch(error => { console.error(error.message); process.exit(1); })"], {
    cwd: root,
    env: hook.env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  return new Promise((resolve) => {
    const out = [];
    const err = [];
    node.stdout.on('data', c => out.push(String(c)));
    node.stderr.on('data', c => err.push(String(c)));
    node.on('exit', (code) => {
      const text = `${out.join('')}\n${err.join('')}`;
      resolve({ ok: code !== 0 && /runtime_egress_blocked/.test(text), code, text: text.trim() });
    });
  });
}

async function runTenantContainment(config, env) {
  const wsA = createWorkspace(config, 'p012-tenant-a', { source: 'p012-smoke', tenantId: 'tenant-p012-a' }).workspace;
  const wsB = createWorkspace(config, 'p012-tenant-b', { source: 'p012-smoke', tenantId: 'tenant-p012-b' }).workspace;
  const session = openSession(config, {
    workspaceId: wsA.id,
    tenantId: 'tenant-p012-a',
    clientName: 'p012-smoke-client',
    authSource: 'p012-smoke'
  });
  const { child, logs } = spawnBridge(config, env);
  const headers = { 'x-skyequanta-session-token': session.accessToken, 'content-type': 'application/json' };
  const adminHeaders = { authorization: `Bearer ${env.SKYEQUANTA_ADMIN_TOKEN}`, 'content-type': 'application/json' };

  try {
    const healthy = await waitForUrl(`http://${config.bridge.host}:${config.bridge.port}/health`);
    if (!healthy) {
      return { ok: false, reason: 'bridge_not_healthy', logsTail: logs.slice(-40) };
    }

    const matrix = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/security/tenant-isolation?workspaceId=${wsA.id}`, { headers });
    const crossTenant = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/workspaces/${wsB.id}`, { headers });
    const revoke = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/sessions/revoke-all`, {
      method: 'POST', headers: adminHeaders, body: JSON.stringify({ tenantId: 'tenant-p012-a', workspaceId: wsA.id })
    });
    const afterRevoke = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/security/tenant-isolation?workspaceId=${wsA.id}`, { headers });

    return {
      ok: matrix.ok
        && matrix.json?.matrix?.denied?.crossTenantMutation === true
        && [401, 403].includes(crossTenant.status)
        && revoke.ok
        && (revoke.json?.revoked || 0) >= 1
        && afterRevoke.status === 401,
      matrix,
      crossTenant,
      revoke,
      afterRevoke,
      logsTail: logs.slice(-40)
    };
  } finally {
    child.kill('SIGTERM');
    try { closeSession(config, session.id, null); } catch {}
    try { await deleteWorkspace(config, wsA.id, { deletedBy: 'p012-smoke' }); } catch {}
    try { await deleteWorkspace(config, wsB.id, { deletedBy: 'p012-smoke' }); } catch {}
  }
}

async function main() {
  const seed = Date.now() % 1000;
  const seededEnv = {
    ...process.env,
    SKYEQUANTA_BRIDGE_PORT: String(3600 + seed),
    SKYEQUANTA_REMOTE_EXECUTOR_PORT: String(3950 + seed),
    SKYEQUANTA_ADMIN_TOKEN: 'p012-admin-token',
    SKYEQUANTA_RUNTIME_ISOLATION_MODE: 'process',
    SKYEQUANTA_RUNTIME_ISOLATION_STRICT: '1',
    SKYEQUANTA_RUNTIME_EGRESS_ENABLED: '1',
    SKYEQUANTA_RUNTIME_EGRESS_ALLOW_HTTP: '0'
  };
  const baseConfig = getStackConfig(seededEnv);
  ensureRuntimeState(baseConfig, seededEnv);
  const env = withLocalBinPath(loadShellEnv(baseConfig));
  Object.assign(env, seededEnv);
  const config = getStackConfig(env);

  const isolationProfile = buildWorkspaceIsolation(config, 'p012-evidence', {}, env);
  const egress = await runEgressContainment(env);
  const tenant = await runTenantContainment(config, env);

  const checks = [
    check(isolationProfile.requestedMode === 'process' && isolationProfile.mode === 'process' && isolationProfile.strict === true && isolationProfile.supported === true, 'runtime isolation policy enforces strict process-lane containment mode', isolationProfile),
    check(egress.ok, 'runtime egress hook blocks local/private outbound targets', { code: egress.code, text: egress.text }),
    check(tenant.ok, 'tenant isolation blocks cross-tenant access and revoked sessions immediately lose access', {
      matrixStatus: tenant.matrix?.status,
      crossTenantStatus: tenant.crossTenant?.status,
      revokeStatus: tenant.revoke?.status,
      afterRevokeStatus: tenant.afterRevoke?.status
    })
  ];

  const pass = checks.every(item => item.pass);
  const lines = [
    '# P012 Smoke Proof — Runtime Isolation & Containment Controls',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Checks: ${checks.length}`,
    `Failed Checks: ${checks.filter(item => !item.pass).length}`,
    `Status: ${pass ? 'PASS' : 'FAIL'}`,
    '',
    '## Checks',
    ...checks.map(item => `- ${item.pass ? 'PASS' : 'FAIL'} | ${item.label}`),
    '',
    '## Summary JSON',
    '```json',
    JSON.stringify({ pass, checks }, null, 2),
    '```',
    ''
  ];

  fs.writeFileSync(artifactPath, lines.join('\n'), 'utf8');
  console.log(JSON.stringify({ pass, artifact: path.relative(root, artifactPath), failed: checks.filter(item => !item.pass).map(item => item.label) }, null, 2));
  if (!pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
