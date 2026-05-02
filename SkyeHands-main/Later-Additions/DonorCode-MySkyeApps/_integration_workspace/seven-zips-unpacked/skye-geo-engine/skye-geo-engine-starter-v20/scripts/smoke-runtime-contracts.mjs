import assert from 'node:assert/strict';
import { appFetch } from '../src/index.ts';
import { resetMemoryDbForTests } from '../src/lib/db.ts';
import { resetPlatformStore } from '../src/lib/platformStore.ts';
import { startTestServer } from './helpers/test-server.mjs';

function assertOkStatus(status) { assert.equal(status >= 200 && status < 300, true, `expected 2xx status, got ${status}`); }

resetMemoryDbForTests();
resetPlatformStore();

const server = await startTestServer({ port: 8797, runtimeEnv: { DB_MODE: 'memory' } });
const sourceUrl = `${server.origin}/fixtures/source`;
const publishUrl = `${server.origin}/publisher.local/content/publish`;

const orgId = 'runtime_contract_org';
let workspaceId = '';
let projectId = '';
let articleId = '';
let publishRunId = '';

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const finalHeaders = new Headers({ 'x-org-id': orgId, ...headers });
  if (workspaceId && !finalHeaders.get('x-workspace-id')) finalHeaders.set('x-workspace-id', workspaceId);
  if (projectId && !finalHeaders.get('x-project-id')) finalHeaders.set('x-project-id', projectId);
  if (body) finalHeaders.set('content-type', 'application/json');
  const response = await appFetch(new Request(`https://app.local${path}`, { method, headers: finalHeaders, body: body ? JSON.stringify(body) : undefined }), { DB_MODE: 'memory' });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}

try {
  let result = await request('/v1/workspaces', { method: 'POST', body: { name: 'Runtime Contract Workspace', brand: 'Skye GEO Engine', niche: 'AI search growth' } });
  assertOkStatus(result.status);
  workspaceId = result.data.workspace.id;

  result = await request('/v1/projects', { method: 'POST', body: { name: 'Runtime Contract Project', primaryUrl: sourceUrl, audience: 'operators' } });
  assertOkStatus(result.status);
  projectId = result.data.project.id;

  result = await request('/v1/research', { method: 'POST', body: { urls: [sourceUrl], rawTexts: ['Contract truth smoke uses real routes and a real claim evidence graph.'] } });
  assertOkStatus(result.status);
  const sourceIds = [...(result.data.inserted || []), ...(result.data.deduped || [])].map((item) => item.id);
  assert.equal(sourceIds.length >= 1, true);

  result = await request('/v1/articles/brief', { method: 'POST', body: { sourceIds, primaryKeyword: 'ai search growth', title: 'Runtime truth proof', audience: 'operators', goal: 'prove contract truth', brand: 'Skye GEO Engine' } });
  assertOkStatus(result.status);
  const briefId = result.data.brief.id;

  result = await request('/v1/articles/draft', { method: 'POST', body: { briefId, language: 'en', tone: 'technical', brand: 'Skye GEO Engine', callToAction: 'Review the proof site.' } });
  assertOkStatus(result.status);
  articleId = result.data.article.id;

  result = await request('/v1/publish/payload', { method: 'POST', body: { platform: 'generic-api', articleId } });
  assertOkStatus(result.status);
  publishRunId = result.data.publishRun.id;

  result = await request('/v1/publish/execute', { method: 'POST', body: { publishRunId, targetUrl: publishUrl } });
  assertOkStatus(result.status);
  assert.equal(result.data.publishRun.status, 'success');

  result = await request('/v1/runtime/contracts');
  assertOkStatus(result.status);
  assert.equal(result.data.runtime.summary.blockedControls, 0);

  result = await request('/v1/providers/validate', { method: 'POST', body: { platform: 'generic-api', targetUrl: publishUrl } });
  assertOkStatus(result.status);
  assert.equal(result.data.validation.executionTruth, 'local-proof-only');

  result = await request('/v1/claims/evidence');
  assertOkStatus(result.status);
  assert.equal(result.data.summary.claims >= 12, true);

  result = await request('/v1/proof/site', { method: 'POST', body: {} });
  assertOkStatus(result.status);
  assert.ok(result.data.exportRecord.id);
  assert.equal((result.data.proofSite.claimEvidence.summary.claims || 0) >= 12, true);
  assert.equal((result.data.html || '').length > 500, true);

  console.log(JSON.stringify({
    ok: true,
    checks: [
      'runtime contract endpoint',
      'provider contract validation endpoint',
      'claim evidence graph endpoint',
      'proof site export endpoint'
    ],
    summary: {
      workspaceId,
      projectId,
      articleId,
      publishRunId,
      blockedControls: result.data.proofSite.runtime.summary.blockedControls,
      claimEvidenceClaims: result.data.proofSite.claimEvidence.summary.claims,
      proofSiteExportId: result.data.exportRecord.id
    }
  }, null, 2));
} finally {
  await server.close();
}
