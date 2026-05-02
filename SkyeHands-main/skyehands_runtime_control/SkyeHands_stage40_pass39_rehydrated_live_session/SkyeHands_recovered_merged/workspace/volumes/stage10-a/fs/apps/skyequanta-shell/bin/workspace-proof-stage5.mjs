
import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig } from './config.mjs';
import {
  getWorkspaceSandboxPaths,
  getWorkspaceRuntimeState,
  provisionWorkspaceRuntime,
  stopWorkspaceRuntime
} from '../lib/workspace-runtime.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}


function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function terminatePid(pid, signal = 'SIGTERM') {
  if (!Number.isInteger(pid) || pid <= 0) {
    return;
  }
  try {
    process.kill(pid, signal);
  } catch {}
}

async function stopExistingExecutor(config) {
  const state = readJson(config.paths.remoteExecutorStateFile, null);
  const pid = state?.pid;
  if (Number.isInteger(pid) && pid > 0) {
    terminatePid(pid, 'SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 1000));
    try {
      process.kill(pid, 0);
      terminatePid(pid, 'SIGKILL');
    } catch {}
  }
}


function writeJson(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function assertCheck(condition, message, detail = null) {
  return {
    pass: Boolean(condition),
    message,
    detail
  };
}

async function main() {
  const strict = process.argv.includes('--strict');

  process.env.SKYEQUANTA_WORKSPACE_DRIVER = 'remote-executor';
  process.env.SKYEQUANTA_MACHINE_PROFILE = 'large';
  process.env.SKYEQUANTA_SECRET_ALLOWLIST = 'TEST_SECRET_ALPHA,TEST_SECRET_BETA';
  process.env.TEST_SECRET_ALPHA = 'alpha-stage5';
  process.env.TEST_SECRET_BETA = 'beta-stage5';

  const config = getStackConfig(process.env);
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-stage5.mjs');
  const workspace = {
    id: 'stage5-lifecycle',
    name: 'Stage 5 Lifecycle'
  };

  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'STAGE_5_LIFECYCLE_AND_SECRETS.json');
  const paths = getWorkspaceSandboxPaths(config, workspace.id);

  await stopExistingExecutor(config);
  await stopWorkspaceRuntime(config, workspace.id).catch(() => {});
  const first = await provisionWorkspaceRuntime(config, workspace);
  const firstState = getWorkspaceRuntimeState(config, workspace.id);

  const lifecyclePolicy = readJson(paths.lifecyclePolicyFile, {});
  const secretManifest = readJson(paths.secretManifestFile, {});
  const prebuildManifest = readJson(paths.prebuildManifestFile, {});
  const secretEnv = fs.existsSync(paths.secretEnvFile) ? fs.readFileSync(paths.secretEnvFile, 'utf8') : '';

  const executorStateResponse = await fetch(`${firstState?.executor?.url || `http://${config.remoteExecutor.host}:${config.remoteExecutor.port}`}/state`);
  const executorState = await executorStateResponse.json();
  const remoteRuntime = executorState?.runtimes?.workspaces?.[workspace.id] || null;

  const stopResult = await stopWorkspaceRuntime(config, workspace.id);
  const second = await provisionWorkspaceRuntime(config, workspace);
  const secondState = getWorkspaceRuntimeState(config, workspace.id);

  const lifecyclePolicyAfterRestart = readJson(paths.lifecyclePolicyFile, {});
  const secretManifestAfterRestart = readJson(paths.secretManifestFile, {});
  const prebuildManifestAfterRestart = readJson(paths.prebuildManifestFile, {});

  const checks = [
    assertCheck(first?.state?.capabilities?.remoteExecutor === true, 'remote executor driver stayed active', first?.state?.capabilities),
    assertCheck(first?.state?.capabilities?.machineProfiles === true, 'machine profile capability is enabled', first?.state?.capabilities),
    assertCheck(first?.state?.capabilities?.secretInjection === true, 'secret injection capability is enabled', first?.state?.capabilities),
    assertCheck(first?.state?.capabilities?.lifecyclePolicy === true, 'lifecycle policy capability is enabled', first?.state?.capabilities),
    assertCheck(fs.existsSync(paths.lifecyclePolicyFile), 'lifecycle policy file exists', paths.lifecyclePolicyFile),
    assertCheck(fs.existsSync(paths.secretManifestFile), 'secret manifest file exists', paths.secretManifestFile),
    assertCheck(fs.existsSync(paths.secretEnvFile), 'secret env file exists', paths.secretEnvFile),
    assertCheck(fs.existsSync(paths.prebuildManifestFile), 'prebuild manifest file exists', paths.prebuildManifestFile),
    assertCheck(lifecyclePolicy?.machineProfile?.name === 'large', 'machine profile persisted as large', lifecyclePolicy),
    assertCheck(Array.isArray(secretManifest?.injected) && secretManifest.injected.includes('TEST_SECRET_ALPHA') && secretManifest.injected.includes('TEST_SECRET_BETA'), 'allowed secrets persisted in manifest', secretManifest),
    assertCheck(secretEnv.includes('TEST_SECRET_ALPHA=alpha-stage5') && secretEnv.includes('TEST_SECRET_BETA=beta-stage5'), 'secret env file contains injected values', secretEnv),
    assertCheck(Boolean(prebuildManifest?.prebuildKey), 'prebuild manifest contains a prebuild key', prebuildManifest),
    assertCheck(Boolean(prebuildManifest?.devcontainerHash), 'prebuild manifest contains a devcontainer hash', prebuildManifest),
    assertCheck(Boolean(remoteRuntime?.lifecycle?.machineProfile?.name === 'large'), 'remote executor tracks machine profile', remoteRuntime),
    assertCheck(Boolean(remoteRuntime?.secrets?.count === 2), 'remote executor tracks injected secret count', remoteRuntime),
    assertCheck(Boolean(remoteRuntime?.prebuild?.prebuildKey), 'remote executor tracks prebuild metadata', remoteRuntime),
    assertCheck(stopResult?.stopped === true, 'workspace stop succeeded before restart', stopResult),
    assertCheck(secondState?.processes?.idePid && secondState?.processes?.agentPid, 'workspace restarted with live processes', secondState?.processes),
    assertCheck(lifecyclePolicyAfterRestart?.machineProfile?.name === 'large', 'lifecycle policy survives restart', lifecyclePolicyAfterRestart),
    assertCheck(secretManifestAfterRestart?.count === 2, 'secret manifest survives restart', secretManifestAfterRestart),
    assertCheck(prebuildManifestAfterRestart?.prebuildKey === prebuildManifest?.prebuildKey, 'prebuild key survives restart', {
      before: prebuildManifest?.prebuildKey,
      after: prebuildManifestAfterRestart?.prebuildKey
    })
  ];

  const failed = checks.filter(check => !check.pass);
  let payload = {
    stage: 5,
    label: 'stage-5-lifecycle-and-secrets',
    strict,
    generatedAt: new Date().toISOString(),
    workspaceId: workspace.id,
    proofCommand: 'npm run workspace:proof:stage5 -- --strict',
    files: {
      lifecyclePolicyFile: paths.lifecyclePolicyFile,
      secretManifestFile: paths.secretManifestFile,
      secretEnvFile: paths.secretEnvFile,
      prebuildManifestFile: paths.prebuildManifestFile
    },
    runtime: {
      firstState,
      secondState,
      remoteRuntime
    },
    artifacts: {
      lifecyclePolicy,
      secretManifest,
      prebuildManifest
    },
    checks,
    pass: failed.length === 0
  };

  payload = writeProofJson(proofFile, payload, config, 'workspace-proof-stage5.mjs');

  if (strict && failed.length > 0) {
    console.error(JSON.stringify(payload, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify(payload, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
