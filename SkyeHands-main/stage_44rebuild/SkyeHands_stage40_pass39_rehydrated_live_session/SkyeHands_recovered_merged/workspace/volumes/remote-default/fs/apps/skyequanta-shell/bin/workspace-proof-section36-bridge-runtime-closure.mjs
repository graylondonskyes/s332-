import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, getRuntimePaths, loadShellEnv, repairArchiveStrippedRuntimeDependencies } from '../lib/runtime.mjs';

function assertCheck(pass, message, detail = null) {
  return { pass: Boolean(pass), message, detail };
}

function readJson(filePath, fallback = null) {
  if (!filePath || !fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function executableState(filePath) {
  if (!filePath || !fs.existsSync(filePath) || process.platform === 'win32') {
    return { exists: fs.existsSync(filePath), executable: false, mode: null };
  }
  const stat = fs.statSync(filePath);
  return {
    exists: true,
    executable: Boolean(stat.mode & 0o111),
    mode: stat.mode & 0o777
  };
}

async function fetchText(url) {
  try {
    const response = await fetch(url);
    return { ok: response.ok, status: response.status, text: await response.text() };
  } catch (error) {
    return { ok: false, status: 0, text: '', error: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  const strict = process.argv.includes('--strict');
  const baseConfig = getStackConfig();
  ensureRuntimeState(baseConfig, process.env);
  const env = withLocalBinPath(loadShellEnv(baseConfig));
  const config = getStackConfig(env);
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section36-bridge-runtime-closure.mjs');

  const runtimePaths = getRuntimePaths(config);
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_36_BRIDGE_RUNTIME_CLOSURE.json');
  const agentPython = process.platform === 'win32'
    ? path.join(config.paths.agentVenvDir, 'Scripts', 'python.exe')
    : path.join(config.paths.agentVenvDir, 'bin', 'python');
  const theiaCli = config.paths.isolatedTheiaCli;
  const candidates = [agentPython, theiaCli].filter(filePath => fs.existsSync(filePath));

  for (const filePath of candidates) {
    if (process.platform !== 'win32') {
      fs.chmodSync(filePath, 0o644);
    }
  }

  fs.writeFileSync(runtimePaths.remoteExecutorRuntimesFile, `${JSON.stringify({
    version: 1,
    runtimes: [
      {
        workspaceId: 'legacy-fixture',
        workspaceName: 'legacy-fixture',
        processes: {},
        ports: {},
        paths: {}
      }
    ]
  }, null, 2)}\n`, 'utf8');

  ensureRuntimeState(config, env);
  const repairSummary = repairArchiveStrippedRuntimeDependencies(config);
  const normalizedRuntimeTable = readJson(runtimePaths.remoteExecutorRuntimesFile, {});
  const runtimeRepairReport = readJson(path.join(runtimePaths.runtimeDir, 'runtime-dependency-repair.json'), {});

  spawnSync(process.execPath, ['apps/skyequanta-shell/bin/workspace.mjs', 'stop', 'local-default'], {
    cwd: config.rootDir,
    encoding: 'utf8',
    env
  });

  const bridgePort = 3400 + (Date.now() % 200);
  const executorPort = 3700 + (Date.now() % 200);
  const operator = spawnSync(process.execPath, ['./skyequanta.mjs', 'operator:start', '--json'], {
    cwd: config.rootDir,
    encoding: 'utf8',
    env: {
      ...env,
      SKYEQUANTA_BRIDGE_PORT: String(bridgePort),
      SKYEQUANTA_REMOTE_EXECUTOR_PORT: String(executorPort)
    }
  });

  const payloadJson = JSON.parse(operator.stdout || '{}');
  const workspaceCenter = await fetchText(payloadJson.cockpit?.workspace || 'http://127.0.0.1/');
  const runtimeCenter = await fetchText(payloadJson.cockpit?.runtime || 'http://127.0.0.1/');
  const postRepairCandidates = Object.fromEntries(candidates.map(filePath => [path.relative(config.rootDir, filePath), executableState(filePath)]));

  const checks = [
    assertCheck(candidates.length >= 2, 'archive runtime dependency fixtures exist for agent python and Theia CLI', candidates.map(filePath => path.relative(config.rootDir, filePath))),
    assertCheck(Object.values(postRepairCandidates).every(entry => entry.executable), 'ensureRuntimeState rehydrates executable bits stripped by archive extraction', postRepairCandidates),
    assertCheck((runtimeRepairReport?.repairedCount || 0) >= 2, 'runtime dependency repair touched stripped runtime binaries', runtimeRepairReport),
    assertCheck((runtimeRepairReport?.repairedCount || 0) >= 2, 'runtime dependency repair report is persisted to disk for support/proof lanes', runtimeRepairReport),
    assertCheck(Boolean(normalizedRuntimeTable?.workspaces?.['legacy-fixture']), 'legacy remote executor runtime tables are normalized from runtimes[] into workspaces{}', normalizedRuntimeTable),
    assertCheck(operator.status === 0, 'operator:start exits successfully after runtime closure repair', { status: operator.status, stderr: operator.stderr }),
    assertCheck(payloadJson.ok === true && payloadJson.runtimeClosed === true && payloadJson.bridge?.reachable === true, 'bridge payload now requires runtime closure rather than bridge-only reachability', payloadJson),
    assertCheck(payloadJson.workspace?.status === 'running', 'operator:start leaves the default workspace running after dependency repair', payloadJson.workspace),
    assertCheck(workspaceCenter.ok && workspaceCenter.text.includes('Workspace Center'), 'workspace center is reachable after runtime closure repair', workspaceCenter.status),
    assertCheck(runtimeCenter.ok && runtimeCenter.text.includes('Runtime Center'), 'runtime center is reachable after runtime closure repair', runtimeCenter.status)
  ];

  let payload = {
    section: 36,
    label: 'section-36-bridge-runtime-closure',
    generatedAt: new Date().toISOString(),
    strict,
    proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section36-bridge-runtime-closure.mjs --strict',
    pass: checks.every(item => item.pass),
    checks,
    evidence: {
      repairSummary,
      runtimeRepairReport,
      normalizedRuntimeTable,
      operatorStart: payloadJson,
      workspaceCenterStatus: workspaceCenter.status,
      runtimeCenterStatus: runtimeCenter.status
    }
  };

  payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section36-bridge-runtime-closure.mjs');
  if (strict && !payload.pass) {
    throw new Error('Section 36 bridge/runtime closure proof failed in strict mode.');
  }
  console.log(JSON.stringify(payload, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
