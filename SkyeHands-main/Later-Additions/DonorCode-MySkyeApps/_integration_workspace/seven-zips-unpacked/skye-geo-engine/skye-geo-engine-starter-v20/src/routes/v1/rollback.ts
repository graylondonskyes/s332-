import { getDb } from '../../lib/db.ts';
import { resolveEnv } from '../../lib/env.ts';
import { AppError } from '../../lib/errors.ts';
import { assertNonEmpty, json } from '../../lib/http.ts';
import { buildRollbackPack, buildRollbackRun, buildRollbackSummary, renderRollbackSite } from '../../lib/rollback.ts';
import { readTenantScope } from '../../lib/tenant.ts';
import { renderApp } from '../../ui/app.ts';

export async function handleRollback(request: Request, runtimeEnv: unknown): Promise<Response> {
  const env = resolveEnv(runtimeEnv);
  const db = getDb(env);
  const url = new URL(request.url);
  const appHtml = renderApp();

  if (url.pathname === '/v1/rollback/summary' && request.method === 'GET') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const history = await db.getWorkspaceHistory(scope.orgId, workspaceId);
    const summary = buildRollbackSummary(env, scope.orgId, history, appHtml);
    return json({ ok: summary.latestVerdict !== 'blocked', summary });
  }

  if (url.pathname === '/v1/rollback/runs' && request.method === 'GET') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const history = await db.getWorkspaceHistory(scope.orgId, workspaceId);
    const items = history.evidenceExports.filter((item) => item.exportType === 'rollback_run');
    return json({ ok: true, items });
  }

  if (url.pathname === '/v1/rollback/run' && request.method === 'POST') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const history = await db.getWorkspaceHistory(scope.orgId, workspaceId);
    const rollbackRun = buildRollbackRun(env, scope.orgId, history, appHtml);
    const exportRecord = await db.insertEvidenceExport({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId,
      exportType: 'rollback_run',
      subjectType: 'workspace',
      subjectId: workspaceId,
      payload: { rollbackRun } as Record<string, unknown>
    });
    await db.createJob({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId,
      type: 'rollback.run',
      status: 'completed',
      summary: `Generated rollback run ${exportRecord.id}`,
      metadata: { exportId: exportRecord.id, verdict: rollbackRun.verdict, blockers: rollbackRun.summary.fail + rollbackRun.summary.warn }
    });
    return json({ ok: rollbackRun.verdict !== 'blocked', rollbackRun, exportRecord });
  }

  if (url.pathname === '/v1/rollback/export' && request.method === 'POST') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const history = await db.getWorkspaceHistory(scope.orgId, workspaceId);
    const rollbackPack = buildRollbackPack(env, scope.orgId, history, appHtml);
    const html = renderRollbackSite({ workspaceName: history.workspace.name, pack: rollbackPack });
    const exportRecord = await db.insertEvidenceExport({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId,
      exportType: 'rollback_pack',
      subjectType: 'workspace',
      subjectId: workspaceId,
      payload: { rollbackPack, html } as Record<string, unknown>
    });
    await db.createJob({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId,
      type: 'rollback.export',
      status: 'completed',
      summary: `Exported rollback pack ${exportRecord.id}`,
      metadata: { exportId: exportRecord.id, verdict: rollbackPack.run.verdict, checks: rollbackPack.run.checks.length }
    });
    return json({ ok: true, rollbackPack, html, exportRecord });
  }

  throw new AppError(405, 'method_not_allowed', 'Method not allowed.');
}
