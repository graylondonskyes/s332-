import assert from 'node:assert/strict';
import { appFetch } from '../src/index.ts';
import { resetMemoryDbForTests } from '../src/lib/db.ts';
import { resetPlatformStore } from '../src/lib/platformStore.ts';
import { startTestServer } from './helpers/test-server.mjs';

function assertOkStatus(status) { assert.equal(status >= 200 && status < 300, true, `expected 2xx status, got ${status}`); }

resetMemoryDbForTests();
resetPlatformStore();

const server = await startTestServer({ port: 8801, runtimeEnv: { DB_MODE: 'memory' } });
const orgId = 'targets_org';
let workspaceId = '';
let projectId = '';

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
  let result = await request('/v1/workspaces', { method: 'POST', body: { name: 'Targets Workspace', brand: 'Skye GEO Engine', niche: 'AI search growth' } });
  assertOkStatus(result.status);
  workspaceId = result.data.workspace.id;

  result = await request('/v1/projects', { method: 'POST', body: { name: 'Targets Project', primaryUrl: `${server.origin}/fixtures/source`, audience: 'operators' } });
  assertOkStatus(result.status);
  projectId = result.data.project.id;

  result = await request('/v1/targets/summary');
  assertOkStatus(result.status);
  assert.equal(result.data.summary.summary.probes, 0);

  result = await request('/v1/targets/probe', { method: 'POST', body: { platform: 'generic-api', targetUrl: `${server.origin}/publisher.local/content/publish` } });
  assertOkStatus(result.status);
  assert.equal(result.data.targetProbe.status, 'reachable');

  result = await request('/v1/targets/probe', { method: 'POST', body: { platform: 'neon-http', targetUrl: `${server.origin}/neon.local/sql` } });
  assertOkStatus(result.status);
  assert.equal(result.data.targetProbe.status, 'reachable');

  result = await request('/v1/targets/probes');
  assertOkStatus(result.status);
  assert.equal(result.data.items.length >= 2, true);

  result = await request('/v1/targets/summary');
  assertOkStatus(result.status);
  assert.equal(result.data.summary.summary.probes >= 2, true);
  assert.equal(result.data.summary.latestByPlatform['generic-api'].status, 'reachable');
  assert.equal(result.data.summary.latestByPlatform['neon-http'].status, 'reachable');

  result = await request('/v1/targets/export', { method: 'POST', body: {} });
  assertOkStatus(result.status);
  assert.ok(result.data.exportRecord.id);
  assert.equal((result.data.html || '').length > 500, true);
  assert.equal((result.data.targetPack.summary.summary.probes || 0) >= 2, true);

  console.log(JSON.stringify({
    ok: true,
    checks: ['target summary endpoint', 'target probe execution endpoint', 'target probe history endpoint', 'target pack export endpoint'],
    summary: {
      workspaceId,
      projectId,
      probes: result.data.targetPack.summary.summary.probes,
      reachable: result.data.targetPack.summary.summary.reachable,
      exportId: result.data.exportRecord.id
    }
  }, null, 2));
} finally {
  await server.close();
}
