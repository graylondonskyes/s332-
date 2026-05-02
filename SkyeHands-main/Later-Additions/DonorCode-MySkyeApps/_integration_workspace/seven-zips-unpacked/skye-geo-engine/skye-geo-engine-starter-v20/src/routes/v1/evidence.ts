import { getDb } from '../../lib/db.ts';
import { resolveEnv } from '../../lib/env.ts';
import { AppError } from '../../lib/errors.ts';
import { assertNonEmpty, json, readJson } from '../../lib/http.ts';
import { readTenantScope } from '../../lib/tenant.ts';

export async function handleEvidence(request: Request, runtimeEnv: unknown): Promise<Response> {
  const env = resolveEnv(runtimeEnv);
  const db = getDb(env);
  const path = new URL(request.url).pathname;

  if (path === '/v1/evidence/exports') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    return json({ ok: true, items: await db.listEvidenceExports(scope.orgId, workspaceId) });
  }

  if (path === '/v1/evidence/export' && request.method === 'POST') {
    const body = await readJson<{ orgId?: string; workspaceId?: string; projectId?: string; exportType?: 'audit' | 'publish' | 'visibility' }>(request);
    const scope = readTenantScope(request, body as Record<string, unknown>);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const exportType = assertNonEmpty(body.exportType, 'missing_export_type', 'exportType is required.') as 'audit' | 'publish' | 'visibility';
    let payload: Record<string, unknown>;
    if (exportType === 'audit') {
      payload = { audits: await db.listAuditRuns(scope.orgId, workspaceId) } as Record<string, unknown>;
    } else if (exportType === 'publish') {
      payload = { publishRuns: await db.listPublishRuns(scope.orgId, workspaceId) } as Record<string, unknown>;
    } else if (exportType === 'visibility') {
      payload = { visibilityRuns: await db.listVisibilityRuns(scope.orgId, workspaceId) } as Record<string, unknown>;
    } else {
      throw new AppError(400, 'unsupported_export_type', 'Unsupported exportType.');
    }
    const exportRecord = await db.insertEvidenceExport({ orgId: scope.orgId, workspaceId, projectId: scope.projectId, exportType, subjectType: 'workspace', subjectId: workspaceId, payload });
    await db.createJob({ orgId: scope.orgId, workspaceId, projectId: scope.projectId, type: `evidence.export.${exportType}`, status: 'completed', summary: `Stored ${exportType} export ${exportRecord.id}`, metadata: { exportId: exportRecord.id } });
    return json({ ok: true, exportRecord });
  }

  throw new AppError(405, 'method_not_allowed', 'Method not allowed.');
}
