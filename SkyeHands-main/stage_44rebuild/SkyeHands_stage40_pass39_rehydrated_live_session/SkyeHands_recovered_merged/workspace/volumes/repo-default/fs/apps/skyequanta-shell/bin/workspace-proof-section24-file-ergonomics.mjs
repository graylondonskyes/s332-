import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { createWorkspace, deleteWorkspace, getWorkspace, startWorkspace } from '../lib/workspace-manager.mjs';
import { getWorkspaceSandboxPaths } from '../lib/workspace-runtime.mjs';

function assertCheck(pass, message, detail = null) { return { pass: Boolean(pass), message, detail }; }
function authHeaders(config) { return config.auth?.adminToken ? { authorization: `Bearer ${config.auth.adminToken}` } : {}; }
async function fetchJson(url, options = {}) { const response = await fetch(url, options); const text = await response.text(); let json = null; try { json = JSON.parse(text); } catch {} return { ok: response.ok, status: response.status, json, text }; }

async function main() {
  const strict = process.argv.includes('--strict');
  const baseConfig = getStackConfig();
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section24-file-ergonomics.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_24_FILE_ERGONOMICS.json');
  const workspaceId = 'section24-files';
  const bridgePort = 3020 + (Date.now() % 500);
  if (getWorkspace(config, workspaceId)) { await deleteWorkspace(config, workspaceId, { deletedBy: 'section24-proof-reset' }); }
  createWorkspace(config, workspaceId, { name: 'Section 24 Files', source: 'section24-proof', force: true });
  await startWorkspace(config, workspaceId, 'section24-proof-start');
  const paths = getWorkspaceSandboxPaths(config, workspaceId);
  const projectDir = fs.existsSync(path.join(paths.fsDir, 'project')) ? path.join(paths.fsDir, 'project') : paths.fsDir;
  fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'src', 'app.js'), 'export const ready = true;\nconsole.log(ready);\n', 'utf8');
  fs.writeFileSync(path.join(projectDir, 'README.md'), '# File ergonomics\nworkspace search target\n', 'utf8');
  fs.writeFileSync(path.join(projectDir, 'config.toml'), 'mode = "local"\n', 'utf8');
  fs.writeFileSync(path.join(projectDir, 'blob.bin'), Buffer.from([1,2,3,4]));
  spawnSync('git', ['init'], { cwd: projectDir, stdio: 'ignore' });
  spawnSync('git', ['config', 'user.email', 'section24@example.com'], { cwd: projectDir, stdio: 'ignore' });
  spawnSync('git', ['config', 'user.name', 'Section 24'], { cwd: projectDir, stdio: 'ignore' });
  spawnSync('git', ['add', '.'], { cwd: projectDir, stdio: 'ignore' });
  spawnSync('git', ['commit', '-m', 'section24 baseline'], { cwd: projectDir, stdio: 'ignore' });
  fs.writeFileSync(path.join(projectDir, 'src', 'app.js'), 'export const ready = false;\nconsole.log(ready);\n', 'utf8');

  const operatorStart = spawnSync(process.execPath, ['./skyequanta.mjs', 'operator:start', '--workspace', workspaceId, '--json'], { cwd: config.rootDir, encoding: 'utf8', env: { ...process.env, SKYEQUANTA_BRIDGE_PORT: String(bridgePort) } });
  const operator = JSON.parse(operatorStart.stdout || '{}');
  const headers = authHeaders(config);
  const apiBase = operator.cockpit.api.replace('/cockpit', '');
  const tree = await fetchJson(`${apiBase}/files/tree?depth=2`, { headers });
  const inspect = await fetchJson(`${apiBase}/files/inspect?path=src/app.js`, { headers });
  const content = await fetchJson(`${apiBase}/files/content?path=README.md`, { headers });
  const search = await fetchJson(`${apiBase}/files/search?q=workspace`, { headers });
  const changed = await fetchJson(`${apiBase}/files/changed`, { headers });
  const diff = await fetchJson(`${apiBase}/files/diff?path=src/app.js`, { headers });
  const binaryInspect = await fetchJson(`${apiBase}/files/inspect?path=blob.bin`, { headers });
  const download = await fetch(`${apiBase}/files/download?path=README.md`, { headers });

  const checks = [
    assertCheck(tree.ok && Array.isArray(tree.json?.items), 'file tree API returns a structured workspace tree', tree.json),
    assertCheck(inspect.ok && inspect.json?.file?.association?.category === 'source', 'file inspect exposes association metadata for source files', inspect.json),
    assertCheck(content.ok && String(content.json?.file?.content || '').includes('workspace search target'), 'file content API returns readable text previews', content.json),
    assertCheck(search.ok && Array.isArray(search.json?.matches) && search.json.matches.length >= 1, 'file search API returns repo search matches', search.json),
    assertCheck(changed.ok && Array.isArray(changed.json?.files) && changed.json.files.some(item => item.path === 'src/app.js'), 'changed-file API surfaces modified git-tracked files', changed.json),
    assertCheck(diff.ok && String(diff.json?.diff || '').includes('ready = false'), 'file diff API returns a readable diff payload', diff.json),
    assertCheck(binaryInspect.ok && binaryInspect.json?.file?.downloadOnly === true, 'binary inspect path marks non-text files as download-only', binaryInspect.json),
    assertCheck(download.ok && download.status === 200, 'file download route streams a file successfully', { status: download.status })
  ];

  let payload = { section: 24, label: 'section-24-file-ergonomics', generatedAt: new Date().toISOString(), strict, proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section24-file-ergonomics.mjs --strict', pass: checks.every(item => item.pass), checks, evidence: { operator, tree: tree.json, inspect: inspect.json, content: content.json, search: search.json, changed: changed.json, diff: diff.json, binaryInspect: binaryInspect.json, downloadStatus: download.status } };
  payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section24-file-ergonomics.mjs');
  if (strict && !payload.pass) throw new Error('Section 24 file ergonomics proof failed in strict mode.');
  console.log(JSON.stringify(payload, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : String(error)); process.exit(1); });
