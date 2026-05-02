import type { ResolvedEnv } from './env.ts';
import type { EvidenceExportRecord, WorkspaceHistory } from './db.ts';
import { getCapabilityRegistry, type CapabilityModule } from './capabilities.ts';
import { cloneJson } from './json.ts';
import { buildProofMatrix, buildWalkthroughRun, type ModuleProgressStatus, type ProofMatrixModule, type WalkthroughRunModule } from './reporting.ts';
import { nowIso } from './time.ts';

export type ReadinessCheckStatus = 'ready' | 'warning' | 'blocked';
export type ActivationStatus = 'proved' | 'active' | 'conditional' | 'blocked';

export type ReadinessCheck = {
  id: string;
  label: string;
  status: ReadinessCheckStatus;
  detail: string;
};

export type ActivationModule = {
  id: string;
  title: string;
  audience: string;
  status: ActivationStatus;
  proofStatus: ModuleProgressStatus;
  walkthroughStatus: ModuleProgressStatus;
  routes: string[];
  controls: string[];
  smokeScripts: string[];
  localProofObserved: boolean;
  liveProofObserved: boolean;
  blockers: string[];
  notes: string[];
};

export type ReadinessRun = {
  generatedAt: string;
  workspaceId: string;
  dbMode: string;
  checks: ReadinessCheck[];
  modules: ActivationModule[];
  summary: {
    modules: number;
    proved: number;
    active: number;
    conditional: number;
    blocked: number;
    readyChecks: number;
    warningChecks: number;
    blockedChecks: number;
  };
};

export type ClaimCatalogItem = {
  id: string;
  moduleId: string;
  moduleTitle: string;
  audience: string;
  claim: string;
  purpose: string;
  status: ActivationStatus;
  proofStatus: ModuleProgressStatus;
  liveProofObserved: boolean;
  routes: string[];
  controls: string[];
  smokeScripts: string[];
  proofPoints: string[];
  observedSignals: Array<{ label: string; value: number }>;
  blockers: string[];
  notes: string[];
};

export type ContractPack = {
  generatedAt: string;
  workspaceId: string;
  purposeSummary: string;
  readiness: ReadinessRun;
  claimCatalog: ClaimCatalogItem[];
  proofSummary: {
    modules: number;
    complete: number;
    partial: number;
    pending: number;
    smokeScripts: number;
  };
  walkthroughSummary: {
    modules: number;
    complete: number;
    partial: number;
    pending: number;
  };
};

function isRemoteEndpoint(url: string | null | undefined): boolean {
  const value = String(url || '').trim().toLowerCase();
  if (!value) return false;
  return value.startsWith('http') && !value.includes('localhost') && !value.includes('.local') && !value.includes('/publisher.local/');
}

function latestByType(history: WorkspaceHistory, exportType: string): EvidenceExportRecord | null {
  return history.evidenceExports.find((item) => item.exportType === exportType) || null;
}

function toActivationStatus(status: ModuleProgressStatus): ActivationStatus {
  if (status === 'complete') return 'proved';
  if (status === 'partial') return 'active';
  return 'blocked';
}

function summarizeChecks(checks: ReadinessCheck[]) {
  return {
    readyChecks: checks.filter((item) => item.status === 'ready').length,
    warningChecks: checks.filter((item) => item.status === 'warning').length,
    blockedChecks: checks.filter((item) => item.status === 'blocked').length
  };
}

function buildChecks(env: ResolvedEnv, history: WorkspaceHistory): ReadinessCheck[] {
  const remotePublishProof = history.publishRuns.some((item) => item.status === 'success' && isRemoteEndpoint(item.endpoint));
  return [
    {
      id: 'workspace-ledger',
      label: 'Workspace ledger',
      status: history.workspace.id ? 'ready' : 'blocked',
      detail: history.workspace.id ? `Workspace ${history.workspace.id} is loaded and readable.` : 'Workspace context is missing.'
    },
    {
      id: 'db-mode',
      label: 'Database mode',
      status: env.dbMode === 'neon-http' ? 'ready' : 'warning',
      detail: env.dbMode === 'neon-http' ? 'Runtime is using Neon HTTP mode.' : 'Runtime is in local memory mode. Local proof exists, but live Neon proof is not active in this runtime.'
    },
    {
      id: 'neon-config',
      label: 'Neon configuration',
      status: env.dbMode === 'neon-http' ? (env.neonSqlUrl ? 'ready' : 'blocked') : 'warning',
      detail: env.dbMode === 'neon-http' ? (env.neonSqlUrl ? 'NEON_SQL_URL is present.' : 'NEON_SQL_URL is missing.') : 'Neon credentials are not required while memory mode is active.'
    },
    {
      id: 'app-base-url',
      label: 'Application base URL',
      status: env.appBaseUrl ? 'ready' : 'warning',
      detail: env.appBaseUrl ? `APP_BASE_URL is set to ${env.appBaseUrl}.` : 'APP_BASE_URL is not set. Local report generation still works, but absolute-link surfaces stay local-only.'
    },
    {
      id: 'remote-publish-proof',
      label: 'Remote publish proof',
      status: remotePublishProof ? 'ready' : 'warning',
      detail: remotePublishProof ? 'A real remote publish success was observed in workspace history.' : 'Only local or adapter-level publish proof has been observed so far.'
    }
  ];
}

function buildActivationModule(module: CapabilityModule, proof: ProofMatrixModule | undefined, walkthrough: WalkthroughRunModule | undefined, env: ResolvedEnv, history: WorkspaceHistory): ActivationModule {
  const blockers: string[] = [];
  const notes: string[] = [];
  const proofStatus = proof?.status || 'pending';
  const walkthroughStatus = walkthrough?.status || 'pending';
  let status = toActivationStatus(proofStatus);
  let liveProofObserved = status === 'proved';

  if (module.id === 'foundation' && env.dbMode !== 'neon-http') {
    liveProofObserved = false;
    if (status === 'proved') status = 'active';
    notes.push('Foundation proof is real and smoke-backed, but this runtime is still operating in local memory mode.');
  }

  if (module.id === 'publishing') {
    liveProofObserved = history.publishRuns.some((item) => item.status === 'success' && isRemoteEndpoint(item.endpoint));
    if (!liveProofObserved) {
      if (status === 'proved') status = 'conditional';
      blockers.push('Live remote provider proof has not yet been observed in workspace history.');
      notes.push('Adapter execution, retries, scheduling, and reconciliation are smoke-backed locally.');
    }
  }

  if (module.id === 'readiness') {
    status = 'proved';
    liveProofObserved = true;
    notes.push('Readiness and contract-truth are generated from the live workspace ledger plus the active runtime env.');
  }

  if (status === 'blocked') blockers.push('Workspace evidence is still incomplete for this module.');
  if (status === 'conditional' && module.id !== 'publishing') notes.push('This module is locally proved but still depends on a stronger live-runtime condition before it can be treated as fully live-proved.');

  return {
    id: module.id,
    title: module.title,
    audience: module.audience,
    status,
    proofStatus,
    walkthroughStatus,
    routes: cloneJson(module.routes),
    controls: cloneJson(module.controls),
    smokeScripts: cloneJson(module.smokeScripts),
    localProofObserved: proofStatus !== 'pending',
    liveProofObserved,
    blockers,
    notes
  };
}

export function buildReadinessRun(env: ResolvedEnv, orgId: string, history: WorkspaceHistory, modules = getCapabilityRegistry()): ReadinessRun {
  const proof = buildProofMatrix(orgId, history, modules);
  const walkthrough = buildWalkthroughRun(orgId, history, modules);
  const checks = buildChecks(env, history);
  const items = modules.map((module) => buildActivationModule(
    module,
    proof.modules.find((item) => item.id === module.id),
    walkthrough.modules.find((item) => item.id === module.id),
    env,
    history
  ));
  const checkSummary = summarizeChecks(checks);
  return {
    generatedAt: nowIso(),
    workspaceId: history.workspace.id,
    dbMode: env.dbMode,
    checks,
    modules: items,
    summary: {
      modules: items.length,
      proved: items.filter((item) => item.status === 'proved').length,
      active: items.filter((item) => item.status === 'active').length,
      conditional: items.filter((item) => item.status === 'conditional').length,
      blocked: items.filter((item) => item.status === 'blocked').length,
      ...checkSummary
    }
  };
}

export function buildClaimCatalog(env: ResolvedEnv, orgId: string, history: WorkspaceHistory, modules = getCapabilityRegistry()): ClaimCatalogItem[] {
  const proof = buildProofMatrix(orgId, history, modules);
  const readiness = buildReadinessRun(env, orgId, history, modules);
  return modules.map((module) => {
    const activation = readiness.modules.find((item) => item.id === module.id);
    const proofModule = proof.modules.find((item) => item.id === module.id);
    return {
      id: `claim_${module.id}`,
      moduleId: module.id,
      moduleTitle: module.title,
      audience: module.audience,
      claim: module.outcome,
      purpose: module.purpose,
      status: activation?.status || 'blocked',
      proofStatus: proofModule?.status || 'pending',
      liveProofObserved: activation?.liveProofObserved || false,
      routes: cloneJson(module.routes),
      controls: cloneJson(module.controls),
      smokeScripts: cloneJson(module.smokeScripts),
      proofPoints: cloneJson(module.proofPoints),
      observedSignals: cloneJson(proofModule?.observedSignals || []),
      blockers: cloneJson(activation?.blockers || []),
      notes: cloneJson(activation?.notes || [])
    } satisfies ClaimCatalogItem;
  });
}

export function buildContractPack(env: ResolvedEnv, orgId: string, history: WorkspaceHistory, modules = getCapabilityRegistry()): ContractPack {
  const readiness = buildReadinessRun(env, orgId, history, modules);
  const claimCatalog = buildClaimCatalog(env, orgId, history, modules);
  const proof = buildProofMatrix(orgId, history, modules);
  const walkthrough = buildWalkthroughRun(orgId, history, modules);
  const latestReadiness = latestByType(history, 'readiness_run');
  return {
    generatedAt: nowIso(),
    workspaceId: history.workspace.id,
    purposeSummary: latestReadiness ? 'Contract-truth uses the latest persisted readiness run plus the live module graph.' : 'Contract-truth is generated from the live module graph and current runtime state.',
    readiness,
    claimCatalog,
    proofSummary: {
      modules: proof.summary.modules,
      complete: proof.summary.complete,
      partial: proof.summary.partial,
      pending: proof.summary.pending,
      smokeScripts: proof.summary.smokeScripts
    },
    walkthroughSummary: cloneJson(walkthrough.summary)
  };
}
