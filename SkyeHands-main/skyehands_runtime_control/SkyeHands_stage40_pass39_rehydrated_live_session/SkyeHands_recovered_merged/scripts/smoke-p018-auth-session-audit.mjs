#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const fnRoot = path.join(root, 'platform', 'user-platforms', 'skye-account-executive-commandhub-s0l26-0s', 'source', 'AE-Central-Command-Pack-CredentialHub-Launcher', 'netlify', 'functions');
const artifactPath = path.join(root, 'SMOKE_P018_AUTH_SESSION_AUDIT.md');

const founderLogin = require(path.join(fnRoot, 'ae-founder-login.js'));
const founderMe = require(path.join(fnRoot, 'ae-founder-me.js'));
const founderLogout = require(path.join(fnRoot, 'ae-founder-logout.js'));
const auditEvents = require(path.join(fnRoot, 'ae-audit-events.js'));

function parse(result) { try { return JSON.parse(result.body || '{}'); } catch { return {}; } }
function check(pass, label, detail = null) { return { pass: Boolean(pass), label, detail }; }

process.env.AE_FOUNDER_EMAIL = 'founder@skyehands.local';
process.env.AE_FOUNDER_PASSWORD_HASH = crypto.createHash('sha256').update('correct-horse-battery-staple').digest('hex');

const loginRes = await founderLogin.handler({ httpMethod: 'POST', body: JSON.stringify({ email: 'founder@skyehands.local', password: 'correct-horse-battery-staple' }) });
const token = parse(loginRes).accessToken;
const meOkRes = await founderMe.handler({ headers: { authorization: `Bearer ${token}` } });
const logoutRes = await founderLogout.handler({ headers: { authorization: `Bearer ${token}` } });
const meDeniedRes = await founderMe.handler({ headers: { authorization: `Bearer ${token}` } });
const auditsRes = await auditEvents.handler({});
const audits = parse(auditsRes);

const checks = [
  check(loginRes.statusCode === 200 && Boolean(token), 'session login succeeds and returns a token'),
  check(meOkRes.statusCode === 200, 'session token grants access before logout'),
  check(logoutRes.statusCode === 200 && parse(logoutRes).revoked === true, 'logout revokes active session token'),
  check(meDeniedRes.statusCode === 401, 'revoked session token is denied after logout'),
  check(Array.isArray(audits) && audits.some((item) => item.action === 'ae_founder_logout'), 'audit trail includes logout event records', { count: Array.isArray(audits) ? audits.length : 0 })
];

const pass = checks.every((item) => item.pass);
const lines = [
  '# P018 Smoke Proof — Persistent Auth/Session with Audited Access',
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
