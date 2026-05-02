import assert from 'node:assert/strict';
import { appFetch } from '../src/index.ts';
import { resetMemoryDbForTests } from '../src/lib/db.ts';
import { resetPlatformStore } from '../src/lib/platformStore.ts';
import { startTestServer } from './helpers/test-server.mjs';

function assertOkStatus(status) { assert.equal(status >= 200 && status < 300, true, `expected 2xx status, got ${status}`); }

resetMemoryDbForTests();
resetPlatformStore();

const server = await startTestServer({ port: 8798, runtimeEnv: { DB_MODE: 'memory' } });
const sourceUrl = `${server.origin}/fixtures/source`;
const publishUrl = `${server.origin}/publisher.local/content/publish`;

const orgId = 'release_gate_org';
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
  let result = await request('/v1/workspaces', { method: 'POST', body: { name: 'Release Gate Workspace', brand: 'Skye GEO Engine', niche: 'AI search growth' } });
  assertOkStatus(result.status);
  workspaceId = result.data.workspace.id;

  result = await request('/v1/projects', { method: 'POST', body: { name: 'Release Gate Project', primaryUrl: sourceUrl, audience: 'operators' } });
  assertOkStatus(result.status);
  projectId = result.data.project.id;

  result = await request('/v1/audit/site', { method: 'POST', body: { url: sourceUrl } });
  assertOkStatus(result.status);

  result = await request('/v1/research', { method: 'POST', body: { urls: [sourceUrl], rawTexts: ['Release gate smoke proves real ship readiness and drift control.'] } });
  assertOkStatus(result.status);
  const sourceIds = [...(result.data.inserted || []), ...(result.data.deduped || [])].map((item) => item.id);
  assert.equal(sourceIds.length >= 1, true);

  result = await request('/v1/articles/brief', { method: 'POST', body: { sourceIds, primaryKeyword: 'ship readiness', title: 'Release gate proof', audience: 'operators', goal: 'prove release control', brand: 'Skye GEO Engine' } });
  assertOkStatus(result.status);
  const briefId = result.data.brief.id;

  result = await request('/v1/articles/draft', { method: 'POST', body: { briefId, language: 'en', tone: 'technical', brand: 'Skye GEO Engine', callToAction: 'Review the release pack.' } });
  assertOkStatus(result.status);
  articleId = result.data.article.id;

  result = await request('/v1/publish/payload', { method: 'POST', body: { platform: 'generic-api', articleId } });
  assertOkStatus(result.status);
  publishRunId = result.data.publishRun.id;

  result = await request('/v1/publish/execute', { method: 'POST', body: { publishRunId, targetUrl: publishUrl } });
  assertOkStatus(result.status);

  result = await request('/v1/reports/export', { method: 'POST', body: { audience: 'operator' } });
  assertOkStatus(result.status);

  result = await request('/v1/contracts/export', { method: 'POST', body: {} });
  assertOkStatus(result.status);

  result = await request('/v1/strategy/export', { method: 'POST', body: {} });
  assertOkStatus(result.status);

  result = await request('/v1/release/gate');
  assertOkStatus(result.status);
  assert.ok(result.data.gate);
  assert.equal(['conditional', 'blocked', 'ship-ready'].includes(result.data.gate.verdict), true);

  result = await request('/v1/release/drift');
  assertOkStatus(result.status);
  assert.equal(result.data.summary.total >= 1, true);

  result = await request('/v1/release/export', { method: 'POST', body: {} });
  assertOkStatus(result.status);
  assert.ok(result.data.exportRecord.id);
  assert.equal((result.data.html || '').length > 500, true);
  assert.equal((result.data.releasePack.weeklyRunbook || []).length >= 1, true);

  console.log(JSON.stringify({
    ok: true,
    checks: ['release gate endpoint', 'release drift endpoint', 'release pack export endpoint'],
    summary: {
      workspaceId,
      projectId,
      articleId,
      publishRunId,
      verdict: result.data.releasePack.gate.verdict,
      driftItems: result.data.releasePack.drift.summary.total,
      exportId: result.data.exportRecord.id
    }
  }, null, 2));
} finally {
  await server.close();
}
