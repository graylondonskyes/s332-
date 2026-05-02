import { getDb } from '../../lib/db.ts';
import { resolveEnv } from '../../lib/env.ts';
import { AppError } from '../../lib/errors.ts';
import { assertNonEmpty, html, json, readJson } from '../../lib/http.ts';
import { getCapabilityRegistry } from '../../lib/capabilities.ts';
import { buildClaimEvidenceGraph, buildRuntimeContracts, renderProofSite, validateProviderContract } from '../../lib/runtimeContracts.ts';
import { readTenantScope } from '../../lib/tenant.ts';
import { renderApp } from '../../ui/app.ts';

export async function handleRuntime(request: Request, runtimeEnv: unknown): Promise<Response> {
  const env = resolveEnv(runtimeEnv);
  const db = getDb(env);
  const url = new URL(request.url);
  const modules = getCapabilityRegistry();
  const appHtml = renderApp();

  if (url.pathname === '/v1/runtime/contracts' && request.method === 'GET') {
    return json({ ok: true, runtime: buildRuntimeContracts(env, appHtml, modules) });
  }

  if (url.pathname === '/v1/providers/validate' && request.method === 'POST') {
    const body = await readJson<{ platform?: string; targetUrl?: string; collectionId?: string; blogId?: string; memberId?: string; acceptVersion?: string }>(request);
    const scope = readTenantScope(request, body as Record<string, unknown>);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const history = await db.getWorkspaceHistory(scope.orgId, workspaceId);
    const validation = validateProviderContract({ platform: assertNonEmpty(body.platform, 'missing_platform', 'platform is required.'), targetUrl: body.targetUrl || null, collectionId: body.collectionId || null, blogId: body.blogId || null, memberId: body.memberId || null, acceptVersion: body.acceptVersion || null }, modules, env, history);
    return json({ ok: validation.ready, validation }, { status: validation.ready ? 200 : 409 });
  }

  if (url.pathname === '/v1/claims/evidence' && request.method === 'GET') {
    const scope = readTenantScope(request, null);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const history = await db.getWorkspaceHistory(scope.orgId, workspaceId);
    const claimEvidence = buildClaimEvidenceGraph(env, scope.orgId, history, modules);
    return json({ ok: true, claimEvidence, items: claimEvidence.items, summary: claimEvidence.summary });
  }

  if (url.pathname === '/v1/proof/site' && request.method === 'POST') {
    const body = await readJson<{ asHtmlResponse?: boolean }>(request);
    const scope = readTenantScope(request, body as Record<string, unknown>);
    const workspaceId = assertNonEmpty(scope.workspaceId, 'missing_workspace_id', 'workspaceId is required.');
    const history = await db.getWorkspaceHistory(scope.orgId, workspaceId);
    const runtime = buildRuntimeContracts(env, appHtml, modules);
    const claimEvidence = buildClaimEvidenceGraph(env, scope.orgId, history, modules);
    const proofSite = { generatedAt: claimEvidence.generatedAt, workspaceId, runtime, claimEvidence };
    const siteHtml = renderProofSite({ workspaceName: history.workspace.name, runtime, claimEvidence });
    const exportRecord = await db.insertEvidenceExport({ orgId: scope.orgId, workspaceId, projectId: scope.projectId, exportType: 'proof_site', subjectType: 'workspace', subjectId: workspaceId, payload: { proofSite, html: siteHtml } as Record<string, unknown> });
    await db.createJob({ orgId: scope.orgId, workspaceId, projectId: scope.projectId, type: 'proof.export.site', status: 'completed', summary: `Exported proof site ${exportRecord.id}`, metadata: { exportId: exportRecord.id, claims: claimEvidence.summary.claims } });
    if (body.asHtmlResponse) return html(siteHtml);
    return json({ ok: true, proofSite, html: siteHtml, exportRecord });
  }

  throw new AppError(405, 'method_not_allowed', 'Method not allowed.');
}
