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
  process.env.SKYEQUANTA_ADMIN_TOKEN = process.env.SKYEQUANTA_ADMIN_TOKEN || 'section19-admin-token';
  process.env.SKYEQUANTA_BRIDGE_PORT = process.env.SKYEQUANTA_BRIDGE_PORT || '4790';
  process.env.SKYEQUANTA_REMOTE_EXECUTOR_PORT = process.env.SKYEQUANTA_REMOTE_EXECUTOR_PORT || '4791';

  const config = getStackConfig(process.env);
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section19-governance.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_19_PARITY_PLUS_GOVERNANCE.json');

  const adminHeaders = {
    authorization: `Bearer ${process.env.SKYEQUANTA_ADMIN_TOKEN}`,
    'content-type': 'application/json'
  };

  for (const relativePath of [
    '.skyequanta/audit-log.json',
    '.skyequanta/scm-state.json',
    '.skyequanta/governance-tenant-policies.json',
    '.skyequanta/governance-secrets.json',
    '.skyequanta/governance-cost-ledger.json',
    '.skyequanta/governance-release-decisions.json'
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

    const githubConnect = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/integrations/github/connect`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: 'local-default',
        repo: 'skyesoverlondon/skyehands',
        branch: 'push-beyond-governance',
        installationId: 'skydexia-governance-installation',
        tokenPresent: true
      })
    }, 10000, payload => payload?.ok === true && payload?.github?.connected === true);

    const githubPush = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/integrations/github/push`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: 'local-default',
        branch: 'push-beyond-governance',
        message: 'PB-6 governed release replay proof'
      })
    }, 10000, payload => payload?.ok === true && payload?.push?.status === 'materialized');

    const queuedReleaseId = githubPush.json?.releaseReplay?.queue?.at(-1)?.id;
    if (!queuedReleaseId) {
      throw new Error('GitHub push did not materialize a deferred release replay artifact.');
    }

    const policyDisabled = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/governance/tenants/local/policy`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        actions: {
          releaseReplayAllowed: false
        },
        releaseGovernance: {
          requiredSecretScopes: ['github-release'],
          releaseReplayCostCents: 250
        },
        costControls: {
          monthlyBudgetCents: 1000,
          hardStop: true
        },
        source: 'section19-governance-proof'
      })
    }, 10000, payload => payload?.ok === true && payload?.policy?.actions?.releaseReplayAllowed === false);

    const disabledEvaluation = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/governance/releases/${queuedReleaseId}/evaluate`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: 'local-default',
        tenantId: 'local'
      })
    }, 10000, payload => payload?.ok === true && payload?.decision?.allowed === false);

    const secretUpsert = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/governance/secrets`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        tenantId: 'local',
        scope: 'github-release',
        key: 'GITHUB_RELEASE_TOKEN',
        value: 'skydexia-governed-token',
        description: 'GitHub release replay token for PB-6 proof',
        source: 'section19-governance-proof'
      })
    }, 10000, payload => payload?.ok === true && payload?.secret?.scope === 'github-release');

    const policyBudgetBlocked = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/governance/tenants/local/policy`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        actions: {
          releaseReplayAllowed: true
        },
        releaseGovernance: {
          requiredSecretScopes: ['github-release'],
          releaseReplayCostCents: 250
        },
        costControls: {
          monthlyBudgetCents: 100,
          hardStop: true
        },
        source: 'section19-governance-proof'
      })
    }, 10000, payload => payload?.ok === true && payload?.policy?.costControls?.monthlyBudgetCents === 100);

    const budgetEvaluation = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/governance/releases/${queuedReleaseId}/evaluate`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: 'local-default',
        tenantId: 'local'
      })
    }, 10000, payload => payload?.ok === true && payload?.decision?.allowed === false && payload?.decision?.reasons?.includes('budget_exceeded'));

    const policyAllowed = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/governance/tenants/local/policy`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        actions: {
          releaseReplayAllowed: true,
          secretBrokerAllowed: true
        },
        releaseGovernance: {
          requiredSecretScopes: ['github-release'],
          releaseReplayCostCents: 250
        },
        costControls: {
          monthlyBudgetCents: 1000,
          hardStop: true
        },
        source: 'section19-governance-proof'
      })
    }, 10000, payload => payload?.ok === true && payload?.policy?.actions?.releaseReplayAllowed === true && payload?.policy?.costControls?.monthlyBudgetCents === 1000);

    const releaseReplay = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/governance/releases/${queuedReleaseId}/replay`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: 'local-default',
        tenantId: 'local',
        source: 'section19-governance-proof'
      })
    }, 10000, payload => payload?.ok === true && payload?.replayed?.id === queuedReleaseId);

    const governanceReleases = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/governance/releases?workspaceId=local-default&tenantId=local`, {
      headers: adminHeaders
    }, 10000, payload => payload?.ok === true && payload?.releaseReplay?.history?.length >= 1);

    const costsStatus = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/governance/costs/status?tenantId=local`, {
      headers: adminHeaders
    }, 10000, payload => payload?.ok === true && payload?.costs?.spentCents >= 250);

    const secretsList = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/governance/secrets?tenantId=local`, {
      headers: adminHeaders
    }, 10000, payload => payload?.ok === true && payload?.total >= 1);

    const auditExport = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/audit/export?format=json&tenantId=local&limit=200`, {
      headers: { authorization: `Bearer ${process.env.SKYEQUANTA_ADMIN_TOKEN}` }
    }, 10000, payload => Array.isArray(payload?.events));

    const controlPlaneSummary = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/control-plane/summary`, {
      headers: adminHeaders
    }, 10000, payload => payload?.ok === true && payload?.governancePlane?.releaseGovernance?.history >= 1);

    const integrationStatus = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/integrations/status?workspaceId=local-default`, {
      headers: adminHeaders
    }, 10000, payload => payload?.ok === true && payload?.integrationStatus?.governance?.releaseGovernance?.history >= 1);

    const catalog = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/control-plane/catalog`, {
      headers: adminHeaders
    }, 10000, payload => payload?.ok === true && Boolean(payload?.catalog?.routes?.governanceReleaseReplay));

    const publicStatus = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/status`, {}, 10000, payload => payload?.integrations?.governance?.releaseGovernance?.history >= 1);

    const auditActions = Array.isArray(auditExport.json?.events)
      ? auditExport.json.events.map(event => event.action)
      : [];

    const checks = [
      assertCheck(Boolean(queuedReleaseId) && githubConnect.json?.github?.repo === 'skyesoverlondon/skyehands', 'GitHub connect plus push materializes a governed deferred-release artifact instead of a prose-only placeholder', { githubConnect: githubConnect.json?.github, githubPush: githubPush.json?.push, releaseReplay: githubPush.json?.releaseReplay }),
      assertCheck(disabledEvaluation.json?.decision?.reasons?.includes('action_disabled') && disabledEvaluation.json?.decision?.reasons?.includes('missing_secret_scopes'), 'tenant policy denial and missing brokered secret scopes truthfully block release replay before execution', disabledEvaluation.json?.decision),
      assertCheck(secretUpsert.json?.secret?.value === '[REDACTED]' && secretsList.json?.secrets?.some(secret => secret.scope === 'github-release'), 'secret brokerage persists the required scope while keeping brokered values redacted on operator surfaces', { secretUpsert: secretUpsert.json?.secret, secretsList: secretsList.json?.secrets }),
      assertCheck(budgetEvaluation.json?.decision?.reasons?.includes('budget_exceeded') && policyBudgetBlocked.json?.policy?.costControls?.monthlyBudgetCents === 100, 'cost controls deny release replay when the configured tenant budget cannot cover the replay estimate', { policyBudgetBlocked: policyBudgetBlocked.json?.policy, budgetEvaluation: budgetEvaluation.json?.decision }),
      assertCheck(releaseReplay.json?.decision?.allowed === true && releaseReplay.json?.releaseReplay?.queue?.length === 0 && releaseReplay.json?.releaseReplay?.history?.some(item => item.id === queuedReleaseId), 'governed release replay only executes after policy, secret scope, and budget checks pass, and it moves the artifact from queue to history', { replay: releaseReplay.json?.replayed, releaseReplay: releaseReplay.json?.releaseReplay }),
      assertCheck(costsStatus.json?.costs?.spentCents === 250 && costsStatus.json?.costs?.remainingCents === 750, 'cost ledger records the replay charge and exposes remaining tenant budget truthfully', costsStatus.json?.costs),
      assertCheck(auditActions.includes('governance.tenant_policy.update') && auditActions.includes('governance.secret.upsert') && auditActions.includes('scm.release.replay'), 'audit export captures tenant policy mutation, secret-broker activity, and governed release replay in one truthful trail', auditActions),
      assertCheck(Boolean(catalog.json?.catalog?.routes?.tenantGovernancePolicy) && Boolean(catalog.json?.catalog?.routes?.governanceReleaseReplay) && Boolean(controlPlaneSummary.json?.governancePlane?.secretBroker?.total >= 1), 'control-plane catalog and summary expose tenant policy, secret brokerage, release replay, and governance counts as real operator/admin surfaces', { catalog: catalog.json?.catalog?.routes, controlPlaneSummary: controlPlaneSummary.json?.governancePlane }),
      assertCheck(integrationStatus.json?.integrationStatus?.governance?.releaseGovernance?.history >= 1 && publicStatus.json?.integrations?.governance?.costs?.spentCents === 250, 'integration status and public status surfaces report governance replay history and budget usage after execution', { integrationStatus: integrationStatus.json?.integrationStatus?.governance, publicStatus: publicStatus.json?.integrations?.governance })
    ];

    let payload = {
      section: 19,
      label: 'section-19-parity-plus-governance',
      generatedAt: new Date().toISOString(),
      strict,
      proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section19-governance.mjs --strict',
      smokeCommand: 'bash scripts/smoke-section19-governance.sh',
      routes: {
        tenantGovernancePolicies: '/api/governance/tenants/policies',
        tenantGovernancePolicy: '/api/governance/tenants/:tenantId/policy',
        governanceSecrets: '/api/governance/secrets',
        governanceCostStatus: '/api/governance/costs/status',
        governanceReleaseList: '/api/governance/releases',
        governanceReleaseEvaluate: '/api/governance/releases/:releaseId/evaluate',
        governanceReleaseReplay: '/api/governance/releases/:releaseId/replay',
        auditExport: '/api/audit/export'
      },
      artifacts: {
        githubConnect: githubConnect.json,
        githubPush: githubPush.json,
        policyDisabled: policyDisabled.json,
        disabledEvaluation: disabledEvaluation.json,
        secretUpsert: secretUpsert.json,
        secretsList: secretsList.json,
        policyBudgetBlocked: policyBudgetBlocked.json,
        budgetEvaluation: budgetEvaluation.json,
        policyAllowed: policyAllowed.json,
        releaseReplay: releaseReplay.json,
        governanceReleases: governanceReleases.json,
        costsStatus: costsStatus.json,
        auditExport: auditExport.json,
        controlPlaneSummary: controlPlaneSummary.json,
        integrationStatus: integrationStatus.json,
        catalog: catalog.json,
        publicStatus: publicStatus.json
      },
      bridgeLogs,
      checks,
      pass: checks.every(item => item.pass)
    };

    payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section19-governance.mjs');
    console.log(JSON.stringify(payload, null, 2));
  } finally {
    try {
      process.kill(-bridgeChild.pid, 'SIGTERM');
    } catch {}
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
