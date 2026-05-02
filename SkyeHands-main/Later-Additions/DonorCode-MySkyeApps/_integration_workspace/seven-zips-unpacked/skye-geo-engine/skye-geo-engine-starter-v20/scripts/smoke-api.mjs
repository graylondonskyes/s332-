import assert from 'node:assert/strict';
import { appFetch } from '../src/index.ts';
import { resetMemoryDbForTests } from '../src/lib/db.ts';
import { resetPlatformStore } from '../src/lib/platformStore.ts';
import { startTestServer } from './helpers/test-server.mjs';

resetMemoryDbForTests();
resetPlatformStore();

const server = await startTestServer({ port: 8791, runtimeEnv: { DB_MODE: 'memory' } });
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
  const workspaceCreate = await request('/v1/workspaces', { method: 'POST', body: { name: 'Smoke Workspace', brand: 'Skye GEO Engine', niche: 'AI search growth' } });
  assert.equal(workspaceCreate.status, 201);
  const workspaceId = workspaceCreate.data.workspace.id;

  const projectCreate = await request('/v1/projects', { method: 'POST', workspaceId, body: { workspaceId, name: 'Parity Project', primaryUrl: sourceUrl, audience: 'agencies' } });
  assert.equal(projectCreate.status, 201);
  const projectId = projectCreate.data.project.id;

  const audit = await request('/v1/audit/site', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, url: sourceUrl } });
  assert.equal(audit.status, 200);

  const plan = await request('/v1/content/plan', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, brand: 'Skye GEO Engine', niche: 'AI search growth', audience: 'agencies' } });
  assert.equal(plan.status, 200);
  assert.equal(plan.data.result.items.length, 30);

  const promptPack = await request('/v1/visibility/prompt-pack', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, brand: 'Skye GEO Engine', niche: 'AI search growth', market: 'US', competitors: ['BabyLoveGrowth'] } });
  assert.equal(promptPack.status, 200);
  assert.equal(promptPack.data.result.prompts.length >= 4, true);

  const research = await request('/v1/research', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, urls: [sourceUrl], rawTexts: ['AI search growth requires source proof.', 'AI search growth requires source proof.'] } });
  assert.equal(research.status, 200);
  assert.equal(research.data.inserted.length, 2);
  assert.equal(research.data.deduped.length, 1);
  const sourceIds = [...new Set([...research.data.inserted, ...research.data.deduped].map((item) => item.id))];

  const brief = await request('/v1/articles/brief', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, title: 'How agencies win AI search with proof-backed operations', primaryKeyword: 'AI search growth platform', audience: 'agency operators', goal: 'increase qualified pipeline', brand: 'Skye GEO Engine', sourceIds } });
  assert.equal(brief.status, 200);
  const briefId = brief.data.brief.id;

  const draft = await request('/v1/articles/draft', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, briefId, brand: 'Skye GEO Engine', language: 'Spanish', tone: 'executive', callToAction: 'Reserve a strategy call.' } });
  assert.equal(draft.status, 200);
  const article = draft.data.article;
  assert.equal(article.language, 'Spanish');
  assert.equal(article.tone, 'executive');
  assert.equal(article.claimMap.length > 0, true);
  assert.equal(article.faqItems.length > 0, true);
  assert.match(article.bodyHtml, /Infographic brief/);

  const auditExport = await request('/v1/evidence/export', { method: 'POST', workspaceId, projectId, body: { exportType: 'audit' } });
  assert.equal(auditExport.status, 200);

  const history = await request('/v1/history', { workspaceId });
  assert.equal(history.status, 200);
  assert.equal(history.data.history.articles.length, 1);
  assert.equal(history.data.history.evidenceExports.length, 1);

  console.log(JSON.stringify({ ok: true, workspaceId, projectId, articleId: article.id, checks: ['multilingual draft generation', 'tone/CTA controls', 'claim-to-source mapping', 'FAQ injection', 'audit evidence export'] }, null, 2));
} finally {
  await server.close();
}
