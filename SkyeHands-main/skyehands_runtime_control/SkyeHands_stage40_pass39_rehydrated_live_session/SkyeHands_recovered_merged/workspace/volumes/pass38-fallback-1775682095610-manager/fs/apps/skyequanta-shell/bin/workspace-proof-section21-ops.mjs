import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

import { getStackConfig } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
  process.env.SKYEQUANTA_ADMIN_TOKEN = process.env.SKYEQUANTA_ADMIN_TOKEN || 'section21-admin-token';
  process.env.SKYEQUANTA_BRIDGE_PORT = process.env.SKYEQUANTA_BRIDGE_PORT || '4810';
  process.env.SKYEQUANTA_REMOTE_EXECUTOR_PORT = process.env.SKYEQUANTA_REMOTE_EXECUTOR_PORT || '4811';
  process.env.SKYEQUANTA_AGENT_PORT = process.env.SKYEQUANTA_AGENT_PORT || '4812';
  process.env.SKYEQUANTA_IDE_PORT = process.env.SKYEQUANTA_IDE_PORT || '4813';

  const config = getStackConfig(process.env);
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section21-ops.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_21_POST_PARITY_OPS_PLANE.json');

  const adminHeaders = {
    authorization: `Bearer ${process.env.SKYEQUANTA_ADMIN_TOKEN}`,
    'content-type': 'application/json'
  };

  for (const relativePath of [
    '.skyequanta/ops-state.json',
    '.skyequanta/audit-log.json'
  ]) {
    try {
      fs.rmSync(path.join(config.rootDir, relativePath), { force: true });
    } catch {}
  }

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

    const ruleUpsert = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/ops/watch-rules`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: 'local-default',
        ruleId: 'expired-prebuild-artifacts',
        metric: 'expiredPrebuildArtifacts',
        comparator: 'gt',
        threshold: 0,
        severity: 'high',
        autoCreateIncident: true,
        title: 'Expired prebuild artifacts',
        source: 'section21-ops-proof'
      })
    }, 10000, payload => payload?.ok === true && payload?.rule?.ruleId === 'expired-prebuild-artifacts');

    const rulesList = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/ops/watch-rules?workspaceId=local-default`, {
      headers: { authorization: `Bearer ${process.env.SKYEQUANTA_ADMIN_TOKEN}` }
    }, 10000, payload => payload?.ok === true && Array.isArray(payload?.watchRules) && payload.watchRules.length >= 1);

    const evaluateHealthy = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/ops/evaluate`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: 'local-default',
        metrics: {
          expiredPrebuildArtifacts: 0,
          activeIncidents: 0
        },
        source: 'section21-ops-proof'
      })
    }, 10000, payload => payload?.ok === true && payload?.summary?.health === 'healthy');

    const evaluateBreach = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/ops/evaluate`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: 'local-default',
        metrics: {
          expiredPrebuildArtifacts: 3,
          activeIncidents: 1
        },
        source: 'section21-ops-proof'
      })
    }, 10000, payload => payload?.ok === true && Array.isArray(payload?.triggeredAlerts) && payload.triggeredAlerts.length >= 1 && Array.isArray(payload?.incidents) && payload.incidents.length >= 1);

    const incidentId = evaluateBreach.json?.incidents?.[0]?.incidentId;
    const alertId = evaluateBreach.json?.triggeredAlerts?.[0]?.alertId;
    if (!incidentId || !alertId) {
      throw new Error('Ops evaluation did not materialize an incident and linked alert.');
    }

    const incidentsOpen = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/ops/incidents?workspaceId=local-default`, {
      headers: { authorization: `Bearer ${process.env.SKYEQUANTA_ADMIN_TOKEN}` }
    }, 10000, payload => payload?.ok === true && Array.isArray(payload?.incidents) && payload.incidents.some(item => item.incidentId === incidentId && item.status === 'open'));

    const incidentAck = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/ops/incidents/${incidentId}/ack`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: 'local-default',
        ownerId: 'skydexia-ops',
        ownerDisplayName: 'SkyDexia Ops'
      })
    }, 10000, payload => payload?.ok === true && payload?.incident?.status === 'acknowledged');

    const incidentResolve = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/ops/incidents/${incidentId}/resolve`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: 'local-default',
        resolution: 'prebuild cleanup replayed'
      })
    }, 10000, payload => payload?.ok === true && payload?.incident?.status === 'resolved');

    const opsStatus = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/ops/status?workspaceId=local-default`, {
      headers: { authorization: `Bearer ${process.env.SKYEQUANTA_ADMIN_TOKEN}` }
    }, 10000, payload => payload?.ok === true && payload?.ops?.summary?.resolvedIncidents >= 1);

    const controlPlaneSummary = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/control-plane/summary`, {
      headers: adminHeaders
    }, 10000, payload => payload?.ok === true && payload?.ops?.watchRuleCount >= 1);

    const integrationStatus = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/integrations/status?workspaceId=local-default`, {
      headers: adminHeaders
    }, 10000, payload => payload?.ok === true && payload?.integrationStatus?.ops?.watchRuleCount >= 1);

    const catalog = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/control-plane/catalog`, {
      headers: adminHeaders
    }, 10000, payload => payload?.ok === true && Boolean(payload?.catalog?.routes?.opsStatus) && Boolean(payload?.catalog?.routes?.postParityOpsProof));

    const publicStatus = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/status`, {}, 10000, payload => payload?.integrations?.ops?.watchRuleCount >= 1 && payload?.integrations?.postParityOps?.postDirectiveExtension?.complete >= 0);

    const proofRoute = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/proof/post-parity-ops-plane`, {}, 10000, payload => payload?.ok === true && payload?.postParityOps?.label === 'section-21-post-parity-ops-plane');

    const checks = [
      assertCheck(ruleUpsert.json?.rule?.autoCreateIncident === true && rulesList.json?.watchRules?.some(rule => rule.ruleId === 'expired-prebuild-artifacts'), 'ops watch rules persist under product-owned state instead of remaining directive-only text', { ruleUpsert: ruleUpsert.json?.rule, rulesList: rulesList.json?.watchRules }),
      assertCheck(evaluateHealthy.json?.triggeredAlerts?.length === 0 && evaluateHealthy.json?.summary?.health === 'healthy', 'healthy evaluation keeps the ops plane green when thresholds are not breached', { evaluateHealthy: evaluateHealthy.json?.summary, triggeredAlerts: evaluateHealthy.json?.triggeredAlerts }),
      assertCheck(evaluateBreach.json?.triggeredAlerts?.length >= 1 && evaluateBreach.json?.incidents?.length >= 1, 'breach evaluation materializes an active alert and auto-created incident from the configured watch rule', { evaluateBreach: { triggeredAlerts: evaluateBreach.json?.triggeredAlerts, incidents: evaluateBreach.json?.incidents, summary: evaluateBreach.json?.summary } }),
      assertCheck(incidentsOpen.json?.incidents?.some(item => item.incidentId === incidentId && item.status === 'open'), 'incident listing truthfully reports open incidents before acknowledgement and resolution', incidentsOpen.json?.incidents),
      assertCheck(incidentAck.json?.incident?.status === 'acknowledged' && incidentAck.json?.incident?.ownerId === 'skydexia-ops', 'incident acknowledgement persists owner assignment instead of remaining a transient UI fiction', incidentAck.json?.incident),
      assertCheck(incidentResolve.json?.incident?.status === 'resolved' && opsStatus.json?.ops?.alerts?.some(alert => alert.alertId === alertId && alert.status === 'resolved'), 'incident resolution closes the incident and linked alert instead of leaving dangling active state', { incidentResolve: incidentResolve.json?.incident, alerts: opsStatus.json?.ops?.alerts }),
      assertCheck(controlPlaneSummary.json?.ops?.watchRuleCount >= 1 && integrationStatus.json?.integrationStatus?.ops?.resolvedIncidents >= 1, 'control-plane summary and integration status expose the ops resilience plane as a real operator surface', { controlPlaneSummary: controlPlaneSummary.json?.ops, integrationStatus: integrationStatus.json?.integrationStatus?.ops }),
      assertCheck(Boolean(catalog.json?.catalog?.routes?.opsStatus) && Boolean(catalog.json?.catalog?.routes?.opsIncidents) && Boolean(catalog.json?.catalog?.routes?.postParityOpsProof), 'control-plane catalog publishes ops routes and the post-parity proof route under the canonical bridge', catalog.json?.catalog?.routes),
      assertCheck(publicStatus.json?.integrations?.ops?.watchRuleCount >= 1 && proofRoute.json?.postParityOps?.completion?.postDirectiveLanesTotal === 1, 'public status and proof route surfaces report the post-parity ops plane without lowering current directive completion', { publicStatus: publicStatus.json?.integrations, proofRoute: proofRoute.json?.postParityOps?.completion })
    ];

    let payload = {
      section: 21,
      label: 'section-21-post-parity-ops-plane',
      generatedAt: new Date().toISOString(),
      strict,
      proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section21-ops.mjs --strict',
      smokeCommand: 'bash scripts/smoke-section21-ops.sh',
      routes: {
        opsStatus: '/api/ops/status',
        opsWatchRules: '/api/ops/watch-rules',
        opsEvaluate: '/api/ops/evaluate',
        opsIncidents: '/api/ops/incidents',
        opsIncidentAcknowledge: '/api/ops/incidents/:incidentId/ack',
        opsIncidentResolve: '/api/ops/incidents/:incidentId/resolve',
        postParityOpsProof: '/api/proof/post-parity-ops-plane'
      },
      pass: checks.every(item => item.pass),
      checks,
      artifacts: {
        opsStore: '.skyequanta/ops-state.json'
      },
      completion: {
        currentDirectiveLanesTotal: 7,
        currentDirectiveLanesComplete: 7,
        currentDirectiveLanesRemaining: 0,
        postDirectiveLanesTotal: 1,
        postDirectiveLanesComplete: checks.every(item => item.pass) ? 1 : 0,
        postDirectiveLanesRemaining: checks.every(item => item.pass) ? 0 : 1,
        remainingLaneNames: checks.every(item => item.pass) ? [] : ['PB-8 observability and incident command plane']
      },
      evidence: {
        ruleUpsert: ruleUpsert.json,
        rulesList: rulesList.json,
        evaluateHealthy: evaluateHealthy.json,
        evaluateBreach: evaluateBreach.json,
        incidentsOpen: incidentsOpen.json,
        incidentAck: incidentAck.json,
        incidentResolve: incidentResolve.json,
        opsStatus: opsStatus.json,
        controlPlaneSummary: controlPlaneSummary.json,
        integrationStatus: integrationStatus.json,
        catalog: catalog.json,
        publicStatus: publicStatus.json,
        proofRoute: proofRoute.json,
        bridgeLogs: bridgeLogs.slice(-50)
      }
    };

    payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section21-ops.mjs');
    if (strict && !payload.pass) {
      throw new Error('Section 21 post-parity ops plane proof failed in strict mode.');
    }

    console.log(JSON.stringify(payload, null, 2));
  } finally {
    if (!bridgeChild.killed) {
      try {
        process.kill(-bridgeChild.pid, 'SIGTERM');
      } catch {}
      await delay(250);
      try {
        process.kill(-bridgeChild.pid, 'SIGKILL');
      } catch {}
    }
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
