import { getDb } from '../../lib/db.ts';
import { resolveEnv } from '../../lib/env.ts';
import { AppError } from '../../lib/errors.ts';
import { assertNonEmpty, json, readJson } from '../../lib/http.ts';
import { fetchUrlSource } from '../../lib/research/fetchUrl.ts';
import { normalizeSource } from '../../lib/research/normalizeSource.ts';
import { persistSourceLedger } from '../../lib/research/sourceLedger.ts';
import { readTenantScope } from '../../lib/tenant.ts';

export async function handleResearch(request: Request, runtimeEnv: unknown): Promise<Response> {
  const env = resolveEnv(runtimeEnv);
  const db = getDb(env);

  if (request.method === 'GET') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    return json({ ok: true, items: await db.listSources(scope.orgId, workspaceId) });
  }

  if (request.method === 'POST') {
    const body = await readJson<{ orgId?: string; workspaceId?: string; projectId?: string; urls?: string[]; rawTexts?: string[] }>(request);
    const scope = readTenantScope(request, body as Record<string, unknown>);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const urls = (body.urls || []).map((item) => item.trim()).filter(Boolean);
    const rawTexts = (body.rawTexts || []).map((item) => item.trim()).filter(Boolean);
    if (urls.length === 0 && rawTexts.length === 0) throw new AppError(400, 'missing_research_input', 'Provide at least one url or rawTexts entry.');

    const normalized = [] as Awaited<ReturnType<typeof normalizeSource>>[];
    for (const item of urls) {
      const fetched = await fetchUrlSource(item);
      normalized.push(await normalizeSource({ sourceUrl: fetched.sourceUrl, html: fetched.html, retrievalOrigin: 'url_fetch' }));
    }
    for (const item of rawTexts) {
      normalized.push(await normalizeSource({ rawText: item, retrievalOrigin: 'raw_text' }));
    }

    const persisted = await persistSourceLedger(db, { orgId: scope.orgId, workspaceId, projectId: scope.projectId }, normalized);
    await db.createJob({ orgId: scope.orgId, workspaceId, projectId: scope.projectId, type: 'research.ingest', status: 'completed', summary: `Stored ${persisted.inserted.length} new sources and deduped ${persisted.deduped.length}`, metadata: { insertedIds: persisted.inserted.map((item) => item.id), dedupedIds: persisted.deduped.map((item) => item.id) } });
    return json({ ok: true, inserted: persisted.inserted, deduped: persisted.deduped });
  }

  throw new AppError(405, 'method_not_allowed', 'Method not allowed.');
}
