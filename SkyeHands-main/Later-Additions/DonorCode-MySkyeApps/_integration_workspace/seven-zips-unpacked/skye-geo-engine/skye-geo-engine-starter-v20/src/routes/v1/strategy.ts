import { getDb } from '../../lib/db.ts';
import { resolveEnv } from '../../lib/env.ts';
import { AppError } from '../../lib/errors.ts';
import { assertNonEmpty, json } from '../../lib/http.ts';
import { buildStrategyActions, buildStrategyPack, buildStrategyScorecard } from '../../lib/strategy.ts';
import { readTenantScope } from '../../lib/tenant.ts';

export async function handleStrategy(request: Request, runtimeEnv: unknown): Promise<Response> {
  const env = resolveEnv(runtimeEnv);
  const db = getDb(env);
  const url = new URL(request.url);

  if (url.pathname === '/v1/strategy/scorecard' && request.method === 'GET') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const history = await db.getWorkspaceHistory(scope.orgId, workspaceId);
    const scorecard = buildStrategyScorecard(env, scope.orgId, history);
    return json({ ok: true, scorecard });
  }

  if (url.pathname === '/v1/strategy/actions' && request.method === 'GET') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const history = await db.getWorkspaceHistory(scope.orgId, workspaceId);
    const plan = buildStrategyActions(env, scope.orgId, history);
    return json({ ok: true, plan, actions: plan.actions });
  }

  if (url.pathname === '/v1/strategy/export' && request.method === 'POST') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const history = await db.getWorkspaceHistory(scope.orgId, workspaceId);
    const strategyPack = buildStrategyPack(env, scope.orgId, history);
    const exportRecord = await db.insertEvidenceExport({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId,
      exportType: 'strategy_pack',
      subjectType: 'workspace',
      subjectId: workspaceId,
      payload: strategyPack as unknown as Record<string, unknown>
    });
    await db.createJob({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId,
      type: 'strategy.export',
      status: 'completed',
      summary: `Exported strategy pack ${exportRecord.id}`,
      metadata: { exportId: exportRecord.id, overallScore: strategyPack.summary.overallScore, actions: strategyPack.actions.length }
    });
    return json({ ok: true, exportRecord, strategyPack });
  }

  throw new AppError(405, 'method_not_allowed', 'Method not allowed.');
}
