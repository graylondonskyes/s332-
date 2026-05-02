import { buildArticleEnrichmentPack, renderArticleEnrichmentPack } from '../../lib/articles/enrich.ts';
import { buildArticleReviewPack, renderArticleReviewPack } from '../../lib/articles/review.ts';
import { buildArticleRemediationPack, renderArticleRemediationPack } from '../../lib/articles/remediate.ts';
import { composeArticleDraft } from '../../lib/articles/draft.ts';
import { buildArticleBrief } from '../../lib/articles/brief.ts';
import { getDb } from '../../lib/db.ts';
import { resolveEnv } from '../../lib/env.ts';
import { AppError } from '../../lib/errors.ts';
import { assertNonEmpty, json, readJson } from '../../lib/http.ts';
import { enforceQuota, meterUsage, requireRole } from '../../lib/access.ts';
import { readTenantScope } from '../../lib/tenant.ts';

async function loadArticleContext(db: ReturnType<typeof getDb>, orgId: string, workspaceId: string, articleId: string) {
  const article = await db.getArticle(orgId, articleId);
  if (!article) throw new AppError(404, 'article_not_found', 'Article not found.');
  if (article.workspaceId !== workspaceId) throw new AppError(400, 'article_out_of_scope', 'Article does not belong to the current workspace.');
  const brief = await db.getArticleBrief(orgId, article.briefId);
  if (!brief) throw new AppError(404, 'brief_not_found', 'Brief not found for article.');
  const sources = await db.getSourcesByIds(orgId, brief.sourceIds);
  const projects = await db.listProjects(orgId, workspaceId);
  const workspaces = await db.listWorkspaces(orgId);
  const project = article.projectId ? (projects.find((item) => item.id === article.projectId) || null) : (projects[0] || null);
  const workspace = workspaces.find((item) => item.id === workspaceId) || null;
  return { article, brief, sources, project, workspace };
}

export async function handleArticleBrief(request: Request, runtimeEnv: unknown): Promise<Response> {
  const env = resolveEnv(runtimeEnv);
  const db = getDb(env);

  if (request.method === 'GET') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    return json({ ok: true, items: await db.listArticleBriefs(scope.orgId, workspaceId) });
  }

  if (request.method === 'POST') {
    const body = await readJson<{ orgId?: string; workspaceId?: string; projectId?: string; title?: string; primaryKeyword?: string; audience?: string; goal?: string; brand?: string; sourceIds?: string[] }>(request);
    const scope = readTenantScope(request, body as Record<string, unknown>);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    requireRole(request, scope.orgId, 'editor');
    const sourceIds = (body.sourceIds || []).filter(Boolean);
    if (sourceIds.length === 0) throw new AppError(400, 'missing_source_ids', 'sourceIds is required.');
    const sourceRows = (await db.getSourcesByIds(scope.orgId, sourceIds)).filter((item) => item.workspaceId === workspaceId);
    if (sourceRows.length !== sourceIds.length) throw new AppError(400, 'source_not_found', 'One or more sourceIds do not exist in the current workspace.');

    const briefData = buildArticleBrief({
      title: assertNonEmpty(body.title, 'missing_title', 'title is required.'),
      primaryKeyword: assertNonEmpty(body.primaryKeyword, 'missing_primary_keyword', 'primaryKeyword is required.'),
      audience: assertNonEmpty(body.audience, 'missing_audience', 'audience is required.'),
      goal: assertNonEmpty(body.goal, 'missing_goal', 'goal is required.'),
      brand: assertNonEmpty(body.brand, 'missing_brand', 'brand is required.'),
      sourceRows
    });

    const brief = await db.insertArticleBrief({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId,
      title: briefData.title,
      primaryKeyword: briefData.primaryKeyword,
      brief: briefData as unknown as Record<string, unknown>,
      sourceIds
    });
    await db.createJob({ orgId: scope.orgId, workspaceId, projectId: scope.projectId, type: 'article.brief', status: 'completed', summary: `Stored article brief ${brief.id}`, metadata: { briefId: brief.id, sourceIds } });
    meterUsage(scope.orgId, { workspaceId, projectId: scope.projectId, metric: 'articleBriefs', units: 1, meta: { briefId: brief.id } });
    return json({ ok: true, brief });
  }

  throw new AppError(405, 'method_not_allowed', 'Method not allowed.');
}

export async function handleArticleEnrichment(request: Request, runtimeEnv: unknown): Promise<Response> {
  const env = resolveEnv(runtimeEnv);
  const db = getDb(env);
  const path = new URL(request.url).pathname;

  if (path === '/v1/articles/enrichments' && request.method === 'GET') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const items = (await db.listEvidenceExports(scope.orgId, workspaceId)).filter((item) => item.exportType === 'article_enrichment' || item.exportType === 'article_enrichment_pack');
    return json({ ok: true, items });
  }

  if (path === '/v1/articles/enrich' && request.method === 'POST') {
    const body = await readJson<{ orgId?: string; workspaceId?: string; projectId?: string; articleId?: string }>(request);
    const scope = readTenantScope(request, body as Record<string, unknown>);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const articleId = assertNonEmpty(body.articleId, 'missing_article_id', 'articleId is required.');
    requireRole(request, scope.orgId, 'editor');
    const ctx = await loadArticleContext(db, scope.orgId, workspaceId, articleId);
    const enrichmentPack = buildArticleEnrichmentPack(ctx);
    const exportRecord = await db.insertEvidenceExport({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId || ctx.article.projectId,
      exportType: 'article_enrichment',
      subjectType: 'article',
      subjectId: ctx.article.id,
      payload: { enrichmentPack }
    });
    await db.createJob({ orgId: scope.orgId, workspaceId, projectId: scope.projectId || ctx.article.projectId, type: 'article.enrichment', status: 'completed', summary: `Stored article enrichment ${exportRecord.id}`, metadata: { exportId: exportRecord.id, articleId: ctx.article.id } });
    return json({ ok: true, enrichmentPack, exportRecord });
  }

  if (path === '/v1/articles/enrich/export' && request.method === 'POST') {
    const body = await readJson<{ orgId?: string; workspaceId?: string; projectId?: string; articleId?: string }>(request);
    const scope = readTenantScope(request, body as Record<string, unknown>);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const articleId = assertNonEmpty(body.articleId, 'missing_article_id', 'articleId is required.');
    requireRole(request, scope.orgId, 'editor');
    const ctx = await loadArticleContext(db, scope.orgId, workspaceId, articleId);
    const enrichmentPack = buildArticleEnrichmentPack(ctx);
    const enrichmentHtml = renderArticleEnrichmentPack(enrichmentPack);
    const exportRecord = await db.insertEvidenceExport({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId || ctx.article.projectId,
      exportType: 'article_enrichment_pack',
      subjectType: 'article',
      subjectId: ctx.article.id,
      payload: { enrichmentPack, enrichmentHtml }
    });
    await db.createJob({ orgId: scope.orgId, workspaceId, projectId: scope.projectId || ctx.article.projectId, type: 'article.enrichment.export', status: 'completed', summary: `Stored article enrichment pack ${exportRecord.id}`, metadata: { exportId: exportRecord.id, articleId: ctx.article.id } });
    return json({ ok: true, enrichmentPack, enrichmentPackHtml: enrichmentHtml, exportRecord });
  }

  throw new AppError(405, 'method_not_allowed', 'Method not allowed.');
}


export async function handleArticleReview(request: Request, runtimeEnv: unknown): Promise<Response> {
  const env = resolveEnv(runtimeEnv);
  const db = getDb(env);
  const path = new URL(request.url).pathname;

  if (path === '/v1/articles/reviews' && request.method === 'GET') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const items = (await db.listEvidenceExports(scope.orgId, workspaceId)).filter((item) => item.exportType === 'article_review' || item.exportType === 'article_review_pack');
    return json({ ok: true, items });
  }

  if (path === '/v1/articles/review' && request.method === 'POST') {
    const body = await readJson<{ orgId?: string; workspaceId?: string; projectId?: string; articleId?: string }>(request);
    const scope = readTenantScope(request, body as Record<string, unknown>);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const articleId = assertNonEmpty(body.articleId, 'missing_article_id', 'articleId is required.');
    requireRole(request, scope.orgId, 'editor');
    const ctx = await loadArticleContext(db, scope.orgId, workspaceId, articleId);
    const articleReview = buildArticleReviewPack(ctx);
    const exportRecord = await db.insertEvidenceExport({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId || ctx.article.projectId,
      exportType: 'article_review',
      subjectType: 'article',
      subjectId: ctx.article.id,
      payload: { articleReview }
    });
    await db.createJob({ orgId: scope.orgId, workspaceId, projectId: scope.projectId || ctx.article.projectId, type: 'article.review', status: 'completed', summary: `Stored article review ${exportRecord.id}`, metadata: { exportId: exportRecord.id, articleId: ctx.article.id, verdict: articleReview.verdict, gate: articleReview.publishReadiness.gate } });
    return json({ ok: true, articleReview, exportRecord });
  }

  if (path === '/v1/articles/review/export' && request.method === 'POST') {
    const body = await readJson<{ orgId?: string; workspaceId?: string; projectId?: string; articleId?: string }>(request);
    const scope = readTenantScope(request, body as Record<string, unknown>);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const articleId = assertNonEmpty(body.articleId, 'missing_article_id', 'articleId is required.');
    requireRole(request, scope.orgId, 'editor');
    const ctx = await loadArticleContext(db, scope.orgId, workspaceId, articleId);
    const articleReview = buildArticleReviewPack(ctx);
    const articleReviewHtml = renderArticleReviewPack(articleReview);
    const exportRecord = await db.insertEvidenceExport({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId || ctx.article.projectId,
      exportType: 'article_review_pack',
      subjectType: 'article',
      subjectId: ctx.article.id,
      payload: { articleReview, articleReviewHtml }
    });
    await db.createJob({ orgId: scope.orgId, workspaceId, projectId: scope.projectId || ctx.article.projectId, type: 'article.review.export', status: 'completed', summary: `Stored article review pack ${exportRecord.id}`, metadata: { exportId: exportRecord.id, articleId: ctx.article.id, verdict: articleReview.verdict, gate: articleReview.publishReadiness.gate } });
    return json({ ok: true, articleReview, articleReviewHtml, exportRecord });
  }

  throw new AppError(405, 'method_not_allowed', 'Method not allowed.');
}



export async function handleArticleRemediation(request: Request, runtimeEnv: unknown): Promise<Response> {
  const env = resolveEnv(runtimeEnv);
  const db = getDb(env);
  const path = new URL(request.url).pathname;

  if (path === '/v1/articles/remediations' && request.method === 'GET') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const items = (await db.listEvidenceExports(scope.orgId, workspaceId)).filter((item) => item.exportType === 'article_remediation' || item.exportType === 'article_remediation_pack');
    return json({ ok: true, items });
  }

  if (path === '/v1/articles/remediate' && request.method === 'POST') {
    const body = await readJson<{ orgId?: string; workspaceId?: string; projectId?: string; articleId?: string }>(request);
    const scope = readTenantScope(request, body as Record<string, unknown>);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const articleId = assertNonEmpty(body.articleId, 'missing_article_id', 'articleId is required.');
    requireRole(request, scope.orgId, 'editor');
    const ctx = await loadArticleContext(db, scope.orgId, workspaceId, articleId);
    const articleRemediation = buildArticleRemediationPack(ctx);
    const exportRecord = await db.insertEvidenceExport({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId || ctx.article.projectId,
      exportType: 'article_remediation',
      subjectType: 'article',
      subjectId: ctx.article.id,
      payload: { articleRemediation }
    });
    await db.createJob({ orgId: scope.orgId, workspaceId, projectId: scope.projectId || ctx.article.projectId, type: 'article.remediation', status: 'completed', summary: `Stored article remediation ${exportRecord.id}`, metadata: { exportId: exportRecord.id, articleId: ctx.article.id, predictedGate: articleRemediation.predictedReview.publishReadiness.gate, scoreDelta: articleRemediation.scoreDelta } });
    return json({ ok: true, articleRemediation, exportRecord });
  }

  if (path === '/v1/articles/remediate/export' && request.method === 'POST') {
    const body = await readJson<{ orgId?: string; workspaceId?: string; projectId?: string; articleId?: string }>(request);
    const scope = readTenantScope(request, body as Record<string, unknown>);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const articleId = assertNonEmpty(body.articleId, 'missing_article_id', 'articleId is required.');
    requireRole(request, scope.orgId, 'editor');
    const ctx = await loadArticleContext(db, scope.orgId, workspaceId, articleId);
    const articleRemediation = buildArticleRemediationPack(ctx);
    const articleRemediationHtml = renderArticleRemediationPack(articleRemediation);
    const exportRecord = await db.insertEvidenceExport({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId || ctx.article.projectId,
      exportType: 'article_remediation_pack',
      subjectType: 'article',
      subjectId: ctx.article.id,
      payload: { articleRemediation, articleRemediationHtml }
    });
    await db.createJob({ orgId: scope.orgId, workspaceId, projectId: scope.projectId || ctx.article.projectId, type: 'article.remediation.export', status: 'completed', summary: `Stored article remediation pack ${exportRecord.id}`, metadata: { exportId: exportRecord.id, articleId: ctx.article.id, predictedGate: articleRemediation.predictedReview.publishReadiness.gate, scoreDelta: articleRemediation.scoreDelta } });
    return json({ ok: true, articleRemediation, articleRemediationHtml, exportRecord });
  }

  throw new AppError(405, 'method_not_allowed', 'Method not allowed.');
}

export async function handleArticleDraft(request: Request, runtimeEnv: unknown): Promise<Response> {
  const env = resolveEnv(runtimeEnv);
  const db = getDb(env);

  if (request.method === 'GET') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    return json({ ok: true, items: await db.listArticles(scope.orgId, workspaceId) });
  }

  if (request.method !== 'POST') throw new AppError(405, 'method_not_allowed', 'Method not allowed.');
  const body = await readJson<{ orgId?: string; workspaceId?: string; projectId?: string; briefId?: string; brand?: string; language?: string; tone?: string; callToAction?: string; includeFaq?: boolean; includeInfographicPrompt?: boolean }>(request);
  const scope = readTenantScope(request, body as Record<string, unknown>);
  const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
  const briefId = assertNonEmpty(body.briefId, 'missing_brief_id', 'briefId is required.');
  const brand = assertNonEmpty(body.brand, 'missing_brand', 'brand is required.');
  requireRole(request, scope.orgId, 'editor');
  enforceQuota(scope.orgId, 'articleDraftsPerMonth', 1);
  const brief = await db.getArticleBrief(scope.orgId, briefId);
  if (!brief) throw new AppError(404, 'brief_not_found', 'Brief not found.');
  const sources = (await db.getSourcesByIds(scope.orgId, brief.sourceIds)).filter((item) => item.workspaceId === workspaceId);
  const draft = composeArticleDraft(brief, sources, {
    brand,
    language: body.language,
    tone: body.tone,
    callToAction: body.callToAction,
    includeFaq: body.includeFaq,
    includeInfographicPrompt: body.includeInfographicPrompt
  });
  const article = await db.insertArticle({
    orgId: scope.orgId,
    workspaceId,
    projectId: scope.projectId,
    briefId,
    title: draft.title,
    slug: draft.slug,
    bodyHtml: draft.bodyHtml,
    jsonLd: draft.jsonLd,
    citations: draft.citations,
    language: draft.language,
    tone: draft.tone,
    callToAction: draft.callToAction,
    infographicPrompt: draft.infographicPrompt,
    claimMap: draft.claimMap,
    faqItems: draft.faqItems
  });
  await db.createJob({ orgId: scope.orgId, workspaceId, projectId: scope.projectId, type: 'article.draft', status: 'completed', summary: `Stored article draft ${article.id}`, metadata: { articleId: article.id, briefId, language: article.language, tone: article.tone } });
  meterUsage(scope.orgId, { workspaceId, projectId: scope.projectId, metric: 'articleDraftsPerMonth', units: 1, meta: { articleId: article.id, briefId } });
  return json({ ok: true, article });
}
