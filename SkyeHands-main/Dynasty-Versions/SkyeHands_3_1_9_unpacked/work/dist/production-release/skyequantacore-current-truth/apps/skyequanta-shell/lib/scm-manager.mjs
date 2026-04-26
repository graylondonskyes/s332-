import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { appendAuditEvent } from './governance-manager.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function normalizeWorkspaceId(value) {
  return String(value || '').trim() || 'local-default';
}

function normalizeTenantId(value) {
  return String(value || '').trim().toLowerCase() || 'local';
}

function normalizeRepo(value) {
  return String(value || '').trim();
}

function normalizeBranch(value, fallback = 'main') {
  return String(value || '').trim() || fallback;
}

function normalizeArray(values = []) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map(value => String(value || '').trim())
    .filter(Boolean);
}

function emptyStore() {
  return {
    version: 1,
    counters: {
      pullRequestNumber: 1,
      pushSequence: 1
    },
    workspaces: {},
    pullRequests: []
  };
}

function nextPullRequestNumber(store) {
  const current = Number.parseInt(String(store?.counters?.pullRequestNumber || 1), 10);
  const number = Number.isInteger(current) && current > 0 ? current : 1;
  store.counters = store.counters || {};
  store.counters.pullRequestNumber = number + 1;
  return number;
}

function nextPushSequence(store) {
  const current = Number.parseInt(String(store?.counters?.pushSequence || 1), 10);
  const sequence = Number.isInteger(current) && current > 0 ? current : 1;
  store.counters = store.counters || {};
  store.counters.pushSequence = sequence + 1;
  return sequence;
}

function buildSyntheticCommitSha(seed) {
  return crypto.createHash('sha1').update(String(seed)).digest('hex');
}

export function getScmStorePath(config) {
  return path.join(config.rootDir, '.skyequanta', 'scm-state.json');
}

function loadStore(config) {
  const store = readJson(getScmStorePath(config), emptyStore());
  if (!store || typeof store !== 'object') {
    return emptyStore();
  }

  return {
    version: 1,
    counters: {
      pullRequestNumber: Number.parseInt(String(store?.counters?.pullRequestNumber || 1), 10) || 1,
      pushSequence: Number.parseInt(String(store?.counters?.pushSequence || 1), 10) || 1
    },
    workspaces: store.workspaces && typeof store.workspaces === 'object' ? store.workspaces : {},
    pullRequests: Array.isArray(store.pullRequests) ? store.pullRequests : []
  };
}

function saveStore(config, store) {
  writeJson(getScmStorePath(config), store);
  return store;
}

export function ensureScmStore(config) {
  const store = loadStore(config);
  saveStore(config, store);
  return store;
}

function ensureWorkspaceRecord(store, workspaceId) {
  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
  if (!store.workspaces[normalizedWorkspaceId] || typeof store.workspaces[normalizedWorkspaceId] !== 'object') {
    store.workspaces[normalizedWorkspaceId] = {
      github: {
        connected: false,
        repo: null,
        branch: 'main',
        installationId: null,
        lastPushAt: null,
        lastPushCommitSha: null,
        pushes: []
      },
      netlify: {
        connected: false,
        siteId: null,
        siteName: null,
        teamId: null,
        lastDeployAt: null,
        deploys: []
      },
      workspaceMap: {
        cachedAt: null,
        files: [],
        root: '.'
      },
      profiles: {
        activeProfileId: 'standard',
        saved: []
      },
      releaseReplay: {
        queue: [],
        history: []
      }
    };
  }

  return store.workspaces[normalizedWorkspaceId];
}

export function getIntegrationStatus(config, workspaceId) {
  const store = loadStore(config);
  const record = ensureWorkspaceRecord(store, workspaceId);
  const relatedPrs = store.pullRequests.filter(item => item.workspaceId === normalizeWorkspaceId(workspaceId));
  return {
    workspaceId: normalizeWorkspaceId(workspaceId),
    github: record.github,
    netlify: record.netlify,
    workspaceMap: record.workspaceMap,
    profiles: record.profiles,
    releaseReplay: record.releaseReplay,
    pullRequests: {
      total: relatedPrs.length,
      open: relatedPrs.filter(item => item.status === 'open').length,
      merged: relatedPrs.filter(item => item.status === 'merged').length,
      latest: relatedPrs.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0] || null
    }
  };
}

export function connectGitHubIntegration(config, options = {}) {
  const store = loadStore(config);
  const workspaceId = normalizeWorkspaceId(options.workspaceId);
  const workspaceRecord = ensureWorkspaceRecord(store, workspaceId);
  const repo = normalizeRepo(options.repo);
  if (!repo || !/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    throw new Error('GitHub repo must use owner/repo format.');
  }

  const stamp = nowIso();
  workspaceRecord.github = {
    ...workspaceRecord.github,
    connected: true,
    repo,
    branch: normalizeBranch(options.branch, workspaceRecord.github?.branch || 'main'),
    installationId: String(options.installationId || '').trim() || null,
    tokenPresent: Boolean(options.tokenPresent),
    connectedAt: workspaceRecord.github?.connectedAt || stamp,
    updatedAt: stamp
  };

  saveStore(config, store);
  appendAuditEvent(config, {
    action: 'scm.github.connect',
    actorType: 'operator',
    actorId: String(options.actorId || 'scm-connect').trim() || 'scm-connect',
    tenantId: normalizeTenantId(options.tenantId),
    workspaceId,
    detail: {
      repo,
      branch: workspaceRecord.github.branch,
      installationId: workspaceRecord.github.installationId,
      tokenPresent: workspaceRecord.github.tokenPresent
    }
  });

  return { workspaceId, github: workspaceRecord.github };
}

export function queueGitHubPush(config, options = {}) {
  const store = loadStore(config);
  const workspaceId = normalizeWorkspaceId(options.workspaceId);
  const workspaceRecord = ensureWorkspaceRecord(store, workspaceId);
  if (!workspaceRecord.github?.connected || !workspaceRecord.github?.repo) {
    throw new Error('GitHub integration is not configured for this workspace.');
  }

  const stamp = nowIso();
  const sequence = nextPushSequence(store);
  const branch = normalizeBranch(options.branch, workspaceRecord.github.branch || 'main');
  const commitSha = buildSyntheticCommitSha(`${workspaceId}:${branch}:${sequence}:${options.message || ''}:${stamp}`);
  const pushRecord = {
    id: crypto.randomUUID(),
    sequence,
    repo: workspaceRecord.github.repo,
    branch,
    message: String(options.message || '').trim() || `SkyeQuanta push ${sequence}`,
    commitSha,
    queuedAt: stamp,
    status: 'materialized',
    source: 'skydexia-donor-convergence'
  };

  workspaceRecord.github.branch = branch;
  workspaceRecord.github.lastPushAt = stamp;
  workspaceRecord.github.lastPushCommitSha = commitSha;
  workspaceRecord.github.updatedAt = stamp;
  workspaceRecord.github.pushes = Array.isArray(workspaceRecord.github.pushes)
    ? [...workspaceRecord.github.pushes, pushRecord].slice(-50)
    : [pushRecord];

  workspaceRecord.releaseReplay.queue = Array.isArray(workspaceRecord.releaseReplay.queue)
    ? [...workspaceRecord.releaseReplay.queue, {
      id: crypto.randomUUID(),
      channel: 'GitHub',
      queuedAt: stamp,
      message: pushRecord.message,
      commitSha,
      branch,
      repo: workspaceRecord.github.repo,
      replayStatus: 'ready'
    }].slice(-50)
    : [];

  saveStore(config, store);
  appendAuditEvent(config, {
    action: 'scm.github.push',
    actorType: 'operator',
    actorId: String(options.actorId || 'scm-push').trim() || 'scm-push',
    tenantId: normalizeTenantId(options.tenantId),
    workspaceId,
    detail: {
      repo: workspaceRecord.github.repo,
      branch,
      commitSha,
      message: pushRecord.message
    }
  });

  return {
    workspaceId,
    github: workspaceRecord.github,
    push: pushRecord,
    releaseReplay: workspaceRecord.releaseReplay
  };
}

function normalizePullRequest(record) {
  const requestedReviewers = normalizeArray(record?.requestedReviewers);
  const comments = Array.isArray(record?.comments) ? record.comments : [];
  const reviews = Array.isArray(record?.reviews) ? record.reviews : [];
  return {
    id: String(record?.id || '').trim(),
    number: Number.parseInt(String(record?.number || 0), 10) || 0,
    workspaceId: normalizeWorkspaceId(record?.workspaceId),
    tenantId: normalizeTenantId(record?.tenantId),
    repo: normalizeRepo(record?.repo),
    status: String(record?.status || 'open').trim() || 'open',
    title: String(record?.title || '').trim(),
    body: String(record?.body || '').trim(),
    baseBranch: normalizeBranch(record?.baseBranch, 'main'),
    headBranch: normalizeBranch(record?.headBranch, 'main'),
    author: String(record?.author || 'operator').trim() || 'operator',
    createdAt: String(record?.createdAt || nowIso()),
    updatedAt: String(record?.updatedAt || nowIso()),
    mergedAt: record?.mergedAt ? String(record.mergedAt) : null,
    requestedReviewers,
    requiredApprovals: Number.parseInt(String(record?.requiredApprovals || Math.max(1, requestedReviewers.length || 1)), 10) || 1,
    comments,
    reviews,
    mergeStatus: record?.mergeStatus || null,
    source: String(record?.source || 'skyequanta-control-plane').trim() || 'skyequanta-control-plane'
  };
}

function latestReviewByReviewer(reviews = []) {
  const map = new Map();
  for (const review of reviews) {
    const reviewer = String(review?.reviewer || '').trim();
    if (!reviewer) continue;
    const existing = map.get(reviewer);
    if (!existing || String(existing.submittedAt || '').localeCompare(String(review.submittedAt || '')) < 0) {
      map.set(reviewer, review);
    }
  }
  return map;
}

export function getPullRequestMergePolicy(config, prId) {
  const store = loadStore(config);
  const pr = store.pullRequests.map(normalizePullRequest).find(item => item.id === String(prId || '').trim());
  if (!pr) {
    throw new Error(`Pull request '${prId}' was not found.`);
  }

  const latestReviews = latestReviewByReviewer(pr.reviews);
  const approvals = [...latestReviews.values()].filter(review => String(review.decision || '').toLowerCase() === 'approved');
  const changesRequested = [...latestReviews.values()].filter(review => String(review.decision || '').toLowerCase() === 'changes_requested');
  const unresolvedComments = pr.comments.filter(comment => !comment.resolvedAt);
  const pendingRequestedReviewers = pr.requestedReviewers.filter(reviewer => !latestReviews.has(reviewer));
  const open = pr.status === 'open';
  const mergeable = open && approvals.length >= pr.requiredApprovals && unresolvedComments.length === 0 && changesRequested.length === 0;

  return {
    pullRequestId: pr.id,
    pullRequestNumber: pr.number,
    repo: pr.repo,
    workspaceId: pr.workspaceId,
    status: pr.status,
    approvalsRequired: pr.requiredApprovals,
    approvalsReceived: approvals.length,
    pendingRequestedReviewers,
    unresolvedComments: unresolvedComments.length,
    changesRequested: changesRequested.length,
    mergeable,
    reasons: {
      missingApprovals: Math.max(0, pr.requiredApprovals - approvals.length),
      pendingRequestedReviewers,
      unresolvedCommentIds: unresolvedComments.map(comment => comment.id),
      changeRequestReviewers: changesRequested.map(review => review.reviewer)
    }
  };
}

export function createPullRequest(config, options = {}) {
  const store = loadStore(config);
  const workspaceId = normalizeWorkspaceId(options.workspaceId);
  const workspaceRecord = ensureWorkspaceRecord(store, workspaceId);
  if (!workspaceRecord.github?.connected || !workspaceRecord.github?.repo) {
    throw new Error('GitHub integration is not configured for this workspace.');
  }

  const headBranch = normalizeBranch(options.headBranch, workspaceRecord.github.branch || 'main');
  const baseBranch = normalizeBranch(options.baseBranch, 'main');
  if (headBranch === baseBranch) {
    throw new Error('headBranch must differ from baseBranch to create a pull request.');
  }

  const stamp = nowIso();
  const pullRequest = normalizePullRequest({
    id: crypto.randomUUID(),
    number: nextPullRequestNumber(store),
    workspaceId,
    tenantId: normalizeTenantId(options.tenantId),
    repo: workspaceRecord.github.repo,
    status: 'open',
    title: String(options.title || '').trim() || `Push Beyond PR · ${headBranch}`,
    body: String(options.body || '').trim() || 'Generated from the SkyeHands canonical PR loop.',
    baseBranch,
    headBranch,
    author: String(options.author || 'operator').trim() || 'operator',
    requestedReviewers: normalizeArray(options.requestedReviewers),
    requiredApprovals: Number.parseInt(String(options.requiredApprovals || 1), 10) || 1,
    comments: [],
    reviews: [],
    source: 'skydexia-pr-loop'
  });

  store.pullRequests.push(pullRequest);
  saveStore(config, store);
  appendAuditEvent(config, {
    action: 'scm.github.pr.create',
    actorType: 'operator',
    actorId: String(options.actorId || pullRequest.author).trim() || pullRequest.author,
    tenantId: pullRequest.tenantId,
    workspaceId,
    detail: {
      number: pullRequest.number,
      repo: pullRequest.repo,
      baseBranch,
      headBranch
    }
  });

  return {
    pullRequest,
    mergePolicy: getPullRequestMergePolicy(config, pullRequest.id)
  };
}

export function listPullRequests(config, filters = {}) {
  const workspaceId = filters.workspaceId ? normalizeWorkspaceId(filters.workspaceId) : null;
  const status = String(filters.status || '').trim();
  const repo = normalizeRepo(filters.repo);
  const store = loadStore(config);
  return store.pullRequests
    .map(normalizePullRequest)
    .filter(item => {
      if (workspaceId && item.workspaceId !== workspaceId) return false;
      if (status && item.status !== status) return false;
      if (repo && item.repo !== repo) return false;
      return true;
    })
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

export function getPullRequest(config, prId) {
  const pullRequest = listPullRequests(config).find(item => item.id === String(prId || '').trim());
  if (!pullRequest) {
    throw new Error(`Pull request '${prId}' was not found.`);
  }
  return pullRequest;
}

function updatePullRequest(store, prId, updater) {
  const targetId = String(prId || '').trim();
  const index = store.pullRequests.findIndex(item => String(item?.id || '').trim() === targetId);
  if (index === -1) {
    throw new Error(`Pull request '${prId}' was not found.`);
  }
  const current = normalizePullRequest(store.pullRequests[index]);
  const next = normalizePullRequest(updater(current));
  store.pullRequests[index] = next;
  return next;
}

export function requestPullRequestReview(config, options = {}) {
  const store = loadStore(config);
  const reviewers = normalizeArray(options.reviewers);
  if (reviewers.length === 0) {
    throw new Error('At least one reviewer is required.');
  }
  const stamp = nowIso();
  const pullRequest = updatePullRequest(store, options.prId, current => ({
    ...current,
    requestedReviewers: [...new Set([...current.requestedReviewers, ...reviewers])],
    updatedAt: stamp,
    requiredApprovals: Math.max(current.requiredApprovals || 1, Math.min(2, [...new Set([...current.requestedReviewers, ...reviewers])].length || 1))
  }));
  saveStore(config, store);
  appendAuditEvent(config, {
    action: 'scm.github.pr.review_request',
    actorType: 'operator',
    actorId: String(options.actorId || 'pr-review-request').trim() || 'pr-review-request',
    tenantId: pullRequest.tenantId,
    workspaceId: pullRequest.workspaceId,
    detail: {
      number: pullRequest.number,
      reviewers
    }
  });

  return {
    pullRequest,
    mergePolicy: getPullRequestMergePolicy(config, pullRequest.id)
  };
}

export function addPullRequestComment(config, options = {}) {
  const body = String(options.body || '').trim();
  if (!body) {
    throw new Error('Comment body is required.');
  }
  const store = loadStore(config);
  const stamp = nowIso();
  const comment = {
    id: crypto.randomUUID(),
    author: String(options.author || 'operator').trim() || 'operator',
    body,
    createdAt: stamp,
    updatedAt: stamp,
    resolvedAt: null,
    resolutionAuthor: null
  };
  const pullRequest = updatePullRequest(store, options.prId, current => ({
    ...current,
    comments: [...current.comments, comment],
    updatedAt: stamp
  }));
  saveStore(config, store);
  appendAuditEvent(config, {
    action: 'scm.github.pr.comment',
    actorType: 'operator',
    actorId: String(options.actorId || comment.author).trim() || comment.author,
    tenantId: pullRequest.tenantId,
    workspaceId: pullRequest.workspaceId,
    detail: {
      number: pullRequest.number,
      commentId: comment.id
    }
  });

  return {
    pullRequest,
    comment,
    mergePolicy: getPullRequestMergePolicy(config, pullRequest.id)
  };
}

export function resolvePullRequestComment(config, options = {}) {
  const commentId = String(options.commentId || '').trim();
  if (!commentId) {
    throw new Error('commentId is required.');
  }
  const store = loadStore(config);
  const stamp = nowIso();
  const resolver = String(options.author || 'operator').trim() || 'operator';
  const pullRequest = updatePullRequest(store, options.prId, current => ({
    ...current,
    comments: current.comments.map(comment => comment.id === commentId
      ? {
        ...comment,
        updatedAt: stamp,
        resolvedAt: comment.resolvedAt || stamp,
        resolutionAuthor: resolver
      }
      : comment),
    updatedAt: stamp
  }));
  saveStore(config, store);
  appendAuditEvent(config, {
    action: 'scm.github.pr.comment.resolve',
    actorType: 'operator',
    actorId: String(options.actorId || resolver).trim() || resolver,
    tenantId: pullRequest.tenantId,
    workspaceId: pullRequest.workspaceId,
    detail: {
      number: pullRequest.number,
      commentId
    }
  });

  return {
    pullRequest,
    mergePolicy: getPullRequestMergePolicy(config, pullRequest.id)
  };
}

export function submitPullRequestReview(config, options = {}) {
  const reviewer = String(options.reviewer || '').trim();
  if (!reviewer) {
    throw new Error('reviewer is required.');
  }
  const decision = String(options.decision || '').trim().toLowerCase();
  if (!['approved', 'changes_requested', 'commented'].includes(decision)) {
    throw new Error('decision must be approved, changes_requested, or commented.');
  }
  const store = loadStore(config);
  const stamp = nowIso();
  const review = {
    id: crypto.randomUUID(),
    reviewer,
    decision,
    summary: String(options.summary || '').trim() || null,
    submittedAt: stamp
  };
  const pullRequest = updatePullRequest(store, options.prId, current => ({
    ...current,
    reviews: [...current.reviews, review],
    updatedAt: stamp
  }));
  saveStore(config, store);
  appendAuditEvent(config, {
    action: 'scm.github.pr.review',
    actorType: 'operator',
    actorId: String(options.actorId || reviewer).trim() || reviewer,
    tenantId: pullRequest.tenantId,
    workspaceId: pullRequest.workspaceId,
    detail: {
      number: pullRequest.number,
      reviewer,
      decision
    }
  });

  return {
    pullRequest,
    review,
    mergePolicy: getPullRequestMergePolicy(config, pullRequest.id)
  };
}

export function mergePullRequest(config, options = {}) {
  const store = loadStore(config);
  const stamp = nowIso();
  const currentPolicy = getPullRequestMergePolicy(config, options.prId);
  if (!currentPolicy.mergeable) {
    throw new Error('Pull request does not currently satisfy merge policy.');
  }

  const pullRequest = updatePullRequest(store, options.prId, current => ({
    ...current,
    status: 'merged',
    mergedAt: stamp,
    mergeStatus: {
      mergedBy: String(options.author || 'operator').trim() || 'operator',
      mergedAt: stamp,
      strategy: String(options.strategy || 'squash').trim() || 'squash'
    },
    updatedAt: stamp
  }));
  saveStore(config, store);
  appendAuditEvent(config, {
    action: 'scm.github.pr.merge',
    actorType: 'operator',
    actorId: String(options.actorId || pullRequest.mergeStatus.mergedBy).trim() || pullRequest.mergeStatus.mergedBy,
    tenantId: pullRequest.tenantId,
    workspaceId: pullRequest.workspaceId,
    detail: {
      number: pullRequest.number,
      strategy: pullRequest.mergeStatus.strategy
    }
  });

  return {
    pullRequest,
    mergePolicy: getPullRequestMergePolicy(config, pullRequest.id)
  };
}


export function listReleaseReplayItems(config, workspaceId) {
  const store = loadStore(config);
  const record = ensureWorkspaceRecord(store, workspaceId);
  return {
    workspaceId: normalizeWorkspaceId(workspaceId),
    queue: Array.isArray(record.releaseReplay?.queue)
      ? record.releaseReplay.queue.map(item => ({ ...item }))
      : [],
    history: Array.isArray(record.releaseReplay?.history)
      ? record.releaseReplay.history.map(item => ({ ...item }))
      : []
  };
}

export function replayReleaseReplayItem(config, options = {}) {
  const store = loadStore(config);
  const workspaceId = normalizeWorkspaceId(options.workspaceId);
  const record = ensureWorkspaceRecord(store, workspaceId);
  const releaseId = String(options.releaseId || '').trim();
  if (!releaseId) {
    throw new Error('releaseId is required to replay a deferred release.');
  }
  const queue = Array.isArray(record.releaseReplay?.queue) ? record.releaseReplay.queue : [];
  const index = queue.findIndex(item => String(item?.id || '').trim() === releaseId);
  if (index === -1) {
    throw new Error(`Deferred release '${releaseId}' was not found.`);
  }
  const stamp = nowIso();
  const target = { ...queue[index] };
  const replayed = {
    ...target,
    replayedAt: stamp,
    replayStatus: 'replayed',
    replayedBy: String(options.actorId || 'release-replay').trim() || 'release-replay',
    governanceDecisionId: String(options.governanceDecisionId || '').trim() || null,
    source: String(options.source || target.source || 'governance-release-replay').trim() || 'governance-release-replay'
  };
  record.releaseReplay.queue = [...queue.slice(0, index), ...queue.slice(index + 1)];
  record.releaseReplay.history = [replayed, ...(Array.isArray(record.releaseReplay.history) ? record.releaseReplay.history : [])].slice(0, 100);
  saveStore(config, store);
  appendAuditEvent(config, {
    action: 'scm.release.replay',
    actorType: 'operator',
    actorId: replayed.replayedBy,
    tenantId: normalizeTenantId(options.tenantId),
    workspaceId,
    detail: {
      releaseId: replayed.id,
      branch: replayed.branch,
      repo: replayed.repo,
      governanceDecisionId: replayed.governanceDecisionId
    }
  });
  return {
    workspaceId,
    replayed,
    releaseReplay: record.releaseReplay
  };
}
