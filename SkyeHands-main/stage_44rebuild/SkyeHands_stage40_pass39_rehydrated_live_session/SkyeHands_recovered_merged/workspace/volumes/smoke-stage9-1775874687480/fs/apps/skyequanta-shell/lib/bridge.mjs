import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

import { getControlPlaneCatalog, getInternalUrls, getProductIdentity, getPublicUrls, getRuntimeContract } from '../bin/config.mjs';
import {
  allowWorkspacePort,
  createSnapshot,
  createWorkspace,
  deleteWorkspace,
  describeSnapshot,
  denyWorkspacePort,
  ensureDefaultWorkspace,
  getCurrentWorkspace,
  getWorkspaceRuntime,
  getWorkspace,
  listSnapshots,
  listWorkspacePorts,
  listWorkspaces,
  getSnapshotRetention,
  removeSnapshot,
  runSnapshotRetentionCleanup,
  restoreSnapshot,
  setSnapshotRetention,
  selectWorkspace,
  startWorkspace,
  setWorkspacePorts,
  setWorkspaceSecretScope,
  stopWorkspace,
  updateWorkspaceStatus
} from './workspace-manager.mjs';
import {
  appendAuditEvent,
  evaluateGovernedAction,
  getGovernanceCostStatus,
  getGovernancePlaneSummary,
  getGovernanceSummary,
  listAuditEvents,
  listGovernancePolicyHistory,
  listGovernanceReleaseDecisions,
  listGovernanceSecrets,
  listTenantGovernancePolicies,
  loadGovernancePolicy,
  loadTenantGovernancePolicy,
  recordGovernanceCost,
  recordGovernanceReleaseDecision,
  resolveGovernanceSecret,
  rollbackGovernancePolicy,
  summarizeTenantAccess,
  updateGovernancePolicy,
  upsertGovernanceSecret,
  upsertTenantGovernancePolicy
} from './governance-manager.mjs';
import {
  addPullRequestComment,
  connectGitHubIntegration,
  ensureScmStore,
  getIntegrationStatus,
  getPullRequest,
  getPullRequestMergePolicy,
  listPullRequests,
  listReleaseReplayItems,
  mergePullRequest,
  queueGitHubPush,
  replayReleaseReplayItem,
  requestPullRequestReview,
  resolvePullRequestComment,
  submitPullRequestReview,
  createPullRequest
} from './scm-manager.mjs';
import {
  addSharedNote,
  ensureCollaborationStore,
  getCollaborationStatus,
  heartbeatPresence,
  joinPresence,
  leavePresence,
  recordCollaborationMutation,
  upsertCourtesyClaim
} from './collaboration-manager.mjs';
import {
  assignWorkspaceToFleet,
  ensureFleetStore,
  getFleetStatus,
  listFleetPools,
  listMachineProfiles,
  releaseFleetAssignment,
  setFleetPoolState,
  setWorkspaceMachineProfile,
  upsertFleetPool,
  upsertMachineProfile
} from './fleet-manager.mjs';
import {
  ensurePrebuildStore,
  getPrebuildStatus,
  hydrateWorkspacePrebuild,
  listPrebuildJobs,
  listPrebuildTemplates,
  queuePrebuildJob,
  replayPrebuildJob,
  setWorkspacePrebuildPreference,
  upsertPrebuildTemplate
} from './prebuild-manager.mjs';
import {
  acknowledgeOpsIncident,
  createOpsIncident,
  ensureOpsStore,
  evaluateOpsWatchRules,
  getOpsStatus,
  listOpsIncidents,
  listOpsWatchRules,
  resolveOpsIncident,
  upsertOpsWatchRule
} from './ops-manager.mjs';
import {
  applyAiPatchProposal,
  createAiPatchProposal,
  getAiPatchProposal,
  getAiPatchStatus,
  inspectAiPatchContext,
  listAiPatchProposals,
  rejectAiPatchProposal,
  rollbackAiPatchProposal
} from './ai-patch-manager.mjs';
import { countSnapshotsByWorkspace } from './snapshot-manager.mjs';
import {
  closeSession,
  heartbeatSession,
  listSessions,
  openSession,
  reconnectSession,
  restoreSession,
  revokeSessions,
  validateAccessToken,
  getSessionProviderUnlockState,
  getUnlockedProviderProfileForSession,
  lockProviderProfilesForSession,
  unlockProviderProfileForSession
} from './session-manager.mjs';
import { createWorkspaceSchedulerController } from './workspace-scheduler.mjs';
import {
  authenticateGateRequest,
  exchangeGateTokenForIdentity,
  isFounderGateIdentity
} from './gate-auth.mjs';
import { getGateRuntimeAdminSummary, redactSensitivePayload } from './gate-config.mjs';
import { discoverProviderResources, getProviderCatalog, testProviderConnection } from './provider-connectors.mjs';
import {
  getWorkspaceRuntimeProjection,
  listRuntimeEvents,
  publishRuntimeEvent,
  recordCombinedRuntimeHealth,
  recordFileOperation,
  recordLaneHealth,
  recordPreviewState,
  recordRuntimeMessage,
  recordSessionContext,
  recordWorkspaceContext
} from './runtime-bus.mjs';
import {
  diffWorkspaceFile,
  getWorkspaceAssociationSummary,
  getWorkspaceDownloadTarget,
  getWorkspaceRuntimeEventsPayload,
  getWorkspaceRuntimeLogs,
  inspectWorkspacePath,
  listChangedWorkspaceFiles,
  listWorkspaceTree,
  readWorkspaceContent,
  searchWorkspaceFiles
} from './file-ergonomics.mjs';

import {
  decryptProviderProfile,
  deleteProviderProfile,
  ensureProviderVaultStore,
  getProviderProfile,
  listProviderProfiles,
  saveProviderProfile,
  testDecryptedProviderProfile
} from './provider-vault.mjs';
import {
  deleteWorkspaceProviderBinding,
  ensureWorkspaceProviderBindingsStore,
  getBindingRoleCatalog,
  listWorkspaceProviderBindings,
  upsertWorkspaceProviderBinding
} from './provider-bindings.mjs';
import { resolveWorkspaceProviderProjection } from './provider-env-projection.mjs';
import { assertTenantWorkspaceAccess, buildTenantIsolationMatrix } from './tenant-isolation.mjs';
import { buildSurfaceIdentityDocument } from './surface-identity.mjs';
import {
  buildDeploymentCenterHtml as buildDeploymentCenterUiHtml,
  buildProviderCenterHtml as buildProviderCenterUiHtml,
  buildStorageCenterHtml as buildStorageCenterUiHtml
} from './provider-ui.mjs';
import {
  getFounderLaneDeclaration,
  listGovernanceSecretMigrationCandidates,
  markGovernanceSecretsFounderManaged,
  migrateGovernanceSecretScopeToProviderProfile
} from './provider-governance-lane.mjs';
import { bootstrapWorkspaceProviderBindings, buildProviderBindingSuggestions } from './provider-bootstrap.mjs';
import {
  buildBridgeRequestAuditDetail,
  evaluateBridgeRequestPolicy,
  getBridgeHardeningPolicy,
  readJsonBodyWithHardening,
  recordBridgeAuthOutcome,
  shouldAuditBridgeRequest
} from './bridge-hardening.mjs';

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(payload));
}

function writeHtml(response, statusCode, html) {
  response.writeHead(statusCode, {
    'content-type': 'text/html; charset=utf-8'
  });
  response.end(html);
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toCsvLine(values = []) {
  return values
    .map(value => {
      const normalized = String(value ?? '');
      if (/[,"\n]/.test(normalized)) {
        return `"${normalized.replaceAll('"', '""')}"`;
      }
      return normalized;
    })
    .join(',');
}

function serializeAuditExport(result, format) {
  const normalized = String(format || 'json').trim().toLowerCase();
  const events = Array.isArray(result?.events) ? result.events : [];
  if (normalized === 'csv') {
    const header = ['id', 'at', 'action', 'outcome', 'actorType', 'actorId', 'tenantId', 'workspaceId', 'sessionId', 'detail'];
    const rows = events.map(event => [
      event.id,
      event.at,
      event.action,
      event.outcome,
      event.actorType,
      event.actorId,
      event.tenantId,
      event.workspaceId || '',
      event.sessionId || '',
      JSON.stringify(event.detail || {})
    ]);
    return {
      contentType: 'text/csv; charset=utf-8',
      body: [toCsvLine(header), ...rows.map(toCsvLine)].join('\n')
    };
  }

  if (normalized === 'ndjson') {
    return {
      contentType: 'application/x-ndjson; charset=utf-8',
      body: events.map(event => JSON.stringify(event)).join('\n')
    };
  }

  return {
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify({ ok: true, format: 'json', ...result }, null, 2)
  };
}


function readJsonFile(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function getParityPlusFinalGateSummary(config) {
  const artifactPath = path.join(config.rootDir, 'docs', 'proof', 'SECTION_20_PARITY_PLUS_FINAL_GATE.json');
  const payload = readJsonFile(artifactPath, null);
  return {
    artifactPath: 'docs/proof/SECTION_20_PARITY_PLUS_FINAL_GATE.json',
    generatedAt: payload?.generatedAt || null,
    pass: payload?.pass === true,
    directiveLanesComplete: payload?.completion?.directiveLanesComplete ?? 0,
    directiveLanesRemaining: payload?.completion?.directiveLanesRemaining ?? 1
  };
}

function getParityPlusFinalGatePayload(config) {
  const artifactPath = path.join(config.rootDir, 'docs', 'proof', 'SECTION_20_PARITY_PLUS_FINAL_GATE.json');
  return readJsonFile(artifactPath, {
    section: 20,
    label: 'section-20-parity-plus-final-gate',
    generatedAt: null,
    pass: false,
    completion: {
      directiveLanesTotal: 7,
      directiveLanesComplete: 0,
      directiveLanesRemaining: 7,
      remainingLaneNames: ['PB-1 donor convergence', 'PB-2 PR loop and review workflow', 'PB-3 collaboration and presence', 'PB-4 machine profiles and fleet controls', 'PB-5 prebuild and warm-start lane', 'PB-6 parity-plus governance plane', 'PB-7 final parity-plus proof gate']
    },
    checks: []
  });
}


function getPostParityOpsSummary(config) {
  const artifactPath = path.join(config.rootDir, 'docs', 'proof', 'SECTION_21_POST_PARITY_OPS_PLANE.json');
  const payload = readJsonFile(artifactPath, null);
  return {
    artifactPath: 'docs/proof/SECTION_21_POST_PARITY_OPS_PLANE.json',
    generatedAt: payload?.generatedAt || null,
    pass: payload?.pass === true,
    currentDirectiveCompletion: {
      total: payload?.completion?.currentDirectiveLanesTotal ?? 7,
      complete: payload?.completion?.currentDirectiveLanesComplete ?? 7,
      remaining: payload?.completion?.currentDirectiveLanesRemaining ?? 0
    },
    postDirectiveExtension: {
      total: payload?.completion?.postDirectiveLanesTotal ?? 1,
      complete: payload?.completion?.postDirectiveLanesComplete ?? 0,
      remaining: payload?.completion?.postDirectiveLanesRemaining ?? 1
    }
  };
}

function getPostParityOpsPayload(config) {
  const artifactPath = path.join(config.rootDir, 'docs', 'proof', 'SECTION_21_POST_PARITY_OPS_PLANE.json');
  return readJsonFile(artifactPath, {
    section: 21,
    label: 'section-21-post-parity-ops-plane',
    generatedAt: null,
    pass: false,
    completion: {
      currentDirectiveLanesTotal: 7,
      currentDirectiveLanesComplete: 7,
      currentDirectiveLanesRemaining: 0,
      postDirectiveLanesTotal: 1,
      postDirectiveLanesComplete: 0,
      postDirectiveLanesRemaining: 1,
      remainingLaneNames: ['PB-8 observability and incident command plane']
    },
    checks: []
  });
}

function buildControlPlaneConsoleHtml(config, publicUrls) {
  const consoleItems = [
    { title: 'Audit export', route: '/api/audit/export?format=json', description: 'Export filtered audit history as JSON, CSV, or NDJSON.' },
    { title: 'Governance history', route: '/api/governance/policy/history', description: 'Review governance policy mutations before rolling back.' },
    { title: 'Governance rollback', route: '/api/governance/policy/rollback', description: 'Roll governance limits back to the selected revision.' },
    { title: 'Session restore', route: '/api/sessions/restore', description: 'Restore a persisted workspace session after restart or abnormal shutdown.' },
    { title: 'Retention cleanup', route: '/api/snapshots/retention/cleanup', description: 'Run retention cleanup with before/after verification.' },
    { title: 'GitHub connect', route: '/api/integrations/github/connect', description: 'Attach a workspace to an owner/repo branch contract under the canonical bridge.' },
    { title: 'GitHub push queue', route: '/api/integrations/github/push', description: 'Materialize a push record and deferred release replay artifact from the control plane.' },
    { title: 'PR lane', route: '/api/github/prs/create', description: 'Create, review, comment, gate, and merge pull requests from the canonical workspace truth path.' },
    { title: 'Collaboration presence', route: '/api/collaboration/presence/join', description: 'Track multi-operator presence, courtesy claims, shared notes, and conflict-aware workspace mutations.' },
    { title: 'Fleet controls', route: '/api/fleet/status', description: 'Manage machine profiles, fleet pools, assignment policy, and drain state from the canonical control plane.' },
    { title: 'Prebuild brokerage', route: '/api/prebuild/status', description: 'Broker prebuild templates, warm-start artifacts, replay, and hydration from the canonical control plane.' },
    { title: 'Parity-plus governance', route: '/api/governance/releases', description: 'Broker tenant policy, secret scopes, release replay governance, audit export, and budget controls.' },
    { title: 'Ops resilience', route: '/api/ops/status', description: 'Track watch rules, alerts, incidents, acknowledgements, and resolution truth from the canonical control plane.' },
    { title: 'Ops center', route: '/ops-center', description: 'Use the product-facing operations dashboard for health, incidents, alerts, and recovery context.' },
    { title: 'AI patch center', route: '/ai-patch-center', description: 'Review AI patch proposals, preview diffs, apply with snapshots, reject, and roll back safely.' },
    { title: 'Workspace center', route: '/workspace-center', description: 'See one workspace cockpit view with status, runtime, previews, secrets, and key control actions.' },
    { title: 'Provider center', route: '/provider-center', description: 'Manage user-owned provider vault profiles, unlock posture, and workspace credential menus.' },
    { title: 'Storage center', route: '/storage-center', description: 'Review database and storage-backed provider posture for the active workspace.' },
    { title: 'Deployment center', route: '/deployment-center', description: 'Review deploy, preview, and site/runtime provider posture for the active workspace.' },
    { title: 'Runtime center', route: '/runtime-center', description: 'Inspect recent runtime events, health, and log tails for the active workspace.' },
    { title: 'Gate center', route: '/gate-center', description: 'Inspect gate mode, gate summary, and workspace secret scope posture from one operator-facing surface.' },
    { title: 'File center', route: '/file-center', description: 'Inspect the workspace tree, file associations, changed files, and diff/download lanes from the bridge.' },
    { title: 'Post-parity ops proof', route: '/api/proof/post-parity-ops-plane', description: 'Read the post-parity operations proof gate showing watch rules, alerting, and incident command surfaces are live.' },
    { title: 'Final parity-plus gate', route: '/api/proof/parity-plus-final-gate', description: 'Read the final parity-plus proof gate showing whether sections 15 through 19 are green in one completion run.' }
  ];

  const cards = consoleItems.map(item => `
      <section class="card">
        <h2>${escapeHtml(item.title)}</h2>
        <code>${escapeHtml(item.route)}</code>
        <p>${escapeHtml(item.description)}</p>
      </section>`).join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(config.productName)} Control Plane</title>
    <style>
      body{font-family:Arial,sans-serif;background:#0c1220;color:#f5f7fb;margin:0;padding:24px;}
      h1{margin:0 0 8px;font-size:28px;}
      p{line-height:1.5;}
      .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-top:20px;}
      .card{background:#111a2e;border:1px solid #223353;border-radius:16px;padding:16px;}
      code{display:block;margin:10px 0;color:#9cc0ff;white-space:pre-wrap;word-break:break-word;}
      .meta{color:#aeb8cc;font-size:14px;}
    </style>
  </head>
  <body>
    <h1>${escapeHtml(config.productName)} Admin Control Plane</h1>
    <p class="meta">UI/API parity surface for governance restore, audit export, retention cleanup, and session restore. Public bridge: ${escapeHtml(publicUrls.bridge)}</p>
    <div class="grid">${cards}</div>
  </body>
</html>`;
}


function buildOpsCenterHtml(config, workspaceId = 'local-default') {
  const ops = getOpsStatus(config, workspaceId);
  const incidents = listOpsIncidents(config, workspaceId);
  const watchRules = listOpsWatchRules(config, workspaceId);
  const cards = [
    ['Workspace', workspaceId],
    ['Watch rules', String(ops.summary.watchRuleCount || 0)],
    ['Active alerts', String(ops.summary.activeAlerts || 0)],
    ['Open incidents', String(ops.summary.openIncidents || 0)],
    ['Resolved incidents', String(ops.summary.resolvedIncidents || 0)],
    ['Health', String(ops.summary.health || 'unknown')]
  ].map(([label, value]) => `<div class="stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
  const incidentRows = incidents.slice(0, 8).map(item => `<tr><td>${escapeHtml(item.incidentId)}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.ownerDisplayName || item.ownerId || 'unassigned')}</td></tr>`).join('') || '<tr><td colspan="4">No incidents yet.</td></tr>';
  const ruleRows = watchRules.slice(0, 8).map(item => `<tr><td>${escapeHtml(item.ruleId)}</td><td>${escapeHtml(item.metric)}</td><td>${escapeHtml(item.comparator)}</td><td>${escapeHtml(item.threshold)}</td></tr>`).join('') || '<tr><td colspan="4">No watch rules yet.</td></tr>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(config.productName)} Ops Center</title><style>body{font-family:Arial,sans-serif;background:#0a1120;color:#eef4ff;padding:24px;margin:0}.hero,.panel{background:#111a2d;border:1px solid #24344f;border-radius:18px;padding:18px;margin-bottom:18px}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}.stat{background:#16233a;border-radius:14px;padding:12px;border:1px solid #27405f}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #24344f;text-align:left}code{color:#9bc2ff}.links a{color:#cce2ff}</style></head><body><section class="hero"><h1>${escapeHtml(config.productName)} Ops Center</h1><p>Product-facing operations dashboard for incidents, watch rules, alert state, and recovery context.</p><div class="stats">${cards}</div><p class="links"><a href="/api/ops/status?workspaceId=${encodeURIComponent(workspaceId)}">/api/ops/status</a> · <a href="/api/ops/incidents?workspaceId=${encodeURIComponent(workspaceId)}">/api/ops/incidents</a> · <a href="/api/ops/watch-rules?workspaceId=${encodeURIComponent(workspaceId)}">/api/ops/watch-rules</a></p></section><section class="panel"><h2>Incidents</h2><table><thead><tr><th>ID</th><th>Status</th><th>Title</th><th>Owner</th></tr></thead><tbody>${incidentRows}</tbody></table></section><section class="panel"><h2>Watch rules</h2><table><thead><tr><th>Rule</th><th>Metric</th><th>Comparator</th><th>Threshold</th></tr></thead><tbody>${ruleRows}</tbody></table></section></body></html>`;
}

function buildAiPatchCenterHtml(config, workspaceId = 'local-default') {
  const aiPatch = getAiPatchStatus(config, workspaceId);
  const context = inspectAiPatchContext(config, workspaceId, { includeChanged: true, maxFiles: 6, maxChars: 1200 }).context;
  const proposalRows = aiPatch.proposals.slice(0, 12).map(item => `<tr><td>${escapeHtml(item.proposalId)}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(item.title)}</td><td>${escapeHtml(String(item.context?.summary?.fileCount || 0))}</td><td>${escapeHtml(item.snapshotId || '')}</td></tr>`).join('') || '<tr><td colspan="5">No AI patch proposals yet.</td></tr>';
  const contextRows = (context.files || []).slice(0, 6).map(item => `<tr><td>${escapeHtml(item.path || '')}</td><td>${escapeHtml(item.association?.label || item.association?.category || '')}</td><td>${escapeHtml(item.matchedPreview || item.contentPreview || '').slice(0,180)}</td></tr>`).join('') || '<tr><td colspan="3">No bounded context sampled yet.</td></tr>';
  const cards = [
    ['Workspace', workspaceId],
    ['Proposed', String(aiPatch.summary.proposed || 0)],
    ['Applied', String(aiPatch.summary.applied || 0)],
    ['Rejected', String(aiPatch.summary.rejected || 0)],
    ['Rolled back', String(aiPatch.summary.rolledBack || 0)],
    ['Context files', String(context.summary?.fileCount || 0)]
  ].map(([label, value]) => `<div class="stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(config.productName)} AI Patch Center</title><style>body{font-family:Arial,sans-serif;background:#09111d;color:#eef4ff;padding:24px;margin:0}.hero,.panel{background:#101a2f;border:1px solid #233653;border-radius:18px;padding:18px;margin-bottom:18px}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}.stat{background:#16233a;border-radius:14px;padding:12px;border:1px solid #27405f}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #24344f;text-align:left}code{display:block;background:#0b1424;border:1px solid #24344f;border-radius:12px;padding:12px;color:#8fd0ff;white-space:pre-wrap}a{color:#cce2ff}</style></head><body><section class="hero"><h1>${escapeHtml(config.productName)} AI Patch Center</h1><p>Review AI patch proposals, preview diffs, apply under snapshot control, reject safely, roll back cleanly, and inspect bounded code context before any change lands.</p><div class="stats">${cards}</div><code>npm run ai-patch:context -- --workspace ${escapeHtml(workspaceId)} --query runtime --include-changed
npm run ai-patch:propose -- --workspace ${escapeHtml(workspaceId)} --spec ./patch.json --query runtime --context-path README.md
npm run ai-patch:apply -- <proposal-id>
npm run ai-patch:rollback -- <proposal-id></code><p><a href="/api/ai-patches/context?workspaceId=${encodeURIComponent(workspaceId)}&includeChanged=1">Context API</a> · <a href="/api/ai-patches/status?workspaceId=${encodeURIComponent(workspaceId)}">Status API</a></p></section><section class="panel"><h2>Bounded context sample</h2><table><thead><tr><th>Path</th><th>Class</th><th>Preview</th></tr></thead><tbody>${contextRows}</tbody></table></section><section class="panel"><h2>Recent proposals</h2><table><thead><tr><th>ID</th><th>Status</th><th>Title</th><th>Context files</th><th>Snapshot</th></tr></thead><tbody>${proposalRows}</tbody></table></section></body></html>`;
}


function buildWorkspaceCenterHtml(config, publicUrls, workspaceId = 'local-default') {
  const workspace = getWorkspace(config, workspaceId);
  const runtime = workspace ? getWorkspaceRuntime(config, workspaceId) : null;
  const projection = workspace ? getWorkspaceRuntimeProjection(config, workspaceId) : null;
  const ports = workspace ? listWorkspacePorts(config, workspaceId) : { forwardedPorts: [], forwardedHost: null };
  const previewUrls = workspace ? buildWorkspacePreviewUrls(config, workspace, publicUrls) : [];
  const tenantId = String(workspace?.metadata?.tenantId || 'local').trim().toLowerCase() || 'local';
  const providerBindings = workspace ? listWorkspaceProviderBindings(config, { workspaceId, tenantId }) : { total: 0, bindings: [] };
  const cards = [
    ['Workspace', workspaceId],
    ['Status', workspace?.status || 'unknown'],
    ['Driver', runtime?.runtime?.driver || workspace?.metadata?.runtimeDriver || 'unknown'],
    ['Forwarded ports', String(ports.forwardedPorts?.length || 0)],
    ['Secret scope', workspace?.metadata?.secretScope || 'none'],
    ['Runtime messages', String(projection?.recentMessages?.length || 0)],
    ['Provider bindings', String(providerBindings.total || 0)]
  ].map(([label, value]) => `<div class="stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
  const previewRows = (previewUrls || []).slice(0, 8).map(item => `<tr><td>${escapeHtml(String(item.port || ''))}</td><td><a href="${escapeHtml(item.publicUrl)}">${escapeHtml(item.publicUrl)}</a></td></tr>`).join('') || '<tr><td colspan="2">No preview routes currently exposed.</td></tr>';
  const bindingRows = (providerBindings.bindings || []).slice(0, 8).map(item => `<tr><td>${escapeHtml(item.alias || item.profile?.alias || item.profileId)}</td><td>${escapeHtml(item.provider || item.profile?.provider || 'unknown')}</td><td>${escapeHtml(item.capability || 'runtime')}</td><td>${escapeHtml(item.envTarget || 'workspace_runtime')}</td></tr>`).join('') || '<tr><td colspan="4">No provider bindings configured for this workspace.</td></tr>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(config.productName)} Workspace Center</title><style>body{font-family:Arial,sans-serif;background:#0a1120;color:#eef4ff;padding:24px;margin:0}.hero,.panel{background:#111a2d;border:1px solid #24344f;border-radius:18px;padding:18px;margin-bottom:18px}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}.stat{background:#16233a;border-radius:14px;padding:12px;border:1px solid #27405f}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #24344f;text-align:left}a{color:#cce2ff}</style></head><body><section class="hero"><h1>${escapeHtml(config.productName)} Workspace Center</h1><p>Operator-facing cockpit for workspace runtime, previews, secrets, provider bindings, and key control routes.</p><div class="stats">${cards}</div><p><a href="/api/workspaces/${encodeURIComponent(workspaceId)}/cockpit">Cockpit API</a> · <a href="/runtime-center?workspaceId=${encodeURIComponent(workspaceId)}">Runtime center</a> · <a href="/file-center?workspaceId=${encodeURIComponent(workspaceId)}">File center</a> · <a href="/gate-center?workspaceId=${encodeURIComponent(workspaceId)}">Gate center</a> · <a href="/provider-center?workspaceId=${encodeURIComponent(workspaceId)}&tenantId=${encodeURIComponent(tenantId)}">Provider center</a></p></section><section class="panel"><h2>Preview routes</h2><table><thead><tr><th>Port</th><th>Public URL</th></tr></thead><tbody>${previewRows}</tbody></table></section><section class="panel"><h2>Provider bindings</h2><table><thead><tr><th>Alias</th><th>Provider</th><th>Capability</th><th>Target</th></tr></thead><tbody>${bindingRows}</tbody></table></section></body></html>`;
}

function buildRuntimeCenterHtml(config, workspaceId = 'local-default') {
  const payload = getWorkspaceRuntimeEventsPayload(config, workspaceId, { limit: 15 });
  const logs = getWorkspaceRuntimeLogs(config, workspaceId, { limit: 40 });
  const projection = payload.projection || {};
  const runtime = projection.lastHealth || {};
  const cards = [
    ['Workspace', workspaceId],
    ['Driver', runtime.driver || projection.driver || 'unknown'],
    ['Running', String(Boolean(runtime.running))],
    ['IDE Alive', String(Boolean(runtime.ideAlive))],
    ['Agent Alive', String(Boolean(runtime.agentAlive))],
    ['Recent Events', String((payload.events || []).length)]
  ].map(([label, value]) => `<div class="stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
  const eventRows = (payload.events || []).slice(0, 15).map(item => `<tr><td>${escapeHtml(item.at || '')}</td><td>${escapeHtml(item.lane || '')}</td><td>${escapeHtml(item.action || '')}</td><td>${escapeHtml(JSON.stringify(item.detail || {})).slice(0,220)}</td></tr>`).join('') || '<tr><td colspan="4">No runtime events yet.</td></tr>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(config.productName)} Runtime Center</title><style>body{font-family:Arial,sans-serif;background:#08111c;color:#eef4ff;padding:24px;margin:0}.hero,.panel{background:#101a2e;border:1px solid #24344f;border-radius:18px;padding:18px;margin-bottom:18px}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}.stat{background:#16233a;border-radius:14px;padding:12px;border:1px solid #27405f}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #24344f;text-align:left;vertical-align:top}pre{white-space:pre-wrap;background:#0a1321;border:1px solid #24344f;border-radius:14px;padding:14px;max-height:280px;overflow:auto}</style></head><body><section class="hero"><h1>${escapeHtml(config.productName)} Runtime Center</h1><p>Recent runtime events, projection state, and log tails for the active workspace.</p><div class="stats">${cards}</div><p><a href="/api/workspaces/${encodeURIComponent(workspaceId)}/runtime-events">Runtime events API</a> · <a href="/api/workspaces/${encodeURIComponent(workspaceId)}/runtime-logs">Runtime logs API</a></p></section><section class="panel"><h2>Recent runtime events</h2><table><thead><tr><th>At</th><th>Lane</th><th>Action</th><th>Detail</th></tr></thead><tbody>${eventRows}</tbody></table></section><section class="panel"><h2>IDE log tail</h2><pre>${escapeHtml(logs.logs?.ide?.tail || '')}</pre></section><section class="panel"><h2>Agent log tail</h2><pre>${escapeHtml(logs.logs?.agent?.tail || '')}</pre></section></body></html>`;
}

function buildGateCenterHtml(config, workspaceId = 'local-default') {
  const workspace = getWorkspace(config, workspaceId);
  const gate = getGateRuntimeAdminSummary(config.gateRuntime);
  const secretScope = workspace?.metadata?.secretScope || 'none';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(config.productName)} Gate Center</title><style>body{font-family:Arial,sans-serif;background:#0a1220;color:#eef4ff;padding:24px;margin:0}.hero,.panel{background:#111a2d;border:1px solid #24344f;border-radius:18px;padding:18px;margin-bottom:18px}pre{white-space:pre-wrap;background:#0a1321;border:1px solid #24344f;border-radius:14px;padding:14px;overflow:auto}</style></head><body><section class="hero"><h1>${escapeHtml(config.productName)} Gate Center</h1><p>Workspace gate mode and secret-scope posture under the canonical bridge.</p><p>Workspace: <strong>${escapeHtml(workspaceId)}</strong> · Secret scope: <strong>${escapeHtml(secretScope)}</strong></p><p><a href="/api/workspaces/${encodeURIComponent(workspaceId)}/secret-scope">Secret scope API</a></p></section><section class="panel"><h2>Gate runtime summary</h2><pre>${escapeHtml(JSON.stringify(gate, null, 2))}</pre></section></body></html>`;
}

function buildFileCenterHtml(config, workspaceId = 'local-default') {
  const tree = listWorkspaceTree(config, workspaceId, { depth: 2, limit: 80 });
  const changed = listChangedWorkspaceFiles(config, workspaceId);
  const summary = getWorkspaceAssociationSummary(config, workspaceId, { depth: 3, limit: 240 });
  const renderItems = (items = [], depth = 0) => items.map(item => `${'&nbsp;'.repeat(depth * 4)}${item.type === 'directory' ? '📁' : escapeHtml(item.association?.icon || '📄')} ${escapeHtml(item.path)}${item.association ? ` <em>(${escapeHtml(item.association.label || item.association.category)} · ${escapeHtml(item.association.preview)})</em>` : ''}<br/>${item.children ? renderItems(item.children, depth + 1) : ''}`).join('');
  const changedFiles = (changed.files || []).slice(0, 10);
  const changedRows = changedFiles.map(item => `<tr><td>${escapeHtml(item.status)}</td><td>${escapeHtml(item.path)}</td></tr>`).join('') || '<tr><td colspan="2">No changed files detected.</td></tr>';
  const summaryCards = Object.entries(summary.associations?.byCategory || {}).map(([key, value]) => `<div class="stat"><span>${escapeHtml(key)}</span><strong>${escapeHtml(String(value))}</strong></div>`).join('') || '<div class="stat"><span>files</span><strong>0</strong></div>';
  const diffPanels = changedFiles.map(item => {
    const diff = diffWorkspaceFile(config, workspaceId, item.path);
    return `<section class="panel"><h2>${escapeHtml(item.path)}</h2><p>Status: <strong>${escapeHtml(item.status)}</strong></p><pre>${escapeHtml(diff.diff || diff.message || '')}</pre></section>`;
  }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(config.productName)} File Center</title><style>body{font-family:Arial,sans-serif;background:#0a1120;color:#eef4ff;padding:24px;margin:0}.hero,.panel{background:#111a2d;border:1px solid #24344f;border-radius:18px;padding:18px;margin-bottom:18px}.tree{background:#0a1321;border:1px solid #24344f;border-radius:14px;padding:14px;line-height:1.6;max-height:360px;overflow:auto}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}.stat{background:#16233a;border-radius:14px;padding:12px;border:1px solid #27405f}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #24344f;text-align:left}pre{white-space:pre-wrap;background:#0a1321;border:1px solid #24344f;border-radius:14px;padding:14px;max-height:280px;overflow:auto}em{color:#9fc4ff}a{color:#cce2ff}</style></head><body><section class="hero"><h1>${escapeHtml(config.productName)} File Center</h1><p>Workspace tree, changed-file state, inspect/content/search/diff/download APIs, file-class association hints, and safer fallback behavior under the canonical bridge.</p><p><a href="/api/workspaces/${encodeURIComponent(workspaceId)}/files/tree">Tree API</a> · <a href="/api/workspaces/${encodeURIComponent(workspaceId)}/files/summary">Association Summary API</a> · <a href="/api/workspaces/${encodeURIComponent(workspaceId)}/files/changed">Changed API</a> · <a href="/api/workspaces/${encodeURIComponent(workspaceId)}/files/search?q=workspace">Search API</a></p></section><section class="panel"><h2>Association summary</h2><div class="stats">${summaryCards}</div></section><section class="panel"><h2>Workspace tree</h2><div class="tree">${renderItems(tree.items || [])}</div></section><section class="panel"><h2>Changed files</h2><table><thead><tr><th>Status</th><th>Path</th></tr></thead><tbody>${changedRows}</tbody></table></section>${diffPanels}</body></html>`;
}


function buildProviderCenterHtml(config, workspaceId = 'local-default', tenantId = 'local', sessionId = null) {
  return buildProviderCenterUiHtml(config, {
    workspaceId,
    tenantId,
    sessionId,
    profiles: listProviderProfiles(config, { tenantId }).profiles,
    bindings: listWorkspaceProviderBindings(config, { workspaceId, tenantId }).bindings,
    unlockState: sessionId ? getSessionProviderUnlockState(config, { sessionId }) : { unlocked: false, unlockCount: 0, profiles: [] },
    catalog: getProviderCatalog(),
    roleCatalog: getBindingRoleCatalog()
  });
}

function buildStorageCenterHtml(config, workspaceId = 'local-default', tenantId = 'local') {
  return buildStorageCenterUiHtml(config, {
    workspaceId,
    tenantId,
    profiles: listProviderProfiles(config, { tenantId }).profiles
  });
}

function buildDeploymentCenterHtml(config, workspaceId = 'local-default', tenantId = 'local') {
  return buildDeploymentCenterUiHtml(config, {
    workspaceId,
    tenantId,
    profiles: listProviderProfiles(config, { tenantId }).profiles
  });
}

function buildProxyHeaders(request, targetUrl, extraHeaders = {}) {
  const headers = { ...request.headers };
  delete headers.host;
  delete headers.connection;

  headers.host = targetUrl.host;
  headers['x-forwarded-host'] = request.headers.host || targetUrl.host;
  headers['x-forwarded-proto'] = 'http';

  const remoteAddress = request.socket.remoteAddress;
  if (remoteAddress) {
    const existing = request.headers['x-forwarded-for'];
    headers['x-forwarded-for'] = existing ? `${existing}, ${remoteAddress}` : remoteAddress;
  }

  for (const [key, value] of Object.entries(extraHeaders || {})) {
    if (value === null || value === undefined || value === '') {
      continue;
    }

    headers[key.toLowerCase()] = String(value);
  }

  return headers;
}

function copyProxyResponseHeaders(sourceHeaders, response, internalBaseUrl, publicBaseUrl) {
  for (const [key, value] of Object.entries(sourceHeaders)) {
    if (value === undefined || ['connection', 'transfer-encoding'].includes(key.toLowerCase())) {
      continue;
    }

    if (key.toLowerCase() === 'location') {
      const rewritten = rewriteLocationHeader(value, internalBaseUrl, publicBaseUrl);
      response.setHeader(key, rewritten);
      continue;
    }

    response.setHeader(key, value);
  }
}

function rewriteLocationHeader(value, internalBaseUrl, publicBaseUrl) {
  if (Array.isArray(value)) {
    return value.map(item => rewriteLocationHeader(item, internalBaseUrl, publicBaseUrl));
  }

  if (typeof value !== 'string' || !value.startsWith(internalBaseUrl)) {
    return value;
  }

  const internalUrl = new URL(value);
  return new URL(`${internalUrl.pathname}${internalUrl.search}${internalUrl.hash}`, publicBaseUrl).toString();
}

function writeGatewayError(response, code, error, detail) {
  writeJson(response, code, {
    error,
    detail
  });
}

function proxyHttpRequest(request, response, targetUrl, options = {}) {
  const upstream = http.request(targetUrl, {
    method: request.method,
    headers: buildProxyHeaders(request, targetUrl)
  });

  upstream.on('response', upstreamResponse => {
    response.statusCode = upstreamResponse.statusCode || 502;
    copyProxyResponseHeaders(
      upstreamResponse.headers,
      response,
      options.internalBaseUrl || `${targetUrl.protocol}//${targetUrl.host}`,
      options.publicBaseUrl || `${targetUrl.protocol}//${targetUrl.host}`
    );
    upstreamResponse.pipe(response);
  });

  upstream.on('error', error => {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }

    writeGatewayError(
      response,
      502,
      options.unavailableError || 'upstream_unavailable',
      error instanceof Error ? error.message : String(error)
    );
  });

  request.pipe(upstream);
}

function writeUpgradeResponse(socket, statusCode, statusMessage, headers, head) {
  let payload = `HTTP/1.1 ${statusCode} ${statusMessage}\r\n`;

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach(item => {
        payload += `${key}: ${item}\r\n`;
      });
      continue;
    }

    payload += `${key}: ${value}\r\n`;
  }

  payload += '\r\n';
  socket.write(payload);

  if (head?.length) {
    socket.write(head);
  }
}

function proxyUpgradeRequest(request, socket, head, targetUrl, options = {}) {
  const upstream = http.request(targetUrl, {
    method: request.method,
    headers: {
      ...buildProxyHeaders(request, targetUrl, options.extraHeaders),
      connection: request.headers.connection || 'Upgrade',
      upgrade: request.headers.upgrade
    }
  });

  upstream.on('upgrade', (upstreamResponse, upstreamSocket, upstreamHead) => {
    writeUpgradeResponse(
      socket,
      upstreamResponse.statusCode || 101,
      upstreamResponse.statusMessage || 'Switching Protocols',
      upstreamResponse.headers,
      upstreamHead
    );

    if (head?.length) {
      upstreamSocket.write(head);
    }

    upstreamSocket.pipe(socket);
    socket.pipe(upstreamSocket);

    upstreamSocket.on('error', () => socket.destroy());
    socket.on('error', () => upstreamSocket.destroy());
  });

  upstream.on('response', upstreamResponse => {
    writeUpgradeResponse(
      socket,
      upstreamResponse.statusCode || 502,
      upstreamResponse.statusMessage || 'Bad Gateway',
      upstreamResponse.headers,
      Buffer.alloc(0)
    );
    upstreamResponse.resume();
    socket.end();
  });

  upstream.on('error', error => {
    writeUpgradeResponse(
      socket,
      502,
      'Bad Gateway',
      { 'content-type': 'application/json; charset=utf-8' },
      Buffer.from(
        JSON.stringify({
          error: options.unavailableError || 'upstream_unavailable',
          detail: error instanceof Error ? error.message : String(error)
        })
      )
    );
    socket.end();
  });

  upstream.end();
}

function createTargetUrl(baseUrl, pathname, search = '') {
  return new URL(`${pathname}${search}`, baseUrl);
}

async function checkUrl(url) {
  try {
    const response = await fetch(url, { redirect: 'manual' });
    return {
      ok: response.ok,
      status: response.status
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function readJsonBody(request) {
  return readJsonBodyWithHardening(request, getBridgeHardeningPolicy(process.env));
}

function writeWorkspaceError(response, error) {
  const message = error instanceof Error ? error.message : String(error);
  const statusCode = message.includes('not registered') ? 404 : 400;
  writeJson(response, statusCode, {
    ok: false,
    error: 'workspace_request_failed',
    detail: message
  });
}

function extractBearerToken(request) {
  const authHeader = String(request.headers.authorization || '').trim();
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  const sessionHeader = String(request.headers['x-skyequanta-session-token'] || '').trim();
  if (sessionHeader) {
    return sessionHeader;
  }

  return null;
}

function extractTenantId(request) {
  const tenantHeader = String(request.headers['x-skyequanta-tenant-id'] || '').trim().toLowerCase();
  return tenantHeader || 'local';
}

function hasLocalAdminToken(config, request) {
  const configuredAdminToken = String(config?.auth?.adminToken || '').trim();
  const token = extractBearerToken(request);
  if (!configuredAdminToken || !token) {
    return false;
  }

  return token === configuredAdminToken;
}

function writeUnauthorized(response, detail) {
  writeJson(response, 401, {
    ok: false,
    error: 'unauthorized',
    detail
  });
}

function writeForbidden(response, detail) {
  writeJson(response, 403, {
    ok: false,
    error: 'forbidden',
    detail
  });
}

async function resolveAdminAccess(config, request) {
  if (hasLocalAdminToken(config, request)) {
    return {
      ok: true,
      mode: 'local-admin',
      identity: null,
      tenantId: 'founder-gateway'
    };
  }

  const gateAuth = await authenticateGateRequest(config, request);
  if (gateAuth.ok && isFounderGateIdentity(gateAuth.identity)) {
    return {
      ok: true,
      mode: 'founder-gateway',
      identity: gateAuth.identity,
      tenantId: gateAuth.identity.tenantId
    };
  }

  return {
    ok: false,
    mode: null,
    identity: null,
    tenantId: null,
    reason: gateAuth.reason === 'missing_gate_credentials'
      ? 'missing admin token or founder gateway session'
      : gateAuth.reason || 'missing admin token or founder gateway session'
  };
}

async function assertAdminAccess(config, request, response, detail) {
  const adminAccess = await resolveAdminAccess(config, request);
  if (!adminAccess.ok) {
    writeUnauthorized(response, detail);
    return null;
  }

  return adminAccess;
}

function buildLocalSessionAccess(session) {
  return {
    mode: 'session',
    session,
    gateIdentity: null,
    tenantId: session.tenantId
  };
}

function buildGateSessionAccess(identity) {
  return {
    mode: 'gate',
    session: null,
    gateIdentity: identity,
    tenantId: identity.tenantId
  };
}

async function requireSession(config, request, constraints = {}) {
  const accessToken = extractBearerToken(request);
  const tenantId = constraints.tenantId || extractTenantId(request);
  const workspaceId = constraints.workspaceId || null;
  const session = validateAccessToken(config, accessToken, {
    tenantId,
    workspaceId
  });

  if (session) {
    return buildLocalSessionAccess(session);
  }

  const gateAuth = await authenticateGateRequest(config, request);
  if (!gateAuth.ok || !gateAuth.identity) {
    return null;
  }

  const expectedTenantId = String(tenantId || '').trim().toLowerCase() || null;
  if (expectedTenantId && gateAuth.identity.tenantId !== expectedTenantId && !isFounderGateIdentity(gateAuth.identity)) {
    return null;
  }

  return buildGateSessionAccess(gateAuth.identity);
}

function getAuthActorId(auth) {
  if (auth.mode === 'admin') {
    return auth.gateIdentity?.appId || 'admin';
  }

  if (auth.mode === 'gate') {
    return auth.gateIdentity?.appId || auth.gateIdentity?.sessionId || 'gate-session';
  }

  return auth.session?.clientName || auth.session?.id || 'session-client';
}

async function requireAdminOrSession(config, request, constraints = {}) {
  const adminAccess = await resolveAdminAccess(config, request);
  if (adminAccess.ok) {
    return {
      ok: true,
      mode: 'admin',
      session: null,
      gateIdentity: adminAccess.identity,
      tenantId: constraints.tenantId || extractTenantId(request)
    };
  }

  const sessionAccess = await requireSession(config, request, constraints);
  if (!sessionAccess) {
    return {
      ok: false,
      reason: 'missing or invalid gate or workspace session token'
    };
  }

  return {
    ok: true,
    ...sessionAccess
  };
}


function summarizeAuthContext(auth) {
  if (!auth) {
    return {
      mode: 'anonymous',
      tenantId: null,
      sessionId: null,
      clientName: null,
      authSource: null,
      gateSessionId: null,
      gateAppId: null,
      gateOrgId: null,
      founderGateway: false
    };
  }

  return {
    mode: auth.mode || 'anonymous',
    tenantId: auth.tenantId || null,
    sessionId: auth.session?.id || null,
    clientName: auth.session?.clientName || null,
    authSource: auth.session?.authSource || null,
    gateSessionId: auth.gateIdentity?.sessionId || auth.session?.gateSessionId || null,
    gateAppId: auth.gateIdentity?.appId || auth.session?.gateAppId || null,
    gateOrgId: auth.gateIdentity?.orgId || auth.session?.gateOrgId || null,
    founderGateway: Boolean(auth.gateIdentity?.founderGateway || auth.session?.founderGateway)
  };
}

function buildRuntimeProxyHeaders(workspace, auth, lane) {
  return {
    'x-skyequanta-authoritative-surface': 'apps/skyequanta-shell',
    'x-skyequanta-runtime-lane': lane || 'unknown',
    'x-skyequanta-workspace-id': workspace?.id || '',
    'x-skyequanta-tenant-id': auth?.tenantId || workspace?.metadata?.tenantId || 'local',
    'x-skyequanta-session-id': auth?.session?.id || '',
    'x-skyequanta-client-name': auth?.session?.clientName || '',
    'x-skyequanta-auth-mode': auth?.mode || 'anonymous'
  };
}

function parsePullRequestRoute(pathname) {
  const match = pathname.match(/^\/api\/github\/prs\/([^/]+)(?:\/(.*))?$/);
  if (!match) {
    return null;
  }

  const prId = decodeURIComponent(match[1]);
  const remainder = String(match[2] || '').replace(/^\/+|\/+$/g, '');
  const segments = remainder ? remainder.split('/') : [];
  return {
    prId,
    segments
  };
}


function parseForwardedPort(pathname) {
  const match = pathname.match(/^\/p\/(\d+)(?:\/(.*))?$/);
  if (!match) {
    return null;
  }

  const port = Number.parseInt(match[1], 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }

  const remainder = `/${match[2] || ''}`.replace(/\/+/g, '/');
  return {
    port,
    pathname: remainder === '/' ? '/' : remainder.replace(/\/$/, '') || '/'
  };
}

function resolveForwardedPortBase(workspace, port, defaultHost) {
  const configuredHost = String(workspace?.metadata?.forwardedHost || '').trim();
  if (!configuredHost) {
    return `http://${defaultHost}:${port}`;
  }

  if (configuredHost.startsWith('http://') || configuredHost.startsWith('https://')) {
    const url = new URL(configuredHost);
    url.port = String(port);
    url.pathname = '';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  }

  return `http://${configuredHost}:${port}`;
}

function normalizePathPrefix(prefix) {
  const normalized = String(prefix || '/').trim();
  if (!normalized || normalized === '/') {
    return '/';
  }

  const withLeading = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return withLeading.replace(/\/+$/, '');
}

function joinPath(base, suffix) {
  const normalizedBase = normalizePathPrefix(base);
  const normalizedSuffix = String(suffix || '').startsWith('/') ? suffix : `/${suffix || ''}`;
  if (normalizedBase === '/') {
    return normalizedSuffix;
  }

  return `${normalizedBase}${normalizedSuffix}`;
}

function buildWorkspacePreviewUrls(config, workspace, publicUrls) {
  const forwardedPorts = Array.isArray(workspace?.metadata?.forwardedPorts) ? workspace.metadata.forwardedPorts : [];
  if (forwardedPorts.length === 0) {
    return [];
  }

  const bridgePathPrefix = workspace?.routes?.bridgePathPrefix || `/w/${workspace?.id || 'local-default'}`;
  return forwardedPorts.map(port => {
    const normalizedPort = Number.parseInt(String(port), 10);
    const publicPath = joinPath(bridgePathPrefix, `/p/${normalizedPort}`);
    const currentPublicPath = `/p/${normalizedPort}`;
    const publicUrl = new URL(publicPath, publicUrls.ide).toString();
    const currentPublicUrl = new URL(currentPublicPath, publicUrls.ide).toString();
    return {
      port: normalizedPort,
      publicPath,
      publicUrl,
      currentPublicPath,
      currentPublicUrl,
      defaultPublicPath: publicPath,
      defaultPublicUrl: publicUrl,
      deployPreviewPath: publicPath,
      deployPreviewUrl: publicUrl,
      aliasPublicPath: currentPublicPath,
      aliasPublicUrl: currentPublicUrl,
      internalBaseUrl: resolveForwardedPortBase(workspace, normalizedPort, config.host)
    };
  });
}

function buildWorkspacePreviewContract(config, workspace, publicUrls) {
  const previewUrls = buildWorkspacePreviewUrls(config, workspace, publicUrls);
  const bridgePathPrefix = workspace?.routes?.bridgePathPrefix || `/w/${workspace?.id || 'local-default'}`;
  return {
    workspaceId: workspace?.id || 'local-default',
    forwardedHost: workspace?.metadata?.forwardedHost || null,
    operatorDefault: {
      mode: 'workspace-scoped',
      pathTemplate: joinPath(bridgePathPrefix, '/p/:port'),
      guidance: 'Use the workspace-scoped preview path as the canonical routed operator path. The current-workspace alias remains a convenience route.'
    },
    aliases: {
      workspaceScoped: joinPath(bridgePathPrefix, '/p/:port'),
      currentWorkspace: '/p/:port'
    },
    multiPortSupported: true,
    deployPreviewParity: {
      guaranteed: true,
      contract: 'workspace-scoped preview URL and deploy-preview URL are the same canonical surface.'
    },
    agentGeneratedApp: {
      supported: true,
      contractRoute: '/.well-known/preview-contract.json',
      recommendedApiRoute: '/api/contract'
    },
    previewUrls
  };
}

export function createBridgeServer(config) {
  if (!getCurrentWorkspace(config)) {
    ensureDefaultWorkspace(config);
  }
  const getDefaultWorkspace = () => getCurrentWorkspace(config) || ensureDefaultWorkspace(config).workspace;
  const internalUrls = getInternalUrls(config);
  const publicUrls = getPublicUrls(config);
  const hardeningPolicy = getBridgeHardeningPolicy(process.env, config);
  const runtimeContract = getRuntimeContract(config);
  const scheduler = createWorkspaceSchedulerController(config);
  scheduler.start();
  ensureScmStore(config);
  ensureCollaborationStore(config);
  ensureFleetStore(config);
  ensurePrebuildStore(config);
  ensureOpsStore(config);

  const parseWorkspacePrefix = pathname => {
    const match = pathname.match(/^\/w\/([a-z0-9-]+)(?:\/|$)(.*)$/i);
    if (!match) {
      return null;
    }

    const workspaceId = match[1];
    const remainder = `/${match[2] || ''}`.replace(/\/+/g, '/');
    return {
      workspaceId,
      pathname: remainder === '/' ? '/' : remainder.replace(/\/$/, '') || '/'
    };
  };

  const resolveWorkspace = workspaceId => {
    const workspace = getWorkspace(config, workspaceId);
    return workspace || null;
  };

  const getWorkspaceEndpoints = workspace => ({
    ide: workspace?.routes?.ideBaseUrl || internalUrls.ide,
    agentBackend: workspace?.routes?.agentBaseUrl || internalUrls.agentBackend,
    gate: config.gateRuntime.mode === 'remote-gated' ? (workspace?.routes?.gateBaseUrl || internalUrls.gate) : null,
    bridgePathPrefix: workspace?.routes?.bridgePathPrefix || `/w/${workspace?.id || getDefaultWorkspace().id}`
  });

  const resolveForwardedPortTarget = (requestUrl, workspace) => {
    const parsed = parseForwardedPort(requestUrl.pathname);
    if (!parsed) {
      return null;
    }

    const allowedPorts = Array.isArray(workspace?.metadata?.forwardedPorts) ? workspace.metadata.forwardedPorts : [];
    if (!allowedPorts.includes(parsed.port)) {
      return {
        denied: true,
        port: parsed.port
      };
    }

    const endpoints = getWorkspaceEndpoints(workspace);
    const targetBase = resolveForwardedPortBase(workspace, parsed.port, config.host);
    const publicBasePath = joinPath(endpoints.bridgePathPrefix, `/p/${parsed.port}`);
    const publicBaseUrl = new URL(publicBasePath, publicUrls.ide).toString();

    return {
      targetUrl: createTargetUrl(targetBase, parsed.pathname, requestUrl.search),
      internalBaseUrl: targetBase,
      publicBaseUrl,
      unavailableError: 'forwarded_port_unavailable',
      port: parsed.port,
      lane: 'preview'
    };
  };

  const getRuntimeContractForWorkspace = workspace => {
    const basePath = workspace?.routes?.bridgePathPrefix || '/';
    const normalizedBasePath = basePath === '/' ? '' : basePath;
    const contract = {
      ...runtimeContract,
      workspace: {
        id: workspace?.id || getDefaultWorkspace().id,
        name: workspace?.name || getDefaultWorkspace().name,
        pathPrefix: normalizedBasePath || '/'
      },
      routes: {
        ...runtimeContract.routes,
        ide: `${normalizedBasePath}/`,
        forwardedPort: `${normalizedBasePath}/p/:port`,
        health: `${normalizedBasePath}/health`,
        status: `${normalizedBasePath}/api/status`,
        runtimeContract: `${normalizedBasePath}/api/runtime-contract`,
        productIdentity: `${normalizedBasePath}/api/product/identity`,
        agentApi: `${normalizedBasePath}/api/agent`,
        agentApiDocs: `${normalizedBasePath}/api/agent/docs`,
        gateApi: `${normalizedBasePath}/api/gate`,
        gateModels: `${normalizedBasePath}/api/gate/v1/models`,
        gateChatCompletions: `${normalizedBasePath}/api/gate/v1/chat/completions`
      }
    };

    return contract;
  };

  const resolveTarget = (requestUrl, workspace) => {
    const endpoints = getWorkspaceEndpoints(workspace);

    if (requestUrl.pathname.startsWith('/api/gate')) {
      if (!endpoints.gate) {
        return { unavailableError: 'gate_runtime_mode_inactive', detail: `Gate runtime mode '${config.gateRuntime.mode}' does not expose /api/gate.` };
      }

      const targetPath = requestUrl.pathname.replace('/api/gate', '') || '/';
      return {
        targetUrl: createTargetUrl(endpoints.gate, targetPath, requestUrl.search),
        internalBaseUrl: endpoints.gate,
        publicBaseUrl: publicUrls.gateApi,
        unavailableError: 'gate_unavailable',
        lane: 'shell'
      };
    }

    if (requestUrl.pathname.startsWith('/api/agent')) {
      const targetPath = requestUrl.pathname.replace('/api/agent', '') || '/';
      return {
        targetUrl: createTargetUrl(endpoints.agentBackend, targetPath, requestUrl.search),
        internalBaseUrl: endpoints.agentBackend,
        publicBaseUrl: publicUrls.agentBackend,
        unavailableError: 'agent_backend_unavailable',
        lane: 'agent'
      };
    }

    const forwardedTarget = resolveForwardedPortTarget(requestUrl, workspace);
    if (forwardedTarget?.denied) {
      return {
        denied: true,
        unavailableError: 'forwarded_port_forbidden',
        port: forwardedTarget.port
      };
    }

    if (forwardedTarget) {
      return forwardedTarget;
    }

    return {
      targetUrl: createTargetUrl(endpoints.ide, requestUrl.pathname, requestUrl.search),
      internalBaseUrl: endpoints.ide,
      publicBaseUrl: publicUrls.ide,
      unavailableError: 'ide_unavailable',
      lane: 'ide'
    };
  };


  const buildRuntimeContextPayload = (workspace, auth = null) => {
    const projection = getWorkspaceRuntimeProjection(config, workspace.id);
    const runtime = getWorkspaceRuntime(config, workspace.id);
    if (auth?.session) {
      recordSessionContext(config, auth.session);
    }
    recordWorkspaceContext(config, workspace, { selected: getCurrentWorkspace(config)?.id === workspace.id });
    return {
      ok: true,
      workspace: runtime.workspace,
      runtime,
      authorization: summarizeAuthContext(auth),
      projection,
      canonicalAuthority: projection?.canonicalAuthority || {
        shellOwned: true,
        authoritativeSurface: 'apps/skyequanta-shell',
        importedExamplesAreAuthoritative: false
      },
      recentEvents: listRuntimeEvents(config, { workspaceId: workspace.id, limit: 20 })
    };
  };

  const computeRuntimeHealth = async workspace => {
    const endpoints = getWorkspaceEndpoints(workspace);
    const [ide, agent] = await Promise.all([
      checkUrl(endpoints.ide),
      checkUrl(`${endpoints.agentBackend}/health`)
    ]);
    const combined = {
      workspaceId: workspace.id,
      ide,
      agent,
      combinedHealthy: Boolean(ide.ok && agent.ok)
    };
    recordLaneHealth(config, {
      workspaceId: workspace.id,
      lane: 'ide',
      path: '/',
      health: ide.ok ? 'healthy' : 'unhealthy',
      combinedHealth: combined
    });
    recordLaneHealth(config, {
      workspaceId: workspace.id,
      lane: 'agent',
      path: '/health',
      health: agent.ok ? 'healthy' : 'unhealthy',
      combinedHealth: combined
    });
    recordCombinedRuntimeHealth(config, workspace.id, combined);
    return combined;
  };

  const writeRuntimeHealth = async (response, workspace, auth = null) => {
    const health = await computeRuntimeHealth(workspace);
    writeJson(response, 200, {
      ok: true,
      workspace: {
        id: workspace.id,
        name: workspace.name
      },
      authorization: summarizeAuthContext(auth),
      health,
      projection: getWorkspaceRuntimeProjection(config, workspace.id)
    });
  };

  const writeRuntimeContext = async (response, workspace, auth = null) => {
    writeJson(response, 200, buildRuntimeContextPayload(workspace, auth));
  };

  const handleRuntimeSyncRequest = async (request, response, workspace, auth, kind) => {
    const body = await readJsonBody(request);
    const sessionId = auth?.session?.id || null;
    const tenantId = auth?.tenantId || workspace?.metadata?.tenantId || 'local';
    const lane = String(body.lane || 'shell').trim().toLowerCase();

    if (kind === 'file-operation') {
      const entry = recordFileOperation(config, {
        workspaceId: workspace.id,
        lane,
        operation: body.operation,
        path: body.path,
        status: body.status,
        detail: body.detail,
        sessionId,
        tenantId
      });
      writeJson(response, 200, { ok: true, action: 'runtime.sync.file-operation', entry, projection: getWorkspaceRuntimeProjection(config, workspace.id) });
      return;
    }

    if (kind === 'preview-state') {
      const entry = recordPreviewState(config, {
        workspaceId: workspace.id,
        lane,
        port: body.port,
        publicPath: body.publicPath,
        publicUrl: body.publicUrl,
        status: body.status,
        detail: body.detail
      });
      writeJson(response, 200, { ok: true, action: 'runtime.sync.preview-state', entry, projection: getWorkspaceRuntimeProjection(config, workspace.id) });
      return;
    }

    if (kind === 'message') {
      const entry = recordRuntimeMessage(config, {
        workspaceId: workspace.id,
        lane,
        channel: body.channel,
        type: body.type,
        payload: body.payload
      });
      writeJson(response, 200, { ok: true, action: 'runtime.sync.message', entry, projection: getWorkspaceRuntimeProjection(config, workspace.id) });
      return;
    }

    writeJson(response, 400, { ok: false, error: 'runtime_sync_kind_invalid' });
  };

  const writeStatus = async (response, workspace) => {
    const endpoints = getWorkspaceEndpoints(workspace);
    const workspaceContract = getRuntimeContractForWorkspace(workspace);
    const workspaceId = workspace?.id || getDefaultWorkspace().id;
    const integrationStatus = getIntegrationStatus(config, workspaceId);
    const collaborationStatus = getCollaborationStatus(config, workspaceId);
    const fleetStatus = getFleetStatus(config, workspaceId);
    const prebuildStatus = getPrebuildStatus(config, workspaceId);
    const opsStatus = getOpsStatus(config, workspaceId);
    const [backend, ide, gate] = await Promise.all([
      checkUrl(`${endpoints.agentBackend}/health`),
      checkUrl(endpoints.ide),
      endpoints.gate ? checkUrl(`${endpoints.gate}/v1/health`) : Promise.resolve({ ok: false, status: 0, detail: 'not_configured' })
    ]);

    writeJson(response, 200, {
      productName: config.productName,
      companyName: config.companyName,
      aiDisplayName: config.aiDisplayName,
      workspace: {
        id: workspace?.id || getDefaultWorkspace().id,
        name: workspace?.name || getDefaultWorkspace().name,
        pathPrefix: workspaceContract.workspace.pathPrefix,
        forwardedPorts: Array.isArray(workspace?.metadata?.forwardedPorts) ? workspace.metadata.forwardedPorts : [],
        forwardedHost: workspace?.metadata?.forwardedHost || null,
        previewUrls: buildWorkspacePreviewUrls(config, workspace, publicUrls),
        previewContract: buildWorkspacePreviewContract(config, workspace, publicUrls)
      },
      urls: {
        web: publicUrls.ide,
        status: publicUrls.status,
        runtimeContract: publicUrls.runtimeContract,
        productIdentity: publicUrls.productIdentity,
        agentApi: publicUrls.agentBackend,
        agentApiDocs: publicUrls.agentApiDocs,
        gateApi: publicUrls.gateApi
      },
      runtimeContract: workspaceContract,
      gateRuntime: getGateRuntimeAdminSummary(config.gateRuntime),
      services: {
        agentBackend: backend,
        ide,
        gate
      },
      integrations: {
        github: integrationStatus.github,
        pullRequests: integrationStatus.pullRequests,
        collaboration: collaborationStatus.summary,
        fleet: fleetStatus.summary,
        prebuild: prebuildStatus.summary,
        ops: opsStatus.summary,
        postParityOps: getPostParityOpsSummary(config),
        governance: getGovernancePlaneSummary(config, {
          tenantId: workspace?.metadata?.tenantId || 'local',
          releaseQueueCount: integrationStatus.releaseReplay?.queue?.length || 0,
          releaseHistoryCount: integrationStatus.releaseReplay?.history?.length || 0
        }),
        parityPlusFinalGate: getParityPlusFinalGateSummary(config)
      }
    });
  };

  const server = http.createServer(async (request, response) => {
    const incomingUrl = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
    const requestPolicy = evaluateBridgeRequestPolicy(request, incomingUrl, hardeningPolicy);
    if (!requestPolicy.ok) {
      writeJson(response, requestPolicy.statusCode, {
        ok: false,
        error: requestPolicy.error,
        detail: requestPolicy.detail
      });
      return;
    }

    request.setTimeout(hardeningPolicy.bodyReadTimeoutMs, () => {
      if (!response.headersSent) {
        writeJson(response, 408, {
          ok: false,
          error: 'request_timeout',
          detail: `Request exceeded body/read timeout of ${hardeningPolicy.bodyReadTimeoutMs}ms.`
        });
      }
      request.destroy();
    });

    let cachedAdminAccess = null;
    const getAdminAccess = async () => {
      if (!cachedAdminAccess) {
        cachedAdminAccess = resolveAdminAccess(config, request);
      }
      return cachedAdminAccess;
    };
    const workspacePrefix = parseWorkspacePrefix(incomingUrl.pathname);
    const workspace = workspacePrefix ? resolveWorkspace(workspacePrefix.workspaceId) : getDefaultWorkspace();

    if (workspacePrefix && !workspace) {
      writeGatewayError(response, 404, 'workspace_not_found', `Workspace '${workspacePrefix.workspaceId}' is not registered.`);
      return;
    }

    if (workspacePrefix) {
      const tenantId = String(workspace?.metadata?.tenantId || extractTenantId(request)).trim().toLowerCase() || 'local';
      const session = await requireSession(config, request, {
        workspaceId: workspace.id,
        tenantId
      });
      if (!session) {
        writeUnauthorized(response, `A valid session token is required for workspace route '${workspace.id}'.`);
        return;
      }
      request.skyequantaAccess = session;
    }

    const requestUrl = new URL(incomingUrl.toString());
    if (workspacePrefix) {
      requestUrl.pathname = workspacePrefix.pathname;
    }

    response.once('finish', () => {
      recordBridgeAuthOutcome(request, response, hardeningPolicy);
      if (!shouldAuditBridgeRequest(request, requestUrl, response)) {
        return;
      }
      appendAuditEvent(config, {
        action: 'bridge.request',
        outcome: response.statusCode >= 400 ? 'error' : 'success',
        actorType: request.skyequantaAccess?.session ? 'client' : 'system',
        actorId: request.skyequantaAccess?.session?.id || request.skyequantaAccess?.gateIdentity?.appId || requestPolicy.ip || 'bridge',
        tenantId: request.skyequantaAccess?.tenantId || extractTenantId(request),
        workspaceId: workspace?.id || null,
        sessionId: request.skyequantaAccess?.session?.id || null,
        detail: buildBridgeRequestAuditDetail(request, requestUrl, response, {
          authMode: request.skyequantaAccess?.mode || null,
          workspacePrefixed: Boolean(workspacePrefix)
        })
      });
    });

    if (requestUrl.pathname === '/health') {
      writeJson(response, 200, { status: 'ok' });
      return;
    }

    if (requestUrl.pathname === '/api/runtime-contract') {
      writeJson(response, 200, getRuntimeContractForWorkspace(workspace));
      return;
    }

    if (requestUrl.pathname === '/api/product/identity') {
      const identity = getProductIdentity(config);
      writeJson(response, 200, {
        ok: true,
        gateRuntime: getGateRuntimeAdminSummary(config.gateRuntime),
        identity,
        workspace: {
          id: workspace?.id || getDefaultWorkspace().id,
          name: workspace?.name || getDefaultWorkspace().name,
          pathPrefix: workspace?.routes?.bridgePathPrefix || '/',
          previewUrls: buildWorkspacePreviewUrls(config, workspace, publicUrls),
          previewContract: buildWorkspacePreviewContract(config, workspace, publicUrls)
        }
      });
      return;
    }

    if (requestUrl.pathname === '/api/surface-identity') {
      const bundle = buildSurfaceIdentityDocument(config.rootDir, config, {
        surfaceBaseUrl: publicUrls.bridge,
        routePath: '/api/surface-identity'
      });
      writeJson(response, 200, bundle.document);
      return;
    }

    if (requestUrl.pathname === '/control-plane' && request.method === 'GET') {
      const adminAccess = await getAdminAccess();
      if (!adminAccess.ok) {
        writeUnauthorized(response, 'Admin token is required to view the control plane.');
        return;
      }
      writeHtml(response, 200, buildControlPlaneConsoleHtml(config, publicUrls));
      return;
    }

    if (requestUrl.pathname === '/api/gate/config' && request.method === 'GET') {
      const adminAccess = await getAdminAccess();
      if (!adminAccess.ok) {
        writeUnauthorized(response, 'Admin token is required to view gate runtime config.');
        return;
      }
      writeJson(response, 200, redactSensitivePayload({ ok: true, gateRuntime: getGateRuntimeAdminSummary(config.gateRuntime) }, config.gateRuntime));
      return;
    }

    if (requestUrl.pathname === '/api/sessions' && request.method === 'GET') {
      const adminAccess = await getAdminAccess();
      if (!adminAccess.ok) {
        writeUnauthorized(response, 'Admin token is required to list sessions.');
        return;
      }

      const tenantId = String(requestUrl.searchParams.get('tenantId') || '').trim().toLowerCase() || null;
      const sessions = listSessions(config, tenantId);
      writeJson(response, 200, {
        ok: true,
        count: sessions.length,
        sessions: sessions.map(session => ({
          id: session.id,
          tenantId: session.tenantId,
          workspaceId: session.workspaceId,
          clientName: session.clientName,
          authSource: session.authSource,
          gateSessionId: session.gateSessionId,
          gateAppId: session.gateAppId,
          gateOrgId: session.gateOrgId,
          gateAuthMode: session.gateAuthMode,
          founderGateway: session.founderGateway,
          createdAt: session.createdAt,
          lastSeenAt: session.lastSeenAt,
          expiresAt: session.expiresAt
        }))
      });
      return;
    }

    if (requestUrl.pathname === '/api/sessions/revoke-all' && request.method === 'POST') {
      const adminAccess = await getAdminAccess();
      if (!adminAccess.ok) {
        writeUnauthorized(response, 'Admin token is required to revoke sessions.');
        return;
      }

      try {
        const body = await readJsonBody(request);
        const result = revokeSessions(config, {
          tenantId: String(body?.tenantId || '').trim() || null,
          workspaceId: String(body?.workspaceId || '').trim() || null,
          actorType: 'admin',
          actorId: adminAccess.mode || 'admin'
        });
        writeJson(response, 200, { ok: true, action: 'session_revoke_all', ...result });
      } catch (error) {
        writeWorkspaceError(response, error);
      }
      return;
    }

    if (requestUrl.pathname === '/api/sessions/open' && request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const workspaceId = String(body.workspaceId || '').trim();
        if (!workspaceId) {
          throw new Error('workspaceId is required to open a session.');
        }

        const targetWorkspace = getWorkspace(config, workspaceId);
        if (!targetWorkspace) {
          writeJson(response, 404, { ok: false, error: 'workspace_not_found', workspaceId });
          return;
        }

        const rawGateToken = String(body.token || body.os_key || body['0sKey'] || '').trim();
        const gateGrant = rawGateToken
          ? await exchangeGateTokenForIdentity(config, rawGateToken)
          : (() => null)();
        const requestGateAuth = gateGrant
          ? { ok: true, identity: gateGrant.identity, sessionToken: gateGrant.sessionToken }
          : await authenticateGateRequest(config, request);
        const adminAccess = await getAdminAccess();
        const gateIdentity = requestGateAuth.ok ? requestGateAuth.identity : null;

        if (!gateIdentity) {
          writeUnauthorized(response, 'A gate session, 0sKey, or founder gateway credential is required to open workspace sessions.');
          return;
        }

        const workspaceTenant = String(targetWorkspace.metadata?.tenantId || 'local').trim().toLowerCase() || 'local';
        const tenantId = String(body.tenantId || gateIdentity.tenantId || workspaceTenant).trim().toLowerCase() || 'local';
        if (!adminAccess.ok && tenantId !== workspaceTenant && !isFounderGateIdentity(gateIdentity)) {
          writeForbidden(response, `Tenant '${tenantId}' is not allowed for workspace '${workspaceId}'.`);
          return;
        }

        const session = openSession(config, {
          workspaceId,
          tenantId,
          clientName: body.clientName || gateIdentity.appId,
          authSource: 'gate-derived-session',
          gateSessionId: gateIdentity.sessionId,
          gateAppId: gateIdentity.appId,
          gateOrgId: gateIdentity.orgId,
          gateAuthMode: gateIdentity.authMode,
          founderGateway: gateIdentity.founderGateway,
          gateExpiresAt: gateIdentity.expiresAt
        });

        writeJson(response, 201, {
          ok: true,
          action: 'session_open',
          gate: {
            sessionToken: requestGateAuth.sessionToken,
            identity: gateIdentity
          },
          session: {
            id: session.id,
            tenantId: session.tenantId,
            workspaceId: session.workspaceId,
            accessToken: session.accessToken,
            reconnectToken: session.reconnectToken,
            authSource: session.authSource,
            gateSessionId: session.gateSessionId,
            gateAppId: session.gateAppId,
            gateOrgId: session.gateOrgId,
            gateAuthMode: session.gateAuthMode,
            founderGateway: session.founderGateway,
            createdAt: session.createdAt,
            lastSeenAt: session.lastSeenAt,
            expiresAt: session.expiresAt
          }
        });
      } catch (error) {
        writeWorkspaceError(response, error);
      }
      return;
    }

    if (requestUrl.pathname === '/api/sessions/reconnect' && request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const session = reconnectSession(config, body.sessionId, body.reconnectToken);
        writeJson(response, 200, {
          ok: true,
          action: 'session_reconnect',
          session: {
            id: session.id,
            tenantId: session.tenantId,
            workspaceId: session.workspaceId,
            accessToken: session.accessToken,
            reconnectToken: session.reconnectToken,
            createdAt: session.createdAt,
            lastSeenAt: session.lastSeenAt,
            expiresAt: session.expiresAt
          }
        });
      } catch (error) {
        writeWorkspaceError(response, error);
      }
      return;
    }

    if (requestUrl.pathname === '/api/sessions/restore' && request.method === 'POST') {
      const adminAccess = await getAdminAccess();
      if (!adminAccess.ok) {
        writeUnauthorized(response, 'Admin token is required to restore workspace sessions.');
        return;
      }

      try {
        const body = await readJsonBody(request);
        const session = restoreSession(config, body.sessionId, body.reconnectToken, {
          actorType: 'admin',
          actorId: adminAccess.mode || 'admin',
          reason: String(body?.reason || '').trim() || null
        });
        writeJson(response, 200, {
          ok: true,
          action: 'session_restore',
          session: {
            id: session.id,
            tenantId: session.tenantId,
            workspaceId: session.workspaceId,
            accessToken: session.accessToken,
            reconnectToken: session.reconnectToken,
            createdAt: session.createdAt,
            lastSeenAt: session.lastSeenAt,
            expiresAt: session.expiresAt
          }
        });
      } catch (error) {
        writeWorkspaceError(response, error);
      }
      return;
    }

    if (requestUrl.pathname.startsWith('/api/sessions/') && request.method === 'POST') {
      const segments = requestUrl.pathname.split('/').filter(Boolean);
      const sessionId = segments[2] || null;
      const action = segments[3] || null;

      if (!sessionId || !action) {
        writeJson(response, 400, { ok: false, error: 'session_request_invalid' });
        return;
      }

      if (action === 'heartbeat') {
        try {
          const accessToken = extractBearerToken(request);
          const session = heartbeatSession(config, sessionId, accessToken);
          writeJson(response, 200, {
            ok: true,
            action: 'session_heartbeat',
            session: {
              id: session.id,
              tenantId: session.tenantId,
              workspaceId: session.workspaceId,
              lastSeenAt: session.lastSeenAt,
              expiresAt: session.expiresAt
            }
          });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (action === 'close') {
        try {
          const admin = (await getAdminAccess()).ok;
          const accessToken = admin ? null : extractBearerToken(request);
          const result = closeSession(config, sessionId, accessToken);
          writeJson(response, 200, {
            ok: true,
            action: 'session_close',
            ...result
          });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      writeJson(response, 405, { ok: false, error: 'session_method_not_allowed' });
      return;
    }

    if (requestUrl.pathname === '/api/security/tenant-isolation' && request.method === 'GET') {
      const workspaceId = String(requestUrl.searchParams.get('workspaceId') || '').trim();
      if (!workspaceId) { writeJson(response, 400, { ok: false, error: 'workspace_id_required' }); return; }
      const workspace = getWorkspace(config, workspaceId);
      if (!workspace) { writeJson(response, 404, { ok: false, error: 'workspace_not_found', workspaceId }); return; }
      const auth = await requireAdminOrSession(config, request, { tenantId: workspace?.metadata?.tenantId || extractTenantId(request), workspaceId });
      if (!auth.ok) { writeUnauthorized(response, auth.reason || 'A valid admin or workspace session token is required to inspect tenant isolation.'); return; }
      try {
        const access = assertTenantWorkspaceAccess(workspace, { tenantId: auth.tenantId, adminMode: auth.mode === 'admin', founderGateway: Boolean(auth.session?.founderGateway || auth.gateIdentity?.founderGateway), sessionWorkspaceId: auth.session?.workspaceId || null });
        const matrix = buildTenantIsolationMatrix(config, workspaceId, { tenantId: auth.tenantId, adminMode: auth.mode === 'admin', founderGateway: Boolean(auth.session?.founderGateway || auth.gateIdentity?.founderGateway), sessionWorkspaceId: auth.session?.workspaceId || null });
        writeJson(response, 200, { ok: true, action: 'tenant_isolation_matrix', access, matrix });
      } catch (error) {
        writeForbidden(response, error instanceof Error ? error.message : String(error));
      }
      return;
    }

    if (requestUrl.pathname === '/api/workspaces' && request.method === 'GET') {
      if (!(await getAdminAccess()).ok) {
        writeUnauthorized(response, 'Admin token is required to list workspaces.');
        return;
      }

      const state = listWorkspaces(config);
      writeJson(response, 200, {
        ok: true,
        currentWorkspaceId: state.currentWorkspaceId,
        workspaces: state.workspaces.map(workspace => ({
          ...workspace,
          previewUrls: buildWorkspacePreviewUrls(config, workspace, publicUrls),
          previewContract: buildWorkspacePreviewContract(config, workspace, publicUrls)
        }))
      });
      return;
    }

    if (requestUrl.pathname === '/api/governance/policy' && request.method === 'GET') {
      if (!(await getAdminAccess()).ok) {
        writeUnauthorized(response, 'Admin token is required to read governance policy.');
        return;
      }

      writeJson(response, 200, {
        ok: true,
        policy: loadGovernancePolicy(config)
      });
      return;
    }

    if (requestUrl.pathname === '/api/governance/policy' && ['PUT', 'POST'].includes(request.method)) {
      const adminAccess = await getAdminAccess();
      if (!adminAccess.ok) {
        writeUnauthorized(response, 'Admin token is required to update governance policy.');
        return;
      }

      try {
        const body = await readJsonBody(request);
        const mutation = updateGovernancePolicy(config, body?.policy || body || {}, {
          actorType: 'admin',
          actorId: adminAccess.mode || 'admin',
          reason: String(body?.reason || '').trim() || null
        });
        appendAuditEvent(config, {
          action: 'governance.policy.update',
          actorType: 'admin',
          actorId: adminAccess.mode || 'admin',
          tenantId: adminAccess.tenantId || 'founder-gateway',
          detail: { limits: mutation.policy.limits, revisionId: mutation.revision.id }
        });

        writeJson(response, 200, {
          ok: true,
          action: 'governance_policy_update',
          policy: mutation.policy,
          revision: mutation.revision
        });
      } catch (error) {
        writeWorkspaceError(response, error);
      }
      return;
    }

    if (requestUrl.pathname === '/api/governance/policy/history' && request.method === 'GET') {
      if (!(await getAdminAccess()).ok) {
        writeUnauthorized(response, 'Admin token is required to read governance policy history.');
        return;
      }

      const limit = Number.parseInt(String(requestUrl.searchParams.get('limit') || '50'), 10) || 50;
      const offset = Number.parseInt(String(requestUrl.searchParams.get('offset') || '0'), 10) || 0;
      const history = listGovernancePolicyHistory(config, { limit, offset });
      writeJson(response, 200, { ok: true, ...history, count: history.revisions.length });
      return;
    }

    if (requestUrl.pathname === '/api/governance/policy/rollback' && request.method === 'POST') {
      const adminAccess = await getAdminAccess();
      if (!adminAccess.ok) {
        writeUnauthorized(response, 'Admin token is required to roll governance policy back.');
        return;
      }

      try {
        const body = await readJsonBody(request);
        const rollback = rollbackGovernancePolicy(config, body.revisionId || null, {
          actorType: 'admin',
          actorId: adminAccess.mode || 'admin',
          reason: String(body?.reason || '').trim() || null
        });
        appendAuditEvent(config, {
          action: 'governance.policy.rollback',
          actorType: 'admin',
          actorId: adminAccess.mode || 'admin',
          tenantId: adminAccess.tenantId || 'founder-gateway',
          detail: { revisionId: rollback.restoredFromRevisionId, limits: rollback.policy.limits }
        });
        writeJson(response, 200, {
          ok: true,
          action: 'governance_policy_rollback',
          policy: rollback.policy,
          restoredFromRevisionId: rollback.restoredFromRevisionId,
          revision: rollback.revision
        });
      } catch (error) {
        writeWorkspaceError(response, error);
      }
      return;
    }

    if (requestUrl.pathname === '/api/governance/usage' && request.method === 'GET') {
      if (!(await getAdminAccess()).ok) {
        writeUnauthorized(response, 'Admin token is required to read governance usage.');
        return;
      }

      const workspaceState = listWorkspaces(config);
      const sessions = listSessions(config);
      const snapshotCountByWorkspace = countSnapshotsByWorkspace(config);
      writeJson(response, 200, {
        ok: true,
        ...getGovernanceSummary(config, {
          workspaceCount: workspaceState.count,
          sessionCount: sessions.length,
          snapshotCountByWorkspace
        })
      });
      return;
    }


    if (requestUrl.pathname === '/api/governance/tenants/policies' && request.method === 'GET') {
      if (!(await getAdminAccess()).ok) {
        writeUnauthorized(response, 'Admin token is required to read tenant governance policy surfaces.');
        return;
      }

      const policies = listTenantGovernancePolicies(config);
      writeJson(response, 200, {
        ok: true,
        total: policies.length,
        policies
      });
      return;
    }

    const tenantPolicyMatch = requestUrl.pathname.match(/^\/api\/governance\/tenants\/([^/]+)\/policy$/);
    if (tenantPolicyMatch && request.method === 'GET') {
      if (!(await getAdminAccess()).ok) {
        writeUnauthorized(response, 'Admin token is required to read tenant governance policy surfaces.');
        return;
      }

      const tenantId = decodeURIComponent(tenantPolicyMatch[1]);
      const policy = loadTenantGovernancePolicy(config, tenantId);
      writeJson(response, 200, {
        ok: true,
        tenantId: policy.tenantId,
        policy
      });
      return;
    }

    if (tenantPolicyMatch && ['POST', 'PUT'].includes(request.method)) {
      const adminAccess = await getAdminAccess();
      if (!adminAccess.ok) {
        writeUnauthorized(response, 'Admin token is required to update tenant governance policy surfaces.');
        return;
      }

      try {
        const body = await readJsonBody(request);
        const tenantId = decodeURIComponent(tenantPolicyMatch[1]);
        const policy = upsertTenantGovernancePolicy(config, tenantId, body?.policy || body || {}, {
          actorType: 'admin',
          actorId: adminAccess.mode || 'admin',
          workspaceId: String(body?.workspaceId || '').trim() || null,
          source: String(body?.source || 'parity-plus-governance').trim() || 'parity-plus-governance',
          reason: String(body?.reason || '').trim() || null
        });
        writeJson(response, 200, {
          ok: true,
          action: 'tenant_governance_policy_upsert',
          tenantId: policy.tenantId,
          policy
        });
      } catch (error) {
        writeWorkspaceError(response, error);
      }
      return;
    }

    if (requestUrl.pathname === '/api/governance/secrets' && request.method === 'GET') {
      if (!(await getAdminAccess()).ok) {
        writeUnauthorized(response, 'Admin token is required to inspect the secret broker.');
        return;
      }

      const tenantId = String(requestUrl.searchParams.get('tenantId') || 'local').trim() || 'local';
      const scope = String(requestUrl.searchParams.get('scope') || '').trim() || null;
      const secrets = listGovernanceSecrets(config, {
        tenantId,
        scope,
        includeValue: false
      });
      writeJson(response, 200, {
        ok: true,
        tenantId: tenantId.toLowerCase(),
        ...secrets
      });
      return;
    }

    if (requestUrl.pathname === '/api/governance/secrets' && request.method === 'POST') {
      const adminAccess = await getAdminAccess();
      if (!adminAccess.ok) {
        writeUnauthorized(response, 'Admin token is required to mutate the secret broker.');
        return;
      }

      try {
        const body = await readJsonBody(request);
        const secret = upsertGovernanceSecret(config, {
          tenantId: body?.tenantId || 'local',
          scope: body?.scope,
          key: body?.key,
          value: body?.value,
          description: body?.description,
          actorType: 'admin',
          actorId: adminAccess.mode || 'admin',
          workspaceId: String(body?.workspaceId || '').trim() || null,
          source: String(body?.source || 'parity-plus-governance').trim() || 'parity-plus-governance'
        });
        writeJson(response, 200, {
          ok: true,
          action: 'governance_secret_upsert',
          secret
        });
      } catch (error) {
        writeWorkspaceError(response, error);
      }
      return;
    }

    if (requestUrl.pathname === '/api/governance/costs/status' && request.method === 'GET') {
      if (!(await getAdminAccess()).ok) {
        writeUnauthorized(response, 'Admin token is required to inspect governance cost controls.');
        return;
      }

      const tenantId = String(requestUrl.searchParams.get('tenantId') || 'local').trim() || 'local';
      writeJson(response, 200, {
        ok: true,
        costs: getGovernanceCostStatus(config, tenantId)
      });
      return;
    }

    if (requestUrl.pathname === '/api/governance/releases' && request.method === 'GET') {
      if (!(await getAdminAccess()).ok) {
        writeUnauthorized(response, 'Admin token is required to inspect governed release replay state.');
        return;
      }

      const workspaceId = String(requestUrl.searchParams.get('workspaceId') || workspace?.id || 'local-default').trim() || 'local-default';
      const tenantId = String(requestUrl.searchParams.get('tenantId') || workspace?.metadata?.tenantId || 'local').trim() || 'local';
      const releaseReplay = listReleaseReplayItems(config, workspaceId);
      const governance = getGovernancePlaneSummary(config, {
        tenantId,
        releaseQueueCount: releaseReplay.queue.length,
        releaseHistoryCount: releaseReplay.history.length
      });
      writeJson(response, 200, {
        ok: true,
        workspaceId,
        tenantId: tenantId.toLowerCase(),
        releaseReplay,
        governance,
        policy: loadTenantGovernancePolicy(config, tenantId),
        releaseDecisions: listGovernanceReleaseDecisions(config, { tenantId, workspaceId, limit: 25 })
      });
      return;
    }

    const governedReleaseEvaluateMatch = requestUrl.pathname.match(/^\/api\/governance\/releases\/([^/]+)\/evaluate$/);
    if (governedReleaseEvaluateMatch && request.method === 'POST') {
      const adminAccess = await getAdminAccess();
      if (!adminAccess.ok) {
        writeUnauthorized(response, 'Admin token is required to evaluate governed release replay.');
        return;
      }

      try {
        const body = await readJsonBody(request);
        const releaseId = decodeURIComponent(governedReleaseEvaluateMatch[1]);
        const workspaceId = String(body?.workspaceId || requestUrl.searchParams.get('workspaceId') || workspace?.id || 'local-default').trim() || 'local-default';
        const tenantId = String(body?.tenantId || requestUrl.searchParams.get('tenantId') || workspace?.metadata?.tenantId || 'local').trim() || 'local';
        const policy = loadTenantGovernancePolicy(config, tenantId);
        const requiredSecretScopes = Array.isArray(body?.requiredSecretScopes)
          ? body.requiredSecretScopes
          : policy.releaseGovernance.requiredSecretScopes;
        const estimatedCostCents = Number.isInteger(body?.estimatedCostCents)
          ? body.estimatedCostCents
          : policy.releaseGovernance.releaseReplayCostCents;
        const evaluation = evaluateGovernedAction(config, {
          tenantId,
          workspaceId,
          action: 'release_replay',
          releaseId,
          requiredSecretScopes,
          estimatedCostCents,
          actorId: adminAccess.mode || 'admin',
          detail: {
            workspaceId,
            requestedBy: adminAccess.mode || 'admin'
          }
        });
        const decision = recordGovernanceReleaseDecision(config, evaluation);
        const releaseReplay = listReleaseReplayItems(config, workspaceId);
        writeJson(response, 200, {
          ok: true,
          workspaceId,
          tenantId: tenantId.toLowerCase(),
          decision,
          releaseReplay,
          governance: getGovernancePlaneSummary(config, {
            tenantId,
            releaseQueueCount: releaseReplay.queue.length,
            releaseHistoryCount: releaseReplay.history.length
          })
        });
      } catch (error) {
        writeWorkspaceError(response, error);
      }
      return;
    }

    const governedReleaseReplayMatch = requestUrl.pathname.match(/^\/api\/governance\/releases\/([^/]+)\/replay$/);
    if (governedReleaseReplayMatch && request.method === 'POST') {
      const adminAccess = await getAdminAccess();
      if (!adminAccess.ok) {
        writeUnauthorized(response, 'Admin token is required to replay a governed release artifact.');
        return;
      }

      try {
        const body = await readJsonBody(request);
        const releaseId = decodeURIComponent(governedReleaseReplayMatch[1]);
        const workspaceId = String(body?.workspaceId || requestUrl.searchParams.get('workspaceId') || workspace?.id || 'local-default').trim() || 'local-default';
        const tenantId = String(body?.tenantId || requestUrl.searchParams.get('tenantId') || workspace?.metadata?.tenantId || 'local').trim() || 'local';
        const policy = loadTenantGovernancePolicy(config, tenantId);
        const requiredSecretScopes = Array.isArray(body?.requiredSecretScopes)
          ? body.requiredSecretScopes
          : policy.releaseGovernance.requiredSecretScopes;
        const estimatedCostCents = Number.isInteger(body?.estimatedCostCents)
          ? body.estimatedCostCents
          : policy.releaseGovernance.releaseReplayCostCents;
        const evaluation = evaluateGovernedAction(config, {
          tenantId,
          workspaceId,
          action: 'release_replay',
          releaseId,
          requiredSecretScopes,
          estimatedCostCents,
          actorId: adminAccess.mode || 'admin',
          detail: {
            workspaceId,
            replayMode: 'governed'
          }
        });
        if (policy.releaseGovernance.requireApproval && body?.approved !== true) {
          evaluation.allowed = false;
          evaluation.reasons = [...new Set([...(evaluation.reasons || []), 'approval_required'])];
        }
        const decision = recordGovernanceReleaseDecision(config, evaluation);
        const releaseReplayBefore = listReleaseReplayItems(config, workspaceId);
        if (!evaluation.allowed) {
          writeJson(response, 409, {
            ok: false,
            error: 'release_governance_denied',
            workspaceId,
            tenantId: tenantId.toLowerCase(),
            decision,
            releaseReplay: releaseReplayBefore,
            governance: getGovernancePlaneSummary(config, {
              tenantId,
              releaseQueueCount: releaseReplayBefore.queue.length,
              releaseHistoryCount: releaseReplayBefore.history.length
            })
          });
          return;
        }

        for (const scope of requiredSecretScopes) {
          resolveGovernanceSecret(config, { tenantId, scope, includeValue: false });
        }

        const replay = replayReleaseReplayItem(config, {
          workspaceId,
          releaseId,
          actorId: adminAccess.mode || 'admin',
          tenantId,
          governanceDecisionId: decision.id,
          source: String(body?.source || 'parity-plus-governance').trim() || 'parity-plus-governance'
        });
        const costEntry = recordGovernanceCost(config, {
          tenantId,
          workspaceId,
          action: 'release_replay',
          costCents: estimatedCostCents,
          detail: {
            releaseId,
            governanceDecisionId: decision.id
          }
        });
        writeJson(response, 200, {
          ok: true,
          workspaceId,
          tenantId: tenantId.toLowerCase(),
          decision,
          replayed: replay.replayed,
          releaseReplay: replay.releaseReplay,
          costEntry,
          governance: getGovernancePlaneSummary(config, {
            tenantId,
            releaseQueueCount: replay.releaseReplay.queue.length,
            releaseHistoryCount: replay.releaseReplay.history.length
          })
        });
      } catch (error) {
        writeWorkspaceError(response, error);
      }
      return;
    }

    if (requestUrl.pathname === '/api/audit' && request.method === 'GET') {
      if (!(await getAdminAccess()).ok) {
        writeUnauthorized(response, 'Admin token is required to read audit trail.');
        return;
      }

      const limit = Number.parseInt(String(requestUrl.searchParams.get('limit') || '100'), 10) || 100;
      const offset = Number.parseInt(String(requestUrl.searchParams.get('offset') || '0'), 10) || 0;
      const workspaceId = String(requestUrl.searchParams.get('workspaceId') || '').trim() || null;
      const tenantId = String(requestUrl.searchParams.get('tenantId') || '').trim().toLowerCase() || null;
      const startAt = String(requestUrl.searchParams.get('startAt') || '').trim() || null;
      const endAt = String(requestUrl.searchParams.get('endAt') || '').trim() || null;
      const result = listAuditEvents(config, {
        limit,
        offset,
        workspaceId,
        tenantId,
        startAt,
        endAt
      });

      writeJson(response, 200, {
        ok: true,
        ...result,
        count: result.events.length
      });
      return;
    }

    if (requestUrl.pathname === '/api/audit/export' && request.method === 'GET') {
      if (!(await getAdminAccess()).ok) {
        writeUnauthorized(response, 'Admin token is required to export audit trail.');
        return;
      }

      const format = String(requestUrl.searchParams.get('format') || 'json').trim().toLowerCase() || 'json';
      const limit = Number.parseInt(String(requestUrl.searchParams.get('limit') || '1000'), 10) || 1000;
      const offset = Number.parseInt(String(requestUrl.searchParams.get('offset') || '0'), 10) || 0;
      const workspaceId = String(requestUrl.searchParams.get('workspaceId') || '').trim() || null;
      const tenantId = String(requestUrl.searchParams.get('tenantId') || '').trim().toLowerCase() || null;
      const startAt = String(requestUrl.searchParams.get('startAt') || '').trim() || null;
      const endAt = String(requestUrl.searchParams.get('endAt') || '').trim() || null;
      const result = listAuditEvents(config, { limit, offset, workspaceId, tenantId, startAt, endAt });
      const exported = serializeAuditExport(result, format);
      response.writeHead(200, { 'content-type': exported.contentType });
      response.end(exported.body);
      return;
    }

    if (requestUrl.pathname === '/api/scheduler' && request.method === 'GET') {
      if (!(await getAdminAccess()).ok) {
        writeUnauthorized(response, 'Admin token is required to read scheduler state.');
        return;
      }

      writeJson(response, 200, {
        ok: true,
        ...scheduler.getStatus()
      });
      return;
    }

    if (requestUrl.pathname === '/api/scheduler/history' && request.method === 'GET') {
      if (!(await getAdminAccess()).ok) {
        writeUnauthorized(response, 'Admin token is required to read scheduler history.');
        return;
      }

      const limit = Number.parseInt(String(requestUrl.searchParams.get('limit') || '100'), 10) || 100;
      const offset = Number.parseInt(String(requestUrl.searchParams.get('offset') || '0'), 10) || 0;
      const trigger = String(requestUrl.searchParams.get('trigger') || '').trim() || null;
      const startAt = String(requestUrl.searchParams.get('startAt') || '').trim() || null;
      const endAt = String(requestUrl.searchParams.get('endAt') || '').trim() || null;
      const history = scheduler.getHistory({
        limit,
        offset,
        trigger,
        startAt,
        endAt
      });

      writeJson(response, 200, {
        ok: true,
        ...history,
        count: history.runs.length
      });
      return;
    }

    if (requestUrl.pathname === '/api/scheduler/trends' && request.method === 'GET') {
      if (!(await getAdminAccess()).ok) {
        writeUnauthorized(response, 'Admin token is required to read scheduler trends.');
        return;
      }

      const bucket = String(requestUrl.searchParams.get('bucket') || 'day').trim() || 'day';
      const limit = Number.parseInt(String(requestUrl.searchParams.get('limit') || '120'), 10) || 120;
      const offset = Number.parseInt(String(requestUrl.searchParams.get('offset') || '0'), 10) || 0;
      const trigger = String(requestUrl.searchParams.get('trigger') || '').trim() || null;
      const startAt = String(requestUrl.searchParams.get('startAt') || '').trim() || null;
      const endAt = String(requestUrl.searchParams.get('endAt') || '').trim() || null;
      const trends = scheduler.getTrends({
        bucket,
        limit,
        offset,
        trigger,
        startAt,
        endAt
      });

      writeJson(response, 200, {
        ok: true,
        ...trends,
        count: trends.points.length
      });
      return;
    }

    if (requestUrl.pathname === '/api/scheduler/trends/compact' && request.method === 'GET') {
      if (!(await getAdminAccess()).ok) {
        writeUnauthorized(response, 'Admin token is required to read scheduler trend cards.');
        return;
      }

      const bucket = String(requestUrl.searchParams.get('bucket') || 'day').trim() || 'day';
      const trigger = String(requestUrl.searchParams.get('trigger') || '').trim() || null;
      const startAt = String(requestUrl.searchParams.get('startAt') || '').trim() || null;
      const endAt = String(requestUrl.searchParams.get('endAt') || '').trim() || null;
      const compact = scheduler.getTrendsCompact({
        bucket,
        trigger,
        startAt,
        endAt
      });

      writeJson(response, 200, {
        ok: true,
        ...compact
      });
      return;
    }

    if (requestUrl.pathname === '/api/control-plane/summary' && request.method === 'GET') {
      if (!(await getAdminAccess()).ok) {
        writeUnauthorized(response, 'Admin token is required to read control plane summary.');
        return;
      }

      const bucket = String(requestUrl.searchParams.get('bucket') || 'day').trim() || 'day';
      const trigger = String(requestUrl.searchParams.get('trigger') || '').trim() || null;
      const startAt = String(requestUrl.searchParams.get('startAt') || '').trim() || null;
      const endAt = String(requestUrl.searchParams.get('endAt') || '').trim() || null;

      const schedulerStatus = scheduler.getStatus();
      const schedulerTrendCard = scheduler.getTrendsCompact({
        bucket,
        trigger,
        startAt,
        endAt
      });
      const workspaceState = listWorkspaces(config);
      const sessions = listSessions(config);
      const snapshotCountByWorkspace = countSnapshotsByWorkspace(config);
      const governance = getGovernanceSummary(config, {
        workspaceCount: workspaceState.workspaces.length,
        sessionCount: sessions.length,
        snapshotCountByWorkspace
      });

      writeJson(response, 200, {
        ok: true,
        scheduler: {
          controller: schedulerStatus.controller,
          state: schedulerStatus.state,
          policy: schedulerStatus.policy,
          trendCard: schedulerTrendCard
        },
        workspaces: {
          currentWorkspaceId: workspaceState.currentWorkspaceId,
          total: workspaceState.workspaces.length,
          running: workspaceState.workspaces.filter(item => item.status === 'running').length,
          ready: workspaceState.workspaces.filter(item => item.status === 'ready').length,
          stopped: workspaceState.workspaces.filter(item => item.status === 'stopped').length,
          error: workspaceState.workspaces.filter(item => item.status === 'error').length
        },
        sessions: {
          open: sessions.length
        },
        collaboration: getCollaborationStatus(config, workspaceState.currentWorkspaceId || getDefaultWorkspace().id).summary,
        fleet: getFleetStatus(config, workspaceState.currentWorkspaceId || getDefaultWorkspace().id).summary,
        prebuild: getPrebuildStatus(config, workspaceState.currentWorkspaceId || getDefaultWorkspace().id).summary,
        governance,
        governancePlane: getGovernancePlaneSummary(config, {
          tenantId: workspaceState.workspaces[0]?.metadata?.tenantId || 'local',
          releaseQueueCount: getIntegrationStatus(config, workspaceState.currentWorkspaceId || getDefaultWorkspace().id).releaseReplay?.queue?.length || 0,
          releaseHistoryCount: getIntegrationStatus(config, workspaceState.currentWorkspaceId || getDefaultWorkspace().id).releaseReplay?.history?.length || 0
        }),
        ops: getOpsStatus(config, workspaceState.currentWorkspaceId || getDefaultWorkspace().id).summary,
        postParityOps: getPostParityOpsSummary(config),
        parityPlusFinalGate: getParityPlusFinalGateSummary(config)
      });
      return;
    }

    if (requestUrl.pathname === '/api/control-plane/catalog' && request.method === 'GET') {
      if (!(await getAdminAccess()).ok) {
        writeUnauthorized(response, 'Admin token is required to read control plane catalog.');
        return;
      }

      writeJson(response, 200, {
        ok: true,
        catalog: getControlPlaneCatalog(config)
      });
      return;
    }

    if (requestUrl.pathname === '/api/control-plane/tenants' && request.method === 'GET') {
      if (!(await getAdminAccess()).ok) {
        writeUnauthorized(response, 'Admin token is required to read control plane tenant summary.');
        return;
      }

      const workspaceState = listWorkspaces(config);
      const sessions = listSessions(config);
      writeJson(response, 200, {
        ok: true,
        ...summarizeTenantAccess(workspaceState.workspaces, sessions)
      });
      return;
    }


    if (requestUrl.pathname === '/api/providers/catalog' && request.method === 'GET') {
      const tenantId = String(requestUrl.searchParams.get('tenantId') || extractTenantId(request) || 'local').trim().toLowerCase() || 'local';
      const auth = await requireAdminOrSession(config, request, { tenantId });
      if (!auth.ok) {
        writeUnauthorized(response, 'A valid admin or workspace session token is required to inspect provider catalog.');
        return;
      }
      writeJson(response, 200, {
        ok: true,
        auth: summarizeAuthContext(auth),
        workspaceId: String(requestUrl.searchParams.get('workspaceId') || auth.session?.workspaceId || 'local-default').trim() || 'local-default',
        tenantId,
        catalog: getProviderCatalog(),
        roleCatalog: getBindingRoleCatalog()
      });
      return;
    }


    if (requestUrl.pathname === '/api/providers' && request.method === 'GET') {
      const tenantId = String(requestUrl.searchParams.get('tenantId') || extractTenantId(request) || 'local').trim().toLowerCase() || 'local';
      const auth = await requireAdminOrSession(config, request, { tenantId });
      if (!auth.ok) {
        writeUnauthorized(response, 'A valid admin or workspace session token is required to inspect provider profiles.');
        return;
      }
      writeJson(response, 200, {
        ok: true,
        auth: summarizeAuthContext(auth),
        ...listProviderProfiles(config, { tenantId, provider: requestUrl.searchParams.get('provider') || '' })
      });
      return;
    }

    if (requestUrl.pathname === '/api/providers' && request.method === 'POST') {
      const tenantId = String(extractTenantId(request) || 'local').trim().toLowerCase() || 'local';
      const auth = await requireAdminOrSession(config, request, { tenantId });
      if (!auth.ok) {
        writeUnauthorized(response, 'A valid admin or workspace session token is required to create provider profiles.');
        return;
      }
      try {
        const body = await readJsonBody(request);
        const result = saveProviderProfile(config, {
          tenantId,
          provider: body.provider,
          alias: body.alias,
          description: body.description,
          unlockSecret: body.unlockSecret,
          secretPayload: body.secretPayload,
          scopesSummary: body.scopesSummary,
          capabilities: body.capabilities,
          actorType: auth.mode,
          actorId: getAuthActorId(auth),
          workspaceId: body.workspaceId || null,
          source: 'bridge-provider-center'
        });
        writeJson(response, 201, { ok: true, ...result });
      } catch (error) {
        writeWorkspaceError(response, error);
      }
      return;
    }

    if (requestUrl.pathname.startsWith('/api/providers/') && requestUrl.pathname.split('/').filter(Boolean).length >= 3) {
      const segments = requestUrl.pathname.split('/').filter(Boolean);
      const profileId = segments[2] || null;
      const action = segments[3] || null;
      const profile = getProviderProfile(config, profileId, { tenantId: extractTenantId(request) || 'local' }) || getProviderProfile(config, profileId, {});
      if (!profile) {
        writeJson(response, 404, { ok: false, error: 'provider_profile_not_found', profileId });
        return;
      }
      const auth = await requireAdminOrSession(config, request, { tenantId: profile.tenantId });
      if (!auth.ok) {
        writeUnauthorized(response, 'A valid admin or workspace session token is required for provider profile access.');
        return;
      }
      if (request.method === 'GET' && !action) {
        writeJson(response, 200, { ok: true, profile });
        return;
      }
      if ((request.method === 'PUT' || request.method === 'POST') && !action) {
        try {
          const body = await readJsonBody(request);
          const result = saveProviderProfile(config, {
            profileId,
            tenantId: profile.tenantId,
            provider: body.provider || profile.provider,
            alias: body.alias || profile.alias,
            description: body.description ?? profile.description,
            unlockSecret: body.unlockSecret,
            secretPayload: body.secretPayload,
            scopesSummary: body.scopesSummary || profile.scopesSummary,
            capabilities: body.capabilities || profile.capabilities,
            actorType: auth.mode,
            actorId: getAuthActorId(auth),
            workspaceId: body.workspaceId || auth.session?.workspaceId || null,
            source: 'bridge-provider-center-update'
          });
          writeJson(response, 200, { ok: true, ...result });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }
      if (request.method === 'DELETE' && !action) {
        try {
          const result = deleteProviderProfile(config, {
            profileId,
            tenantId: profile.tenantId,
            actorType: auth.mode,
            actorId: getAuthActorId(auth),
            workspaceId: auth.session?.workspaceId || null
          });
          writeJson(response, 200, result);
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }
      if (request.method === 'POST' && action === 'unlock') {
        if (!auth.session?.id) {
          writeForbidden(response, 'A workspace session token is required to unlock provider credentials.');
          return;
        }
        try {
          const body = await readJsonBody(request);
          const result = unlockProviderProfileForSession(config, {
            sessionId: auth.session.id,
            profileId,
            tenantId: profile.tenantId,
            workspaceId: body.workspaceId || auth.session.workspaceId || null,
            unlockSecret: body.unlockSecret,
            ttlMs: body.ttlMs,
            actorType: auth.mode,
            actorId: getAuthActorId(auth)
          });
          writeJson(response, 200, result);
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }
      if (request.method === 'POST' && action === 'lock') {
        if (!auth.session?.id) {
          writeForbidden(response, 'A workspace session token is required to lock provider credentials.');
          return;
        }
        try {
          const result = lockProviderProfilesForSession(config, {
            sessionId: auth.session.id,
            profileId,
            tenantId: profile.tenantId,
            workspaceId: auth.session.workspaceId || null,
            actorType: auth.mode,
            actorId: getAuthActorId(auth)
          });
          writeJson(response, 200, result);
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }
      if (request.method === 'POST' && action === 'test') {
        try {
          const body = await readJsonBody(request);
          let result = null;
          if (auth.session?.id && getSessionProviderUnlockState(config, { sessionId: auth.session.id }).profiles.find(item => item.profileId === profileId)) {
            const unlocked = getUnlockedProviderProfileForSession(config, {
              sessionId: auth.session.id,
              profileId
            });
            if (!unlocked) {
              writeJson(response, 409, { ok: false, error: 'requires_unlock', profileId, detail: 'Unlock the provider session or pass unlockSecret for a one-off test.' });
              return;
            }
            result = {
              profile,
              result: await testProviderConnection(profile, unlocked.payload, {
                workspaceId: body.workspaceId || auth.session.workspaceId || 'local-default',
                tenantId: profile.tenantId,
                capability: body.capability || null,
                bindingRole: body.bindingRole || null,
                action: body.action || 'provider_test',
                timeoutMs: body.timeoutMs || null
              })
            };
          } else if (body.unlockSecret) {
            result = await testDecryptedProviderProfile(config, {
              profileId,
              tenantId: profile.tenantId,
              workspaceId: body.workspaceId || auth.session?.workspaceId || null,
              unlockSecret: body.unlockSecret,
              capability: body.capability,
              action: body.action || 'provider_test',
              timeoutMs: body.timeoutMs || null,
              actorType: auth.mode,
              actorId: getAuthActorId(auth)
            });
          } else {
            writeJson(response, 409, { ok: false, error: 'requires_unlock', profileId, detail: 'Unlock the provider session or pass unlockSecret for a one-off test.' });
            return;
          }
          writeJson(response, result?.result?.ok === false ? 424 : 200, { ok: true, ...result });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }
      if (request.method === 'POST' && action === 'discovery') {
        try {
          const body = await readJsonBody(request);
          let payload = null;
          if (auth.session?.id && getSessionProviderUnlockState(config, { sessionId: auth.session.id }).profiles.find(item => item.profileId === profileId)) {
            const unlocked = getUnlockedProviderProfileForSession(config, { sessionId: auth.session.id, profileId });
            if (!unlocked) {
              writeJson(response, 409, { ok: false, error: 'requires_unlock', profileId, detail: 'Unlock the provider session or pass unlockSecret for provider discovery.' });
              return;
            }
            payload = unlocked.payload;
          } else if (body.unlockSecret) {
            const decrypted = decryptProviderProfile(config, { profileId, tenantId: profile.tenantId, unlockSecret: body.unlockSecret });
            payload = decrypted.payload;
          } else {
            writeJson(response, 409, { ok: false, error: 'requires_unlock', profileId, detail: 'Unlock the provider session or pass unlockSecret for provider discovery.' });
            return;
          }
          const result = await discoverProviderResources(profile, payload, {
            workspaceId: body.workspaceId || auth.session?.workspaceId || 'local-default',
            tenantId: profile.tenantId,
            action: body.action || 'provider_discovery',
            timeoutMs: body.timeoutMs || null
          });
          writeJson(response, result?.ok === false ? 424 : 200, { ok: true, profile, result, suggestions: buildProviderBindingSuggestions(profile, { payload }) });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }
    }

    if (requestUrl.pathname === '/api/founder-lanes' && request.method === 'GET') {
      const tenantId = String(requestUrl.searchParams.get('tenantId') || extractTenantId(request) || 'local').trim().toLowerCase() || 'local';
      const workspaceId = String(requestUrl.searchParams.get('workspaceId') || workspace?.id || authWorkspaceId() || '').trim() || null;
      const auth = await requireAdminOrSession(config, request, { tenantId, workspaceId: workspaceId || undefined });
      if (!auth.ok) {
        writeUnauthorized(response, 'A valid admin or workspace session token is required to inspect founder-lane declarations.');
        return;
      }
      const action = String(requestUrl.searchParams.get('action') || 'provider_runtime_execution').trim().toLowerCase() || 'provider_runtime_execution';
      writeJson(response, 200, {
        ok: true,
        auth: summarizeAuthContext(auth),
        founderLane: getFounderLaneDeclaration(config, { tenantId, workspaceId, action })
      });
      return;
    }

    if (requestUrl.pathname === '/api/governance-secret-migration/candidates' && request.method === 'GET') {
      const tenantId = String(requestUrl.searchParams.get('tenantId') || extractTenantId(request) || 'local').trim().toLowerCase() || 'local';
      const auth = await requireAdminOrSession(config, request, { tenantId });
      if (!auth.ok) {
        writeUnauthorized(response, 'A valid admin or workspace session token is required to inspect governance secret migration candidates.');
        return;
      }
      writeJson(response, 200, {
        ok: true,
        auth: summarizeAuthContext(auth),
        tenantId,
        ...listGovernanceSecretMigrationCandidates(config, { tenantId })
      });
      return;
    }

    if (requestUrl.pathname === '/api/governance-secret-migration/mark-founder' && request.method === 'POST') {
      const tenantId = String(extractTenantId(request) || 'local').trim().toLowerCase() || 'local';
      const auth = await requireAdminOrSession(config, request, { tenantId });
      if (!auth.ok) {
        writeUnauthorized(response, 'A valid admin or workspace session token is required to mark governance secrets as founder-managed.');
        return;
      }
      try {
        const body = await readJsonBody(request);
        const result = markGovernanceSecretsFounderManaged(config, {
          tenantId,
          scope: body.scope,
          workspaceId: body.workspaceId || auth.session?.workspaceId || null,
          actorType: auth.mode,
          actorId: getAuthActorId(auth)
        });
        writeJson(response, 200, result);
      } catch (error) {
        writeWorkspaceError(response, error);
      }
      return;
    }

    if (requestUrl.pathname === '/api/governance-secret-migration/migrate' && request.method === 'POST') {
      const tenantId = String(extractTenantId(request) || 'local').trim().toLowerCase() || 'local';
      const auth = await requireAdminOrSession(config, request, { tenantId });
      if (!auth.ok) {
        writeUnauthorized(response, 'A valid admin or workspace session token is required to migrate governance secrets into the provider vault.');
        return;
      }
      try {
        const body = await readJsonBody(request);
        const result = migrateGovernanceSecretScopeToProviderProfile(config, {
          tenantId,
          scope: body.scope,
          provider: body.provider || null,
          alias: body.alias || null,
          description: body.description || null,
          unlockSecret: body.unlockSecret,
          stripSourceValues: body.stripSourceValues !== false,
          workspaceId: body.workspaceId || auth.session?.workspaceId || null,
          actorType: auth.mode,
          actorId: getAuthActorId(auth)
        });
        writeJson(response, 200, result);
      } catch (error) {
        writeWorkspaceError(response, error);
      }
      return;
    }


    if (requestUrl.pathname === '/api/integrations/status' && request.method === 'GET') {
      const workspaceId = String(requestUrl.searchParams.get('workspaceId') || workspace?.id || 'local-default').trim() || 'local-default';
      const auth = await requireAdminOrSession(config, request, {
        workspaceId,
        tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
      });
      if (!auth.ok) {
        writeUnauthorized(response, 'A valid admin or workspace session token is required to inspect integration status.');
        return;
      }

      writeJson(response, 200, {
        ok: true,
        auth: summarizeAuthContext(auth),
        integrationStatus: {
          ...getIntegrationStatus(config, workspaceId),
          collaboration: getCollaborationStatus(config, workspaceId).summary,
          fleet: getFleetStatus(config, workspaceId).summary,
          prebuild: getPrebuildStatus(config, workspaceId).summary,
          ops: getOpsStatus(config, workspaceId).summary,
          governance: getGovernancePlaneSummary(config, {
            tenantId: auth.tenantId || workspace?.metadata?.tenantId || 'local',
            releaseQueueCount: getIntegrationStatus(config, workspaceId).releaseReplay?.queue?.length || 0,
            releaseHistoryCount: getIntegrationStatus(config, workspaceId).releaseReplay?.history?.length || 0
          }),
          postParityOps: getPostParityOpsSummary(config),
          parityPlusFinalGate: getParityPlusFinalGateSummary(config)
        }
      });
      return;
    }


    if (requestUrl.pathname === '/api/proof/post-parity-ops-plane' && request.method === 'GET') {
      writeJson(response, 200, {
        ok: true,
        postParityOps: getPostParityOpsPayload(config)
      });
      return;
    }

    if (requestUrl.pathname === '/api/proof/parity-plus-final-gate' && request.method === 'GET') {
      writeJson(response, 200, {
        ok: true,
        parityPlusFinalGate: getParityPlusFinalGatePayload(config)
      });
      return;
    }

    if (requestUrl.pathname === '/ops-center' && request.method === 'GET') {
      const workspaceId = String(requestUrl.searchParams.get('workspaceId') || workspace?.id || 'local-default').trim() || 'local-default';
      writeHtml(response, 200, buildOpsCenterHtml(config, workspaceId));
      return;
    }

    if (requestUrl.pathname === '/ai-patch-center' && request.method === 'GET') {
      const workspaceId = String(requestUrl.searchParams.get('workspaceId') || workspace?.id || 'local-default').trim() || 'local-default';
      writeHtml(response, 200, buildAiPatchCenterHtml(config, workspaceId));
      return;
    }


    if (requestUrl.pathname === '/provider-center' && request.method === 'GET') {
      const workspaceId = String(requestUrl.searchParams.get('workspaceId') || workspace?.id || 'local-default').trim() || 'local-default';
      const tenantId = String(requestUrl.searchParams.get('tenantId') || workspace?.metadata?.tenantId || 'local').trim().toLowerCase() || 'local';
      const auth = await requireAdminOrSession(config, request, { workspaceId, tenantId });
      if (!auth.ok) {
        writeUnauthorized(response, 'A valid admin or workspace session token is required to inspect provider center.');
        return;
      }
      writeHtml(response, 200, buildProviderCenterHtml(config, workspaceId, tenantId, auth.session?.id || null));
      return;
    }

    if (requestUrl.pathname === '/storage-center' && request.method === 'GET') {
      const workspaceId = String(requestUrl.searchParams.get('workspaceId') || workspace?.id || 'local-default').trim() || 'local-default';
      const tenantId = String(requestUrl.searchParams.get('tenantId') || workspace?.metadata?.tenantId || 'local').trim().toLowerCase() || 'local';
      const auth = await requireAdminOrSession(config, request, { workspaceId, tenantId });
      if (!auth.ok) {
        writeUnauthorized(response, 'A valid admin or workspace session token is required to inspect storage center.');
        return;
      }
      writeHtml(response, 200, buildStorageCenterHtml(config, workspaceId, tenantId));
      return;
    }

    if (requestUrl.pathname === '/deployment-center' && request.method === 'GET') {
      const workspaceId = String(requestUrl.searchParams.get('workspaceId') || workspace?.id || 'local-default').trim() || 'local-default';
      const tenantId = String(requestUrl.searchParams.get('tenantId') || workspace?.metadata?.tenantId || 'local').trim().toLowerCase() || 'local';
      const auth = await requireAdminOrSession(config, request, { workspaceId, tenantId });
      if (!auth.ok) {
        writeUnauthorized(response, 'A valid admin or workspace session token is required to inspect deployment center.');
        return;
      }
      writeHtml(response, 200, buildDeploymentCenterHtml(config, workspaceId, tenantId));
      return;
    }

    if (requestUrl.pathname === '/workspace-center' && request.method === 'GET') {
      const workspaceId = String(requestUrl.searchParams.get('workspaceId') || workspace?.id || 'local-default').trim() || 'local-default';
      writeHtml(response, 200, buildWorkspaceCenterHtml(config, publicUrls, workspaceId));
      return;
    }

    if (requestUrl.pathname === '/runtime-center' && request.method === 'GET') {
      const workspaceId = String(requestUrl.searchParams.get('workspaceId') || workspace?.id || 'local-default').trim() || 'local-default';
      writeHtml(response, 200, buildRuntimeCenterHtml(config, workspaceId));
      return;
    }

    if (requestUrl.pathname === '/gate-center' && request.method === 'GET') {
      const workspaceId = String(requestUrl.searchParams.get('workspaceId') || workspace?.id || 'local-default').trim() || 'local-default';
      writeHtml(response, 200, buildGateCenterHtml(config, workspaceId));
      return;
    }

    if (requestUrl.pathname === '/file-center' && request.method === 'GET') {
      const workspaceId = String(requestUrl.searchParams.get('workspaceId') || workspace?.id || 'local-default').trim() || 'local-default';
      writeHtml(response, 200, buildFileCenterHtml(config, workspaceId));
      return;
    }

    if (requestUrl.pathname === '/api/collaboration/presence' && request.method === 'GET') {
      const workspaceId = String(requestUrl.searchParams.get('workspaceId') || workspace?.id || 'local-default').trim() || 'local-default';
      const auth = await requireAdminOrSession(config, request, {
        workspaceId,
        tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
      });
      if (!auth.ok) {
        writeUnauthorized(response, 'A valid admin or workspace session token is required to inspect collaboration presence.');
        return;
      }

      writeJson(response, 200, {
        ok: true,
        auth: summarizeAuthContext(auth),
        collaboration: getCollaborationStatus(config, workspaceId)
      });
      return;
    }

    if (requestUrl.pathname === '/api/collaboration/presence/join' && request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const workspaceId = String(body.workspaceId || workspace?.id || 'local-default').trim() || 'local-default';
        const auth = await requireAdminOrSession(config, request, {
          workspaceId,
          tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
        });
        if (!auth.ok) {
          writeUnauthorized(response, 'A valid admin or workspace session token is required to join collaboration presence.');
          return;
        }

        const operatorId = String(body.operatorId || getAuthActorId(auth)).trim() || getAuthActorId(auth);
        const displayName = String(body.displayName || body.operatorName || operatorId).trim() || operatorId;
        const result = joinPresence(config, {
          workspaceId,
          tenantId: auth.tenantId || extractTenantId(request),
          operatorId,
          displayName,
          channel: body.channel,
          activeFile: body.activeFile,
          authMode: auth.mode
        });

        writeJson(response, 200, {
          ok: true,
          auth: summarizeAuthContext(auth),
          ...result
        });
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          error: 'collaboration_presence_join_failed',
          detail: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    }

    const collaborationHeartbeatMatch = requestUrl.pathname.match(/^\/api\/collaboration\/presence\/([^/]+)\/heartbeat$/);
    if (collaborationHeartbeatMatch && request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const workspaceId = String(body.workspaceId || workspace?.id || 'local-default').trim() || 'local-default';
        const auth = await requireAdminOrSession(config, request, {
          workspaceId,
          tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
        });
        if (!auth.ok) {
          writeUnauthorized(response, 'A valid admin or workspace session token is required to heartbeat collaboration presence.');
          return;
        }

        const result = heartbeatPresence(config, {
          workspaceId,
          presenceId: decodeURIComponent(collaborationHeartbeatMatch[1]),
          operatorId: body.operatorId,
          channel: body.channel,
          activeFile: body.activeFile
        });

        writeJson(response, 200, {
          ok: true,
          auth: summarizeAuthContext(auth),
          ...result
        });
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          error: 'collaboration_presence_heartbeat_failed',
          detail: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    }

    const collaborationLeaveMatch = requestUrl.pathname.match(/^\/api\/collaboration\/presence\/([^/]+)\/leave$/);
    if (collaborationLeaveMatch && request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const workspaceId = String(body.workspaceId || workspace?.id || 'local-default').trim() || 'local-default';
        const auth = await requireAdminOrSession(config, request, {
          workspaceId,
          tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
        });
        if (!auth.ok) {
          writeUnauthorized(response, 'A valid admin or workspace session token is required to leave collaboration presence.');
          return;
        }

        const result = leavePresence(config, {
          workspaceId,
          presenceId: decodeURIComponent(collaborationLeaveMatch[1]),
          operatorId: body.operatorId,
          reason: body.reason
        });

        writeJson(response, 200, {
          ok: true,
          auth: summarizeAuthContext(auth),
          ...result
        });
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          error: 'collaboration_presence_leave_failed',
          detail: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    }

    const collaborationClaimMatch = requestUrl.pathname.match(/^\/api\/collaboration\/workspaces\/([^/]+)\/courtesy-claims$/);
    if (collaborationClaimMatch && request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const workspaceId = decodeURIComponent(collaborationClaimMatch[1]);
        const auth = await requireAdminOrSession(config, request, {
          workspaceId,
          tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
        });
        if (!auth.ok) {
          writeUnauthorized(response, 'A valid admin or workspace session token is required to set collaboration courtesy claims.');
          return;
        }

        const operatorId = String(body.operatorId || getAuthActorId(auth)).trim() || getAuthActorId(auth);
        const displayName = String(body.displayName || body.operatorName || operatorId).trim() || operatorId;
        const result = upsertCourtesyClaim(config, {
          workspaceId,
          tenantId: auth.tenantId || extractTenantId(request),
          operatorId,
          displayName,
          presenceId: body.presenceId,
          targetType: body.targetType,
          targetId: body.targetId,
          filePath: body.filePath,
          channel: body.channel,
          mode: body.mode,
          note: body.note,
          source: body.source || 'push-beyond-collaboration'
        });

        writeJson(response, 200, {
          ok: true,
          auth: summarizeAuthContext(auth),
          ...result
        });
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          error: 'collaboration_courtesy_claim_failed',
          detail: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    }

    const collaborationMutationMatch = requestUrl.pathname.match(/^\/api\/collaboration\/workspaces\/([^/]+)\/mutations$/);
    if (collaborationMutationMatch && request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const workspaceId = decodeURIComponent(collaborationMutationMatch[1]);
        const auth = await requireAdminOrSession(config, request, {
          workspaceId,
          tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
        });
        if (!auth.ok) {
          writeUnauthorized(response, 'A valid admin or workspace session token is required to record collaboration mutations.');
          return;
        }

        const operatorId = String(body.operatorId || getAuthActorId(auth)).trim() || getAuthActorId(auth);
        const displayName = String(body.displayName || body.operatorName || operatorId).trim() || operatorId;
        const result = recordCollaborationMutation(config, {
          workspaceId,
          tenantId: auth.tenantId || extractTenantId(request),
          operatorId,
          displayName,
          filePath: body.filePath,
          channel: body.channel,
          action: body.action,
          summary: body.summary,
          claimId: body.claimId
        });

        writeJson(response, 200, {
          ok: true,
          auth: summarizeAuthContext(auth),
          ...result
        });
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          error: 'collaboration_mutation_record_failed',
          detail: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    }

    const collaborationNotesMatch = requestUrl.pathname.match(/^\/api\/collaboration\/workspaces\/([^/]+)\/notes$/);
    if (collaborationNotesMatch && request.method === 'GET') {
      const workspaceId = decodeURIComponent(collaborationNotesMatch[1]);
      const auth = await requireAdminOrSession(config, request, {
        workspaceId,
        tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
      });
      if (!auth.ok) {
        writeUnauthorized(response, 'A valid admin or workspace session token is required to inspect collaboration notes.');
        return;
      }

      writeJson(response, 200, {
        ok: true,
        auth: summarizeAuthContext(auth),
        collaboration: getCollaborationStatus(config, workspaceId)
      });
      return;
    }

    if (collaborationNotesMatch && request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const workspaceId = decodeURIComponent(collaborationNotesMatch[1]);
        const auth = await requireAdminOrSession(config, request, {
          workspaceId,
          tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
        });
        if (!auth.ok) {
          writeUnauthorized(response, 'A valid admin or workspace session token is required to add collaboration notes.');
          return;
        }

        const operatorId = String(body.operatorId || getAuthActorId(auth)).trim() || getAuthActorId(auth);
        const displayName = String(body.displayName || body.operatorName || operatorId).trim() || operatorId;
        const result = addSharedNote(config, {
          workspaceId,
          tenantId: auth.tenantId || extractTenantId(request),
          operatorId,
          displayName,
          channel: body.channel,
          body: body.body,
          linkedTarget: body.linkedTarget
        });

        writeJson(response, 201, {
          ok: true,
          auth: summarizeAuthContext(auth),
          ...result
        });
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          error: 'collaboration_note_add_failed',
          detail: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    }


    if (requestUrl.pathname === '/api/fleet/status' && request.method === 'GET') {
      const workspaceId = String(requestUrl.searchParams.get('workspaceId') || workspace?.id || 'local-default').trim() || 'local-default';
      const auth = await requireAdminOrSession(config, request, {
        workspaceId,
        tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
      });
      if (!auth.ok) {
        writeUnauthorized(response, 'A valid admin or workspace session token is required to inspect fleet status.');
        return;
      }

      writeJson(response, 200, {
        ok: true,
        auth: summarizeAuthContext(auth),
        fleet: getFleetStatus(config, workspaceId)
      });
      return;
    }

    if (requestUrl.pathname === '/api/fleet/machine-profiles' && request.method === 'GET') {
      const workspaceId = String(requestUrl.searchParams.get('workspaceId') || workspace?.id || 'local-default').trim() || 'local-default';
      const auth = await requireAdminOrSession(config, request, {
        workspaceId,
        tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
      });
      if (!auth.ok) {
        writeUnauthorized(response, 'A valid admin or workspace session token is required to inspect machine profiles.');
        return;
      }

      writeJson(response, 200, {
        ok: true,
        auth: summarizeAuthContext(auth),
        machineProfiles: listMachineProfiles(config),
        fleet: getFleetStatus(config, workspaceId).summary
      });
      return;
    }

    if (requestUrl.pathname === '/api/fleet/machine-profiles' && request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const workspaceId = String(body.workspaceId || workspace?.id || 'local-default').trim() || 'local-default';
        const auth = await requireAdminOrSession(config, request, {
          workspaceId,
          tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
        });
        if (!auth.ok) {
          writeUnauthorized(response, 'A valid admin or workspace session token is required to upsert machine profiles.');
          return;
        }

        const result = upsertMachineProfile(config, {
          workspaceId,
          profileId: body.profileId,
          name: body.name,
          cpu: body.cpu,
          memoryMb: body.memoryMb,
          diskGb: body.diskGb,
          stackPreset: body.stackPreset,
          startupRecipe: body.startupRecipe,
          labels: body.labels,
          baseProfileId: body.baseProfileId,
          source: body.source || 'push-beyond-fleet',
          actorId: getAuthActorId(auth),
          tenantId: auth.tenantId
        });
        writeJson(response, 200, { ok: true, auth: summarizeAuthContext(auth), ...result });
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          error: 'fleet_machine_profile_upsert_failed',
          detail: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    }

    const fleetWorkspaceProfileMatch = requestUrl.pathname.match(/^\/api\/fleet\/workspaces\/([^/]+)\/profile$/);
    if (fleetWorkspaceProfileMatch && request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const workspaceId = decodeURIComponent(fleetWorkspaceProfileMatch[1]);
        const auth = await requireAdminOrSession(config, request, {
          workspaceId,
          tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
        });
        if (!auth.ok) {
          writeUnauthorized(response, 'A valid admin or workspace session token is required to set workspace machine profiles.');
          return;
        }

        const result = setWorkspaceMachineProfile(config, {
          workspaceId,
          profileId: body.profileId,
          startupRecipe: body.startupRecipe,
          stackPreset: body.stackPreset,
          source: body.source || 'push-beyond-fleet',
          actorId: getAuthActorId(auth),
          tenantId: auth.tenantId
        });
        writeJson(response, 200, { ok: true, auth: summarizeAuthContext(auth), ...result });
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          error: 'fleet_workspace_profile_set_failed',
          detail: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    }

    if (requestUrl.pathname === '/api/fleet/pools' && request.method === 'GET') {
      const workspaceId = String(requestUrl.searchParams.get('workspaceId') || workspace?.id || 'local-default').trim() || 'local-default';
      const auth = await requireAdminOrSession(config, request, {
        workspaceId,
        tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
      });
      if (!auth.ok) {
        writeUnauthorized(response, 'A valid admin or workspace session token is required to inspect fleet pools.');
        return;
      }

      writeJson(response, 200, {
        ok: true,
        auth: summarizeAuthContext(auth),
        pools: listFleetPools(config),
        fleet: getFleetStatus(config, workspaceId).summary
      });
      return;
    }

    if (requestUrl.pathname === '/api/fleet/pools' && request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const workspaceId = String(body.workspaceId || workspace?.id || 'local-default').trim() || 'local-default';
        const auth = await requireAdminOrSession(config, request, {
          workspaceId,
          tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
        });
        if (!auth.ok) {
          writeUnauthorized(response, 'A valid admin or workspace session token is required to upsert fleet pools.');
          return;
        }

        const result = upsertFleetPool(config, {
          workspaceId,
          poolId: body.poolId,
          label: body.label,
          region: body.region,
          driver: body.driver,
          allowedProfiles: body.allowedProfiles,
          capacity: body.capacity,
          state: body.state,
          maintenanceWindow: body.maintenanceWindow,
          startupRecipes: body.startupRecipes,
          labels: body.labels,
          actorId: getAuthActorId(auth),
          tenantId: auth.tenantId
        });
        writeJson(response, 200, { ok: true, auth: summarizeAuthContext(auth), ...result });
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          error: 'fleet_pool_upsert_failed',
          detail: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    }

    const fleetPoolStateMatch = requestUrl.pathname.match(/^\/api\/fleet\/pools\/([^/]+)\/state$/);
    if (fleetPoolStateMatch && request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const workspaceId = String(body.workspaceId || workspace?.id || 'local-default').trim() || 'local-default';
        const auth = await requireAdminOrSession(config, request, {
          workspaceId,
          tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
        });
        if (!auth.ok) {
          writeUnauthorized(response, 'A valid admin or workspace session token is required to update fleet pool state.');
          return;
        }

        const result = setFleetPoolState(config, {
          workspaceId,
          poolId: decodeURIComponent(fleetPoolStateMatch[1]),
          state: body.state,
          maintenanceWindow: body.maintenanceWindow,
          actorId: getAuthActorId(auth),
          tenantId: auth.tenantId
        });
        writeJson(response, 200, { ok: true, auth: summarizeAuthContext(auth), ...result });
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          error: 'fleet_pool_state_set_failed',
          detail: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    }

    if (requestUrl.pathname === '/api/fleet/assignments' && request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const workspaceId = String(body.workspaceId || workspace?.id || 'local-default').trim() || 'local-default';
        const auth = await requireAdminOrSession(config, request, {
          workspaceId,
          tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
        });
        if (!auth.ok) {
          writeUnauthorized(response, 'A valid admin or workspace session token is required to create fleet assignments.');
          return;
        }

        const result = assignWorkspaceToFleet(config, {
          workspaceId,
          poolId: body.poolId,
          profileId: body.profileId,
          startupRecipe: body.startupRecipe,
          stackPreset: body.stackPreset,
          source: body.source || 'push-beyond-fleet',
          actorId: getAuthActorId(auth),
          tenantId: auth.tenantId
        });
        writeJson(response, 200, { ok: true, auth: summarizeAuthContext(auth), ...result });
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          error: 'fleet_assignment_create_failed',
          detail: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    }

    const fleetReleaseMatch = requestUrl.pathname.match(/^\/api\/fleet\/workspaces\/([^/]+)\/release$/);
    if (fleetReleaseMatch && request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const workspaceId = decodeURIComponent(fleetReleaseMatch[1]);
        const auth = await requireAdminOrSession(config, request, {
          workspaceId,
          tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
        });
        if (!auth.ok) {
          writeUnauthorized(response, 'A valid admin or workspace session token is required to release fleet assignments.');
          return;
        }

        const result = releaseFleetAssignment(config, {
          workspaceId,
          actorId: getAuthActorId(auth),
          tenantId: auth.tenantId,
          reason: body.reason
        });
        writeJson(response, 200, { ok: true, auth: summarizeAuthContext(auth), ...result });
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          error: 'fleet_assignment_release_failed',
          detail: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    }


    if (requestUrl.pathname === '/api/prebuild/status' && request.method === 'GET') {
      const workspaceId = String(requestUrl.searchParams.get('workspaceId') || workspace?.id || 'local-default').trim() || 'local-default';
      const auth = await requireAdminOrSession(config, request, {
        workspaceId,
        tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
      });
      if (!auth.ok) {
        writeUnauthorized(response, 'A valid admin or workspace session token is required to inspect prebuild status.');
        return;
      }

      writeJson(response, 200, {
        ok: true,
        auth: summarizeAuthContext(auth),
        prebuild: getPrebuildStatus(config, workspaceId)
      });
      return;
    }

    if (requestUrl.pathname === '/api/prebuild/templates' && request.method === 'GET') {
      const workspaceId = String(requestUrl.searchParams.get('workspaceId') || workspace?.id || 'local-default').trim() || 'local-default';
      const auth = await requireAdminOrSession(config, request, {
        workspaceId,
        tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
      });
      if (!auth.ok) {
        writeUnauthorized(response, 'A valid admin or workspace session token is required to inspect prebuild templates.');
        return;
      }

      writeJson(response, 200, {
        ok: true,
        auth: summarizeAuthContext(auth),
        templates: listPrebuildTemplates(config),
        prebuild: getPrebuildStatus(config, workspaceId).summary
      });
      return;
    }

    if (requestUrl.pathname === '/api/prebuild/templates' && request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const workspaceId = String(body.workspaceId || workspace?.id || 'local-default').trim() || 'local-default';
        const auth = await requireAdminOrSession(config, request, {
          workspaceId,
          tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
        });
        if (!auth.ok) {
          writeUnauthorized(response, 'A valid admin or workspace session token is required to upsert prebuild templates.');
          return;
        }

        const result = upsertPrebuildTemplate(config, {
          workspaceId,
          templateId: body.templateId,
          label: body.label,
          mode: body.mode,
          profileId: body.profileId,
          startupRecipe: body.startupRecipe,
          stackPreset: body.stackPreset,
          retentionMinutes: body.retentionMinutes,
          sourceWorkspaceId: body.sourceWorkspaceId,
          sourceSnapshotId: body.sourceSnapshotId,
          labels: body.labels,
          sourcePaths: body.sourcePaths,
          source: body.source || 'push-beyond-prebuild',
          actorId: getAuthActorId(auth),
          tenantId: auth.tenantId
        });
        writeJson(response, 200, { ok: true, auth: summarizeAuthContext(auth), ...result });
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          error: 'prebuild_template_upsert_failed',
          detail: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    }

    const prebuildWorkspacePreferenceMatch = requestUrl.pathname.match(/^\/api\/prebuild\/workspaces\/([^/]+)\/preference$/);
    if (prebuildWorkspacePreferenceMatch && request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const workspaceId = decodeURIComponent(prebuildWorkspacePreferenceMatch[1]);
        const auth = await requireAdminOrSession(config, request, {
          workspaceId,
          tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
        });
        if (!auth.ok) {
          writeUnauthorized(response, 'A valid admin or workspace session token is required to set prebuild preferences.');
          return;
        }

        const result = setWorkspacePrebuildPreference(config, {
          workspaceId,
          templateId: body.templateId,
          mode: body.mode,
          preferredProfileId: body.preferredProfileId,
          hydrationPolicy: body.hydrationPolicy,
          source: body.source || 'push-beyond-prebuild',
          actorId: getAuthActorId(auth),
          tenantId: auth.tenantId
        });
        writeJson(response, 200, { ok: true, auth: summarizeAuthContext(auth), ...result });
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          error: 'prebuild_workspace_preference_set_failed',
          detail: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    }

    if (requestUrl.pathname === '/api/prebuild/jobs' && request.method === 'GET') {
      const workspaceId = String(requestUrl.searchParams.get('workspaceId') || workspace?.id || 'local-default').trim() || 'local-default';
      const auth = await requireAdminOrSession(config, request, {
        workspaceId,
        tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
      });
      if (!auth.ok) {
        writeUnauthorized(response, 'A valid admin or workspace session token is required to inspect prebuild jobs.');
        return;
      }

      writeJson(response, 200, {
        ok: true,
        auth: summarizeAuthContext(auth),
        jobs: listPrebuildJobs(config, workspaceId),
        prebuild: getPrebuildStatus(config, workspaceId).summary
      });
      return;
    }

    if (requestUrl.pathname === '/api/prebuild/jobs' && request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const workspaceId = String(body.workspaceId || workspace?.id || 'local-default').trim() || 'local-default';
        const auth = await requireAdminOrSession(config, request, {
          workspaceId,
          tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
        });
        if (!auth.ok) {
          writeUnauthorized(response, 'A valid admin or workspace session token is required to create prebuild jobs.');
          return;
        }

        const result = queuePrebuildJob(config, {
          workspaceId,
          templateId: body.templateId,
          mode: body.mode,
          profileId: body.profileId,
          startupRecipe: body.startupRecipe,
          stackPreset: body.stackPreset,
          retentionMinutes: body.retentionMinutes,
          expiresAt: body.expiresAt,
          source: body.source || 'push-beyond-prebuild',
          actorId: getAuthActorId(auth),
          tenantId: auth.tenantId
        });
        writeJson(response, 200, { ok: true, auth: summarizeAuthContext(auth), ...result });
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          error: 'prebuild_job_create_failed',
          detail: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    }

    const prebuildReplayMatch = requestUrl.pathname.match(/^\/api\/prebuild\/jobs\/([^/]+)\/replay$/);
    if (prebuildReplayMatch && request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const workspaceId = String(body.workspaceId || workspace?.id || 'local-default').trim() || 'local-default';
        const auth = await requireAdminOrSession(config, request, {
          workspaceId,
          tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
        });
        if (!auth.ok) {
          writeUnauthorized(response, 'A valid admin or workspace session token is required to replay prebuild jobs.');
          return;
        }

        const result = replayPrebuildJob(config, {
          jobId: decodeURIComponent(prebuildReplayMatch[1]),
          source: body.source || 'push-beyond-prebuild-replay',
          actorId: getAuthActorId(auth),
          tenantId: auth.tenantId
        });
        writeJson(response, 200, { ok: true, auth: summarizeAuthContext(auth), ...result });
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          error: 'prebuild_job_replay_failed',
          detail: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    }

    const prebuildHydrateMatch = requestUrl.pathname.match(/^\/api\/prebuild\/workspaces\/([^/]+)\/hydrate$/);
    if (prebuildHydrateMatch && request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const workspaceId = decodeURIComponent(prebuildHydrateMatch[1]);
        const auth = await requireAdminOrSession(config, request, {
          workspaceId,
          tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
        });
        if (!auth.ok) {
          writeUnauthorized(response, 'A valid admin or workspace session token is required to hydrate prebuild artifacts.');
          return;
        }

        const result = hydrateWorkspacePrebuild(config, {
          workspaceId,
          templateId: body.templateId,
          source: body.source || 'push-beyond-prebuild-hydrate',
          actorId: getAuthActorId(auth),
          tenantId: auth.tenantId
        });
        writeJson(response, 200, { ok: true, auth: summarizeAuthContext(auth), ...result });
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          error: 'prebuild_workspace_hydrate_failed',
          detail: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    }

    if (requestUrl.pathname === '/api/ops/status' && request.method === 'GET') {
      const workspaceId = String(requestUrl.searchParams.get('workspaceId') || workspace?.id || 'local-default').trim() || 'local-default';
      const auth = await requireAdminOrSession(config, request, {
        workspaceId,
        tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
      });
      if (!auth.ok) {
        writeUnauthorized(response, 'A valid admin or workspace session token is required to inspect ops status.');
        return;
      }

      writeJson(response, 200, {
        ok: true,
        auth: summarizeAuthContext(auth),
        ops: getOpsStatus(config, workspaceId)
      });
      return;
    }

    if (requestUrl.pathname === '/api/ops/watch-rules' && request.method === 'GET') {
      const workspaceId = String(requestUrl.searchParams.get('workspaceId') || workspace?.id || 'local-default').trim() || 'local-default';
      const auth = await requireAdminOrSession(config, request, {
        workspaceId,
        tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
      });
      if (!auth.ok) {
        writeUnauthorized(response, 'A valid admin or workspace session token is required to inspect ops watch rules.');
        return;
      }

      writeJson(response, 200, {
        ok: true,
        auth: summarizeAuthContext(auth),
        watchRules: listOpsWatchRules(config, workspaceId),
        ops: getOpsStatus(config, workspaceId).summary
      });
      return;
    }

    if (requestUrl.pathname === '/api/ops/watch-rules' && request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const workspaceId = String(body.workspaceId || workspace?.id || 'local-default').trim() || 'local-default';
        const auth = await requireAdminOrSession(config, request, {
          workspaceId,
          tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
        });
        if (!auth.ok) {
          writeUnauthorized(response, 'A valid admin or workspace session token is required to upsert ops watch rules.');
          return;
        }

        const result = upsertOpsWatchRule(config, {
          ...body,
          workspaceId,
          actorId: getAuthActorId(auth),
          tenantId: auth.tenantId
        });
        writeJson(response, 200, { ok: true, auth: summarizeAuthContext(auth), ...result, ops: getOpsStatus(config, workspaceId).summary });
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          error: 'ops_watch_rule_upsert_failed',
          detail: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    }

    if (requestUrl.pathname === '/api/ops/evaluate' && request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const workspaceId = String(body.workspaceId || workspace?.id || 'local-default').trim() || 'local-default';
        const auth = await requireAdminOrSession(config, request, {
          workspaceId,
          tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
        });
        if (!auth.ok) {
          writeUnauthorized(response, 'A valid admin or workspace session token is required to evaluate ops watch rules.');
          return;
        }

        const result = evaluateOpsWatchRules(config, {
          workspaceId,
          tenantId: auth.tenantId,
          metrics: body.metrics,
          source: body.source || 'post-parity-ops',
          actorId: getAuthActorId(auth)
        });
        writeJson(response, 200, { ok: true, auth: summarizeAuthContext(auth), ...result, ops: getOpsStatus(config, workspaceId).summary });
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          error: 'ops_evaluate_failed',
          detail: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    }

    if (requestUrl.pathname === '/api/ops/incidents' && request.method === 'GET') {
      const workspaceId = String(requestUrl.searchParams.get('workspaceId') || workspace?.id || 'local-default').trim() || 'local-default';
      const auth = await requireAdminOrSession(config, request, {
        workspaceId,
        tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
      });
      if (!auth.ok) {
        writeUnauthorized(response, 'A valid admin or workspace session token is required to inspect incidents.');
        return;
      }

      writeJson(response, 200, {
        ok: true,
        auth: summarizeAuthContext(auth),
        incidents: listOpsIncidents(config, workspaceId),
        ops: getOpsStatus(config, workspaceId).summary
      });
      return;
    }

    if (requestUrl.pathname === '/api/ops/incidents' && request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const workspaceId = String(body.workspaceId || workspace?.id || 'local-default').trim() || 'local-default';
        const auth = await requireAdminOrSession(config, request, {
          workspaceId,
          tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
        });
        if (!auth.ok) {
          writeUnauthorized(response, 'A valid admin or workspace session token is required to create incidents.');
          return;
        }

        const result = createOpsIncident(config, {
          ...body,
          workspaceId,
          actorId: getAuthActorId(auth),
          tenantId: auth.tenantId
        });
        writeJson(response, 200, { ok: true, auth: summarizeAuthContext(auth), ...result, ops: getOpsStatus(config, workspaceId).summary });
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          error: 'ops_incident_create_failed',
          detail: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    }

    const opsIncidentAckMatch = requestUrl.pathname.match(/^\/api\/ops\/incidents\/([^/]+)\/ack$/);
    if (opsIncidentAckMatch && request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const workspaceId = String(body.workspaceId || workspace?.id || 'local-default').trim() || 'local-default';
        const auth = await requireAdminOrSession(config, request, {
          workspaceId,
          tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
        });
        if (!auth.ok) {
          writeUnauthorized(response, 'A valid admin or workspace session token is required to acknowledge incidents.');
          return;
        }

        const result = acknowledgeOpsIncident(config, {
          incidentId: decodeURIComponent(opsIncidentAckMatch[1]),
          ownerId: body.ownerId || getAuthActorId(auth),
          ownerDisplayName: body.ownerDisplayName || 'Operator',
          actorId: getAuthActorId(auth)
        });
        writeJson(response, 200, { ok: true, auth: summarizeAuthContext(auth), ...result, ops: getOpsStatus(config, workspaceId).summary });
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          error: 'ops_incident_ack_failed',
          detail: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    }

    const opsIncidentResolveMatch = requestUrl.pathname.match(/^\/api\/ops\/incidents\/([^/]+)\/resolve$/);
    if (opsIncidentResolveMatch && request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const workspaceId = String(body.workspaceId || workspace?.id || 'local-default').trim() || 'local-default';
        const auth = await requireAdminOrSession(config, request, {
          workspaceId,
          tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
        });
        if (!auth.ok) {
          writeUnauthorized(response, 'A valid admin or workspace session token is required to resolve incidents.');
          return;
        }

        const result = resolveOpsIncident(config, {
          incidentId: decodeURIComponent(opsIncidentResolveMatch[1]),
          resolution: body.resolution,
          actorId: getAuthActorId(auth)
        });
        writeJson(response, 200, { ok: true, auth: summarizeAuthContext(auth), ...result, ops: getOpsStatus(config, workspaceId).summary });
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          error: 'ops_incident_resolve_failed',
          detail: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    }



    if (requestUrl.pathname === '/api/ai-patches/status' && request.method === 'GET') {
      const workspaceId = String(requestUrl.searchParams.get('workspaceId') || workspace?.id || 'local-default').trim() || 'local-default';
      const auth = await requireAdminOrSession(config, request, {
        workspaceId,
        tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
      });
      if (!auth.ok) {
        writeUnauthorized(response, 'A valid admin or workspace session token is required to inspect AI patch status.');
        return;
      }
      writeJson(response, 200, { ok: true, auth: summarizeAuthContext(auth), aiPatch: getAiPatchStatus(config, workspaceId) });
      return;
    }

    if (requestUrl.pathname === '/api/ai-patches/proposals' && request.method === 'GET') {
      const workspaceId = String(requestUrl.searchParams.get('workspaceId') || workspace?.id || 'local-default').trim() || 'local-default';
      const auth = await requireAdminOrSession(config, request, {
        workspaceId,
        tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
      });
      if (!auth.ok) {
        writeUnauthorized(response, 'A valid admin or workspace session token is required to inspect AI patch proposals.');
        return;
      }
      writeJson(response, 200, { ok: true, auth: summarizeAuthContext(auth), proposals: listAiPatchProposals(config, workspaceId), summary: getAiPatchStatus(config, workspaceId).summary });
      return;
    }

    if (requestUrl.pathname === '/api/ai-patches/proposals' && request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const workspaceId = String(body.workspaceId || workspace?.id || 'local-default').trim() || 'local-default';
        const auth = await requireAdminOrSession(config, request, {
          workspaceId,
          tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
        });
        if (!auth.ok) {
          writeUnauthorized(response, 'A valid admin or workspace session token is required to create AI patch proposals.');
          return;
        }
        const result = createAiPatchProposal(config, {
          workspaceId,
          title: body.title,
          summary: body.summary,
          operations: body.operations,
          requestedBy: getAuthActorId(auth)
        });
        writeJson(response, 201, { ok: true, auth: summarizeAuthContext(auth), ...result, aiPatch: getAiPatchStatus(config, workspaceId).summary });
      } catch (error) {
        writeJson(response, 400, { ok: false, error: 'ai_patch_proposal_failed', detail: error instanceof Error ? error.message : String(error) });
      }
      return;
    }

    const aiPatchProposalMatch = requestUrl.pathname.match(/^\/api\/ai-patches\/proposals\/([^/]+)$/);
    if (aiPatchProposalMatch && request.method === 'GET') {
      try {
        const proposal = getAiPatchProposal(config, decodeURIComponent(aiPatchProposalMatch[1]));
        const auth = await requireAdminOrSession(config, request, {
          workspaceId: proposal.workspaceId,
          tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
        });
        if (!auth.ok) {
          writeUnauthorized(response, 'A valid admin or workspace session token is required to inspect AI patch proposals.');
          return;
        }
        writeJson(response, 200, { ok: true, auth: summarizeAuthContext(auth), proposal });
      } catch (error) {
        writeJson(response, 404, { ok: false, error: 'ai_patch_proposal_not_found', detail: error instanceof Error ? error.message : String(error) });
      }
      return;
    }

    const aiPatchProposalActionMatch = requestUrl.pathname.match(/^\/api\/ai-patches\/proposals\/([^/]+)\/(apply|reject|rollback)$/);
    if (aiPatchProposalActionMatch && request.method === 'POST') {
      try {
        const proposalId = decodeURIComponent(aiPatchProposalActionMatch[1]);
        const action = decodeURIComponent(aiPatchProposalActionMatch[2]);
        const proposal = getAiPatchProposal(config, proposalId);
        const body = await readJsonBody(request);
        const auth = await requireAdminOrSession(config, request, {
          workspaceId: proposal.workspaceId,
          tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
        });
        if (!auth.ok) {
          writeUnauthorized(response, 'A valid admin or workspace session token is required to mutate AI patch proposals.');
          return;
        }
        let result;
        if (action === 'apply') {
          result = await applyAiPatchProposal(config, proposalId, { actorId: getAuthActorId(auth), note: body.note });
        } else if (action === 'reject') {
          result = rejectAiPatchProposal(config, proposalId, { actorId: getAuthActorId(auth), note: body.note });
        } else {
          result = await rollbackAiPatchProposal(config, proposalId, { actorId: getAuthActorId(auth), note: body.note });
        }
        writeJson(response, 200, { ok: true, auth: summarizeAuthContext(auth), ...result, aiPatch: getAiPatchStatus(config, proposal.workspaceId).summary });
      } catch (error) {
        writeJson(response, 400, { ok: false, error: 'ai_patch_action_failed', detail: error instanceof Error ? error.message : String(error) });
      }
      return;
    }

    if (requestUrl.pathname === '/api/integrations/github/connect' && request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const workspaceId = String(body.workspaceId || workspace?.id || 'local-default').trim() || 'local-default';
        const auth = await requireAdminOrSession(config, request, {
          workspaceId,
          tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
        });
        if (!auth.ok) {
          writeUnauthorized(response, 'A valid admin or workspace session token is required to connect GitHub.');
          return;
        }

        const result = connectGitHubIntegration(config, {
          workspaceId,
          repo: body.repo,
          branch: body.branch,
          installationId: body.installationId,
          tokenPresent: Boolean(body.tokenPresent),
          actorId: getAuthActorId(auth),
          tenantId: auth.tenantId
        });
        writeJson(response, 200, { ok: true, auth: summarizeAuthContext(auth), ...result });
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          error: 'github_connect_failed',
          detail: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    }

    if (requestUrl.pathname === '/api/integrations/github/push' && request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const workspaceId = String(body.workspaceId || workspace?.id || 'local-default').trim() || 'local-default';
        const auth = await requireAdminOrSession(config, request, {
          workspaceId,
          tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
        });
        if (!auth.ok) {
          writeUnauthorized(response, 'A valid admin or workspace session token is required to queue a GitHub push.');
          return;
        }

        const result = queueGitHubPush(config, {
          workspaceId,
          branch: body.branch,
          message: body.message,
          actorId: getAuthActorId(auth),
          tenantId: auth.tenantId
        });
        writeJson(response, 200, { ok: true, auth: summarizeAuthContext(auth), ...result });
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          error: 'github_push_failed',
          detail: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    }

    if (requestUrl.pathname === '/api/github/prs' && request.method === 'GET') {
      const workspaceId = String(requestUrl.searchParams.get('workspaceId') || workspace?.id || '').trim();
      const auth = await requireAdminOrSession(config, request, {
        workspaceId: workspaceId || workspace?.id || 'local-default',
        tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
      });
      if (!auth.ok) {
        writeUnauthorized(response, 'A valid admin or workspace session token is required to inspect pull requests.');
        return;
      }

      writeJson(response, 200, {
        ok: true,
        auth: summarizeAuthContext(auth),
        pullRequests: listPullRequests(config, {
          workspaceId,
          status: requestUrl.searchParams.get('status') || '',
          repo: requestUrl.searchParams.get('repo') || ''
        })
      });
      return;
    }

    if (requestUrl.pathname === '/api/github/prs/create' && request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const workspaceId = String(body.workspaceId || workspace?.id || 'local-default').trim() || 'local-default';
        const auth = await requireAdminOrSession(config, request, {
          workspaceId,
          tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
        });
        if (!auth.ok) {
          writeUnauthorized(response, 'A valid admin or workspace session token is required to create a pull request.');
          return;
        }

        const result = createPullRequest(config, {
          workspaceId,
          title: body.title,
          body: body.body,
          baseBranch: body.baseBranch,
          headBranch: body.headBranch,
          requestedReviewers: body.requestedReviewers,
          requiredApprovals: body.requiredApprovals,
          author: body.author || getAuthActorId(auth),
          actorId: getAuthActorId(auth),
          tenantId: auth.tenantId
        });
        writeJson(response, 200, { ok: true, auth: summarizeAuthContext(auth), ...result });
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          error: 'pull_request_create_failed',
          detail: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    }

    const pullRequestRoute = parsePullRequestRoute(requestUrl.pathname);
    if (pullRequestRoute) {
      const auth = await requireAdminOrSession(config, request, {
        workspaceId: workspace?.id || 'local-default',
        tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
      });
      if (!auth.ok) {
        writeUnauthorized(response, 'A valid admin or workspace session token is required to use the PR control plane.');
        return;
      }

      try {
        const { prId, segments } = pullRequestRoute;
        if (segments.length === 0 && request.method === 'GET') {
          const pullRequest = getPullRequest(config, prId);
          writeJson(response, 200, {
            ok: true,
            auth: summarizeAuthContext(auth),
            pullRequest,
            mergePolicy: getPullRequestMergePolicy(config, prId)
          });
          return;
        }

        if (segments.length === 1 && segments[0] === 'review-request' && request.method === 'POST') {
          const body = await readJsonBody(request);
          const result = requestPullRequestReview(config, {
            prId,
            reviewers: body.reviewers,
            actorId: getAuthActorId(auth)
          });
          writeJson(response, 200, { ok: true, auth: summarizeAuthContext(auth), ...result });
          return;
        }

        if (segments.length === 1 && segments[0] === 'comments' && request.method === 'POST') {
          const body = await readJsonBody(request);
          const result = addPullRequestComment(config, {
            prId,
            body: body.body,
            author: body.author || getAuthActorId(auth),
            actorId: getAuthActorId(auth)
          });
          writeJson(response, 200, { ok: true, auth: summarizeAuthContext(auth), ...result });
          return;
        }

        if (segments.length === 3 && segments[0] == 'comments' && segments[2] === 'resolve' && request.method === 'POST') {
          const result = resolvePullRequestComment(config, {
            prId,
            commentId: segments[1],
            author: getAuthActorId(auth),
            actorId: getAuthActorId(auth)
          });
          writeJson(response, 200, { ok: true, auth: summarizeAuthContext(auth), ...result });
          return;
        }

        if (segments.length === 1 && segments[0] === 'reviews' && request.method === 'POST') {
          const body = await readJsonBody(request);
          const result = submitPullRequestReview(config, {
            prId,
            reviewer: body.reviewer || getAuthActorId(auth),
            decision: body.decision,
            summary: body.summary,
            actorId: getAuthActorId(auth)
          });
          writeJson(response, 200, { ok: true, auth: summarizeAuthContext(auth), ...result });
          return;
        }

        if (segments.length === 1 && segments[0] === 'merge-policy' && request.method === 'GET') {
          writeJson(response, 200, {
            ok: true,
            auth: summarizeAuthContext(auth),
            mergePolicy: getPullRequestMergePolicy(config, prId)
          });
          return;
        }

        if (segments.length === 1 && segments[0] === 'merge' && request.method === 'POST') {
          const body = await readJsonBody(request);
          const result = mergePullRequest(config, {
            prId,
            author: body.author || getAuthActorId(auth),
            strategy: body.strategy,
            actorId: getAuthActorId(auth)
          });
          writeJson(response, 200, { ok: true, auth: summarizeAuthContext(auth), ...result });
          return;
        }
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          error: 'pull_request_route_failed',
          detail: error instanceof Error ? error.message : String(error)
        });
        return;
      }
    }

    if (requestUrl.pathname === '/api/scheduler/start' && request.method === 'POST') {
      if (!(await getAdminAccess()).ok) {
        writeUnauthorized(response, 'Admin token is required to start scheduler.');
        return;
      }

      writeJson(response, 200, {
        ok: true,
        action: 'scheduler_start',
        ...scheduler.start()
      });
      return;
    }

    if (requestUrl.pathname === '/api/scheduler/stop' && request.method === 'POST') {
      if (!(await getAdminAccess()).ok) {
        writeUnauthorized(response, 'Admin token is required to stop scheduler.');
        return;
      }

      writeJson(response, 200, {
        ok: true,
        action: 'scheduler_stop',
        ...scheduler.stop()
      });
      return;
    }

    if (requestUrl.pathname === '/api/scheduler/policy' && request.method === 'POST') {
      if (!(await getAdminAccess()).ok) {
        writeUnauthorized(response, 'Admin token is required to update scheduler policy.');
        return;
      }

      try {
        const body = await readJsonBody(request);
        const result = scheduler.updatePolicy({
          enabled: body.enabled,
          intervalMs: body.intervalMs,
          healthTimeoutMs: body.healthTimeoutMs,
          maxRestartsPerRun: body.maxRestartsPerRun,
          restartCooldownMs: body.restartCooldownMs,
          cleanupExpiredSessions: body.cleanupExpiredSessions,
          retentionCleanupEnabled: body.retentionCleanupEnabled,
          retentionCleanupEveryRuns: body.retentionCleanupEveryRuns,
          historyMaxEntries: body.historyMaxEntries
        });

        writeJson(response, 200, {
          ok: true,
          action: 'scheduler_policy_update',
          ...result
        });
      } catch (error) {
        writeWorkspaceError(response, error);
      }
      return;
    }

    if (requestUrl.pathname === '/api/scheduler/run' && request.method === 'POST') {
      if (!(await getAdminAccess()).ok) {
        writeUnauthorized(response, 'Admin token is required to run scheduler sweep.');
        return;
      }

      try {
        const body = await readJsonBody(request);
        const result = await scheduler.runNow({
          trigger: 'admin_api',
          workspaceId: body.workspaceId || null
        });

        writeJson(response, 200, {
          ok: true,
          action: 'scheduler_run',
          ...result
        });
      } catch (error) {
        writeWorkspaceError(response, error);
      }
      return;
    }

    if (requestUrl.pathname === '/api/snapshots/retention' && request.method === 'GET') {
      if (!(await getAdminAccess()).ok) {
        writeUnauthorized(response, 'Admin token is required to read snapshot retention policy.');
        return;
      }

      const workspaceId = String(requestUrl.searchParams.get('workspaceId') || '').trim() || null;
      try {
        const result = getSnapshotRetention(config, workspaceId);
        writeJson(response, 200, {
          ok: true,
          ...result
        });
      } catch (error) {
        writeWorkspaceError(response, error);
      }
      return;
    }

    if (requestUrl.pathname === '/api/snapshots/retention' && request.method === 'POST') {
      if (!(await getAdminAccess()).ok) {
        writeUnauthorized(response, 'Admin token is required to update snapshot retention policy.');
        return;
      }

      try {
        const body = await readJsonBody(request);
        const policy = setSnapshotRetention(config, {
          scope: body.scope,
          mode: body.mode,
          tenantId: body.tenantId,
          workspaceId: body.workspaceId,
          maxSnapshots: body.maxSnapshots,
          maxAgeDays: body.maxAgeDays
        });

        writeJson(response, 200, {
          ok: true,
          action: 'snapshot_retention_update',
          policy
        });
      } catch (error) {
        writeWorkspaceError(response, error);
      }
      return;
    }

    if (requestUrl.pathname === '/api/snapshots/retention/cleanup' && request.method === 'POST') {
      if (!(await getAdminAccess()).ok) {
        writeUnauthorized(response, 'Admin token is required to run retention cleanup.');
        return;
      }

      try {
        const body = await readJsonBody(request);
        const result = runSnapshotRetentionCleanup(config, body.workspaceId || null, {
          actorId: 'admin-retention-cleanup',
          protectSnapshotId: body.protectSnapshotId || null
        });
        writeJson(response, 200, {
          ok: true,
          action: 'snapshot_retention_cleanup',
          ...result
        });
      } catch (error) {
        writeWorkspaceError(response, error);
      }
      return;
    }

    if (requestUrl.pathname === '/api/workspaces/current' && request.method === 'GET') {
      if (!(await getAdminAccess()).ok) {
        writeUnauthorized(response, 'Admin token is required to read current workspace.');
        return;
      }

      const currentWorkspace = getCurrentWorkspace(config);
      writeJson(response, 200, {
        ok: true,
        workspace: currentWorkspace
      });
      return;
    }

    if (requestUrl.pathname === '/api/workspaces' && request.method === 'POST') {
      if (!(await getAdminAccess()).ok) {
        writeUnauthorized(response, 'Admin token is required to create workspaces.');
        return;
      }

      try {
        const body = await readJsonBody(request);
        const workspaceId = String(body.id || '').trim();
        const workspaceName = String(body.name || workspaceId || '').trim();
        if (!workspaceId) {
          throw new Error('Workspace id is required.');
        }

        const result = createWorkspace(config, workspaceId, {
          name: workspaceName || workspaceId,
          ideBaseUrl: body.ideBaseUrl,
          agentBaseUrl: body.agentBaseUrl,
          gateBaseUrl: body.gateBaseUrl,
          tenantId: body.tenantId || extractTenantId(request),
          source: body.source || 'bridge',
          repoUrl: body.repoUrl,
          templatePath: body.templatePath,
          branch: body.branch,
          machineProfile: body.machineProfile,
          secretScope: body.secretScope,
          force: Boolean(body.force)
        });

        let prebuild = null;
        if (body.prebuildTemplate) {
          const preference = setWorkspacePrebuildPreference(config, {
            workspaceId,
            templateId: body.prebuildTemplate,
            mode: body.prebuildMode || 'prebuild',
            hydrationPolicy: body.hydrationPolicy || (body.hydratePrebuild ? 'hydrate_on_create' : 'manual'),
            actorId: 'bridge-admin',
            tenantId: body.tenantId || extractTenantId(request),
            source: body.source || 'bridge'
          });
          const job = queuePrebuildJob(config, {
            workspaceId,
            templateId: body.prebuildTemplate,
            mode: body.prebuildMode || preference.preference.mode || 'prebuild',
            actorId: 'bridge-admin',
            tenantId: body.tenantId || extractTenantId(request),
            source: body.source || 'bridge'
          });
          const hydration = body.hydratePrebuild ? hydrateWorkspacePrebuild(config, {
            workspaceId,
            templateId: body.prebuildTemplate,
            actorId: 'bridge-admin',
            tenantId: body.tenantId || extractTenantId(request),
            source: body.source || 'bridge'
          }) : null;
          prebuild = { preference, job, hydration, status: getPrebuildStatus(config, workspaceId).summary };
        }

        let started = null;
        if (body.startAfterCreate) {
          started = await startWorkspace(config, workspaceId, 'bridge_start_after_create');
        }

        writeJson(response, result.created ? 201 : 200, {
          ok: true,
          created: result.created,
          workspace: started ? started.workspace : result.workspace,
          seed: result.seed || null,
          started: Boolean(started),
          prebuild,
          runtime: started ? getWorkspaceRuntime(config, workspaceId) : null
        });
      } catch (error) {
        writeWorkspaceError(response, error);
      }
      return;
    }

    if (requestUrl.pathname.startsWith('/api/workspaces/')) {
      const segments = requestUrl.pathname.split('/').filter(Boolean);
      const workspaceId = segments[2] || null;
      const action = segments[3] || null;
      const child = segments[4] || null;
      const childAction = segments[5] || null;

      if (!workspaceId) {
        writeJson(response, 400, { ok: false, error: 'workspace_id_required' });
        return;
      }

      const targetWorkspace = getWorkspace(config, workspaceId);
      if (!targetWorkspace) {
        writeJson(response, 404, { ok: false, error: 'workspace_not_found', workspaceId });
        return;
      }

      const auth = await requireAdminOrSession(config, request, {
        tenantId: targetWorkspace?.metadata?.tenantId || extractTenantId(request),
        workspaceId
      });
      if (!auth.ok) {
        writeUnauthorized(response, auth.reason || 'Access denied for workspace operation.');
        return;
      }

      try {
        assertTenantWorkspaceAccess(targetWorkspace, {
          tenantId: auth.tenantId,
          adminMode: auth.mode === 'admin',
          founderGateway: Boolean(auth.session?.founderGateway || auth.gateIdentity?.founderGateway),
          sessionWorkspaceId: auth.session?.workspaceId || null
        });
      } catch (error) {
        writeForbidden(response, error instanceof Error ? error.message : String(error));
        return;
      }

      if (request.method === 'GET' && !action) {
        const selectedWorkspace = targetWorkspace;
        writeJson(response, 200, { ok: true, workspace: selectedWorkspace });
        return;
      }

      if (request.method === 'DELETE' && !action) {
        if (auth.mode !== 'admin') {
          writeForbidden(response, `Only admin is allowed to delete workspace '${workspaceId}'.`);
          return;
        }

        try {
          const result = await deleteWorkspace(config, workspaceId, {
            deletedBy: 'bridge-admin'
          });
          writeJson(response, 200, {
            ok: true,
            action: 'workspace_delete',
            ...result
          });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (request.method === 'POST' && action === 'select') {
        try {
          const result = selectWorkspace(config, workspaceId);
          writeJson(response, 200, { ok: true, selected: true, workspace: result.workspace });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (request.method === 'POST' && action === 'start') {
        try {
          const result = await startWorkspace(config, workspaceId, 'bridge_start');
          writeJson(response, 200, { ok: true, action: 'start', workspace: result.workspace });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (request.method === 'POST' && action === 'stop') {
        try {
          const result = await stopWorkspace(config, workspaceId, 'bridge_stop');
          writeJson(response, 200, { ok: true, action: 'stop', workspace: result.workspace });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (request.method === 'GET' && action === 'runtime') {
        try {
          const runtime = getWorkspaceRuntime(config, workspaceId);
          writeJson(response, 200, {
            ok: true,
            action: 'runtime',
            workspace: runtime.workspace,
            runtime: runtime.runtime,
            state: runtime.state
          });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (request.method === 'POST' && action === 'status') {
        try {
          const body = await readJsonBody(request);
          const nextStatus = String(body.status || '').trim().toLowerCase();
          const reason = String(body.reason || 'bridge_status_update').trim() || 'bridge_status_update';
          const result = updateWorkspaceStatus(config, workspaceId, nextStatus, reason);
          writeJson(response, 200, { ok: true, action: 'status', workspace: result.workspace });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (request.method === 'GET' && action === 'ports') {
        try {
          const state = listWorkspacePorts(config, workspaceId);
          writeJson(response, 200, {
            ok: true,
            action: 'ports',
            workspace: state.workspace,
            forwardedHost: state.forwardedHost,
            forwardedPorts: state.forwardedPorts,
            previewUrls: buildWorkspacePreviewUrls(config, state.workspace, publicUrls),
            previewContract: buildWorkspacePreviewContract(config, state.workspace, publicUrls)
          });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (request.method === 'GET' && action === 'preview-contract') {
        try {
          const state = listWorkspacePorts(config, workspaceId);
          writeJson(response, 200, {
            ok: true,
            action: 'preview_contract',
            workspace: state.workspace,
            previewContract: buildWorkspacePreviewContract(config, state.workspace, publicUrls)
          });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }


      if (request.method === 'GET' && action === 'provider-bindings') {
        try {
          const state = listWorkspaceProviderBindings(config, {
            workspaceId,
            tenantId: targetWorkspace?.metadata?.tenantId || 'local'
          });
          writeJson(response, 200, {
            ok: true,
            action: 'workspace_provider_bindings_list',
            workspaceId,
            ...state,
            unlockState: auth.session?.id ? getSessionProviderUnlockState(config, { sessionId: auth.session.id }) : { unlocked: false, unlockCount: 0, profiles: [] }
          });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (request.method === 'POST' && action === 'provider-bindings') {
        try {
          const body = await readJsonBody(request);
          const result = upsertWorkspaceProviderBinding(config, {
            workspaceId,
            tenantId: targetWorkspace?.metadata?.tenantId || 'local',
            profileId: body.profileId,
            bindingRole: body.bindingRole,
            capability: body.capability,
            envTarget: body.envTarget,
            projectionMode: body.projectionMode,
            allowedActions: body.allowedActions,
            requiredCapabilities: body.requiredCapabilities,
            notes: body.notes,
            actorType: auth.mode,
            actorId: getAuthActorId(auth),
            createdBy: auth.mode === 'admin' ? 'bridge-admin' : getAuthActorId(auth)
          });
          writeJson(response, 200, { ok: true, action: 'workspace_provider_binding_upsert', ...result });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (request.method === 'POST' && action === 'provider-bootstrap') {
        try {
          const body = await readJsonBody(request);
          const tenantId = targetWorkspace?.metadata?.tenantId || 'local';
          const profile = getProviderProfile(config, body.profileId, { tenantId }) || getProviderProfile(config, body.profileId, {});
          if (!profile) {
            writeJson(response, 404, { ok: false, error: 'provider_profile_not_found', profileId: body.profileId });
            return;
          }
          let payload = null;
          if (auth.session?.id && getSessionProviderUnlockState(config, { sessionId: auth.session.id }).profiles.find(item => item.profileId === profile.profileId)) {
            const unlocked = getUnlockedProviderProfileForSession(config, { sessionId: auth.session.id, profileId: profile.profileId });
            if (unlocked) payload = unlocked.payload;
          }
          if (!payload && body.unlockSecret) {
            payload = decryptProviderProfile(config, { profileId: profile.profileId, tenantId: profile.tenantId, unlockSecret: body.unlockSecret }).payload;
          }
          if (!payload) {
            writeJson(response, 409, { ok: false, error: 'requires_unlock', profileId: profile.profileId, detail: 'Unlock the provider session or pass unlockSecret for provider bootstrap.' });
            return;
          }
          const discovery = await discoverProviderResources(profile, payload, { workspaceId, tenantId: profile.tenantId, action: 'provider_bootstrap', timeoutMs: body.timeoutMs || null });
          const suggestions = buildProviderBindingSuggestions(profile, { payload });
          const result = bootstrapWorkspaceProviderBindings(config, {
            workspaceId,
            tenantId: profile.tenantId,
            profileId: profile.profileId,
            suggestions,
            replaceExisting: body.replaceExisting,
            notes: body.notes || 'Auto-bootstrap from Provider Center discovery.',
            actorType: auth.mode,
            actorId: getAuthActorId(auth),
            createdBy: auth.mode === 'admin' ? 'bridge-admin' : getAuthActorId(auth)
          });
          writeJson(response, 200, { ok: true, action: 'workspace_provider_bootstrap', discovery, ...result });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (request.method === 'DELETE' && action === 'provider-bindings' && child) {
        try {
          const result = deleteWorkspaceProviderBinding(config, {
            workspaceId,
            bindingId: child,
            tenantId: targetWorkspace?.metadata?.tenantId || 'local',
            actorType: auth.mode,
            actorId: getAuthActorId(auth)
          });
          writeJson(response, 200, { ok: true, action: 'workspace_provider_binding_delete', ...result });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (request.method === 'GET' && action === 'provider-unlock-state') {
        writeJson(response, 200, {
          ok: true,
          action: 'workspace_provider_unlock_state',
          workspaceId,
          unlockState: auth.session?.id ? getSessionProviderUnlockState(config, { sessionId: auth.session.id }) : { unlocked: false, unlockCount: 0, profiles: [] }
        });
        return;
      }

      if (request.method === 'POST' && action === 'provider-lock') {
        if (!auth.session?.id) {
          writeForbidden(response, 'A workspace session token is required to lock provider bindings.');
          return;
        }
        try {
          const body = await readJsonBody(request);
          const result = lockProviderProfilesForSession(config, {
            sessionId: auth.session.id,
            profileId: body.profileId || null,
            tenantId: targetWorkspace?.metadata?.tenantId || 'local',
            workspaceId,
            actorType: auth.mode,
            actorId: getAuthActorId(auth)
          });
          writeJson(response, 200, { ok: true, action: 'workspace_provider_lock', ...result });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if ((request.method === 'GET' || request.method === 'POST') && (action === 'provider-projection' || action === 'provider-runtime-plan' || action === 'provider-runtime-execution')) {
        try {
          const body = request.method === 'POST' ? await readJsonBody(request) : {};
          const requestedAction = String(body.action || (action === 'provider-runtime-execution' ? 'provider_runtime_execution' : action === 'provider-runtime-plan' ? 'provider_runtime_execution' : 'provider_projection')).trim().toLowerCase() || 'provider_projection';
          const projection = resolveWorkspaceProviderProjection(config, {
            workspaceId,
            tenantId: targetWorkspace?.metadata?.tenantId || 'local',
            sessionId: auth.session?.id || null,
            unlockSecret: body.unlockSecret || null,
            profileId: body.profileId || null,
            bindingRole: body.bindingRole || null,
            capability: body.capability || null,
            includeValues: Boolean(body.includeValues),
            includeInternalBindings: action === 'provider-runtime-execution',
            actorType: auth.mode,
            actorId: getAuthActorId(auth),
            action: requestedAction
          });
          const { internalBindings = [], ...safeProjection } = projection;
          if (safeProjection.bindingMissing) {
            writeJson(response, 409, {
              ok: false,
              error: 'binding_missing',
              action,
              ...safeProjection
            });
            return;
          }
          if (safeProjection.requiresUnlock) {
            writeJson(response, 409, {
              ok: false,
              error: 'requires_unlock',
              action,
              ...safeProjection
            });
            return;
          }
          let executionResults = [];
          if (action === 'provider-runtime-execution') {
            executionResults = await Promise.all(internalBindings.map(async item => {
              const verified = await testProviderConnection({ provider: item.provider, alias: item.alias }, item.payload, {
                action: requestedAction,
                capability: item.capability,
                bindingRole: item.bindingRole,
                timeoutMs: body.timeoutMs || null
              });
              return {
                bindingId: item.bindingId,
                profileId: item.profileId,
                provider: item.provider,
                alias: item.alias,
                bindingRole: item.bindingRole,
                capability: item.capability,
                ok: verified.ok,
                mode: verified.mode,
                errors: verified.errors || [],
                projectedEnvKeys: verified.projectedEnvKeys || [],
                verification: verified.verification?.summary || null
              };
            }));
          }
          publishRuntimeEvent(config, {
            action: action === 'provider-runtime-execution' ? 'provider-runtime-execution' : 'provider-runtime-plan',
            workspaceId,
            tenantId: targetWorkspace?.metadata?.tenantId || 'local',
            lane: 'provider-runtime',
            actorType: auth.mode,
            actorId: getAuthActorId(auth),
            detail: {
              requestedAction,
              selectedLane: safeProjection.selectedLane,
              founderFallback: false,
              founderLaneDeclared: safeProjection.founderLaneDeclared,
              founderLaneAvailable: safeProjection.founderLaneAvailable,
              selectedBindingRoles: safeProjection.selectedBindingRoles,
              profiles: safeProjection.projections.map(item => ({
                provider: item.provider,
                alias: item.alias,
                bindingRole: item.bindingRole,
                capability: item.capability,
                envKeys: item.envKeys
              })),
              executionResults: executionResults.map(item => ({
                provider: item.provider,
                alias: item.alias,
                bindingRole: item.bindingRole,
                capability: item.capability,
                ok: item.ok,
                mode: item.mode
              }))
            }
          });
          const responsePayload = { ok: true, action, ...safeProjection, executionResults };
          const failedExecution = executionResults.find(item => item.ok === false);
          writeJson(response, failedExecution ? 424 : 200, responsePayload);
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (action === 'snapshots' && request.method === 'GET' && !child) {
        try {
          const state = listSnapshots(config, workspaceId);
          writeJson(response, 200, {
            ok: true,
            action: 'snapshots_list',
            workspace: state.workspace,
            count: state.snapshots.length,
            snapshots: state.snapshots
          });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (request.method === 'GET' && action === 'snapshot-retention') {
        try {
          const result = getSnapshotRetention(config, workspaceId);
          writeJson(response, 200, {
            ok: true,
            action: 'snapshot_retention_get',
            ...result
          });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (request.method === 'POST' && action === 'snapshot-retention') {
        if (auth.mode !== 'admin') {
          writeForbidden(response, `Only admin is allowed to update snapshot retention for workspace '${workspaceId}'.`);
          return;
        }

        try {
          const body = await readJsonBody(request);
          const policy = setSnapshotRetention(config, {
            scope: 'workspace',
            mode: body.mode || 'set',
            workspaceId,
            maxSnapshots: body.maxSnapshots,
            maxAgeDays: body.maxAgeDays
          });
          writeJson(response, 200, {
            ok: true,
            action: 'snapshot_retention_set',
            policy
          });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (request.method === 'POST' && action === 'snapshot-retention-cleanup') {
        try {
          const body = await readJsonBody(request);
          const result = runSnapshotRetentionCleanup(config, workspaceId, {
            actorId: auth.mode === 'admin' ? 'admin-retention-cleanup' : getAuthActorId(auth),
            protectSnapshotId: body.protectSnapshotId || null
          });
          writeJson(response, 200, {
            ok: true,
            action: 'snapshot_retention_cleanup',
            ...result
          });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (action === 'snapshots' && request.method === 'POST' && !child) {
        try {
          const body = await readJsonBody(request);
          const result = await createSnapshot(config, workspaceId, {
            label: body.label,
            restartAfter: body.restartAfter !== false,
            createdBy: getAuthActorId(auth)
          });
          writeJson(response, 201, {
            ok: true,
            action: 'snapshot_create',
            workspace: result.workspace,
            snapshot: result.snapshot
          });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (action === 'snapshots' && child && request.method === 'GET' && !childAction) {
        try {
          const result = describeSnapshot(config, workspaceId, child);
          writeJson(response, 200, {
            ok: true,
            action: 'snapshot_describe',
            workspace: result.workspace,
            snapshot: result.snapshot
          });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (action === 'snapshots' && child && childAction === 'restore' && request.method === 'POST') {
        try {
          const body = await readJsonBody(request);
          const result = await restoreSnapshot(config, workspaceId, child, {
            restartAfter: body.restartAfter !== false,
            restoredBy: getAuthActorId(auth)
          });
          writeJson(response, 200, {
            ok: true,
            action: 'snapshot_restore',
            workspace: result.workspace,
            snapshot: result.snapshot
          });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (action === 'snapshots' && child && request.method === 'DELETE' && !childAction) {
        try {
          const result = removeSnapshot(config, workspaceId, child);
          writeJson(response, 200, {
            ok: true,
            action: 'snapshot_delete',
            ...result
          });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (request.method === 'POST' && action === 'ports') {
        try {
          const body = await readJsonBody(request);
          const ports = Array.isArray(body.ports) ? body.ports : [];
          const result = setWorkspacePorts(config, workspaceId, ports, {
            forwardedHost: body.forwardedHost
          });
          writeJson(response, 200, {
            ok: true,
            action: 'ports_set',
            workspace: result.workspace
          });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (request.method === 'POST' && action === 'allow-port') {
        try {
          const body = await readJsonBody(request);
          const result = allowWorkspacePort(config, workspaceId, body.port, {
            forwardedHost: body.forwardedHost
          });
          writeJson(response, 200, {
            ok: true,
            action: 'allow-port',
            workspace: result.workspace
          });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }


      if (request.method === 'GET' && action === 'cockpit') {
        try {
          const runtime = getWorkspaceRuntime(config, workspaceId);
          const ports = listWorkspacePorts(config, workspaceId);
          const events = getWorkspaceRuntimeEventsPayload(config, workspaceId, { limit: Number.parseInt(String(requestUrl.searchParams.get('limit') || 20), 10) || 20 });
          writeJson(response, 200, {
            ok: true,
            action: 'cockpit',
            workspace: targetWorkspace,
            runtime: runtime.runtime,
            state: runtime.state,
            forwardedHost: ports.forwardedHost,
            forwardedPorts: ports.forwardedPorts,
            previewUrls: buildWorkspacePreviewUrls(config, targetWorkspace, publicUrls),
            centers: {
              workspace: `/workspace-center?workspaceId=${encodeURIComponent(workspaceId)}`,
              runtime: `/runtime-center?workspaceId=${encodeURIComponent(workspaceId)}`,
              gate: `/gate-center?workspaceId=${encodeURIComponent(workspaceId)}`,
              file: `/file-center?workspaceId=${encodeURIComponent(workspaceId)}`,
              ops: `/ops-center?workspaceId=${encodeURIComponent(workspaceId)}`,
              aiPatch: `/ai-patch-center?workspaceId=${encodeURIComponent(workspaceId)}`,
              provider: `/provider-center?workspaceId=${encodeURIComponent(workspaceId)}&tenantId=${encodeURIComponent(String(targetWorkspace?.metadata?.tenantId || 'local').trim().toLowerCase() || 'local')}`,
              storage: `/storage-center?workspaceId=${encodeURIComponent(workspaceId)}&tenantId=${encodeURIComponent(String(targetWorkspace?.metadata?.tenantId || 'local').trim().toLowerCase() || 'local')}`,
              deployment: `/deployment-center?workspaceId=${encodeURIComponent(workspaceId)}&tenantId=${encodeURIComponent(String(targetWorkspace?.metadata?.tenantId || 'local').trim().toLowerCase() || 'local')}`
            },
            events,
            secretScope: targetWorkspace?.metadata?.secretScope || null,
            providerBindings: listWorkspaceProviderBindings(config, { workspaceId, tenantId: targetWorkspace?.metadata?.tenantId || 'local' }),
            providerUnlockState: auth.session?.id ? getSessionProviderUnlockState(config, { sessionId: auth.session.id }) : { unlocked: false, unlockCount: 0, profiles: [] },
            gateRuntime: getGateRuntimeAdminSummary(config.gateRuntime)
          });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (request.method === 'GET' && action === 'runtime-events') {
        try {
          writeJson(response, 200, { ok: true, action: 'runtime_events', ...getWorkspaceRuntimeEventsPayload(config, workspaceId, { limit: requestUrl.searchParams.get('limit') || 50 }) });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (request.method === 'GET' && action === 'runtime-logs') {
        try {
          writeJson(response, 200, { ok: true, action: 'runtime_logs', ...getWorkspaceRuntimeLogs(config, workspaceId, { limit: requestUrl.searchParams.get('limit') || 200 }) });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (request.method === 'GET' && action === 'secret-scope') {
        writeJson(response, 200, { ok: true, action: 'secret_scope_get', workspaceId, secretScope: targetWorkspace?.metadata?.secretScope || null });
        return;
      }

      if (request.method === 'POST' && action === 'secret-scope') {
        try {
          const body = await readJsonBody(request);
          const requestedScope = body.action === 'clear' ? null : body.secretScope;
          const result = setWorkspaceSecretScope(config, workspaceId, requestedScope, { actorType: auth.mode === 'admin' ? 'admin' : 'operator', actorId: getAuthActorId(auth) });
          writeJson(response, 200, { ok: true, action: requestedScope ? 'secret_scope_set' : 'secret_scope_clear', workspace: result.workspace });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (action === 'files' && request.method === 'GET' && child === 'tree') {
        try {
          writeJson(response, 200, { ok: true, action: 'files_tree', workspaceId, ...listWorkspaceTree(config, workspaceId, { path: requestUrl.searchParams.get('path') || '.', depth: requestUrl.searchParams.get('depth') || 2, limit: requestUrl.searchParams.get('limit') || 200 }) });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (action === 'files' && request.method === 'GET' && child === 'summary') {
        try {
          writeJson(response, 200, { ok: true, action: 'files_summary', ...getWorkspaceAssociationSummary(config, workspaceId, { path: requestUrl.searchParams.get('path') || '.', depth: requestUrl.searchParams.get('depth') || 4, limit: requestUrl.searchParams.get('limit') || 400 }) });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (action === 'files' && request.method === 'GET' && child === 'inspect') {
        try {
          writeJson(response, 200, { ok: true, action: 'files_inspect', workspaceId, file: inspectWorkspacePath(config, workspaceId, requestUrl.searchParams.get('path') || '.') });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (action === 'files' && request.method === 'GET' && child === 'content') {
        try {
          writeJson(response, 200, { ok: true, action: 'files_content', workspaceId, file: readWorkspaceContent(config, workspaceId, requestUrl.searchParams.get('path') || '.') });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (action === 'files' && request.method === 'GET' && child === 'search') {
        try {
          writeJson(response, 200, { ok: true, action: 'files_search', workspaceId, ...searchWorkspaceFiles(config, workspaceId, requestUrl.searchParams.get('q') || requestUrl.searchParams.get('query') || '', { path: requestUrl.searchParams.get('path') || '.', limit: requestUrl.searchParams.get('limit') || 50, scanLimit: requestUrl.searchParams.get('scanLimit') || 500 }) });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (action === 'files' && request.method === 'GET' && child === 'changed') {
        try {
          writeJson(response, 200, { ok: true, action: 'files_changed', workspaceId, ...listChangedWorkspaceFiles(config, workspaceId) });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (action === 'files' && request.method === 'GET' && child === 'diff') {
        try {
          writeJson(response, 200, { ok: true, action: 'files_diff', workspaceId, ...diffWorkspaceFile(config, workspaceId, requestUrl.searchParams.get('path') || '.') });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (action === 'files' && request.method === 'GET' && child === 'download') {
        try {
          const target = getWorkspaceDownloadTarget(config, workspaceId, requestUrl.searchParams.get('path') || '.');
          response.writeHead(200, {
            'content-type': 'application/octet-stream',
            'content-length': target.size,
            'content-disposition': `attachment; filename="${target.downloadName.replaceAll('"', '')}"`
          });
          fs.createReadStream(target.targetPath).pipe(response);
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      if (request.method === 'POST' && action === 'deny-port') {
        try {
          const body = await readJsonBody(request);
          const result = denyWorkspacePort(config, workspaceId, body.port);
          writeJson(response, 200, {
            ok: true,
            action: 'deny-port',
            workspace: result.workspace
          });
        } catch (error) {
          writeWorkspaceError(response, error);
        }
        return;
      }

      writeJson(response, 405, { ok: false, error: 'workspace_method_not_allowed' });
      return;
    }


    if (requestUrl.pathname === '/api/runtime/health') {
      const auth = request.skyequantaAccess || await requireAdminOrSession(config, request, {
        workspaceId: workspace.id,
        tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
      });
      if (!auth?.ok && !auth?.mode) {
        writeUnauthorized(response, 'A valid session token is required to inspect runtime health.');
        return;
      }
      await writeRuntimeHealth(response, workspace, auth?.ok ? auth : auth);
      return;
    }

    if (requestUrl.pathname === '/api/runtime/context') {
      const auth = request.skyequantaAccess || await requireAdminOrSession(config, request, {
        workspaceId: workspace.id,
        tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
      });
      if (!auth?.ok && !auth?.mode) {
        writeUnauthorized(response, 'A valid session token is required to inspect runtime context.');
        return;
      }
      await writeRuntimeContext(response, workspace, auth?.ok ? auth : auth);
      return;
    }

    if (requestUrl.pathname === '/api/runtime/events') {
      const auth = request.skyequantaAccess || await requireAdminOrSession(config, request, {
        workspaceId: workspace.id,
        tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
      });
      if (!auth?.ok && !auth?.mode) {
        writeUnauthorized(response, 'A valid session token is required to inspect runtime events.');
        return;
      }
      writeJson(response, 200, {
        ok: true,
        workspaceId: workspace.id,
        events: listRuntimeEvents(config, { workspaceId: workspace.id, limit: 50 })
      });
      return;
    }

    if (requestUrl.pathname === '/api/runtime/sync/file-operation' && request.method === 'POST') {
      const auth = request.skyequantaAccess || await requireAdminOrSession(config, request, {
        workspaceId: workspace.id,
        tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
      });
      if (!auth?.ok && !auth?.mode) {
        writeUnauthorized(response, 'A valid session token is required to sync runtime file operations.');
        return;
      }
      await handleRuntimeSyncRequest(request, response, workspace, auth?.ok ? auth : auth, 'file-operation');
      return;
    }

    if (requestUrl.pathname === '/api/runtime/sync/preview-state' && request.method === 'POST') {
      const auth = request.skyequantaAccess || await requireAdminOrSession(config, request, {
        workspaceId: workspace.id,
        tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
      });
      if (!auth?.ok && !auth?.mode) {
        writeUnauthorized(response, 'A valid session token is required to sync runtime preview state.');
        return;
      }
      await handleRuntimeSyncRequest(request, response, workspace, auth?.ok ? auth : auth, 'preview-state');
      return;
    }

    if (requestUrl.pathname === '/api/runtime/sync/message' && request.method === 'POST') {
      const auth = request.skyequantaAccess || await requireAdminOrSession(config, request, {
        workspaceId: workspace.id,
        tenantId: workspace?.metadata?.tenantId || extractTenantId(request)
      });
      if (!auth?.ok && !auth?.mode) {
        writeUnauthorized(response, 'A valid session token is required to sync runtime messages.');
        return;
      }
      await handleRuntimeSyncRequest(request, response, workspace, auth?.ok ? auth : auth, 'message');
      return;
    }

    if (requestUrl.pathname === '/api/status') {
      await writeStatus(response, workspace);
      return;
    }

    const target = resolveTarget(requestUrl, workspace);
    if (!target) {
      writeGatewayError(response, 503, 'gate_unavailable', 'SKYEQUANTA_GATE_URL is not configured for this bridge.');
      return;
    }

    if (target.detail) {
      writeGatewayError(response, 503, target.unavailableError || 'gate_unavailable', target.detail);
      return;
    }

    if (target.denied) {
      writeGatewayError(response, 403, 'forwarded_port_forbidden', `Workspace '${workspace.id}' has not allowed this forwarded port.`);
      return;
    }


    const runtimeAuth = request.skyequantaAccess || null;
    if (workspace && target.lane) {
      if (runtimeAuth?.session) {
        recordSessionContext(config, runtimeAuth.session);
      }
      recordWorkspaceContext(config, workspace, { selected: getCurrentWorkspace(config)?.id === workspace.id });
      recordLaneHealth(config, {
        workspaceId: workspace.id,
        lane: target.lane,
        path: requestUrl.pathname,
        health: 'observed'
      });
      publishRuntimeEvent(config, {
        action: 'runtime.lane_request',
        workspaceId: workspace.id,
        tenantId: runtimeAuth?.tenantId || workspace?.metadata?.tenantId,
        lane: target.lane,
        actorType: runtimeAuth?.session ? 'client' : 'system',
        actorId: getAuthActorId(runtimeAuth || { mode: 'system' }),
        detail: {
          method: request.method,
          pathname: requestUrl.pathname
        }
      });
      if (target.lane === 'preview' && target.port) {
        const publicPath = joinPath(workspace.routes?.bridgePathPrefix || `/w/${workspace.id}`, `/p/${target.port}`);
        recordPreviewState(config, {
          workspaceId: workspace.id,
          lane: 'preview',
          port: target.port,
          publicPath,
          publicUrl: new URL(publicPath, publicUrls.ide).toString(),
          status: 'observed',
          detail: { method: request.method }
        });
      }
    }

    proxyHttpRequest(request, response, target.targetUrl, {
      ...target,
      extraHeaders: buildRuntimeProxyHeaders(workspace, runtimeAuth, target.lane)
    });
  });

  server.on('upgrade', async (request, socket, head) => {
    const incomingUrl = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
    const workspacePrefix = parseWorkspacePrefix(incomingUrl.pathname);
    const workspace = workspacePrefix ? resolveWorkspace(workspacePrefix.workspaceId) : getDefaultWorkspace();

    if (workspacePrefix && !workspace) {
      writeUpgradeResponse(socket, 404, 'Not Found', { 'content-type': 'text/plain; charset=utf-8' }, Buffer.from('workspace not found'));
      socket.end();
      return;
    }

    if (workspacePrefix) {
      const tenantId = String(workspace?.metadata?.tenantId || extractTenantId(request)).trim().toLowerCase() || 'local';
      const session = await requireSession(config, request, {
        workspaceId: workspace.id,
        tenantId
      });
      if (!session) {
        writeUpgradeResponse(socket, 401, 'Unauthorized', { 'content-type': 'text/plain; charset=utf-8' }, Buffer.from('missing workspace session token'));
        socket.end();
        return;
      }
      request.skyequantaAccess = session;
    }

    const requestUrl = new URL(incomingUrl.toString());
    if (workspacePrefix) {
      requestUrl.pathname = workspacePrefix.pathname;
    }

    if (requestUrl.pathname === '/health' || requestUrl.pathname === '/api/status' || requestUrl.pathname === '/api/runtime-contract' || requestUrl.pathname === '/api/product/identity' || requestUrl.pathname === '/api/surface-identity' || requestUrl.pathname === '/api/runtime/context' || requestUrl.pathname === '/api/runtime/health') {
      writeUpgradeResponse(socket, 404, 'Not Found', { 'content-type': 'text/plain; charset=utf-8' }, Buffer.from('not found'));
      socket.end();
      return;
    }

    const target = resolveTarget(requestUrl, workspace);
    if (!target) {
      writeUpgradeResponse(socket, 503, 'Service Unavailable', { 'content-type': 'text/plain; charset=utf-8' }, Buffer.from(`gate unavailable for mode ${config.gateRuntime.mode}`));
      socket.end();
      return;
    }

    if (target.denied) {
      writeUpgradeResponse(socket, 403, 'Forbidden', { 'content-type': 'text/plain; charset=utf-8' }, Buffer.from('forwarded port forbidden'));
      socket.end();
      return;
    }


    const runtimeAuth = request.skyequantaAccess || null;
    if (workspace && target.lane) {
      recordLaneHealth(config, {
        workspaceId: workspace.id,
        lane: target.lane,
        path: requestUrl.pathname,
        health: 'upgrade'
      });
    }

    proxyUpgradeRequest(request, socket, head, target.targetUrl, {
      ...target,
      extraHeaders: buildRuntimeProxyHeaders(workspace, runtimeAuth, target.lane)
    });
  });

  server.on('close', () => {
    scheduler.stop();
  });

  return server;
}