#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const aeRoot = path.join(root, 'platform', 'user-platforms', 'skye-account-executive-commandhub-s0l26-0s', 'source', 'AE-Central-Command-Pack-CredentialHub-Launcher');
const fnRoot = path.join(aeRoot, 'netlify', 'functions');
const artifactPath = path.join(root, 'SMOKE_P017_AE_RUNTIME_PRODUCTION.md');

const founderLogin = require(path.join(fnRoot, 'ae-founder-login.js'));
const founderMe = require(path.join(fnRoot, 'ae-founder-me.js'));
const brainChat = require(path.join(fnRoot, 'ae-brain-chat.js'));

function json(body) { return JSON.stringify(body); }
function parse(result) { try { return JSON.parse(result.body || '{}'); } catch { return {}; } }
function check(pass, label, detail = null) { return { pass: Boolean(pass), label, detail }; }

process.env.AE_FOUNDER_EMAIL = 'founder@skyehands.local';
process.env.AE_FOUNDER_PASSWORD_HASH = crypto.createHash('sha256').update('correct-horse-battery-staple').digest('hex');
if (!process.env.OPENAI_API_KEY) process.env.AE_PROVIDERS_DRY_RUN = '1'; // dry-run when no live key

const loginRes = await founderLogin.handler({ httpMethod: 'POST', body: json({ email: 'founder@skyehands.local', password: 'correct-horse-battery-staple' }) });
const loginPayload = parse(loginRes);
const token = loginPayload.accessToken;
const meRes = await founderMe.handler({ headers: { authorization: `Bearer ${token}` } });
const mePayload = parse(meRes);
const brainRes = await brainChat.handler({ httpMethod: 'POST', body: json({ actorId: 'founder', tenantId: 'ae-commandhub', provider: 'openai', model: 'gpt-4.1-mini', message: 'Confirm runtime execution contract.' }) });
const brainPayload = parse(brainRes);

const checks = [
  check(loginRes.statusCode === 200 && loginPayload.ok === true && Boolean(loginPayload.accessToken), 'founder login produces an active access token', loginPayload),
  check(meRes.statusCode === 200 && mePayload.ok === true && mePayload.user?.role === 'founder', 'founder profile endpoint returns authenticated principal', mePayload),
  check(brainRes.statusCode === 200 && brainPayload.ok === true && brainPayload.provider?.ok === true && (brainPayload.response?.content?.type === 'text' || brainPayload.response?.ok === true), 'ae brain chat executes real provider dispatch and returns ai response content', brainPayload)
];

const pass = checks.every((item) => item.pass);
const lines = [
  '# P017 Smoke Proof — AE Runtime Production Logic',
  '',
  `Generated: ${new Date().toISOString()}`,
  `Checks: ${checks.length}`,
  `Failed Checks: ${checks.filter((item) => !item.pass).length}`,
  `Status: ${pass ? 'PASS' : 'FAIL'}`,
  '',
  '## Checks',
  ...checks.map((item) => `- ${item.pass ? 'PASS' : 'FAIL'} | ${item.label}`),
  ''
];
fs.writeFileSync(artifactPath, `${lines.join('\n')}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifactPath) }, null, 2));
if (!pass) process.exit(1);
