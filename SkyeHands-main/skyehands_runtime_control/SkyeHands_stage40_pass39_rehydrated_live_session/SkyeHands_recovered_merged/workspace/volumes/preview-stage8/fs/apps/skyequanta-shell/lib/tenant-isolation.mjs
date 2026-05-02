import { getWorkspace, listWorkspaces } from './workspace-manager.mjs';

function readString(value) { return String(value ?? '').trim(); }
export function normalizeTenantId(value) { return readString(value).toLowerCase() || 'local'; }

export function assertTenantWorkspaceAccess(workspace, options = {}) {
  const workspaceId = readString(workspace?.id);
  if (!workspaceId) throw new Error('tenant_isolation_violation:workspace_missing');
  if (options.adminMode || options.founderGateway) {
    return { ok: true, mode: options.adminMode ? 'admin' : 'founder-gateway', workspaceId, workspaceTenantId: normalizeTenantId(workspace?.metadata?.tenantId), requestTenantId: normalizeTenantId(options.tenantId) };
  }
  const workspaceTenantId = normalizeTenantId(workspace?.metadata?.tenantId);
  const requestTenantId = normalizeTenantId(options.tenantId);
  if (requestTenantId != workspaceTenantId) throw new Error(`tenant_isolation_violation:tenant '${requestTenantId}' is not allowed for workspace '${workspaceId}'`);
  if (options.sessionWorkspaceId && readString(options.sessionWorkspaceId) && readString(options.sessionWorkspaceId) !== workspaceId) throw new Error(`tenant_isolation_violation:session workspace '${readString(options.sessionWorkspaceId)}' cannot mutate workspace '${workspaceId}'`);
  return { ok: true, mode: 'tenant-session', workspaceId, workspaceTenantId, requestTenantId };
}

export function buildTenantIsolationMatrix(config, workspaceId, access = {}) {
  const workspace = getWorkspace(config, workspaceId);
  if (!workspace) throw new Error(`Workspace '${workspaceId}' was not found.`);
  const workspaces = listWorkspaces(config).workspaces || [];
  const tenantId = normalizeTenantId(workspace?.metadata?.tenantId);
  const sameTenantWorkspaceIds = workspaces.filter(item => normalizeTenantId(item?.metadata?.tenantId) === tenantId).map(item => item.id).sort();
  const crossTenantWorkspaceIds = workspaces.filter(item => normalizeTenantId(item?.metadata?.tenantId) !== tenantId).map(item => ({ workspaceId: item.id, tenantId: normalizeTenantId(item?.metadata?.tenantId) })).sort((a,b)=>a.workspaceId.localeCompare(b.workspaceId));
  return {
    workspaceId: workspace.id,
    tenantId,
    sessionTenantId: normalizeTenantId(access?.tenantId || tenantId),
    sessionWorkspaceId: readString(access?.sessionWorkspaceId) || null,
    founderGateway: Boolean(access?.founderGateway),
    adminMode: Boolean(access?.adminMode),
    allowed: {
      readWorkspaceSurface: true,
      mutateWorkspaceSurface: Boolean(access?.adminMode || access?.founderGateway || (normalizeTenantId(access?.tenantId || tenantId) === tenantId && (!access?.sessionWorkspaceId || readString(access.sessionWorkspaceId) === workspace.id))),
      sameTenantWorkspaceIds
    },
    denied: {
      crossTenantWorkspaceIds,
      crossTenantMutation: crossTenantWorkspaceIds.length > 0,
      founderLaneBleed: !Boolean(access?.adminMode || access?.founderGateway)
    }
  };
}
