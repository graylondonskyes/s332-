import { getDb } from '../../lib/db.ts';
import { resolveEnv } from '../../lib/env.ts';
import { AppError } from '../../lib/errors.ts';
import { assertNonEmpty, html, json, readJson } from '../../lib/http.ts';
import { buildProofMatrix, buildWalkthroughRun, buildWorkspaceReport, renderReportSite } from '../../lib/reporting.ts';
import { buildClaimCatalog, buildReadinessRun } from '../../lib/readiness.ts';
import { readTenantScope } from '../../lib/tenant.ts';

export async function handleReporting(request: Request, runtimeEnv: unknown): Promise<Response> {
  const env = resolveEnv(runtimeEnv);
  const db = getDb(env);
  const url = new URL(request.url);

  if (url.pathname === '/v1/proof/matrix' && request.method === 'GET') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const history = await db.getWorkspaceHistory(scope.orgId, workspaceId);
    const matrix = buildProofMatrix(scope.orgId, history);
    return json({ ok: true, matrix });
  }

  if (url.pathname === '/v1/walkthrough-runs' && request.method === 'GET') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const history = await db.getWorkspaceHistory(scope.orgId, workspaceId);
    const walkthroughRun = buildWalkthroughRun(scope.orgId, history);
    return json({ ok: true, walkthroughRun });
  }

  if (url.pathname === '/v1/reports/summary' && request.method === 'GET') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const audience = (url.searchParams.get('audience') || 'operator') as 'client' | 'investor' | 'operator';
    const history = await db.getWorkspaceHistory(scope.orgId, workspaceId);
    const report = buildWorkspaceReport(env, scope.orgId, history, audience);
    const readiness = buildReadinessRun(env, scope.orgId, history);
    const claimCatalog = buildClaimCatalog(env, scope.orgId, history);
    report.readiness = { statusCounts: { proved: readiness.summary.proved, active: readiness.summary.active, conditional: readiness.summary.conditional, blocked: readiness.summary.blocked }, checks: readiness.checks.map((item) => ({ label: item.label, status: item.status, detail: item.detail })) };
    report.claimCatalogSample = claimCatalog.slice(0, 4).map((item) => ({ moduleTitle: item.moduleTitle, claim: item.claim, status: item.status, liveProofObserved: item.liveProofObserved }));
    return json({ ok: true, report });
  }

  if (url.pathname === '/v1/reports/site' && request.method === 'POST') {
    const body = await readJson<{ workspaceId?: string; audience?: 'client' | 'investor' | 'operator'; asHtmlResponse?: boolean }>(request);
    const scope = readTenantScope(request, body as Record<string, unknown>);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const audience = (body.audience || 'operator') as 'client' | 'investor' | 'operator';
    const history = await db.getWorkspaceHistory(scope.orgId, workspaceId);
    const report = buildWorkspaceReport(env, scope.orgId, history, audience);
    const readiness = buildReadinessRun(env, scope.orgId, history);
    const claimCatalog = buildClaimCatalog(env, scope.orgId, history);
    report.readiness = { statusCounts: { proved: readiness.summary.proved, active: readiness.summary.active, conditional: readiness.summary.conditional, blocked: readiness.summary.blocked }, checks: readiness.checks.map((item) => ({ label: item.label, status: item.status, detail: item.detail })) };
    report.claimCatalogSample = claimCatalog.slice(0, 4).map((item) => ({ moduleTitle: item.moduleTitle, claim: item.claim, status: item.status, liveProofObserved: item.liveProofObserved }));
    const siteHtml = renderReportSite(report);
    if (body.asHtmlResponse) return html(siteHtml);
    return json({ ok: true, report, html: siteHtml });
  }

  if (url.pathname === '/v1/reports/export' && request.method === 'POST') {
    const body = await readJson<{ workspaceId?: string; audience?: 'client' | 'investor' | 'operator' }>(request);
    const scope = readTenantScope(request, body as Record<string, unknown>);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const audience = (body.audience || 'operator') as 'client' | 'investor' | 'operator';
    const history = await db.getWorkspaceHistory(scope.orgId, workspaceId);
    const report = buildWorkspaceReport(env, scope.orgId, history, audience);
    const readiness = buildReadinessRun(env, scope.orgId, history);
    const claimCatalog = buildClaimCatalog(env, scope.orgId, history);
    report.readiness = { statusCounts: { proved: readiness.summary.proved, active: readiness.summary.active, conditional: readiness.summary.conditional, blocked: readiness.summary.blocked }, checks: readiness.checks.map((item) => ({ label: item.label, status: item.status, detail: item.detail })) };
    report.claimCatalogSample = claimCatalog.slice(0, 4).map((item) => ({ moduleTitle: item.moduleTitle, claim: item.claim, status: item.status, liveProofObserved: item.liveProofObserved }));
    const matrix = buildProofMatrix(scope.orgId, history);
    const walkthroughRun = buildWalkthroughRun(scope.orgId, history);
    const siteHtml = renderReportSite(report);
    const exportRecord = await db.insertEvidenceExport({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId,
      exportType: 'report_site',
      subjectType: audience,
      subjectId: workspaceId,
      payload: {
        audience,
        generatedAt: report.generatedAt,
        metrics: report.metrics,
        summaries: report.summaries,
        proofSummary: matrix.summary,
        walkthroughSummary: walkthroughRun.summary,
        readinessSummary: readiness.summary,
        claimCatalogSample: report.claimCatalogSample,
        html: siteHtml
      }
    });
    await db.createJob({
      orgId: scope.orgId,
      workspaceId,
      projectId: scope.projectId,
      type: 'report.export.site',
      status: 'completed',
      summary: `Exported ${audience} report site ${exportRecord.id}`,
      metadata: { exportId: exportRecord.id, audience }
    });
    return json({ ok: true, exportRecord, report, html: siteHtml, matrixSummary: matrix.summary, walkthroughSummary: walkthroughRun.summary });
  }

  throw new AppError(405, 'method_not_allowed', 'Method not allowed.');
}
