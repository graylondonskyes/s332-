import assert from 'node:assert/strict';
import { appFetch } from '../src/index.ts';
import { resetMemoryDbForTests } from '../src/lib/db.ts';
import { resetPlatformStore } from '../src/lib/platformStore.ts';
import { startTestServer } from './helpers/test-server.mjs';

resetMemoryDbForTests();
resetPlatformStore();

const server = await startTestServer({ port: 8796, runtimeEnv: { DB_MODE: 'memory' } });
const sourceUrl = `${server.origin}/fixtures/source`;

async function request(path, { method = 'GET', orgId = 'org_review', workspaceId, projectId, body } = {}) {
  const headers = new Headers({ 'x-org-id': orgId });
  if (workspaceId) headers.set('x-workspace-id', workspaceId);
  if (projectId) headers.set('x-project-id', projectId);
  if (body) headers.set('content-type', 'application/json');
  const response = await appFetch(new Request(`https://smoke.local${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), { DB_MODE: 'memory' });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}

try {
  const workspaceCreate = await request('/v1/workspaces', { method: 'POST', body: { name: 'Review Workspace', brand: 'Skye GEO Engine', niche: 'AI search growth' } });
  assert.equal(workspaceCreate.status, 201);
  const workspaceId = workspaceCreate.data.workspace.id;

  const projectCreate = await request('/v1/projects', { method: 'POST', workspaceId, body: { workspaceId, name: 'Review Project', primaryUrl: sourceUrl, audience: 'operators' } });
  assert.equal(projectCreate.status, 201);
  const projectId = projectCreate.data.project.id;

  const research = await request('/v1/research', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, urls: [sourceUrl], rawTexts: ['Operator review smoke validates article publish gates against stored sources.', 'Proof-backed review packs should catch unsupported claims before publish.'] } });
  assert.equal(research.status, 200);
  const sourceIds = [...new Set([...research.data.inserted, ...research.data.deduped].map((item) => item.id))];
  assert.equal(sourceIds.length >= 2, true);

  const brief = await request('/v1/articles/brief', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, title: 'How operator teams review GEO articles before publish', primaryKeyword: 'GEO article review gate', audience: 'operators', goal: 'reduce unsupported publish risk', brand: 'Skye GEO Engine', sourceIds } });
  assert.equal(brief.status, 200);

  const draft = await request('/v1/articles/draft', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, briefId: brief.data.brief.id, brand: 'Skye GEO Engine', language: 'English', tone: 'operator', callToAction: 'Book the proof-backed article review.' } });
  assert.equal(draft.status, 200);
  const articleId = draft.data.article.id;

  const review = await request('/v1/articles/review', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, articleId } });
  assert.equal(review.status, 200);
  assert.equal(review.data.articleReview.metrics.claimCount >= 1, true);
  assert.equal(review.data.articleReview.dimensions.length, 5);
  assert.equal(['pass', 'warn', 'fail'].includes(review.data.articleReview.verdict), true);
  assert.equal(['ready', 'conditional', 'blocked'].includes(review.data.articleReview.publishReadiness.gate), true);

  const reviewExport = await request('/v1/articles/review/export', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, articleId } });
  assert.equal(reviewExport.status, 200);
  assert.match(reviewExport.data.articleReviewHtml, /Article review pack/);
  assert.match(reviewExport.data.articleReviewHtml, /Publish readiness/);

  const reviewList = await request('/v1/articles/reviews', { workspaceId });
  assert.equal(reviewList.status, 200);
  assert.equal(reviewList.data.items.length >= 2, true);

  const history = await request('/v1/history', { workspaceId });
  assert.equal(history.status, 200);
  const exportTypes = history.data.history.evidenceExports.map((item) => item.exportType);
  assert.equal(exportTypes.includes('article_review'), true);
  assert.equal(exportTypes.includes('article_review_pack'), true);

  console.log(JSON.stringify({ ok: true, workspaceId, projectId, articleId, checks: ['article review generation', 'article publish gate scoring', 'article review HTML export', 'article review evidence ledger persistence'] }, null, 2));
} finally {
  await server.close();
}
