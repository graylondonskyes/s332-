#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getStackConfig } from './config.mjs';
import { ensureRuntimeState } from '../lib/runtime.mjs';
import { ensureGovernanceStores, verifyAuditChain } from '../lib/governance-manager.mjs';

function parseArgs(argv) {
  const options = { json: false, output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--json') {
      options.json = true;
      continue;
    }
    if ((value === '--output' || value === '--report') && argv[index + 1]) {
      options.output = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (value.startsWith('--output=')) {
      options.output = String(value.split('=').slice(1).join('=')).trim();
    }
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = getStackConfig(process.env);
  ensureRuntimeState(config, process.env);
  ensureGovernanceStores(config);
  const verification = verifyAuditChain(config);
  const payload = {
    ok: verification.ok,
    generatedAt: new Date().toISOString(),
    label: 'tamper-evident-audit-chain',
    verification
  };
  if (options.output) {
    const outputPath = path.resolve(config.rootDir, options.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }
  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`audit chain: ${payload.ok ? 'OK' : 'FAIL'}`);
    console.log(`verified entries: ${verification.verifiedEntries}`);
  }
  if (!payload.ok) {
    process.exitCode = 1;
  }
}

main();
