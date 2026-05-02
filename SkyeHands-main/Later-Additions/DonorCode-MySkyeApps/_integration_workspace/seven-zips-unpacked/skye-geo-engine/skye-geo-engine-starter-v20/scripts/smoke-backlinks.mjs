import assert from 'node:assert/strict';
import { appFetch } from '../src/index.ts';
import { resetPlatformStore } from '../src/lib/platformStore.ts';

resetPlatformStore();

async function request(path, { method = 'GET', orgId = 'org_backlinks', workspaceId, projectId, apiKey, body } = {}) {
  const headers = new Headers({ 'x-org-id': orgId });
  if (workspaceId) headers.set('x-workspace-id', workspaceId);
  if (projectId) headers.set('x-project-id', projectId);
  if (apiKey) headers.set('x-api-key', apiKey);
  if (body) headers.set('content-type', 'application/json');
  const response = await appFetch(new Request(`https://smoke.local${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), { DB_MODE: 'memory' });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}

const workspace = await request('/v1/workspaces', { method: 'POST', body: { name: 'Backlink Workspace', brand: 'Skye GEO Engine', niche: 'AI search growth' } });
const workspaceId = workspace.data.workspace.id;
const project = await request('/v1/projects', { method: 'POST', workspaceId, body: { workspaceId, name: 'Backlink Project', primaryUrl: 'http://127.0.0.1:8787/fixtures/source', audience: 'operators' } });
const projectId = project.data.project.id;
const ownerKey = await request('/v1/auth/keys', { method: 'POST', workspaceId, projectId, body: { label: 'Backlink Owner', role: 'owner' } });
const viewerKey = await request('/v1/auth/keys', { method: 'POST', workspaceId, projectId, body: { label: 'Backlink Viewer', role: 'viewer' } });
const ownerSecret = ownerKey.data.secret;
const viewerSecret = viewerKey.data.secret;

const goodSite = await request('/v1/backlinks/sites', {
  method: 'POST', workspaceId, projectId, apiKey: ownerSecret,
  body: { domain: 'authoritygrowth.com', siteName: 'Authority Growth', topicalTags: ['ai', 'search', 'growth', 'seo'], monthlyTraffic: 180000, organicKeywords: 12000, domainRating: 68, sponsoredRatio: 0.12, outboundLinksPerMonth: 22, ownerFingerprint: 'cluster-alpha' }
});
const badSite = await request('/v1/backlinks/sites', {
  method: 'POST', workspaceId, projectId, apiKey: ownerSecret,
  body: { domain: 'spammy-network.biz', siteName: 'Spammy Network', topicalTags: ['casino'], monthlyTraffic: 1800, organicKeywords: 120, domainRating: 12, sponsoredRatio: 0.82, outboundLinksPerMonth: 260, ownerFingerprint: 'cluster-alpha' }
});
assert.equal(goodSite.status, 201);
assert.equal(badSite.status, 201);
assert.equal(goodSite.data.site.policyStatus, 'approved');
assert.equal(badSite.data.site.policyStatus, 'rejected');
assert.equal(badSite.data.site.flags.includes('duplicate_owner_cluster'), true);

const placement = await request('/v1/backlinks/placements', {
  method: 'POST', workspaceId, projectId, apiKey: ownerSecret,
  body: {
    workspaceId,
    partnerSiteIds: [goodSite.data.site.id, badSite.data.site.id],
    targetUrl: 'http://127.0.0.1:8787/fixtures/source',
    targetKeyword: 'ai search growth platform',
    targetTags: ['ai', 'search', 'growth'],
    anchorOptions: ['AI search growth platform', 'proof-backed GEO engine', 'operator-grade AI SEO']
  }
});
assert.equal(placement.status, 201);
assert.equal(placement.data.queued.length, 1);
assert.equal(placement.data.rejected.length, 1);
assert.equal(placement.data.queued[0].anchorDiversityScore > 0, true);

const denied = await request('/v1/backlinks/sites', { method: 'POST', workspaceId, projectId, apiKey: viewerSecret, body: { domain: 'denied.test', siteName: 'Denied', topicalTags: ['ai'] } });
assert.equal(denied.status, 403);

const reconciled = await request('/v1/backlinks/reconcile', { method: 'POST', workspaceId, projectId, apiKey: ownerSecret, body: { placementId: placement.data.queued[0].id, status: 'live', liveUrl: 'https://authoritygrowth.com/posts/skye-geo-engine' } });
assert.equal(reconciled.status, 200);
assert.equal(reconciled.data.placement.status, 'live');

const dashboard = await request('/v1/backlinks/dashboard', { workspaceId, projectId, apiKey: ownerSecret });
assert.equal(dashboard.status, 200);
assert.equal(dashboard.data.summary.totalSites, 2);
assert.equal(dashboard.data.summary.livePlacements, 1);
assert.equal(dashboard.data.summary.approvedSites, 1);
assert.equal(dashboard.data.summary.flaggedSites >= 1, true);

console.log(JSON.stringify({ ok: true, checks: ['partner-site registry', 'site quality policy', 'topical relevance scoring', 'placement queue', 'anchor diversity rules', 'backlink reconciliation ledger', 'fraud/abuse detection', 'network health dashboard'] }, null, 2));
