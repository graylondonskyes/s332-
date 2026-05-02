#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { assertCheck } from './provider-proof-helpers.mjs';
import { createAgentCoreRuntime } from '../../../platform/agent-core/runtime/lib/server.mjs';

async function main() {
  const baseConfig = getStackConfig(process.env);
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section63-agent-core-bundle.mjs');

  const runtimeDir = path.join(config.rootDir, 'platform', 'agent-core', 'runtime');
  const runtime = createAgentCoreRuntime({ host: '127.0.0.1', port: 8955 });
  await runtime.listen();
  const health = await fetch('http://127.0.0.1:8955/health').then(r => ({ ok: r.ok, status: r.status, json: null })).then(async base => {
    const res = await fetch('http://127.0.0.1:8955/health');
    return { ok: res.ok, status: res.status, json: await res.json() };
  });
  const manifest = await fetch('http://127.0.0.1:8955/manifest').then(async r => ({ ok: r.ok, status: r.status, json: await r.json() }));
  await runtime.close();

  const payload = {
    generatedAt: new Date().toISOString(),
    pass: true,
    checks: [
      assertCheck(fs.existsSync(path.join(runtimeDir, 'package.json')), 'Ship a concrete agent-core runtime bundle at platform/agent-core/runtime instead of leaving the agent side as a weaker manifest-only story', { runtimeDir: path.relative(config.rootDir, runtimeDir) }),
      assertCheck(fs.existsSync(path.join(runtimeDir, 'bin', 'agent-core-launch.mjs')) && fs.existsSync(path.join(runtimeDir, 'bin', 'agent-core-smoke.mjs')), 'Provide a visible launch entrypoint and a bundled smoke entrypoint for the shipped agent runtime surface', {}),
      assertCheck(health.ok && health.json?.ok && manifest.ok && manifest.json?.capabilities?.includes('bundle-proof'), 'Prove the bundled agent runtime actually starts and answers health and manifest requests end to end', { health, manifest })
    ],
    evidence: {
      runtimeDir: path.relative(config.rootDir, runtimeDir),
      health,
      manifest
    },
    smokeCommand: 'bash scripts/smoke-section63-agent-core-bundle.sh'
  };
  payload.pass = payload.checks.every(item => item.pass);
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_63_AGENT_CORE_BUNDLE.json');
  const written = writeProofJson(proofFile, payload, config, 'workspace-proof-section63-agent-core-bundle.mjs');
  console.log(JSON.stringify(written, null, 2));
  if (!written.pass) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
