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
  process.env.SKYEQUANTA_ADMIN_TOKEN = process.env.SKYEQUANTA_ADMIN_TOKEN || 'section18-admin-token';
  process.env.SKYEQUANTA_BRIDGE_PORT = process.env.SKYEQUANTA_BRIDGE_PORT || '4780';
  process.env.SKYEQUANTA_REMOTE_EXECUTOR_PORT = process.env.SKYEQUANTA_REMOTE_EXECUTOR_PORT || '4781';

  const config = getStackConfig(process.env);
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section18-prebuild.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_18_PREBUILD_BROKERAGE.json');

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

    const staleTemplate = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/prebuild/templates`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: 'local-expired',
        templateId: 'skydexia-stale',
        label: 'SkyDexia stale warm start',
        mode: 'warm-start',
        profileId: 'skydexia-xl',
        startupRecipe: 'skydexia:ignite',
        stackPreset: 'skydexia-runtime',
        retentionMinutes: 30,
        labels: ['skydexia', 'stale'],
        sourcePaths: ['SkyDexia-2/SkyDexia-2.6/netlify/functions/release-replay.js'],
        source: 'skydexia-donor-template'
      })
    }, 10000, payload => payload?.ok === true && payload?.template?.templateId === 'skydexia-stale');

    const stalePreference = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/prebuild/workspaces/local-expired/preference`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        templateId: 'skydexia-stale',
        mode: 'warm-start',
        preferredProfileId: 'skydexia-xl',
        hydrationPolicy: 'reuse-latest',
        source: 'skydexia-preference'
      })
    }, 10000, payload => payload?.ok === true && payload?.preference?.templateId === 'skydexia-stale');

    const staleJob = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/prebuild/jobs`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: 'local-expired',
        templateId: 'skydexia-stale',
        mode: 'warm-start',
        profileId: 'skydexia-xl',
        startupRecipe: 'skydexia:ignite',
        stackPreset: 'skydexia-runtime',
        expiresAt: '2020-01-01T00:00:00.000Z',
        source: 'skydexia-stale-job'
      })
    }, 10000, payload => payload?.ok === true && payload?.job?.templateId === 'skydexia-stale');

    const hydrateExpired = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/prebuild/workspaces/local-expired/hydrate`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ templateId: 'skydexia-stale' })
    });

    const activeTemplate = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/prebuild/templates`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: 'local-default',
        templateId: 'skydexia-warm',
        label: 'SkyDexia donor warm start',
        mode: 'warm-start',
        profileId: 'skydexia-xl',
        startupRecipe: 'skydexia:ignite',
        stackPreset: 'skydexia-runtime',
        retentionMinutes: 180,
        labels: ['skydexia', 'warm-start', 'brokered'],
        sourcePaths: [
          'SkyDexia-2/SkyDexia-2.6/netlify/functions/github-push.js',
          'SkyDexia-2/SkyDexia-2.6/netlify/functions/netlify-deploy.js',
          'SkyDexia-2/SkyDexia-2.6/netlify/functions/release-replay.js'
        ],
        source: 'skydexia-donor-template'
      })
    }, 10000, payload => payload?.ok === true && payload?.template?.templateId === 'skydexia-warm');

    const activePreference = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/prebuild/workspaces/local-default/preference`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        templateId: 'skydexia-warm',
        mode: 'warm-start',
        preferredProfileId: 'skydexia-xl',
        hydrationPolicy: 'reuse-latest',
        source: 'skydexia-preference'
      })
    }, 10000, payload => payload?.ok === true && payload?.preference?.templateId === 'skydexia-warm');

    const activeJob = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/prebuild/jobs`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: 'local-default',
        templateId: 'skydexia-warm',
        mode: 'warm-start',
        profileId: 'skydexia-xl',
        startupRecipe: 'skydexia:ignite',
        stackPreset: 'skydexia-runtime',
        source: 'skydexia-active-job'
      })
    }, 10000, payload => payload?.ok === true && payload?.job?.templateId === 'skydexia-warm' && Boolean(payload?.artifact?.artifactDigest));

    const artifactExists = fs.existsSync(activeJob.json.job.artifactFile || '');
    const jobsList = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/prebuild/jobs?workspaceId=local-default`, {
      headers: adminHeaders
    }, 10000, payload => payload?.ok === true && Array.isArray(payload?.jobs));

    const hydration = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/prebuild/workspaces/local-default/hydrate`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ templateId: 'skydexia-warm', source: 'skydexia-hydrate' })
    }, 10000, payload => payload?.ok === true && payload?.hydration?.jobId === activeJob.json.job.jobId);

    const replay = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/prebuild/jobs/${activeJob.json.job.jobId}/replay`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ workspaceId: 'local-default', source: 'skydexia-replay' })
    }, 10000, payload => payload?.ok === true && payload?.replayedJob?.parentJobId === activeJob.json.job.jobId);

    const status = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/prebuild/status?workspaceId=local-default`, {
      headers: adminHeaders
    }, 10000, payload => payload?.ok === true && payload?.prebuild?.summary?.currentTemplateId === 'skydexia-warm');

    const integrationsStatus = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/integrations/status?workspaceId=local-default`, {
      headers: adminHeaders
    }, 10000, payload => payload?.ok === true && payload?.integrationStatus?.prebuild?.currentTemplateId === 'skydexia-warm');

    const controlPlaneSummary = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/control-plane/summary`, {
      headers: adminHeaders
    }, 10000, payload => payload?.ok === true && payload?.prebuild?.currentTemplateId === 'skydexia-warm');

    const catalog = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/control-plane/catalog`, {
      headers: adminHeaders
    }, 10000, payload => payload?.ok === true && Boolean(payload?.catalog?.routes?.prebuildJobReplay));

    const publicStatus = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/status`, {}, 10000, payload => payload?.integrations?.prebuild?.currentTemplateId === 'skydexia-warm');

    const checks = [
      assertCheck(staleTemplate.json?.template?.templateId === 'skydexia-stale' && staleTemplate.json?.template?.mode === 'warm-start', 'stale donor template persists as a real warm-start template instead of a directive-only note', staleTemplate.json?.template),
      assertCheck(stalePreference.json?.preference?.templateId === 'skydexia-stale' && staleJob.json?.job?.expiresAt === '2020-01-01T00:00:00.000Z', 'expired brokerage state can be materialized for negative testing without faking a ready lease', { preference: stalePreference.json?.preference, job: staleJob.json?.job }),
      assertCheck(hydrateExpired.response.status === 400 && String(hydrateExpired.json?.detail || '').includes('No ready prebuild artifact'), 'expired warm-start artifacts truthfully block hydration instead of being reused after expiry', hydrateExpired.json),
      assertCheck(activeTemplate.json?.template?.templateId === 'skydexia-warm' && activePreference.json?.preference?.preferredProfileId === 'skydexia-xl', 'SkyDexia donor template and workspace preference persist profile intent for warm-start brokerage', { template: activeTemplate.json?.template, preference: activePreference.json?.preference }),
      assertCheck(Boolean(activeJob.json?.job?.artifactDigest) && artifactExists === true && (activeJob.json?.artifact?.artifactKind === 'warm-start'), 'active brokerage job materializes a real warm-start artifact file with a stable digest on disk', { artifactFile: activeJob.json?.job?.artifactFile, artifactDigest: activeJob.json?.job?.artifactDigest, artifactExists }),
      assertCheck(jobsList.json?.jobs?.some(item => item.jobId === activeJob.json?.job?.jobId), 'prebuild jobs list exposes the brokered artifact inventory for the workspace', jobsList.json?.jobs),
      assertCheck(hydration.json?.hydration?.jobId === activeJob.json?.job?.jobId && hydration.json?.job?.status === 'hydrated', 'warm-start hydration allocates the ready artifact to the workspace and marks the job as hydrated', hydration.json),
      assertCheck(replay.json?.replayedJob?.parentJobId === activeJob.json?.job?.jobId && replay.json?.artifact?.artifactKind === 'warm-start', 'replay creates a new brokered artifact derived from the original job rather than mutating the parent in place', replay.json),
      assertCheck(status.json?.prebuild?.summary?.readyJobs >= 1 && status.json?.prebuild?.summary?.lastHydrationJobId === activeJob.json?.job?.jobId, 'prebuild status reports current template, ready inventory, and last hydration truthfully', status.json?.prebuild?.summary),
      assertCheck(integrationsStatus.json?.integrationStatus?.prebuild?.currentTemplateId === 'skydexia-warm' && controlPlaneSummary.json?.prebuild?.readyJobs >= 1 && Boolean(catalog.json?.catalog?.routes?.prebuildWorkspaceHydrate) && publicStatus.json?.integrations?.prebuild?.currentTemplateId === 'skydexia-warm', 'integration status, control-plane summary, catalog, and public status all expose the prebuild brokerage lane', {
        integrationStatus: integrationsStatus.json?.integrationStatus?.prebuild,
        controlPlaneSummary: controlPlaneSummary.json?.prebuild,
        catalogRoutes: catalog.json?.catalog?.routes,
        publicStatus: publicStatus.json?.integrations?.prebuild
      })
    ];

    let payload = {
      section: 18,
      label: 'section-18-prebuild-brokerage',
      generatedAt: new Date().toISOString(),
      strict,
      proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section18-prebuild.mjs --strict',
      smokeCommand: 'bash scripts/smoke-section18-prebuild.sh',
      routes: {
        prebuildStatus: '/api/prebuild/status',
        prebuildTemplatesList: '/api/prebuild/templates',
        prebuildTemplatesUpsert: '/api/prebuild/templates',
        prebuildWorkspacePreferenceSet: '/api/prebuild/workspaces/:workspaceId/preference',
        prebuildJobsList: '/api/prebuild/jobs',
        prebuildJobCreate: '/api/prebuild/jobs',
        prebuildJobReplay: '/api/prebuild/jobs/:jobId/replay',
        prebuildWorkspaceHydrate: '/api/prebuild/workspaces/:workspaceId/hydrate'
      },
      artifacts: {
        staleTemplate: staleTemplate.json,
        stalePreference: stalePreference.json,
        staleJob: staleJob.json,
        hydrateExpired: hydrateExpired.json,
        activeTemplate: activeTemplate.json,
        activePreference: activePreference.json,
        activeJob: activeJob.json,
        jobsList: jobsList.json,
        hydration: hydration.json,
        replay: replay.json,
        status: status.json,
        integrationsStatus: integrationsStatus.json,
        controlPlaneSummary: controlPlaneSummary.json,
        catalog: catalog.json,
        publicStatus: publicStatus.json
      },
      bridgeLogs,
      checks,
      pass: checks.every(item => item.pass)
    };

    payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section18-prebuild.mjs');
    console.log(JSON.stringify(payload, null, 2));
  } finally {
    terminatePid(bridgeChild.pid);
    await delay(250);
    terminatePid(bridgeChild.pid, 'SIGKILL');
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
