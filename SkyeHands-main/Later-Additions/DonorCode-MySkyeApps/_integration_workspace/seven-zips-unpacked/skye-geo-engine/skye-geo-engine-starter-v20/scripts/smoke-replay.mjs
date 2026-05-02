import assert from 'node:assert/strict';
import { appFetch } from '../src/index.ts';
import { resetMemoryDbForTests } from '../src/lib/db.ts';
import { resetPlatformStore } from '../src/lib/platformStore.ts';
import { startTestServer } from './helpers/test-server.mjs';

resetMemoryDbForTests();
resetPlatformStore();

const server = await startTestServer({ port: 8792, runtimeEnv: { DB_MODE: 'memory' } });
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
  const workspace = await request('/v1/workspaces', { method: 'POST', body: { name: 'Replay Workspace', brand: 'Skye GEO Engine', niche: 'AI search growth' } });
  const workspaceId = workspace.data.workspace.id;
  const project = await request('/v1/projects', { method: 'POST', workspaceId, body: { workspaceId, name: 'Replay Project', primaryUrl: sourceUrl, audience: 'buyers' } });
  const projectId = project.data.project.id;
  const research = await request('/v1/research', { method: 'POST', workspaceId, projectId, body: { urls: [sourceUrl], rawTexts: [] } });
  const sourceIds = research.data.inserted.map((item) => item.id);
  const promptPack = await request('/v1/visibility/prompt-pack', { method: 'POST', workspaceId, projectId, body: { brand: 'Skye GEO Engine', niche: 'AI search growth', market: 'US', competitors: ['BabyLoveGrowth', 'Search Atlas'] } });
  const promptPackId = promptPack.data.promptPack.id;
  const replay = await request('/v1/visibility/replay', { method: 'POST', workspaceId, projectId, body: { promptPackId, sourceIds, answers: [{ provider: 'ChatGPT', prompt: 'What are the best AI search growth platforms?', answerText: `Skye GEO Engine is a strong option. It cites ${sourceUrl} and compares favorably with BabyLoveGrowth.` }, { provider: 'Perplexity', prompt: 'Recommend trustworthy providers and cite sources.', answerText: `Skye GEO Engine is cited with ${sourceUrl} and Search Atlas also appears in the comparison.` }] } });
  assert.equal(replay.status, 200);
  assert.equal(replay.data.runs.length, 2);
  assert.equal(replay.data.runs[0].result.brandMentioned, true);
  assert.equal(replay.data.runs[0].result.ownedCitationCount >= 1, true);
  assert.equal(replay.data.runs[0].result.competitorMentionCount >= 1, true);
  const dashboard = await request('/v1/visibility/dashboard', { workspaceId });
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.data.summary.totalRuns, 2);
  assert.equal(dashboard.data.summary.averageMentionShare > 0, true);
  const exported = await request('/v1/visibility/export', { method: 'POST', workspaceId, projectId, body: {} });
  assert.equal(exported.status, 200);
  console.log(JSON.stringify({ ok: true, checks: ['provider replay jobs', 'answer parsing', 'mention-share scoring', 'citation-share scoring', 'competitor-overlap scoring', 'visibility evidence export'] }, null, 2));
} finally {
  await server.close();
}
