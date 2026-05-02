import { getDb } from '../../lib/db.ts';
import { resolveEnv } from '../../lib/env.ts';
import { AppError } from '../../lib/errors.ts';
import { assertNonEmpty, json, readJson } from '../../lib/http.ts';
import { runSiteAudit } from '../../lib/audit.ts';
import { readTenantScope } from '../../lib/tenant.ts';

export async function handleAudit(request: Request, runtimeEnv: unknown): Promise<Response> {
  if (request.method !== 'POST') throw new AppError(405, 'method_not_allowed', 'Method not allowed.');
  const env = resolveEnv(runtimeEnv);
  const db = getDb(env);
  const body = await readJson<{ orgId?: string; workspaceId?: string; projectId?: string; url?: string }>(request);
  const scope = readTenantScope(request, body as Record<string, unknown>);
  const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
  const targetUrl = assertNonEmpty(body.url, 'missing_url', 'url is required.');

  const job = await db.createJob({
    orgId: scope.orgId,
    workspaceId,
    projectId: scope.projectId,
    type: 'audit.site',
    status: 'running',
    summary: `Running audit for ${targetUrl}`,
    metadata: { targetUrl }
  });

  try {
    const result = await runSiteAudit(targetUrl);
    const persisted = await db.insertAuditRun({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId,
      targetUrl,
      score: result.score,
      result: result as unknown as Record<string, unknown>
    });
    await db.updateJob(job.id, scope.orgId, { status: 'completed', summary: `Audit stored for ${targetUrl}`, metadata: { targetUrl, auditRunId: persisted.id, score: result.score } });
    return json({ ok: true, auditRun: persisted, result });
  } catch (error) {
    await db.updateJob(job.id, scope.orgId, { status: 'failed', summary: `Audit failed for ${targetUrl}`, metadata: { targetUrl, error: error instanceof Error ? error.message : String(error) } });
    throw error;
  }
}
