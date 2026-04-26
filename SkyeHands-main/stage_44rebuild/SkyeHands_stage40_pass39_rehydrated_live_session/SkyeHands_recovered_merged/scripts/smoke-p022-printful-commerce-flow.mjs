#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const providers = require(path.join(root, 'platform', 'user-platforms', 'skye-account-executive-commandhub-s0l26-0s', 'source', 'AE-Central-Command-Pack-CredentialHub-Launcher', 'netlify', 'functions', '_shared', 'ae_providers.js'));
const artifact = path.join(root, 'SMOKE_P022_PRINTFUL_COMMERCE_FLOW.md');
process.env.PRINTFUL_API_TOKEN = process.env.PRINTFUL_API_TOKEN || 'printful-smoke-token';
if (!process.env.PRINTFUL_API_TOKEN || process.env.PRINTFUL_API_TOKEN === 'printful-smoke-token') process.env.AE_PROVIDERS_DRY_RUN = '1';

const quote = await providers.executeProviderAction('printful', { sku: 'SKU-PRINT-1', quantity: 1 });
const pass = Boolean(quote.ok && quote.endpoint === '/orders');
fs.writeFileSync(artifact, `# P022 Smoke Proof — Printful Commerce Flow\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\n- executionId: ${quote.executionId || 'none'}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2));
if (!pass) process.exit(1);
