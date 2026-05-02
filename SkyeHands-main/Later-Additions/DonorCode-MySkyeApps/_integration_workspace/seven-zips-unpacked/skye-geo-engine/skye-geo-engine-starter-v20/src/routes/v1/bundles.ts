import type { ArticleFaqRecord, ArticleRecord, EvidenceExportRecord, StorageAdapter, WorkspaceHistory } from '../../lib/db.ts';
import { getDb } from '../../lib/db.ts';
import { resolveEnv } from '../../lib/env.ts';
import { AppError } from '../../lib/errors.ts';
import { assertNonEmpty, created, json, readJson } from '../../lib/http.ts';
import { readTenantScope } from '../../lib/tenant.ts';
import { cloneJson } from '../../lib/json.ts';

export type WorkspaceBundle = {
  version: 'skye-geo-bundle/v1';
  exportedAt: string;
  orgId: string;
  workspaceId: string;
  history: WorkspaceHistory;
};

function parseBundle(input: unknown): WorkspaceBundle {
  const candidate = typeof input === 'string' ? JSON.parse(input) : input;
  if (!candidate || typeof candidate !== 'object') throw new AppError(400, 'invalid_bundle', 'bundle is required.');
  const bundle = candidate as WorkspaceBundle;
  if (bundle.version !== 'skye-geo-bundle/v1' || !bundle.history?.workspace?.id) {
    throw new AppError(400, 'invalid_bundle', 'Bundle version or history payload is invalid.');
  }
  return cloneJson(bundle);
}

function remapString(value: string, idMap: Map<string, string>): string {
  return idMap.get(value) || value;
}

function remapUnknown(value: unknown, idMap: Map<string, string>): unknown {
  if (Array.isArray(value)) return value.map((item) => remapUnknown(item, idMap));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, remapUnknown(item, idMap)]));
  }
  if (typeof value === 'string') return remapString(value, idMap);
  return value;
}

function remapSourceIds(values: string[] | undefined, idMap: Map<string, string>): string[] {
  return (values || []).map((item) => remapString(item, idMap));
}

function remapFaqItems(values: ArticleFaqRecord[] | undefined, idMap: Map<string, string>): ArticleFaqRecord[] {
  return (values || []).map((item) => ({ ...item, sourceIds: remapSourceIds(item.sourceIds, idMap) }));
}

function summarizeHistory(history: WorkspaceHistory) {
  return {
    workspaces: 1,
    projects: history.projects.length,
    jobs: history.jobs.length,
    auditRuns: history.auditRuns.length,
    contentPlans: history.contentPlans.length,
    promptPacks: history.promptPacks.length,
    sources: history.sources.length,
    briefs: history.briefs.length,
    articles: history.articles.length,
    publishRuns: history.publishRuns.length,
    visibilityRuns: history.visibilityRuns.length,
    evidenceExports: history.evidenceExports.length
  };
}

async function buildBundle(db: StorageAdapter, orgId: string, workspaceId: string): Promise<WorkspaceBundle> {
  const history = await db.getWorkspaceHistory(orgId, workspaceId);
  return {
    version: 'skye-geo-bundle/v1',
    exportedAt: new Date().toISOString(),
    orgId,
    workspaceId,
    history
  };
}

async function importBundle(db: StorageAdapter, orgId: string, bundle: WorkspaceBundle, options?: { workspaceName?: string | null; brand?: string | null; niche?: string | null }) {
  const source = bundle.history;
  const idMap = new Map<string, string>();

  const workspace = await db.createWorkspace(orgId, {
    name: options?.workspaceName?.trim() || `${source.workspace.name} Copy`,
    brand: options?.brand?.trim() || source.workspace.brand,
    niche: options?.niche?.trim() || source.workspace.niche
  });
  idMap.set(source.workspace.id, workspace.id);

  const sortedProjects = [...source.projects].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const row of sortedProjects) {
    const created = await db.createProject(orgId, {
      workspaceId: workspace.id,
      name: row.name,
      primaryUrl: row.primaryUrl,
      audience: row.audience
    });
    idMap.set(row.id, created.id);
  }

  const sortedJobs = [...source.jobs].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const row of sortedJobs) {
    const created = await db.createJob({
      orgId,
      workspaceId: workspace.id,
      projectId: row.projectId ? remapString(row.projectId, idMap) : null,
      type: row.type,
      status: row.status,
      summary: row.summary,
      metadata: remapUnknown(row.metadata, idMap) as Record<string, unknown>
    });
    idMap.set(row.id, created.id);
  }

  for (const row of [...source.auditRuns].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const created = await db.insertAuditRun({
      orgId,
      workspaceId: workspace.id,
      projectId: row.projectId ? remapString(row.projectId, idMap) : null,
      targetUrl: row.targetUrl,
      score: row.score,
      result: remapUnknown(row.result, idMap) as Record<string, unknown>
    });
    idMap.set(row.id, created.id);
  }

  for (const row of [...source.contentPlans].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const created = await db.insertContentPlan({
      orgId,
      workspaceId: workspace.id,
      projectId: row.projectId ? remapString(row.projectId, idMap) : null,
      brand: row.brand,
      niche: row.niche,
      audience: row.audience,
      result: remapUnknown(row.result, idMap) as Record<string, unknown>
    });
    idMap.set(row.id, created.id);
  }

  for (const row of [...source.promptPacks].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const created = await db.insertPromptPack({
      orgId,
      workspaceId: workspace.id,
      projectId: row.projectId ? remapString(row.projectId, idMap) : null,
      brand: row.brand,
      niche: row.niche,
      market: row.market,
      result: remapUnknown(row.result, idMap) as Record<string, unknown>
    });
    idMap.set(row.id, created.id);
  }

  for (const row of [...source.sources].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const result = await db.upsertSources([{ 
      orgId,
      workspaceId: workspace.id,
      projectId: row.projectId ? remapString(row.projectId, idMap) : null,
      sourceUrl: row.sourceUrl,
      canonicalUrl: row.canonicalUrl,
      siteName: row.siteName,
      title: row.title,
      snippet: row.snippet,
      contentText: row.contentText,
      contentHash: `${row.contentHash}:${workspace.id}`,
      retrievalOrigin: row.retrievalOrigin,
      retrievedAt: row.retrievedAt,
      publishedAt: row.publishedAt
    }]);
    const mapped = result.inserted[0] || result.deduped[0];
    idMap.set(row.id, mapped.id);
  }

  for (const row of [...source.briefs].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const created = await db.insertArticleBrief({
      orgId,
      workspaceId: workspace.id,
      projectId: row.projectId ? remapString(row.projectId, idMap) : null,
      title: row.title,
      primaryKeyword: row.primaryKeyword,
      brief: remapUnknown(row.brief, idMap) as Record<string, unknown>,
      sourceIds: remapSourceIds(row.sourceIds, idMap)
    });
    idMap.set(row.id, created.id);
  }

  for (const row of [...source.articles].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const created = await db.insertArticle({
      orgId,
      workspaceId: workspace.id,
      projectId: row.projectId ? remapString(row.projectId, idMap) : null,
      briefId: remapString(row.briefId, idMap),
      title: row.title,
      slug: `${row.slug}-${workspace.id.slice(-6)}`,
      bodyHtml: row.bodyHtml,
      jsonLd: row.jsonLd,
      citations: row.citations.map((item) => ({ ...item, sourceId: remapString(item.sourceId, idMap) })),
      language: row.language,
      tone: row.tone,
      callToAction: row.callToAction,
      infographicPrompt: row.infographicPrompt,
      claimMap: row.claimMap.map((item) => ({ ...item, sourceIds: remapSourceIds(item.sourceIds, idMap) })),
      faqItems: remapFaqItems(row.faqItems, idMap)
    });
    idMap.set(row.id, created.id);
  }

  for (const row of [...source.publishRuns].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const created = await db.insertPublishRun({
      orgId,
      workspaceId: workspace.id,
      projectId: row.projectId ? remapString(row.projectId, idMap) : null,
      articleId: row.articleId ? remapString(row.articleId, idMap) : null,
      platform: row.platform,
      payload: remapUnknown(row.payload, idMap) as Record<string, unknown>,
      endpoint: row.endpoint,
      status: row.status,
      remoteId: row.remoteId,
      attemptCount: row.attemptCount,
      responseStatus: row.responseStatus,
      responseExcerpt: row.responseExcerpt,
      lastError: row.lastError,
      scheduledFor: row.scheduledFor,
      lastAttemptAt: row.lastAttemptAt,
      executedAt: row.executedAt
    });
    idMap.set(row.id, created.id);
  }

  for (const row of [...source.visibilityRuns].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const created = await db.insertVisibilityRun({
      orgId,
      workspaceId: workspace.id,
      projectId: row.projectId ? remapString(row.projectId, idMap) : null,
      promptPackId: remapString(row.promptPackId, idMap),
      provider: row.provider,
      prompt: row.prompt,
      answerText: row.answerText,
      result: remapUnknown(row.result, idMap) as Record<string, unknown>
    });
    idMap.set(row.id, created.id);
  }

  for (const row of [...source.evidenceExports].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const created = await db.insertEvidenceExport({
      orgId,
      workspaceId: workspace.id,
      projectId: row.projectId ? remapString(row.projectId, idMap) : null,
      exportType: row.exportType,
      subjectType: row.subjectType,
      subjectId: row.subjectId ? remapString(row.subjectId, idMap) : null,
      payload: remapUnknown(row.payload, idMap) as Record<string, unknown>
    });
    idMap.set(row.id, created.id);
  }

  const importedHistory = await db.getWorkspaceHistory(orgId, workspace.id);
  return { workspace, summary: summarizeHistory(importedHistory), idMap: Object.fromEntries(idMap.entries()), history: importedHistory };
}

export async function handleBundles(request: Request, runtimeEnv: unknown): Promise<Response> {
  const env = resolveEnv(runtimeEnv);
  const db = getDb(env);
  const path = new URL(request.url).pathname;

  if (path === '/v1/workspace-bundles/export' && request.method === 'POST') {
    const body = await readJson<any>(request);
    const scope = readTenantScope(request, body as Record<string, unknown>);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const bundle = await buildBundle(db, scope.orgId, workspaceId);
    const evidence = await db.insertEvidenceExport({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId,
      exportType: 'workspace_bundle',
      subjectType: 'workspace',
      subjectId: workspaceId,
      payload: { summary: summarizeHistory(bundle.history), exportedAt: bundle.exportedAt }
    });
    await db.createJob({ orgId: scope.orgId, workspaceId, projectId: scope.projectId, type: 'workspace.bundle.export', status: 'completed', summary: `Exported workspace bundle ${evidence.id}`, metadata: { exportId: evidence.id } });
    return json({ ok: true, bundle, summary: summarizeHistory(bundle.history), evidenceExportId: evidence.id });
  }

  if (path === '/v1/workspace-bundles/import' && request.method === 'POST') {
    const body = await readJson<any>(request);
    const scope = readTenantScope(request, body as Record<string, unknown>);
    const bundle = parseBundle(body.bundle || body.bundleJson);
    const imported = await importBundle(db, scope.orgId, bundle, { workspaceName: body.workspaceName || null, brand: body.brand || null, niche: body.niche || null });
    await db.createJob({ orgId: scope.orgId, workspaceId: imported.workspace.id, projectId: null, type: 'workspace.bundle.import', status: 'completed', summary: `Imported workspace bundle into ${imported.workspace.id}`, metadata: { sourceWorkspaceId: bundle.workspaceId, importedWorkspaceId: imported.workspace.id } });
    return created({ ok: true, workspace: imported.workspace, summary: imported.summary, idMap: imported.idMap, history: imported.history });
  }

  if (path === '/v1/workspace-bundles/clone' && request.method === 'POST') {
    const body = await readJson<any>(request);
    const scope = readTenantScope(request, body as Record<string, unknown>);
    const sourceWorkspaceId = assertNonEmpty(body.sourceWorkspaceId || scope.workspaceId, 'missing_workspace_id', 'sourceWorkspaceId or workspaceId is required.');
    const bundle = await buildBundle(db, scope.orgId, sourceWorkspaceId);
    const cloned = await importBundle(db, scope.orgId, bundle, { workspaceName: body.workspaceName || `${bundle.history.workspace.name} Clone`, brand: body.brand || null, niche: body.niche || null });
    await db.createJob({ orgId: scope.orgId, workspaceId: cloned.workspace.id, projectId: null, type: 'workspace.bundle.clone', status: 'completed', summary: `Cloned workspace ${sourceWorkspaceId} into ${cloned.workspace.id}`, metadata: { sourceWorkspaceId, clonedWorkspaceId: cloned.workspace.id } });
    return created({ ok: true, workspace: cloned.workspace, summary: cloned.summary, idMap: cloned.idMap, history: cloned.history });
  }

  throw new AppError(405, 'method_not_allowed', 'Method not allowed.');
}
