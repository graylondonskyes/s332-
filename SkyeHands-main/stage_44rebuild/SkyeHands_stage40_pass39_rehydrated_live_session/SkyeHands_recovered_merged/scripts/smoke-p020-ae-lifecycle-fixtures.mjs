#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const fnRoot = path.join(root, 'platform', 'user-platforms', 'skye-account-executive-commandhub-s0l26-0s', 'source', 'AE-Central-Command-Pack-CredentialHub-Launcher', 'netlify', 'functions');
const artifact = path.join(root, 'SMOKE_P020_AE_LIFECYCLE_FIXTURES.md');
const clients = require(path.join(fnRoot, 'ae-clients.js'));
const tasks = require(path.join(fnRoot, 'ae-tasks.js'));

function parse(res) { try { return JSON.parse(res.body || '{}'); } catch { return {}; } }
const client = parse(await clients.handler({ httpMethod: 'POST', body: JSON.stringify({ name: 'Fixture Client', email: 'fixture@example.com' }) }));
const task = parse(await tasks.handler({ httpMethod: 'POST', body: JSON.stringify({ clientId: client.client.id, title: 'Lifecycle Fixture Task' }) }));
const actions = ['promise', 'churn', 'reactivation', 'sweep'];
const results = [];
for (const action of actions) {
  results.push(parse(await tasks.handler({ httpMethod: 'PATCH', body: JSON.stringify({ taskId: task.task.id, action, note: `apply ${action}` }) })));
}
const pass = results.map((r) => r.task?.state).join(',') === 'promised,churned,reactivated,swept';
fs.writeFileSync(artifact, `# P020 Smoke Proof — AE Lifecycle Fixtures\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\n\n## States\n- ${results.map((r) => r.task?.state).join('\n- ')}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2));
if (!pass) process.exit(1);
