import type { WorkspaceHistory } from './db.ts';
import type { ResolvedEnv } from './env.ts';
import { getCapabilityRegistry } from './capabilities.ts';
import { buildReleaseGate, buildReleaseDriftReport } from './release.ts';
import { buildTargetProbeSummary } from './targets.ts';
import { buildReadinessRun } from './readiness.ts';
import { nowIso } from './time.ts';

export type CutoverCheck = {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
  source: string[];
  nextAction: string;
};

export type CutoverRun = {
  generatedAt: string;
  workspaceId: string;
  workspaceName: string;
  verdict: 'ready' | 'conditional' | 'blocked';
  checks: CutoverCheck[];
  summary: {
    pass: number;
    warn: number;
    fail: number;
    liveProofBlockers: number;
    releaseVerdict: string;
    targetProbeCount: number;
    successfulPublishes: number;
  };
  handoffNotes: string[];
};

export type CutoverSummary = {
  generatedAt: string;
  workspaceId: string;
  workspaceName: string;
  runs: number;
  latestVerdict: CutoverRun['verdict'] | 'none';
  latestRunAt: string | null;
  latestRun: CutoverRun | null;
};

export type CutoverPack = {
  generatedAt: string;
  workspaceId: string;
  summary: CutoverSummary;
  run: CutoverRun;
  release: ReturnType<typeof buildReleaseGate>;
  drift: ReturnType<typeof buildReleaseDriftReport>;
  handoffChecklist: Array<{ title: string; owner: string; successLooksLike: string }>;
};

function buildChecks(env: ResolvedEnv, orgId: string, history: WorkspaceHistory, appHtml: string): {
  checks: CutoverCheck[];
  release: ReturnType<typeof buildReleaseGate>;
  drift: ReturnType<typeof buildReleaseDriftReport>;
  targetProbeCount: number;
  successfulPublishes: number;
} {
  const modules = getCapabilityRegistry();
  const release = buildReleaseGate(env, orgId, history, appHtml, modules);
  const drift = buildReleaseDriftReport(env, orgId, history, appHtml, modules);
  const readiness = buildReadinessRun(env, orgId, history, modules.filter((item) => item.id !== 'cutover'));
  const targets = buildTargetProbeSummary(history);
  const successfulPublishes = history.publishRuns.filter((item) => item.status === 'success').length;
  const hasRollbackBundle = history.evidenceExports.some((item) => item.exportType === 'workspace_bundle');

  const checks: CutoverCheck[] = [
    {
      id: 'release-verdict',
      label: 'Release gate is not blocked',
      status: release.verdict === 'ship-ready' ? 'pass' : release.verdict === 'conditional' ? 'warn' : 'fail',
      detail: `Release verdict=${release.verdict}.`,
      source: ['GET /v1/release/gate'],
      nextAction: release.verdict === 'ship-ready' ? 'Keep drift under control.' : 'Clear blocked or conditional release checks before cutover.'
    },
    {
      id: 'target-probes',
      label: 'Live target probes exist',
      status: targets.summary.probes >= 2 ? 'pass' : targets.summary.probes === 1 ? 'warn' : 'fail',
      detail: `Target probes=${targets.summary.probes}, reachable=${targets.summary.reachable}, blocked=${targets.summary.blocked}.`,
      source: ['GET /v1/targets/summary', 'POST /v1/targets/probe'],
      nextAction: targets.summary.probes >= 2 ? 'Keep target evidence fresh.' : 'Run Neon and provider probes before calling cutover ready.'
    },
    {
      id: 'publish-proof',
      label: 'At least one publish execution succeeded',
      status: successfulPublishes > 0 ? 'pass' : history.publishRuns.length > 0 ? 'warn' : 'fail',
      detail: `Successful publish runs=${successfulPublishes}.`,
      source: ['POST /v1/publish/execute'],
      nextAction: successfulPublishes > 0 ? 'Preserve latest publish evidence in the handoff pack.' : 'Execute and verify a publish run.'
    },
    {
      id: 'readiness-depth',
      label: 'Readiness map exists',
      status: readiness.summary.modules > 0 ? 'pass' : 'fail',
      detail: `Readiness modules=${readiness.summary.modules}, blocked=${readiness.summary.blocked}.`,
      source: ['POST /v1/readiness/run'],
      nextAction: readiness.summary.modules > 0 ? 'Use readiness blockers in handoff notes.' : 'Run readiness before cutover.'
    },
    {
      id: 'rollback-evidence',
      label: 'Rollback / recovery evidence exists',
      status: hasRollbackBundle ? 'pass' : 'warn',
      detail: hasRollbackBundle ? 'Workspace bundle export is present.' : 'No workspace bundle export was found in evidence.',
      source: ['POST /v1/workspace-bundles/export'],
      nextAction: 'Export a fresh workspace bundle before production cutover.'
    },
    {
      id: 'drift-depth',
      label: 'Drift count is under control',
      status: drift.summary.high === 0 ? 'pass' : drift.summary.high <= 2 ? 'warn' : 'fail',
      detail: `High drift=${drift.summary.high}, total drift=${drift.summary.total}.`,
      source: ['GET /v1/release/drift'],
      nextAction: drift.summary.high === 0 ? 'Monitor drift after cutover.' : 'Reduce high-severity drift before final release.'
    }
  ];

  return { checks, release, drift, targetProbeCount: targets.summary.probes, successfulPublishes };
}

export function buildCutoverRun(env: ResolvedEnv, orgId: string, history: WorkspaceHistory, appHtml: string): CutoverRun {
  const { checks, release, targetProbeCount, successfulPublishes } = buildChecks(env, orgId, history, appHtml);
  const pass = checks.filter((item) => item.status === 'pass').length;
  const warn = checks.filter((item) => item.status === 'warn').length;
  const fail = checks.filter((item) => item.status === 'fail').length;
  const liveProofBlockers = checks.filter((item) => item.id === 'target-probes' || item.id === 'publish-proof').filter((item) => item.status !== 'pass').length;
  const verdict: CutoverRun['verdict'] = fail ? 'blocked' : warn ? 'conditional' : 'ready';
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
      liveProofBlockers,
      releaseVerdict: release.verdict,
      targetProbeCount,
      successfulPublishes
    },
    handoffNotes: checks.filter((item) => item.status !== 'pass').map((item) => `${item.label}: ${item.nextAction}`)
  };
}

export function buildCutoverSummary(env: ResolvedEnv, orgId: string, history: WorkspaceHistory, appHtml: string): CutoverSummary {
  const latest = history.evidenceExports
    .filter((item) => item.exportType === 'cutover_run')
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] || null;
  const latestRun = (latest?.payload as Record<string, unknown> | undefined)?.cutoverRun as CutoverRun | undefined;
  return {
    generatedAt: nowIso(),
    workspaceId: history.workspace.id,
    workspaceName: history.workspace.name,
    runs: history.evidenceExports.filter((item) => item.exportType === 'cutover_run').length,
    latestVerdict: latestRun?.verdict || 'none',
    latestRunAt: latest?.createdAt || null,
    latestRun: latestRun || buildCutoverRun(env, orgId, history, appHtml)
  };
}

export function buildCutoverPack(env: ResolvedEnv, orgId: string, history: WorkspaceHistory, appHtml: string): CutoverPack {
  const run = buildCutoverRun(env, orgId, history, appHtml);
  const { release, drift } = buildChecks(env, orgId, history, appHtml);
  return {
    generatedAt: nowIso(),
    workspaceId: history.workspace.id,
    summary: buildCutoverSummary(env, orgId, history, appHtml),
    run,
    release,
    drift,
    handoffChecklist: [
      { title: 'Freeze evidence exports', owner: 'operator', successLooksLike: 'Proof, report, release, target, and cutover exports all exist in the workspace evidence ledger.' },
      { title: 'Verify live targets', owner: 'operator', successLooksLike: 'Neon and CMS probes are present and current.' },
      { title: 'Verify publish execution', owner: 'operator', successLooksLike: 'At least one publish run succeeded and is recorded.' },
      { title: 'Capture rollback bundle', owner: 'operator', successLooksLike: 'A workspace bundle export exists for rollback and restore.' }
    ]
  };
}

function esc(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function renderCutoverSite(input: { workspaceName: string; pack: CutoverPack }): string {
  const checksHtml = input.pack.run.checks.map((item) => `<tr><td>${esc(item.label)}</td><td>${esc(item.status)}</td><td>${esc(item.detail)}</td><td>${esc(item.nextAction)}</td></tr>`).join('');
  const checklistHtml = input.pack.handoffChecklist.map((item) => `<li><strong>${esc(item.title)}</strong> · ${esc(item.owner)} · ${esc(item.successLooksLike)}</li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${esc(input.workspaceName)} · Cutover Pack</title><style>body{font-family:Inter,system-ui,sans-serif;background:#08111f;color:#eef3ff;padding:28px}section{background:#101c31;border:1px solid #284061;border-radius:18px;padding:18px;margin:0 0 18px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #2a4268;padding:10px;vertical-align:top}th{text-align:left;background:#13243c}li{margin:8px 0}code{color:#b4c8ff}</style></head><body><section><h1>${esc(input.workspaceName)} · Cutover Pack</h1><p>Generated ${esc(input.pack.generatedAt)}. This cutover pack is built from real workspace ledger state, release truth, target probes, and readiness evidence.</p><p><strong>Verdict:</strong> ${esc(input.pack.run.verdict)}</p></section><section><h2>Cutover checks</h2><table><thead><tr><th>Check</th><th>Status</th><th>Detail</th><th>Next action</th></tr></thead><tbody>${checksHtml}</tbody></table></section><section><h2>Handoff checklist</h2><ul>${checklistHtml}</ul></section><section><h2>Release and drift snapshot</h2><p><strong>Release verdict:</strong> ${esc(input.pack.release.verdict)}</p><p><strong>High drift:</strong> ${input.pack.drift.summary.high} · <strong>Total drift:</strong> ${input.pack.drift.summary.total}</p></section></body></html>`;
}
