import assert from 'node:assert/strict';
import { appFetch } from '../src/index.ts';
import { resetMemoryDbForTests } from '../src/lib/db.ts';
import { resetPlatformStore } from '../src/lib/platformStore.ts';
import { startTestServer } from './helpers/test-server.mjs';
function assertOkStatus(status) { assert.equal(status >= 200 && status < 300, true, `expected 2xx status, got ${status}`); }

resetMemoryDbForTests();
resetPlatformStore();

const server = await startTestServer({ port: 8796, runtimeEnv: { DB_MODE: 'memory' } });
const sourceUrl = `${server.origin}/fixtures/source`;
const publishUrl = `${server.origin}/publisher.local/content/publish`;

const orgId = 'readiness_org';
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
  let result = await request('/v1/workspaces', { method: 'POST', body: { name: 'Readiness Workspace', brand: 'Skye GEO Engine', niche: 'AI search growth' } });
  assertOkStatus(result.status);
  workspaceId = result.data.workspace.id;

  result = await request('/v1/projects', { method: 'POST', body: { name: 'Readiness Project', primaryUrl: sourceUrl, audience: 'operators' } });
  assertOkStatus(result.status);
  projectId = result.data.project.id;

  result = await request('/v1/audit/site', { method: 'POST', body: { url: sourceUrl } });
  assertOkStatus(result.status);

  result = await request('/v1/research', { method: 'POST', body: { urls: [sourceUrl], texts: ['Readiness smoke uses real routes, real ledger state, and real proof output.'] } });
  assertOkStatus(result.status);
  const sourceIds = [...(result.data.inserted || []), ...(result.data.deduped || [])].map((item) => item.id);
  assert.equal(sourceIds.length >= 1, true);

  result = await request('/v1/articles/brief', { method: 'POST', body: { sourceIds, primaryKeyword: 'ai search growth', title: 'Readiness proof', audience: 'operators', goal: 'prove runtime truth', brand: 'Skye GEO Engine' } });
  assertOkStatus(result.status);
  const briefId = result.data.brief.id;

  result = await request('/v1/articles/draft', { method: 'POST', body: { briefId, language: 'en', tone: 'technical', brand: 'Skye GEO Engine', callToAction: 'Review the readiness run.' } });
  assertOkStatus(result.status);
  articleId = result.data.article.id;

  result = await request('/v1/publish/payload', { method: 'POST', body: { platform: 'generic-api', articleId } });
  assertOkStatus(result.status);
  publishRunId = result.data.publishRun.id;

  result = await request('/v1/publish/execute', { method: 'POST', body: { publishRunId, targetUrl: publishUrl } });
  assertOkStatus(result.status);
  assert.equal(result.data.publishRun.status, 'success');

  result = await request('/v1/readiness/run', { method: 'POST', body: {} });
  assertOkStatus(result.status);
  assert.equal(result.data.readinessRun.summary.modules >= 12, true);
  assert.equal(result.data.readinessRun.summary.warningChecks >= 1, true);
  assert.ok(result.data.exportRecord.id);

  result = await request('/v1/readiness/runs');
  assertOkStatus(result.status);
  assert.equal(Array.isArray(result.data.items), true);
  assert.equal(result.data.items.length >= 1, true);

  result = await request('/v1/claims/catalog');
  assertOkStatus(result.status);
  assert.equal(result.data.summary.claims >= 12, true);
  assert.equal(result.data.items.some((item) => item.moduleId === 'publishing' && ['proved', 'active', 'conditional'].includes(item.status)), true);
  assert.equal(result.data.items.some((item) => item.moduleId === 'readiness'), true);

  result = await request('/v1/contracts/export', { method: 'POST', body: {} });
  assertOkStatus(result.status);
  assert.ok(result.data.exportRecord.id);
  assert.equal(result.data.contractPack.claimCatalog.length >= 12, true);

  console.log(JSON.stringify({ ok: true, checks: ['readiness run endpoint', 'readiness history endpoint', 'claim catalog endpoint', 'contract pack export endpoint'], summary: { workspaceId, projectId, articleId, publishRunId, readinessExportId: result.data.exportRecord.id, claimCount: result.data.contractPack.claimCatalog.length, readinessModules: result.data.contractPack.readiness.summary.modules, readinessWarnings: result.data.contractPack.readiness.summary.warningChecks } }, null, 2));
} finally {
  await server.close();
}
