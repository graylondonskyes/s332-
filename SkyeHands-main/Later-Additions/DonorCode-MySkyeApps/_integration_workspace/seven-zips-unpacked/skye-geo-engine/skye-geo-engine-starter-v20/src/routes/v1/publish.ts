import { enforceQuota, meterUsage, requireRole } from '../../lib/access.ts';
import { getDb } from '../../lib/db.ts';
import { resolveEnv } from '../../lib/env.ts';
import { AppError } from '../../lib/errors.ts';
import { assertNonEmpty, json, readJson } from '../../lib/http.ts';
import { buildGenericRequest } from '../../lib/publish/generic.ts';
import { buildGhostRequest } from '../../lib/publish/ghost.ts';
import { ensureRetryableStatus, parsePublishResponse } from '../../lib/publish/reconcile.ts';
import { buildShopifyRequest } from '../../lib/publish/shopify.ts';
import { buildWixRequest } from '../../lib/publish/wix.ts';
import { buildWebflowRequest } from '../../lib/publish/webflow.ts';
import { buildWordpressRequest } from '../../lib/publish/wordpress.ts';
import { buildPublishPayload } from '../../lib/publishPayload.ts';
import { readTenantScope } from '../../lib/tenant.ts';
import { nowIso } from '../../lib/time.ts';

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() || '';
  return trimmed || null;
}

async function resolvePublishRun(scope: { orgId: string; workspaceId: string; projectId: string | null }, db: ReturnType<typeof getDb>, body: any) {
  if (body.publishRunId) {
    const publishRun = await db.getPublishRun(scope.orgId, body.publishRunId);
    if (!publishRun || publishRun.workspaceId !== scope.workspaceId) throw new AppError(404, 'publish_run_not_found', 'Publish run not found.');
    return publishRun;
  }

  let articleInput = body.article;
  const linkedArticleId: string | null = body.articleId || null;
  if (linkedArticleId) {
    const article = await db.getArticle(scope.orgId, linkedArticleId);
    if (!article) throw new AppError(404, 'article_not_found', 'Article not found.');
    articleInput = { title: article.title, slug: article.slug, bodyHtml: article.bodyHtml, jsonLd: article.jsonLd, tags: [], excerpt: article.callToAction };
  }
  if (!body.platform || !articleInput?.title || !articleInput.slug || !articleInput.bodyHtml) {
    throw new AppError(400, 'missing_publish_fields', 'platform, article.title, article.slug, and article.bodyHtml are required.');
  }
  const mapped = buildPublishPayload({ platform: body.platform, article: { title: articleInput.title, slug: articleInput.slug, excerpt: articleInput.excerpt, bodyHtml: articleInput.bodyHtml, jsonLd: articleInput.jsonLd, tags: articleInput.tags } }) as Record<string, unknown>;
  return db.insertPublishRun({
    orgId: scope.orgId,
    workspaceId: scope.workspaceId,
    projectId: scope.projectId,
    articleId: linkedArticleId,
    platform: body.platform,
    payload: mapped,
    endpoint: trimOrNull(typeof mapped.endpoint === 'string' ? mapped.endpoint : null),
    status: body.scheduledFor ? 'queued' : 'prepared',
    remoteId: null,
    attemptCount: 0,
    responseStatus: null,
    responseExcerpt: null,
    lastError: null,
    scheduledFor: body.scheduledFor || null,
    lastAttemptAt: null,
    executedAt: null
  });
}

function buildExecutionRequest(publishRun: any, body: any): RequestInit & { url: string } {
  const targetUrl = assertNonEmpty(body.targetUrl, 'missing_target_url', 'targetUrl is required.');
  if (publishRun.platform === 'wordpress') return buildWordpressRequest({ publishRun, targetUrl, authToken: body.authToken || null });
  if (publishRun.platform === 'webflow') return buildWebflowRequest({ publishRun, targetUrl, collectionId: body.collectionId || null, authToken: body.authToken || null });
  if (publishRun.platform === 'shopify') return buildShopifyRequest({ publishRun, targetUrl, blogId: body.blogId || null, authToken: body.authToken || null });
  if (publishRun.platform === 'wix') return buildWixRequest({ publishRun, targetUrl, authToken: body.authToken || null, memberId: body.memberId || null });
  if (publishRun.platform === 'ghost') return buildGhostRequest({ publishRun, targetUrl, authToken: body.authToken || null, acceptVersion: body.acceptVersion || null });
  return buildGenericRequest({ publishRun, targetUrl, authToken: body.authToken || null });
}

async function executePublishRun(db: ReturnType<typeof getDb>, scope: { orgId: string; workspaceId: string; projectId: string | null }, publishRun: any, body: any, jobType: string) {
  const req = buildExecutionRequest(publishRun, body);
  const response = await fetch(req.url, req);
  const summary = await parsePublishResponse(response);
  const updated = await db.updatePublishRun(publishRun.id, scope.orgId, {
    endpoint: req.url,
    status: summary.status,
    remoteId: summary.remoteId,
    attemptCount: (publishRun.attemptCount || 0) + 1,
    responseStatus: summary.responseStatus,
    responseExcerpt: summary.responseExcerpt,
    lastError: summary.lastError,
    lastAttemptAt: nowIso(),
    executedAt: summary.status === 'success' ? nowIso() : publishRun.executedAt,
    scheduledFor: publishRun.scheduledFor
  });
  await db.createJob({ orgId: scope.orgId, workspaceId: scope.workspaceId, projectId: scope.projectId, type: jobType, status: summary.status === 'success' ? 'completed' : 'failed', summary: `${summary.status === 'success' ? 'Publish succeeded' : 'Publish failed'} via ${publishRun.platform}`, metadata: { publishRunId: updated.id, remoteId: updated.remoteId, responseStatus: updated.responseStatus } });
  meterUsage(scope.orgId, { workspaceId: scope.workspaceId, projectId: scope.projectId, metric: 'publishExecPerMonth', units: 1, meta: { publishRunId: updated.id, status: updated.status, platform: updated.platform } });
  return { ok: summary.status === 'success', publishRun: updated };
}

export async function handlePublish(request: Request, runtimeEnv: unknown): Promise<Response> {
  const env = resolveEnv(runtimeEnv);
  const db = getDb(env);
  const path = new URL(request.url).pathname;

  if (path === '/v1/publish/payload') {
    if (request.method === 'GET') {
      const scope = readTenantScope(request, null);
      const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
      return json({ ok: true, items: await db.listPublishRuns(scope.orgId, workspaceId) });
    }
    if (request.method === 'POST') {
      const body = await readJson<any>(request);
      const scope = readTenantScope(request, body as Record<string, unknown>);
      const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
      requireRole(request, scope.orgId, 'editor');
      const publishRun = await resolvePublishRun({ orgId: scope.orgId, workspaceId, projectId: scope.projectId }, db, body);
      await db.createJob({ orgId: scope.orgId, workspaceId, projectId: scope.projectId, type: 'publish.payload', status: 'completed', summary: `Stored ${publishRun.platform} publish payload`, metadata: { publishRunId: publishRun.id, platform: publishRun.platform } });
      return json({ ok: true, publishRun, mapped: publishRun.payload });
    }
  }

  if (path === '/v1/publish/execute' && request.method === 'POST') {
    const body = await readJson<any>(request);
    const scope = readTenantScope(request, body as Record<string, unknown>);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    requireRole(request, scope.orgId, 'editor');
    enforceQuota(scope.orgId, 'publishExecPerMonth', 1);
    const publishRun = await resolvePublishRun({ orgId: scope.orgId, workspaceId, projectId: scope.projectId }, db, body);
    return json(await executePublishRun(db, { orgId: scope.orgId, workspaceId, projectId: scope.projectId }, publishRun, body, 'publish.execute'));
  }

  if (path === '/v1/publish/retry' && request.method === 'POST') {
    const body = await readJson<any>(request);
    const scope = readTenantScope(request, body as Record<string, unknown>);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    requireRole(request, scope.orgId, 'editor');
    enforceQuota(scope.orgId, 'publishExecPerMonth', 1);
    const publishRunId = assertNonEmpty(body.publishRunId, 'missing_publish_run_id', 'publishRunId is required.');
    const publishRun = await db.getPublishRun(scope.orgId, publishRunId);
    if (!publishRun || publishRun.workspaceId !== workspaceId) throw new AppError(404, 'publish_run_not_found', 'Publish run not found.');
    ensureRetryableStatus(publishRun.status);
    return json(await executePublishRun(db, { orgId: scope.orgId, workspaceId, projectId: scope.projectId }, publishRun, body, 'publish.retry'));
  }

  if (path === '/v1/publish/run-scheduled' && request.method === 'POST') {
    const body = await readJson<any>(request);
    const scope = readTenantScope(request, body as Record<string, unknown>);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    requireRole(request, scope.orgId, 'editor');
    const items = await db.listPublishRuns(scope.orgId, workspaceId);
    const now = new Date();
    const due = items.filter((item) => item.scheduledFor && new Date(item.scheduledFor).getTime() <= now.getTime() && (item.status === 'queued' || item.status === 'prepared'));
    enforceQuota(scope.orgId, 'publishExecPerMonth', due.length || 0);
    const results = [];
    for (const publishRun of due) results.push(await executePublishRun(db, { orgId: scope.orgId, workspaceId, projectId: scope.projectId }, publishRun, body, 'publish.scheduled'));
    return json({ ok: true, count: results.length, results });
  }

  if (path === '/v1/publish/queue') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const items = await db.listPublishRuns(scope.orgId, workspaceId);
    const now = new Date().getTime();
    return json({
      ok: true,
      queued: items.filter((item) => item.status === 'queued'),
      failed: items.filter((item) => item.status === 'failed'),
      prepared: items.filter((item) => item.status === 'prepared'),
      dueNow: items.filter((item) => item.scheduledFor && new Date(item.scheduledFor).getTime() <= now && (item.status === 'queued' || item.status === 'prepared'))
    });
  }

  if (path === '/v1/publish/export' && request.method === 'POST') {
    const body = await readJson<any>(request);
    const scope = readTenantScope(request, body as Record<string, unknown>);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const runs = await db.listPublishRuns(scope.orgId, workspaceId);
    const exportRecord = await db.insertEvidenceExport({ orgId: scope.orgId, workspaceId, projectId: scope.projectId, exportType: 'publish', subjectType: 'workspace', subjectId: workspaceId, payload: { runs } as Record<string, unknown> });
    await db.createJob({ orgId: scope.orgId, workspaceId, projectId: scope.projectId, type: 'publish.export', status: 'completed', summary: `Stored publish export ${exportRecord.id}`, metadata: { exportId: exportRecord.id } });
    return json({ ok: true, exportRecord });
  }

  throw new AppError(405, 'method_not_allowed', 'Method not allowed.');
}
