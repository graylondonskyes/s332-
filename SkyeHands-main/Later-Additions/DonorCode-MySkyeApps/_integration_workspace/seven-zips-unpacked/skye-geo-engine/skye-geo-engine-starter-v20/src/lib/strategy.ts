import type { WorkspaceHistory } from './db.ts';
import type { ResolvedEnv } from './env.ts';
import { getCapabilityRegistry } from './capabilities.ts';
import { cloneJson } from './json.ts';
import { buildClaimCatalog, buildReadinessRun } from './readiness.ts';
import { buildProofMatrix, buildWalkthroughRun } from './reporting.ts';
import { nowIso } from './time.ts';

export type StrategyScorecardModule = {
  moduleId: string;
  title: string;
  lane: 'core' | 'moat' | 'proof' | 'scale';
  score: number;
  status: 'proved' | 'active' | 'conditional' | 'blocked';
  why: string;
  routes: string[];
  controls: string[];
  proofPoints: string[];
  blockers: string[];
};

export type StrategyAction = {
  id: string;
  lane: 'fast-win' | 'moat' | 'proof' | 'scale';
  priority: 1 | 2 | 3 | 4 | 5;
  title: string;
  why: string;
  successLooksLike: string;
  routes: string[];
  controls: string[];
  blockers: string[];
};

export type StrategyRunbookDay = {
  day: number;
  title: string;
  focus: string;
  actions: string[];
};

export type StrategyPack = {
  generatedAt: string;
  workspaceId: string;
  benchmark: string;
  summary: {
    overallScore: number;
    moatScore: number;
    proofScore: number;
    strongestLane: string;
    weakestLane: string;
    fastWins: number;
    moatBuilds: number;
    blockedExternalProofs: number;
  };
  scorecard: StrategyScorecardModule[];
  actions: StrategyAction[];
  runbook: StrategyRunbookDay[];
};

function toLane(moduleId: string): StrategyScorecardModule['lane'] {
  if (['foundation', 'audit', 'research', 'writing'].includes(moduleId)) return 'core';
  if (['publishing', 'visibility', 'backlinks', 'strategy'].includes(moduleId)) return 'moat';
  if (['truth', 'readiness', 'reporting', 'portability'].includes(moduleId)) return 'proof';
  return 'scale';
}

function laneWeight(lane: StrategyScorecardModule['lane']): number {
  return lane === 'moat' ? 1.15 : lane === 'proof' ? 1.05 : lane === 'scale' ? 0.95 : 1;
}

function baseScore(status: StrategyScorecardModule['status']): number {
  switch (status) {
    case 'proved': return 92;
    case 'active': return 74;
    case 'conditional': return 63;
    default: return 36;
  }
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function average(values: number[]): number {
  return values.length ? Math.round(values.reduce((sum, item) => sum + item, 0) / values.length) : 0;
}

function summarizeWhy(status: StrategyScorecardModule['status'], moduleTitle: string, blockers: string[], notes: string[]): string {
  const parts = [`${moduleTitle} is currently ${status}.`];
  if (notes[0]) parts.push(notes[0]);
  if (blockers[0]) parts.push(blockers[0]);
  return parts.join(' ');
}

function buildRunbook(actions: StrategyAction[]): StrategyRunbookDay[] {
  const top = actions.slice(0, 7);
  const labels = [
    'Baseline truth',
    'Audit + evidence',
    'Source-ledger depth',
    'Article + publish throughput',
    'Visibility replay',
    'Distribution moat',
    'Proof export + buyer surface'
  ];
  return labels.map((label, index) => ({
    day: index + 1,
    title: label,
    focus: top[index]?.title || `Hold ${label.toLowerCase()} steady.`,
    actions: top[index] ? [top[index].why, top[index].successLooksLike] : ['No additional action generated for this day.']
  }));
}

export function buildStrategyScorecard(env: ResolvedEnv, orgId: string, history: WorkspaceHistory): { generatedAt: string; workspaceId: string; benchmark: string; summary: StrategyPack['summary']; modules: StrategyScorecardModule[] } {
  const registry = getCapabilityRegistry();
  const readiness = buildReadinessRun(env, orgId, history, registry);
  const claims = buildClaimCatalog(env, orgId, history, registry);
  const modules = registry.map((module) => {
    const activation = readiness.modules.find((item) => item.id === module.id);
    const claim = claims.find((item) => item.moduleId === module.id);
    const lane = toLane(module.id);
    const livePenalty = activation?.liveProofObserved === false && ['publishing', 'foundation'].includes(module.id) ? 12 : 0;
    const blockerPenalty = Math.min(18, (activation?.blockers.length || 0) * 6);
    const score = clamp((baseScore((activation?.status || 'blocked') as StrategyScorecardModule['status']) * laneWeight(lane)) - livePenalty - blockerPenalty);
    return {
      moduleId: module.id,
      title: module.title,
      lane,
      score,
      status: (activation?.status || 'blocked') as StrategyScorecardModule['status'],
      why: summarizeWhy((activation?.status || 'blocked') as StrategyScorecardModule['status'], module.title, activation?.blockers || [], activation?.notes || []),
      routes: cloneJson(module.routes),
      controls: cloneJson(module.controls),
      proofPoints: cloneJson(claim?.proofPoints || module.proofPoints),
      blockers: cloneJson(activation?.blockers || [])
    } satisfies StrategyScorecardModule;
  });

  const moatModules = modules.filter((item) => item.lane === 'moat');
  const proofModules = modules.filter((item) => item.lane === 'proof');
  const sorted = [...modules].sort((a, b) => b.score - a.score);
  const weakest = [...modules].sort((a, b) => a.score - b.score);
  const summary: StrategyPack['summary'] = {
    overallScore: average(modules.map((item) => item.score)),
    moatScore: average(moatModules.map((item) => item.score)),
    proofScore: average(proofModules.map((item) => item.score)),
    strongestLane: sorted[0]?.title || 'none',
    weakestLane: weakest[0]?.title || 'none',
    fastWins: 0,
    moatBuilds: 0,
    blockedExternalProofs: readiness.checks.filter((item) => item.id === 'db-mode' || item.id === 'neon-config' || item.id === 'remote-publish-proof').filter((item) => item.status !== 'ready').length
  };
  return { generatedAt: nowIso(), workspaceId: history.workspace.id, benchmark: 'BabyLoveGrowth-class operator benchmark', summary, modules };
}

export function buildStrategyActions(env: ResolvedEnv, orgId: string, history: WorkspaceHistory): { generatedAt: string; workspaceId: string; benchmark: string; actions: StrategyAction[] } {
  const proof = buildProofMatrix(orgId, history);
  const walkthrough = buildWalkthroughRun(orgId, history);
  const readiness = buildReadinessRun(env, orgId, history);
  const actions: StrategyAction[] = [];
  const push = (action: StrategyAction) => actions.push(action);

  if (!history.auditRuns.length) {
    push({ id: 'action_audit', lane: 'fast-win', priority: 1, title: 'Run the first live audit', why: 'Without a persisted audit the platform cannot prove technical GEO depth on a real target.', successLooksLike: 'At least one audit run and one audit evidence export exist in workspace history.', routes: ['POST /v1/audit/site', 'POST /v1/evidence/export'], controls: ['run-audit', 'export-audit'], blockers: [] });
  }
  if (!history.sources.length) {
    push({ id: 'action_sources', lane: 'fast-win', priority: 1, title: 'Populate the source ledger', why: 'The writing lane and the proof lane become materially stronger when claims are sourced from a deduped research ledger.', successLooksLike: 'URL and raw-text source rows are present and reusable by the brief engine.', routes: ['POST /v1/research', 'GET /v1/research'], controls: ['run-research', 'list-research'], blockers: [] });
  }
  if (!history.articles.length) {
    push({ id: 'action_articles', lane: 'fast-win', priority: 1, title: 'Generate a brief and a long-form article', why: 'A real article with claim mapping is required before publishing, reporting, and buyer-facing proof can show editorial depth.', successLooksLike: 'A stored brief and stored article exist with claim-to-source mapping.', routes: ['POST /v1/articles/brief', 'POST /v1/articles/draft'], controls: ['run-brief', 'run-draft'], blockers: history.sources.length ? [] : ['research ledger still empty'] });
  }
  if (!history.publishRuns.some((item) => item.status === 'success')) {
    push({ id: 'action_publish', lane: 'moat', priority: 2, title: 'Drive one publish run to success', why: 'Publishing reconciliation is part of the moat. Adapter preparation without execution leaves the operating loop incomplete.', successLooksLike: 'One publish run reaches success and can be exported as evidence.', routes: ['POST /v1/publish/payload', 'POST /v1/publish/execute', 'POST /v1/publish/export'], controls: ['run-publish-payload', 'run-publish-execute', 'export-publish'], blockers: history.articles.length ? [] : ['article inventory not ready'] });
  }
  if (!history.visibilityRuns.length) {
    push({ id: 'action_visibility', lane: 'moat', priority: 2, title: 'Run at least one visibility replay', why: 'A category-of-one GEO platform needs replayable answer scoring, not just content production.', successLooksLike: 'A prompt pack, replay result, and visibility dashboard/export exist.', routes: ['POST /v1/visibility/prompt-pack', 'POST /v1/visibility/replay', 'GET /v1/visibility/dashboard'], controls: ['run-prompts', 'run-replay', 'run-dashboard'], blockers: [] });
  }
  if (!history.evidenceExports.some((item) => item.exportType === 'report_site')) {
    push({ id: 'action_report', lane: 'proof', priority: 2, title: 'Export a buyer-facing report site', why: 'Report-grade explainability is part of the product thesis and helps convert proof into a client-facing or investor-facing surface.', successLooksLike: 'A report site export exists in the evidence ledger.', routes: ['GET /v1/reports/summary', 'POST /v1/reports/site', 'POST /v1/reports/export'], controls: ['load-report-summary', 'generate-report-site', 'export-report-site'], blockers: [] });
  }
  if (!history.evidenceExports.some((item) => item.exportType === 'contract_pack')) {
    push({ id: 'action_contract', lane: 'proof', priority: 2, title: 'Export the contract-truth pack', why: 'The platform should explain what is proved, what is conditional, and what remains blocked without theater.', successLooksLike: 'A contract pack is stored in evidence and the claim catalog is readable.', routes: ['POST /v1/readiness/run', 'GET /v1/claims/catalog', 'POST /v1/contracts/export'], controls: ['run-readiness', 'load-claim-catalog', 'export-contract-pack'], blockers: [] });
  }
  if (!history.evidenceExports.some((item) => item.exportType === 'strategy_pack')) {
    push({ id: 'action_strategy', lane: 'moat', priority: 3, title: 'Export the competitive strategy pack', why: 'To beat BabyLoveGrowth-class products, the platform needs a persisted operator battle plan tied to real proof and module scores.', successLooksLike: 'A strategy pack export exists with scorecard, prioritized actions, and weekly runbook.', routes: ['GET /v1/strategy/scorecard', 'GET /v1/strategy/actions', 'POST /v1/strategy/export'], controls: ['load-strategy-scorecard', 'load-strategy-actions', 'export-strategy-pack'], blockers: [] });
  }
  if (!history.evidenceExports.some((item) => item.exportType === 'workspace_bundle')) {
    push({ id: 'action_bundle', lane: 'proof', priority: 3, title: 'Retain a workspace bundle', why: 'Portability and proof retention reduce operator risk and make the ledger exportable.', successLooksLike: 'A workspace bundle export exists and can be restored or cloned.', routes: ['POST /v1/workspace-bundles/export', 'POST /v1/workspace-bundles/import', 'POST /v1/workspace-bundles/clone'], controls: ['export-bundle', 'import-bundle', 'clone-bundle'], blockers: [] });
  }
  if (!history.publishRuns.some((item) => item.status === 'success' && item.endpoint && /^https?:\/\//.test(item.endpoint) && !item.endpoint.includes('.local') && !item.endpoint.includes('localhost'))) {
    push({ id: 'action_live_publish', lane: 'proof', priority: 4, title: 'Capture live provider publish proof', why: 'Remote CMS truth is still the sharpest remaining publish gap between local proof and full live proof.', successLooksLike: 'One remote provider target returns a real remote id and live URL that are stored in the publish ledger.', routes: ['POST /v1/publish/execute'], controls: ['run-publish-execute'], blockers: ['requires a live external provider target'] });
  }
  if (env.dbMode !== 'neon-http') {
    push({ id: 'action_live_neon', lane: 'proof', priority: 5, title: 'Capture live Neon read/write proof', why: 'Transport proof exists, but the live Neon target still needs end-to-end readback proof to close the last persistent-data gap.', successLooksLike: 'Workspace history is read back from a live Neon target after full smoke runs.', routes: ['GET /v1/history'], controls: ['run-history'], blockers: ['requires a live Neon target'] });
  }

  const proofSummary = proof.summary;
  const walkthroughSummary = walkthrough.summary;
  if (proofSummary.partial > 0 || walkthroughSummary.partial > 0) {
    push({ id: 'action_partial_modules', lane: 'scale', priority: 3, title: 'Lift partial modules to complete workspace exercise', why: 'The code exists, but the current workspace has not driven every module to full ledger coverage.', successLooksLike: 'More modules move from partial to complete in the proof matrix and walkthrough run.', routes: ['GET /v1/proof/matrix', 'GET /v1/walkthrough-runs'], controls: ['load-proof-matrix', 'load-walkthrough-run'], blockers: [] });
  }

  const ordered = actions.sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));
  return { generatedAt: nowIso(), workspaceId: history.workspace.id, benchmark: 'BabyLoveGrowth-class operator benchmark', actions: ordered };
}

export function buildStrategyPack(env: ResolvedEnv, orgId: string, history: WorkspaceHistory): StrategyPack {
  const scorecard = buildStrategyScorecard(env, orgId, history);
  const actionSet = buildStrategyActions(env, orgId, history);
  const runbook = buildRunbook(actionSet.actions);
  return {
    generatedAt: nowIso(),
    workspaceId: history.workspace.id,
    benchmark: scorecard.benchmark,
    summary: {
      ...scorecard.summary,
      fastWins: actionSet.actions.filter((item) => item.lane === 'fast-win').length,
      moatBuilds: actionSet.actions.filter((item) => item.lane === 'moat').length,
      blockedExternalProofs: actionSet.actions.filter((item) => item.blockers.some((blocker) => blocker.includes('requires a live'))).length
    },
    scorecard: cloneJson(scorecard.modules),
    actions: cloneJson(actionSet.actions),
    runbook
  };
}
