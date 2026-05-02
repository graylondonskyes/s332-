import { resolveEnv } from './lib/env.ts';
import { html, json, notFound, ok, withErrorBoundary } from './lib/http.ts';
import { renderApp } from './ui/app.ts';
import { handleAudit } from './routes/v1/audit.ts';
import { handleContentPlan } from './routes/v1/content.ts';
import { handleArticleBrief, handleArticleDraft, handleArticleEnrichment, handleArticleReview, handleArticleRemediation } from './routes/v1/articles.ts';
import { handleJobs } from './routes/v1/jobs.ts';
import { handleProjects } from './routes/v1/projects.ts';
import { handlePublish } from './routes/v1/publish.ts';
import { handleResearch } from './routes/v1/research.ts';
import { handleVisibility } from './routes/v1/visibility.ts';
import { handleWorkspaces } from './routes/v1/workspaces.ts';
import { handleEvidence } from './routes/v1/evidence.ts';
import { handleAuth } from './routes/v1/auth.ts';
import { handleAgency } from './routes/v1/agency.ts';
import { handleBacklinks } from './routes/v1/backlinks.ts';
import { handleBundles } from './routes/v1/bundles.ts';
import { handleCapabilities, handleTruthValidate, handleWalkthroughs } from './routes/v1/capabilities.ts';
import { handleReporting } from './routes/v1/reporting.ts';
import { handleReadiness } from './routes/v1/readiness.ts';
import { handleStrategy } from './routes/v1/strategy.ts';
import { handleRuntime } from './routes/v1/runtime.ts';
import { handleRelease } from './routes/v1/release.ts';
import { handleTargets } from './routes/v1/targets.ts';
import { handleCutover } from './routes/v1/cutover.ts';
import { handleRollback } from './routes/v1/rollback.ts';

type WorkerEnv = {
  DB_MODE?: string;
  NEON_SQL_URL?: string;
  NEON_SQL_AUTH_TOKEN?: string;
  APP_BASE_URL?: string;
};

function routeKey(request: Request): string {
  const url = new URL(request.url);
  return `${request.method.toUpperCase()} ${url.pathname}`;
}

export async function appFetch(request: Request, runtimeEnv: WorkerEnv = {}): Promise<Response> {
  return withErrorBoundary(async () => {
    if (request.method === 'OPTIONS') return ok();

    switch (routeKey(request)) {
      case 'GET /':
        return Response.redirect(new URL('/app', request.url), 302);
      case 'GET /app':
        return html(renderApp());
      case 'GET /v1/health': {
        const env = resolveEnv(runtimeEnv);
        return json({ ok: true, service: 'skye-geo-engine-starter', date: new Date().toISOString(), dbMode: env.dbMode });
      }
      case 'GET /v1/workspaces':
      case 'POST /v1/workspaces':
        return handleWorkspaces(request, runtimeEnv);
      case 'GET /v1/projects':
      case 'POST /v1/projects':
        return handleProjects(request, runtimeEnv);
      case 'GET /v1/jobs':
      case 'GET /v1/history':
        return handleJobs(request, runtimeEnv);
      case 'POST /v1/audit/site':
        return handleAudit(request, runtimeEnv);
      case 'POST /v1/content/plan':
        return handleContentPlan(request, runtimeEnv);
      case 'GET /v1/visibility/prompt-pack':
      case 'POST /v1/visibility/prompt-pack':
      case 'GET /v1/visibility/replays':
      case 'POST /v1/visibility/replay':
      case 'GET /v1/visibility/dashboard':
      case 'POST /v1/visibility/export':
        return handleVisibility(request, runtimeEnv);
      case 'GET /v1/research':
      case 'POST /v1/research':
        return handleResearch(request, runtimeEnv);
      case 'GET /v1/articles/brief':
      case 'POST /v1/articles/brief':
        return handleArticleBrief(request, runtimeEnv);
      case 'GET /v1/articles/draft':
      case 'POST /v1/articles/draft':
        return handleArticleDraft(request, runtimeEnv);
      case 'GET /v1/articles/enrichments':
      case 'POST /v1/articles/enrich':
      case 'POST /v1/articles/enrich/export':
        return handleArticleEnrichment(request, runtimeEnv);
      case 'GET /v1/articles/reviews':
      case 'POST /v1/articles/review':
      case 'POST /v1/articles/review/export':
        return handleArticleReview(request, runtimeEnv);
      case 'GET /v1/articles/remediations':
      case 'POST /v1/articles/remediate':
      case 'POST /v1/articles/remediate/export':
        return handleArticleRemediation(request, runtimeEnv);
      case 'GET /v1/publish/payload':
      case 'POST /v1/publish/payload':
      case 'POST /v1/publish/execute':
      case 'POST /v1/publish/retry':
      case 'GET /v1/publish/queue':
      case 'POST /v1/publish/export':
        return handlePublish(request, runtimeEnv);
      case 'GET /v1/evidence/exports':
      case 'POST /v1/evidence/export':
        return handleEvidence(request, runtimeEnv);
      case 'GET /v1/auth/keys':
      case 'POST /v1/auth/keys':
        return handleAuth(request, runtimeEnv);
      case 'GET /v1/agency/settings':
      case 'POST /v1/agency/settings':
      case 'GET /v1/agency/seats':
      case 'POST /v1/agency/seats':
      case 'GET /v1/agency/clients':
      case 'POST /v1/agency/clients':
      case 'GET /v1/agency/usage':
      case 'POST /v1/agency/usage':
      case 'GET /v1/agency/invoices/export':
      case 'POST /v1/agency/invoices/export':
        return handleAgency(request, runtimeEnv);
      case 'GET /v1/backlinks/sites':
      case 'POST /v1/backlinks/sites':
      case 'GET /v1/backlinks/placements':
      case 'POST /v1/backlinks/placements':
      case 'POST /v1/backlinks/reconcile':
      case 'GET /v1/backlinks/dashboard':
        return handleBacklinks(request, runtimeEnv);
      case 'POST /v1/publish/run-scheduled':
        return handlePublish(request, runtimeEnv);
      case 'POST /v1/workspace-bundles/export':
      case 'POST /v1/workspace-bundles/import':
      case 'POST /v1/workspace-bundles/clone':
        return handleBundles(request, runtimeEnv);
      case 'GET /v1/capabilities':
        return handleCapabilities(request);
      case 'GET /v1/walkthroughs':
        return handleWalkthroughs(request);
      case 'POST /v1/truth/validate':
        return handleTruthValidate(request);
      case 'GET /v1/readiness/runs':
      case 'POST /v1/readiness/run':
      case 'GET /v1/claims/catalog':
      case 'POST /v1/contracts/export':
        return handleReadiness(request, runtimeEnv);
      case 'GET /v1/proof/matrix':
      case 'GET /v1/walkthrough-runs':
      case 'GET /v1/reports/summary':
      case 'POST /v1/reports/site':
      case 'POST /v1/reports/export':
        return handleReporting(request, runtimeEnv);
      case 'GET /v1/strategy/scorecard':
      case 'GET /v1/strategy/actions':
      case 'POST /v1/strategy/export':
        return handleStrategy(request, runtimeEnv);
      case 'GET /v1/runtime/contracts':
      case 'POST /v1/providers/validate':
      case 'GET /v1/claims/evidence':
      case 'POST /v1/proof/site':
        return handleRuntime(request, runtimeEnv);
      case 'GET /v1/release/gate':
      case 'GET /v1/release/drift':
      case 'POST /v1/release/export':
        return handleRelease(request, runtimeEnv);
      case 'GET /v1/targets/summary':
      case 'GET /v1/targets/probes':
      case 'POST /v1/targets/probe':
      case 'POST /v1/targets/export':
        return handleTargets(request, runtimeEnv);
      case 'GET /v1/cutover/summary':
      case 'GET /v1/cutover/runs':
      case 'POST /v1/cutover/run':
      case 'POST /v1/cutover/export':
        return handleCutover(request, runtimeEnv);
      case 'GET /v1/rollback/summary':
      case 'GET /v1/rollback/runs':
      case 'POST /v1/rollback/run':
      case 'POST /v1/rollback/export':
        return handleRollback(request, runtimeEnv);
      default:
        return notFound();
    }
  });
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    return appFetch(request, env);
  }
};
