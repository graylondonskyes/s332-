import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

import { getPublicUrls, getStackConfig } from './config.mjs';
import { ensureRuntimeState } from '../lib/runtime.mjs';
import { printCanonicalRuntimeBanner } from '../lib/canonical-runtime.mjs';
import { runWorkspaceLifecycleSmoke } from './workspace-smoke-lifecycle.mjs';

function parseArgs(argv) {
  const options = {
    smoke: false,
    json: false,
    keepRunning: false,
    reportFile: null,
    skipVerify: false,
    skipBuild: false,
    probeActive: true,
    bridgeUrl: null,
    profile: 'generic'
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--smoke') { options.smoke = true; continue; }
    if (value === '--json') { options.json = true; continue; }
    if (value === '--keep-running') { options.keepRunning = true; continue; }
    if (value === '--skip-verify') { options.skipVerify = true; continue; }
    if (value === '--skip-build') { options.skipBuild = true; continue; }
    if (value === '--no-probe-active') { options.probeActive = false; continue; }
    if (value === '--report-file' && argv[index + 1]) { options.reportFile = path.resolve(String(argv[index + 1])); index += 1; continue; }
    if (value.startsWith('--report-file=')) { options.reportFile = path.resolve(String(value.split('=').slice(1).join('='))); continue; }
    if (value === '--bridge-url' && argv[index + 1]) { options.bridgeUrl = String(argv[index + 1]); index += 1; continue; }
    if (value.startsWith('--bridge-url=')) { options.bridgeUrl = String(value.split('=').slice(1).join('=')); continue; }
    if (value === '--profile' && argv[index + 1]) { options.profile = String(argv[index + 1]); index += 1; continue; }
    if (value.startsWith('--profile=')) { options.profile = String(value.split('=').slice(1).join('=')); continue; }
  }

  return options;
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function withBootDefaults(baseEnv = process.env) {
  return {
    ...baseEnv,
    SKYEQUANTA_ADMIN_TOKEN: String(baseEnv.SKYEQUANTA_ADMIN_TOKEN || baseEnv.OH_SECRET_KEY || 'cold-machine-admin-token').trim(),
    SKYEQUANTA_GATE_TOKEN: String(baseEnv.SKYEQUANTA_GATE_TOKEN || baseEnv.SKYEQUANTA_OSKEY || 'cold-machine-gate-token').trim(),
    SKYEQUANTA_GATE_URL: String(baseEnv.SKYEQUANTA_GATE_URL || baseEnv.OMEGA_GATE_URL || 'http://127.0.0.1:5999').trim(),
    SKYEQUANTA_GATE_MODEL: String(baseEnv.SKYEQUANTA_GATE_MODEL || 'kaixu/deep').trim() || 'kaixu/deep'
  };
}

function assertCheck(condition, message, detail = null) {
  return { pass: Boolean(condition), message, detail };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function delay(ms) {
  return await new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { response, status: response.status, ok: response.ok, text, json };
}

async function waitForJson(url, options = {}, timeoutMs = 20000, validate = payload => Boolean(payload?.ok)) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const result = await fetchJson(url, options);
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

function createVerifyChecks(config) {
  return [
    { label: 'canonical-paths-doc', filePath: path.join(config.rootDir, 'docs', 'CANONICAL_RUNTIME_PATHS.md') },
    { label: 'launch-script', filePath: path.join(config.shellDir, 'bin', 'launch.mjs') },
    { label: 'bridge-script', filePath: path.join(config.shellDir, 'bin', 'bridge.mjs') },
    { label: 'doctor-script', filePath: path.join(config.shellDir, 'bin', 'doctor.mjs') },
    { label: 'stage1-proof-script', filePath: path.join(config.shellDir, 'bin', 'workspace-proof-stage1.mjs') },
    { label: 'linux-bootstrap-script', filePath: path.join(config.rootDir, 'scripts', 'bootstrap-linux.sh') },
    { label: 'devcontainer-bootstrap-script', filePath: path.join(config.rootDir, 'scripts', 'bootstrap-devcontainer.sh') },
    { label: 'system-dependency-manifest', filePath: path.join(config.rootDir, 'docs', 'SYSTEM_DEPENDENCY_MANIFEST.md') },
    { label: 'runtime-state-dir', filePath: path.join(config.rootDir, '.skyequanta') }
  ];
}

function runStage1TruthProof(config, env) {
  const proofScript = path.join(config.shellDir, 'bin', 'workspace-proof-stage1.mjs');
  const result = spawnSync(process.execPath, [proofScript, '--strict'], {
    cwd: config.rootDir,
    env,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024
  });

  const proofPath = path.join(config.rootDir, 'docs', 'proof', 'STAGE_1_TRUTH_AND_PROOF.json');
  const proofPayload = fs.existsSync(proofPath) ? readJson(proofPath) : null;

  return {
    command: `node ${path.relative(config.rootDir, proofScript)} --strict`,
    status: result.status,
    stdoutTail: String(result.stdout || '').split(/\r?\n/).filter(Boolean).slice(-20),
    stderrTail: String(result.stderr || '').split(/\r?\n/).filter(Boolean).slice(-20),
    proofPath,
    proofPayload,
    pass: result.status === 0 && Boolean(proofPayload?.pass)
  };
}

function spawnBridge(config, env, logBuffer) {
  const child = spawn(process.execPath, [path.join(config.shellDir, 'bin', 'bridge.mjs')], {
    cwd: config.rootDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', chunk => logBuffer.push(chunk.toString('utf8')));
  child.stderr.on('data', chunk => logBuffer.push(chunk.toString('utf8')));
  return child;
}

async function terminateChild(child, signal = 'SIGTERM') {
  if (!child || child.exitCode !== null || child.killed) {
    return;
  }

  await new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    child.once('exit', finish);
    child.once('close', finish);
    try {
      child.kill(signal);
    } catch {
      finish();
    }
    setTimeout(finish, 1500);
  });
}

function buildReportPaths(config, options) {
  const reportsDir = path.join(config.rootDir, '.skyequanta', 'reports');
  const latest = options.reportFile || path.join(reportsDir, 'COLD_MACHINE_BOOTSTRAP_LATEST.json');
  const failure = path.join(reportsDir, 'COLD_MACHINE_BOOTSTRAP_FAILURE.json');
  const smokeArtifact = path.join(config.rootDir, 'docs', 'proof', 'SECTION_2_COLD_MACHINE_BOOTSTRAP.json');
  return { latest, failure, smokeArtifact };
}

function materializeVerifyResults(config) {
  return createVerifyChecks(config).map(item => ({
    label: item.label,
    filePath: item.filePath,
    pass: fs.existsSync(item.filePath)
  }));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const env = withBootDefaults(process.env);
  const config = getStackConfig(env);
  const reportPaths = buildReportPaths(config, options);
  const publicUrls = getPublicUrls(config);
  const bridgeBaseUrl = options.bridgeUrl || publicUrls.bridge;
  const bridgeLogs = [];
  const payload = {
    ok: false,
    label: 'section-2-cold-machine-bootstrap',
    profile: options.profile,
    smoke: options.smoke,
    generatedAt: new Date().toISOString(),
    canonicalCommand: 'npm run cold-machine:boot -- --smoke --json',
    steps: [],
    artifacts: {},
    checks: []
  };

  let bridgeChild = null;
  try {
    ensureRuntimeState(config, env);
    printCanonicalRuntimeBanner(config, 'cold-machine-bootstrap.mjs');

    payload.steps.push({
      name: 'prepare',
      pass: true,
      detail: 'Runtime state directories and canonical bootstrap defaults were materialized.',
      envDefaults: {
        bridgeUrl: bridgeBaseUrl,
        gateUrl: env.SKYEQUANTA_GATE_URL,
        gateModel: env.SKYEQUANTA_GATE_MODEL,
        adminTokenConfigured: Boolean(env.SKYEQUANTA_ADMIN_TOKEN),
        gateTokenConfigured: Boolean(env.SKYEQUANTA_GATE_TOKEN)
      }
    });

    if (!options.skipVerify) {
      const verifyResults = materializeVerifyResults(config);
      const stage1TruthProof = runStage1TruthProof(config, env);
      const verifyPass = verifyResults.every(item => item.pass) && stage1TruthProof.pass;
      payload.steps.push({
        name: 'verify',
        pass: verifyPass,
        fileChecks: verifyResults,
        stage1TruthProof
      });
      if (!verifyPass) {
        payload.ok = false;
        writeJson(reportPaths.latest, payload);
        writeJson(reportPaths.failure, payload);
        if (options.json) console.log(JSON.stringify(payload, null, 2));
        process.exitCode = 1;
        return;
      }
    }

    if (!options.skipBuild) {
      payload.steps.push({
        name: 'build',
        pass: true,
        detail: 'Canonical cold-machine bootstrap report paths and proof artifact targets are ready for emission.',
        reportPaths
      });
    }

    bridgeChild = spawnBridge(config, env, bridgeLogs);
    const bridgeStatus = await waitForJson(`${bridgeBaseUrl}/api/status`, {}, 20000, probe => probe?.productName === config.productName);
    const startStep = {
      name: 'start',
      pass: Boolean(bridgeStatus.ok && bridgeStatus.json?.productName === config.productName),
      bridgeBaseUrl,
      statusProbe: bridgeStatus.json
    };

    const doctorArgs = [
      path.join(config.shellDir, 'bin', 'doctor.mjs'),
      '--mode',
      'deploy',
      '--json',
      '--bridge-url',
      bridgeBaseUrl
    ];
    if (options.probeActive) {
      doctorArgs.splice(3, 0, '--probe-active');
    }
    const doctorRun = spawnSync(process.execPath, doctorArgs, {
      cwd: config.rootDir,
      env,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024
    });
    const doctorPayload = doctorRun.stdout?.trim() ? JSON.parse(doctorRun.stdout) : null;
    startStep.doctorDeploy = {
      command: `node apps/skyequanta-shell/bin/doctor.mjs --mode deploy --probe-active --json --bridge-url ${bridgeBaseUrl}`,
      status: doctorRun.status,
      payload: doctorPayload,
      pass: doctorRun.status === 0 && Boolean(doctorPayload?.ok)
    };
    startStep.pass = startStep.pass && startStep.doctorDeploy.pass;
    payload.artifacts.doctorDeploy = doctorPayload;

    if (options.smoke) {
      const lifecycleSmoke = await runWorkspaceLifecycleSmoke(config, {
        adminToken: env.SKYEQUANTA_ADMIN_TOKEN,
        bridgeBaseUrl,
        workspaceId: `cold-machine-smoke-${Date.now()}`,
        tenantId: `cold-machine-${options.profile}`
      });
      startStep.lifecycleSmoke = lifecycleSmoke;
      startStep.pass = startStep.pass && Boolean(lifecycleSmoke?.ok);
      payload.artifacts.lifecycleSmoke = lifecycleSmoke;
    }

    payload.steps.push(startStep);
    payload.checks = [
      assertCheck(payload.steps.find(step => step.name === 'prepare')?.pass, 'prepare step completed'),
      assertCheck(payload.steps.find(step => step.name === 'verify')?.pass !== false, 'verify step completed without failure'),
      assertCheck(payload.steps.find(step => step.name === 'build')?.pass !== false, 'build step completed without failure'),
      assertCheck(startStep.pass, 'start step completed and produced a healthy deploy-mode doctor result', startStep.doctorDeploy || startStep.statusProbe),
      assertCheck(Boolean(startStep.doctorDeploy?.pass), 'deploy-mode doctor passes cleanly from canonical boot flow', startStep.doctorDeploy?.payload),
      assertCheck(Boolean(startStep.lifecycleSmoke?.ok || !options.smoke), 'workspace lifecycle smoke passes from canonical boot flow', startStep.lifecycleSmoke)
    ];
    payload.ok = payload.steps.every(step => step.pass !== false) && payload.checks.every(item => item.pass);
    payload.artifacts.bridgeLogsTail = bridgeLogs.flatMap(item => item.split(/\r?\n/)).filter(Boolean).slice(-60);
    writeJson(reportPaths.latest, payload);
    if (!payload.ok) {
      writeJson(reportPaths.failure, payload);
    }
    if (options.smoke) {
      writeJson(reportPaths.smokeArtifact, payload);
    }

    if (options.json) {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      console.log(`Cold-machine bootstrap ${payload.ok ? 'passed' : 'failed'}: ${bridgeBaseUrl}`);
    }

    if (!payload.ok) {
      process.exitCode = 1;
      return;
    }

    if (!options.smoke && options.keepRunning) {
      await new Promise(resolve => {
        const shutdown = async () => {
          await terminateChild(bridgeChild, 'SIGTERM');
          resolve();
        };
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
      });
    }
  } catch (error) {
    payload.ok = false;
    payload.error = error instanceof Error ? error.stack || error.message : String(error);
    payload.artifacts.bridgeLogsTail = bridgeLogs.flatMap(item => item.split(/\r?\n/)).filter(Boolean).slice(-60);
    writeJson(reportPaths.latest, payload);
    writeJson(reportPaths.failure, payload);
    if (options.json) {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      console.error(payload.error);
    }
    process.exitCode = 1;
  } finally {
    if (bridgeChild) {
      await terminateChild(bridgeChild, 'SIGTERM');
    }
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
