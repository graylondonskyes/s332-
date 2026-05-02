#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const providers = require(path.join(root, 'platform', 'user-platforms', 'skye-account-executive-commandhub-s0l26-0s', 'source', 'AE-Central-Command-Pack-CredentialHub-Launcher', 'netlify', 'functions', '_shared', 'ae_providers.js'));
const artifactPath = path.join(root, 'SMOKE_P019_PROVIDER_CONTRACTS.md');

function check(pass, label, detail = null) { return { pass: Boolean(pass), label, detail }; }

if (!process.env.OPENAI_API_KEY) process.env.AE_PROVIDERS_DRY_RUN = '1'; // dry-run when no live keys
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'openai-smoke-token';
process.env.PRINTFUL_API_TOKEN = process.env.PRINTFUL_API_TOKEN || 'printful-smoke-token';
process.env.CALENDLY_TOKEN = process.env.CALENDLY_TOKEN || 'calendly-smoke-token';

const openaiOk = providers.validateProviderAction('openai', { model: 'gpt-4.1-mini', input: 'hello world' });
const printfulFail = providers.validateProviderAction('printful', { sku: 'SKU-1' });
const calendlyExec = await providers.executeProviderAction('calendly', { eventTypeUri: 'evt_123', inviteeEmail: 'user@example.com' });

const checks = [
  check(openaiOk.ok === true && openaiOk.endpoint === '/v1/responses', 'openai contract validates required env and action shape', openaiOk),
  check(printfulFail.ok === false && printfulFail.errors.some((item) => item.includes('quantity')), 'printful contract rejects incomplete action payloads with deterministic errors', printfulFail),
  check(calendlyExec.ok === true && calendlyExec.provider === 'calendly' && Boolean(calendlyExec.executionId), 'provider execution contract returns auditable execution envelope', calendlyExec)
];

const pass = checks.every((item) => item.pass);
const lines = [
  '# P019 Smoke Proof — Provider Execution Contracts',
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
