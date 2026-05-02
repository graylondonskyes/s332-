import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { startPersistentTestServer } from './helpers/persistent-test-server.mjs';

const snapshotFile = path.join(os.tmpdir(), `skye-geo-engine-durable-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
const headers = { 'content-type': 'application/json', 'x-org-id': 'org_durable' };

async function send(origin, pathname, method = 'GET', body) {
  const response = await fetch(`${origin}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`${method} ${pathname} -> ${response.status} ${text}`);
  return data;
}

let server = await startPersistentTestServer({ port: 8789, snapshotFile });
let workspace;
let project;
let audit;
let historyBefore;
let snapshotSize;
try {
  workspace = (await send(server.origin, '/v1/workspaces', 'POST', { name: 'Durable Workspace', brand: 'Skye GEO Engine', niche: 'AI search growth' })).workspace;
  project = (await send(server.origin, '/v1/projects', 'POST', { workspaceId: workspace.id, name: 'Durable Project', primaryUrl: `${server.origin}/fixtures/source`, audience: 'operators' })).project;
  audit = (await send(server.origin, '/v1/audit/site', 'POST', { workspaceId: workspace.id, projectId: project.id, url: `${server.origin}/fixtures/source` })).auditRun;
  await send(server.origin, '/v1/content/plan', 'POST', { workspaceId: workspace.id, projectId: project.id, brand: 'Skye GEO Engine', niche: 'AI search growth', audience: 'operators' });
  historyBefore = await send(server.origin, `/v1/history?workspaceId=${workspace.id}`);
  assert.equal(historyBefore.history.workspace.id, workspace.id);
  assert.equal(historyBefore.history.projects.length >= 1, true);
  assert.equal(historyBefore.history.jobs.length >= 2, true);
  assert.equal(historyBefore.history.auditRuns.length >= 1, true);
  await server.close();
  snapshotSize = (await fs.stat(snapshotFile)).size;

  server = await startPersistentTestServer({ port: 8789, snapshotFile });
  const historyAfter = await send(server.origin, `/v1/history?workspaceId=${workspace.id}`);
  assert.equal(historyAfter.history.workspace.id, workspace.id);
  assert.equal(historyAfter.history.projects.length, historyBefore.history.projects.length);
  assert.equal(historyAfter.history.jobs.length, historyBefore.history.jobs.length);
  assert.equal(historyAfter.history.auditRuns.length, historyBefore.history.auditRuns.length);
  assert.equal(historyAfter.history.contentPlans.length, historyBefore.history.contentPlans.length);
  assert.equal(historyAfter.history.jobs.some((item) => item.summary.includes('Audit stored')), true);
  console.log(JSON.stringify({
    ok: true,
    smoke: 'durable-ledger',
    snapshotFile,
    snapshotSize,
    workspaceId: workspace.id,
    projectId: project.id,
    auditRunId: audit.id,
    historyCounts: {
      projects: historyAfter.history.projects.length,
      jobs: historyAfter.history.jobs.length,
      auditRuns: historyAfter.history.auditRuns.length,
      contentPlans: historyAfter.history.contentPlans.length
    }
  }, null, 2));
} finally {
  try { await server?.close(); } catch {}
  try { await fs.unlink(snapshotFile); } catch {}
}
