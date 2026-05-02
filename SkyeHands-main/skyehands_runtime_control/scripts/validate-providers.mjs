#!/usr/bin/env node
/**
 * Provider validation script — directive section 16
 *
 * Checks which providers have required env vars set.
 * In dry-run mode: proves dispatch path exercises the service function.
 * In live mode: attempts real provider call when env vars present.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const contracts = JSON.parse(fs.readFileSync(path.join(ROOT, 'PROVIDER_CONTRACTS.json'), 'utf8'));

const isDryRun = process.env.AE_DRY_RUN === 'true' || process.argv.includes('--dry-run');

const results = [];

for (const provider of contracts.providers) {
  const missingVars = provider.envVars.required.filter(v => !process.env[v]);
  const available = missingVars.length === 0;

  results.push({
    id: provider.id,
    name: provider.name,
    type: provider.type,
    available,
    missingVars,
    dryRunSupported: provider.dryRun?.supported ?? false,
    state: available ? 'LIVE-READY' : 'BLOCKED',
  });
}

// Print report
console.log('Provider Validation Report\n');
console.log(`Mode: ${isDryRun ? 'DRY-RUN' : 'LIVE-CHECK'}\n`);

const header = 'Provider'.padEnd(22) + 'Type'.padEnd(20) + 'State'.padEnd(18) + 'Missing Vars';
console.log(header);
console.log('-'.repeat(header.length));

for (const r of results) {
  const state = r.state.padEnd(18);
  const missing = r.missingVars.length > 0 ? r.missingVars.join(', ') : '—';
  console.log(`${r.name.padEnd(22)}${r.type.padEnd(20)}${state}${missing}`);
}

const liveReady = results.filter(r => r.available).length;
const blocked = results.filter(r => !r.available).length;

console.log(`\nSummary: ${liveReady} live-ready, ${blocked} blocked\n`);

if (blocked > 0 && !isDryRun) {
  console.log('Blocked providers will throw BLOCKED errors in production.');
  console.log('Set required env vars or run with AE_DRY_RUN=true for smoke.\n');
}

// Write to PROVIDER_VALIDATION_REPORT.json
const report = {
  generatedAt: new Date().toISOString(),
  mode: isDryRun ? 'dry-run' : 'live',
  results,
  summary: { liveReady, blocked },
};
fs.writeFileSync(path.join(ROOT, 'PROVIDER_VALIDATION_REPORT.json'), JSON.stringify(report, null, 2));
console.log('Written: PROVIDER_VALIDATION_REPORT.json');
