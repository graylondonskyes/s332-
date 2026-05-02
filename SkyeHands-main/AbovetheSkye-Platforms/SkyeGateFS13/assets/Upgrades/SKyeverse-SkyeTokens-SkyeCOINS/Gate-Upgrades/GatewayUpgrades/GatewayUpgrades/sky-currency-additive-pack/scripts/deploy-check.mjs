#!/usr/bin/env node
import fs from 'node:fs';

const allowPlaceholders = process.argv.includes('--allow-placeholders');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const wrangler = JSON.parse(fs.readFileSync('wrangler.jsonc', 'utf8'));
const seed = fs.readFileSync('src/db/seed.sql', 'utf8');
const configuredDatabaseId = process.env.SKY_CURRENCY_D1_DATABASE_ID?.trim() || '';
const fail = [];
const databaseName = 'skyegatefs13_sky_currency';
const advertisedAliases = [
  'kaixu/flash',
  'kaixu/deep',
  'kaixu/code',
  'kaixu/vision',
  'kaixu/image',
  'kaixu/video',
  'kaixu/speech',
  'kaixu/transcribe',
  'kaixu/realtime',
  'kaixu/embed',
];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

if (pkg.packageManager !== 'npm@10.8.2') fail.push('packageManager must be npm@10.8.2');
if (pkg.devDependencies?.wrangler !== '4.73.0') fail.push('wrangler must be exact-pinned to 4.73.0');
if (pkg.devDependencies?.typescript !== '5.9.3') fail.push('typescript must be exact-pinned to 5.9.3');
if (pkg.devDependencies?.['@cloudflare/workers-types'] !== '4.20260313.1') fail.push('@cloudflare/workers-types must be exact-pinned to 4.20260313.1');
if (!lock.packages?.['node_modules/wrangler']) fail.push('package-lock is missing wrangler');
if (!Array.isArray(wrangler.d1_databases) || wrangler.d1_databases.length !== 0) fail.push('wrangler.jsonc must keep d1_databases empty at rest');
if (wrangler.name !== 'skyegatefs13-super-gate') fail.push('wrangler.jsonc has an unexpected worker name');
if (!fs.readFileSync('scripts/run-wrangler.mjs', 'utf8').includes(databaseName)) fail.push('run-wrangler.mjs must inject the expected D1 database name');
if (!allowPlaceholders && !uuidPattern.test(configuredDatabaseId)) fail.push('SKY_CURRENCY_D1_DATABASE_ID must be set to a real D1 database UUID');
if (!fs.existsSync('src/db/migrations/0001_init.sql')) fail.push('missing 0001 migration');
if (!fs.existsSync('src/db/migrations/0002_multimodal_hardening.sql')) fail.push('missing 0002 migration');
if (!fs.existsSync('src/db/seed.sql')) fail.push('missing seed.sql');
for (const alias of advertisedAliases) {
  if (!seed.includes(alias)) fail.push(`seed.sql does not cover ${alias}`);
}

if (fail.length > 0) {
  console.error(fail.map((item) => `- ${item}`).join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  check: 'gateway-deploy-static',
  placeholderD1Allowed: allowPlaceholders,
  remoteD1Configured: uuidPattern.test(configuredDatabaseId),
  advertisedAliasCount: advertisedAliases.length,
}, null, 2));
