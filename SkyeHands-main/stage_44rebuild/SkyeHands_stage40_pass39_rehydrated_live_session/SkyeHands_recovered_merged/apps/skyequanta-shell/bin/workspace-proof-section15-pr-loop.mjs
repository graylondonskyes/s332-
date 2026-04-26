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
  process.env.SKYEQUANTA_ADMIN_TOKEN = process.env.SKYEQUANTA_ADMIN_TOKEN || 'section15-admin-token';
  process.env.SKYEQUANTA_BRIDGE_PORT = process.env.SKYEQUANTA_BRIDGE_PORT || '4750';
  process.env.SKYEQUANTA_REMOTE_EXECUTOR_PORT = process.env.SKYEQUANTA_REMOTE_EXECUTOR_PORT || '4751';

  const config = getStackConfig(process.env);
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section15-pr-loop.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_15_PR_LOOP_REVIEW_WORKFLOW.json');

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

    const integrationConnect = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/integrations/github/connect`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: 'local-default',
        repo: 'skyesoverlondon/skyehands',
        branch: 'feature/push-beyond-pr',
        installationId: 'skydexia-installation',
        tokenPresent: false
      })
    }, 10000, payload => payload?.ok === true && payload?.github?.connected === true);

    const githubPush = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/integrations/github/push`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: 'local-default',
        branch: 'feature/push-beyond-pr',
        message: 'Push Beyond convergence for PR lane'
      })
    }, 10000, payload => payload?.ok === true && Boolean(payload?.push?.commitSha));

    const prCreate = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/github/prs/create`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        workspaceId: 'local-default',
        title: 'Push Beyond · PR loop convergence',
        body: 'Materialized through the canonical SkyeHands PR lane.',
        baseBranch: 'main',
        headBranch: 'feature/push-beyond-pr',
        requestedReviewers: ['skydexia-review-bot'],
        requiredApprovals: 1
      })
    }, 10000, payload => payload?.ok === true && Boolean(payload?.pullRequest?.id));

    const prId = prCreate.json.pullRequest.id;

    const prStatus = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/github/prs/${prId}`, {
      headers: adminHeaders
    }, 10000, payload => payload?.ok === true && payload?.pullRequest?.status === 'open');

    const reviewRequest = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/github/prs/${prId}/review-request`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ reviewers: ['skydexia-review-bot', 'founder-gateway'] })
    }, 10000, payload => payload?.ok === true && Array.isArray(payload?.pullRequest?.requestedReviewers) && payload.pullRequest.requestedReviewers.length >= 2);

    const commentCreate = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/github/prs/${prId}/comments`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ body: 'Resolve the final review note before merge.' })
    }, 10000, payload => payload?.ok === true && Boolean(payload?.comment?.id));

    const commentId = commentCreate.json.comment.id;

    const mergePolicyBlocked = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/github/prs/${prId}/merge-policy`, {
      headers: adminHeaders
    }, 10000, payload => payload?.ok === true && payload?.mergePolicy?.mergeable === false);

    const resolveComment = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/github/prs/${prId}/comments/${commentId}/resolve`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({})
    }, 10000, payload => payload?.ok === true && payload?.mergePolicy?.unresolvedComments === 0);

    const submitReview = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/github/prs/${prId}/reviews`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ reviewer: 'skydexia-review-bot', decision: 'approved', summary: 'PR lane looks good.' })
    }, 10000, payload => payload?.ok === true && payload?.review?.decision === 'approved');

    const submitFounderReview = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/github/prs/${prId}/reviews`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ reviewer: 'founder-gateway', decision: 'approved', summary: 'Founder parity check passed.' })
    }, 10000, payload => payload?.ok === true && payload?.review?.decision === 'approved');

    const mergePolicyReady = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/github/prs/${prId}/merge-policy`, {
      headers: adminHeaders
    }, 10000, payload => payload?.ok === true && payload?.mergePolicy?.mergeable === true);

    const mergePr = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/github/prs/${prId}/merge`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ strategy: 'squash' })
    }, 10000, payload => payload?.ok === true && payload?.pullRequest?.status === 'merged');

    const integrationsStatus = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/integrations/status?workspaceId=local-default`, {
      headers: adminHeaders
    }, 10000, payload => payload?.ok === true && payload?.integrationStatus?.pullRequests?.merged >= 1);

    const catalog = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/control-plane/catalog`, {
      headers: adminHeaders
    }, 10000, payload => payload?.ok === true && Boolean(payload?.catalog?.routes?.pullRequestCreate));

    const status = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/api/status`, {}, 10000, payload => payload?.integrations?.pullRequests?.merged >= 1);

    const checks = [
      assertCheck(integrationConnect.json?.github?.connected === true && integrationConnect.json?.github?.repo === 'skyesoverlondon/skyehands', 'GitHub connect route persists workspace repo contract', integrationConnect.json?.github),
      assertCheck(Boolean(githubPush.json?.push?.commitSha) && githubPush.json?.github?.branch === 'feature/push-beyond-pr', 'GitHub push route materializes a commit-shaped push artifact on the feature branch', githubPush.json?.push),
      assertCheck(prCreate.json?.pullRequest?.headBranch === 'feature/push-beyond-pr' && prCreate.json?.pullRequest?.baseBranch === 'main', 'PR create route binds head and base branches to the canonical workspace truth path', prCreate.json?.pullRequest),
      assertCheck(prStatus.json?.pullRequest?.status === 'open', 'PR status fetch returns the open pull request record', prStatus.json?.pullRequest),
      assertCheck(Array.isArray(reviewRequest.json?.pullRequest?.requestedReviewers) && reviewRequest.json.pullRequest.requestedReviewers.includes('founder-gateway'), 'review-request route persists requested reviewers', reviewRequest.json?.pullRequest),
      assertCheck(commentCreate.json?.mergePolicy?.unresolvedComments === 1 && mergePolicyBlocked.json?.mergePolicy?.mergeable === false, 'comment ingest blocks merge policy until the comment is resolved', { commentCreate: commentCreate.json?.mergePolicy, mergePolicyBlocked: mergePolicyBlocked.json?.mergePolicy }),
      assertCheck(resolveComment.json?.mergePolicy?.unresolvedComments === 0, 'comment resolve route clears unresolved comment blockers', resolveComment.json?.mergePolicy),
      assertCheck(submitReview.json?.review?.decision === 'approved' && submitFounderReview.json?.review?.decision === 'approved' && mergePolicyReady.json?.mergePolicy?.mergeable === true, 'review submission unlocks merge policy after required approvals land', { review: submitReview.json?.review, founderReview: submitFounderReview.json?.review, mergePolicyReady: mergePolicyReady.json?.mergePolicy }),
      assertCheck(mergePr.json?.pullRequest?.status === 'merged', 'merge route closes the pull request only after policy passes', mergePr.json?.pullRequest),
      assertCheck(integrationsStatus.json?.integrationStatus?.pullRequests?.merged >= 1, 'integration status summarizes merged PR state for the workspace', integrationsStatus.json?.integrationStatus),
      assertCheck(Boolean(catalog.json?.catalog?.routes?.pullRequestMergePolicy) && Boolean(catalog.json?.catalog?.routes?.githubPush), 'control-plane catalog exposes PR loop and donor convergence routes', catalog.json?.catalog?.routes),
      assertCheck(status.json?.integrations?.pullRequests?.merged >= 1 && status.json?.integrations?.github?.lastPushCommitSha === githubPush.json?.push?.commitSha, 'public status surface reports GitHub push and PR summary state', status.json?.integrations)
    ];

    let payload = {
      section: 15,
      label: 'section-15-pr-loop-review-workflow',
      generatedAt: new Date().toISOString(),
      strict,
      proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section15-pr-loop.mjs --strict',
      smokeCommand: 'bash scripts/smoke-section15-pr-loop.sh',
      routes: {
        githubConnect: '/api/integrations/github/connect',
        githubPush: '/api/integrations/github/push',
        pullRequestCreate: '/api/github/prs/create',
        pullRequestDetail: '/api/github/prs/:prId',
        pullRequestReviewRequest: '/api/github/prs/:prId/review-request',
        pullRequestCommentCreate: '/api/github/prs/:prId/comments',
        pullRequestCommentResolve: '/api/github/prs/:prId/comments/:commentId/resolve',
        pullRequestReviewSubmit: '/api/github/prs/:prId/reviews',
        pullRequestMergePolicy: '/api/github/prs/:prId/merge-policy',
        pullRequestMerge: '/api/github/prs/:prId/merge'
      },
      artifacts: {
        integrationConnect: integrationConnect.json,
        githubPush: githubPush.json,
        prCreate: prCreate.json,
        prStatus: prStatus.json,
        reviewRequest: reviewRequest.json,
        commentCreate: commentCreate.json,
        mergePolicyBlocked: mergePolicyBlocked.json,
        resolveComment: resolveComment.json,
        submitReview: submitReview.json,
        submitFounderReview: submitFounderReview.json,
        mergePolicyReady: mergePolicyReady.json,
        mergePr: mergePr.json,
        integrationsStatus: integrationsStatus.json,
        catalog: catalog.json,
        status: status.json
      },
      bridgeLogs,
      checks,
      pass: checks.every(item => item.pass)
    };

    payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section15-pr-loop.mjs');
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
