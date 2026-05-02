import assert from 'node:assert/strict';
import { appFetch } from '../src/index.ts';
import { resetMemoryDbForTests } from '../src/lib/db.ts';
import { resetPlatformStore } from '../src/lib/platformStore.ts';
import { startTestServer } from './helpers/test-server.mjs';
function assertOkStatus(status) { assert.equal(status >= 200 && status < 300, true, `expected 2xx status, got ${status}`); }

resetMemoryDbForTests();
resetPlatformStore();

const server = await startTestServer({ port: 8795, runtimeEnv: { DB_MODE: 'memory' } });
const sourceUrl = `${server.origin}/fixtures/source`;
const publishUrl = `${server.origin}/publisher.local/content/publish`;

const orgId = 'report_org';
let workspaceId = '';
let projectId = '';
let promptPackId = '';
let articleId = '';
let publishRunId = '';
let placementId = '';

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
  let result = await request('/v1/workspaces', { method: 'POST', body: { name: 'Reporting Workspace', brand: 'Skye GEO Engine', niche: 'AI search growth' } });
  assertOkStatus(result.status);
  workspaceId = result.data.workspace.id;

  result = await request('/v1/projects', { method: 'POST', body: { name: 'Reporting Project', primaryUrl: sourceUrl, audience: 'operators' } });
  assertOkStatus(result.status);
  projectId = result.data.project.id;

  result = await request('/v1/audit/site', { method: 'POST', body: { url: sourceUrl } });
  assertOkStatus(result.status);

  result = await request('/v1/evidence/export', { method: 'POST', body: { exportType: 'audit' } });
  assertOkStatus(result.status);

  result = await request('/v1/content/plan', { method: 'POST', body: { brand: 'Skye GEO Engine', niche: 'AI search growth', audience: 'operators' } });
  assertOkStatus(result.status);

  result = await request('/v1/research', { method: 'POST', body: { urls: [sourceUrl], texts: ['Operator notes for reporting smoke.'] } });
  assertOkStatus(result.status);
  const sourceIds = [...(result.data.inserted || []), ...(result.data.deduped || [])].map((item) => item.id);
  assert.equal(sourceIds.length >= 1, true);

  result = await request('/v1/articles/brief', { method: 'POST', body: { sourceIds, primaryKeyword: 'ai search growth', title: 'Proof-backed GEO reporting', audience: 'operators', goal: 'win AI-search visibility', brand: 'Skye GEO Engine' } });
  assertOkStatus(result.status);
  const briefId = result.data.brief.id;

  result = await request('/v1/articles/draft', { method: 'POST', body: { briefId, language: 'en', tone: 'executive', brand: 'Skye GEO Engine', callToAction: 'Book the proof-backed growth review.' } });
  assertOkStatus(result.status);
  articleId = result.data.article.id;

  result = await request('/v1/publish/payload', { method: 'POST', body: { platform: 'generic-api', articleId } });
  assertOkStatus(result.status);
  publishRunId = result.data.publishRun.id;

  result = await request('/v1/publish/execute', { method: 'POST', body: { publishRunId, targetUrl: publishUrl } });
  assertOkStatus(result.status);
  assert.equal(result.data.publishRun.status, 'success');

  result = await request('/v1/publish/export', { method: 'POST', body: {} });
  assertOkStatus(result.status);

  result = await request('/v1/visibility/prompt-pack', { method: 'POST', body: { brand: 'Skye GEO Engine', niche: 'AI search growth', market: 'US agencies', competitors: ['BabyLoveGrowth'] } });
  assertOkStatus(result.status);
  promptPackId = result.data.promptPack.id;

  result = await request('/v1/visibility/replay', { method: 'POST', body: { promptPackId, answers: [{ provider: 'chatgpt', prompt: 'best ai search growth tools', answerText: `Skye GEO Engine is mentioned with a citation to ${sourceUrl} alongside BabyLoveGrowth.` }] } });
  assertOkStatus(result.status);

  result = await request('/v1/visibility/export', { method: 'POST', body: {} });
  assertOkStatus(result.status);

  result = await request('/v1/auth/keys', { method: 'POST', body: { label: 'reporting-admin', role: 'admin' } });
  assertOkStatus(result.status);

  result = await request('/v1/agency/settings', { method: 'POST', body: { displayName: 'Skye GEO Engine', primaryColor: '#8d7bff', customDomain: 'geo.local' } });
  assertOkStatus(result.status);

  result = await request('/v1/agency/seats', { method: 'POST', body: { email: 'ops@skye.local', role: 'editor', status: 'active' } });
  assertOkStatus(result.status);

  result = await request('/v1/agency/clients', { method: 'POST', body: { name: 'Reporting Client', contactEmail: 'client@skye.local', brandName: 'Reporting Client Brand' } });
  assertOkStatus(result.status);

  result = await request('/v1/agency/usage');
  assertOkStatus(result.status);

  result = await request('/v1/agency/invoices/export', { method: 'POST', body: {} });
  assertOkStatus(result.status);

  result = await request('/v1/backlinks/sites', { method: 'POST', body: { domain: 'partner.local', siteName: 'Partner Local', topicalTags: ['ai', 'growth'], ownerFingerprint: 'owner-1', monthlyTraffic: 180000, organicKeywords: 42000, domainRating: 78, sponsoredRatio: 0.03, outboundLinksPerMonth: 8 } });
  assertOkStatus(result.status);
  const partnerSiteId = result.data.site.id;

  result = await request('/v1/backlinks/placements', { method: 'POST', body: { partnerSiteIds: [partnerSiteId], targetUrl: sourceUrl, targetKeyword: 'ai search growth', targetTags: ['ai', 'growth'], anchorOptions: ['proof-backed growth audit', 'ai visibility engine'] } });
  assertOkStatus(result.status);
  placementId = result.data.queued[0].id;

  result = await request('/v1/backlinks/reconcile', { method: 'POST', body: { placementId, status: 'live', liveUrl: 'https://partner.local/post/skye' } });
  assertOkStatus(result.status);

  result = await request('/v1/workspace-bundles/export', { method: 'POST', body: {} });
  assertOkStatus(result.status);

  result = await request('/v1/proof/matrix');
  assertOkStatus(result.status);
  assert.equal(result.data.matrix.summary.modules >= 10, true);

  result = await request('/v1/walkthrough-runs');
  assertOkStatus(result.status);
  assert.equal(result.data.walkthroughRun.summary.modules >= 10, true);

  result = await request('/v1/reports/summary?audience=investor');
  assertOkStatus(result.status);
  assert.equal(result.data.report.audience, 'investor');

  result = await request('/v1/reports/site', { method: 'POST', body: { audience: 'client' } });
  assertOkStatus(result.status);
  assert.equal(typeof result.data.html, 'string');
  assert.equal(result.data.html.includes('<!doctype html>'), true);
  assert.equal(result.data.report.proofMatrix.length >= 10, true);

  result = await request('/v1/reports/export', { method: 'POST', body: { audience: 'investor' } });
  assertOkStatus(result.status);
  assert.ok(result.data.exportRecord.id);
  assert.equal(result.data.matrixSummary.modules >= 10, true);
  assert.equal(result.data.walkthroughSummary.modules >= 10, true);

  console.log(JSON.stringify({ ok: true, checks: ['proof matrix endpoint', 'workspace walkthrough run endpoint', 'report summary endpoint', 'report site generation endpoint', 'report export endpoint'], summary: { workspaceId, projectId, promptPackId, articleId, publishRunId, placementId, reportExportId: result.data.exportRecord.id } }, null, 2));
} finally {
  await server.close();
}
