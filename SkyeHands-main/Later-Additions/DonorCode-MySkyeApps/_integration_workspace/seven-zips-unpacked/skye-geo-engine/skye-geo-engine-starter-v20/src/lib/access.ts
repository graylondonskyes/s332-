import { AppError } from './errors.ts';
import { checkQuota, recordUsage, type UserRole, validateApiKey } from './platformStore.ts';

const roleRank: Record<UserRole, number> = { viewer: 1, editor: 2, admin: 3, owner: 4 };

export type AccessContext = {
  mode: 'header-trust' | 'api-key';
  role: UserRole;
  apiKeyId: string | null;
  label: string | null;
};

export function getAccessContext(request: Request, orgId: string): AccessContext {
  const apiKey = request.headers.get('x-api-key')?.trim() || '';
  if (!apiKey) return { mode: 'header-trust', role: 'owner', apiKeyId: null, label: null };
  const record = validateApiKey(orgId, apiKey);
  if (!record) throw new AppError(401, 'invalid_api_key', 'A valid x-api-key is required for this action.');
  return { mode: 'api-key', role: record.role, apiKeyId: record.id, label: record.label };
}

export function requireRole(request: Request, orgId: string, minimumRole: UserRole): AccessContext {
  const access = getAccessContext(request, orgId);
  if (roleRank[access.role] < roleRank[minimumRole]) {
    throw new AppError(403, 'insufficient_role', `This action requires ${minimumRole} role or higher.`);
  }
  return access;
}

export function enforceQuota(orgId: string, metric: 'articleDraftsPerMonth' | 'replayRunsPerMonth' | 'publishExecPerMonth', requestedUnits = 1): void {
  const verdict = checkQuota(orgId, metric, requestedUnits);
  if (!verdict.allowed) {
    throw new AppError(429, 'quota_exceeded', `${metric} quota exceeded.`, verdict);
  }
}

export function meterUsage(orgId: string, input: { workspaceId?: string | null; projectId?: string | null; metric: string; units?: number; meta?: Record<string, unknown> }) {
  return recordUsage(orgId, input);
}
