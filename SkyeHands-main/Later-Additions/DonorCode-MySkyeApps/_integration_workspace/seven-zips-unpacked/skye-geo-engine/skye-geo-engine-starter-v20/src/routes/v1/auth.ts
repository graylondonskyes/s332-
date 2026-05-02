import { createApiKey, listApiKeys, type UserRole } from '../../lib/platformStore.ts';
import { resolveEnv } from '../../lib/env.ts';
import { AppError } from '../../lib/errors.ts';
import { assertNonEmpty, created, json, readJson } from '../../lib/http.ts';
import { requireRole } from '../../lib/access.ts';
import { readTenantScope } from '../../lib/tenant.ts';

const allowedRoles: UserRole[] = ['owner', 'admin', 'editor', 'viewer'];

export async function handleAuth(request: Request, runtimeEnv: unknown): Promise<Response> {
  resolveEnv(runtimeEnv);
  const path = new URL(request.url).pathname;
  if (path === '/v1/auth/keys') {
    if (request.method === 'GET') {
      const scope = readTenantScope(request, null);
      requireRole(request, scope.orgId, 'admin');
      return json({ ok: true, items: listApiKeys(scope.orgId) });
    }
    if (request.method === 'POST') {
      const body = await readJson<{ orgId?: string; label?: string; role?: UserRole }>(request);
      const scope = readTenantScope(request, body as Record<string, unknown>);
      requireRole(request, scope.orgId, 'owner');
      const label = assertNonEmpty(body.label, 'missing_label', 'label is required.');
      const role = body.role && allowedRoles.includes(body.role) ? body.role : null;
      if (!role) throw new AppError(400, 'invalid_role', 'role must be owner, admin, editor, or viewer.');
      const result = createApiKey(scope.orgId, { label, role });
      return created({ ok: true, ...result });
    }
  }
  throw new AppError(405, 'method_not_allowed', 'Method not allowed.');
}
