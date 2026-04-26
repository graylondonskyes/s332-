import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';

function parseArgs(argv) {
  const options = { applyDocs: false, json: false };
  for (const value of argv) {
    if (value === '--apply-docs') options.applyDocs = true;
    if (value === '--json') options.json = true;
  }
  return options;
}

function readJson(filePath, fallback = null) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

function runNode(scriptPath, envAdditions = {}) {
  const result = spawnSync(process.execPath, [scriptPath, '--strict'], {
    cwd: path.dirname(scriptPath),
    env: { ...process.env, ...envAdditions },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  return {
    status: result.status ?? 1,
    stdoutTail: String(result.stdout || '').split(/\r?\n/).filter(Boolean).slice(-30),
    stderrTail: String(result.stderr || '').split(/\r?\n/).filter(Boolean).slice(-30)
  };
}

function refreshDocs(config) {
  return spawnSync(process.execPath, [path.join(config.shellDir, 'bin', 'current-chain-refresh.mjs'), '--apply-docs', '--json'], {
    cwd: config.shellDir,
    env: { ...process.env },
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024
  });
}

function readPass(proofFile) {
  const payload = readJson(proofFile, null);
  return {
    file: path.relative(process.cwd(), proofFile),
    pass: Boolean(payload?.pass || payload?.passed || payload?.ok),
    generatedAt: payload?.generatedAt || null,
    label: payload?.label || payload?.proof || null
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = getStackConfig(process.env);
  printCanonicalRuntimeBannerForCommand(config, 'current-chain-rerun.mjs');

  const runs = [
    {
      key: 'stage4',
      script: path.join(config.shellDir, 'bin', 'workspace-proof-stage4.mjs'),
      env: {},
      proofFile: path.join(config.rootDir, 'docs', 'proof', 'STAGE_4_REMOTE_EXECUTOR.json')
    },
    {
      key: 'stage8',
      script: path.join(config.shellDir, 'bin', 'workspace-proof-stage8.mjs'),
      env: { SKYEQUANTA_SKIP_STAGE7_PREREQ: '1' },
      proofFile: path.join(config.rootDir, 'docs', 'proof', 'STAGE_8_PREVIEW_FORWARDING.json')
    }
  ];

  const results = [];
  for (const item of runs) {
    const exec = runNode(item.script, item.env);
    results.push({ key: item.key, exec, proof: readPass(item.proofFile) });
  }

  const docsRefresh = options.applyDocs ? refreshDocs(config) : null;
  const payload = {
    ok: results.every(item => item.exec.status === 0 && item.proof.pass),
    proof: 'current-chain-rerun',
    generatedAt: new Date().toISOString(),
    results,
    docsRefresh: docsRefresh ? {
      status: docsRefresh.status ?? 1,
      stdoutTail: String(docsRefresh.stdout || '').split(/\r?\n/).filter(Boolean).slice(-20),
      stderrTail: String(docsRefresh.stderr || '').split(/\r?\n/).filter(Boolean).slice(-20)
    } : null
  };

  const outFile = path.join(config.rootDir, 'docs', 'proof', 'CURRENT_CHAIN_RERUN.json');
  const emitted = writeProofJson(outFile, payload, config, 'current-chain-rerun.mjs');
  if (options.json) {
    console.log(JSON.stringify(emitted, null, 2));
    return;
  }
  console.log(JSON.stringify(emitted, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
