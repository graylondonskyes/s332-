import { AppError } from './errors.ts';

export type TenantScope = {
  orgId: string;
  workspaceId: string | null;
  projectId: string | null;
};

function readOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim() || '';
  return trimmed ? trimmed : null;
}

export function readTenantScope(request: Request, body?: Record<string, unknown> | null): TenantScope {
  const url = new URL(request.url);
  const orgId = readOptional(request.headers.get('x-org-id')) || readOptional(url.searchParams.get('orgId')) || readOptional(typeof body?.orgId === 'string' ? body.orgId : null);
  if (!orgId) {
    throw new AppError(400, 'missing_org_id', 'x-org-id header or orgId is required.');
  }
  return {
    orgId,
    workspaceId: readOptional(request.headers.get('x-workspace-id')) || readOptional(url.searchParams.get('workspaceId')) || readOptional(typeof body?.workspaceId === 'string' ? body.workspaceId : null),
    projectId: readOptional(request.headers.get('x-project-id')) || readOptional(url.searchParams.get('projectId')) || readOptional(typeof body?.projectId === 'string' ? body.projectId : null)
  };
}
