import { requireRole } from '../../lib/access.ts';
import { getDb } from '../../lib/db.ts';
import { resolveEnv } from '../../lib/env.ts';
import { assertNonEmpty, json, readJson } from '../../lib/http.ts';
import { buildTargetProbePack, buildTargetProbeSummary, renderTargetProbeSite, runTargetProbe } from '../../lib/targets.ts';
import { readTenantScope } from '../../lib/tenant.ts';

export async function handleTargets(request: Request, runtimeEnv: unknown): Promise<Response> {
  const env = resolveEnv(runtimeEnv);
  const db = getDb(env);
  const path = new URL(request.url).pathname;

  if (path === '/v1/targets/summary' && request.method === 'GET') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const history = await db.getWorkspaceHistory(scope.orgId, workspaceId);
    return json({ ok: true, summary: buildTargetProbeSummary(history) });
  }

  if (path === '/v1/targets/probes' && request.method === 'GET') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const history = await db.getWorkspaceHistory(scope.orgId, workspaceId);
    return json({ ok: true, items: buildTargetProbeSummary(history).items });
  }

  if (path === '/v1/targets/probe' && request.method === 'POST') {
    const body = await readJson<any>(request);
    const scope = readTenantScope(request, body as Record<string, unknown>);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    requireRole(request, scope.orgId, 'editor');
    const history = await db.getWorkspaceHistory(scope.orgId, workspaceId);
    const targetProbe = await runTargetProbe(env, history, {
      platform: body.platform,
      targetUrl: body.targetUrl || null,
      collectionId: body.collectionId || null,
      blogId: body.blogId || null,
      memberId: body.memberId || null,
      acceptVersion: body.acceptVersion || null,
      authToken: body.authToken || null
    });
    const exportRecord = await db.insertEvidenceExport({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId,
      exportType: 'target_probe',
      subjectType: 'platform',
      subjectId: targetProbe.platform,
      payload: { targetProbe }
    });
    await db.createJob({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId,
      type: 'targets.probe',
      status: targetProbe.reachable ? 'completed' : 'failed',
      summary: `${targetProbe.reachable ? 'Probed' : 'Probe failed for'} ${targetProbe.platform}`,
      metadata: { targetProbePlatform: targetProbe.platform, exportId: exportRecord.id, status: targetProbe.status, targetMode: targetProbe.targetMode }
    });
    return json({ ok: true, targetProbe, exportRecord });
  }

  if (path === '/v1/targets/export' && request.method === 'POST') {
    const body = await readJson<any>(request);
    const scope = readTenantScope(request, body as Record<string, unknown>);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    requireRole(request, scope.orgId, 'editor');
    const history = await db.getWorkspaceHistory(scope.orgId, workspaceId);
    const targetPack = buildTargetProbePack(history);
    const html = renderTargetProbeSite({ workspaceName: history.workspace.name, pack: targetPack });
    const exportRecord = await db.insertEvidenceExport({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId,
      exportType: 'target_probe_pack',
      subjectType: 'workspace',
      subjectId: workspaceId,
      payload: { targetPack, html }
    });
    await db.createJob({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId,
      type: 'targets.export',
      status: 'completed',
      summary: 'Exported target probe pack',
      metadata: { exportId: exportRecord.id }
    });
    return json({ ok: true, targetPack, html, exportRecord });
  }

  return json({ ok: false, error: 'not_found' }, { status: 404 });
}
