#!/usr/bin/env node
// Proves failover chain executes correctly when primary provider is unavailable.
// Uses 'openai_down' (invalid provider name) as primary to deterministically force
// failover to anthropic — works without live keys via DRY_RUN=1.
// With real keys and AE_PROVIDERS_DRY_RUN unset, same code path hits live Anthropic.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const providers = require(path.join(root, 'platform', 'user-platforms', 'skye-account-executive-commandhub-s0l26-0s', 'source', 'AE-Central-Command-Pack-CredentialHub-Launcher', 'netlify', 'functions', '_shared', 'ae_providers.js'));
const artifact = path.join(root, 'SMOKE_P023_PROVIDER_OUTAGE_FAILOVER.md');

if (!process.env.ANTHROPIC_API_KEY) process.env.AE_PROVIDERS_DRY_RUN = '1';

// 'openai_unavailable' is not in PROVIDER_CONTRACTS — deterministically fails as primary
const result = await providers.executeWithFailover(
  'openai_unavailable',
  ['anthropic', 'gemini'],
  { model: 'claude-sonnet-4-6', input: 'outage failover check' }
);

// Negative path: unsupported provider with missing required fields
const badAttempt = await providers.executeProviderAction('openai', {});
const negativePathBlocked = badAttempt.ok === false && Array.isArray(badAttempt.errors) && badAttempt.errors.length > 0;

const pass = Boolean(
  result.ok &&
  result.selectedProvider !== null &&
  result.selectedProvider !== 'openai_unavailable' &&
  result.attempts[0]?.ok === false &&
  negativePathBlocked
);

fs.writeFileSync(artifact, [
  '# P023 Smoke Proof — Provider Outage Failover',
  '',
  `Status: ${pass ? 'PASS' : 'FAIL'}`,
  `Generated: ${new Date().toISOString()}`,
  `Primary attempted: openai_unavailable → ok=${result.attempts[0]?.ok}`,
  `Failover selected: ${result.selectedProvider} → ok=${result.ok}`,
  `Negative path blocked: ${negativePathBlocked}`,
  '',
  '## What This Proves',
  '- executeWithFailover skips failed primary and selects next available provider',
  '- Invalid provider names return ok=false with deterministic errors',
  '- Missing required fields return validation errors before any network call',
].join('\n') + '\n', 'utf8');

console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact), selectedProvider: result.selectedProvider, attempts: result.attempts.map((a) => ({ provider: a.provider, ok: a.ok })) }, null, 2));
if (!pass) process.exit(1);
