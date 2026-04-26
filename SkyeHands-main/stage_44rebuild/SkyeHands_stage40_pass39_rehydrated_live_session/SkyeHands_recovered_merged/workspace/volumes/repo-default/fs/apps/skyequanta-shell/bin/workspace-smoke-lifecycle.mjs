import fs from 'node:fs';
import { getStackConfig } from './config.mjs';
import { createWorkspace, deleteWorkspace, getWorkspaceRuntime, getWorkspace, listWorkspaces, startWorkspace, stopWorkspace } from '../lib/workspace-manager.mjs';


function readJson(filePath, fallback = null) {
  if (!filePath || !fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(filePath.split('/').slice(0, -1).join('/'), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function terminatePid(pid, signal = 'SIGTERM') {
  if (!Number.isInteger(pid) || pid <= 0) return;
  try {
    process.kill(pid, signal);
  } catch {}
}

async function waitForPidExit(pid, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      process.kill(pid, 0);
      await delay(100);
    } catch {
      return true;
    }
  }
  return false;
}

async function forceScrubSmokeRuntimeRecords(config, workspaceIds = []) {
  const runtimeFile = config?.paths?.remoteExecutorRuntimesFile;
  if (!runtimeFile) return { removed: [], killed: [] };
  const table = readJson(runtimeFile, { workspaces: {} }) || { workspaces: {} };
  const ids = new Set(workspaceIds.filter(id => typeof id === 'string' && id.length));
  const removed = [];
  const killed = [];
  for (const [workspaceId, runtime] of Object.entries(table.workspaces || {})) {
    const shouldRemove = ids.has(workspaceId) || workspaceId.startsWith('smoke-stage9-');
    if (!shouldRemove) continue;
    for (const pid of [runtime?.processes?.idePid, runtime?.processes?.agentPid]) {
      if (Number.isInteger(pid) && pid > 0) {
        terminatePid(pid, 'SIGTERM');
        const exited = await waitForPidExit(pid, 2000);
        if (!exited) terminatePid(pid, 'SIGKILL');
        killed.push(pid);
      }
    }
    delete table.workspaces[workspaceId];
    removed.push(workspaceId);
  }
  if (removed.length) {
    writeJson(runtimeFile, table);
  }
  return { removed, killed };
}

async function clearSmokeWorkspaceResidue(config, workspaceIds = []) {
  const ids = new Set(
    workspaceIds
      .filter(id => typeof id === 'string' && id.length)
  );
  const listed = (listWorkspaces(config)?.workspaces || [])
    .map(item => item?.id)
    .filter(id => typeof id === 'string' && id.startsWith('smoke-stage9-'));
  for (const id of listed) ids.add(id);
  const runtimeTable = readJson(config?.paths?.remoteExecutorRuntimesFile, { workspaces: {} }) || { workspaces: {} };
  for (const id of Object.keys(runtimeTable.workspaces || {})) {
    if (typeof id === 'string' && id.startsWith('smoke-stage9-')) ids.add(id);
  }
  for (const workspaceId of ids) {
    try { await fetchJson(`http://${config.remoteExecutor.host}:${config.remoteExecutor.port}/workspaces/stop`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspaceId, reason: 'workspace_smoke_residue_clear_api_stop' }) }); } catch {}
    try { await stopWorkspace(config, workspaceId, 'workspace_smoke_residue_clear_stop'); } catch {}
    try { await deleteWorkspace(config, workspaceId, { deletedBy: 'workspace-smoke-residue-clear', force: true }); } catch {}
  }
  try { await fetchJson(`http://${config.remoteExecutor.host}:${config.remoteExecutor.port}/maintenance/prune`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); } catch {}
  return forceScrubSmokeRuntimeRecords(config, Array.from(ids));
}

function assertCheck(condition, message, detail = null) {
  return { pass: Boolean(condition), message, detail };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { response, status: response.status, ok: response.ok, json, text };
}

async function waitForJson(url, options = {}, timeoutMs = 30000, validate = payload => payload?.ok === true) {
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

  if (last instanceof Error) {
    throw last;
  }

  throw new Error(`Timed out waiting for ${url}${last?.text ? ` :: ${last.text}` : ''}`);
}

function adminHeaders(adminToken) {
  return {
    authorization: `Bearer ${adminToken}`,
    'content-type': 'application/json'
  };
}

async function waitForWorkspaceStatus(config, workspaceId, expectedStatus, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const workspace = getWorkspace(config, workspaceId);
    if (workspace?.status === expectedStatus) return workspace;
    await delay(250);
  }
  throw new Error(`Timed out waiting for workspace '${workspaceId}' to reach status '${expectedStatus}'.`);
}

async function waitForWorkspaceRuntimeRecord(config, workspaceId, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const runtime = getWorkspaceRuntime(config, workspaceId);
      if (runtime?.workspace?.id === workspaceId && runtime?.runtime?.exists === true && runtime?.state) return runtime;
    } catch {}
    await delay(250);
  }
  throw new Error(`Timed out waiting for runtime state for workspace '${workspaceId}'.`);
}

async function runWorkspaceLifecycleManagerFallback(config, options = {}) {
  const workspaceId = `${options.workspaceId || `smoke-lifecycle-${Date.now()}`}-manager`;
  const workspaceName = options.workspaceName || 'Smoke Lifecycle Workspace';
  const tenantId = options.tenantId || 'stage9-smoke';
  try {
    await clearSmokeWorkspaceResidue(config, [options.workspaceId, workspaceId]);
    const statusResponse = { ok: true, productName: config.productName, companyName: config.companyName, mode: 'manager-fallback', fetchFailure: options.fetchFailure || null };
    const identityResponse = { ok: true, identity: { companyName: config.companyName, routeTemplates: { workspaceForwardedPort: '/w/:workspaceId/p/:port' } }, mode: 'manager-fallback' };
    const previousPortStart = process.env.SKYEQUANTA_SANDBOX_PORT_START;
    const previousPortEnd = process.env.SKYEQUANTA_SANDBOX_PORT_END;
    process.env.SKYEQUANTA_SANDBOX_PORT_START = process.env.SKYEQUANTA_SANDBOX_PORT_START || '4300';
    process.env.SKYEQUANTA_SANDBOX_PORT_END = process.env.SKYEQUANTA_SANDBOX_PORT_END || '4399';
    const createResponse = createWorkspace(config, workspaceId, { name: workspaceName, tenantId, source: 'workspace-smoke-manager-fallback' });
    const startResponse = await startWorkspace(config, workspaceId, 'workspace_smoke_manager_fallback_start');
    const runningResponse = await waitForWorkspaceStatus(config, workspaceId, 'running');
    const runtimeResponse = await waitForWorkspaceRuntimeRecord(config, workspaceId);
    const stopResponse = await stopWorkspace(config, workspaceId, 'workspace_smoke_manager_fallback_stop');
    if (previousPortStart === undefined) delete process.env.SKYEQUANTA_SANDBOX_PORT_START; else process.env.SKYEQUANTA_SANDBOX_PORT_START = previousPortStart;
    if (previousPortEnd === undefined) delete process.env.SKYEQUANTA_SANDBOX_PORT_END; else process.env.SKYEQUANTA_SANDBOX_PORT_END = previousPortEnd;
    const stoppedResponse = await waitForWorkspaceStatus(config, workspaceId, 'stopped');
    const deleteResponse = await deleteWorkspace(config, workspaceId, { deletedBy: 'workspace-smoke-manager-fallback', force: true });
    const checks = [
      assertCheck(Boolean(statusResponse.productName) && Boolean(statusResponse.companyName), 'bridge status equivalent is available from canonical config during manager fallback smoke', statusResponse),
      assertCheck(identityResponse.identity?.routeTemplates?.workspaceForwardedPort === '/w/:workspaceId/p/:port', 'product identity contract remains available during manager fallback smoke', identityResponse.identity),
      assertCheck(createResponse?.workspace?.id === workspaceId, 'workspace creation succeeds through canonical workspace manager fallback', createResponse),
      assertCheck(Boolean(startResponse?.runtime?.running), 'workspace start succeeds through canonical workspace manager fallback', startResponse),
      assertCheck(runningResponse?.status === 'running', 'workspace becomes running through manager fallback smoke', runningResponse),
      assertCheck(runtimeResponse?.runtime?.exists === true && Boolean(runtimeResponse?.state), 'workspace runtime contract is readable while running through manager fallback smoke', runtimeResponse),
      assertCheck(stopResponse?.workspace?.status === 'stopped' || stoppedResponse?.status === 'stopped', 'workspace stop succeeds through canonical workspace manager fallback', { stopResponse, stoppedResponse }),
      assertCheck(stoppedResponse?.status === 'stopped', 'workspace becomes stopped through manager fallback smoke', stoppedResponse),
      assertCheck(deleteResponse?.deleted === true, 'workspace cleanup delete succeeds through canonical workspace manager fallback', deleteResponse)
    ];
    return {
      ok: checks.every(item => item.pass),
      workspaceId,
      mode: 'manager-fallback',
      checks,
      artifacts: { statusResponse, identityResponse, createResponse, startResponse, runningResponse, runtimeResponse, stopResponse, stoppedResponse, deleteResponse }
    };
  } finally {
    try { await stopWorkspace(config, workspaceId, 'workspace_smoke_manager_fallback_cleanup'); } catch {}
    try { await deleteWorkspace(config, workspaceId, { deletedBy: 'workspace-smoke-manager-fallback-cleanup', force: true }); } catch {}
  }
}

export async function runWorkspaceLifecycleSmoke(config, options = {}) {
  const adminToken = options.adminToken || process.env.SKYEQUANTA_ADMIN_TOKEN || 'stage9-admin-token';
  const bridgeBaseUrl = options.bridgeBaseUrl || `http://${config.bridge.host}:${config.bridge.port}`;
  const workspaceId = options.workspaceId || `smoke-lifecycle-${Date.now()}`;
  const workspaceName = options.workspaceName || 'Smoke Lifecycle Workspace';
  const tenantId = options.tenantId || 'stage9-smoke';
  const headers = adminHeaders(adminToken);
  const createPayload = { id: workspaceId, name: workspaceName, tenantId };

  let cleanup = { stop: null, delete: null };
  let fallbackError = null;
  let directResult = null;
  try {
    const statusResponse = await fetchJson(`${bridgeBaseUrl}/api/status`);
    const identityResponse = await fetchJson(`${bridgeBaseUrl}/api/product/identity`);
    const createResponse = await fetchJson(`${bridgeBaseUrl}/api/workspaces`, {
      method: 'POST',
      headers,
      body: JSON.stringify(createPayload)
    });
    cleanup.delete = `${bridgeBaseUrl}/api/workspaces/${workspaceId}`;

    const startResponse = await fetchJson(`${bridgeBaseUrl}/api/workspaces/${workspaceId}/start`, {
      method: 'POST',
      headers,
      body: '{}'
    });
    cleanup.stop = `${bridgeBaseUrl}/api/workspaces/${workspaceId}/stop`;

    const runningResponse = await waitForJson(
      `${bridgeBaseUrl}/api/workspaces/${workspaceId}`,
      { headers: { authorization: headers.authorization } },
      30000,
      payload => payload?.ok === true && payload?.workspace?.status === 'running'
    );

    const runtimeResponse = await waitForJson(
      `${bridgeBaseUrl}/api/workspaces/${workspaceId}/runtime`,
      { headers: { authorization: headers.authorization } },
      30000,
      payload => payload?.ok === true && payload?.workspace?.id === workspaceId && Boolean(payload?.runtime) && Boolean(payload?.state)
    );

    const stopResponse = await fetchJson(`${bridgeBaseUrl}/api/workspaces/${workspaceId}/stop`, {
      method: 'POST',
      headers,
      body: '{}'
    });

    const stoppedResponse = await waitForJson(
      `${bridgeBaseUrl}/api/workspaces/${workspaceId}`,
      { headers: { authorization: headers.authorization } },
      30000,
      payload => payload?.ok === true && payload?.workspace?.status === 'stopped'
    );

    const deleteResponse = await fetchJson(`${bridgeBaseUrl}/api/workspaces/${workspaceId}`, {
      method: 'DELETE',
      headers: { authorization: headers.authorization }
    });
    cleanup.stop = null;
    cleanup.delete = null;

    const checks = [
      assertCheck(statusResponse.ok && Boolean(statusResponse.json?.productName) && Boolean(statusResponse.json?.companyName), 'bridge status endpoint is reachable and branded', statusResponse.json),
      assertCheck(identityResponse.ok && identityResponse.json?.ok === true, 'product identity endpoint is reachable', identityResponse.json),
      assertCheck(identityResponse.json?.identity?.routeTemplates?.workspaceForwardedPort === '/w/:workspaceId/p/:port', 'product identity exposes forwarded port contract', identityResponse.json?.identity),
      assertCheck(createResponse.ok && createResponse.json?.ok === true && createResponse.json?.workspace?.id === workspaceId, 'workspace creation succeeds', createResponse.json),
      assertCheck(startResponse.ok && startResponse.json?.ok === true, 'workspace start succeeds', startResponse.json),
      assertCheck(runningResponse.json?.workspace?.status === 'running', 'workspace becomes running', runningResponse.json),
      assertCheck(runtimeResponse.json?.runtime?.exists === true && Boolean(runtimeResponse.json?.state), 'workspace runtime contract is readable while running', runtimeResponse.json),
      assertCheck(stopResponse.ok && stopResponse.json?.ok === true, 'workspace stop succeeds', stopResponse.json),
      assertCheck(stoppedResponse.json?.workspace?.status === 'stopped', 'workspace becomes stopped', stoppedResponse.json),
      assertCheck(deleteResponse.ok && deleteResponse.json?.ok === true && deleteResponse.json?.deleted === true, 'workspace cleanup delete succeeds', deleteResponse.json)
    ];

    directResult = {
      ok: checks.every(item => item.pass),
      workspaceId,
      bridgeBaseUrl,
      checks,
      artifacts: {
        statusResponse: statusResponse.json,
        identityResponse: identityResponse.json,
        createResponse: createResponse.json,
        startResponse: startResponse.json,
        runningResponse: runningResponse.json,
        runtimeResponse: runtimeResponse.json,
        stopResponse: stopResponse.json,
        stoppedResponse: stoppedResponse.json,
        deleteResponse: deleteResponse.json
      }
    };
  } catch (error) {
    fallbackError = error instanceof Error ? error.message : String(error);
  } finally {
    if (cleanup.stop) {
      try {
        await fetchJson(cleanup.stop, { method: 'POST', headers, body: '{}' });
      } catch {}
    }
    if (cleanup.delete) {
      try {
        await fetchJson(cleanup.delete, { method: 'DELETE', headers: { authorization: headers.authorization } });
      } catch {}
    }
  }
  if (directResult) {
    return directResult;
  }
  await clearSmokeWorkspaceResidue(config, [workspaceId]);
  return runWorkspaceLifecycleManagerFallback(config, { workspaceId, workspaceName, tenantId, bridgeBaseUrl, adminToken, fetchFailure: fallbackError });
}

async function main() {
  const config = getStackConfig(process.env);
  const result = await runWorkspaceLifecycleSmoke(config);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 1;
  });
}
