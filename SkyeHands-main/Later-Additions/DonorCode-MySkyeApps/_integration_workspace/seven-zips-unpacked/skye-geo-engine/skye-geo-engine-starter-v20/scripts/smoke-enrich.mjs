import assert from 'node:assert/strict';
import { appFetch } from '../src/index.ts';
import { resetMemoryDbForTests } from '../src/lib/db.ts';
import { resetPlatformStore } from '../src/lib/platformStore.ts';
import { startTestServer } from './helpers/test-server.mjs';

resetMemoryDbForTests();
resetPlatformStore();

const server = await startTestServer({ port: 8795, runtimeEnv: { DB_MODE: 'memory' } });
const sourceUrl = `${server.origin}/fixtures/source`;

async function request(path, { method = 'GET', orgId = 'org_enrich', workspaceId, projectId, body } = {}) {
  const headers = new Headers({ 'x-org-id': orgId });
  if (workspaceId) headers.set('x-workspace-id', workspaceId);
  if (projectId) headers.set('x-project-id', projectId);
  if (body) headers.set('content-type', 'application/json');
  const response = await appFetch(new Request(`https://smoke.local${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), { DB_MODE: 'memory' });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}

try {
  const workspaceCreate = await request('/v1/workspaces', { method: 'POST', body: { name: 'Enrichment Workspace', brand: 'Skye GEO Engine', niche: 'AI search growth' } });
  assert.equal(workspaceCreate.status, 201);
  const workspaceId = workspaceCreate.data.workspace.id;

  const projectCreate = await request('/v1/projects', { method: 'POST', workspaceId, body: { workspaceId, name: 'Enrichment Project', primaryUrl: sourceUrl, audience: 'operators' } });
  assert.equal(projectCreate.status, 201);
  const projectId = projectCreate.data.project.id;

  const research = await request('/v1/research', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, urls: [sourceUrl], rawTexts: ['Proof-backed publishing requires internal links and schema carry-through.'] } });
  assert.equal(research.status, 200);
  const sourceIds = [...new Set([...research.data.inserted, ...research.data.deduped].map((item) => item.id))];
  assert.equal(sourceIds.length >= 1, true);

  const brief = await request('/v1/articles/brief', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, title: 'How proof-backed operators publish AI search content', primaryKeyword: 'AI search content operations', audience: 'operators', goal: 'ship higher-conviction content', brand: 'Skye GEO Engine', sourceIds } });
  assert.equal(brief.status, 200);

  const draft = await request('/v1/articles/draft', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, briefId: brief.data.brief.id, brand: 'Skye GEO Engine', language: 'English', tone: 'technical', callToAction: 'Start the proof-backed workflow.' } });
  assert.equal(draft.status, 200);
  const articleId = draft.data.article.id;

  const enrichment = await request('/v1/articles/enrich', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, articleId } });
  assert.equal(enrichment.status, 200);
  assert.equal(enrichment.data.enrichmentPack.internalLinks.length >= 3, true);
  assert.match(enrichment.data.enrichmentPack.schemaJsonLd, /FAQPage/);
  assert.match(enrichment.data.enrichmentPack.metaDescription, /source mapping|proof/i);

  const enrichmentExport = await request('/v1/articles/enrich/export', { method: 'POST', workspaceId, projectId, body: { workspaceId, projectId, articleId } });
  assert.equal(enrichmentExport.status, 200);
  assert.match(enrichmentExport.data.enrichmentPackHtml, /Article enrichment pack/);
  assert.match(enrichmentExport.data.enrichmentPackHtml, /Internal-link plan/);

  const enrichmentList = await request('/v1/articles/enrichments', { workspaceId });
  assert.equal(enrichmentList.status, 200);
  assert.equal(enrichmentList.data.items.length >= 2, true);

  const history = await request('/v1/history', { workspaceId });
  assert.equal(history.status, 200);
  const exportTypes = history.data.history.evidenceExports.map((item) => item.exportType);
  assert.equal(exportTypes.includes('article_enrichment'), true);
  assert.equal(exportTypes.includes('article_enrichment_pack'), true);

  console.log(JSON.stringify({ ok: true, workspaceId, projectId, articleId, checks: ['article enrichment generation', 'schema graph generation', 'internal-link planning', 'article enrichment HTML export', 'enrichment evidence ledger persistence'] }, null, 2));
} finally {
  await server.close();
}
