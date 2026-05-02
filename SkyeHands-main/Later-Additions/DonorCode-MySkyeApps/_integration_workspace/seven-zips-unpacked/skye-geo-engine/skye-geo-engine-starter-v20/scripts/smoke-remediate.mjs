import assert from 'node:assert/strict';
import { appFetch } from '../src/index.ts';
import { resetMemoryDbForTests } from '../src/lib/db.ts';
import { resetPlatformStore } from '../src/lib/platformStore.ts';
import { startTestServer } from './helpers/test-server.mjs';

resetMemoryDbForTests();
resetPlatformStore();

const server = await startTestServer({ port: 8797, runtimeEnv: { DB_MODE: 'memory' } });
const sourceUrl = `${server.origin}/fixtures/source`;

async function request(path, { method = 'GET', orgId = 'org_remediate', workspaceId, projectId, body } = {}) {
  const headers = new Headers({ 'x-org-id': orgId });
  if (workspaceId) headers.set('x-workspace-id', workspaceId);
  if (projectId) headers.set('x-project-id', projectId);
  if (body) headers.set('content-type', 'application/json');
  const response = await appFetch(new Request(`https://smoke.local${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), { DB_MODE: 'memory' });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}

try {
  const workspaceCreate = await request('/v1/workspaces', { method: 'POST', body: { name: 'Remediation Workspace', brand: 'Skye GEO Engine', niche: 'AI search growth' } });
  assert.equal(workspaceCreate.status, 201);
  const workspaceId = workspaceCreate.data.workspace.id;

  const projectCreate = await request('/v1/projects', { method: 'POST', workspaceId, body: { workspaceId, name: 'Remediation Project', primaryUrl: sourceUrl, audience: 'operators' } });
  assert.equal(projectCreate.status, 201);
  const projectId = projectCreate.data.project.id;

  const research = await request('/v1/research', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, urls: [sourceUrl], rawTexts: ['Operators need stronger publish candidates when review finds gaps.', 'Remediation should improve depth, CTA continuity, and FAQ coverage before CMS execution.'] } });
  assert.equal(research.status, 200);
  const sourceIds = [...new Set([...research.data.inserted, ...research.data.deduped].map((item) => item.id))];
  assert.equal(sourceIds.length >= 2, true);

  const brief = await request('/v1/articles/brief', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, title: 'How to remediate GEO articles before publish', primaryKeyword: 'GEO article remediation', audience: 'operators', goal: 'improve score before publish', brand: 'Skye GEO Engine', sourceIds } });
  assert.equal(brief.status, 200);

  const draft = await request('/v1/articles/draft', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, briefId: brief.data.brief.id, brand: 'Skye GEO Engine', language: 'English', tone: 'operator', callToAction: 'Review the draft.' } });
  assert.equal(draft.status, 200);
  const articleId = draft.data.article.id;

  const review = await request('/v1/articles/review', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, articleId } });
  assert.equal(review.status, 200);
  const baselineScore = review.data.articleReview.overallScore;

  const remediation = await request('/v1/articles/remediate', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, articleId } });
  assert.equal(remediation.status, 200);
  assert.equal(Array.isArray(remediation.data.articleRemediation.actions), true);
  assert.equal(remediation.data.articleRemediation.actions.length >= 3, true);
  assert.equal(remediation.data.articleRemediation.predictedReview.overallScore >= baselineScore, true);
  assert.equal(remediation.data.articleRemediation.predictedReview.publishReadiness.gate !== undefined, true);
  assert.match(remediation.data.articleRemediation.remediatedArticle.bodyHtml, /Evidence-backed implementation lane|Operational proof point/);

  const remediationExport = await request('/v1/articles/remediate/export', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, articleId } });
  assert.equal(remediationExport.status, 200);
  assert.match(remediationExport.data.articleRemediationHtml, /Article remediation pack/);
  assert.match(remediationExport.data.articleRemediationHtml, /Predicted review gate/);

  const remediationList = await request('/v1/articles/remediations', { workspaceId });
  assert.equal(remediationList.status, 200);
  assert.equal(remediationList.data.items.length >= 2, true);

  const history = await request('/v1/history', { workspaceId });
  assert.equal(history.status, 200);
  const exportTypes = history.data.history.evidenceExports.map((item) => item.exportType);
  assert.equal(exportTypes.includes('article_remediation'), true);
  assert.equal(exportTypes.includes('article_remediation_pack'), true);

  console.log(JSON.stringify({ ok: true, workspaceId, projectId, articleId, baselineScore, predictedScore: remediation.data.articleRemediation.predictedReview.overallScore, checks: ['article remediation generation', 'score improvement or preservation', 'article remediation HTML export', 'article remediation evidence ledger persistence'] }, null, 2));
} finally {
  await server.close();
}
