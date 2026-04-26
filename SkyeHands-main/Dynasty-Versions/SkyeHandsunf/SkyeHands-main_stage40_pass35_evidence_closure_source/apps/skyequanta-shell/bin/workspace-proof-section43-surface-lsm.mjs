import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { createBridgeServer } from '../lib/bridge.mjs';
import { writeAppArmorProfileBundle } from '../lib/apparmor-policy.mjs';
import { fetchAndVerifySurfaceIdentity } from '../lib/surface-identity.mjs';
import { buildRuntimeSandboxLaunch } from '../lib/runtime-sandbox.mjs';
import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { assertCheck } from './provider-proof-helpers.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function parseLastJson(stdout) {
  const lines = String(stdout || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]);
    } catch {}
  }
  return null;
}

function runReleaseSanitize(config) {
  const result = spawnSync('node', [path.join(config.shellDir, 'bin', 'release-sanitize.mjs'), '--json'], {
    cwd: config.rootDir,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  const stdout = String(result.stdout || '');
  let payload = null;
  try {
    payload = JSON.parse(stdout);
  } catch {
    payload = parseLastJson(stdout);
  }
  return {
    ok: result.status === 0,
    status: result.status,
    stdout,
    stderr: String(result.stderr || ''),
    payload
  };
}

async function withBridgeServer(config, envOverrides, callback) {
  const snapshot = {};
  for (const [key, value] of Object.entries(envOverrides || {})) {
    snapshot[key] = Object.prototype.hasOwnProperty.call(process.env, key) ? process.env[key] : undefined;
    process.env[key] = String(value);
  }
  const server = createBridgeServer(config);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.bridge.port, config.bridge.host, resolve);
  });
  try {
    return await callback();
  } finally {
    await new Promise(resolve => server.close(resolve));
    for (const [key, value] of Object.entries(snapshot)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function runSurfaceIdentityProof(config) {
  const release = runReleaseSanitize(config);
  if (!release.ok || !release.payload?.archiveFile) {
    return {
      ok: false,
      reason: 'release_sanitize_failed',
      release
    };
  }
  const artifactPath = path.join(config.rootDir, release.payload.archiveFile);
  const port = 34000 + (process.pid % 2000);
  const env = {
    ...process.env,
    SKYEQUANTA_BRIDGE_PORT: String(port),
    SKYEQUANTA_SURFACE_ARTIFACT: artifactPath
  };
  const liveBaseConfig = getStackConfig(env);
  ensureRuntimeState(liveBaseConfig, env);
  const liveEnv = withLocalBinPath({ ...loadShellEnv(liveBaseConfig), ...env });
  const liveConfig = getStackConfig(liveEnv);
  const surfaceUrl = `http://${liveConfig.bridge.host}:${liveConfig.bridge.port}/api/surface-identity`;
  const fetchResult = await withBridgeServer(liveConfig, {
    SKYEQUANTA_BRIDGE_PORT: String(port),
    SKYEQUANTA_SURFACE_ARTIFACT: artifactPath
  }, async () => fetchAndVerifySurfaceIdentity(surfaceUrl, {
    expectedArtifactFile: artifactPath
  }));
  return {
    ok: release.ok
      && fetchResult.ok
      && fetchResult.document?.surface?.surfaceUrl === surfaceUrl
      && fetchResult.document?.artifact?.sha256 === fetchResult.verification?.artifact?.sha256
      && fetchResult.document?.artifact?.sizeBytes === fetchResult.verification?.artifact?.sizeBytes,
    artifactPath,
    surfaceUrl,
    release,
    fetchResult
  };
}

async function runAppArmorPolicyProof(config) {
  const workspaceDir = path.join(config.rootDir, 'dist', 'section43', 'apparmor-workspace');
  ensureDirectory(workspaceDir);
  fs.writeFileSync(path.join(workspaceDir, 'README.txt'), 'section43-apparmor\n', 'utf8');
  const bundle = writeAppArmorProfileBundle(config.rootDir, {
    workspaceId: 'section43',
    label: 'apparmor-proof',
    workspaceDir
  });

  let strictOutcome = null;
  try {
    const launch = buildRuntimeSandboxLaunch('node', ['-e', 'console.log("section43")'], {
      env: {
        ...process.env,
        SKYEQUANTA_RUNTIME_SANDBOX_MODE: 'process',
        SKYEQUANTA_RUNTIME_LIMITS_ENABLED: '0',
        SKYEQUANTA_RUNTIME_APPARMOR_PROFILE: 'strict',
        SKYEQUANTA_RUNTIME_APPARMOR_STRICT: '1'
      },
      rootDir: config.rootDir,
      cwd: workspaceDir,
      workspaceId: 'section43',
      label: 'apparmor-strict'
    });
    strictOutcome = {
      ok: Boolean(launch.appArmor?.active),
      mode: launch.appArmor?.active ? 'active' : 'inactive',
      appArmor: launch.appArmor || null
    };
  } catch (error) {
    strictOutcome = {
      ok: true,
      mode: 'fail-closed',
      message: error instanceof Error ? error.message : String(error)
    };
  }

  const kernelReady = Boolean(bundle.support?.kernelEnabled && bundle.support?.aaExec && bundle.support?.parser);
  const expectedStrictMode = kernelReady ? 'active' : 'fail-closed';
  return {
    ok: bundle.ok
      && fs.existsSync(bundle.profileFile)
      && Boolean(bundle.compiledFile && fs.existsSync(bundle.compiledFile))
      && strictOutcome?.ok
      && strictOutcome?.mode === expectedStrictMode,
    bundle: {
      ok: bundle.ok,
      profileName: bundle.profileName,
      profileFile: bundle.profileFile,
      compiledFile: bundle.compiledFile,
      metadataFile: bundle.metadataFile,
      support: bundle.support,
      compile: bundle.compile
    },
    strictOutcome,
    expectedStrictMode
  };
}

async function main() {
  const strict = process.argv.includes('--strict');
  const baseConfig = getStackConfig(process.env);
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section43-surface-lsm.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_43_LIVE_SURFACE_IDENTITY_AND_LSM_POLICY.json');

  const surfaceIdentityProof = await runSurfaceIdentityProof(config);
  const appArmorPolicyProof = await runAppArmorPolicyProof(config);

  const checks = [
    assertCheck(surfaceIdentityProof.ok, 'live surface identity route serves a signed artifact-bound deployment document over HTTP and the verifier binds it to the current sanitized release artifact', surfaceIdentityProof),
    assertCheck(appArmorPolicyProof.ok, 'AppArmor profile bundle lane writes per-workspace profiles, compiles them offline, and runtime strict mode fails closed when kernel enforcement cannot be guaranteed', appArmorPolicyProof)
  ];

  let payload = {
    section: 43,
    label: 'section-43-live-surface-identity-and-lsm-policy',
    generatedAt: new Date().toISOString(),
    strict,
    proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section43-surface-lsm.mjs --strict',
    smokeCommand: 'bash scripts/smoke-section43-surface-lsm.sh',
    pass: checks.every(item => item.pass),
    checks,
    evidence: {
      surfaceIdentityProof,
      appArmorPolicyProof
    }
  };
  payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section43-surface-lsm.mjs');
  if (strict && !payload.pass) {
    throw new Error('Section 43 live surface identity / LSM policy proof failed in strict mode.');
  }
  console.log(JSON.stringify(payload, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
