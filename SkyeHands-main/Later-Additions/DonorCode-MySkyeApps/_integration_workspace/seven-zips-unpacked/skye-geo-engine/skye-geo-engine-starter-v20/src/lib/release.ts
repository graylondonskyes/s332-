import type { WorkspaceHistory } from './db.ts';
import type { ResolvedEnv } from './env.ts';
import { getCapabilityRegistry, type CapabilityModule } from './capabilities.ts';
import { cloneJson } from './json.ts';
import { buildProofMatrix, buildWalkthroughRun } from './reporting.ts';
import { buildReadinessRun } from './readiness.ts';
import { buildClaimEvidenceGraph, buildRuntimeContracts } from './runtimeContracts.ts';
import { buildStrategyActions, buildStrategyScorecard } from './strategy.ts';
import { nowIso } from './time.ts';

export type ReleaseGateCheck = {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
  source: string[];
};

export type ReleaseGate = {
  generatedAt: string;
  workspaceId: string;
  workspaceName: string;
  verdict: 'ship-ready' | 'conditional' | 'blocked';
  checks: ReleaseGateCheck[];
  summary: {
    pass: number;
    warn: number;
    fail: number;
    modulesComplete: number;
    modulesPartial: number;
    modulesPending: number;
    liveBlockers: number;
    strongestLane: string;
    weakestLane: string;
  };
  blockers: string[];
  strengths: string[];
};

export type DriftItem = {
  id: string;
  severity: 'low' | 'medium' | 'high';
  lane: string;
  title: string;
  detail: string;
  routes: string[];
  controls: string[];
  recommendedAction: string;
};

export type ReleaseDriftReport = {
  generatedAt: string;
  workspaceId: string;
  items: DriftItem[];
  summary: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
};

export type ReleasePack = {
  generatedAt: string;
  workspaceId: string;
  gate: ReleaseGate;
  drift: ReleaseDriftReport;
  weeklyRunbook: Array<{ title: string; lane: string; priority: number; successLooksLike: string }>;
};

function summarizeModuleStatus(gateModules: { title: string; score: number }[]) {
  const strongest = [...gateModules].sort((a, b) => b.score - a.score)[0]?.title || 'none';
  const weakest = [...gateModules].sort((a, b) => a.score - b.score)[0]?.title || 'none';
  return { strongest, weakest };
}

function pushCheck(target: ReleaseGateCheck[], check: ReleaseGateCheck) {
  target.push(check);
}

function addDrift(target: DriftItem[], item: DriftItem) {
  if (!target.some((existing) => existing.id === item.id)) target.push(item);
}

export function buildReleaseGate(env: ResolvedEnv, orgId: string, history: WorkspaceHistory, appHtml: string, modules = getCapabilityRegistry()): ReleaseGate {
  const coreModules = modules.filter((item) => item.id !== 'release');
  const proof = buildProofMatrix(orgId, history, coreModules);
  const walkthrough = buildWalkthroughRun(orgId, history, coreModules);
  const readiness = buildReadinessRun(env, orgId, history, coreModules);
  const runtime = buildRuntimeContracts(env, appHtml, coreModules);
  const claimEvidence = buildClaimEvidenceGraph(env, orgId, history, coreModules);
  const strategy = buildStrategyScorecard(env, orgId, history);

  const checks: ReleaseGateCheck[] = [];
  pushCheck(checks, {
    id: 'workspace-history',
    label: 'Workspace history is populated',
    status: history.projects.length && history.jobs.length ? 'pass' : history.projects.length ? 'warn' : 'fail',
    detail: history.projects.length && history.jobs.length ? `Projects=${history.projects.length}, jobs=${history.jobs.length}.` : history.projects.length ? 'Projects exist but job/activity depth is still shallow.' : 'Workspace has not been exercised deeply enough.',
    source: ['GET /v1/history']
  });
  pushCheck(checks, {
    id: 'audit-proof',
    label: 'Technical audit proof exists',
    status: history.auditRuns.length ? 'pass' : 'fail',
    detail: history.auditRuns.length ? `Audit runs=${history.auditRuns.length}.` : 'No persisted audit run exists yet.',
    source: ['POST /v1/audit/site']
  });
  pushCheck(checks, {
    id: 'research-proof',
    label: 'Source ledger is populated',
    status: history.sources.length ? 'pass' : 'fail',
    detail: history.sources.length ? `Sources=${history.sources.length}.` : 'Source ledger is empty.',
    source: ['POST /v1/research', 'GET /v1/research']
  });
  pushCheck(checks, {
    id: 'editorial-proof',
    label: 'Brief and article proof exists',
    status: history.briefs.length && history.articles.length ? 'pass' : history.briefs.length || history.articles.length ? 'warn' : 'fail',
    detail: history.briefs.length && history.articles.length ? `Briefs=${history.briefs.length}, articles=${history.articles.length}.` : 'Editorial chain is incomplete.',
    source: ['POST /v1/articles/brief', 'POST /v1/articles/draft']
  });
  pushCheck(checks, {
    id: 'publish-proof',
    label: 'Publishing execution exists',
    status: history.publishRuns.some((item) => item.status === 'success') ? 'pass' : history.publishRuns.length ? 'warn' : 'fail',
    detail: history.publishRuns.some((item) => item.status === 'success') ? `Successful publish runs=${history.publishRuns.filter((item) => item.status === 'success').length}.` : history.publishRuns.length ? 'Publish runs exist but no success has been observed.' : 'No publish run exists yet.',
    source: ['POST /v1/publish/execute']
  });
  pushCheck(checks, {
    id: 'visibility-proof',
    label: 'Visibility replay proof exists',
    status: history.visibilityRuns.length ? 'pass' : 'warn',
    detail: history.visibilityRuns.length ? `Visibility runs=${history.visibilityRuns.length}.` : 'Visibility replay has not yet been observed in this workspace.',
    source: ['POST /v1/visibility/replay']
  });
  pushCheck(checks, {
    id: 'proof-exports',
    label: 'Proof-facing exports exist',
    status: history.evidenceExports.some((item) => item.exportType === 'proof_site' || item.exportType === 'contract_pack' || item.exportType === 'report_site') ? 'pass' : 'warn',
    detail: history.evidenceExports.some((item) => item.exportType === 'proof_site' || item.exportType === 'contract_pack' || item.exportType === 'report_site') ? 'Proof/report exports are present in the evidence ledger.' : 'Proof/report exports are still missing from the evidence ledger.',
    source: ['POST /v1/proof/site', 'POST /v1/contracts/export', 'POST /v1/reports/export']
  });
  pushCheck(checks, {
    id: 'runtime-contracts',
    label: 'Runtime-contract blockers are under control',
    status: runtime.summary.blockedControls === 0 ? 'pass' : 'fail',
    detail: runtime.summary.blockedControls === 0 ? 'No blocked controls were found in the runtime contract pack.' : `Blocked controls=${runtime.summary.blockedControls}.`,
    source: ['GET /v1/runtime/contracts']
  });
  pushCheck(checks, {
    id: 'claim-evidence',
    label: 'Claim evidence graph exists',
    status: claimEvidence.summary.claims > 0 ? 'pass' : 'fail',
    detail: claimEvidence.summary.claims > 0 ? `Claims=${claimEvidence.summary.claims}, liveProofClaims=${claimEvidence.summary.liveProofClaims}.` : 'Claim evidence graph is empty.',
    source: ['GET /v1/claims/evidence']
  });
  pushCheck(checks, {
    id: 'proof-depth',
    label: 'Module proof depth is acceptable',
    status: proof.summary.pending === 0 ? 'pass' : proof.summary.complete >= Math.max(4, Math.floor(proof.summary.modules * 0.6)) ? 'warn' : 'fail',
    detail: `Complete=${proof.summary.complete}, partial=${proof.summary.partial}, pending=${proof.summary.pending}.`,
    source: ['GET /v1/proof/matrix']
  });
  pushCheck(checks, {
    id: 'walkthrough-depth',
    label: 'Walkthrough exercise depth is acceptable',
    status: walkthrough.summary.pending === 0 ? 'pass' : walkthrough.summary.complete >= Math.max(4, Math.floor(walkthrough.summary.modules * 0.5)) ? 'warn' : 'fail',
    detail: `Complete=${walkthrough.summary.complete}, partial=${walkthrough.summary.partial}, pending=${walkthrough.summary.pending}.`,
    source: ['GET /v1/walkthrough-runs']
  });
  const targetProbeExports = history.evidenceExports.filter((item) => item.exportType === 'target_probe');
  pushCheck(checks, {
    id: 'target-probe-coverage',
    label: 'Live target blockers are explicitly probed',
    status: targetProbeExports.length ? 'pass' : 'warn',
    detail: targetProbeExports.length ? `Target probes=${targetProbeExports.length}.` : 'No stored target probes exist yet.',
    source: ['POST /v1/targets/probe', 'GET /v1/targets/summary']
  });
  pushCheck(checks, {
    id: 'live-neon-proof',
    label: 'Live Neon target proof exists',
    status: env.dbMode === 'neon-http' ? 'pass' : 'warn',
    detail: env.dbMode === 'neon-http' ? 'Runtime is operating in Neon HTTP mode.' : 'Local proof exists, but live Neon target proof is still not observed in this runtime.',
    source: ['GET /v1/readiness/runs', 'GET /v1/history']
  });
  const remotePublishObserved = history.publishRuns.some((item) => item.status === 'success' && !!item.endpoint && /^https?:\/\//.test(item.endpoint) && !item.endpoint.includes('.local') && !item.endpoint.includes('localhost'));
  pushCheck(checks, {
    id: 'live-cms-proof',
    label: 'Live remote CMS proof exists',
    status: remotePublishObserved ? 'pass' : 'warn',
    detail: remotePublishObserved ? 'At least one remote provider publish success was observed.' : 'Only local or adapter-level publish proof has been observed so far.',
    source: ['POST /v1/publish/execute']
  });

  const fail = checks.filter((item) => item.status === 'fail').length;
  const warn = checks.filter((item) => item.status === 'warn').length;
  const pass = checks.filter((item) => item.status === 'pass').length;
  const liveBlockers = checks.filter((item) => item.id === 'live-neon-proof' || item.id === 'live-cms-proof').filter((item) => item.status !== 'pass').length;
  const verdict: ReleaseGate['verdict'] = fail ? 'blocked' : warn ? 'conditional' : 'ship-ready';
  const laneSummary = summarizeModuleStatus(strategy.modules.map((item) => ({ title: item.title, score: item.score })));

  return {
    generatedAt: nowIso(),
    workspaceId: history.workspace.id,
    workspaceName: history.workspace.name,
    verdict,
    checks,
    summary: {
      pass,
      warn,
      fail,
      modulesComplete: proof.summary.complete,
      modulesPartial: proof.summary.partial,
      modulesPending: proof.summary.pending,
      liveBlockers,
      strongestLane: laneSummary.strongest,
      weakestLane: laneSummary.weakest
    },
    blockers: checks.filter((item) => item.status === 'fail' || item.status === 'warn').map((item) => `${item.label}: ${item.detail}`),
    strengths: checks.filter((item) => item.status === 'pass').map((item) => `${item.label}: ${item.detail}`)
  };
}

export function buildReleaseDriftReport(env: ResolvedEnv, orgId: string, history: WorkspaceHistory, appHtml: string, modules = getCapabilityRegistry()): ReleaseDriftReport {
  const coreModules = modules.filter((item) => item.id !== 'release');
  const proof = buildProofMatrix(orgId, history, coreModules);
  const walkthrough = buildWalkthroughRun(orgId, history, coreModules);
  const readiness = buildReadinessRun(env, orgId, history, coreModules);
  const runtime = buildRuntimeContracts(env, appHtml, coreModules);
  const strategy = buildStrategyActions(env, orgId, history);
  const items: DriftItem[] = [];

  for (const module of proof.modules) {
    if (module.status === 'pending' || module.status === 'partial') {
      const walkthroughModule = walkthrough.modules.find((item) => item.id === module.id);
      addDrift(items, {
        id: `module_${module.id}`,
        severity: module.status === 'pending' ? 'high' : 'medium',
        lane: module.title,
        title: `${module.title} is not fully exercised`,
        detail: `Proof status is ${module.status}. Walkthrough status is ${walkthroughModule?.status || 'pending'}.`,
        routes: cloneJson(coreModules.find((item) => item.id === module.id)?.routes || []),
        controls: cloneJson(coreModules.find((item) => item.id === module.id)?.controls || []),
        recommendedAction: `Drive the ${module.title.toLowerCase()} lane through its remaining walkthrough steps and generate stored evidence.`
      });
    }
  }

  for (const activation of readiness.modules) {
    if (activation.status === 'conditional' || activation.status === 'blocked') {
      addDrift(items, {
        id: `activation_${activation.id}`,
        severity: activation.status === 'blocked' ? 'high' : 'medium',
        lane: activation.title,
        title: `${activation.title} still has readiness blockers`,
        detail: activation.blockers.join(' ') || activation.notes.join(' ') || 'Readiness still reports unresolved blockers.',
        routes: cloneJson(activation.routes),
        controls: cloneJson(activation.controls),
        recommendedAction: activation.status === 'blocked' ? 'Resolve the blocker and re-run readiness.' : 'Capture the stronger live proof needed for this lane.'
      });
    }
  }

  const targetProbeExports = history.evidenceExports.filter((item) => item.exportType === 'target_probe');
  if (!targetProbeExports.length) {
    addDrift(items, {
      id: 'target_probe_missing',
      severity: 'medium',
      lane: 'Live target probes',
      title: 'Target blockers have not been probed yet',
      detail: 'The workspace has not stored a target probe for Neon or any provider target, so launch blockers are still inferred instead of observed.',
      routes: ['POST /v1/targets/probe', 'GET /v1/targets/summary'],
      controls: ['run-target-probe', 'load-target-summary'],
      recommendedAction: 'Probe your live-target candidates and export a target pack before calling the product launch-ready.'
    });
  }

  if (runtime.summary.blockedControls > 0) {
    addDrift(items, {
      id: 'runtime_controls',
      severity: 'high',
      lane: 'Runtime truth',
      title: 'Blocked runtime controls are still present',
      detail: `Runtime contracts reported ${runtime.summary.blockedControls} blocked controls.`,
      routes: ['GET /v1/runtime/contracts'],
      controls: ['load-runtime-contracts'],
      recommendedAction: 'Resolve the blocker path or remove the unsupported control from the shipped surface.'
    });
  }

  if (env.dbMode !== 'neon-http') {
    addDrift(items, {
      id: 'live_neon',
      severity: 'medium',
      lane: 'Persistence',
      title: 'Live Neon proof drift remains open',
      detail: 'The runtime is not currently operating in live Neon mode.',
      routes: ['GET /v1/readiness/runs'],
      controls: ['run-readiness'],
      recommendedAction: 'Switch to a live Neon target and capture an end-to-end readback proof.'
    });
  }

  const remotePublishObserved = history.publishRuns.some((item) => item.status === 'success' && !!item.endpoint && /^https?:\/\//.test(item.endpoint) && !item.endpoint.includes('.local') && !item.endpoint.includes('localhost'));
  if (!remotePublishObserved) {
    addDrift(items, {
      id: 'live_remote_publish',
      severity: 'medium',
      lane: 'Publishing',
      title: 'Remote provider publish proof remains open',
      detail: 'Only local or adapter-level publish proof has been observed so far.',
      routes: ['POST /v1/publish/execute'],
      controls: ['run-publish-execute'],
      recommendedAction: 'Execute a publish run against a real external CMS target and retain the response in the publish ledger.'
    });
  }

  for (const action of strategy.actions.slice(0, 5)) {
    addDrift(items, {
      id: `strategy_${action.id}`,
      severity: action.priority <= 2 ? 'medium' : 'low',
      lane: action.lane,
      title: action.title,
      detail: action.why,
      routes: cloneJson(action.routes),
      controls: cloneJson(action.controls),
      recommendedAction: action.successLooksLike
    });
  }

  return {
    generatedAt: nowIso(),
    workspaceId: history.workspace.id,
    items,
    summary: {
      total: items.length,
      high: items.filter((item) => item.severity === 'high').length,
      medium: items.filter((item) => item.severity === 'medium').length,
      low: items.filter((item) => item.severity === 'low').length
    }
  };
}

export function buildReleasePack(env: ResolvedEnv, orgId: string, history: WorkspaceHistory, appHtml: string, modules = getCapabilityRegistry()): ReleasePack {
  const gate = buildReleaseGate(env, orgId, history, appHtml, modules);
  const drift = buildReleaseDriftReport(env, orgId, history, appHtml, modules);
  const strategy = buildStrategyActions(env, orgId, history);
  return {
    generatedAt: nowIso(),
    workspaceId: history.workspace.id,
    gate,
    drift,
    weeklyRunbook: strategy.actions.slice(0, 7).map((item) => ({ title: item.title, lane: item.lane, priority: item.priority, successLooksLike: item.successLooksLike }))
  };
}

export function renderReleaseSite(input: { workspaceName: string; pack: ReleasePack }): string {
  const { workspaceName, pack } = input;
  const gateRows = pack.gate.checks.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${item.status}</td><td>${escapeHtml(item.detail)}</td></tr>`).join('');
  const driftRows = pack.drift.items.map((item) => `<tr><td>${escapeHtml(item.lane)}</td><td>${item.severity}</td><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.recommendedAction)}</td></tr>`).join('');
  const runbook = pack.weeklyRunbook.map((item) => `<li><strong>${escapeHtml(item.title)}</strong> · ${escapeHtml(item.lane)} · priority ${item.priority}<br/><span>${escapeHtml(item.successLooksLike)}</span></li>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(workspaceName)} · Release Gate</title>
  <style>
    :root { color-scheme: dark; --bg:#07111f; --panel:#0f1b31; --line:#223557; --text:#f4f7fb; --muted:#9fb3cf; --accent:#8d7bff; }
    body { margin:0; font-family: Inter, system-ui, sans-serif; background: radial-gradient(circle at top, #16274e 0%, #07111f 55%); color:var(--text); }
    .shell { max-width:1200px; margin:0 auto; padding:24px; }
    .hero, .panel { border:1px solid var(--line); border-radius:24px; background:rgba(10,18,34,.88); padding:24px; margin-bottom:18px; }
    h1,h2,p { margin:0; }
    p { color:var(--muted); }
    .grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(240px,1fr)); gap:12px; margin-top:16px; }
    .pill { border:1px solid var(--line); border-radius:18px; padding:14px; background:#08111f; }
    table { width:100%; border-collapse: collapse; margin-top:12px; }
    th, td { border-top:1px solid var(--line); padding:10px; text-align:left; vertical-align:top; }
    ul { margin:12px 0 0 18px; color:var(--muted); }
  </style>
</head>
<body>
  <div class="shell">
    <section class="hero">
      <h1>${escapeHtml(workspaceName)} · Release gate</h1>
      <p>Generated ${escapeHtml(pack.generatedAt)} · verdict: <strong>${escapeHtml(pack.gate.verdict)}</strong></p>
      <div class="grid">
        <div class="pill"><strong>Pass</strong><div>${pack.gate.summary.pass}</div></div>
        <div class="pill"><strong>Warn</strong><div>${pack.gate.summary.warn}</div></div>
        <div class="pill"><strong>Fail</strong><div>${pack.gate.summary.fail}</div></div>
        <div class="pill"><strong>Live blockers</strong><div>${pack.gate.summary.liveBlockers}</div></div>
      </div>
    </section>
    <section class="panel">
      <h2>Release checks</h2>
      <table><thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead><tbody>${gateRows}</tbody></table>
    </section>
    <section class="panel">
      <h2>Drift report</h2>
      <table><thead><tr><th>Lane</th><th>Severity</th><th>Issue</th><th>Action</th></tr></thead><tbody>${driftRows}</tbody></table>
    </section>
    <section class="panel">
      <h2>Weekly runbook</h2>
      <ul>${runbook}</ul>
    </section>
  </div>
</body>
</html>`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
