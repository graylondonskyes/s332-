import { getDb } from '../../lib/db.ts';
import { resolveEnv } from '../../lib/env.ts';
import { AppError } from '../../lib/errors.ts';
import { assertNonEmpty, created, json, readJson } from '../../lib/http.ts';
import { readTenantScope } from '../../lib/tenant.ts';

export async function handleProjects(request: Request, runtimeEnv: unknown): Promise<Response> {
  const env = resolveEnv(runtimeEnv);
  const db = getDb(env);

  if (request.method === 'GET') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    return json({ ok: true, items: await db.listProjects(scope.orgId, workspaceId) });
  }

  if (request.method === 'POST') {
    const body = await readJson<{ orgId?: string; workspaceId?: string; name?: string; primaryUrl?: string; audience?: string }>(request);
    const scope = readTenantScope(request, body as Record<string, unknown>);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const name = assertNonEmpty(body.name, 'missing_project_name', 'name is required.');
    const project = await db.createProject(scope.orgId, { workspaceId, name, primaryUrl: body.primaryUrl || null, audience: body.audience || null });
    return created({ ok: true, project });
  }

  throw new AppError(405, 'method_not_allowed', 'Method not allowed.');
}
