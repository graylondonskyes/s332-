import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig } from './config.mjs';
import { ensureRuntimeState } from '../lib/runtime.mjs';
import { ensureDefaultWorkspace, startWorkspace, getWorkspaceRuntime } from '../lib/workspace-manager.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';

function parseArgs(argv) {
  const options = {
    workspaceId: 'local-default',
    outFile: null,
    strict: false
  };

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
      continue;
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
    return {
      ok: response.ok,
      status: response.status,
      body
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function readText(url) {
  try {
    const response = await fetch(url);
    const body = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      body
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function assertCondition(assertions, id, pass, detail) {
  assertions.push({ id, pass, detail });
}

function tailLog(filePath, maxLines = 60) {
  if (!filePath || !fs.existsSync(filePath)) {
    return [];
  }

  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean).slice(-maxLines);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  process.env.SKYEQUANTA_WORKSPACE_DRIVER = 'real-local-executor';
  const config = getStackConfig();
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-stage2.mjs');
  ensureRuntimeState(config);
  ensureDefaultWorkspace(config);
  await startWorkspace(config, options.workspaceId, 'stage_2_real_local_executor_proof');

  const runtimeInfo = getWorkspaceRuntime(config, options.workspaceId);
  const state = runtimeInfo.state || {};
  const ideRoot = state?.urls?.ide ? await readText(state.urls.ide) : { ok: false, status: 0, error: 'missing ide url' };
  const agentHealth = state?.urls?.agent ? await readText(`${state.urls.agent}/health`) : { ok: false, status: 0, error: 'missing agent url' };
  const agentDocs = state?.urls?.agent ? await readText(`${state.urls.agent}/docs`) : { ok: false, status: 0, error: 'missing agent url' };

  const ideLooksReal = Boolean(ideRoot.ok && typeof ideRoot.body === 'string' && ideRoot.body.length > 0 && !ideRoot.body.includes('STUB WORKSPACE SERVICE'));
  const agentLooksReal = Boolean(
    agentHealth.ok &&
    typeof agentHealth.body === 'string' &&
    !agentHealth.body.includes('stub') &&
    agentDocs.ok &&
    typeof agentDocs.body === 'string' &&
    !agentDocs.body.includes('serviceMode')
  );

  const assertions = [];
  assertCondition(assertions, 'driver_is_real_local_executor', state.driver === 'real-local-executor', { driver: state.driver });
  assertCondition(assertions, 'launch_plan_recorded', Boolean(state.launchPlan?.ide?.command && state.launchPlan?.agent?.command), state.launchPlan);
  assertCondition(assertions, 'preflight_recorded', Array.isArray(state?.preflight?.checks), state.preflight);
  assertCondition(assertions, 'preflight_has_no_blockers', Array.isArray(state?.preflight?.blockers) && state.preflight.blockers.length === 0, state?.preflight?.blockers || []);
  assertCondition(assertions, 'runtime_running', Boolean(runtimeInfo.runtime?.running), runtimeInfo.runtime);
  assertCondition(assertions, 'ide_root_is_not_stub', ideLooksReal, ideRoot);
  assertCondition(assertions, 'agent_runtime_is_not_stub', agentLooksReal, { agentHealth, agentDocs });

  const passed = assertions.every(item => item.pass);
  let report = {
    proof: 'stage-2-real-local-executor',
    generatedAt: new Date().toISOString(),
    workspaceId: options.workspaceId,
    passed,
    strict: options.strict,
    realIdeRuntime: ideLooksReal,
    realAgentRuntime: agentLooksReal,
    runtime: runtimeInfo.runtime,
    state,
    endpoints: {
      ideRoot,
      agentHealth,
      agentDocs
    },
    logTail: {
      ide: tailLog(state?.logs?.ide),
      agent: tailLog(state?.logs?.agent)
    },
    assertions
  };

  const outFile = options.outFile || path.join(config.rootDir, 'docs', 'proof', 'STAGE_2_REAL_LOCAL_EXECUTOR.json');
  const emittedReport = writeProofJson(outFile, report, config, 'workspace-proof-stage2.mjs');

  console.log(JSON.stringify({ ok: passed, outFile, proof: report.proof }, null, 2));

  if (options.strict && !passed) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
