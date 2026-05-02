import assert from 'node:assert/strict';
import { appFetch } from '../src/index.ts';
import { resetMemoryDbForTests } from '../src/lib/db.ts';
import { resetPlatformStore } from '../src/lib/platformStore.ts';
import { startTestServer } from './helpers/test-server.mjs';
function assertOkStatus(status) { assert.equal(status >= 200 && status < 300, true, `expected 2xx status, got ${status}`); }

resetMemoryDbForTests();
resetPlatformStore();

const server = await startTestServer({ port: 8797, runtimeEnv: { DB_MODE: 'memory' } });
const sourceUrl = `${server.origin}/fixtures/source`;
const publishUrl = `${server.origin}/publisher.local/content/publish`;

const orgId = 'strategy_org';
let workspaceId = '';
let projectId = '';
let promptPackId = '';
let articleId = '';

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
  let result = await request('/v1/workspaces', { method: 'POST', body: { name: 'Strategy Workspace', brand: 'Skye GEO Engine', niche: 'AI search growth' } });
  assertOkStatus(result.status);
  workspaceId = result.data.workspace.id;

  result = await request('/v1/projects', { method: 'POST', body: { name: 'Strategy Project', primaryUrl: sourceUrl, audience: 'operators' } });
  assertOkStatus(result.status);
  projectId = result.data.project.id;

  result = await request('/v1/audit/site', { method: 'POST', body: { url: sourceUrl } });
  assertOkStatus(result.status);

  result = await request('/v1/research', { method: 'POST', body: { urls: [sourceUrl], texts: ['Strategy smoke uses real proof and real actions only.'] } });
  assertOkStatus(result.status);
  const sourceIds = [...(result.data.inserted || []), ...(result.data.deduped || [])].map((item) => item.id);

  result = await request('/v1/articles/brief', { method: 'POST', body: { sourceIds, primaryKeyword: 'ai search growth', title: 'Beat thin GEO tools with proof', audience: 'operators', goal: 'win clients', brand: 'Skye GEO Engine' } });
  assertOkStatus(result.status);
  const briefId = result.data.brief.id;

  result = await request('/v1/articles/draft', { method: 'POST', body: { briefId, language: 'en', tone: 'operator', brand: 'Skye GEO Engine', callToAction: 'Book a proof-backed GEO review.' } });
  assertOkStatus(result.status);
  articleId = result.data.article.id;

  result = await request('/v1/publish/payload', { method: 'POST', body: { platform: 'generic-api', articleId } });
  assertOkStatus(result.status);
  const publishRunId = result.data.publishRun.id;

  result = await request('/v1/publish/execute', { method: 'POST', body: { publishRunId, targetUrl: publishUrl } });
  assertOkStatus(result.status);

  result = await request('/v1/visibility/prompt-pack', { method: 'POST', body: { brand: 'Skye GEO Engine', niche: 'AI search growth', market: 'US agencies', competitors: ['BabyLoveGrowth'] } });
  assertOkStatus(result.status);
  promptPackId = result.data.promptPack.id;

  result = await request('/v1/visibility/replay', { method: 'POST', body: { promptPackId, answers: [{ provider: 'chatgpt', prompt: 'best ai search growth platforms', answerText: `Skye GEO Engine appears with a citation to ${sourceUrl} and outclasses BabyLoveGrowth on proof.` }] } });
  assertOkStatus(result.status);

  result = await request('/v1/readiness/run', { method: 'POST', body: {} });
  assertOkStatus(result.status);

  result = await request('/v1/strategy/scorecard');
  assertOkStatus(result.status);
  assert.equal(result.data.scorecard.modules.length >= 10, true);
  assert.equal(result.data.scorecard.summary.overallScore > 0, true);

  result = await request('/v1/strategy/actions');
  assertOkStatus(result.status);
  assert.equal(Array.isArray(result.data.actions), true);
  assert.equal(result.data.actions.length >= 1, true);

  result = await request('/v1/strategy/export', { method: 'POST', body: {} });
  assertOkStatus(result.status);
  assert.ok(result.data.exportRecord.id);
  assert.equal(result.data.strategyPack.actions.length >= 1, true);
  assert.equal(result.data.strategyPack.runbook.length, 7);

  console.log(JSON.stringify({ ok: true, checks: ['strategy scorecard endpoint', 'strategy actions endpoint', 'strategy export endpoint'], summary: { workspaceId, projectId, promptPackId, articleId, overallScore: result.data.strategyPack.summary.overallScore, moatScore: result.data.strategyPack.summary.moatScore, strategyExportId: result.data.exportRecord.id, actionCount: result.data.strategyPack.actions.length } }, null, 2));
} finally {
  await server.close();
}
