import { getDb } from '../../lib/db.ts';
import { resolveEnv } from '../../lib/env.ts';
import { AppError } from '../../lib/errors.ts';
import { assertNonEmpty, json, readJson } from '../../lib/http.ts';
import { enforceQuota, meterUsage, requireRole } from '../../lib/access.ts';
import { buildPromptPack } from '../../lib/promptPack.ts';
import { readTenantScope } from '../../lib/tenant.ts';
import { evaluateReplay, summarizeVisibilityRuns } from '../../lib/visibility/replay.ts';

export async function handleVisibility(request: Request, runtimeEnv: unknown): Promise<Response> {
  const env = resolveEnv(runtimeEnv);
  const db = getDb(env);
  const path = new URL(request.url).pathname;

  if (path === '/v1/visibility/prompt-pack') {
    if (request.method === 'GET') {
      const scope = readTenantScope(request, null);
      const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
      return json({ ok: true, items: await db.listPromptPacks(scope.orgId, workspaceId) });
    }
    if (request.method === 'POST') {
      const body = await readJson<{ orgId?: string; workspaceId?: string; projectId?: string; brand?: string; niche?: string; market?: string; competitors?: string[] }>(request);
      const scope = readTenantScope(request, body as Record<string, unknown>);
      const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
      requireRole(request, scope.orgId, 'editor');
      const brand = assertNonEmpty(body.brand, 'missing_brand', 'brand is required.');
      const niche = assertNonEmpty(body.niche, 'missing_niche', 'niche is required.');
      const result = buildPromptPack({ brand, niche, market: body.market, competitors: body.competitors });
      const persisted = await db.insertPromptPack({ orgId: scope.orgId, workspaceId, projectId: scope.projectId, brand, niche, market: body.market || null, result: result as unknown as Record<string, unknown> });
      await db.createJob({ orgId: scope.orgId, workspaceId, projectId: scope.projectId, type: 'visibility.prompt-pack', status: 'completed', summary: `Stored prompt pack for ${brand}`, metadata: { promptPackId: persisted.id } });
      meterUsage(scope.orgId, { workspaceId, projectId: scope.projectId, metric: 'promptPacks', units: 1, meta: { promptPackId: persisted.id } });
      return json({ ok: true, promptPack: persisted, result });
    }
  }

  if (path === '/v1/visibility/replays') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    return json({ ok: true, items: await db.listVisibilityRuns(scope.orgId, workspaceId) });
  }

  if (path === '/v1/visibility/replay' && request.method === 'POST') {
    const body = await readJson<{ orgId?: string; workspaceId?: string; projectId?: string; promptPackId?: string; sourceIds?: string[]; answers?: Array<{ provider?: string; prompt?: string; answerText?: string }> }>(request);
    const scope = readTenantScope(request, body as Record<string, unknown>);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const promptPackId = assertNonEmpty(body.promptPackId, 'missing_prompt_pack_id', 'promptPackId is required.');
    const promptPack = await db.getPromptPack(scope.orgId, promptPackId);
    if (!promptPack) throw new AppError(404, 'prompt_pack_not_found', 'Prompt pack not found.');
    requireRole(request, scope.orgId, 'editor');
    const sourceIds = (body.sourceIds || []).filter(Boolean);
    const ownedSources = sourceIds.length ? await db.getSourcesByIds(scope.orgId, sourceIds) : await db.listSources(scope.orgId, workspaceId);
    const answers = (body.answers || []).map((item) => ({ provider: assertNonEmpty(item.provider, 'missing_provider', 'provider is required.'), prompt: assertNonEmpty(item.prompt, 'missing_prompt', 'prompt is required.'), answerText: assertNonEmpty(item.answerText, 'missing_answer_text', 'answerText is required.') }));
    if (!answers.length) throw new AppError(400, 'missing_answers', 'answers is required.');
    enforceQuota(scope.orgId, 'replayRunsPerMonth', answers.length);

    const job = await db.createJob({ orgId: scope.orgId, workspaceId, projectId: scope.projectId, type: 'visibility.replay', status: 'running', summary: `Running ${answers.length} visibility replays`, metadata: { promptPackId } });
    const runs = [];
    for (const answer of answers) {
      const summary = evaluateReplay({ promptPack, answer, ownedSources });
      const record = await db.insertVisibilityRun({
        orgId: scope.orgId,
        workspaceId,
        projectId: scope.projectId,
        promptPackId,
        provider: answer.provider,
        prompt: answer.prompt,
        answerText: answer.answerText,
        result: summary as unknown as Record<string, unknown>
      });
      runs.push(record);
    }
    await db.updateJob(job.id, scope.orgId, { status: 'completed', summary: `Stored ${runs.length} visibility replays`, metadata: { promptPackId, runIds: runs.map((item) => item.id) } });
    meterUsage(scope.orgId, { workspaceId, projectId: scope.projectId, metric: 'replayRunsPerMonth', units: runs.length, meta: { promptPackId } });
    return json({ ok: true, runs });
  }

  if (path === '/v1/visibility/dashboard') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const runs = await db.listVisibilityRuns(scope.orgId, workspaceId);
    const summary = summarizeVisibilityRuns(runs);
    return json({ ok: true, summary, runs });
  }

  if (path === '/v1/visibility/export' && request.method === 'POST') {
    const body = await readJson<{ orgId?: string; workspaceId?: string; projectId?: string }>(request);
    const scope = readTenantScope(request, body as Record<string, unknown>);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const runs = await db.listVisibilityRuns(scope.orgId, workspaceId);
    const summary = summarizeVisibilityRuns(runs);
    const exportRecord = await db.insertEvidenceExport({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId,
      exportType: 'visibility',
      subjectType: 'workspace',
      subjectId: workspaceId,
      payload: { summary, runs } as unknown as Record<string, unknown>
    });
    await db.createJob({ orgId: scope.orgId, workspaceId, projectId: scope.projectId, type: 'visibility.export', status: 'completed', summary: `Stored visibility export ${exportRecord.id}`, metadata: { exportId: exportRecord.id } });
    return json({ ok: true, exportRecord, summary });
  }

  throw new AppError(405, 'method_not_allowed', 'Method not allowed.');
}
