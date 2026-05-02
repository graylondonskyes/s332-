import { getDb } from '../../lib/db.ts';
import { resolveEnv } from '../../lib/env.ts';
import { AppError } from '../../lib/errors.ts';
import { assertNonEmpty, created, json, readJson } from '../../lib/http.ts';
import { readTenantScope } from '../../lib/tenant.ts';

export async function handleWorkspaces(request: Request, runtimeEnv: unknown): Promise<Response> {
  const env = resolveEnv(runtimeEnv);
  const db = getDb(env);

  if (request.method === 'GET') {
    const scope = readTenantScope(request, null);
    return json({ ok: true, items: await db.listWorkspaces(scope.orgId) });
  }

  if (request.method === 'POST') {
    const body = await readJson<{ orgId?: string; name?: string; brand?: string; niche?: string }>(request);
    const scope = readTenantScope(request, body as Record<string, unknown>);
    const name = assertNonEmpty(body.name, 'missing_workspace_name', 'name is required.');
    const workspace = await db.createWorkspace(scope.orgId, { name, brand: body.brand || null, niche: body.niche || null });
    return created({ ok: true, workspace });
  }

  throw new AppError(405, 'method_not_allowed', 'Method not allowed.');
}
