import { meterUsage, requireRole } from '../../lib/access.ts';
import { resolveEnv } from '../../lib/env.ts';
import { AppError } from '../../lib/errors.ts';
import { created, json, readJson } from '../../lib/http.ts';
import { createPartnerSite, listPartnerSites, listPlacements, queuePlacements, reconcilePlacement, summarizeBacklinkNetwork } from '../../lib/platformStore.ts';
import { readTenantScope } from '../../lib/tenant.ts';

export async function handleBacklinks(request: Request, runtimeEnv: unknown): Promise<Response> {
  resolveEnv(runtimeEnv);
  const path = new URL(request.url).pathname;

  if (path === '/v1/backlinks/sites') {
    if (request.method === 'GET') {
      const scope = readTenantScope(request, null);
      requireRole(request, scope.orgId, 'viewer');
      return json({ ok: true, items: listPartnerSites(scope.orgId) });
    }
    if (request.method === 'POST') {
      const body = await readJson<any>(request);
      const scope = readTenantScope(request, body as Record<string, unknown>);
      requireRole(request, scope.orgId, 'editor');
      const site = createPartnerSite(scope.orgId, body);
      meterUsage(scope.orgId, { metric: 'partnerSites', units: 1, meta: { siteId: site.id, policyStatus: site.policyStatus } });
      return created({ ok: true, site });
    }
  }

  if (path === '/v1/backlinks/placements') {
    if (request.method === 'GET') {
      const scope = readTenantScope(request, null);
      requireRole(request, scope.orgId, 'viewer');
      return json({ ok: true, items: listPlacements(scope.orgId, scope.workspaceId) });
    }
    if (request.method === 'POST') {
      const body = await readJson<any>(request);
      const scope = readTenantScope(request, body as Record<string, unknown>);
      const workspaceId = scope.workspaceId || String(body.workspaceId || '').trim();
      if (!workspaceId) throw new AppError(400, 'missing_workspace_id', 'workspaceId is required.');
      requireRole(request, scope.orgId, 'editor');
      const result = queuePlacements(scope.orgId, {
        workspaceId,
        projectId: scope.projectId,
        partnerSiteIds: body.partnerSiteIds || [],
        targetUrl: String(body.targetUrl || '').trim(),
        targetKeyword: String(body.targetKeyword || '').trim(),
        targetTags: body.targetTags || [],
        anchorOptions: body.anchorOptions || []
      });
      if (result.queued.length) meterUsage(scope.orgId, { workspaceId, projectId: scope.projectId, metric: 'backlinkPlacements', units: result.queued.length, meta: { queued: result.queued.length } });
      return created({ ok: true, ...result });
    }
  }

  if (path === '/v1/backlinks/reconcile' && request.method === 'POST') {
    const body = await readJson<any>(request);
    const scope = readTenantScope(request, body as Record<string, unknown>);
    requireRole(request, scope.orgId, 'editor');
    const placement = reconcilePlacement(scope.orgId, String(body.placementId || '').trim(), { status: body.status, liveUrl: body.liveUrl || null, flags: body.flags || [] });
    return json({ ok: true, placement });
  }

  if (path === '/v1/backlinks/dashboard') {
    const scope = readTenantScope(request, null);
    requireRole(request, scope.orgId, 'viewer');
    return json({ ok: true, summary: summarizeBacklinkNetwork(scope.orgId, scope.workspaceId), items: listPlacements(scope.orgId, scope.workspaceId), sites: listPartnerSites(scope.orgId) });
  }

  throw new AppError(405, 'method_not_allowed', 'Method not allowed.');
}
