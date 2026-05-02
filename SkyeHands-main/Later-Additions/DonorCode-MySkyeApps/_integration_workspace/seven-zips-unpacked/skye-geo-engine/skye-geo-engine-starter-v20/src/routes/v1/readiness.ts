import { getDb } from '../../lib/db.ts';
import { resolveEnv } from '../../lib/env.ts';
import { AppError } from '../../lib/errors.ts';
import { assertNonEmpty, json } from '../../lib/http.ts';
import { buildClaimCatalog, buildContractPack, buildReadinessRun } from '../../lib/readiness.ts';
import { readTenantScope } from '../../lib/tenant.ts';

export async function handleReadiness(request: Request, runtimeEnv: unknown): Promise<Response> {
  const env = resolveEnv(runtimeEnv);
  const db = getDb(env);
  const url = new URL(request.url);

  if (url.pathname === '/v1/readiness/runs' && request.method === 'GET') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const exports = await db.listEvidenceExports(scope.orgId, workspaceId);
    return json({ ok: true, items: exports.filter((item) => item.exportType === 'readiness_run') });
  }

  if (url.pathname === '/v1/readiness/run' && request.method === 'POST') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const history = await db.getWorkspaceHistory(scope.orgId, workspaceId);
    const readinessRun = buildReadinessRun(env, scope.orgId, history);
    const exportRecord = await db.insertEvidenceExport({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId,
      exportType: 'readiness_run',
      subjectType: 'workspace',
      subjectId: workspaceId,
      payload: readinessRun as unknown as Record<string, unknown>
    });
    await db.createJob({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId,
      type: 'readiness.run',
      status: 'completed',
      summary: `Generated readiness run ${exportRecord.id}`,
      metadata: { exportId: exportRecord.id, modules: readinessRun.summary.modules }
    });
    return json({ ok: true, readinessRun, exportRecord });
  }

  if (url.pathname === '/v1/claims/catalog' && request.method === 'GET') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const history = await db.getWorkspaceHistory(scope.orgId, workspaceId);
    const items = buildClaimCatalog(env, scope.orgId, history);
    return json({
      ok: true,
      items,
      summary: {
        claims: items.length,
        proved: items.filter((item) => item.status === 'proved').length,
        conditional: items.filter((item) => item.status === 'conditional').length,
        blocked: items.filter((item) => item.status === 'blocked').length
      }
    });
  }

  if (url.pathname === '/v1/contracts/export' && request.method === 'POST') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const history = await db.getWorkspaceHistory(scope.orgId, workspaceId);
    const contractPack = buildContractPack(env, scope.orgId, history);
    const exportRecord = await db.insertEvidenceExport({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId,
      exportType: 'contract_pack',
      subjectType: 'workspace',
      subjectId: workspaceId,
      payload: contractPack as unknown as Record<string, unknown>
    });
    await db.createJob({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId,
      type: 'contract.export',
      status: 'completed',
      summary: `Exported contract-truth pack ${exportRecord.id}`,
      metadata: { exportId: exportRecord.id, claims: contractPack.claimCatalog.length }
    });
    return json({ ok: true, exportRecord, contractPack });
  }

  throw new AppError(405, 'method_not_allowed', 'Method not allowed.');
}
