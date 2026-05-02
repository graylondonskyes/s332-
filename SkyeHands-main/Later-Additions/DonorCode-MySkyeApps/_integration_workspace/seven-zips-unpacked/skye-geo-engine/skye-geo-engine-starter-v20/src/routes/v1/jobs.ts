import { getDb } from '../../lib/db.ts';
import { resolveEnv } from '../../lib/env.ts';
import { assertNonEmpty, json } from '../../lib/http.ts';
import { readTenantScope } from '../../lib/tenant.ts';

export async function handleJobs(request: Request, runtimeEnv: unknown): Promise<Response> {
  const env = resolveEnv(runtimeEnv);
  const db = getDb(env);
  const scope = readTenantScope(request, null);
  const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');

  if (new URL(request.url).pathname.endsWith('/history')) {
    return json({ ok: true, history: await db.getWorkspaceHistory(scope.orgId, workspaceId) });
  }

  return json({ ok: true, items: await db.listJobs(scope.orgId, workspaceId) });
}
