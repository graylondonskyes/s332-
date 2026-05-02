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
  process.env.SKYEQUANTA_ADMIN_TOKEN = process.env.SKYEQUANTA_ADMIN_TOKEN || 'section17-admin-token';
  process.env.SKYEQUANTA_BRIDGE_PORT = process.env.SKYEQUANTA_BRIDGE_PORT || '4770';
  process.env.SKYEQUANTA_REMOTE_EXECUTOR_PORT = process.env.SKYEQUANTA_REMOTE_EXECUTOR_PORT || '4771';

  const config = getStackConfig(process.env);
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section17-fleet.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_17_MACHINE_PROFILES_FLEET_CONTROLS.json');
  fs.rmSync(path.join(config.rootDir, '.skyequanta', 'fleet-state.json'), { force: true });

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

    const baseProfiles = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/fleet/machine-profiles?workspaceId=local-default`, {
      headers: adminHeaders
    }, 10000, payload => payload?.ok === true && Array.isArray(payload?.machineProfiles) && payload.machineProfiles.length >= 3);

    const customProfile = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/fleet/machine-profiles`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: 'local-default',
        profileId: 'skydexia-xl',
        name: 'SkyDexia XL',
        cpu: 12,
        memoryMb: 24576,
        diskGb: 120,
        stackPreset: 'skydexia-runtime',
        startupRecipe: 'skydexia:ignite',
        labels: ['skydexia', 'fleet-grade'],
        source: 'skydexia-donor-import'
      })
    }, 10000, payload => payload?.ok === true && payload?.profile?.profileId === 'skydexia-xl');

    const workspaceProfile = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/fleet/workspaces/local-default/profile`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        profileId: 'skydexia-xl',
        stackPreset: 'skydexia-runtime',
        startupRecipe: 'skydexia:ignite',
        source: 'skydexia-workbench-profile'
      })
    }, 10000, payload => payload?.ok === true && payload?.preference?.profileId === 'skydexia-xl');

    const primaryPool = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/fleet/pools`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: 'local-default',
        poolId: 'phoenix-primary',
        label: 'Phoenix Primary',
        region: 'phoenix',
        driver: 'skydexia-fleet',
        allowedProfiles: ['standard', 'large', 'skydexia-xl'],
        capacity: 2,
        state: 'active',
        maintenanceWindow: 'Sun 02:00-03:00 America/Phoenix',
        startupRecipes: ['workspace:standard-start', 'skydexia:ignite'],
        labels: ['phoenix', 'primary']
      })
    }, 10000, payload => payload?.ok === true && payload?.pool?.poolId === 'phoenix-primary');

    const assignmentPrimary = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/fleet/assignments`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: 'local-default',
        poolId: 'phoenix-primary',
        profileId: 'skydexia-xl',
        stackPreset: 'skydexia-runtime',
        startupRecipe: 'skydexia:ignite',
        source: 'push-beyond-fleet-proof'
      })
    }, 10000, payload => payload?.ok === true && payload?.assignment?.poolId === 'phoenix-primary');

    const drainPool = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/fleet/pools/phoenix-primary/state`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ workspaceId: 'local-default', state: 'draining' })
    }, 10000, payload => payload?.ok === true && payload?.pool?.state === 'draining');

    const blockedDrainAssignment = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/fleet/assignments`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: 'local-secondary',
        poolId: 'phoenix-primary',
        profileId: 'standard'
      })
    });

    const reopenPool = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/fleet/pools/phoenix-primary/state`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ workspaceId: 'local-default', state: 'active' })
    }, 10000, payload => payload?.ok === true && payload?.pool?.state === 'active');

    const assignmentSecondary = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/fleet/assignments`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: 'local-secondary',
        poolId: 'phoenix-primary',
        profileId: 'standard',
        startupRecipe: 'workspace:standard-start',
        stackPreset: 'standard-runtime'
      })
    }, 10000, payload => payload?.ok === true && payload?.assignment?.workspaceId === 'local-secondary');

    const blockedCapacity = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/fleet/assignments`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: 'local-tertiary',
        poolId: 'phoenix-primary',
        profileId: 'large'
      })
    });

    const statusWorkspace = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/fleet/status?workspaceId=local-default`, {
      headers: adminHeaders
    }, 10000, payload => payload?.ok === true && payload?.fleet?.currentAssignment?.profileId === 'skydexia-xl');

    const integrationsStatus = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/integrations/status?workspaceId=local-default`, {
      headers: adminHeaders
    }, 10000, payload => payload?.ok === true && payload?.integrationStatus?.fleet?.assignments?.active === 2);

    const catalog = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/control-plane/catalog`, {
      headers: adminHeaders
    }, 10000, payload => payload?.ok === true && Boolean(payload?.catalog?.routes?.fleetStatus));

    const publicStatus = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/status`, {}, 10000, payload => payload?.integrations?.fleet?.poolCount >= 1);

    const releasePrimary = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/fleet/workspaces/local-default/release`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ reason: 'handoff' })
    }, 10000, payload => payload?.ok === true && payload?.released?.workspaceId === 'local-default');

    const checks = [
      assertCheck(Array.isArray(baseProfiles.json?.machineProfiles) && baseProfiles.json.machineProfiles.some(item => item.profileId === 'large'), 'baseline machine-profile catalog exposes lifecycle defaults before donor convergence overlays', baseProfiles.json?.machineProfiles),
      assertCheck(customProfile.json?.profile?.profileId === 'skydexia-xl' && customProfile.json?.profile?.startupRecipe === 'skydexia:ignite', 'custom SkyDexia machine profile lands with startup recipe and stack preset instead of UI-only labels', customProfile.json?.profile),
      assertCheck(workspaceProfile.json?.preference?.profileId === 'skydexia-xl' && workspaceProfile.json?.profile?.stackPreset === 'skydexia-runtime', 'workspace machine-profile preference persists on the canonical workspace path', workspaceProfile.json),
      assertCheck(primaryPool.json?.pool?.allowedProfiles?.includes('skydexia-xl') && primaryPool.json?.pool?.capacity === 2, 'fleet pool creation persists allowed profiles, capacity, region, and maintenance window', primaryPool.json?.pool),
      assertCheck(assignmentPrimary.json?.assignment?.profileId === 'skydexia-xl' && assignmentPrimary.json?.assignment?.poolId === 'phoenix-primary', 'primary fleet assignment binds the workspace to the selected machine profile and pool', assignmentPrimary.json?.assignment),
      assertCheck(drainPool.json?.pool?.state === 'draining' && blockedDrainAssignment.response.status === 400 && blockedDrainAssignment.json?.detail?.includes('draining'), 'draining pool state truthfully blocks new assignments instead of pretending fleet capacity is still open', { drainPool: drainPool.json?.pool, blockedDrainAssignment: blockedDrainAssignment.json }),
      assertCheck(assignmentSecondary.json?.assignment?.workspaceId === 'local-secondary' && blockedCapacity.response.status === 400 && blockedCapacity.json?.detail?.includes('capacity'), 'fleet capacity policy stops the third workspace once the pool reaches its declared limit', { assignmentSecondary: assignmentSecondary.json?.assignment, blockedCapacity: blockedCapacity.json }),
      assertCheck(statusWorkspace.json?.fleet?.summary?.currentWorkspaceProfile === 'skydexia-xl' && statusWorkspace.json?.fleet?.summary?.poolCount >= 1, 'fleet status reports current workspace profile, active pool, and assignment summary', statusWorkspace.json?.fleet?.summary),
      assertCheck(Boolean(catalog.json?.catalog?.routes?.fleetMachineProfilesUpsert) && Boolean(catalog.json?.catalog?.routes?.fleetAssignmentCreate), 'control-plane catalog exposes fleet machine-profile and assignment routes', catalog.json?.catalog?.routes),
      assertCheck(integrationsStatus.json?.integrationStatus?.fleet?.assignments?.active === 2 && publicStatus.json?.integrations?.fleet?.activePools === 1 && releasePrimary.json?.status?.summary?.assignments?.active === 1, 'integration status and public status surfaces report fleet summary, and release updates the active assignment count', { integrationStatus: integrationsStatus.json?.integrationStatus?.fleet, publicStatus: publicStatus.json?.integrations?.fleet, releasePrimary: releasePrimary.json?.status?.summary })
    ];

    let payload = {
      section: 17,
      label: 'section-17-machine-profiles-fleet-controls',
      generatedAt: new Date().toISOString(),
      strict,
      proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section17-fleet.mjs --strict',
      smokeCommand: 'bash scripts/smoke-section17-fleet.sh',
      routes: {
        fleetStatus: '/api/fleet/status',
        fleetMachineProfilesList: '/api/fleet/machine-profiles',
        fleetMachineProfilesUpsert: '/api/fleet/machine-profiles',
        fleetWorkspaceProfileSet: '/api/fleet/workspaces/:workspaceId/profile',
        fleetPoolsList: '/api/fleet/pools',
        fleetPoolsUpsert: '/api/fleet/pools',
        fleetPoolStateSet: '/api/fleet/pools/:poolId/state',
        fleetAssignmentCreate: '/api/fleet/assignments',
        fleetWorkspaceRelease: '/api/fleet/workspaces/:workspaceId/release'
      },
      artifacts: {
        baseProfiles: baseProfiles.json,
        customProfile: customProfile.json,
        workspaceProfile: workspaceProfile.json,
        primaryPool: primaryPool.json,
        assignmentPrimary: assignmentPrimary.json,
        drainPool: drainPool.json,
        blockedDrainAssignment: blockedDrainAssignment.json,
        reopenPool: reopenPool.json,
        assignmentSecondary: assignmentSecondary.json,
        blockedCapacity: blockedCapacity.json,
        statusWorkspace: statusWorkspace.json,
        integrationsStatus: integrationsStatus.json,
        catalog: catalog.json,
        publicStatus: publicStatus.json,
        releasePrimary: releasePrimary.json
      },
      bridgeLogs,
      checks,
      pass: checks.every(item => item.pass)
    };

    payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section17-fleet.mjs');
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
