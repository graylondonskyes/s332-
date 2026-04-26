import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig } from './config.mjs';
import { createBridgeServer } from '../lib/bridge.mjs';
import { ensureRuntimeState } from '../lib/runtime.mjs';
import { getWorkspaceRuntimeProjection } from '../lib/runtime-bus.mjs';
import { openSession } from '../lib/session-manager.mjs';
import { createWorkspace, startWorkspace, deleteWorkspace } from '../lib/workspace-manager.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';

function parseArgs(argv) {
  const options = {
    strict: false,
    outFile: null,
    workspaceId: 'section4-convergence',
    bridgePort: Number.parseInt(process.env.SKYEQUANTA_BRIDGE_PORT || '3820', 10)
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--strict') {
      options.strict = true;
      continue;
    }
    if (value === '--out') {
      options.outFile = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (value === '--workspace' || value === '--workspace-id') {
      options.workspaceId = argv[index + 1] || options.workspaceId;
      index += 1;
      continue;
    }
    if (value === '--bridge-port') {
      options.bridgePort = Number.parseInt(argv[index + 1] || String(options.bridgePort), 10) || options.bridgePort;
      index += 1;
    }
  }

  return options;
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function assertCheck(pass, detail, evidence = null) {
  return { pass: Boolean(pass), detail, evidence };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: response.ok, status: response.status, text, json };
}

async function safeDelete(config, workspaceId) {
  try {
    await deleteWorkspace(config, workspaceId, { deletedBy: 'section4-proof-cleanup' });
  } catch {
    // ignore cleanup failures
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  process.env.SKYEQUANTA_WORKSPACE_DRIVER = 'remote-executor';
  process.env.SKYEQUANTA_BRIDGE_PORT = String(options.bridgePort);

  const config = getStackConfig();
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section4-convergence.mjs');
  ensureRuntimeState(config);

  const server = createBridgeServer(config);
  const proofFile = options.outFile || path.join(config.rootDir, 'docs', 'proof', 'SECTION_4_IDE_AGENT_CONVERGENCE.json');
  let session = null;

  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(config.bridge.port, config.bridge.host, resolve);
    });

    createWorkspace(config, options.workspaceId, {
      name: 'Section 4 IDE Agent Convergence',
      tenantId: 'section4',
      source: 'section4-proof'
    });
    await startWorkspace(config, options.workspaceId, 'section4_convergence_start');

    session = openSession(config, {
      workspaceId: options.workspaceId,
      tenantId: 'section4',
      clientName: 'section4-proof',
      authSource: 'section4-proof'
    });

    const baseUrl = `http://${config.bridge.host}:${config.bridge.port}/w/${options.workspaceId}`;
    const headers = {
      'x-skyequanta-session-token': session.accessToken,
      'x-skyequanta-tenant-id': session.tenantId
    };

    const ideRoot = await fetchJson(`${baseUrl}/`, { headers });
    const agentHealth = await fetchJson(`${baseUrl}/api/agent/health`, { headers });
    const runtimeHealth = await fetchJson(`${baseUrl}/api/runtime/health`, { headers });
    const runtimeContract = await fetchJson(`${baseUrl}/api/runtime-contract`, { headers });
    const productIdentity = await fetchJson(`${baseUrl}/api/product/identity`, { headers });

    const fileSyncIde = await fetchJson(`${baseUrl}/api/runtime/sync/file-operation`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({
        lane: 'ide',
        operation: 'write',
        path: '/workspace/app/main.ts',
        status: 'applied',
        detail: { source: 'proof' }
      })
    });

    const fileSyncAgent = await fetchJson(`${baseUrl}/api/runtime/sync/file-operation`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({
        lane: 'agent',
        operation: 'refactor',
        path: '/workspace/app/main.ts',
        status: 'queued',
        detail: { source: 'proof' }
      })
    });

    const previewSync = await fetchJson(`${baseUrl}/api/runtime/sync/preview-state`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({
        lane: 'preview',
        port: 4173,
        publicPath: `/w/${options.workspaceId}/p/4173`,
        publicUrl: `http://${config.bridge.host}:${config.bridge.port}/w/${options.workspaceId}/p/4173`,
        status: 'ready',
        detail: { source: 'proof' }
      })
    });

    const messageSync = await fetchJson(`${baseUrl}/api/runtime/sync/message`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({
        lane: 'shell',
        channel: 'ide-agent-contract',
        type: 'synchronized',
        payload: {
          sourceOfTruth: 'apps/skyequanta-shell',
          sessionId: session.id,
          workspaceId: options.workspaceId
        }
      })
    });

    const runtimeContext = await fetchJson(`${baseUrl}/api/runtime/context`, { headers });
    const runtimeEvents = await fetchJson(`${baseUrl}/api/runtime/events`, { headers });
    const projection = getWorkspaceRuntimeProjection(config, options.workspaceId);

    const checks = [
      assertCheck(ideRoot.status < 500, 'workspace IDE surface is reachable through the shell-owned bridge path', ideRoot.status),
      assertCheck(agentHealth.status === 200, 'agent health is reachable through the same shell-owned workspace surface', { status: agentHealth.status, body: agentHealth.json || agentHealth.text }),
      assertCheck(runtimeHealth.ok && runtimeHealth.json?.health?.combinedHealthy, 'explicit IDE lane, agent lane, and combined runtime health checks are exposed and healthy', runtimeHealth.json),
      assertCheck(runtimeContext.ok && runtimeContext.json?.authorization?.sessionId === session.id && runtimeContext.json?.workspace?.id === options.workspaceId, 'shell-owned auth, session, and workspace context is authoritative for the converged runtime', runtimeContext.json),
      assertCheck(fileSyncIde.ok && fileSyncAgent.ok && (runtimeContext.json?.projection?.recentFileOperations || []).length >= 2, 'file operations from IDE and agent lanes synchronize into one canonical runtime state projection', runtimeContext.json?.projection?.recentFileOperations),
      assertCheck(previewSync.ok && runtimeContext.json?.projection?.previewState?.publicPath === `/w/${options.workspaceId}/p/4173`, 'preview state synchronization is recorded in the shell-owned runtime projection', runtimeContext.json?.projection?.previewState),
      assertCheck(messageSync.ok && (runtimeContext.json?.projection?.recentMessages || []).length >= 1, 'canonical runtime event bus and message contract is active for IDE and agent convergence', runtimeContext.json?.projection?.recentMessages),
      assertCheck(runtimeContract.ok && runtimeContract.json?.runtimeAuthority?.shellOwned === true && runtimeContract.json?.runtimeAuthority?.importedExamplesAreAuthoritative === false, 'runtime contract explicitly marks the shell-owned convergence layer as authoritative', runtimeContract.json?.runtimeAuthority),
      assertCheck(productIdentity.ok && productIdentity.json?.identity?.runtimeAuthority?.shellOwned === true && productIdentity.json?.identity?.runtimeAuthority?.importedExamplesAreAuthoritative === false, 'product identity removes ambiguity about imported examples versus the shell-owned runtime layer', productIdentity.json?.identity),
      assertCheck(runtimeEvents.ok && (runtimeEvents.json?.events || []).some(event => event.action === 'runtime.file_operation') && (runtimeEvents.json?.events || []).some(event => event.action === 'runtime.message'), 'runtime event ledger records converged lane activity and message traffic', runtimeEvents.json?.events),
      assertCheck(projection?.lanes?.ide?.lastSeenAt && projection?.lanes?.agent?.lastSeenAt, 'IDE and agent lanes share one synchronized runtime projection file', projection)
    ];

    let payload = {
      section: 4,
      label: 'section-4-ide-agent-convergence',
      generatedAt: new Date().toISOString(),
      workspaceId: options.workspaceId,
      strict: options.strict,
      proofCommand: 'npm run workspace:proof:section4 -- --strict',
      smokeCommand: 'bash scripts/smoke-ide-agent-convergence.sh',
      artifacts: {
        ideRoot: { status: ideRoot.status },
        agentHealth: agentHealth.json,
        runtimeHealth: runtimeHealth.json,
        runtimeContext: runtimeContext.json,
        runtimeEvents: runtimeEvents.json,
        runtimeContract: runtimeContract.json,
        productIdentity: productIdentity.json,
        projection
      },
      checks,
      pass: checks.every(item => item.pass)
    };

    payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section4-convergence.mjs');
    console.log(JSON.stringify(payload, null, 2));
    if (options.strict && !payload.pass) {
      process.exitCode = 1;
    }
  } finally {
    server.close();
    await safeDelete(config, options.workspaceId);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
