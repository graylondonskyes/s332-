
import fs from 'node:fs';
import path from 'node:path';
import { getStackConfig } from './config.mjs';
import { ensureRuntimeState } from '../lib/runtime.mjs';
import { ensureDefaultWorkspace, startWorkspace, getWorkspaceRuntime } from '../lib/workspace-manager.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';

function parseArgs(argv) {
  const options = { workspaceId: 'local-default', outFile: null, strict: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--workspace' || value === '--workspace-id') {
      options.workspaceId = argv[index + 1] || options.workspaceId;
      index += 1;
      continue;
    }
    if (value === '--out') {
      options.outFile = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (value === '--strict') {
      options.strict = true;
    }
  }
  return options;
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

async function readJson(url) {
  try {
    const response = await fetch(url);
    const body = await response.json();
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

function assertCondition(assertions, id, pass, detail) {
  assertions.push({ id, pass, detail });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  process.env.SKYEQUANTA_WORKSPACE_DRIVER = 'real-local-executor';
  const config = getStackConfig();
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-stage2b.mjs');
  ensureRuntimeState(config);
  ensureDefaultWorkspace(config);
  await startWorkspace(config, options.workspaceId, 'stage_2b_upstream_parity_proof');
  const runtimeInfo = getWorkspaceRuntime(config, options.workspaceId);
  const state = runtimeInfo.state || {};
  const agentCapabilities = state?.urls?.agent ? await readJson(`${state.urls.agent}/capabilities`) : { ok: false, status: 0, error: 'missing agent url' };
  const assertions = [];
  assertCondition(assertions, 'driver_is_real_local_executor', state.driver === 'real-local-executor', { driver: state.driver });
  assertCondition(assertions, 'workspace_runtime_running', Boolean(runtimeInfo.runtime?.running), runtimeInfo.runtime);
  assertCondition(assertions, 'full_theia_runtime', Boolean(state?.dependencyLanes?.fullTheiaRuntime), state?.dependencyLanes || null);
  assertCondition(assertions, 'full_openhands_runtime', Boolean(state?.dependencyLanes?.fullOpenHandsRuntime), state?.dependencyLanes || null);
  assertCondition(assertions, 'ide_mode_is_upstream_theia', state?.runtimeMode?.ide === 'upstream-theia', state?.runtimeMode || null);
  assertCondition(assertions, 'agent_mode_is_upstream_openhands', state?.runtimeMode?.agent === 'upstream-openhands', state?.runtimeMode || null);
  assertCondition(assertions, 'agent_capabilities_report_full_openhands', Boolean(agentCapabilities?.body?.capabilities?.fullOpenHandsRuntime), agentCapabilities);
  const passed = assertions.every(item => item.pass);
  let report = {
    proof: 'stage-2b-upstream-parity',
    generatedAt: new Date().toISOString(),
    workspaceId: options.workspaceId,
    passed,
    strict: options.strict,
    runtime: runtimeInfo.runtime,
    state,
    endpoints: { agentCapabilities },
    assertions
  };
  const outFile = options.outFile || path.join(config.rootDir, 'docs', 'proof', 'STAGE_2B_UPSTREAM_PARITY.json');
  const emittedReport = writeProofJson(outFile, report, config, 'workspace-proof-stage2b.mjs');
  console.log(JSON.stringify({ ok: passed, outFile, proof: report.proof }, null, 2));
  if (options.strict && !passed) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
