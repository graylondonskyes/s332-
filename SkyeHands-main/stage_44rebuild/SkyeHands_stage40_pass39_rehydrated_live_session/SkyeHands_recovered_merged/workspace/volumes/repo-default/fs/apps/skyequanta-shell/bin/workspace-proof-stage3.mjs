import fs from 'node:fs';
import path from 'node:path';
import { getStackConfig } from './config.mjs';
import { ensureRuntimeState } from '../lib/runtime.mjs';
import { createWorkspace, startWorkspace, stopWorkspace, getWorkspaceRuntime } from '../lib/workspace-manager.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';

function parseArgs(argv) {
  const options = { workspaceId: 'repo-default', outFile: null, strict: false };
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

async function readJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  return { ok: response.ok, status: response.status, body };
}

function assertCondition(assertions, id, pass, detail) {
  assertions.push({ id, pass, detail });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  process.env.SKYEQUANTA_WORKSPACE_DRIVER = 'real-local-executor';
  const config = getStackConfig();
  ensureRuntimeState(config);
  createWorkspace(config, options.workspaceId, { name: 'Repo Provisioning Proof', source: 'stage3-proof' });
  await startWorkspace(config, options.workspaceId, 'stage_3_repo_provisioning_proof_start_1');
  const first = getWorkspaceRuntime(config, options.workspaceId);
  const state = first.state || {};
  const rootFiles = fs.existsSync(state?.paths?.fsDir || '') ? fs.readdirSync(state.paths.fsDir).sort() : [];
  const readmePath = path.join(state?.paths?.fsDir || '', 'README.md');
  const devcontainerPath = path.join(state?.paths?.fsDir || '', '.devcontainer', 'devcontainer.json');
  const readme = fs.existsSync(readmePath)
    ? { ok: true, path: readmePath, size: fs.statSync(readmePath).size }
    : { ok: false, path: readmePath };
  const devcontainer = fs.existsSync(devcontainerPath)
    ? { ok: true, path: devcontainerPath, size: fs.statSync(devcontainerPath).size }
    : { ok: false, path: devcontainerPath };
  const notesPath = path.join(state?.paths?.fsDir || '', 'notes', 'stage3-reopen.txt');
  const persistedContent = `stage3-reopen-proof:${new Date().toISOString()}`;
  fs.mkdirSync(path.dirname(notesPath), { recursive: true });
  fs.writeFileSync(notesPath, persistedContent, 'utf8');
  const writeResult = { ok: fs.existsSync(notesPath), path: notesPath, size: fs.existsSync(notesPath) ? fs.statSync(notesPath).size : 0 };

  await stopWorkspace(config, options.workspaceId, 'stage_3_repo_provisioning_restart');
  await startWorkspace(config, options.workspaceId, 'stage_3_repo_provisioning_proof_start_2');
  const second = getWorkspaceRuntime(config, options.workspaceId);
  const secondState = second.state || {};
  const reopenedNote = fs.existsSync(notesPath)
    ? { ok: true, path: notesPath, content: fs.readFileSync(notesPath, 'utf8') }
    : { ok: false, path: notesPath };
  const provisionFileExists = Boolean(secondState?.paths?.provisionFile && fs.existsSync(secondState.paths.provisionFile));
  const envFileExists = Boolean(secondState?.paths?.envFile && fs.existsSync(secondState.paths.envFile));
  const provisioning = provisionFileExists ? JSON.parse(fs.readFileSync(secondState.paths.provisionFile, 'utf8')) : null;
  const envPayload = envFileExists ? JSON.parse(fs.readFileSync(secondState.paths.envFile, 'utf8')) : null;
  const entryPaths = Array.isArray(rootFiles) ? rootFiles : [];

  const assertions = [];
  assertCondition(assertions, 'workspace_runtime_running_initial', Boolean(first.runtime?.running), first.runtime);
  assertCondition(assertions, 'workspace_runtime_running_reopen', Boolean(second.runtime?.running), second.runtime);
  assertCondition(assertions, 'repo_files_present_in_root', entryPaths.includes('README.md') && entryPaths.includes('package.json'), entryPaths);
  assertCondition(assertions, 'devcontainer_contract_present', Boolean(devcontainer.ok), devcontainer);
  assertCondition(assertions, 'readme_present', Boolean(readme.ok), readme);
  assertCondition(assertions, 'workspace_provision_file_exists', provisionFileExists, secondState?.paths || null);
  assertCondition(assertions, 'workspace_env_file_exists', envFileExists, secondState?.paths || null);
  assertCondition(assertions, 'workspace_env_contains_values', Boolean(envPayload && envPayload.values && Object.keys(envPayload.values).length >= 1), envPayload);
  assertCondition(assertions, 'workspace_reopened_file_persists', Boolean(reopenedNote.ok && reopenedNote.content === persistedContent), reopenedNote);
  assertCondition(assertions, 'provisioning_manifest_records_repo_contract', Boolean(provisioning && Array.isArray(provisioning.copied) && provisioning.copied.includes('.devcontainer') && provisioning.copied.includes('apps/skyequanta-shell')), provisioning);

  const passed = assertions.every(item => item.pass);
  let report = {
    proof: 'stage-3-repo-provisioning',
    generatedAt: new Date().toISOString(),
    workspaceId: options.workspaceId,
    passed,
    strict: options.strict,
    runtime: {
      first: first.runtime,
      second: second.runtime
    },
    state: {
      first: state,
      second: secondState
    },
    provisioning,
    envPayload,
    endpoints: { rootFiles, readme, devcontainer, writeResult, reopenedNote },
    assertions
  };
  const outFile = options.outFile || path.join(config.rootDir, 'docs', 'proof', 'STAGE_3_REPO_PROVISIONING.json');
  const emittedReport = writeProofJson(outFile, report, config, 'workspace-proof-stage3.mjs');
  console.log(JSON.stringify({ ok: passed, outFile, proof: report.proof }, null, 2));
  if (options.strict && !passed) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
