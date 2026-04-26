#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig } from './config.mjs';
import { ensureRuntimeState } from '../lib/runtime.mjs';
import { canonicalizeExistingProofPayload, printCanonicalRuntimeBannerForCommand } from '../lib/proof-runtime.mjs';

function parseArgs(argv) {
  const options = { all: false, write: false, output: null, files: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--all') { options.all = true; continue; }
    if (value === '--write') { options.write = true; continue; }
    if (value === '--output' && argv[index + 1]) { options.output = String(argv[index + 1]).trim() || null; index += 1; continue; }
    if (value.startsWith('--output=')) { options.output = String(value.split('=').slice(1).join('=')).trim() || null; continue; }
    options.files.push(value);
  }
  return options;
}

function collectFiles(config, options) {
  if (options.all || options.files.length === 0) {
    const proofDir = path.join(config.rootDir, 'docs', 'proof');
    return fs.readdirSync(proofDir)
      .filter(name => name.endsWith('.json'))
      .map(name => path.join(proofDir, name))
      .sort((a, b) => a.localeCompare(b));
  }
  return options.files.map(filePath => path.resolve(config.rootDir, filePath));
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = getStackConfig(process.env);
  ensureRuntimeState(config, process.env);
  printCanonicalRuntimeBannerForCommand(config, 'proof-canonicalize.mjs');

  const files = collectFiles(config, options);
  const results = files.map(filePath => {
    const exists = fs.existsSync(filePath);
    const before = exists ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : null;
    const after = exists ? canonicalizeExistingProofPayload(before, config, 'proof-canonicalize.mjs') : null;
    const changed = exists && JSON.stringify(before) !== JSON.stringify(after);
    if (exists && options.write && changed) {
      fs.writeFileSync(filePath, `${JSON.stringify(after, null, 2)}\n`, 'utf8');
    }
    return {
      file: path.relative(config.rootDir, filePath),
      exists,
      changed,
      canonicalRuntimeInjected: Boolean(after?.canonicalRuntime?.launcher?.entry)
    };
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    write: options.write,
    files: results,
    ok: results.every(item => item.exists && item.canonicalRuntimeInjected)
  };

  if (options.output) {
    const outputPath = path.resolve(config.rootDir, options.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) {
    process.exitCode = 1;
  }
}

main();
