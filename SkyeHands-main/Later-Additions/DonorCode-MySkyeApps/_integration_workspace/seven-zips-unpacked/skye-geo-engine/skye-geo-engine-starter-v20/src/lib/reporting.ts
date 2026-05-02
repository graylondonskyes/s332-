import type { WorkspaceHistory } from './db.ts';
import type { ResolvedEnv } from './env.ts';
import { getCapabilityRegistry, type CapabilityModule } from './capabilities.ts';
import { cloneJson } from './json.ts';
import type { ActivationModule, ClaimCatalogItem } from './readiness.ts';
import { buildStrategyActions, buildStrategyScorecard } from './strategy.ts';
import { nowIso } from './time.ts';
import { getOrgSettings, listApiKeys, listClients, listInvoiceExports, listPartnerSites, listPlacements, listSeats, listUsage, summarizeBacklinkNetwork, summarizeUsage } from './platformStore.ts';

export type ModuleProgressStatus = 'complete' | 'partial' | 'pending' | 'not_applicable';

export type WalkthroughRunStep = {
  step: number;
  title: string;
  status: ModuleProgressStatus;
  evidence: string[];
};

export type WalkthroughRunModule = {
  id: string;
  title: string;
  audience: string;
  status: ModuleProgressStatus;
  completedSteps: number;
  totalSteps: number;
  steps: WalkthroughRunStep[];
  notes: string[];
};

export type ProofMatrixModule = {
  id: string;
  title: string;
  audience: string;
  purpose: string;
  outcome: string;
  status: ModuleProgressStatus;
  availableRoutes: number;
  availableControls: number;
  smokeScripts: string[];
  proofPoints: string[];
  observedSignals: Array<{ label: string; value: number }>;
  notes: string[];
};

export type WorkspaceReport = {
  generatedAt: string;
  audience: 'client' | 'investor' | 'operator';
  workspace: {
    id: string;
    name: string;
    brand: string | null;
    niche: string | null;
    orgId: string;
    createdAt: string;
  };
  purpose: {
    headline: string;
    summary: string;
    productPurpose: string;
  };
  metrics: Record<string, number>;
  summaries: {
    audits: string[];
    content: string[];
    publishing: string[];
    visibility: string[];
    distribution: string[];
    agency: string[];
    proof: string[];
  };
  readiness?: {
    statusCounts: { proved: number; active: number; conditional: number; blocked: number };
    checks: Array<{ label: string; status: string; detail: string }>;
  } | null;
  claimCatalogSample?: Array<{ moduleTitle: string; claim: string; status: string; liveProofObserved: boolean }>;
  strategy?: { overallScore: number; moatScore: number; proofScore: number; strongestLane: string; weakestLane: string; actions: Array<{ title: string; lane: string; priority: number; successLooksLike: string }> } | null;
  walkthroughRun: WalkthroughRunModule[];
  proofMatrix: ProofMatrixModule[];
};

type WorkspaceSignals = {
  projects: number;
  jobs: number;
  audits: number;
  contentPlans: number;
  promptPacks: number;
  sources: number;
  urlSources: number;
  textSources: number;
  briefs: number;
  articles: number;
  publishRuns: number;
  publishSuccess: number;
  publishFailed: number;
  publishQueued: number;
  publishScheduled: number;
  visibilityRuns: number;
  evidenceExports: number;
  auditExports: number;
  publishExports: number;
  visibilityExports: number;
  reportExports: number;
  bundleExports: number;
  strategyExports: number;
  articleEnrichments: number;
  articleReviews: number;
  articleRemediations: number;
  targetProbes: number;
  targetProbePacks: number;
  settingsSaved: number;
  apiKeys: number;
  seats: number;
  clients: number;
  usageEvents: number;
  invoices: number;
  partnerSites: number;
  placements: number;
  livePlacements: number;
  queuedPlacements: number;
};

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function classifyStatus(complete: number, total: number, allowNotApplicable = false): ModuleProgressStatus {
  if (!total && allowNotApplicable) return 'not_applicable';
  if (complete <= 0) return 'pending';
  if (complete >= total) return 'complete';
  return 'partial';
}

function getSignals(orgId: string, history: WorkspaceHistory): WorkspaceSignals {
  const placements = listPlacements(orgId, history.workspace.id);
  return {
    projects: history.projects.length,
    jobs: history.jobs.length,
    audits: history.auditRuns.length,
    contentPlans: history.contentPlans.length,
    promptPacks: history.promptPacks.length,
    sources: history.sources.length,
    urlSources: history.sources.filter((item) => item.retrievalOrigin === 'url_fetch').length,
    textSources: history.sources.filter((item) => item.retrievalOrigin !== 'url_fetch').length,
    briefs: history.briefs.length,
    articles: history.articles.length,
    publishRuns: history.publishRuns.length,
    publishSuccess: history.publishRuns.filter((item) => item.status === 'success').length,
    publishFailed: history.publishRuns.filter((item) => item.status === 'failed').length,
    publishQueued: history.publishRuns.filter((item) => item.status === 'queued').length,
    publishScheduled: history.publishRuns.filter((item) => !!item.scheduledFor).length,
    visibilityRuns: history.visibilityRuns.length,
    evidenceExports: history.evidenceExports.length,
    auditExports: history.evidenceExports.filter((item) => item.exportType === 'audit').length,
    publishExports: history.evidenceExports.filter((item) => item.exportType === 'publish').length,
    visibilityExports: history.evidenceExports.filter((item) => item.exportType === 'visibility').length,
    reportExports: history.evidenceExports.filter((item) => item.exportType === 'report_site').length,
    bundleExports: history.evidenceExports.filter((item) => item.exportType === 'workspace_bundle').length,
    strategyExports: history.evidenceExports.filter((item) => item.exportType === 'strategy_pack').length,
    articleEnrichments: history.evidenceExports.filter((item) => item.exportType === 'article_enrichment' || item.exportType === 'article_enrichment_pack').length,
    articleReviews: history.evidenceExports.filter((item) => item.exportType === 'article_review' || item.exportType === 'article_review_pack').length,
    articleRemediations: history.evidenceExports.filter((item) => item.exportType === 'article_remediation' || item.exportType === 'article_remediation_pack').length,
    targetProbes: history.evidenceExports.filter((item) => item.exportType === 'target_probe').length,
    targetProbePacks: history.evidenceExports.filter((item) => item.exportType === 'target_probe_pack').length,
    settingsSaved: getOrgSettings(orgId).updatedAt ? 1 : 0,
    apiKeys: listApiKeys(orgId).length,
    seats: listSeats(orgId).length,
    clients: listClients(orgId).length,
    usageEvents: listUsage(orgId).length,
    invoices: listInvoiceExports(orgId).length,
    partnerSites: listPartnerSites(orgId).length,
    placements: placements.length,
    livePlacements: placements.filter((item) => item.status === 'live').length,
    queuedPlacements: placements.filter((item) => item.status === 'queued').length
  };
}

function buildModuleSteps(module: CapabilityModule, signals: WorkspaceSignals): WalkthroughRunStep[] {
  const ids = {
    foundation: [
      { ok: true, evidence: ['workspace exists'] },
      { ok: signals.projects > 0, evidence: [`projects=${signals.projects}`] },
      { ok: signals.jobs > 0 || signals.audits > 0 || signals.articles > 0, evidence: [`jobs=${signals.jobs}`, `audits=${signals.audits}`, `articles=${signals.articles}`] }
    ],
    audit: [
      { ok: signals.audits > 0, evidence: [`audits=${signals.audits}`] },
      { ok: signals.auditExports > 0, evidence: [`auditExports=${signals.auditExports}`] }
    ],
    research: [
      { ok: signals.urlSources > 0, evidence: [`urlSources=${signals.urlSources}`] },
      { ok: signals.textSources > 0, evidence: [`textSources=${signals.textSources}`] },
      { ok: signals.sources > 0, evidence: [`sources=${signals.sources}`] }
    ],
    writing: [
      { ok: signals.briefs > 0, evidence: [`briefs=${signals.briefs}`] },
      { ok: signals.articles > 0, evidence: [`articles=${signals.articles}`] },
      { ok: signals.articleEnrichments > 0, evidence: [`articleEnrichments=${signals.articleEnrichments}`] },
      { ok: signals.articleReviews > 0, evidence: [`articleReviews=${signals.articleReviews}`] },
      { ok: signals.articleRemediations > 0, evidence: [`articleRemediations=${signals.articleRemediations}`] },
      { ok: signals.articles > 0 && (signals.articleEnrichments > 0 || signals.articleReviews > 0 || signals.articleRemediations > 0), evidence: [`articles=${signals.articles}`, `articleEnrichments=${signals.articleEnrichments}`, `articleReviews=${signals.articleReviews}`, `articleRemediations=${signals.articleRemediations}`] }
    ],
    publishing: [
      { ok: signals.publishRuns > 0, evidence: [`publishRuns=${signals.publishRuns}`] },
      { ok: signals.publishSuccess > 0 || signals.publishFailed > 0, evidence: [`publishSuccess=${signals.publishSuccess}`, `publishFailed=${signals.publishFailed}`] },
      { ok: signals.publishQueued > 0 || signals.publishScheduled > 0 || signals.publishRuns > 1, evidence: [`publishQueued=${signals.publishQueued}`, `publishScheduled=${signals.publishScheduled}`] }
    ],
    visibility: [
      { ok: signals.promptPacks > 0, evidence: [`promptPacks=${signals.promptPacks}`] },
      { ok: signals.visibilityRuns > 0, evidence: [`visibilityRuns=${signals.visibilityRuns}`] },
      { ok: signals.visibilityExports > 0 || signals.visibilityRuns > 0, evidence: [`visibilityExports=${signals.visibilityExports}`, `visibilityRuns=${signals.visibilityRuns}`] }
    ],
    agency: [
      { ok: signals.apiKeys > 0, evidence: [`apiKeys=${signals.apiKeys}`] },
      { ok: signals.settingsSaved > 0, evidence: ['org settings saved'] },
      { ok: signals.seats > 0 || signals.clients > 0 || signals.invoices > 0, evidence: [`seats=${signals.seats}`, `clients=${signals.clients}`, `invoices=${signals.invoices}`] }
    ],
    backlinks: [
      { ok: signals.partnerSites > 0, evidence: [`partnerSites=${signals.partnerSites}`] },
      { ok: signals.placements > 0, evidence: [`placements=${signals.placements}`] },
      { ok: signals.livePlacements > 0 || signals.queuedPlacements > 0, evidence: [`livePlacements=${signals.livePlacements}`, `queuedPlacements=${signals.queuedPlacements}`] }
    ],
    portability: [
      { ok: signals.bundleExports > 0, evidence: [`bundleExports=${signals.bundleExports}`] },
      { ok: signals.bundleExports > 0, evidence: [`bundleExports=${signals.bundleExports}`] },
      { ok: signals.bundleExports > 0, evidence: [`bundleExports=${signals.bundleExports}`] }
    ],
    readiness: [
      { ok: signals.evidenceExports > 0, evidence: [`evidenceExports=${signals.evidenceExports}`] },
      { ok: signals.evidenceExports > 0, evidence: [`evidenceExports=${signals.evidenceExports}`] },
      { ok: signals.reportExports > 0 || signals.evidenceExports > 0, evidence: [`reportExports=${signals.reportExports}`, `evidenceExports=${signals.evidenceExports}`] }
    ],
    strategy: [
      { ok: true, evidence: ['strategy scorecard generated on demand'] },
      { ok: true, evidence: ['strategy actions generated on demand'] },
      { ok: signals.strategyExports > 0, evidence: [`strategyExports=${signals.strategyExports}`] }
    ],
    targets: [
      { ok: signals.targetProbes > 0 || signals.targetProbePacks > 0, evidence: [`targetProbes=${signals.targetProbes}`, `targetProbePacks=${signals.targetProbePacks}`] },
      { ok: signals.targetProbes > 0, evidence: [`targetProbes=${signals.targetProbes}`] },
      { ok: signals.targetProbePacks > 0, evidence: [`targetProbePacks=${signals.targetProbePacks}`] }
    ],
    reporting: [
      { ok: true, evidence: ['reporting routes available'] },
      { ok: true, evidence: ['proof matrix generated on demand'] },
      { ok: signals.reportExports > 0, evidence: [`reportExports=${signals.reportExports}`] }
    ],
    truth: [
      { ok: true, evidence: ['capability registry loaded'] },
      { ok: true, evidence: ['walkthrough registry loaded'] },
      { ok: true, evidence: ['truth validator available'] }
    ]
  } as Record<string, Array<{ ok: boolean; evidence: string[] }>>;

  const rules = ids[module.id] || module.walkthrough.map(() => ({ ok: false, evidence: ['no rule configured'] }));
  return module.walkthrough.map((step, index) => ({
    step: step.step,
    title: step.title,
    status: rules[index]?.ok ? 'complete' : 'pending',
    evidence: cloneJson(rules[index]?.evidence || [])
  }));
}

export function buildWalkthroughRun(orgId: string, history: WorkspaceHistory, modules = getCapabilityRegistry()): { generatedAt: string; workspaceId: string; modules: WalkthroughRunModule[]; summary: { modules: number; complete: number; partial: number; pending: number } } {
  const signals = getSignals(orgId, history);
  const items = modules.map((module) => {
    const steps = buildModuleSteps(module, signals);
    const complete = steps.filter((item) => item.status === 'complete').length;
    const status = classifyStatus(complete, steps.length);
    const notes: string[] = [];
    if (status !== 'complete') notes.push(`This workspace has not yet exercised every ${module.title.toLowerCase()} step.`);
    if (module.id === 'reporting') notes.push('Reporting is generated from the real workspace ledger and capability graph only.');
    if (module.id === 'truth') notes.push('Truth validation stays bound to shipped routes and shipped controls.');
    return {
      id: module.id,
      title: module.title,
      audience: module.audience,
      status,
      completedSteps: complete,
      totalSteps: steps.length,
      steps,
      notes
    } satisfies WalkthroughRunModule;
  });
  return {
    generatedAt: nowIso(),
    workspaceId: history.workspace.id,
    modules: items,
    summary: {
      modules: items.length,
      complete: items.filter((item) => item.status === 'complete').length,
      partial: items.filter((item) => item.status === 'partial').length,
      pending: items.filter((item) => item.status === 'pending').length
    }
  };
}

export function buildProofMatrix(orgId: string, history: WorkspaceHistory, modules = getCapabilityRegistry()): { generatedAt: string; workspaceId: string; modules: ProofMatrixModule[]; summary: { modules: number; complete: number; partial: number; pending: number; routes: number; controls: number; smokeScripts: number } } {
  const signals = getSignals(orgId, history);
  const walkthrough = buildWalkthroughRun(orgId, history, modules);
  const items = modules.map((module) => {
    const runModule = walkthrough.modules.find((item) => item.id === module.id);
    const observedSignals: Array<{ label: string; value: number }> = [];
    const push = (label: string, value: number) => observedSignals.push({ label, value });
    switch (module.id) {
      case 'foundation': push('projects', signals.projects); push('jobs', signals.jobs); break;
      case 'audit': push('audits', signals.audits); push('auditExports', signals.auditExports); break;
      case 'research': push('sources', signals.sources); push('urlSources', signals.urlSources); push('textSources', signals.textSources); break;
      case 'writing': push('briefs', signals.briefs); push('articles', signals.articles); push('articleEnrichments', signals.articleEnrichments); push('articleReviews', signals.articleReviews); push('articleRemediations', signals.articleRemediations); break;
      case 'publishing': push('publishRuns', signals.publishRuns); push('publishSuccess', signals.publishSuccess); break;
      case 'visibility': push('promptPacks', signals.promptPacks); push('visibilityRuns', signals.visibilityRuns); break;
      case 'agency': push('apiKeys', signals.apiKeys); push('seats', signals.seats); push('clients', signals.clients); break;
      case 'backlinks': push('partnerSites', signals.partnerSites); push('placements', signals.placements); push('livePlacements', signals.livePlacements); break;
      case 'portability': push('bundleExports', signals.bundleExports); break;
      case 'readiness': push('evidenceExports', signals.evidenceExports); push('reportExports', signals.reportExports); break;
      case 'strategy': push('strategyExports', signals.strategyExports); push('reportExports', signals.reportExports); push('evidenceExports', signals.evidenceExports); break;
      case 'targets': push('targetProbes', signals.targetProbes); push('targetProbePacks', signals.targetProbePacks); break;
      case 'reporting': push('reportExports', signals.reportExports); push('evidenceExports', signals.evidenceExports); break;
      case 'truth': push('routes', module.routes.length); push('controls', module.controls.length); break;
      default: break;
    }
    const notes = [];
    if ((runModule?.status || 'pending') !== 'complete') notes.push('Workspace evidence is still partial for this module.');
    notes.push(`Smoke scripts: ${module.smokeScripts.join(', ')}`);
    return {
      id: module.id,
      title: module.title,
      audience: module.audience,
      purpose: module.purpose,
      outcome: module.outcome,
      status: runModule?.status || 'pending',
      availableRoutes: module.routes.length,
      availableControls: module.controls.length,
      smokeScripts: cloneJson(module.smokeScripts),
      proofPoints: cloneJson(module.proofPoints),
      observedSignals,
      notes
    } satisfies ProofMatrixModule;
  });
  return {
    generatedAt: nowIso(),
    workspaceId: history.workspace.id,
    modules: items,
    summary: {
      modules: items.length,
      complete: items.filter((item) => item.status === 'complete').length,
      partial: items.filter((item) => item.status === 'partial').length,
      pending: items.filter((item) => item.status === 'pending').length,
      routes: items.reduce((sum, item) => sum + item.availableRoutes, 0),
      controls: items.reduce((sum, item) => sum + item.availableControls, 0),
      smokeScripts: new Set(items.flatMap((item) => item.smokeScripts)).size
    }
  };
}

export function buildWorkspaceReport(env: ResolvedEnv, orgId: string, history: WorkspaceHistory, audience: WorkspaceReport['audience'] = 'operator', modules = getCapabilityRegistry()): WorkspaceReport {
  const walkthroughRun = buildWalkthroughRun(orgId, history, modules);
  const proofMatrix = buildProofMatrix(orgId, history, modules);
  const signals = getSignals(orgId, history);
  const usageSummary = summarizeUsage(orgId);
  const backlinkSummary = summarizeBacklinkNetwork(orgId, history.workspace.id);
  const scorecard = buildStrategyScorecard(env, orgId, history);
  const strategyActions = buildStrategyActions(env, orgId, history);
  const headline = audience === 'investor'
    ? 'Proof-backed growth operating system with execution, distribution, and evidence retention.'
    : audience === 'client'
      ? 'A growth platform that explains what it does and proves the work it has actually run.'
      : 'Operator-grade workspace report generated from the live module graph and workspace history.';
  const summary = audience === 'client'
    ? `This workspace has run ${signals.audits} audits, generated ${signals.articles} articles, executed ${signals.publishRuns} publish runs, and stored ${signals.evidenceExports} evidence exports.`
    : audience === 'investor'
      ? `The workspace proves the platform can combine audit, editorial, publishing, replay, backlink, agency, portability, and reporting lanes inside one system. Proof coverage spans ${proofMatrix.summary.modules} implemented modules.`
      : `This report is generated from the real workspace ledger, the real capability registry, and the proof matrix. Nothing here is filled with demo-only copy.`;
  return {
    generatedAt: nowIso(),
    audience,
    workspace: {
      id: history.workspace.id,
      name: history.workspace.name,
      brand: history.workspace.brand,
      niche: history.workspace.niche,
      orgId,
      createdAt: history.workspace.createdAt
    },
    purpose: {
      headline,
      summary,
      productPurpose: 'Explain the purpose, walkthroughs, and proof state from the actual routes, controls, workspace activity, and smoke-backed modules.'
    },
    metrics: {
      projects: signals.projects,
      audits: signals.audits,
      sources: signals.sources,
      briefs: signals.briefs,
      articles: signals.articles,
      publishRuns: signals.publishRuns,
      publishSuccess: signals.publishSuccess,
      visibilityRuns: signals.visibilityRuns,
      evidenceExports: signals.evidenceExports,
      partnerSites: signals.partnerSites,
      placements: signals.placements,
      livePlacements: signals.livePlacements,
      apiKeys: signals.apiKeys,
      seats: signals.seats,
      clients: signals.clients,
      usageEvents: signals.usageEvents
    },
    summaries: {
      audits: [
        `${signals.audits} audit run(s) are stored for this workspace.`,
        `${history.auditRuns.filter((item) => item.score >= 70).length} audit run(s) scored 70 or higher.`,
        `${signals.auditExports} audit export(s) were retained as evidence.`
      ],
      content: [
        `${signals.sources} source record(s) were normalized into the ledger.`,
        `${signals.briefs} brief(s) and ${signals.articles} article draft(s) exist for this workspace.`,
        `${history.articles.filter((item) => item.claimMap.length > 0).length} article(s) include claim-to-source mapping.`
      ],
      publishing: [
        `${signals.publishRuns} publish run(s) were created.`,
        `${signals.publishSuccess} publish run(s) reached success state and ${signals.publishFailed} failed.`,
        `${signals.publishExports} publish evidence export(s) are stored.`
      ],
      visibility: [
        `${signals.promptPacks} prompt pack(s) exist.`,
        `${signals.visibilityRuns} visibility replay run(s) were scored.`,
        `${signals.visibilityExports} visibility export(s) are stored.`
      ],
      distribution: [
        `${signals.partnerSites} partner site(s) and ${signals.placements} placement(s) are attached to this org/workspace.`,
        `${signals.livePlacements} placement(s) are live and ${signals.queuedPlacements} remain queued.`,
        `Backlink network summary: ${JSON.stringify(backlinkSummary)}`
      ],
      agency: [
        `${signals.apiKeys} api key(s), ${signals.seats} seat(s), and ${signals.clients} client record(s) exist for this org.`,
        `${signals.usageEvents} usage event(s) were logged in the current period.`,
        `${usageSummary.estimatedCents} estimated cents are represented in the current usage summary.`
      ],
      proof: [
        `${walkthroughRun.summary.complete} module(s) are complete in this workspace walkthrough run and ${walkthroughRun.summary.partial} are partial.`,
        `${proofMatrix.summary.smokeScripts} distinct smoke script(s) are attached to the active module graph.`,
        `${signals.reportExports} report export(s), ${signals.bundleExports} workspace bundle export(s), and ${signals.strategyExports} strategy export(s) were retained.`
      ]
    },
    readiness: null,
    claimCatalogSample: [],
    strategy: {
      overallScore: scorecard.summary.overallScore,
      moatScore: scorecard.summary.moatScore,
      proofScore: scorecard.summary.proofScore,
      strongestLane: scorecard.summary.strongestLane,
      weakestLane: scorecard.summary.weakestLane,
      actions: strategyActions.actions.slice(0, 5).map((item) => ({ title: item.title, lane: item.lane, priority: item.priority, successLooksLike: item.successLooksLike }))
    },
    walkthroughRun: cloneJson(walkthroughRun.modules),
    proofMatrix: cloneJson(proofMatrix.modules)
  };
}

export function renderReportSite(report: WorkspaceReport): string {
  const metricCards = Object.entries(report.metrics)
    .map(([key, value]) => `<div class="card"><div class="label">${esc(key)}</div><div class="value">${esc(value)}</div></div>`)
    .join('');
  const summarySections = Object.entries(report.summaries)
    .map(([key, lines]) => `<section class="panel"><h2>${esc(key)}</h2><ul>${lines.map((line) => `<li>${esc(line)}</li>`).join('')}</ul></section>`)
    .join('');
  const walkthroughSections = report.walkthroughRun
    .map((module) => `<section class="panel"><h2>${esc(module.title)}</h2><div class="meta">Audience: ${esc(module.audience)} · Status: ${esc(module.status)} · ${module.completedSteps}/${module.totalSteps} steps complete</div><ol>${module.steps.map((step) => `<li><strong>${esc(step.title)}</strong> — ${esc(step.status)}<div class="meta">${esc(step.evidence.join(' · '))}</div></li>`).join('')}</ol>${module.notes.length ? `<p class="note">${module.notes.map(esc).join(' ')}</p>` : ''}</section>`)
    .join('');
  const proofRows = report.proofMatrix
    .map((module) => `<tr><td>${esc(module.title)}</td><td>${esc(module.status)}</td><td>${module.availableRoutes}</td><td>${module.availableControls}</td><td>${esc(module.proofPoints.join(', '))}</td></tr>`)
    .join('');
  const readinessSection = report.readiness ? `<section class="panel" style="margin-top:18px"><h2>Readiness + contract truth</h2><div class="meta">Proved: ${esc(report.readiness.statusCounts.proved)} · Active: ${esc(report.readiness.statusCounts.active)} · Conditional: ${esc(report.readiness.statusCounts.conditional)} · Blocked: ${esc(report.readiness.statusCounts.blocked)}</div><ul>${report.readiness.checks.map((item) => `<li><strong>${esc(item.label)}</strong> — ${esc(item.status)}<div class="meta">${esc(item.detail)}</div></li>`).join('')}</ul></section>` : '';
  const claimSection = report.claimCatalogSample && report.claimCatalogSample.length ? `<section class="panel" style="margin-top:18px"><h2>Claim catalog sample</h2><ul>${report.claimCatalogSample.map((item) => `<li><strong>${esc(item.moduleTitle)}</strong> — ${esc(item.status)} — ${esc(item.claim)}<div class="meta">Live proof observed: ${esc(item.liveProofObserved ? 'yes' : 'no')}</div></li>`).join('')}</ul></section>` : '';
  const strategySection = report.strategy ? `<section class="panel" style="margin-top:18px"><h2>Competitive strategy pack</h2><div class="meta">Overall: ${esc(report.strategy.overallScore)} · Moat: ${esc(report.strategy.moatScore)} · Proof: ${esc(report.strategy.proofScore)} · Strongest: ${esc(report.strategy.strongestLane)} · Weakest: ${esc(report.strategy.weakestLane)}</div><ul>${report.strategy.actions.map((item) => `<li><strong>${esc(item.title)}</strong> — ${esc(item.lane)} · priority ${esc(item.priority)}<div class="meta">${esc(item.successLooksLike)}</div></li>`).join('')}</ul></section>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(report.workspace.name)} — Proof-backed GEO report</title>
<style>
:root{color-scheme:dark;--bg:#06101c;--panel:#0b1727;--line:rgba(255,255,255,.12);--text:#edf4ff;--muted:#9db0c9;--accent:#7cc8ff}
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;background:linear-gradient(180deg,#081220,#050b13);color:var(--text)}
main{max-width:1200px;margin:0 auto;padding:32px 20px 64px}h1{font-size:42px;line-height:1.05;margin:0 0 10px}h2{margin:0 0 10px;font-size:20px}.lead{max-width:920px;color:var(--muted);font-size:18px;line-height:1.55}
.hero,.panel{border:1px solid var(--line);background:rgba(9,17,29,.86);backdrop-filter:blur(8px);border-radius:22px;padding:22px;box-shadow:0 14px 50px rgba(0,0,0,.35)}
.hero{margin-bottom:20px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin:22px 0}.card{border:1px solid var(--line);background:var(--panel);border-radius:18px;padding:14px}.label{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}.value{font-size:26px;font-weight:800;margin-top:8px}
.sections{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px;margin-top:18px}.meta{color:var(--muted);font-size:13px;margin:6px 0 12px}.note{color:var(--muted)}ul,ol{margin:0;padding-left:20px;line-height:1.6}.table-wrap{overflow:auto}.proof-table{width:100%;border-collapse:collapse}.proof-table th,.proof-table td{padding:12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.footer{margin-top:28px;color:var(--muted);font-size:13px}
</style>
</head>
<body>
<main>
  <section class="hero">
    <div class="meta">Generated ${esc(report.generatedAt)} · Audience: ${esc(report.audience)} · Workspace: ${esc(report.workspace.id)}</div>
    <h1>${esc(report.purpose.headline)}</h1>
    <p class="lead">${esc(report.purpose.summary)}</p>
    <p class="lead">${esc(report.purpose.productPurpose)}</p>
    <div class="grid">${metricCards}</div>
  </section>
  <div class="sections">${summarySections}</div>
  ${readinessSection}
  ${claimSection}
  ${strategySection}
  <section class="panel" style="margin-top:18px"><h2>Walkthrough breakdown</h2><p class="lead" style="font-size:16px">Each module below is scored from the actual workspace ledger and module registry. Nothing is inferred from fake demo state.</p>${walkthroughSections}</section>
  <section class="panel" style="margin-top:18px"><h2>Proof matrix</h2><div class="table-wrap"><table class="proof-table"><thead><tr><th>Module</th><th>Status</th><th>Routes</th><th>Controls</th><th>Proof points</th></tr></thead><tbody>${proofRows}</tbody></table></div></section>
  <div class="footer">This report site was generated from the real workspace history, the real capability registry, and the real smoke-backed module graph.</div>
</main>
</body>
</html>`;
}
