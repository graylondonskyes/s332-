import { getDb } from '../../lib/db.ts';
import { resolveEnv } from '../../lib/env.ts';
import { AppError } from '../../lib/errors.ts';
import { assertNonEmpty, json } from '../../lib/http.ts';
import { getCapabilityRegistry } from '../../lib/capabilities.ts';
import { buildReleaseDriftReport, buildReleaseGate, buildReleasePack, renderReleaseSite } from '../../lib/release.ts';
import { readTenantScope } from '../../lib/tenant.ts';
import { renderApp } from '../../ui/app.ts';

export async function handleRelease(request: Request, runtimeEnv: unknown): Promise<Response> {
  const env = resolveEnv(runtimeEnv);
  const db = getDb(env);
  const url = new URL(request.url);
  const modules = getCapabilityRegistry();
  const appHtml = renderApp();

  if (url.pathname === '/v1/release/gate' && request.method === 'GET') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const history = await db.getWorkspaceHistory(scope.orgId, workspaceId);
    const gate = buildReleaseGate(env, scope.orgId, history, appHtml, modules);
    return json({ ok: gate.summary.fail === 0, gate });
  }

  if (url.pathname === '/v1/release/drift' && request.method === 'GET') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const history = await db.getWorkspaceHistory(scope.orgId, workspaceId);
    const drift = buildReleaseDriftReport(env, scope.orgId, history, appHtml, modules);
    return json({ ok: true, drift, items: drift.items, summary: drift.summary });
  }

  if (url.pathname === '/v1/release/export' && request.method === 'POST') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const history = await db.getWorkspaceHistory(scope.orgId, workspaceId);
    const releasePack = buildReleasePack(env, scope.orgId, history, appHtml, modules);
    const html = renderReleaseSite({ workspaceName: history.workspace.name, pack: releasePack });
    const exportRecord = await db.insertEvidenceExport({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId,
      exportType: 'release_pack',
      subjectType: 'workspace',
      subjectId: workspaceId,
      payload: { releasePack, html } as Record<string, unknown>
    });
    await db.createJob({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId,
      type: 'release.export',
      status: 'completed',
      summary: `Exported release pack ${exportRecord.id}`,
      metadata: { exportId: exportRecord.id, verdict: releasePack.gate.verdict, driftItems: releasePack.drift.summary.total }
    });
    return json({ ok: true, releasePack, html, exportRecord });
  }

  throw new AppError(405, 'method_not_allowed', 'Method not allowed.');
}
