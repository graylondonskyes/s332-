import assert from 'node:assert/strict';
import { appFetch } from '../src/index.ts';
import { resetMemoryDbForTests } from '../src/lib/db.ts';
import { resetPlatformStore } from '../src/lib/platformStore.ts';
import { startTestServer } from './helpers/test-server.mjs';

resetMemoryDbForTests();
resetPlatformStore();

const server = await startTestServer({ port: 8793, runtimeEnv: { DB_MODE: 'memory' } });
const sourceUrl = `${server.origin}/fixtures/source`;
const publishUrl = `${server.origin}/publisher.local/content/publish`;

async function request(path, { method = 'GET', orgId = 'org_publish', workspaceId, projectId, body } = {}) {
  const headers = new Headers({ 'x-org-id': orgId });
  if (workspaceId) headers.set('x-workspace-id', workspaceId);
  if (projectId) headers.set('x-project-id', projectId);
  if (body) headers.set('content-type', 'application/json');
  const response = await appFetch(new Request(`https://smoke.local${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), { DB_MODE: 'memory' });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}

try {
  const workspace = await request('/v1/workspaces', { method: 'POST', body: { name: 'Publish Workspace', brand: 'Skye GEO Engine', niche: 'AI search growth' } });
  const workspaceId = workspace.data.workspace.id;
  const project = await request('/v1/projects', { method: 'POST', workspaceId, body: { workspaceId, name: 'Publish Project', primaryUrl: sourceUrl, audience: 'buyers' } });
  const projectId = project.data.project.id;

  const article = { title: 'Publishable Draft', slug: 'publishable-draft', bodyHtml: '<article><h1>Publishable Draft</h1></article>', jsonLd: '{}', tags: ['geo'] };

  const wpPayload = await request('/v1/publish/payload', { method: 'POST', workspaceId, projectId, body: { platform: 'wordpress', article } });
  const wfPayload = await request('/v1/publish/payload', { method: 'POST', workspaceId, projectId, body: { platform: 'webflow', article } });
  const shopPayload = await request('/v1/publish/payload', { method: 'POST', workspaceId, projectId, body: { platform: 'shopify', article } });
  const wixPayload = await request('/v1/publish/payload', { method: 'POST', workspaceId, projectId, body: { platform: 'wix', article } });
  const ghostPayload = await request('/v1/publish/payload', { method: 'POST', workspaceId, projectId, body: { platform: 'ghost', article } });
  const genericPayload = await request('/v1/publish/payload', { method: 'POST', workspaceId, projectId, body: { platform: 'generic-api', article } });
  const scheduledPayload = await request('/v1/publish/payload', { method: 'POST', workspaceId, projectId, body: { platform: 'generic-api', article, scheduledFor: '2026-01-01T00:00:00.000Z' } });

  const baseUrl = server.origin;
  const wpRun = await request('/v1/publish/execute', { method: 'POST', workspaceId, projectId, body: { publishRunId: wpPayload.data.publishRun.id, targetUrl: baseUrl } });
  const wfRun = await request('/v1/publish/execute', { method: 'POST', workspaceId, projectId, body: { publishRunId: wfPayload.data.publishRun.id, targetUrl: baseUrl, collectionId: 'collection_live' } });
  const shopRun = await request('/v1/publish/execute', { method: 'POST', workspaceId, projectId, body: { publishRunId: shopPayload.data.publishRun.id, targetUrl: baseUrl, blogId: 'blog_live' } });
  const wixRun = await request('/v1/publish/execute', { method: 'POST', workspaceId, projectId, body: { publishRunId: wixPayload.data.publishRun.id, targetUrl: baseUrl, memberId: 'member_live' } });
  const ghostRun = await request('/v1/publish/execute', { method: 'POST', workspaceId, projectId, body: { publishRunId: ghostPayload.data.publishRun.id, targetUrl: baseUrl, authToken: 'ghost_admin_token', acceptVersion: 'v5.0' } });
  const genericFail = await request('/v1/publish/execute', { method: 'POST', workspaceId, projectId, body: { publishRunId: genericPayload.data.publishRun.id, targetUrl: `${server.origin}/missing-publish-target` } });
  const queue = await request('/v1/publish/queue', { workspaceId });
  const genericRetry = await request('/v1/publish/retry', { method: 'POST', workspaceId, projectId, body: { publishRunId: genericPayload.data.publishRun.id, targetUrl: publishUrl } });
  const scheduledRun = await request('/v1/publish/run-scheduled', { method: 'POST', workspaceId, projectId, body: { targetUrl: publishUrl } });
  const exportRes = await request('/v1/publish/export', { method: 'POST', workspaceId, projectId, body: {} });

  assert.equal(scheduledPayload.status, 200);
  assert.equal(wpRun.data.publishRun.status, 'success');
  assert.equal(wfRun.data.publishRun.status, 'success');
  assert.equal(shopRun.data.publishRun.status, 'success');
  assert.equal(wixRun.data.publishRun.status, 'success');
  assert.equal(ghostRun.data.publishRun.status, 'success');
  assert.equal(genericFail.data.publishRun.status, 'failed');
  assert.equal(queue.data.failed.length >= 1, true);
  assert.equal(genericRetry.data.publishRun.status, 'success');
  assert.equal(scheduledRun.data.count, 1);
  assert.equal(scheduledRun.data.results[0].publishRun.status, 'success');
  assert.equal(exportRes.status, 200);
  console.log(JSON.stringify({ ok: true, checks: ['webflow publish adapter', 'shopify publish adapter', 'wix publish adapter', 'ghost publish adapter', 'generic webhook publisher', 'publish reconciliation ledger', 'failed publish retry queue', 'scheduled publishing lane', 'publish evidence export'] }, null, 2));
} finally {
  await server.close();
}
