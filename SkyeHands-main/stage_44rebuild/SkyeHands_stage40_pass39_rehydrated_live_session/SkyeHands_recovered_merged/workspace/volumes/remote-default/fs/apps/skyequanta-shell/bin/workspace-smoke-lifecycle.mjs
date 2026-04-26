import { getStackConfig } from './config.mjs';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

export async function runWorkspaceLifecycleSmoke(config, options = {}) {
  const adminToken = options.adminToken || process.env.SKYEQUANTA_ADMIN_TOKEN || 'stage9-admin-token';
  const bridgeBaseUrl = options.bridgeBaseUrl || `http://${config.bridge.host}:${config.bridge.port}`;
  const workspaceId = options.workspaceId || `smoke-lifecycle-${Date.now()}`;
  const workspaceName = options.workspaceName || 'Smoke Lifecycle Workspace';
  const tenantId = options.tenantId || 'stage9-smoke';
  const headers = adminHeaders(adminToken);
  const createPayload = { id: workspaceId, name: workspaceName, tenantId };

  let cleanup = { stop: null, delete: null };
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

    return {
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
