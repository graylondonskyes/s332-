import { getDb } from '../../lib/db.ts';
import { resolveEnv } from '../../lib/env.ts';
import { AppError } from '../../lib/errors.ts';
import { assertNonEmpty, json, readJson } from '../../lib/http.ts';
import { meterUsage, requireRole } from '../../lib/access.ts';
import { generateContentPlan } from '../../lib/contentPlan.ts';
import { readTenantScope } from '../../lib/tenant.ts';

export async function handleContentPlan(request: Request, runtimeEnv: unknown): Promise<Response> {
  if (request.method !== 'POST') throw new AppError(405, 'method_not_allowed', 'Method not allowed.');
  const env = resolveEnv(runtimeEnv);
  const db = getDb(env);
  const body = await readJson<{
    orgId?: string; workspaceId?: string; projectId?: string; brand?: string; niche?: string; audience?: string; primaryGoal?: string; country?: string; language?: string; url?: string; competitors?: string[]; painPoints?: string[]; offers?: string[];
  }>(request);
  const scope = readTenantScope(request, body as Record<string, unknown>);
  const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
  requireRole(request, scope.orgId, 'editor');
  const brand = assertNonEmpty(body.brand, 'missing_brand', 'brand is required.');
  const niche = assertNonEmpty(body.niche, 'missing_niche', 'niche is required.');
  const audience = assertNonEmpty(body.audience, 'missing_audience', 'audience is required.');
  const result = generateContentPlan({
    brand,
    niche,
    audience,
    primaryGoal: body.primaryGoal,
    country: body.country,
    language: body.language,
    url: body.url,
    competitors: body.competitors,
    painPoints: body.painPoints,
    offers: body.offers
  }, null);

  const persisted = await db.insertContentPlan({
    orgId: scope.orgId,
    workspaceId,
    projectId: scope.projectId,
    brand,
    niche,
    audience,
    result: result as unknown as Record<string, unknown>
  });
  await db.createJob({
    orgId: scope.orgId,
    workspaceId,
    projectId: scope.projectId,
    type: 'content.plan',
    status: 'completed',
    summary: `Stored 30-day content plan for ${brand}`,
    metadata: { contentPlanId: persisted.id, niche, audience }
  });
  meterUsage(scope.orgId, { workspaceId, projectId: scope.projectId, metric: 'contentPlans', units: 1, meta: { contentPlanId: persisted.id } });
  return json({ ok: true, contentPlan: persisted, result });
}
