import type { WorkspaceHistory } from './db.ts';
import type { ResolvedEnv } from './env.ts';
import { getCapabilityRegistry } from './capabilities.ts';
import { buildReleaseGate, buildReleaseDriftReport } from './release.ts';
import { buildTargetProbeSummary } from './targets.ts';
import { buildCutoverSummary } from './cutover.ts';
import { nowIso } from './time.ts';

export type RollbackCheck = {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
  source: string[];
  nextAction: string;
};

export type RollbackRun = {
  generatedAt: string;
  workspaceId: string;
  workspaceName: string;
  verdict: 'recoverable' | 'conditional' | 'blocked';
  summary: {
    pass: number;
    warn: number;
    fail: number;
    latestBundleAgeHours: number | null;
    successfulPublishes: number;
    failedPublishes: number;
    cutoverRuns: number;
    targetProbes: number;
  };
  restorePoint: {
    workspaceBundleExportId: string | null;
    workspaceBundleCreatedAt: string | null;
    cutoverExportId: string | null;
    cutoverCreatedAt: string | null;
  };
  checks: RollbackCheck[];
  restoreSteps: Array<{ step: number; title: string; action: string; successLooksLike: string }>;
};

export type RollbackSummary = {
  generatedAt: string;
  workspaceId: string;
  workspaceName: string;
  runs: number;
  latestVerdict: RollbackRun['verdict'] | 'none';
  latestRunAt: string | null;
  latestRun: RollbackRun | null;
};

export type RollbackPack = {
  generatedAt: string;
  workspaceId: string;
  summary: RollbackSummary;
  run: RollbackRun;
  release: ReturnType<typeof buildReleaseGate>;
  drift: ReturnType<typeof buildReleaseDriftReport>;
  operatorNotes: string[];
};

function ageHours(iso: string | null): number | null {
  if (!iso) return null;
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return null;
  return Math.max(0, Math.round(((Date.now() - ts) / 36e5) * 10) / 10);
}

function latestByType(history: WorkspaceHistory, exportType: string) {
  return history.evidenceExports
    .filter((item) => item.exportType === exportType)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] || null;
}

function buildChecks(env: ResolvedEnv, orgId: string, history: WorkspaceHistory, appHtml: string) {
  const modules = getCapabilityRegistry();
  const release = buildReleaseGate(env, orgId, history, appHtml, modules);
  const drift = buildReleaseDriftReport(env, orgId, history, appHtml, modules);
  const targets = buildTargetProbeSummary(history);
  const cutover = buildCutoverSummary(env, orgId, history, appHtml);
  const latestBundle = latestByType(history, 'workspace_bundle');
  const latestCutover = latestByType(history, 'cutover_run');
  const latestBundleAgeHours = ageHours(latestBundle?.createdAt || null);
  const successfulPublishes = history.publishRuns.filter((item) => item.status === 'success').length;
  const failedPublishes = history.publishRuns.filter((item) => item.status === 'failed').length;

  const checks: RollbackCheck[] = [
    {
      id: 'bundle-restore-point',
      label: 'Workspace bundle restore point exists',
      status: latestBundle ? 'pass' : 'fail',
      detail: latestBundle ? `Latest workspace bundle export ${latestBundle.id} was recorded at ${latestBundle.createdAt}.` : 'No workspace bundle export exists for restore.',
      source: ['POST /v1/workspace-bundles/export'],
      nextAction: latestBundle ? 'Keep bundle exports fresh before risky publishes or cutover.' : 'Export a workspace bundle before declaring rollback viable.'
    },
    {
      id: 'bundle-freshness',
      label: 'Restore point freshness is acceptable',
      status: latestBundleAgeHours == null ? 'fail' : latestBundleAgeHours <= 24 ? 'pass' : latestBundleAgeHours <= 72 ? 'warn' : 'fail',
      detail: latestBundleAgeHours == null ? 'Bundle age could not be determined.' : `Latest workspace bundle is ${latestBundleAgeHours} hours old.`,
      source: ['POST /v1/workspace-bundles/export'],
      nextAction: latestBundleAgeHours != null && latestBundleAgeHours <= 24 ? 'Rotate restore point after major publish or release actions.' : 'Create a fresh bundle before trusting rollback timing.'
    },
    {
      id: 'cutover-evidence',
      label: 'Cutover evidence exists to anchor rollback timing',
      status: latestCutover ? 'pass' : 'warn',
      detail: latestCutover ? `Cutover run ${latestCutover.id} exists from ${latestCutover.createdAt}.` : 'No cutover run exists yet.',
      source: ['POST /v1/cutover/run'],
      nextAction: latestCutover ? 'Use latest cutover run as the rollback timing anchor.' : 'Run cutover before production release so rollback has a clear handoff point.'
    },
    {
      id: 'publish-evidence',
      label: 'Publish evidence exists for replay and rollback verification',
      status: successfulPublishes >= 1 ? 'pass' : failedPublishes >= 1 ? 'warn' : 'fail',
      detail: `Successful publishes=${successfulPublishes}, failed publishes=${failedPublishes}.`,
      source: ['POST /v1/publish/execute', 'POST /v1/publish/retry'],
      nextAction: successfulPublishes >= 1 ? 'Use publish evidence to verify whether rollback reversed the right entries.' : 'Run a real publish flow before claiming rollback verification is complete.'
    },
    {
      id: 'target-probe-depth',
      label: 'Target probes exist for rollback verification',
      status: targets.summary.probes >= 2 ? 'pass' : targets.summary.probes === 1 ? 'warn' : 'fail',
      detail: `Target probes=${targets.summary.probes}, reachable=${targets.summary.reachable}, unreachable=${targets.summary.unreachable}, blocked=${targets.summary.blocked}.`,
      source: ['POST /v1/targets/probe'],
      nextAction: targets.summary.probes >= 2 ? 'Reuse target probes after rollback to verify restoration state.' : 'Probe Neon and provider targets before trusting rollback verification.'
    },
    {
      id: 'release-drift',
      label: 'Release drift is controlled enough for deterministic rollback',
      status: drift.summary.high === 0 ? 'pass' : drift.summary.high <= 2 ? 'warn' : 'fail',
      detail: `High drift=${drift.summary.high}, total drift=${drift.summary.total}, release verdict=${release.verdict}.`,
      source: ['GET /v1/release/drift', 'GET /v1/release/gate'],
      nextAction: drift.summary.high === 0 ? 'Preserve current release pack with the rollback artifacts.' : 'Reduce high drift before counting on deterministic rollback.'
    },
    {
      id: 'cutover-verdict',
      label: 'Latest cutover verdict is not blocked',
      status: cutover.latestVerdict === 'ready' ? 'pass' : cutover.latestVerdict === 'conditional' ? 'warn' : 'fail',
      detail: `Latest cutover verdict=${cutover.latestVerdict}.`,
      source: ['GET /v1/cutover/summary'],
      nextAction: ['ready', 'conditional'].includes(cutover.latestVerdict) ? 'Use cutover notes to guide rollback communications.' : 'Run cutover and clear blockers before shipping or trusting rollback claims.'
    }
  ];

  return {
    checks,
    release,
    drift,
    latestBundle,
    latestCutover,
    latestBundleAgeHours,
    successfulPublishes,
    failedPublishes,
    cutoverRuns: history.evidenceExports.filter((item) => item.exportType === 'cutover_run').length,
    targetProbes: targets.summary.probes
  };
}

export function buildRollbackRun(env: ResolvedEnv, orgId: string, history: WorkspaceHistory, appHtml: string): RollbackRun {
  const facts = buildChecks(env, orgId, history, appHtml);
  const pass = facts.checks.filter((item) => item.status === 'pass').length;
  const warn = facts.checks.filter((item) => item.status === 'warn').length;
  const fail = facts.checks.filter((item) => item.status === 'fail').length;
  const verdict: RollbackRun['verdict'] = fail ? 'blocked' : warn ? 'conditional' : 'recoverable';
  return {
    generatedAt: nowIso(),
    workspaceId: history.workspace.id,
    workspaceName: history.workspace.name,
    verdict,
    summary: {
      pass,
      warn,
      fail,
      latestBundleAgeHours: facts.latestBundleAgeHours,
      successfulPublishes: facts.successfulPublishes,
      failedPublishes: facts.failedPublishes,
      cutoverRuns: facts.cutoverRuns,
      targetProbes: facts.targetProbes
    },
    restorePoint: {
      workspaceBundleExportId: facts.latestBundle?.id || null,
      workspaceBundleCreatedAt: facts.latestBundle?.createdAt || null,
      cutoverExportId: facts.latestCutover?.id || null,
      cutoverCreatedAt: facts.latestCutover?.createdAt || null
    },
    checks: facts.checks,
    restoreSteps: [
      { step: 1, title: 'Freeze current evidence', action: 'Export a fresh workspace bundle and preserve the current release/cutover artifacts.', successLooksLike: 'A current restore point and cutover anchor both exist.' },
      { step: 2, title: 'Restore workspace state', action: 'Re-import the latest workspace bundle into a fresh rollback workspace or use the saved clone path.', successLooksLike: 'Projects, articles, publish runs, evidence exports, and settings all reload without id collisions.' },
      { step: 3, title: 'Verify target health', action: 'Re-run Neon and provider target probes after the restore.', successLooksLike: 'Target summary reflects the expected post-rollback state.' },
      { step: 4, title: 'Verify publish state', action: 'Compare publish evidence and live URLs against the intended recovery point.', successLooksLike: 'Operator can prove whether content needs republish, deletion, or no-op.' }
    ]
  };
}

export function buildRollbackSummary(env: ResolvedEnv, orgId: string, history: WorkspaceHistory, appHtml: string): RollbackSummary {
  const latest = latestByType(history, 'rollback_run');
  const latestRun = (latest?.payload as Record<string, unknown> | undefined)?.rollbackRun as RollbackRun | undefined;
  return {
    generatedAt: nowIso(),
    workspaceId: history.workspace.id,
    workspaceName: history.workspace.name,
    runs: history.evidenceExports.filter((item) => item.exportType === 'rollback_run').length,
    latestVerdict: latestRun?.verdict || 'none',
    latestRunAt: latest?.createdAt || null,
    latestRun: latestRun || buildRollbackRun(env, orgId, history, appHtml)
  };
}

export function buildRollbackPack(env: ResolvedEnv, orgId: string, history: WorkspaceHistory, appHtml: string): RollbackPack {
  const run = buildRollbackRun(env, orgId, history, appHtml);
  const facts = buildChecks(env, orgId, history, appHtml);
  return {
    generatedAt: nowIso(),
    workspaceId: history.workspace.id,
    summary: buildRollbackSummary(env, orgId, history, appHtml),
    run,
    release: facts.release,
    drift: facts.drift,
    operatorNotes: run.checks.filter((item) => item.status !== 'pass').map((item) => `${item.label}: ${item.nextAction}`)
  };
}

function esc(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function renderRollbackSite(input: { workspaceName: string; pack: RollbackPack }): string {
  const checksHtml = input.pack.run.checks.map((item) => `<tr><td>${esc(item.label)}</td><td>${esc(item.status)}</td><td>${esc(item.detail)}</td><td>${esc(item.nextAction)}</td></tr>`).join('');
  const stepsHtml = input.pack.run.restoreSteps.map((item) => `<li><strong>${item.step}. ${esc(item.title)}</strong> · ${esc(item.action)} · ${esc(item.successLooksLike)}</li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${esc(input.workspaceName)} · Rollback Pack</title><style>body{font-family:Inter,system-ui,sans-serif;background:#07111f;color:#eef3ff;padding:28px}section{background:#0f1b31;border:1px solid #284061;border-radius:18px;padding:18px;margin:0 0 18px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #2a4268;padding:10px;vertical-align:top}th{text-align:left;background:#13243c}li{margin:8px 0}</style></head><body><section><h1>${esc(input.workspaceName)} · Rollback Pack</h1><p>Generated ${esc(input.pack.generatedAt)} from live workspace ledger state, bundle evidence, cutover evidence, publish evidence, and target probes.</p><p><strong>Verdict:</strong> ${esc(input.pack.run.verdict)}</p></section><section><h2>Rollback checks</h2><table><thead><tr><th>Check</th><th>Status</th><th>Detail</th><th>Next action</th></tr></thead><tbody>${checksHtml}</tbody></table></section><section><h2>Restore steps</h2><ol>${stepsHtml}</ol></section><section><h2>Restore point</h2><p><strong>Bundle export:</strong> ${esc(input.pack.run.restorePoint.workspaceBundleExportId || 'none')} · ${esc(input.pack.run.restorePoint.workspaceBundleCreatedAt || 'none')}</p><p><strong>Cutover export:</strong> ${esc(input.pack.run.restorePoint.cutoverExportId || 'none')} · ${esc(input.pack.run.restorePoint.cutoverCreatedAt || 'none')}</p></section></body></html>`;
}
