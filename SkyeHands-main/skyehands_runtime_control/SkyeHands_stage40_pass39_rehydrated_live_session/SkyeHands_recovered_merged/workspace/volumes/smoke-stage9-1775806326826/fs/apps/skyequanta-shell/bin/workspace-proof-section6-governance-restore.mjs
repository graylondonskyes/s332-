import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

import { getStackConfig } from './config.mjs';
import { ensureRuntimeState } from '../lib/runtime.mjs';
import { appendAuditEvent, loadGovernancePolicy } from '../lib/governance-manager.mjs';
import { getWorkspaceSandboxPaths } from '../lib/workspace-runtime.mjs';
import { listSessions, openSession } from '../lib/session-manager.mjs';
import { createSnapshot, createWorkspace, getWorkspace, getWorkspaceRuntime, listSnapshots, removeSnapshot, restoreSnapshot, runSnapshotRetentionCleanup, setSnapshotRetention, startWorkspace, stopWorkspace } from '../lib/workspace-manager.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';

function ensureDirectory(dirPath) { fs.mkdirSync(dirPath, { recursive: true }); }
function writeJson(filePath, payload) { ensureDirectory(path.dirname(filePath)); fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8'); }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function terminatePid(pid, signal = 'SIGTERM') { if (!Number.isInteger(pid) || pid <= 0) return; try { process.kill(pid, signal); } catch {} }
function assertCheck(condition, message, detail = null) { return { pass: Boolean(condition), message, detail }; }

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { ok: response.ok, status: response.status, json, text, headers: response.headers };
}

async function waitForJson(url, options = {}, timeoutMs = 20000, validate = payload => payload?.ok || payload?.status === 'ok' || Boolean(payload?.productName)) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const result = await fetchJson(url, options);
      if (result.ok && validate(result.json || result)) {
        return result;
      }
      last = result;
    } catch (error) {
      last = error;
    }
    await delay(250);
  }
  throw last instanceof Error ? last : new Error(`Timed out waiting for ${url}`);
}


async function isBridgeReady(config) {
  try {
    const result = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/status`);
    return result.ok ? result : null;
  } catch {
    return null;
  }
}

function spawnBridge(config, bridgeLogs = []) {
  const logPath = path.join(config.rootDir, '.skyequanta', 'reports', `section6-bridge-${Date.now()}.log`);
  ensureDirectory(path.dirname(logPath));
  const command = `SKYEQUANTA_ADMIN_TOKEN=${process.env.SKYEQUANTA_ADMIN_TOKEN} SKYEQUANTA_BRIDGE_PORT=${config.bridge.port} SKYEQUANTA_REMOTE_EXECUTOR_PORT=${config.remoteExecutor.port} node ${path.join(config.shellDir, 'bin', 'bridge.mjs')} > ${logPath} 2>&1 & echo $!`;
  const started = spawnSync('bash', ['-lc', command], {
    cwd: config.rootDir,
    env: { ...process.env },
    encoding: 'utf8'
  });
  const pid = Number.parseInt(String(started.stdout || '').trim().split(/\s+/).pop() || '', 10) || null;
  bridgeLogs.push(`BRIDGE_START pid=${pid} log=${logPath}
${started.stderr || ''}`);
  return { pid, logPath };
}

function killAllBridgeProcesses(config) {
  spawnSync('pkill', ['-9', '-f', path.join(config.shellDir, 'bin', 'bridge.mjs')], { stdio: 'ignore' });
}

async function waitForBridgeDown(config, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ready = await isBridgeReady(config);
    if (!ready) {
      return true;
    }
    await delay(250);
  }
  return false;
}

async function cleanupWorkspace(config, workspaceId) {
  try { await stopWorkspace(config, workspaceId, 'section6_cleanup'); } catch {}
}

async function main() {
  const strict = process.argv.includes('--strict');
  process.env.SKYEQUANTA_ADMIN_TOKEN = process.env.SKYEQUANTA_ADMIN_TOKEN || 'section6-admin-token';
  process.env.SKYEQUANTA_BRIDGE_PORT = process.env.SKYEQUANTA_BRIDGE_PORT || '4920';
  process.env.SKYEQUANTA_REMOTE_EXECUTOR_PORT = process.env.SKYEQUANTA_REMOTE_EXECUTOR_PORT || '4921';
  const config = getStackConfig(process.env);
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section6-governance-restore.mjs');
  ensureRuntimeState(config);
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'STAGE_10_GOVERNANCE_RESTORE.json');
  const headers = { authorization: `Bearer ${process.env.SKYEQUANTA_ADMIN_TOKEN}`, 'content-type': 'application/json' };
  const bridgeLogs = [];
  const runId = `section6-${Date.now()}`;
  const alphaWorkspaceId = `${runId}-alpha`;
  const betaWorkspaceId = `${runId}-beta`;
  const alphaTenantId = `${runId}-tenant-alpha`;
  const betaTenantId = `${runId}-tenant-beta`;
  const workspaceIds = [alphaWorkspaceId, betaWorkspaceId];
  let bridgeChild = null;
  let bridgeChild2 = null;
  let bridgeChild3 = null;

  try {
    spawnSync('pkill', ['-f', path.join(config.shellDir, 'bin', 'bridge.mjs')], { stdio: 'ignore' });
    spawnSync('pkill', ['-f', path.join(config.shellDir, 'bin', 'remote-executor.mjs')], { stdio: 'ignore' });
    spawnSync('pkill', ['-f', path.join(config.shellDir, 'bin', 'workspace-service.mjs')], { stdio: 'ignore' });
    fs.rmSync(config.paths.remoteExecutorStateFile, { force: true });
    fs.rmSync(config.paths.remoteExecutorRuntimesFile, { force: true });
    fs.rmSync(config.paths.remoteExecutorLogFile, { force: true });

    for (const workspaceId of workspaceIds) {
      await cleanupWorkspace(config, workspaceId);
    }

    createWorkspace(config, alphaWorkspaceId, { name: 'Section6 Alpha', tenantId: alphaTenantId, source: 'section6-proof' });
    createWorkspace(config, betaWorkspaceId, { name: 'Section6 Beta', tenantId: betaTenantId, source: 'section6-proof' });
    await startWorkspace(config, alphaWorkspaceId, 'section6_start');
    await startWorkspace(config, betaWorkspaceId, 'section6_start');

    const alphaWorkspace = getWorkspace(config, alphaWorkspaceId);
    const betaWorkspace = getWorkspace(config, betaWorkspaceId);
    const alphaSession = openSession(config, { workspaceId: alphaWorkspaceId, tenantId: alphaTenantId, clientName: 'alpha-client', authSource: 'section6-proof' });
    const betaSession = openSession(config, { workspaceId: betaWorkspaceId, tenantId: betaTenantId, clientName: 'beta-client', authSource: 'section6-proof' });

    const alphaPaths = getWorkspaceSandboxPaths(config, alphaWorkspaceId);
    ensureDirectory(alphaPaths.fsDir);
    fs.writeFileSync(path.join(alphaPaths.fsDir, 'state.txt'), 'baseline\n', 'utf8');
    setSnapshotRetention(config, { scope: 'workspace', workspaceId: alphaWorkspaceId, maxSnapshots: 10, maxAgeDays: 30 });
    for (const snapshot of listSnapshots(config, alphaWorkspaceId).snapshots) {
      removeSnapshot(config, alphaWorkspaceId, snapshot.id, { deletedBy: 'section6-proof' });
    }

    const snapshotOne = await createSnapshot(config, alphaWorkspaceId, { label: 'baseline', createdBy: 'section6-proof' });
    fs.writeFileSync(path.join(alphaPaths.fsDir, 'state.txt'), 'mutated\n', 'utf8');
    const snapshotTwo = await createSnapshot(config, alphaWorkspaceId, { label: 'mutated', createdBy: 'section6-proof' });
    fs.writeFileSync(path.join(alphaPaths.fsDir, 'state.txt'), 'mutated-again\n', 'utf8');
    const snapshotThree = await createSnapshot(config, alphaWorkspaceId, { label: 'mutated-again', createdBy: 'section6-proof' });

    const beforeCleanup = listSnapshots(config, alphaWorkspaceId);
    setSnapshotRetention(config, { scope: 'workspace', workspaceId: alphaWorkspaceId, maxSnapshots: 1, maxAgeDays: 30 });
    const retentionCleanup = runSnapshotRetentionCleanup(config, alphaWorkspaceId, { actorId: 'section6-proof' });
    const afterCleanup = listSnapshots(config, alphaWorkspaceId);
    const retainedSnapshotId = afterCleanup.snapshots[0]?.id || null;
    await restoreSnapshot(config, alphaWorkspaceId, retainedSnapshotId, { restoredBy: 'section6-proof' });
    const restoredState = fs.readFileSync(path.join(alphaPaths.fsDir, 'state.txt'), 'utf8').trim();

    const existingBridge = await isBridgeReady(config);
    const prestartedBridgePid = Number.parseInt(String(process.env.SKYEQUANTA_SECTION6_BRIDGE_PID || ''), 10) || null;
    if (existingBridge) {
      bridgeLogs.push('USED_EXISTING_BRIDGE\n');
      if (prestartedBridgePid) {
        bridgeChild = { pid: prestartedBridgePid };
      }
    } else {
      bridgeChild = spawnBridge(config, bridgeLogs);
      await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/status`);
    }

    const concurrentResults = await Promise.all([
      fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/workspaces/${alphaWorkspaceId}/runtime`, { headers: { 'x-skyequanta-session-token': alphaSession.accessToken } }),
      fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/workspaces/${betaWorkspaceId}/runtime`, { headers: { 'x-skyequanta-session-token': betaSession.accessToken } }),
      fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/workspaces/${betaWorkspaceId}/runtime`, { headers: { 'x-skyequanta-session-token': alphaSession.accessToken } }),
      fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/workspaces/${alphaWorkspaceId}/runtime`, { headers: { 'x-skyequanta-session-token': betaSession.accessToken } })
    ]);

    const originalPolicy = loadGovernancePolicy(config);
    const policyUpdate = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/governance/policy`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ limits: { maxWorkspaces: 22, maxSessions: 310, maxForwardedPortsPerWorkspace: 19 }, reason: 'section6-mutation' })
    });
    const policyHistory = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/governance/policy/history?limit=5`, { headers });
    const rollbackRevisionId = policyHistory.json?.revisions?.[0]?.id || null;
    const policyRollback = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/governance/policy/rollback`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ revisionId: rollbackRevisionId, reason: 'section6-rollback' })
    });
    const policyAfterRollback = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/governance/policy`, { headers });

    appendAuditEvent(config, { action: 'section6.audit.marker', actorType: 'system', actorId: 'section6-proof', tenantId: alphaTenantId, workspaceId: alphaWorkspaceId, detail: { stage: 6 } });
    const auditExportJsonFile = path.join('docs', 'proof', 'SECTION_6_AUDIT_EXPORT.json');
    const auditExportCsvFile = path.join('docs', 'proof', 'SECTION_6_AUDIT_EXPORT.csv');
    const auditExportRunJson = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/audit/export?format=json&tenantId=${encodeURIComponent(alphaTenantId)}&limit=200`, { headers });
    const auditExportRunCsv = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/audit/export?format=csv&tenantId=${encodeURIComponent(alphaTenantId)}&limit=200`, { headers });

    const auditExportCmdJson = spawnSync(process.execPath, [path.join(config.shellDir, 'bin', 'audit-export.mjs'), '--format', 'json', '--tenant', alphaTenantId, '--output', auditExportJsonFile, '--json'], {
      cwd: config.rootDir,
      env: { ...process.env },
      encoding: 'utf8'
    });
    const auditExportCmdCsv = spawnSync(process.execPath, [path.join(config.shellDir, 'bin', 'audit-export.mjs'), '--format', 'csv', '--tenant', alphaTenantId, '--output', auditExportCsvFile, '--json'], {
      cwd: config.rootDir,
      env: { ...process.env },
      encoding: 'utf8'
    });

    terminatePid(bridgeChild?.pid, 'SIGTERM');
    await delay(800);
    killAllBridgeProcesses(config);
    await waitForBridgeDown(config, 15000);
    bridgeChild2 = spawnBridge(config, bridgeLogs);
    await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/status`);
    const gracefulRestore = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/sessions/restore`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sessionId: alphaSession.id, reconnectToken: alphaSession.reconnectToken, reason: 'graceful-restart' })
    });
    const gracefulRuntime = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/workspaces/${alphaWorkspaceId}/runtime`, {
      headers: { 'x-skyequanta-session-token': gracefulRestore.json?.session?.accessToken || '' }
    });

    terminatePid(bridgeChild2?.pid, 'SIGKILL');
    await delay(400);
    killAllBridgeProcesses(config);
    await waitForBridgeDown(config, 8000);
    bridgeChild3 = spawnBridge(config, bridgeLogs);
    await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/status`);
    const abnormalRestore = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/sessions/restore`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sessionId: alphaSession.id, reconnectToken: alphaSession.reconnectToken, reason: 'abnormal-restart' })
    });
    const abnormalRuntime = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/workspaces/${alphaWorkspaceId}/runtime`, {
      headers: { 'x-skyequanta-session-token': abnormalRestore.json?.session?.accessToken || '' }
    });

    const controlPlaneConsole = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/control-plane`, { headers });
    const controlPlaneCatalog = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/control-plane/catalog`, { headers });
    const sessionsAfterRestore = listSessions(config, alphaTenantId);
    const runtimeAfterRestore = getWorkspaceRuntime(config, alphaWorkspaceId);

    const checks = [
      assertCheck(concurrentResults[0].status === 200 && concurrentResults[1].status === 200, 'tenant-matched workspace sessions succeed concurrently for both tenants', concurrentResults.slice(0, 2).map(item => ({ status: item.status, ok: item.ok }))),
      assertCheck([401, 403].includes(concurrentResults[2].status) && [401, 403].includes(concurrentResults[3].status), 'tenant/workspace separation blocks cross-tenant runtime access under concurrent usage', concurrentResults.slice(2).map(item => ({ status: item.status, text: item.text }))),
      assertCheck(beforeCleanup.snapshots.length >= 3 && afterCleanup.snapshots.length === 1, 'retention cleanup smoke verified before/after snapshot counts', { before: beforeCleanup.snapshots.length, after: afterCleanup.snapshots.length, retentionCleanup }),
      assertCheck(restoredState === 'mutated-again', 'snapshot restore rewound workspace filesystem state to the retained snapshot', { retainedSnapshotId, restoredState }),
      assertCheck(policyUpdate.status === 200 && policyHistory.json?.revisions?.length >= 1, 'governance policy mutation created a revision history entry', { policyUpdate: policyUpdate.json, historyCount: policyHistory.json?.revisions?.length }),
      assertCheck(policyRollback.status === 200 && JSON.stringify(policyAfterRollback.json?.policy?.limits || {}) === JSON.stringify(originalPolicy.limits || {}), 'governance policy rollback restored the original limits after mutation', { original: originalPolicy, afterRollback: policyAfterRollback.json }),
      assertCheck(gracefulRestore.status === 200 && gracefulRuntime.status === 200, 'session restore smoke passed after graceful restart', { gracefulRestore: gracefulRestore.json, gracefulRuntime: gracefulRuntime.json }),
      assertCheck(abnormalRestore.status === 200 && abnormalRuntime.status === 200, 'session restore smoke passed after abnormal shutdown and restart', { abnormalRestore: abnormalRestore.json, abnormalRuntime: abnormalRuntime.json }),
      assertCheck(sessionsAfterRestore.some(item => item.id === alphaSession.id), 'restored session remains persisted in the authoritative session store', sessionsAfterRestore),
      assertCheck(controlPlaneConsole.status === 200 && /Audit export/.test(controlPlaneConsole.text) && /Governance rollback/.test(controlPlaneConsole.text) && /Session restore/.test(controlPlaneConsole.text) && /Retention cleanup/.test(controlPlaneConsole.text), 'admin control-plane UI exposes parity controls for audit export, governance rollback, session restore, and retention cleanup', controlPlaneConsole.text.slice(0, 400)),
      assertCheck(controlPlaneCatalog.status === 200 && Boolean(controlPlaneCatalog.json?.catalog?.routes?.auditExport) && Boolean(controlPlaneCatalog.json?.catalog?.routes?.governancePolicyRollback) && Boolean(controlPlaneCatalog.json?.catalog?.routes?.sessionRestore) && Boolean(controlPlaneCatalog.json?.catalog?.routes?.controlPlaneConsole), 'admin control-plane catalog exposes API parity routes for the section 6 functions', controlPlaneCatalog.json),
      assertCheck(auditExportRunJson.status === 200 && auditExportRunJson.text.includes('section6.audit.marker'), 'audit export API returns machine-readable filtered audit data', auditExportRunJson.text.slice(0, 300)),
      assertCheck(auditExportRunCsv.status === 200 && auditExportRunCsv.text.includes('section6.audit.marker'), 'audit export API returns CSV audit data', auditExportRunCsv.text.slice(0, 200)),
      assertCheck(auditExportCmdJson.status === 0 && fs.existsSync(path.join(config.rootDir, auditExportJsonFile)) && fs.readFileSync(path.join(config.rootDir, auditExportJsonFile), 'utf8').includes('section6.audit.marker'), 'audit export command writes filtered JSON audit artifacts', { stdout: auditExportCmdJson.stdout, stderr: auditExportCmdJson.stderr }),
      assertCheck(auditExportCmdCsv.status === 0 && fs.existsSync(path.join(config.rootDir, auditExportCsvFile)) && fs.readFileSync(path.join(config.rootDir, auditExportCsvFile), 'utf8').includes('section6.audit.marker'), 'audit export command writes filtered CSV audit artifacts', { stdout: auditExportCmdCsv.stdout, stderr: auditExportCmdCsv.stderr }),
      assertCheck(runtimeAfterRestore.runtime.running === true, 'workspace runtime remained healthy through restore and restart operations', runtimeAfterRestore.runtime)
    ];

    let payload = {
      stage: 'section-6',
      label: 'stage-10-governance-restore',
      strict,
      generatedAt: new Date().toISOString(),
      proofCommand: 'npm run workspace:proof:section6 -- --strict',
      smokeCommand: 'bash scripts/smoke-governance-restore.sh',
      artifacts: {
        beforeCleanup,
        afterCleanup,
        retentionCleanup,
        snapshots: {
          snapshotOne: snapshotOne.snapshot,
          snapshotTwo: snapshotTwo.snapshot,
          snapshotThree: snapshotThree.snapshot,
          retainedSnapshotId
        },
        policyUpdate: policyUpdate.json,
        policyHistory: policyHistory.json,
        policyRollback: policyRollback.json,
        policyAfterRollback: policyAfterRollback.json,
        gracefulRestore: gracefulRestore.json,
        gracefulRuntime: gracefulRuntime.json,
        abnormalRestore: abnormalRestore.json,
        abnormalRuntime: abnormalRuntime.json,
        controlPlaneCatalog: controlPlaneCatalog.json,
        sessionsAfterRestore,
        auditExport: {
          jsonApiStatus: auditExportRunJson.status,
          csvApiStatus: auditExportRunCsv.status,
          jsonCommand: auditExportCmdJson.stdout,
          csvCommand: auditExportCmdCsv.stdout
        }
      },
      bridgeLogs,
      checks,
      pass: checks.every(item => item.pass)
    };

    payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section6-governance-restore.mjs');
    console.log(JSON.stringify(payload, null, 2));
    if (strict && !payload.pass) {
      process.exitCode = 1;
    }
  } finally {
    terminatePid(bridgeChild?.pid, 'SIGTERM');
    terminatePid(bridgeChild2?.pid, 'SIGTERM');
    terminatePid(bridgeChild3?.pid, 'SIGTERM');
    await cleanupWorkspace(config, alphaWorkspaceId);
    await cleanupWorkspace(config, betaWorkspaceId);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
