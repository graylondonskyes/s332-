import assert from 'node:assert/strict';
import { appFetch } from '../src/index.ts';
import { resetMemoryDbForTests } from '../src/lib/db.ts';
import { resetPlatformStore } from '../src/lib/platformStore.ts';
import { startTestServer } from './helpers/test-server.mjs';

resetMemoryDbForTests();
resetPlatformStore();

const server = await startTestServer({ port: 8798, runtimeEnv: { DB_MODE: 'memory' } });
const sourceUrl = `${server.origin}/fixtures/source`;

async function request(path, { method = 'GET', orgId = 'org_alpha', workspaceId, projectId, body } = {}) {
  const headers = new Headers({ 'x-org-id': orgId });
  if (workspaceId) headers.set('x-workspace-id', workspaceId);
  if (projectId) headers.set('x-project-id', projectId);
  if (body) headers.set('content-type', 'application/json');
  const response = await appFetch(new Request(`https://smoke.local${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), { DB_MODE: 'memory' });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}

try {
  const workspace = await request('/v1/workspaces', { method: 'POST', body: { name: 'Bundle Source Workspace', brand: 'Skye GEO Engine', niche: 'AI search growth' } });
  assert.equal(workspace.status, 201);
  const workspaceId = workspace.data.workspace.id;
  const project = await request('/v1/projects', { method: 'POST', workspaceId, body: { workspaceId, name: 'Bundle Source Project', primaryUrl: sourceUrl, audience: 'operators' } });
  assert.equal(project.status, 201);
  const projectId = project.data.project.id;

  const audit = await request('/v1/audit/site', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, url: sourceUrl } });
  assert.equal(audit.status, 200);
  await request('/v1/content/plan', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, brand: 'Skye GEO Engine', niche: 'AI search growth', audience: 'operators' } });
  const promptPack = await request('/v1/visibility/prompt-pack', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, brand: 'Skye GEO Engine', niche: 'AI search growth', market: 'US', competitors: ['BabyLoveGrowth'] } });
  const promptPackId = promptPack.data.promptPack.id;
  const research = await request('/v1/research', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, rawTexts: ['Proof-backed growth systems win.', 'Replay evidence improves trust.'] } });
  const sourceIds = [...research.data.inserted.map((item) => item.id)];
  const brief = await request('/v1/articles/brief', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, title: 'Bundle-safe proof systems', primaryKeyword: 'proof-backed ai seo', audience: 'operators', goal: 'close deals', brand: 'Skye GEO Engine', sourceIds } });
  const briefId = brief.data.brief.id;
  const draft = await request('/v1/articles/draft', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, briefId, brand: 'Skye GEO Engine', language: 'English', tone: 'operator', callToAction: 'Book a proof audit.' } });
  const articleId = draft.data.article.id;
  await request('/v1/publish/payload', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, articleId, platform: 'ghost' } });
  await request('/v1/visibility/replay', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, promptPackId, answers: [{ provider: 'ChatGPT', prompt: 'best ai seo tools', answerText: 'Skye GEO Engine is proof-backed and cites sources.' }] } });

  const exported = await request('/v1/workspace-bundles/export', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId } });
  assert.equal(exported.status, 200);
  assert.equal(exported.data.summary.articles, 1);
  assert.equal(exported.data.summary.publishRuns, 1);

  resetMemoryDbForTests();
  resetPlatformStore();

  const imported = await request('/v1/workspace-bundles/import', { method: 'POST', body: { bundle: exported.data.bundle, workspaceName: 'Restored Bundle Workspace' } });
  assert.equal(imported.status, 201);
  assert.equal(imported.data.summary.articles, 1);
  assert.equal(imported.data.summary.sources, 2);
  const restoredWorkspaceId = imported.data.workspace.id;

  const restoredHistory = await request('/v1/history', { workspaceId: restoredWorkspaceId });
  assert.equal(restoredHistory.status, 200);
  assert.equal(restoredHistory.data.history.publishRuns.length, 1);
  assert.equal(restoredHistory.data.history.visibilityRuns.length, 1);
  assert.equal(restoredHistory.data.history.briefs[0].sourceIds.length, 2);
  assert.notEqual(restoredHistory.data.history.articles[0].id, articleId);

  const cloned = await request('/v1/workspace-bundles/clone', { method: 'POST', workspaceId: restoredWorkspaceId, body: { workspaceId: restoredWorkspaceId, workspaceName: 'Cloned Bundle Workspace' } });
  assert.equal(cloned.status, 201);
  assert.equal(cloned.data.summary.articles, 1);
  assert.notEqual(cloned.data.workspace.id, restoredWorkspaceId);
  assert.notEqual(cloned.data.history.articles[0].id, restoredHistory.data.history.articles[0].id);

  console.log(JSON.stringify({ ok: true, checks: ['workspace bundle export', 'workspace bundle import after reset', 'history remap restore', 'workspace clone with full child-record remap'] }, null, 2));
} finally {
  await server.close();
}
