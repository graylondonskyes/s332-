import fs from 'node:fs';
import path from 'node:path';
import { getStackConfig } from './config.mjs';
import { assertLegacyEntrypointAllowed } from '../lib/canonical-runtime.mjs';
import { ensureRuntimeState } from '../lib/runtime.mjs';
import { ensureDefaultWorkspace, startWorkspace, getWorkspaceRuntime } from '../lib/workspace-manager.mjs';

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
  const response = await fetch(url);
  const body = await response.json();
  return {
    ok: response.ok,
    status: response.status,
    body
  };
}

function assertCondition(assertions, id, pass, detail) {
  assertions.push({ id, pass, detail });
}

const canonicalConfig = getStackConfig();
assertLegacyEntrypointAllowed(canonicalConfig, 'workspace-proof.mjs');

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = getStackConfig();
  ensureRuntimeState(config);
  ensureDefaultWorkspace(config);
  await startWorkspace(config, options.workspaceId, 'workspace_proof');

  const runtimeInfo = getWorkspaceRuntime(config, options.workspaceId);
  const state = runtimeInfo.state || {};
  const ideHealth = await readJson(`${state?.urls?.ide}/health`);
  const ideCapabilities = await readJson(`${state?.urls?.ide}/capabilities`);
  const agentHealth = await readJson(`${state?.urls?.agent}/health`);
  const agentCapabilities = await readJson(`${state?.urls?.agent}/capabilities`);

  const assertions = [];
  assertCondition(assertions, 'workspace_running', Boolean(runtimeInfo.runtime?.running), runtimeInfo.runtime);
  assertCondition(assertions, 'driver_is_explicit_stub', state.driver === 'workspace-service-stub', { driver: state.driver });
  assertCondition(assertions, 'ide_health_ok', ideHealth.ok && ideHealth.body?.serviceMode === 'stub', ideHealth);
  assertCondition(assertions, 'agent_health_ok', agentHealth.ok && agentHealth.body?.serviceMode === 'stub', agentHealth);
  assertCondition(assertions, 'ide_capabilities_report_stub', ideCapabilities.ok && ideCapabilities.body?.capabilities?.serviceMode === 'stub', ideCapabilities);
  assertCondition(assertions, 'agent_capabilities_report_stub', agentCapabilities.ok && agentCapabilities.body?.capabilities?.serviceMode === 'stub', agentCapabilities);
  assertCondition(assertions, 'no_real_ide_runtime_claimed', ideCapabilities.body?.capabilities?.realIdeRuntime === false, ideCapabilities.body?.capabilities);
  assertCondition(assertions, 'no_real_agent_runtime_claimed', agentCapabilities.body?.capabilities?.realAgentRuntime === false, agentCapabilities.body?.capabilities);

  const passed = assertions.every(item => item.pass);
  const report = {
    proof: 'stage-1-truth-and-proof',
    generatedAt: new Date().toISOString(),
    workspaceId: options.workspaceId,
    passed,
    strict: options.strict,
    runtime: runtimeInfo.runtime,
    state,
    endpoints: {
      ideHealth,
      ideCapabilities,
      agentHealth,
      agentCapabilities
    },
    assertions
  };

  const outFile = options.outFile || path.join(config.rootDir, 'docs', 'proof', 'STAGE_1_TRUTH_AND_PROOF.json');
  ensureDirectory(path.dirname(outFile));
  fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}
`, 'utf8');

  console.log(JSON.stringify({ ok: passed, outFile, proof: report.proof }, null, 2));

  if (options.strict && !passed) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
