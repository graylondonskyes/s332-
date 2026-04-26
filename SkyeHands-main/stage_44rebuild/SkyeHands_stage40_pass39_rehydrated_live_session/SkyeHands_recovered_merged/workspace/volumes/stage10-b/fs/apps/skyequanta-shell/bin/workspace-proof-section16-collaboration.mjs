import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { getStackConfig } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function terminatePid(pid, signal = 'SIGTERM') {
  if (!Number.isInteger(pid) || pid <= 0) {
    return;
  }
  try {
    process.kill(pid, signal);
  } catch {}
}

function assertCheck(pass, message, detail = null) {
  return { pass: Boolean(pass), message, detail };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const json = await response.json().catch(() => null);
  return { response, json };
}

async function waitForJson(url, options = {}, timeoutMs = 15000, validate = payload => payload?.ok || payload?.productName) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const result = await fetchJson(url, options);
      if (result.response.ok && validate(result.json || result)) {
        return result;
      }
      lastError = new Error(result.json?.detail || result.json?.error || `HTTP ${result.response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

async function main() {
  const strict = process.argv.includes('--strict');
  process.env.SKYEQUANTA_ADMIN_TOKEN = process.env.SKYEQUANTA_ADMIN_TOKEN || 'section16-admin-token';
  process.env.SKYEQUANTA_BRIDGE_PORT = process.env.SKYEQUANTA_BRIDGE_PORT || '4760';
  process.env.SKYEQUANTA_REMOTE_EXECUTOR_PORT = process.env.SKYEQUANTA_REMOTE_EXECUTOR_PORT || '4761';

  const config = getStackConfig(process.env);
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section16-collaboration.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_16_COLLABORATION_PRESENCE.json');
  fs.rmSync(path.join(config.rootDir, '.skyequanta', 'collaboration-state.json'), { force: true });

  const adminHeaders = {
    authorization: `Bearer ${process.env.SKYEQUANTA_ADMIN_TOKEN}`,
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
    await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/status`, {}, 20000, payload => payload?.productName === config.productName);

    const joinAlpha = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/collaboration/presence/join`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: 'local-default',
        operatorId: 'skydexia-alpha',
        displayName: 'SkyDexia Alpha',
        channel: 'general',
        activeFile: '/workspace/apps/skyequanta-shell/lib/bridge.mjs'
      })
    }, 10000, payload => payload?.ok === true && payload?.presence?.operatorId === 'skydexia-alpha');

    const joinBeta = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/collaboration/presence/join`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: 'local-default',
        operatorId: 'skydexia-beta',
        displayName: 'SkyDexia Beta',
        channel: 'review',
        activeFile: '/workspace/apps/skyequanta-shell/lib/runtime-contract.mjs'
      })
    }, 10000, payload => payload?.ok === true && payload?.presence?.operatorId === 'skydexia-beta');

    const presenceList = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/collaboration/presence?workspaceId=local-default`, {
      headers: adminHeaders
    }, 10000, payload => payload?.ok === true && payload?.collaboration?.summary?.activeOperators >= 2);

    const alphaClaim = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/collaboration/workspaces/local-default/courtesy-claims`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        operatorId: 'skydexia-alpha',
        displayName: 'SkyDexia Alpha',
        presenceId: joinAlpha.json.presence.id,
        targetType: 'file',
        targetId: '/workspace/apps/skyequanta-shell/lib/bridge.mjs',
        mode: 'editing',
        note: 'Owner editing route surface.'
      })
    }, 10000, payload => payload?.ok === true && payload?.claim?.courtesyConflict === false);

    const betaClaimConflict = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/collaboration/workspaces/local-default/courtesy-claims`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        operatorId: 'skydexia-beta',
        displayName: 'SkyDexia Beta',
        presenceId: joinBeta.json.presence.id,
        targetType: 'file',
        targetId: '/workspace/apps/skyequanta-shell/lib/bridge.mjs',
        mode: 'reviewing',
        note: 'Courtesy check against active owner.'
      })
    }, 10000, payload => payload?.ok === true && payload?.claim?.courtesyConflict === true);

    const mutationConflict = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/collaboration/workspaces/local-default/mutations`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        operatorId: 'skydexia-beta',
        displayName: 'SkyDexia Beta',
        filePath: '/workspace/apps/skyequanta-shell/lib/bridge.mjs',
        channel: 'review',
        action: 'edit',
        summary: 'Attempted overlapping bridge mutation while Alpha held a courtesy claim.'
      })
    }, 10000, payload => payload?.ok === true && payload?.mutation?.courtesyConflict === true);

    const noteCreate = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/collaboration/workspaces/local-default/notes`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        operatorId: 'skydexia-alpha',
        displayName: 'SkyDexia Alpha',
        channel: 'review',
        body: 'Bridge mutation is under owner edit. Move follow-up to runtime-contract.mjs.',
        linkedTarget: {
          targetType: 'file',
          targetId: '/workspace/apps/skyequanta-shell/lib/bridge.mjs'
        }
      })
    }, 10000, payload => payload?.ok === true && Boolean(payload?.note?.id));

    const heartbeatBeta = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/collaboration/presence/${joinBeta.json.presence.id}/heartbeat`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: 'local-default',
        activeFile: '/workspace/apps/skyequanta-shell/lib/runtime-contract.mjs',
        channel: 'review'
      })
    }, 10000, payload => payload?.ok === true && payload?.presence?.activeFile?.includes('runtime-contract'));

    const notesList = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/collaboration/workspaces/local-default/notes`, {
      headers: adminHeaders
    }, 10000, payload => payload?.ok === true && payload?.collaboration?.notes?.length >= 1);

    const leaveAlpha = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/collaboration/presence/${joinAlpha.json.presence.id}/leave`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ workspaceId: 'local-default', reason: 'handoff' })
    }, 10000, payload => payload?.ok === true && payload?.collaboration?.summary?.activeOperators === 1);

    const integrationsStatus = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/integrations/status?workspaceId=local-default`, {
      headers: adminHeaders
    }, 10000, payload => payload?.ok === true && payload?.integrationStatus?.collaboration?.activeOperators === 1);

    const catalog = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/control-plane/catalog`, {
      headers: adminHeaders
    }, 10000, payload => payload?.ok === true && Boolean(payload?.catalog?.routes?.collaborationPresenceJoin));

    const status = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/status`, {}, 10000, payload => payload?.integrations?.collaboration?.activeOperators === 1);

    const checks = [
      assertCheck(joinAlpha.json?.presence?.operatorId === 'skydexia-alpha' && joinBeta.json?.presence?.operatorId === 'skydexia-beta', 'presence join route materializes two named operators inside the canonical workspace roster', { joinAlpha: joinAlpha.json?.presence, joinBeta: joinBeta.json?.presence }),
      assertCheck(presenceList.json?.collaboration?.summary?.activeOperators >= 2 && presenceList.json?.collaboration?.summary?.channels?.includes('review'), 'presence list returns truthful multi-operator roster, channels, and active files', presenceList.json?.collaboration?.summary),
      assertCheck(alphaClaim.json?.claim?.courtesyConflict === false && alphaClaim.json?.claim?.targetId?.includes('bridge.mjs'), 'first courtesy claim lands cleanly for the active owner', alphaClaim.json?.claim),
      assertCheck(betaClaimConflict.json?.claim?.courtesyConflict === true && Array.isArray(betaClaimConflict.json?.claim?.blockers) && betaClaimConflict.json.claim.blockers.some(item => item.operatorId === 'skydexia-alpha'), 'second courtesy claim on the same file is flagged with a truthful blocker from the owning operator', betaClaimConflict.json?.claim),
      assertCheck(mutationConflict.json?.mutation?.courtesyConflict === true && Array.isArray(mutationConflict.json?.mutation?.blockers) && mutationConflict.json.mutation.blockers.length >= 1, 'simultaneous mutation records surface courtesy conflict instead of fake collaboration success', mutationConflict.json?.mutation),
      assertCheck(noteCreate.json?.note?.channel === 'review' && notesList.json?.collaboration?.notes?.length >= 1, 'shared notes lane persists review notes against the active workspace', { noteCreate: noteCreate.json?.note, notes: notesList.json?.collaboration?.notes }),
      assertCheck(heartbeatBeta.json?.presence?.activeFile?.includes('runtime-contract.mjs'), 'presence heartbeat updates the operator active file and channel truthfully', heartbeatBeta.json?.presence),
      assertCheck(leaveAlpha.json?.collaboration?.summary?.activeOperators === 1 && leaveAlpha.json?.collaboration?.summary?.activeClaims === 1, 'presence leave removes the departing operator while preserving the remaining active claim state', leaveAlpha.json?.collaboration?.summary),
      assertCheck(Boolean(catalog.json?.catalog?.routes?.collaborationCourtesyClaim) && Boolean(catalog.json?.catalog?.routes?.collaborationNotesCreate), 'control-plane catalog exposes collaboration and presence routes', catalog.json?.catalog?.routes),
      assertCheck(integrationsStatus.json?.integrationStatus?.collaboration?.activeOperators === 1 && status.json?.integrations?.collaboration?.courtesyConflicts >= 1, 'integration status and public status surfaces report collaboration summary and courtesy-conflict state', { integrationStatus: integrationsStatus.json?.integrationStatus?.collaboration, status: status.json?.integrations?.collaboration })
    ];

    let payload = {
      section: 16,
      label: 'section-16-collaboration-presence',
      generatedAt: new Date().toISOString(),
      strict,
      proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section16-collaboration.mjs --strict',
      smokeCommand: 'bash scripts/smoke-section16-collaboration.sh',
      routes: {
        collaborationPresenceJoin: '/api/collaboration/presence/join',
        collaborationPresenceHeartbeat: '/api/collaboration/presence/:presenceId/heartbeat',
        collaborationPresenceLeave: '/api/collaboration/presence/:presenceId/leave',
        collaborationPresenceList: '/api/collaboration/presence',
        collaborationCourtesyClaim: '/api/collaboration/workspaces/:workspaceId/courtesy-claims',
        collaborationMutationRecord: '/api/collaboration/workspaces/:workspaceId/mutations',
        collaborationNotes: '/api/collaboration/workspaces/:workspaceId/notes'
      },
      artifacts: {
        joinAlpha: joinAlpha.json,
        joinBeta: joinBeta.json,
        presenceList: presenceList.json,
        alphaClaim: alphaClaim.json,
        betaClaimConflict: betaClaimConflict.json,
        mutationConflict: mutationConflict.json,
        noteCreate: noteCreate.json,
        heartbeatBeta: heartbeatBeta.json,
        notesList: notesList.json,
        leaveAlpha: leaveAlpha.json,
        integrationsStatus: integrationsStatus.json,
        catalog: catalog.json,
        status: status.json
      },
      bridgeLogs,
      checks,
      pass: checks.every(item => item.pass)
    };

    payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section16-collaboration.mjs');
    console.log(JSON.stringify(payload, null, 2));
    if (strict && !payload.pass) {
      process.exitCode = 1;
    }
  } finally {
    terminatePid(bridgeChild.pid, 'SIGTERM');
    await delay(800);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
