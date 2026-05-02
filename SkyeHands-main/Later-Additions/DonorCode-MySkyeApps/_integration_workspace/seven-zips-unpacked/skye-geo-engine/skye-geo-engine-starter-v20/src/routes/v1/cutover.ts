import { getDb } from '../../lib/db.ts';
import { resolveEnv } from '../../lib/env.ts';
import { AppError } from '../../lib/errors.ts';
import { assertNonEmpty, json } from '../../lib/http.ts';
import { buildCutoverPack, buildCutoverRun, buildCutoverSummary, renderCutoverSite } from '../../lib/cutover.ts';
import { readTenantScope } from '../../lib/tenant.ts';
import { renderApp } from '../../ui/app.ts';

export async function handleCutover(request: Request, runtimeEnv: unknown): Promise<Response> {
  const env = resolveEnv(runtimeEnv);
  const db = getDb(env);
  const url = new URL(request.url);
  const appHtml = renderApp();

  if (url.pathname === '/v1/cutover/summary' && request.method === 'GET') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const history = await db.getWorkspaceHistory(scope.orgId, workspaceId);
    const summary = buildCutoverSummary(env, scope.orgId, history, appHtml);
    return json({ ok: summary.latestVerdict !== 'blocked', summary });
  }

  if (url.pathname === '/v1/cutover/runs' && request.method === 'GET') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const history = await db.getWorkspaceHistory(scope.orgId, workspaceId);
    const items = history.evidenceExports.filter((item) => item.exportType === 'cutover_run');
    return json({ ok: true, items });
  }

  if (url.pathname === '/v1/cutover/run' && request.method === 'POST') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const history = await db.getWorkspaceHistory(scope.orgId, workspaceId);
    const cutoverRun = buildCutoverRun(env, scope.orgId, history, appHtml);
    const exportRecord = await db.insertEvidenceExport({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId,
      exportType: 'cutover_run',
      subjectType: 'workspace',
      subjectId: workspaceId,
      payload: { cutoverRun } as Record<string, unknown>
    });
    await db.createJob({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId,
      type: 'cutover.run',
      status: 'completed',
      summary: `Generated cutover run ${exportRecord.id}`,
      metadata: { exportId: exportRecord.id, verdict: cutoverRun.verdict, blockers: cutoverRun.summary.fail + cutoverRun.summary.warn }
    });
    return json({ ok: cutoverRun.verdict !== 'blocked', cutoverRun, exportRecord });
  }

  if (url.pathname === '/v1/cutover/export' && request.method === 'POST') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const history = await db.getWorkspaceHistory(scope.orgId, workspaceId);
    const cutoverPack = buildCutoverPack(env, scope.orgId, history, appHtml);
    const html = renderCutoverSite({ workspaceName: history.workspace.name, pack: cutoverPack });
    const exportRecord = await db.insertEvidenceExport({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId,
      exportType: 'cutover_pack',
      subjectType: 'workspace',
      subjectId: workspaceId,
      payload: { cutoverPack, html } as Record<string, unknown>
    });
    await db.createJob({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId,
      type: 'cutover.export',
      status: 'completed',
      summary: `Exported cutover pack ${exportRecord.id}`,
      metadata: { exportId: exportRecord.id, verdict: cutoverPack.run.verdict, checks: cutoverPack.run.checks.length }
    });
    return json({ ok: true, cutoverPack, html, exportRecord });
  }

  throw new AppError(405, 'method_not_allowed', 'Method not allowed.');
}
