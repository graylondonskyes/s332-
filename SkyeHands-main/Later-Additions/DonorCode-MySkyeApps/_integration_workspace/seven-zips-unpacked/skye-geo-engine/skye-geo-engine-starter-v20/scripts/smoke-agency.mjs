import assert from 'node:assert/strict';
import { appFetch } from '../src/index.ts';
import { resetMemoryDbForTests } from '../src/lib/db.ts';
import { resetPlatformStore } from '../src/lib/platformStore.ts';
import { startTestServer } from './helpers/test-server.mjs';

resetMemoryDbForTests();
resetPlatformStore();

const server = await startTestServer({ port: 8794, runtimeEnv: { DB_MODE: 'memory' } });
const sourceUrl = `${server.origin}/fixtures/source`;

async function request(path, { method = 'GET', orgId = 'org_agency', workspaceId, projectId, apiKey, body } = {}) {
  const headers = new Headers({ 'x-org-id': orgId });
  if (workspaceId) headers.set('x-workspace-id', workspaceId);
  if (projectId) headers.set('x-project-id', projectId);
  if (apiKey) headers.set('x-api-key', apiKey);
  if (body) headers.set('content-type', 'application/json');
  const response = await appFetch(new Request(`https://smoke.local${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), { DB_MODE: 'memory' });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}

try {
  const workspace = await request('/v1/workspaces', { method: 'POST', body: { name: 'Agency Workspace', brand: 'Skye GEO Engine', niche: 'AI search growth' } });
  const workspaceId = workspace.data.workspace.id;
  const project = await request('/v1/projects', { method: 'POST', workspaceId, body: { workspaceId, name: 'Agency Project', primaryUrl: sourceUrl, audience: 'operators' } });
  const projectId = project.data.project.id;

  const ownerKey = await request('/v1/auth/keys', { method: 'POST', workspaceId, projectId, body: { label: 'Owner Smoke', role: 'owner' } });
  const viewerKey = await request('/v1/auth/keys', { method: 'POST', workspaceId, projectId, body: { label: 'Viewer Smoke', role: 'viewer' } });
  const ownerSecret = ownerKey.data.secret;
  const viewerSecret = viewerKey.data.secret;

  const settings = await request('/v1/agency/settings', {
    method: 'POST', workspaceId, projectId, apiKey: ownerSecret,
    body: { displayName: 'Skye GEO Engine', logoUrl: 'https://assets.skye.local/logo.png', primaryColor: '#8d7bff', customDomain: 'growth.skye.local', quotas: { articleDraftsPerMonth: 1, replayRunsPerMonth: 3, publishExecPerMonth: 3 } }
  });
  assert.equal(settings.status, 200);
  assert.equal(settings.data.settings.customDomain, 'growth.skye.local');

  const denied = await request('/v1/agency/settings', { method: 'POST', workspaceId, projectId, apiKey: viewerSecret, body: { displayName: 'Denied Attempt' } });
  assert.equal(denied.status, 403);

  const seat = await request('/v1/agency/seats', { method: 'POST', workspaceId, projectId, apiKey: ownerSecret, body: { email: 'operator@skye.local', role: 'admin', status: 'active' } });
  const client = await request('/v1/agency/clients', { method: 'POST', workspaceId, projectId, apiKey: ownerSecret, body: { name: 'Launch Partner', contactEmail: 'partner@skye.local', brandName: 'Launch Partner Brand' } });
  assert.equal(seat.status, 201);
  assert.equal(client.status, 201);

  const research = await request('/v1/research', { method: 'POST', workspaceId, projectId, apiKey: ownerSecret, body: { urls: [sourceUrl], rawTexts: ['Proof-backed AI search growth beats thin-content tools.'] } });
  const sourceIds = [...(research.data.inserted || []), ...(research.data.deduped || [])].map((item) => item.id);
  const brief = await request('/v1/articles/brief', { method: 'POST', workspaceId, projectId, apiKey: ownerSecret, body: { workspaceId, projectId, title: 'Why proof-backed AI search operations win', primaryKeyword: 'proof-backed ai search growth', audience: 'operators', goal: 'generate pipeline', brand: 'Skye GEO Engine', sourceIds } });
  const briefId = brief.data.brief.id;
  const draftOne = await request('/v1/articles/draft', { method: 'POST', workspaceId, projectId, apiKey: ownerSecret, body: { workspaceId, projectId, briefId, brand: 'Skye GEO Engine', language: 'English', tone: 'executive', callToAction: 'Book an audit.' } });
  assert.equal(draftOne.status, 200);
  const draftTwo = await request('/v1/articles/draft', { method: 'POST', workspaceId, projectId, apiKey: ownerSecret, body: { workspaceId, projectId, briefId, brand: 'Skye GEO Engine', language: 'English', tone: 'executive', callToAction: 'Book an audit again.' } });
  assert.equal(draftTwo.status, 429);

  const usage = await request('/v1/agency/usage', { workspaceId, projectId, apiKey: ownerSecret });
  assert.equal(usage.status, 200);
  assert.equal(usage.data.summary.totals.articleDraftsPerMonth, 1);

  const invoice = await request('/v1/agency/invoices/export', { method: 'POST', workspaceId, projectId, apiKey: ownerSecret, body: {} });
  assert.equal(invoice.status, 200);
  assert.equal(invoice.data.invoiceExport.payload.summary.totals.articleDraftsPerMonth, 1);

  console.log(JSON.stringify({ ok: true, checks: ['api key auth lane', 'role-based access control', 'white-label branding settings', 'seat management', 'reseller client management', 'usage metering', 'plan/quota enforcement', 'invoice export lane'] }, null, 2));
} finally {
  await server.close();
}
