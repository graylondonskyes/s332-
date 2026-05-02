import type { ResolvedEnv } from './env.ts';
import type { WorkspaceHistory } from './db.ts';
import type { CapabilityModule } from './capabilities.ts';
import { buildClaimCatalog } from './readiness.ts';
import { cloneJson } from './json.ts';
import { nowIso } from './time.ts';

export type ContractRequirementMap = {
  workspace: boolean;
  project: boolean;
  apiKey: boolean;
  article: boolean;
  publishRun: boolean;
  targetUrl: boolean;
};

export type RuntimeControlContract = {
  id: string;
  moduleId: string;
  moduleTitle: string;
  routes: string[];
  smokeScripts: string[];
  requirements: ContractRequirementMap;
  presentInUi: boolean;
  status: 'ready' | 'blocked';
  blockers: string[];
};

export type ProviderValidation = {
  platform: string;
  targetUrl: string | null;
  targetMode: 'local' | 'remote' | 'missing';
  executionTruth: 'blocked' | 'local-proof-only' | 'remote-target-ready' | 'remote-proof-observed';
  requiredFields: string[];
  optionalFields: string[];
  missingFields: string[];
  route: string;
  requestUrlPattern: string;
  ready: boolean;
  blockers: string[];
  notes: string[];
};

export type RuntimeContractPack = {
  generatedAt: string;
  dbMode: string;
  liveNeonConfigured: boolean;
  controls: RuntimeControlContract[];
  providers: ProviderValidation[];
  summary: {
    controls: number;
    blockedControls: number;
    providers: number;
    remoteReadyProviders: number;
    remoteProofProviders: number;
  };
};

export type ClaimEvidenceItem = {
  claimId: string;
  moduleId: string;
  moduleTitle: string;
  claim: string;
  status: string;
  liveProofObserved: boolean;
  proofSignals: Array<{ label: string; value: number }>;
  evidenceTypes: string[];
  exportCount: number;
  jobTypes: string[];
  nextProofAction: string;
  blockers: string[];
};

export type ClaimEvidenceGraph = {
  generatedAt: string;
  workspaceId: string;
  items: ClaimEvidenceItem[];
  summary: {
    claims: number;
    liveProofClaims: number;
    blockedClaims: number;
    exportedClaims: number;
  };
};

const noWorkspaceControls = new Set(['load-purpose', 'load-walkthroughs', 'run-truth-validator', 'load-runtime-contracts', 'validate-provider-contract', 'create-workspace', 'list-workspaces']);
const workspaceOnlyControls = new Set(['create-project', 'list-projects', 'run-readiness', 'list-readiness-runs', 'load-claim-catalog', 'load-claim-evidence', 'export-contract-pack', 'load-proof-matrix', 'load-walkthrough-run', 'load-report-summary', 'generate-report-site', 'export-report-site', 'generate-proof-site', 'run-history', 'run-jobs', 'list-evidence', 'export-bundle', 'import-bundle', 'clone-bundle', 'load-strategy-scorecard', 'load-strategy-actions', 'export-strategy-pack']);
const articleControls = new Set(['run-publish-payload']);
const publishRunControls = new Set(['run-publish-execute', 'run-publish-retry']);
const targetUrlControls = new Set(['validate-provider-contract', 'run-publish-execute', 'run-publish-retry', 'run-publish-scheduled']);
const apiKeyControls = new Set(['create-auth-key', 'save-agency-settings', 'create-seat', 'create-client', 'export-invoice']);

const providerFieldMap: Record<string, { requiredFields: string[]; optionalFields: string[]; requestUrlPattern: string; route: string }> = {
  'neon-http': { requiredFields: ['targetUrl'], optionalFields: ['authToken'], requestUrlPattern: '/sql', route: 'POST /v1/targets/probe' },
  wordpress: { requiredFields: ['targetUrl'], optionalFields: ['authToken'], requestUrlPattern: '/wp-json/wp/v2/posts', route: 'POST /v1/publish/execute' },
  webflow: { requiredFields: ['targetUrl', 'collectionId'], optionalFields: ['authToken'], requestUrlPattern: '/collections/{collectionId}/items/live', route: 'POST /v1/publish/execute' },
  shopify: { requiredFields: ['targetUrl', 'blogId'], optionalFields: ['authToken'], requestUrlPattern: '/admin/api/2024-01/blogs/{blogId}/articles.json', route: 'POST /v1/publish/execute' },
  wix: { requiredFields: ['targetUrl'], optionalFields: ['authToken', 'memberId'], requestUrlPattern: '/blog/v3/draft-posts', route: 'POST /v1/publish/execute' },
  ghost: { requiredFields: ['targetUrl'], optionalFields: ['authToken', 'acceptVersion'], requestUrlPattern: '/ghost/api/admin/posts/?source=html', route: 'POST /v1/publish/execute' },
  'generic-api': { requiredFields: ['targetUrl'], optionalFields: ['authToken'], requestUrlPattern: '/custom-endpoint', route: 'POST /v1/publish/execute' }
};

function isRemoteUrl(targetUrl: string | null | undefined): boolean {
  const value = String(targetUrl || '').trim().toLowerCase();
  if (!value) return false;
  if (!value.startsWith('http')) return false;
  return !value.includes('127.0.0.1') && !value.includes('localhost') && !value.includes('.local') && !value.includes('/publisher.local/') && !value.includes('smoke.local');
}

function inferRequirements(controlId: string): ContractRequirementMap {
  const workspace = !noWorkspaceControls.has(controlId);
  const project = workspace && !workspaceOnlyControls.has(controlId);
  return {
    workspace,
    project,
    apiKey: apiKeyControls.has(controlId),
    article: articleControls.has(controlId),
    publishRun: publishRunControls.has(controlId),
    targetUrl: targetUrlControls.has(controlId)
  };
}

export function buildRuntimeContracts(env: ResolvedEnv, appHtml: string, modules: CapabilityModule[]): RuntimeContractPack {
  const controls: RuntimeControlContract[] = modules.flatMap((module) => module.controls.map((controlId) => ({
    id: controlId,
    moduleId: module.id,
    moduleTitle: module.title,
    routes: cloneJson(module.routes),
    smokeScripts: cloneJson(module.smokeScripts),
    requirements: inferRequirements(controlId),
    presentInUi: appHtml.includes(`id="${controlId}"`),
    status: appHtml.includes(`id="${controlId}"`) ? 'ready' : 'blocked',
    blockers: appHtml.includes(`id="${controlId}"`) ? [] : ['Control is missing from the shipped operator UI.']
  })));
  const providers = Object.keys(providerFieldMap).map((platform) => validateProviderContract({ platform, targetUrl: null }, modules, env, null));
  return {
    generatedAt: nowIso(),
    dbMode: env.dbMode,
    liveNeonConfigured: env.dbMode === 'neon-http' && !!env.neonSqlUrl,
    controls,
    providers,
    summary: {
      controls: controls.length,
      blockedControls: controls.filter((item) => item.status === 'blocked').length,
      providers: providers.length,
      remoteReadyProviders: providers.filter((item) => item.executionTruth === 'remote-target-ready').length,
      remoteProofProviders: providers.filter((item) => item.executionTruth === 'remote-proof-observed').length
    }
  };
}

export function validateProviderContract(input: { platform: string; targetUrl?: string | null; collectionId?: string | null; blogId?: string | null; memberId?: string | null; acceptVersion?: string | null }, modules: CapabilityModule[], env: ResolvedEnv, history: WorkspaceHistory | null): ProviderValidation {
  const platform = String(input.platform || '').trim();
  const config = providerFieldMap[platform];
  if (!config) {
    return { platform, targetUrl: input.targetUrl || null, targetMode: 'missing', executionTruth: 'blocked', requiredFields: [], optionalFields: [], missingFields: ['platform'], route: 'POST /v1/publish/execute', requestUrlPattern: '', ready: false, blockers: ['Unknown publish platform.'], notes: ['Supported platforms are neon-http, wordpress, webflow, shopify, wix, ghost, and generic-api.'] };
  }
  const targetUrl = String(input.targetUrl || '').trim() || null;
  const targetMode: ProviderValidation['targetMode'] = !targetUrl ? 'missing' : (isRemoteUrl(targetUrl) ? 'remote' : 'local');
  const fieldValues: Record<string, string | null> = { targetUrl, collectionId: input.collectionId?.trim() || null, blogId: input.blogId?.trim() || null, memberId: input.memberId?.trim() || null, acceptVersion: input.acceptVersion?.trim() || null };
  const missingFields = config.requiredFields.filter((field) => !fieldValues[field]);
  const blockers = [...(missingFields.length ? [`Missing required fields: ${missingFields.join(', ')}.`] : []), ...(!modules.some((module) => module.routes.includes(config.route)) ? ['Publish execution route is missing from the capability registry.'] : []), ...(!targetUrl ? ['targetUrl is required before execution can be treated as real.'] : [])];
  const notes: string[] = [];
  if (platform === 'wordpress' && targetMode === 'remote') notes.push('Remote WordPress execution usually also needs an auth token.');
  if (platform === 'neon-http') notes.push('Neon target validation is reachability and contract truth only. Live Neon proof still depends on running the runtime against the real Neon target.');
  if (platform === 'ghost' && !fieldValues.acceptVersion) notes.push('Ghost execution will default accept-version to v5.0 when not supplied.');
  if (env.dbMode !== 'neon-http') notes.push('This runtime is still local-memory by default, so provider validation is contract truth, not live Neon truth.');
  if (targetMode === 'local') notes.push('Local targets are valid for smoke-backed execution but do not count as live remote publish proof.');
  if (targetMode === 'remote') notes.push('Remote target is structurally valid. Live proof still depends on a successful publish run and response reconciliation.');
  const liveProofObserved = platform === 'neon-http'
    ? false
    : !!history?.publishRuns.some((item) => item.platform === platform && item.status === 'success' && isRemoteUrl(item.endpoint));
  let executionTruth: ProviderValidation['executionTruth'] = 'blocked';
  if (!missingFields.length) executionTruth = targetMode === 'remote' ? 'remote-target-ready' : 'local-proof-only';
  if (liveProofObserved) executionTruth = 'remote-proof-observed';
  return { platform, targetUrl, targetMode, executionTruth, requiredFields: cloneJson(config.requiredFields), optionalFields: cloneJson(config.optionalFields), missingFields, route: config.route, requestUrlPattern: config.requestUrlPattern, ready: blockers.length === 0, blockers, notes };
}

function moduleEvidenceTypes(moduleId: string): string[] {
  const map: Record<string, string[]> = { foundation: ['workspace_bundle'], audit: ['audit'], publishing: ['publish', 'report_site', 'proof_site'], visibility: ['visibility'], portability: ['workspace_bundle'], readiness: ['readiness_run', 'contract_pack'], strategy: ['strategy_pack'], targets: ['target_probe', 'target_probe_pack'], reporting: ['report_site', 'proof_site'], truth: ['contract_pack', 'proof_site'] };
  return map[moduleId] || [];
}

function nextProofActionForClaim(moduleId: string, liveProofObserved: boolean, blockers: string[]): string {
  if (blockers.length) return blockers[0];
  if (liveProofObserved) return 'Keep the claim live by replaying the same route and exporting fresh evidence after meaningful workspace changes.';
  if (moduleId === 'foundation') return 'Switch the runtime to a live Neon target and rerun readiness so foundation proof is no longer local-only.';
  if (moduleId === 'publishing') return 'Execute a real publish run against a remote CMS target and confirm reconciliation with the returned remote id.';
  if (moduleId === 'reporting') return 'Export a proof site after the next major workspace run so claim evidence stays buyer-facing and current.';
  if (moduleId === 'targets') return 'Run and persist real target probes for Neon and your provider targets before treating live blockers as understood.';
  return 'Generate another real workspace run through the shipped UI so this claim picks up fresh ledger evidence.';
}

export function buildClaimEvidenceGraph(env: ResolvedEnv, orgId: string, history: WorkspaceHistory, modules: CapabilityModule[]): ClaimEvidenceGraph {
  const claimCatalog = buildClaimCatalog(env, orgId, history, modules);
  const items = claimCatalog.map((claim) => {
    const evidenceTypes = moduleEvidenceTypes(claim.moduleId);
    const exports = history.evidenceExports.filter((item) => evidenceTypes.includes(item.exportType));
    const jobTypes = history.jobs.filter((item) => item.type.includes(claim.moduleId) || evidenceTypes.some((kind) => item.type.includes(kind.split('_')[0]))).map((item) => item.type);
    return { claimId: claim.id, moduleId: claim.moduleId, moduleTitle: claim.moduleTitle, claim: claim.claim, status: claim.status, liveProofObserved: claim.liveProofObserved, proofSignals: cloneJson(claim.observedSignals), evidenceTypes, exportCount: exports.length, jobTypes: Array.from(new Set(jobTypes)), nextProofAction: nextProofActionForClaim(claim.moduleId, claim.liveProofObserved, claim.blockers), blockers: cloneJson(claim.blockers) };
  });
  return { generatedAt: nowIso(), workspaceId: history.workspace.id, items, summary: { claims: items.length, liveProofClaims: items.filter((item) => item.liveProofObserved).length, blockedClaims: items.filter((item) => item.status === 'blocked').length, exportedClaims: items.filter((item) => item.exportCount > 0).length } };
}

function esc(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function renderProofSite(input: { workspaceName: string; runtime: RuntimeContractPack; claimEvidence: ClaimEvidenceGraph }): string {
  const providerRows = input.runtime.providers.map((item) => `<tr><td>${esc(item.platform)}</td><td>${esc(item.executionTruth)}</td><td>${esc(item.targetMode)}</td><td>${esc(item.requiredFields.join(', ') || 'none')}</td><td>${esc(item.blockers.join(' | ') || 'none')}</td></tr>`).join('');
  const claimCards = input.claimEvidence.items.map((item) => `<article style="padding:14px;border:1px solid #223557;border-radius:18px;background:#0f1b31;"><h3 style="margin:0 0 8px 0;">${esc(item.moduleTitle)}</h3><p style="margin:0 0 8px 0;color:#9fb3cf;">${esc(item.claim)}</p><div style="font-size:12px;color:#d6e3ff;">Status: ${esc(item.status)} · Live proof: ${item.liveProofObserved ? 'yes' : 'no'} · Exports: ${item.exportCount}</div><div style="font-size:12px;color:#9fb3cf;margin-top:8px;">Next proof action: ${esc(item.nextProofAction)}</div></article>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Skye GEO Engine Proof Site</title><style>:root{color-scheme:dark;--bg:#07111f;--panel:#0f1b31;--line:#223557;--text:#f4f7fb;--muted:#9fb3cf;}body{margin:0;background:radial-gradient(circle at top,#16274e 0%,#07111f 55%);font-family:Inter,system-ui,sans-serif;color:var(--text)}.shell{max-width:1280px;margin:0 auto;padding:24px}.hero,.card{background:rgba(10,18,34,.88);border:1px solid var(--line);border-radius:24px;padding:20px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;margin-top:16px}table{width:100%;border-collapse:collapse}td,th{padding:10px;border-top:1px solid var(--line);text-align:left;font-size:13px}p{color:var(--muted)}h1,h2,h3{margin:0 0 8px 0}</style></head><body><div class="shell"><section class="hero"><h1>Proof site · ${esc(input.workspaceName)}</h1><p>This surface is generated from the live capability graph, runtime contracts, and claim evidence ledger only. No demo claims are allowed into this export.</p><div style="font-size:13px;color:#d6e3ff;">Generated: ${esc(input.claimEvidence.generatedAt)} · Controls: ${input.runtime.summary.controls} · Claims: ${input.claimEvidence.summary.claims}</div></section><section class="grid"><article class="card"><h2>Runtime contract summary</h2><p>Live Neon configured: ${input.runtime.liveNeonConfigured ? 'yes' : 'no'} · Blocked controls: ${input.runtime.summary.blockedControls}</p><table><thead><tr><th>Provider</th><th>Execution truth</th><th>Target mode</th><th>Required fields</th><th>Blockers</th></tr></thead><tbody>${providerRows}</tbody></table></article><article class="card"><h2>Claim evidence summary</h2><p>Live-proof claims: ${input.claimEvidence.summary.liveProofClaims} · Blocked claims: ${input.claimEvidence.summary.blockedClaims} · Claims with exports: ${input.claimEvidence.summary.exportedClaims}</p><div class="grid">${claimCards}</div></article></section></div></body></html>`;
}
