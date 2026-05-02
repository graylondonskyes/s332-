#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node ./scripts/run-wrangler.mjs <wrangler args...>');
  process.exit(1);
}

const sourcePath = path.resolve('wrangler.jsonc');
const outputDir = path.resolve('.wrangler');
const outputPath = path.join(outputDir, 'resolved.jsonc');
const databaseName = 'kaixu_gateway13_sky_currency';
const configuredDatabaseId = process.env.SKY_CURRENCY_D1_DATABASE_ID?.trim();
const isLocalOnly = args.includes('--local') || args[0] === 'dev' || args[0] === 'types';
const databaseId = configuredDatabaseId || (isLocalOnly ? '00000000-0000-0000-0000-000000000000' : '');

if (!databaseId) {
  console.error('Missing SKY_CURRENCY_D1_DATABASE_ID for remote D1 or deploy operations.');
  process.exit(1);
}

const source = fs.readFileSync(sourcePath, 'utf8');
const config = JSON.parse(source);
config.d1_databases = [
  {
    binding: 'DB',
    database_name: databaseName,
    database_id: databaseId,
    migrations_dir: 'src/db/migrations',
  },
];

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`);

const wranglerEntrypoint = require.resolve('wrangler/bin/wrangler.js');
const result = spawnSync(process.execPath, [wranglerEntrypoint, '--config', outputPath, ...args], {
  stdio: 'inherit',
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
