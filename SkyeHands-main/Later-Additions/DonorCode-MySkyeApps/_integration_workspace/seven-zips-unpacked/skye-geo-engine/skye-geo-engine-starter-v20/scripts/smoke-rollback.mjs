import assert from 'node:assert/strict';
import { appFetch } from '../src/index.ts';
import { resetMemoryDbForTests } from '../src/lib/db.ts';
import { resetPlatformStore } from '../src/lib/platformStore.ts';
import { startTestServer } from './helpers/test-server.mjs';

function assertOkStatus(status) { assert.equal(status >= 200 && status < 300, true, `expected 2xx status, got ${status}`); }

resetMemoryDbForTests();
resetPlatformStore();

const server = await startTestServer({ port: 8803, runtimeEnv: { DB_MODE: 'memory' } });
const orgId = 'rollback_org';
let workspaceId = '';
let projectId = '';

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
  let result = await request('/v1/workspaces', { method: 'POST', body: { name: 'Rollback Workspace', brand: 'Skye GEO Engine', niche: 'AI search growth' } });
  assertOkStatus(result.status);
  workspaceId = result.data.workspace.id;

  result = await request('/v1/projects', { method: 'POST', body: { name: 'Rollback Project', primaryUrl: `${server.origin}/fixtures/source`, audience: 'operators' } });
  assertOkStatus(result.status);
  projectId = result.data.project.id;

  result = await request('/v1/research', { method: 'POST', body: { urls: [`${server.origin}/fixtures/source`], rawTexts: ['Rollback smoke validates recovery truth.'] } });
  assertOkStatus(result.status);
  const sourceIds = [...(result.data.inserted || []), ...(result.data.deduped || [])].map((item) => item.id).filter(Boolean);
  assert.equal(sourceIds.length > 0, true);

  result = await request('/v1/articles/brief', { method: 'POST', body: { title: 'Rollback Brief', primaryKeyword: 'rollback readiness', audience: 'operators', goal: 'recover safely', brand: 'Skye GEO Engine', sourceIds } });
  assertOkStatus(result.status);
  const briefId = result.data.brief.id;

  result = await request('/v1/articles/draft', { method: 'POST', body: { briefId, brand: 'Skye GEO Engine', language: 'en', tone: 'direct', callToAction: 'Run rollback with proof' } });
  assertOkStatus(result.status);
  const articleId = result.data.article.id;

  result = await request('/v1/publish/payload', { method: 'POST', body: { platform: 'generic-api', articleId } });
  assertOkStatus(result.status);
  const publishRunId = result.data.publishRun.id;

  result = await request('/v1/publish/execute', { method: 'POST', body: { publishRunId, targetUrl: `${server.origin}/publisher.local/content/publish` } });
  assertOkStatus(result.status);
  assert.equal(result.data.publishRun.status, 'success');

  result = await request('/v1/targets/probe', { method: 'POST', body: { platform: 'generic-api', targetUrl: `${server.origin}/publisher.local/content/publish` } });
  assertOkStatus(result.status);
  result = await request('/v1/targets/probe', { method: 'POST', body: { platform: 'neon-http', targetUrl: `${server.origin}/neon.local/sql` } });
  assertOkStatus(result.status);

  result = await request('/v1/workspace-bundles/export', { method: 'POST', body: {} });
  assertOkStatus(result.status);
  assert.ok(result.data.bundle.history.workspace.id);

  result = await request('/v1/cutover/run', { method: 'POST', body: {} });
  assertOkStatus(result.status);
  assert.ok(result.data.cutoverRun);

  result = await request('/v1/rollback/summary');
  assertOkStatus(result.status);
  assert.ok(result.data.summary);

  result = await request('/v1/rollback/run', { method: 'POST', body: {} });
  assertOkStatus(result.status);
  assert.ok(result.data.rollbackRun);
  assert.equal(['recoverable', 'conditional', 'blocked'].includes(result.data.rollbackRun.verdict), true);
  assert.ok(result.data.exportRecord.id);

  result = await request('/v1/rollback/runs');
  assertOkStatus(result.status);
  assert.equal(result.data.items.length >= 1, true);

  result = await request('/v1/rollback/export', { method: 'POST', body: {} });
  assertOkStatus(result.status);
  assert.ok(result.data.rollbackPack);
  assert.equal((result.data.html || '').length > 500, true);
  assert.ok(result.data.exportRecord.id);

  console.log(JSON.stringify({
    ok: true,
    checks: ['rollback summary endpoint', 'rollback run endpoint', 'rollback history endpoint', 'rollback pack export endpoint'],
    summary: {
      workspaceId,
      projectId,
      verdict: result.data.rollbackPack.run.verdict,
      exportId: result.data.exportRecord.id,
      checks: result.data.rollbackPack.run.checks.length,
      restorePointExportId: result.data.rollbackPack.run.restorePoint.workspaceBundleExportId
    }
  }, null, 2));
} finally {
  await server.close();
}
