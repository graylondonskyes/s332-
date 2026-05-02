import assert from 'node:assert/strict';
import { appFetch } from '../src/index.ts';

const sqlLog = [];
const store = {
  workspaces: [],
  projects: []
};

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function asJsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
}

function normalizeSql(sql) {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url !== 'https://neon.local/sql') {
    throw new Error(`Unexpected fetch ${url}`);
  }
  assert.equal(init?.method, 'POST');
  const headers = new Headers(init?.headers || {});
  assert.equal(headers.get('authorization'), 'Bearer neon_test_token');
  const body = JSON.parse(String(init?.body || '{}'));
  const sql = normalizeSql(body.sql || '');
  const params = body.params || [];
  sqlLog.push({ sql, params: clone(params) });

  if (sql.startsWith('insert into workspaces')) {
    const [id, orgId, name, brand, niche] = params;
    const timestamp = nowIso();
    const row = { id, org_id: orgId, name, brand, niche, created_at: timestamp, updated_at: timestamp };
    store.workspaces.push(row);
    return asJsonResponse({ rows: [row] });
  }
  if (sql.startsWith('select * from workspaces where org_id=$1 order by created_at desc')) {
    const [orgId] = params;
    const rows = store.workspaces.filter((item) => item.org_id === orgId).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return asJsonResponse({ rows });
  }
  if (sql.startsWith('insert into projects')) {
    const [id, orgId, workspaceId, name, primaryUrl, audience] = params;
    const timestamp = nowIso();
    const row = { id, org_id: orgId, workspace_id: workspaceId, name, primary_url: primaryUrl, audience, created_at: timestamp, updated_at: timestamp };
    store.projects.push(row);
    return asJsonResponse({ rows: [row] });
  }
  if (sql.startsWith('select * from projects where org_id=$1 and workspace_id=$2 order by created_at desc')) {
    const [orgId, workspaceId] = params;
    const rows = store.projects.filter((item) => item.org_id === orgId && item.workspace_id === workspaceId).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return asJsonResponse({ rows });
  }
  if (sql.startsWith('select * from workspaces where org_id=$1 and id=$2 limit 1')) {
    const [orgId, workspaceId] = params;
    const row = store.workspaces.find((item) => item.org_id === orgId && item.id === workspaceId);
    return asJsonResponse({ rows: row ? [row] : [] });
  }

  const emptyPrefixes = [
    'select * from jobs where org_id=$1 and workspace_id=$2 order by created_at desc',
    'select * from audit_runs where org_id=$1 and workspace_id=$2 order by created_at desc',
    'select * from content_plans where org_id=$1 and workspace_id=$2 order by created_at desc',
    'select * from saved_prompt_sets where org_id=$1 and workspace_id=$2 order by created_at desc',
    'select * from sources where org_id=$1 and workspace_id=$2 order by created_at desc',
    'select * from article_briefs where org_id=$1 and workspace_id=$2 order by created_at desc',
    'select * from articles where org_id=$1 and workspace_id=$2 order by created_at desc',
    'select * from publish_runs where org_id=$1 and workspace_id=$2 order by created_at desc',
    'select * from visibility_runs where org_id=$1 and workspace_id=$2 order by created_at desc',
    'select * from evidence_exports where org_id=$1 and workspace_id=$2 order by created_at desc'
  ];
  if (emptyPrefixes.some((prefix) => sql.startsWith(prefix))) {
    return asJsonResponse({ rows: [] });
  }

  throw new Error(`Unhandled neon SQL in smoke transport: ${sql}`);
};

async function request(path, { method = 'GET', orgId = 'org_neon', workspaceId, projectId, body } = {}) {
  const headers = new Headers({ 'x-org-id': orgId });
  if (workspaceId) headers.set('x-workspace-id', workspaceId);
  if (projectId) headers.set('x-project-id', projectId);
  if (body) headers.set('content-type', 'application/json');
  const response = await appFetch(new Request(`https://smoke.local${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), {
    DB_MODE: 'neon-http',
    NEON_SQL_URL: 'https://neon.local/sql',
    NEON_SQL_AUTH_TOKEN: 'neon_test_token'
  });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}

try {
  const workspaceRes = await request('/v1/workspaces', { method: 'POST', body: { name: 'Neon Transport Workspace', brand: 'Skye GEO Engine', niche: 'transport proof' } });
  assert.equal(workspaceRes.status, 201);
  const workspaceId = workspaceRes.data.workspace.id;

  const workspaceList = await request('/v1/workspaces');
  assert.equal(workspaceList.status, 200);
  assert.equal(workspaceList.data.items.length, 1);

  const projectRes = await request('/v1/projects', { method: 'POST', workspaceId, body: { workspaceId, name: 'Neon Transport Project', primaryUrl: 'http://127.0.0.1:8787/fixtures/source', audience: 'operators' } });
  assert.equal(projectRes.status, 201);
  const projectId = projectRes.data.project.id;

  const projectList = await request('/v1/projects', { workspaceId });
  assert.equal(projectList.status, 200);
  assert.equal(projectList.data.items.length, 1);

  const history = await request('/v1/history', { workspaceId, projectId });
  assert.equal(history.status, 200);
  assert.equal(history.data.history.workspace.id, workspaceId);
  assert.equal(history.data.history.projects.length, 1);
  assert.equal(history.data.history.jobs.length, 0);

  assert.equal(sqlLog.some((entry) => entry.sql.startsWith('insert into workspaces')), true);
  assert.equal(sqlLog.some((entry) => entry.sql.startsWith('insert into projects')), true);
  assert.equal(sqlLog.some((entry) => entry.sql.startsWith('select * from workspaces where org_id=$1 and id=$2 limit 1')), true);

  console.log(JSON.stringify({ ok: true, checks: ['neon-http adapter selected through env', 'sql bridge authorization header enforced', 'parameterized workspace insert via neon transport', 'parameterized project insert via neon transport', 'workspace history readback through neon transport'], queryCount: sqlLog.length }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
}
