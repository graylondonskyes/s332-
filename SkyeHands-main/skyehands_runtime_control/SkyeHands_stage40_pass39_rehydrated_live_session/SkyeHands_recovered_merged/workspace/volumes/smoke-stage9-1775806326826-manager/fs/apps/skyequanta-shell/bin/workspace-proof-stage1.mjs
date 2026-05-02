import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

import { getStackConfig } from './config.mjs';
import { attachCanonicalRuntimeProof, getCanonicalRuntimePaths, printCanonicalRuntimeBanner } from '../lib/canonical-runtime.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}
`, 'utf8');
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const response = await fetch(url);
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { ok: response.ok, status: response.status, json, text };
}

async function waitForJson(url, timeoutMs = 20000, validate = payload => payload?.ok) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const result = await fetchJson(url);
      if (result.ok && validate(result.json || result)) {
        return result;
      }
      last = result;
    } catch (error) {
      last = error;
    }
    await delay(250);
  }
  throw last instanceof Error ? last : new Error(`Timed out waiting for ${url}`);
}

async function terminateChild(child, signal = 'SIGTERM') {
  if (!child || child.exitCode !== null || child.killed) return;
  await new Promise(resolve => {
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    child.once('exit', done);
    child.once('close', done);
    try {
      child.kill(signal);
    } catch {
      done();
    }
    setTimeout(done, 1000);
  });
}

function assertCheck(condition, message, detail = null) {
  return { pass: Boolean(condition), message, detail };
}

async function main() {
  const strict = process.argv.includes('--strict');
  process.env.SKYEQUANTA_BRIDGE_PORT = process.env.SKYEQUANTA_BRIDGE_PORT || '4920';
  const config = getStackConfig(process.env);
  const paths = getCanonicalRuntimePaths(config);
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'STAGE_1_TRUTH_AND_PROOF.json');
  const bridgeLogs = [];
  let bridgeChild = null;

  printCanonicalRuntimeBanner(config, 'workspace-proof-stage1.mjs');

  const launchDryRun = spawnSync(process.execPath, [path.join(config.shellDir, 'bin', 'launch.mjs'), '--dry-run'], {
    cwd: config.rootDir,
    env: { ...process.env },
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  });

  const guardWorkspaceService = spawnSync(process.execPath, [path.join(config.shellDir, 'bin', 'workspace-service.mjs'), '--workspace-id', 'guard-test', '--workspace-name', 'guard-test', '--role', 'ide', '--port', '4110'], {
    cwd: config.rootDir,
    env: { ...process.env },
    encoding: 'utf8'
  });

  const guardRealIdeRuntime = spawnSync(process.execPath, [path.join(config.shellDir, 'bin', 'real-ide-runtime.mjs'), '--workspace-id', 'guard-test', '--workspace-name', 'guard-test', '--port', '4111'], {
    cwd: config.rootDir,
    env: { ...process.env },
    encoding: 'utf8'
  });

  const guardLegacyProof = spawnSync(process.execPath, [path.join(config.shellDir, 'bin', 'workspace-proof.mjs'), '--strict'], {
    cwd: config.rootDir,
    env: { ...process.env },
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  });

  try {
    bridgeChild = spawn(process.execPath, [path.join(config.shellDir, 'bin', 'bridge.mjs')], {
      cwd: config.rootDir,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    bridgeChild.stdout.on('data', chunk => bridgeLogs.push(chunk.toString('utf8')));
    bridgeChild.stderr.on('data', chunk => bridgeLogs.push(chunk.toString('utf8')));

    const health = await waitForJson(`http://${config.bridge.host}:${config.bridge.port}/health`, 20000, payload => payload?.ok === true || payload?.status === 'ok');
    const identity = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/product/identity`);
    const runtimeContract = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/runtime-contract`);
    const status = await fetchJson(`http://${config.bridge.host}:${config.bridge.port}/api/status`);

    const checks = [
      assertCheck(paths.launcher.command === './skyequanta start' && paths.launcher.entry === 'apps/skyequanta-shell/bin/launch.mjs', 'launcher path is explicitly canonicalized in code and docs', paths.launcher),
      assertCheck(paths.bridgeRuntime.command === './skyequanta bridge:start' && paths.bridgeRuntime.entry === 'apps/skyequanta-shell/bin/bridge.mjs', 'bridge/runtime path is explicitly canonicalized in code and docs', paths.bridgeRuntime),
      assertCheck(fs.existsSync(path.join(config.rootDir, paths.docs.entry)), 'repo-level CANONICAL_RUNTIME_PATHS.md exists', paths.docs),
      assertCheck(launchDryRun.status === 0 && /CANONICAL RUNTIME PATH/.test(`${launchDryRun.stdout}
${launchDryRun.stderr}`), 'launcher dry-run prints the canonical runtime banner', { status: launchDryRun.status, stdout: launchDryRun.stdout, stderr: launchDryRun.stderr }),
      assertCheck(health.ok, 'bridge health endpoint responds from the canonical runtime surface', health.json || health.text),
      assertCheck(identity.ok && identity.json?.identity?.publicUrls?.productIdentity?.endsWith('/api/product/identity'), 'product identity endpoint is served from the canonical bridge/runtime path', identity.json),
      assertCheck(runtimeContract.ok && String(runtimeContract.json?.routes?.runtimeContract || '').endsWith('/api/runtime-contract'), 'runtime contract endpoint is served from the canonical bridge/runtime path', runtimeContract.json),
      assertCheck(status.ok && status.json?.urls?.productIdentity?.endsWith('/api/product/identity'), 'status endpoint advertises the canonical product identity route', status.json?.urls),
      assertCheck(guardWorkspaceService.status !== 0 && /canonical_runtime_guard/.test(`${guardWorkspaceService.stderr}
${guardWorkspaceService.stdout}`), 'legacy stub workspace service hard-fails when started directly', { status: guardWorkspaceService.status, stdout: guardWorkspaceService.stdout, stderr: guardWorkspaceService.stderr }),
      assertCheck(guardRealIdeRuntime.status !== 0 && /canonical_runtime_guard/.test(`${guardRealIdeRuntime.stderr}
${guardRealIdeRuntime.stdout}`), 'legacy real-ide runtime hard-fails when started directly', { status: guardRealIdeRuntime.status, stdout: guardRealIdeRuntime.stdout, stderr: guardRealIdeRuntime.stderr }),
      assertCheck(guardLegacyProof.status !== 0 && /canonical_runtime_guard/.test(`${guardLegacyProof.stderr}
${guardLegacyProof.stdout}`), 'legacy stub proof entrypoint hard-fails when started directly', { status: guardLegacyProof.status, stdout: guardLegacyProof.stdout, stderr: guardLegacyProof.stderr })
    ];

    let payload = {
      stage: 1,
      label: 'stage-1-truth-and-proof',
      strict,
      generatedAt: new Date().toISOString(),
      proofCommand: 'npm run workspace:proof:stage1 -- --strict',
      smokeCommands: [
        'node apps/skyequanta-shell/bin/launch.mjs --dry-run',
        'node apps/skyequanta-shell/bin/bridge.mjs',
        'node apps/skyequanta-shell/bin/workspace-service.mjs --workspace-id guard-test --workspace-name guard-test --role ide --port 4110',
        'node apps/skyequanta-shell/bin/real-ide-runtime.mjs --workspace-id guard-test --workspace-name guard-test --port 4111',
        'node apps/skyequanta-shell/bin/workspace-proof.mjs --strict'
      ],
      artifacts: {
        health: health.json,
        identity: identity.json,
        runtimeContract: runtimeContract.json,
        status: status.json
      },
      bridgeLogs,
      checks,
      pass: checks.every(item => item.pass)
    };
    payload = attachCanonicalRuntimeProof(payload, config, 'workspace-proof-stage1.mjs');
    writeJson(proofFile, payload);
    if (strict && !payload.pass) {
      console.error(JSON.stringify(payload, null, 2));
      process.exitCode = 1;
      return;
    }
    console.log(JSON.stringify(payload, null, 2));
  } finally {
    await terminateChild(bridgeChild, 'SIGTERM');
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
