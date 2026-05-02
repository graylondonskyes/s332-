import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { getStackConfig } from './config.mjs';
import { createWorkspace, startWorkspace, stopWorkspace } from '../lib/workspace-manager.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';

function ensureDirectory(dirPath) { fs.mkdirSync(dirPath, { recursive: true }); }
function writeJson(filePath, payload) { ensureDirectory(path.dirname(filePath)); fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}
`, 'utf8'); }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function terminatePid(pid, signal = 'SIGTERM') { if (!Number.isInteger(pid) || pid <= 0) return; try { process.kill(pid, signal); } catch {} }
function assertCheck(condition, message, detail = null) { return { pass: Boolean(condition), message, detail }; }

async function waitForJson(url, options = {}, timeoutMs = 15000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, options);
      const json = await response.json();
      if (response.ok) {
        return { response, json };
      }
      lastError = new Error(json?.detail || json?.error || `HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

async function main() {
  const strict = process.argv.includes('--strict');
  process.env.SKYEQUANTA_ADMIN_TOKEN = process.env.SKYEQUANTA_ADMIN_TOKEN || 'stage6-admin-token';
  process.env.SKYEQUANTA_BRIDGE_PORT = process.env.SKYEQUANTA_BRIDGE_PORT || '4720';
  process.env.SKYEQUANTA_REMOTE_EXECUTOR_PORT = process.env.SKYEQUANTA_REMOTE_EXECUTOR_PORT || '4721';
  process.env.SKYEQUANTA_MACHINE_PROFILE = process.env.SKYEQUANTA_MACHINE_PROFILE || 'standard';
  const config = getStackConfig(process.env);
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-stage6.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'STAGE_6_ADMIN_CONTROL_PLANE.json');

  const headers = {
    'authorization': `Bearer ${process.env.SKYEQUANTA_ADMIN_TOKEN}`,
    'content-type': 'application/json'
  };

  const bridgeChild = spawn(process.execPath, [path.join(config.shellDir, 'bin', 'bridge.mjs')], {
    cwd: config.rootDir,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true
  });

  const bridgeLogs = [];
  bridgeChild.stdout.on('data', chunk => bridgeLogs.push(chunk.toString('utf8')));
  bridgeChild.stderr.on('data', chunk => bridgeLogs.push(chunk.toString('utf8')));

  try {
    await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/status`, {}, 20000);

    createWorkspace(config, 'tenant-alpha-admin', { name: 'Tenant Alpha Admin', tenantId: 'tenant-alpha', source: 'stage6-proof' });
    createWorkspace(config, 'tenant-beta-admin', { name: 'Tenant Beta Admin', tenantId: 'tenant-beta', source: 'stage6-proof' });
    await startWorkspace(config, 'tenant-alpha-admin', 'stage6_proof_start');

    const catalog = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/control-plane/catalog`, { headers }, 10000);
    const policyUpdate = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/governance/policy`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ limits: { maxWorkspaces: 24, maxSessions: 300, maxForwardedPortsPerWorkspace: 20 } })
    }, 10000);
    const policyRead = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/governance/policy`, { headers }, 10000);
    const tenantSummary = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/control-plane/tenants`, { headers }, 10000);
    const summary = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/control-plane/summary`, { headers }, 10000);

    terminatePid(bridgeChild.pid, 'SIGTERM');
    await delay(1000);

    const bridgeChild2 = spawn(process.execPath, [path.join(config.shellDir, 'bin', 'bridge.mjs')], {
      cwd: config.rootDir,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true
    });
    bridgeChild2.stdout.on('data', chunk => bridgeLogs.push(chunk.toString('utf8')));
    bridgeChild2.stderr.on('data', chunk => bridgeLogs.push(chunk.toString('utf8')));

    try {
      await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/status`, {}, 20000);
      const catalogAfterRestart = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/control-plane/catalog`, { headers }, 10000);
      const policyAfterRestart = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/governance/policy`, { headers }, 10000);
      const tenantSummaryAfterRestart = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/control-plane/tenants`, { headers }, 10000);

      const alphaTenant = tenantSummary.json.tenants.find(item => item.tenantId === 'tenant-alpha');
      const betaTenant = tenantSummary.json.tenants.find(item => item.tenantId === 'tenant-beta');
      const alphaTenantAfterRestart = tenantSummaryAfterRestart.json.tenants.find(item => item.tenantId === 'tenant-alpha');

      const checks = [
        assertCheck(Array.isArray(catalog.json?.catalog?.machineProfiles) && catalog.json.catalog.machineProfiles.length >= 3, 'catalog exposes machine profiles', catalog.json?.catalog),
        assertCheck(Boolean(catalog.json?.catalog?.routes?.controlPlaneCatalog), 'catalog exposes control-plane routes', catalog.json?.catalog?.routes),
        assertCheck(policyUpdate.json?.policy?.limits?.maxWorkspaces === 24, 'policy update endpoint persists maxWorkspaces', policyUpdate.json?.policy),
        assertCheck(policyRead.json?.policy?.limits?.maxSessions === 300, 'policy read returns updated maxSessions', policyRead.json?.policy),
        assertCheck(Boolean(alphaTenant && alphaTenant.workspaces.total >= 1), 'tenant summary reports tenant-alpha workspace count', alphaTenant),
        assertCheck(Boolean(betaTenant && betaTenant.workspaces.total >= 1), 'tenant summary reports tenant-beta workspace count', betaTenant),
        assertCheck(summary.json?.workspaces?.total >= 2, 'control-plane summary reports workspace totals', summary.json?.workspaces),
        assertCheck(policyAfterRestart.json?.policy?.limits?.maxWorkspaces === 24, 'policy survives fresh bridge restart', policyAfterRestart.json?.policy),
        assertCheck(Boolean(alphaTenantAfterRestart && alphaTenantAfterRestart.workspaces.running >= 1), 'tenant running-state survives fresh bridge restart', alphaTenantAfterRestart),
        assertCheck(Boolean(catalogAfterRestart.json?.catalog?.lifecycle?.defaultMachineProfile), 'catalog survives fresh bridge restart', catalogAfterRestart.json?.catalog)
      ];

      const failed = checks.filter(item => !item.pass);
      let payload = {
        stage: 6,
        label: 'stage-6-admin-control-plane',
        strict,
        generatedAt: new Date().toISOString(),
        proofCommand: 'npm run workspace:proof:stage6 -- --strict',
        endpoints: {
          catalog: `http://${config.bridge.host}:${config.bridge.port}/api/control-plane/catalog`,
          tenants: `http://${config.bridge.host}:${config.bridge.port}/api/control-plane/tenants`,
          summary: `http://${config.bridge.host}:${config.bridge.port}/api/control-plane/summary`,
          governancePolicy: `http://${config.bridge.host}:${config.bridge.port}/api/governance/policy`
        },
        artifacts: {
          catalog: catalog.json,
          policyUpdate: policyUpdate.json,
          policyRead: policyRead.json,
          tenantSummary: tenantSummary.json,
          summary: summary.json,
          catalogAfterRestart: catalogAfterRestart.json,
          policyAfterRestart: policyAfterRestart.json,
          tenantSummaryAfterRestart: tenantSummaryAfterRestart.json
        },
        bridgeLogs,
        checks,
        pass: failed.length === 0
      };

      payload = writeProofJson(proofFile, payload, config, 'workspace-proof-stage6.mjs');
      if (strict && failed.length > 0) {
        console.error(JSON.stringify(payload, null, 2));
        process.exitCode = 1;
      } else {
        console.log(JSON.stringify(payload, null, 2));
      }
    } finally {
      terminatePid(bridgeChild2.pid, 'SIGTERM');
      await delay(1000);
    }
  } finally {
    await stopWorkspace(config, 'tenant-alpha-admin', 'stage6_cleanup').catch(() => {});
    await stopWorkspace(config, 'tenant-beta-admin', 'stage6_cleanup').catch(() => {});
    terminatePid(bridgeChild.pid, 'SIGTERM');
    await delay(500);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
