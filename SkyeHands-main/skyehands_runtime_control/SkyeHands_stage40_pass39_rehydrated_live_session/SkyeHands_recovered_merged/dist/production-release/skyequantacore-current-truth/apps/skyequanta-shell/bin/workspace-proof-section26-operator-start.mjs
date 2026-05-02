import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { ensureDefaultWorkspace } from '../lib/workspace-manager.mjs';

function assertCheck(pass, message, detail = null) { return { pass: Boolean(pass), message, detail }; }
async function fetchText(url, options = {}) { const response = await fetch(url, options); return { ok: response.ok, status: response.status, text: await response.text() }; }

async function main() {
  const strict = process.argv.includes('--strict');
  const baseConfig = getStackConfig();
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section26-operator-start.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_26_OPERATOR_START_READY.json');
  const workspace = ensureDefaultWorkspace(config).workspace;
  const bridgePort = 3020 + (Date.now() % 500);
  const result = spawnSync(process.execPath, ['./skyequanta.mjs', 'operator:start', '--workspace', workspace.id, '--json'], { cwd: config.rootDir, encoding: 'utf8', env: { ...process.env, SKYEQUANTA_BRIDGE_PORT: String(bridgePort) } });
  const payloadJson = JSON.parse(result.stdout || '{}');
  const workspaceCenter = await fetchText(payloadJson.cockpit?.workspace || 'http://127.0.0.1/');
  const runtimeCenter = await fetchText(payloadJson.cockpit?.runtime || 'http://127.0.0.1/');
  const checks = [
    assertCheck(result.status === 0, 'canonical operator:start exits successfully', { status: result.status, stderr: result.stderr }),
    assertCheck(payloadJson.ok === true && payloadJson.bridge?.reachable === true, 'operator:start returns a reachable bridge and healthy payload', payloadJson),
    assertCheck(payloadJson.runtimeClosed === true, 'operator:start reports runtime closure instead of only bridge reachability', payloadJson),
    assertCheck(payloadJson.workspace?.status === 'running', 'operator:start leaves the default workspace running instead of erroring on prerequisites', payloadJson.workspace),
    assertCheck(Boolean(payloadJson.cockpit?.workspace) && Boolean(payloadJson.cockpit?.runtime) && Boolean(payloadJson.cockpit?.api), 'operator:start returns cockpit links for operators', payloadJson.cockpit),
    assertCheck(workspaceCenter.ok && workspaceCenter.text.includes('Workspace Center'), 'operator:start produces a live workspace cockpit link', workspaceCenter.status),
    assertCheck(runtimeCenter.ok && runtimeCenter.text.includes('Runtime Center'), 'operator:start produces a live runtime cockpit link', runtimeCenter.status),
    assertCheck(Array.isArray(payloadJson.nextSteps) && payloadJson.nextSteps.length >= 2, 'operator:start returns next-step guidance for non-expert operators', payloadJson.nextSteps)
  ];

  let payload = { section: 26, label: 'section-26-operator-start-ready', generatedAt: new Date().toISOString(), strict, proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section26-operator-start.mjs --strict', pass: checks.every(item => item.pass), checks, evidence: { operatorStart: payloadJson, workspaceCenterStatus: workspaceCenter.status, runtimeCenterStatus: runtimeCenter.status } };
  payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section26-operator-start.mjs');
  if (strict && !payload.pass) throw new Error('Section 26 operator start proof failed in strict mode.');
  console.log(JSON.stringify(payload, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : String(error)); process.exit(1); });
