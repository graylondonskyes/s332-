import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { appendAuditEvent } from './governance-manager.mjs';
import { createWorkspaceSnapshot, getWorkspaceSnapshot, restoreWorkspaceSnapshot } from './snapshot-manager.mjs';
import { recordFileOperation, recordRuntimeMessage, publishRuntimeEvent } from './runtime-bus.mjs';
import { getWorkspace } from './workspace-manager.mjs';
import { inspectWorkspacePath, readWorkspaceContent, searchWorkspaceFiles, listChangedWorkspaceFiles, getWorkspaceAssociationSummary } from './file-ergonomics.mjs';
import { getWorkspaceSandboxPaths } from './workspace-runtime.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
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
  return String(value || '').trim().toLowerCase();
}

function normalizeStatus(value, fallback = 'proposed') {
  const normalized = String(value || '').trim().toLowerCase();
  return ['proposed', 'applied', 'rejected', 'rolled_back'].includes(normalized) ? normalized : fallback;
}

function storePath(config) {
  return path.join(config.rootDir, '.skyequanta', 'ai-patch-proposals.json');
}

function normalizeOperation(record = {}) {
  const op = String(record.op || record.kind || '').trim().toLowerCase();
  const normalized = {
    op,
    path: String(record.path || '').trim(),
    content: record.content === undefined ? null : String(record.content),
    find: record.find === undefined ? null : String(record.find),
    replace: record.replace === undefined ? null : String(record.replace),
    all: Boolean(record.all),
    required: record.required === undefined ? true : Boolean(record.required)
  };
  if (!['write', 'replace', 'delete', 'append', 'mkdir'].includes(normalized.op)) {
    throw new Error(`Unsupported patch operation '${op}'.`);
  }
  if (normalized.op !== 'mkdir' && !normalized.path) {
    throw new Error(`Patch operation '${normalized.op}' requires a relative file path.`);
  }
  return normalized;
}

function normalizeContext(record = {}) {
  const requestedPaths = Array.isArray(record.requestedPaths) ? record.requestedPaths.map(item => String(item || '').trim()).filter(Boolean) : [];
  return {
    mode: String(record.mode || 'bounded').trim() || 'bounded',
    query: String(record.query || '').trim() || null,
    requestedPaths,
    includeChanged: Boolean(record.includeChanged),
    maxFiles: Number.parseInt(String(record.maxFiles || 8), 10) || 8,
    maxChars: Number.parseInt(String(record.maxChars || 4000), 10) || 4000,
    note: String(record.note || '').trim() || null,
    files: Array.isArray(record.files) ? record.files : [],
    changedFiles: Array.isArray(record.changedFiles) ? record.changedFiles : [],
    summary: record.summary && typeof record.summary === 'object' ? record.summary : null
  };
}

function normalizeProposal(record = {}) {
  return {
    proposalId: String(record.proposalId || record.id || crypto.randomUUID()).trim(),
    workspaceId: normalizeWorkspaceId(record.workspaceId),
    title: String(record.title || 'AI patch proposal').trim() || 'AI patch proposal',
    summary: String(record.summary || '').trim() || null,
    requestedBy: String(record.requestedBy || 'ai-patch').trim() || 'ai-patch',
    status: normalizeStatus(record.status, 'proposed'),
    operations: Array.isArray(record.operations) ? record.operations.map(normalizeOperation) : [],
    preview: Array.isArray(record.preview) ? record.preview : [],
    context: normalizeContext(record.context || {}),
    diffSummary: String(record.diffSummary || '').trim() || null,
    snapshotId: record.snapshotId ? String(record.snapshotId).trim() : null,
    createdAt: String(record.createdAt || nowIso()),
    updatedAt: String(record.updatedAt || nowIso()),
    appliedAt: record.appliedAt ? String(record.appliedAt).trim() : null,
    rejectedAt: record.rejectedAt ? String(record.rejectedAt).trim() : null,
    rolledBackAt: record.rolledBackAt ? String(record.rolledBackAt).trim() : null,
    review: record.review && typeof record.review === 'object' ? record.review : null
  };
}

function loadStore(config) {
  const parsed = readJson(storePath(config), null);
  if (!parsed || !Array.isArray(parsed.proposals)) {
    return { version: 1, proposals: [] };
  }
  return {
    version: 1,
    proposals: parsed.proposals.map(normalizeProposal)
  };
}

function saveStore(config, store) {
  const next = {
    version: 1,
    proposals: Array.isArray(store?.proposals) ? store.proposals.map(normalizeProposal) : []
  };
  writeJson(storePath(config), next);
  return next;
}

function getWorkspacePatchRoot(config, workspace) {
  const paths = getWorkspaceSandboxPaths(config, workspace.id);
  const projectDir = path.join(paths.fsDir, 'project');
  if (fs.existsSync(projectDir) && fs.statSync(projectDir).isDirectory()) {
    return projectDir;
  }
  return paths.fsDir;
}

function resolveRelativePath(rootDir, relativePath) {
  const normalized = String(relativePath || '').trim();
  const targetPath = path.resolve(rootDir, normalized);
  if (!targetPath.startsWith(path.resolve(rootDir))) {
    throw new Error(`Patch path escapes workspace root: ${normalized}`);
  }
  return targetPath;
}

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function buildDiff(relativePath, before, after) {
  const beforeLines = before.split('\n').slice(0, 120).map(line => `-${line}`).join('\n');
  const afterLines = after.split('\n').slice(0, 120).map(line => `+${line}`).join('\n');
  return [
    `--- a/${relativePath}`,
    `+++ b/${relativePath}`,
    '@@',
    beforeLines,
    afterLines
  ].join('\n');
}

function ensureParent(targetPath) {
  ensureDirectory(path.dirname(targetPath));
}

function buildPreviewForOperation(rootDir, operation) {
  const targetPath = operation.path ? resolveRelativePath(rootDir, operation.path) : rootDir;
  const existed = fs.existsSync(targetPath);
  const before = operation.op === 'mkdir' ? '' : readText(targetPath);
  let after = before;

  if (operation.op === 'write') {
    after = operation.content ?? '';
  } else if (operation.op === 'append') {
    after = `${before}${before && !before.endsWith('\n') ? '\n' : ''}${operation.content ?? ''}`;
  } else if (operation.op === 'replace') {
    if (!before && operation.required) {
      throw new Error(`Patch replace target is missing: ${operation.path}`);
    }
    if (operation.find === null || operation.find === undefined) {
      throw new Error(`Patch replace operation requires a 'find' value for ${operation.path}`);
    }
    if (before.includes(operation.find)) {
      after = operation.all ? before.split(operation.find).join(operation.replace ?? '') : before.replace(operation.find, operation.replace ?? '');
    } else if (operation.required) {
      throw new Error(`Patch replace did not find target text in ${operation.path}`);
    }
  } else if (operation.op === 'delete') {
    after = '';
  }

  return {
    op: operation.op,
    path: operation.path || null,
    existed,
    beforeSize: before.length,
    afterSize: after.length,
    changed: operation.op === 'mkdir' ? !existed : before !== after || operation.op === 'delete',
    diff: operation.op === 'mkdir' ? null : buildDiff(operation.path, before, after),
    targetPath
  };
}

function getProposal(store, proposalId) {
  const normalizedId = String(proposalId || '').trim();
  return store.proposals.find(item => item.proposalId === normalizedId) || null;
}

function buildBoundedContext(config, workspace, requested = {}) {
  const maxFiles = Number.parseInt(String(requested.maxFiles || 8), 10) || 8;
  const maxChars = Number.parseInt(String(requested.maxChars || 4000), 10) || 4000;
  const requestedPaths = Array.isArray(requested.requestedPaths) ? requested.requestedPaths.map(item => String(item || '').trim()).filter(Boolean) : [];
  const files = [];

  for (const rel of requestedPaths.slice(0, maxFiles)) {
    try {
      const file = inspectWorkspacePath(config, workspace.id, rel);
      const content = file.previewable ? readWorkspaceContent(config, workspace.id, rel) : null;
      files.push({
        path: rel,
        association: file.association,
        previewable: file.previewable,
        contentPreview: content?.preview?.snippet ? String(content.preview.snippet).slice(0, maxChars) : content?.content ? String(content.content).slice(0, maxChars) : null
      });
    } catch (error) {
      files.push({ path: rel, error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (requested.query && files.length < maxFiles) {
    const search = searchWorkspaceFiles(config, workspace.id, requested.query, { limit: maxFiles, scanLimit: Math.max(300, maxFiles * 80) });
    for (const match of search.matches || []) {
      if (files.length >= maxFiles) break;
      if (files.some(item => item.path === match.path)) continue;
      try {
        const file = inspectWorkspacePath(config, workspace.id, match.path);
        const content = file.previewable ? readWorkspaceContent(config, workspace.id, match.path) : null;
        files.push({
          path: match.path,
          association: file.association,
          matchedLine: match.line,
          matchedPreview: match.preview,
          contentPreview: content?.preview?.snippet ? String(content.preview.snippet).slice(0, maxChars) : content?.content ? String(content.content).slice(0, maxChars) : null
        });
      } catch {}
    }
  }

  const changedListing = requested.includeChanged ? listChangedWorkspaceFiles(config, workspace.id) : { files: [] };
  const associationSummary = getWorkspaceAssociationSummary(config, workspace.id, { depth: 3, limit: 250 });

  return normalizeContext({
    mode: requested.mode || 'bounded',
    query: requested.query || null,
    requestedPaths,
    includeChanged: Boolean(requested.includeChanged),
    maxFiles,
    maxChars,
    note: requested.note || null,
    files,
    changedFiles: (changedListing.files || []).slice(0, maxFiles),
    summary: {
      fileCount: files.length,
      changedCount: (changedListing.files || []).length,
      associations: associationSummary.associations,
      bounded: true
    }
  });
}

export function inspectAiPatchContext(config, workspaceId, options = {}) {
  const workspace = getWorkspace(config, workspaceId);
  if (!workspace) {
    throw new Error(`Workspace '${workspaceId}' is not registered.`);
  }
  return { workspace, context: buildBoundedContext(config, workspace, options) };
}

function replaceProposal(store, nextProposal) {
  store.proposals = [
    normalizeProposal(nextProposal),
    ...store.proposals.filter(item => item.proposalId !== nextProposal.proposalId)
  ].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  return store;
}

export function listAiPatchProposals(config, workspaceId = null) {
  const store = loadStore(config);
  const normalizedWorkspaceId = workspaceId ? normalizeWorkspaceId(workspaceId) : null;
  return store.proposals
    .filter(item => !normalizedWorkspaceId || item.workspaceId === normalizedWorkspaceId)
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

export function getAiPatchProposal(config, proposalId) {
  const proposal = getProposal(loadStore(config), proposalId);
  if (!proposal) {
    throw new Error(`AI patch proposal '${proposalId}' was not found.`);
  }
  return proposal;
}

export function getAiPatchStatus(config, workspaceId = null) {
  const proposals = listAiPatchProposals(config, workspaceId);
  const summary = {
    total: proposals.length,
    proposed: proposals.filter(item => item.status === 'proposed').length,
    applied: proposals.filter(item => item.status === 'applied').length,
    rejected: proposals.filter(item => item.status === 'rejected').length,
    rolledBack: proposals.filter(item => item.status === 'rolled_back').length
  };
  return { summary, proposals };
}

export function createAiPatchProposal(config, options = {}) {
  const workspace = getWorkspace(config, options.workspaceId);
  if (!workspace) {
    throw new Error(`Workspace '${options.workspaceId}' is not registered.`);
  }
  const rootDir = getWorkspacePatchRoot(config, workspace);
  const operations = Array.isArray(options.operations) ? options.operations.map(normalizeOperation) : [];
  if (!operations.length) {
    throw new Error('AI patch proposal requires at least one operation.');
  }
  const preview = operations.map(operation => buildPreviewForOperation(rootDir, operation));
  const diffSummary = preview.map(item => `${item.op}:${item.path || '.'}:${item.changed ? 'changed' : 'unchanged'}`).join('\n');

  const proposal = normalizeProposal({
    proposalId: options.proposalId,
    workspaceId: workspace.id,
    title: options.title || `AI patch for ${workspace.name || workspace.id}`,
    summary: options.summary || null,
    requestedBy: options.requestedBy || 'ai-patch',
    operations,
    preview,
    context: buildBoundedContext(config, workspace, options.context || {}),
    diffSummary
  });

  const store = loadStore(config);
  replaceProposal(store, proposal);
  saveStore(config, store);

  appendAuditEvent(config, {
    action: 'ai_patch.proposal.create',
    actorType: 'operator',
    actorId: proposal.requestedBy,
    tenantId: workspace?.metadata?.tenantId,
    workspaceId: workspace.id,
    detail: {
      proposalId: proposal.proposalId,
      title: proposal.title,
      operationCount: proposal.operations.length,
      contextFileCount: proposal.context?.summary?.fileCount || 0
    }
  });
  publishRuntimeEvent(config, {
    action: 'runtime.ai_patch_proposal',
    workspaceId: workspace.id,
    tenantId: workspace?.metadata?.tenantId,
    lane: 'agent',
    actorType: 'operator',
    actorId: proposal.requestedBy,
    detail: {
      proposalId: proposal.proposalId,
      title: proposal.title,
      operationCount: proposal.operations.length,
      contextFileCount: proposal.context?.summary?.fileCount || 0
    }
  });
  recordRuntimeMessage(config, {
    workspaceId: workspace.id,
    lane: 'agent',
    channel: 'ai.patch',
    type: 'proposal.created',
    payload: {
      proposalId: proposal.proposalId,
      title: proposal.title,
      operationCount: proposal.operations.length,
      contextFileCount: proposal.context?.summary?.fileCount || 0
    }
  });

  return { proposal, workspace };
}

function applyOperation(rootDir, operation) {
  const targetPath = operation.path ? resolveRelativePath(rootDir, operation.path) : rootDir;
  if (operation.op === 'mkdir') {
    ensureDirectory(targetPath);
    return { targetPath, detail: { directoryCreated: true } };
  }

  if (operation.op === 'delete') {
    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }
    return { targetPath, detail: { deleted: true } };
  }

  ensureParent(targetPath);
  const before = readText(targetPath);
  let after = before;

  if (operation.op === 'write') {
    after = operation.content ?? '';
  } else if (operation.op === 'append') {
    after = `${before}${before && !before.endsWith('\n') ? '\n' : ''}${operation.content ?? ''}`;
  } else if (operation.op === 'replace') {
    if (before.includes(operation.find)) {
      after = operation.all ? before.split(operation.find).join(operation.replace ?? '') : before.replace(operation.find, operation.replace ?? '');
    } else if (operation.required) {
      throw new Error(`Patch replace did not find target text in ${operation.path}`);
    }
  }

  fs.writeFileSync(targetPath, after, 'utf8');
  return {
    targetPath,
    detail: {
      bytesBefore: before.length,
      bytesAfter: after.length
    }
  };
}

export async function applyAiPatchProposal(config, proposalId, options = {}) {
  const store = loadStore(config);
  const proposal = getProposal(store, proposalId);
  if (!proposal) {
    throw new Error(`AI patch proposal '${proposalId}' was not found.`);
  }
  if (proposal.status !== 'proposed') {
    throw new Error(`AI patch proposal '${proposal.proposalId}' is not in proposed state.`);
  }
  const workspace = getWorkspace(config, proposal.workspaceId);
  if (!workspace) {
    throw new Error(`Workspace '${proposal.workspaceId}' is not registered.`);
  }
  const rootDir = getWorkspacePatchRoot(config, workspace);
  const snapshot = await createWorkspaceSnapshot(config, workspace, {
    label: `ai-patch-${proposal.proposalId}`,
    restartAfter: false,
    createdBy: options.actorId || 'ai-patch-apply'
  });

  for (const operation of proposal.operations) {
    const result = applyOperation(rootDir, operation);
    recordFileOperation(config, {
      workspaceId: workspace.id,
      tenantId: workspace?.metadata?.tenantId,
      lane: 'agent',
      operation: `ai_patch_${operation.op}`,
      path: operation.path || result.targetPath,
      status: 'applied',
      detail: {
        proposalId: proposal.proposalId,
        ...result.detail
      }
    });
  }

  const updated = normalizeProposal({
    ...proposal,
    status: 'applied',
    snapshotId: snapshot.id,
    appliedAt: nowIso(),
    updatedAt: nowIso(),
    review: {
      decision: 'applied',
      actorId: String(options.actorId || 'ai-patch-apply').trim() || 'ai-patch-apply',
      note: String(options.note || '').trim() || null,
      decidedAt: nowIso()
    }
  });
  replaceProposal(store, updated);
  saveStore(config, store);

  appendAuditEvent(config, {
    action: 'ai_patch.proposal.apply',
    actorType: 'operator',
    actorId: updated.review.actorId,
    tenantId: workspace?.metadata?.tenantId,
    workspaceId: workspace.id,
    detail: {
      proposalId: updated.proposalId,
      snapshotId: snapshot.id,
      operationCount: updated.operations.length
    }
  });
  publishRuntimeEvent(config, {
    action: 'runtime.ai_patch_apply',
    workspaceId: workspace.id,
    tenantId: workspace?.metadata?.tenantId,
    lane: 'agent',
    actorType: 'operator',
    actorId: updated.review.actorId,
    detail: {
      proposalId: updated.proposalId,
      snapshotId: snapshot.id
    }
  });
  recordRuntimeMessage(config, {
    workspaceId: workspace.id,
    lane: 'agent',
    channel: 'ai.patch',
    type: 'proposal.applied',
    payload: {
      proposalId: updated.proposalId,
      snapshotId: snapshot.id
    }
  });

  return { proposal: updated, snapshot, workspace };
}

export function rejectAiPatchProposal(config, proposalId, options = {}) {
  const store = loadStore(config);
  const proposal = getProposal(store, proposalId);
  if (!proposal) {
    throw new Error(`AI patch proposal '${proposalId}' was not found.`);
  }
  if (proposal.status !== 'proposed') {
    throw new Error(`AI patch proposal '${proposal.proposalId}' is not in proposed state.`);
  }
  const workspace = getWorkspace(config, proposal.workspaceId);
  if (!workspace) {
    throw new Error(`Workspace '${proposal.workspaceId}' is not registered.`);
  }
  const updated = normalizeProposal({
    ...proposal,
    status: 'rejected',
    rejectedAt: nowIso(),
    updatedAt: nowIso(),
    review: {
      decision: 'rejected',
      actorId: String(options.actorId || 'ai-patch-reviewer').trim() || 'ai-patch-reviewer',
      note: String(options.note || '').trim() || null,
      decidedAt: nowIso()
    }
  });
  replaceProposal(store, updated);
  saveStore(config, store);

  appendAuditEvent(config, {
    action: 'ai_patch.proposal.reject',
    actorType: 'operator',
    actorId: updated.review.actorId,
    tenantId: workspace?.metadata?.tenantId,
    workspaceId: workspace.id,
    detail: {
      proposalId: updated.proposalId
    }
  });
  recordRuntimeMessage(config, {
    workspaceId: workspace.id,
    lane: 'agent',
    channel: 'ai.patch',
    type: 'proposal.rejected',
    payload: {
      proposalId: updated.proposalId
    }
  });
  return { proposal: updated, workspace };
}

export async function rollbackAiPatchProposal(config, proposalId, options = {}) {
  const store = loadStore(config);
  const proposal = getProposal(store, proposalId);
  if (!proposal) {
    throw new Error(`AI patch proposal '${proposalId}' was not found.`);
  }
  if (proposal.status !== 'applied') {
    throw new Error(`AI patch proposal '${proposal.proposalId}' is not in applied state.`);
  }
  const workspace = getWorkspace(config, proposal.workspaceId);
  if (!workspace) {
    throw new Error(`Workspace '${proposal.workspaceId}' is not registered.`);
  }
  if (!proposal.snapshotId) {
    throw new Error(`AI patch proposal '${proposal.proposalId}' does not have a rollback snapshot.`);
  }
  const snapshot = getWorkspaceSnapshot(config, workspace.id, proposal.snapshotId);
  if (!snapshot) {
    throw new Error(`Rollback snapshot '${proposal.snapshotId}' was not found.`);
  }
  await restoreWorkspaceSnapshot(config, workspace, proposal.snapshotId, {
    restartAfter: false,
    restoredBy: options.actorId || 'ai-patch-rollback'
  });
  const updated = normalizeProposal({
    ...proposal,
    status: 'rolled_back',
    rolledBackAt: nowIso(),
    updatedAt: nowIso(),
    review: {
      decision: 'rolled_back',
      actorId: String(options.actorId || 'ai-patch-rollback').trim() || 'ai-patch-rollback',
      note: String(options.note || '').trim() || null,
      decidedAt: nowIso()
    }
  });
  replaceProposal(store, updated);
  saveStore(config, store);

  appendAuditEvent(config, {
    action: 'ai_patch.proposal.rollback',
    actorType: 'operator',
    actorId: updated.review.actorId,
    tenantId: workspace?.metadata?.tenantId,
    workspaceId: workspace.id,
    detail: {
      proposalId: updated.proposalId,
      snapshotId: proposal.snapshotId
    }
  });
  recordRuntimeMessage(config, {
    workspaceId: workspace.id,
    lane: 'agent',
    channel: 'ai.patch',
    type: 'proposal.rolled_back',
    payload: {
      proposalId: updated.proposalId,
      snapshotId: proposal.snapshotId
    }
  });
  return { proposal: updated, snapshot, workspace };
}
