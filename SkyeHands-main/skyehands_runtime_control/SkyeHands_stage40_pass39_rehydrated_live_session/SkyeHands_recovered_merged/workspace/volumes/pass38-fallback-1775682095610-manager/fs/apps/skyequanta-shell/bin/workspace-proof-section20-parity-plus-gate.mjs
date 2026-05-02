import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

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

async function waitForJson(url, options = {}, timeoutMs = 20000, validate = payload => payload?.ok || payload?.productName) {
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

function getNpmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function parseJsonFromMixedOutput(rawText) {
  const text = String(rawText || '').trim();
  const start = text.indexOf('{');
  if (start === -1) return null;
  try {
    return JSON.parse(text.slice(start));
  } catch {
    return null;
  }
}

function runProofCommand(config, scriptName) {
  const command = getNpmCommand();
  const commandArgs = ['run', scriptName, '--', '--strict'];
  const result = spawnSync(command, commandArgs, {
    cwd: config.rootDir,
    env: { ...process.env },
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024
  });
  return {
    command: ['npm', ...commandArgs].join(' '),
    status: result.status,
    signal: result.signal,
    pass: result.status === 0 && !result.error,
    payload: parseJsonFromMixedOutput(result.stdout),
    stdoutTail: String(result.stdout || '').split(/\r?\n/).filter(Boolean).slice(-20),
    stderrTail: String(result.stderr || '').split(/\r?\n/).filter(Boolean).slice(-20),
    error: result.error ? String(result.error) : null
  };
}

async function main() {
  const strict = process.argv.includes('--strict');
  process.env.SKYEQUANTA_ADMIN_TOKEN = process.env.SKYEQUANTA_ADMIN_TOKEN || 'section20-admin-token';
  process.env.SKYEQUANTA_BRIDGE_PORT = process.env.SKYEQUANTA_BRIDGE_PORT || '4800';
  process.env.SKYEQUANTA_REMOTE_EXECUTOR_PORT = process.env.SKYEQUANTA_REMOTE_EXECUTOR_PORT || '4801';

  const config = getStackConfig(process.env);
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section20-parity-plus-gate.mjs');

  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_20_PARITY_PLUS_FINAL_GATE.json');
  for (const relativePath of ['.skyequanta/audit-log.json', '.skyequanta/scm-state.json']) {
    try {
      fs.rmSync(path.join(config.rootDir, relativePath), { force: true });
    } catch {}
  }

  const prerequisiteSpecs = [
    { key: 'section15', scriptName: 'workspace:proof:section15', artifact: 'docs/proof/SECTION_15_PR_LOOP_REVIEW_WORKFLOW.json' },
    { key: 'section16', scriptName: 'workspace:proof:section16', artifact: 'docs/proof/SECTION_16_COLLABORATION_PRESENCE.json' },
    { key: 'section17', scriptName: 'workspace:proof:section17', artifact: 'docs/proof/SECTION_17_MACHINE_PROFILES_FLEET_CONTROLS.json' },
    { key: 'section18', scriptName: 'workspace:proof:section18', artifact: 'docs/proof/SECTION_18_PREBUILD_BROKERAGE.json' },
    { key: 'section19', scriptName: 'workspace:proof:section19', artifact: 'docs/proof/SECTION_19_PARITY_PLUS_GOVERNANCE.json' }
  ];

  const prerequisiteRuns = prerequisiteSpecs.map(spec => ({
    ...spec,
    result: runProofCommand(config, spec.scriptName)
  }));

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

    const githubConnect = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/integrations/github/connect`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: 'local-default',
        repo: 'skyesoverlondon/skyehands',
        branch: 'push-beyond-final-gate',
        installationId: 'skydexia-final-gate-installation',
        tokenPresent: true
      })
    }, 10000, payload => payload?.ok === true && payload?.github?.connected === true);

    const githubPush = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/integrations/github/push`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: 'local-default',
        branch: 'push-beyond-final-gate',
        message: 'PB-7 final parity-plus gate proof'
      })
    }, 10000, payload => payload?.ok === true && payload?.push?.status === 'materialized');

    const pullRequestCreate = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/github/prs/create`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: 'local-default',
        baseBranch: 'main',
        headBranch: 'push-beyond-final-gate',
        title: 'PB-7 final parity-plus gate PR',
        requestedReviewers: ['skydexia-reviewer']
      })
    }, 10000, payload => payload?.ok === true && payload?.pullRequest?.status === 'open');

    const prId = pullRequestCreate.json?.pullRequest?.id;
    if (!prId) {
      throw new Error('PR create did not return a pull request id.');
    }

    const reviewRequest = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/github/prs/${prId}/review-request`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ reviewers: ['skydexia-reviewer'] })
    }, 10000, payload => payload?.ok === true && payload?.mergePolicy);

    const reviewSubmit = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/github/prs/${prId}/reviews`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ reviewer: 'skydexia-reviewer', decision: 'approved', summary: 'PB-7 approval' })
    }, 10000, payload => payload?.ok === true && payload?.review?.decision === 'approved');

    const mergePullRequest = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/github/prs/${prId}/merge`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ strategy: 'squash', author: 'skydexia-reviewer' })
    }, 10000, payload => payload?.ok === true && payload?.pullRequest?.status === 'merged');

    const integrationStatus = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/integrations/status?workspaceId=local-default`, {
      headers: adminHeaders
    }, 10000, payload => payload?.ok === true && payload?.integrationStatus?.github?.connected === true);

    const controlPlaneSummary = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/control-plane/summary`, {
      headers: adminHeaders
    }, 10000, payload => payload?.ok === true && payload?.governancePlane && payload?.prebuild && payload?.fleet && payload?.collaboration);

    const publicStatus = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/status`, {}, 10000, payload => payload?.productName === config.productName && payload?.integrations?.governance);

    const checks = [
      assertCheck(prerequisiteRuns.every(item => item.result.pass && item.result.payload?.pass === true), 'sections 15 through 19 all rerun green in one final parity-plus gate execution instead of relying on stale proof artifacts', prerequisiteRuns.map(item => ({ key: item.key, command: item.result.command, pass: item.result.pass, payloadPass: item.result.payload?.pass === true, artifact: item.artifact }))),
      assertCheck(githubConnect.json?.github?.repo === 'skyesoverlondon/skyehands' && githubPush.json?.releaseReplay?.queue?.length >= 1, 'donor convergence surfaces still materialize GitHub connect, push, and deferred release artifacts inside the final parity-plus gate', { githubConnect: githubConnect.json?.github, githubPush: githubPush.json?.releaseReplay }),
      assertCheck(Boolean(integrationStatus.json?.integrationStatus?.workspaceMap?.root) && typeof integrationStatus.json?.integrationStatus?.profiles?.activeProfileId === 'string' && integrationStatus.json?.integrationStatus?.releaseReplay?.queue?.length >= 1, 'integration status exposes donor-convergence state including workspace-map identity, active profile truth, and queued release replay artifacts', integrationStatus.json?.integrationStatus),
      assertCheck(controlPlaneSummary.json?.collaboration?.activeOperators >= 1 && controlPlaneSummary.json?.fleet?.profileCount >= 1 && controlPlaneSummary.json?.prebuild?.templateCount >= 1 && controlPlaneSummary.json?.governancePlane?.releaseGovernance?.history >= 1, 'control-plane summary reports collaboration, fleet, prebuild, and governance planes as one parity-plus surface after prerequisite proofs run', { collaboration: controlPlaneSummary.json?.collaboration, fleet: controlPlaneSummary.json?.fleet, prebuild: controlPlaneSummary.json?.prebuild, governancePlane: controlPlaneSummary.json?.governancePlane }),
      assertCheck(publicStatus.json?.integrations?.github?.connected === true && publicStatus.json?.integrations?.pullRequests?.merged >= 1 && publicStatus.json?.integrations?.governance?.releaseGovernance?.history >= 1, 'public status surface reports the converged donor lane, PR lane, and governance lane after the final parity-plus gate finishes', publicStatus.json?.integrations)
    ];

    let payload = {
      section: 20,
      label: 'section-20-parity-plus-final-gate',
      generatedAt: new Date().toISOString(),
      strict,
      proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section20-parity-plus-gate.mjs --strict',
      smokeCommand: 'bash scripts/smoke-section20-parity-plus-gate.sh',
      routes: {
        parityPlusFinalGate: '/api/proof/parity-plus-final-gate',
        integrationStatus: '/api/integrations/status',
        controlPlaneSummary: '/api/control-plane/summary',
        publicStatus: '/api/status'
      },
      prerequisiteRuns,
      artifacts: {
        githubConnect: githubConnect.json,
        githubPush: githubPush.json,
        pullRequestCreate: pullRequestCreate.json,
        reviewRequest: reviewRequest.json,
        reviewSubmit: reviewSubmit.json,
        mergePullRequest: mergePullRequest.json,
        integrationStatus: integrationStatus.json,
        controlPlaneSummary: controlPlaneSummary.json,
        publicStatus: publicStatus.json
      },
      bridgeLogs,
      checks,
      completion: {
        directiveLanesTotal: 7,
        directiveLanesComplete: checks.every(item => item.pass) ? 7 : 6,
        directiveLanesRemaining: checks.every(item => item.pass) ? 0 : 1,
        remainingLaneNames: checks.every(item => item.pass) ? [] : ['PB-7 final parity-plus proof gate']
      },
      pass: checks.every(item => item.pass)
    };

    payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section20-parity-plus-gate.mjs');
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
