#!/usr/bin/env node
import { once } from 'node:events';
import { server } from '../server.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function jsonFetch(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

server.listen(0, '127.0.0.1');
await once(server, 'listening');

const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
const checks = [];

try {
  const projectList = await jsonFetch(`${baseUrl}/api/fs/projects`);
  const projects = Array.isArray(projectList.body) ? projectList.body : [];
  const ideEntry = projects.find((entry) => entry?.name === 'skAIxuide');
  checks.push({
    name: 'workspace-projects-contract',
    ok: projectList.response.status === 200 && projects.length > 0 && projects.every((entry) =>
      entry &&
      typeof entry.name === 'string' &&
      typeof entry.has_index === 'boolean' &&
      Object.prototype.hasOwnProperty.call(entry, 'path') &&
      Object.prototype.hasOwnProperty.call(entry, 'entry_count')
    ),
    status: projectList.response.status,
    project_count: projects.length,
  });
  checks.push({
    name: 'workspace-projects-contains-ide',
    ok: Boolean(ideEntry && ideEntry.has_index === true && ideEntry.path === '/skAIxuide/index.html'),
    entry: ideEntry || null,
  });

  const traversal = await jsonFetch(`${baseUrl}/%2e%2e/package.json`);
  checks.push({
    name: 'static-path-traversal-blocked',
    ok: traversal.response.status === 403 && traversal.body?.error === 'Forbidden path',
    status: traversal.response.status,
    body: traversal.body,
  });

  const rootPage = await fetch(`${baseUrl}/index.html`);
  const rootHtml = await rootPage.text();
  checks.push({
    name: 'root-launcher-serves',
    ok: rootPage.status === 200 && rootHtml.includes('dataset.smokeSurface'),
    status: rootPage.status,
  });
} finally {
  server.close();
}

const failures = checks.filter((check) => !check.ok);
console.log(JSON.stringify({
  ok: failures.length === 0,
  base_url: baseUrl,
  checks,
}, null, 2));

if (failures.length) process.exit(1);
