#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const fnRoot = path.join(root, 'platform', 'user-platforms', 'skye-account-executive-commandhub-s0l26-0s', 'source', 'AE-Central-Command-Pack-CredentialHub-Launcher', 'netlify', 'functions');
const artifact = path.join(root, 'SMOKE_P026_ROOT_HANDLERS_RUNTIME.md');
const clients = require(path.join(fnRoot, 'ae-clients.js'));
const tasks = require(path.join(fnRoot, 'ae-tasks.js'));
const threads = require(path.join(fnRoot, 'ae-threads.js'));
const messages = require(path.join(fnRoot, 'ae-messages.js'));
const accessUsers = require(path.join(fnRoot, 'ae-access-users.js'));
const parse = (res) => JSON.parse(res.body || '{}');

const c = parse(await clients.handler({ httpMethod: 'POST', body: JSON.stringify({ name: 'P026 Client', email: 'p026@example.com' }) }));
const t = parse(await tasks.handler({ httpMethod: 'POST', body: JSON.stringify({ clientId: c.client.id, title: 'P026 Task' }) }));
const th = parse(await threads.handler({ httpMethod: 'POST', body: JSON.stringify({ clientId: c.client.id, subject: 'P026 Thread' }) }));
const m = parse(await messages.handler({ httpMethod: 'POST', body: JSON.stringify({ threadId: th.thread.id, content: 'P026 message' }) }));
const u = parse(await accessUsers.handler({ httpMethod: 'GET' }));
const pass = Boolean(c.ok && t.ok && th.ok && m.ok && u.ok && Array.isArray(u.users));
fs.writeFileSync(artifact, `# P026 Smoke Proof — Root Handler Runtime\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2));
if (!pass) process.exit(1);
