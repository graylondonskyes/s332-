import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { createWorkspace, deleteWorkspace, getWorkspace, startWorkspace } from '../lib/workspace-manager.mjs';

function assertCheck(pass, message, detail = null) { return { pass: Boolean(pass), message, detail }; }
function authHeaders(config) { return config.auth?.adminToken ? { authorization: `Bearer ${config.auth.adminToken}` } : {}; }
async function fetchJson(url, options = {}) { const response = await fetch(url, options); const text = await response.text(); let json = null; try { json = JSON.parse(text); } catch {} return { ok: response.ok, status: response.status, json, text }; }
async function fetchText(url, options = {}) { const response = await fetch(url, options); return { ok: response.ok, status: response.status, text: await response.text() }; }

async function main() {
  const strict = process.argv.includes('--strict');
  const baseConfig = getStackConfig();
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section25-workspace-cockpit.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_25_WORKSPACE_COCKPIT.json');
  const workspaceId = 'section25-cockpit';
  const bridgePort = 3020 + (Date.now() % 500);
  if (getWorkspace(config, workspaceId)) { await deleteWorkspace(config, workspaceId, { deletedBy: 'section25-proof-reset' }); }
  createWorkspace(config, workspaceId, { name: 'Section 25 Cockpit', source: 'section25-proof', force: true, secretScope: 'section25-local' });
  await startWorkspace(config, workspaceId, 'section25-proof-start');
  const operatorStart = spawnSync(process.execPath, ['./skyequanta.mjs', 'operator:start', '--workspace', workspaceId, '--json'], { cwd: config.rootDir, encoding: 'utf8', env: { ...process.env, SKYEQUANTA_BRIDGE_PORT: String(bridgePort) } });
  const operator = JSON.parse(operatorStart.stdout || '{}');
  const headers = authHeaders(config);
  const cockpit = await fetchJson(operator.cockpit.api, { headers });
  const runtimeEvents = await fetchJson(`${operator.cockpit.api.replace('/cockpit','/runtime-events')}?limit=5`, { headers });
  const runtimeLogs = await fetchJson(`${operator.cockpit.api.replace('/cockpit','/runtime-logs')}?limit=20`, { headers });
  const workspaceCenter = await fetchText(operator.cockpit.workspace);
  const runtimeCenter = await fetchText(operator.cockpit.runtime);
  const gateCenter = await fetchText(operator.cockpit.gate);
  const fileCenter = await fetchText(operator.cockpit.file);
  const secretSet = await fetchJson(`${operator.cockpit.api.replace('/cockpit','/secret-scope')}`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ secretScope: 'section25-updated' }) });
  const secretClear = await fetchJson(`${operator.cockpit.api.replace('/cockpit','/secret-scope')}`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'clear' }) });

  const checks = [
    assertCheck(cockpit.ok && cockpit.json?.centers?.runtime && cockpit.json?.previewUrls, 'workspace cockpit API returns live cockpit links and preview URLs', cockpit.json),
    assertCheck(runtimeEvents.ok && Array.isArray(runtimeEvents.json?.events), 'runtime events API is available from the cockpit lane', runtimeEvents.json),
    assertCheck(runtimeLogs.ok && runtimeLogs.json?.logs?.ide && runtimeLogs.json?.logs?.agent, 'runtime logs API returns lane log tails', runtimeLogs.json),
    assertCheck(workspaceCenter.ok && workspaceCenter.text.includes('Workspace Center'), 'workspace center surface is live', workspaceCenter.status),
    assertCheck(runtimeCenter.ok && runtimeCenter.text.includes('Runtime Center'), 'runtime center surface is live', runtimeCenter.status),
    assertCheck(gateCenter.ok && gateCenter.text.includes('Gate Center'), 'gate center surface is live', gateCenter.status),
    assertCheck(fileCenter.ok && fileCenter.text.includes('File Center'), 'file center surface is live', fileCenter.status),
    assertCheck(secretSet.ok && secretSet.json?.workspace?.metadata?.secretScope === 'section25-updated', 'secret scope can be set through the cockpit API', secretSet.json),
    assertCheck(secretClear.ok && secretClear.json?.workspace?.metadata?.secretScope === null, 'secret scope can be cleared through the cockpit API', secretClear.json)
  ];

  let payload = { section: 25, label: 'section-25-workspace-cockpit', generatedAt: new Date().toISOString(), strict, proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section25-workspace-cockpit.mjs --strict', pass: checks.every(item => item.pass), checks, evidence: { operator, cockpit: cockpit.json, runtimeEvents: runtimeEvents.json, runtimeLogs: runtimeLogs.json } };
  payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section25-workspace-cockpit.mjs');
  if (strict && !payload.pass) throw new Error('Section 25 workspace cockpit proof failed in strict mode.');
  console.log(JSON.stringify(payload, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : String(error)); process.exit(1); });
