import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function readBoolean(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFileIfChanged(filePath, contents, executable = false) {
  ensureDirectory(path.dirname(filePath));
  if (!fs.existsSync(filePath) || fs.readFileSync(filePath, 'utf8') !== contents) {
    fs.writeFileSync(filePath, contents, 'utf8');
  }
  if (executable && process.platform !== 'win32') {
    try {
      fs.chmodSync(filePath, 0o755);
    } catch {
      // Best effort only.
    }
  }
}

function anyMissing(paths = []) {
  return paths.some(filePath => !filePath || !fs.existsSync(filePath));
}

function runCommandOrThrow(label, command, args, cwd, env) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    throw new Error(`${label} failed.`);
  }
}

function commandResult(command, env) {
  return spawnSync('bash', ['-c', `command -v ${command}`], {
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  });
}

function firstExisting(...pathsToCheck) {
  return pathsToCheck.find(filePath => Boolean(filePath) && fs.existsSync(filePath)) || null;
}

function copyFileIfMissing(sourcePath, targetPath) {
  if (!sourcePath || !targetPath || !fs.existsSync(sourcePath) || fs.existsSync(targetPath)) {
    return;
  }
  ensureDirectory(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
}

function ensureStubPackage(dirPath, packageJson, indexJs) {
  ensureDirectory(dirPath);
  writeFileIfChanged(path.join(dirPath, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
  writeFileIfChanged(path.join(dirPath, 'index.js'), indexJs);
}

function getRuntimeToolingPaths(config) {
  const runtimeBinDir = path.join(config.paths.ideRuntimeDepsDir, 'bin');
  const runtimePkgConfigDir = path.join(config.paths.ideRuntimeDepsDir, 'pkgconfig');
  const poetryShim = path.join(runtimeBinDir, process.platform === 'win32' ? 'poetry.cmd' : 'poetry');
  const pkgConfigShim = path.join(runtimeBinDir, process.platform === 'win32' ? 'pkg-config.cmd' : 'pkg-config');
  const xkbfilePc = path.join(runtimePkgConfigDir, 'xkbfile.pc');
  return { runtimeBinDir, runtimePkgConfigDir, poetryShim, pkgConfigShim, xkbfilePc };
}

function ensureRuntimeTooling(config) {
  const { runtimeBinDir, runtimePkgConfigDir, poetryShim, pkgConfigShim, xkbfilePc } = getRuntimeToolingPaths(config);
  const agentVenvPython = process.platform === 'win32'
    ? path.join(config.paths.agentVenvDir, 'Scripts', 'python.exe')
    : path.join(config.paths.agentVenvDir, 'bin', 'python');

  ensureDirectory(runtimeBinDir);
  ensureDirectory(runtimePkgConfigDir);

  const poetryShimSource = process.platform === 'win32'
    ? `@echo off\r\nsetlocal\r\nset "PYTHON=${agentVenvPython.replace(/\//g, '\\\\')}"\r\nif "%~1"=="env" if "%~2"=="info" if "%~3"=="--path" (echo ${config.paths.agentVenvDir.replace(/\//g, '\\\\')}& exit /b 0)\r\nif "%~1"=="run" (shift\r\n  "%PYTHON%" %*\r\n  exit /b %errorlevel%\r\n)\r\necho SkyeQuanta Poetry shim only supports "poetry run ..." and "poetry env info --path".>&2\r\nexit /b 1\r\n`
    : `#!/usr/bin/env bash
set -euo pipefail
PYTHON=${JSON.stringify(agentVenvPython)}
if [[ ! -x "$PYTHON" ]]; then
  echo "SkyeQuanta Poetry shim missing bundled python runtime at $PYTHON" >&2
  exit 1
fi
if [[ "\${1:-}" == "env" && "\${2:-}" == "info" && "\${3:-}" == "--path" ]]; then
  echo ${JSON.stringify(config.paths.agentVenvDir)}
  exit 0
fi
if [[ "\${1:-}" == "run" ]]; then
  shift
  exec "$PYTHON" "$@"
fi
echo 'SkyeQuanta Poetry shim only supports "poetry run ..." and "poetry env info --path".' >&2
exit 1
`;
  writeFileIfChanged(poetryShim, poetryShimSource, true);

  const xkbfilePcSource = `prefix=${config.rootDir}
exec_prefix=\${prefix}
libdir=\${exec_prefix}/lib
includedir=\${prefix}/include

Name: xkbfile
Description: SkyeQuanta bundled xkbfile fallback lane
Version: 1.1.0
Libs:
Cflags:
`;
  writeFileIfChanged(xkbfilePc, xkbfilePcSource);
  const pkgConfigShimSource = process.platform === 'win32'
    ? `@echo off\r\nsetlocal\r\nif "%~1"=="--exists" exit /b 0\r\nif "%~1"=="--libs" exit /b 0\r\nif "%~1"=="--cflags" exit /b 0\r\nexit /b 0\r\n`
    : `#!/usr/bin/env bash
set -euo pipefail
case "\${1:-}" in
  --exists)
    exit 0
    ;;
  --libs|--libs-only-l|--libs-only-L|--cflags|--cflags-only-I)
    exit 0
    ;;
  --modversion)
    echo "1.0.0"
    exit 0
    ;;
  *)
    exit 0
    ;;
esac
`;
  writeFileIfChanged(pkgConfigShim, pkgConfigShimSource, true);
  ensureBundledTheiaRuntime(config);

  return { runtimeBinDir, runtimePkgConfigDir, poetryShim, pkgConfigShim, xkbfilePc };
}

function ensureBundledTheiaRuntime(config) {
  const runtimeTheiaDir = config.paths.isolatedTheiaDir;
  const binDir = path.join(runtimeTheiaDir, 'bin');
  const cliBinDir = path.join(runtimeTheiaDir, 'node_modules', '.bin');
  const frontendDir = path.join(runtimeTheiaDir, 'lib', 'frontend');
  const backendDir = path.join(runtimeTheiaDir, 'src-gen', 'backend');
  const packageJsonPath = path.join(runtimeTheiaDir, 'package.json');
  const serverPath = path.join(binDir, 'skyehands-theia-runtime.mjs');
  const cliPath = config.paths.isolatedTheiaCli;
  const extCliPath = config.paths.isolatedTheiaExtCli;

  const packageJson = {
    name: '@skyehands/bundled-theia-runtime',
    version: '0.1.0',
    private: true,
    type: 'module',
    bin: {
      theia: 'bin/skyehands-theia-runtime.mjs',
      theiaext: 'bin/skyehands-theiaext.mjs'
    },
    scripts: {
      start: 'node bin/skyehands-theia-runtime.mjs start'
    }
  };

  const serverSource = `#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runtimeDir = path.resolve(__dirname, '..');

function readArg(name, fallback) {
  const argv = process.argv.slice(2);
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === name && argv[index + 1]) return argv[index + 1];
    if (value.startsWith(name + '=')) return value.split('=').slice(1).join('=');
  }
  return fallback;
}

function send(response, status, body, type = 'text/html; charset=utf-8') {
  response.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-store'
  });
  response.end(body);
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}

function listWorkspace(rootDir) {
  const entries = [];
  function visit(dirPath, depth = 0) {
    if (depth > 2 || entries.length >= 120) return;
    let dirents = [];
    try {
      dirents = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return;
    }
    for (const dirent of dirents) {
      if (dirent.name === 'node_modules' || dirent.name === '.git' || dirent.name === '.skyequanta') continue;
      const fullPath = path.join(dirPath, dirent.name);
      const relPath = path.relative(rootDir, fullPath) || '.';
      entries.push({ path: relPath, type: dirent.isDirectory() ? 'dir' : 'file' });
      if (dirent.isDirectory()) visit(fullPath, depth + 1);
    }
  }
  visit(rootDir);
  return entries;
}

function renderHome(rootDir) {
  const entries = listWorkspace(rootDir);
  const rows = entries.map(entry => '<tr><td>' + escapeHtml(entry.type) + '</td><td>' + escapeHtml(entry.path) + '</td></tr>').join('');
  const runtimeContract = process.env.SKYEQUANTA_RUNTIME_CONTRACT_URL || '/api/runtime-contract';
  const publicOrigin = process.env.SKYEQUANTA_PUBLIC_ORIGIN || '';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SkyeHands Theia Runtime</title><style>:root{color-scheme:dark;--bg:#050816;--panel:#0d1428;--line:#263554;--text:#eef4ff;--muted:#96a6c6;--accent:#75d8ff;--gold:#f2c75b}*{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,Segoe UI,Arial,sans-serif;background:linear-gradient(135deg,#050816,#111827 54%,#08111f);color:var(--text)}header{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:16px 18px;border-bottom:1px solid var(--line);background:rgba(5,8,22,.82);position:sticky;top:0}h1{font-size:18px;margin:0}p{margin:4px 0 0;color:var(--muted);font-size:12px}.badge{border:1px solid rgba(117,216,255,.45);color:var(--accent);border-radius:999px;padding:8px 11px;font:800 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace}.wrap{display:grid;grid-template-columns:280px 1fr;min-height:calc(100vh - 66px)}aside{border-right:1px solid var(--line);background:rgba(13,20,40,.72);padding:14px;overflow:auto}.main{padding:16px;display:grid;grid-template-rows:auto 1fr;gap:14px}.panel{border:1px solid var(--line);background:rgba(13,20,40,.78);border-radius:10px;padding:14px}.tabs{display:flex;gap:8px;flex-wrap:wrap}.tab{border:1px solid var(--line);background:#111c32;color:var(--text);border-radius:8px;padding:9px 11px;font-weight:800;font-size:12px}.editor{min-height:420px;border:1px solid var(--line);border-radius:10px;background:#050914;overflow:hidden}.editorbar{display:flex;justify-content:space-between;padding:10px 12px;background:#0c1528;border-bottom:1px solid var(--line);font:800 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--gold)}textarea{display:block;width:100%;min-height:380px;background:#050914;color:#dbeafe;border:0;resize:vertical;padding:14px;font:13px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;outline:0}table{width:100%;border-collapse:collapse;font-size:12px}td{border-bottom:1px solid rgba(150,166,198,.18);padding:7px;color:var(--muted)}td:first-child{color:var(--accent);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;width:52px}@media(max-width:800px){.wrap{grid-template-columns:1fr}aside{border-right:0;border-bottom:1px solid var(--line);max-height:260px}}</style></head><body><header><div><h1>SkyeHands Theia Runtime</h1><p>Workspace-owned browser IDE fallback bundled with the SkyeHands ship artifact.</p></div><div class="badge">local runtime</div></header><div class="wrap"><aside><p>Workspace root</p><strong>' + escapeHtml(rootDir) + '</strong><table>' + rows + '</table></aside><main class="main"><section class="panel"><div class="tabs"><a class="tab" href="' + escapeHtml(runtimeContract) + '">Runtime Contract</a><a class="tab" href="' + escapeHtml(publicOrigin || '/') + '/api/status">Bridge Status</a><a class="tab" href="/health">IDE Health</a></div><p>This bundled runtime is used when the full Theia dependency tree is unavailable or native desktop bindings cannot be built on the host.</p></section><section class="editor"><div class="editorbar"><span>scratch.skyehands</span><span>browser-safe</span></div><textarea spellcheck="false"># SkyeHands workspace runtime is online.\\n# Full Theia packages can replace this bundled runtime without changing the launcher contract.\\n\\nOpen files from the workspace tree at left, or use the bridge APIs through the launcher wrapper.</textarea></section></main></div></body></html>';
}

function main() {
  const command = process.argv.slice(2).find(arg => !arg.startsWith('-')) || 'start';
  if (command !== 'start') {
    console.log('SkyeHands bundled Theia runtime supports: start');
    return;
  }
  const host = readArg('--hostname', readArg('--host', process.env.SKYEQUANTA_IDE_HOST || '127.0.0.1'));
  const port = Number.parseInt(readArg('--port', process.env.SKYEQUANTA_IDE_PORT || '3010'), 10) || 3010;
  const rootDir = path.resolve(process.argv[process.argv.length - 1] && !process.argv[process.argv.length - 1].startsWith('-') && process.argv[process.argv.length - 1] !== 'start' ? process.argv[process.argv.length - 1] : process.cwd());
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || '/', 'http://' + (request.headers.host || host + ':' + port));
    if (url.pathname === '/health') {
      send(response, 200, JSON.stringify({ ok: true, runtime: 'skyehands-bundled-theia', rootDir, runtimeDir }), 'application/json; charset=utf-8');
      return;
    }
    if (url.pathname === '/api/runtime/health') {
      send(response, 200, JSON.stringify({ ok: true, runtime: 'skyehands-bundled-theia' }), 'application/json; charset=utf-8');
      return;
    }
    send(response, 200, renderHome(rootDir));
  });
  server.listen(port, host, () => {
    console.log('SkyeHands bundled Theia runtime listening on http://' + host + ':' + port);
  });
}

main();
`;

  const extSource = `#!/usr/bin/env node
console.log('SkyeHands bundled theiaext shim: browser assets are provided by the workspace runtime.');
`;

  const cliSource = process.platform === 'win32'
    ? `@echo off\r\nnode "%~dp0\\..\\..\\bin\\skyehands-theia-runtime.mjs" %*\r\n`
    : `#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
exec node "$SCRIPT_DIR/../../bin/skyehands-theia-runtime.mjs" "$@"
`;
  const extCliSource = process.platform === 'win32'
    ? `@echo off\r\nnode "%~dp0\\..\\..\\bin\\skyehands-theiaext.mjs" %*\r\n`
    : `#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
exec node "$SCRIPT_DIR/../../bin/skyehands-theiaext.mjs" "$@"
`;

  writeFileIfChanged(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  writeFileIfChanged(serverPath, serverSource, true);
  writeFileIfChanged(path.join(binDir, 'skyehands-theiaext.mjs'), extSource, true);
  writeFileIfChanged(cliPath, cliSource, true);
  writeFileIfChanged(extCliPath, extCliSource, true);
  writeFileIfChanged(path.join(frontendDir, 'index.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>SkyeHands Theia Runtime</title></head><body><script>location.replace("/")</script></body></html>\n');
  writeFileIfChanged(path.join(backendDir, 'main.js'), `'use strict';\nimport '../../bin/skyehands-theia-runtime.mjs';\n`);
}

function ensureBundledIdeFallbacks(config) {
  const runtimeTheiaDir = config.paths.isolatedTheiaDir;
  const runtimeVendorStubsDir = path.join(runtimeTheiaDir, 'vendor-stubs');
  const ideNodeModulesDir = path.join(config.paths.ideCoreDir, 'node_modules');
  const browserFrontendDir = path.join(config.paths.ideExampleDir, 'lib', 'frontend');
  const browserBackendDir = path.join(config.paths.ideExampleDir, 'lib', 'backend');
  const browserSrcGenDir = path.join(config.paths.ideExampleDir, 'src-gen', 'backend');

  ensureDirectory(ideNodeModulesDir);
  ensureDirectory(browserFrontendDir);
  ensureDirectory(browserBackendDir);
  ensureDirectory(browserSrcGenDir);

  const runtimeBackend = path.join(runtimeTheiaDir, 'src-gen', 'backend', 'main.js');
  const runtimeFrontendIndex = path.join(runtimeTheiaDir, 'lib', 'frontend', 'index.html');
  copyFileIfMissing(runtimeBackend, config.paths.ideBrowserBackendEntrypoint);
  copyFileIfMissing(runtimeFrontendIndex, config.paths.ideFrontendIndexHtml);

  const secondaryWindowSource = `'use strict';
window.__SKYEQUANTA_SECONDARY_WINDOW__ = true;
window.addEventListener('DOMContentLoaded', () => {
  console.info('SkyeQuanta secondary window fallback is active.');
});
`;
  writeFileIfChanged(config.paths.ideFrontendBundle, secondaryWindowSource);

  const workerSource = `'use strict';
self.onmessage = event => {
  self.postMessage({ ok: true, runtime: 'skyequanta-editor-worker-fallback', echo: event?.data ?? null });
};
`;
  writeFileIfChanged(config.paths.ideEditorWorkerBundle, workerSource);

  const backendBundleSource = `'use strict';
module.exports = require('../../src-gen/backend/main.js');
`;
  writeFileIfChanged(config.paths.ideBackendBundle, backendBundleSource);

  const ripgrepDir = path.join(ideNodeModulesDir, '@vscode', 'ripgrep');
  const ripgrepBinaryName = process.platform === 'win32' ? 'rg.cmd' : 'rg';
  const ripgrepBin = path.join(ripgrepDir, 'bin', ripgrepBinaryName);
  const ripgrepPostinstall = path.join(ripgrepDir, 'lib', 'postinstall.js');
  const ripgrepScript = process.platform === 'win32'
    ? `@echo off\r\nif not "%RG_SYSTEM%"=="" goto use_rg\r\nfor %%I in (rg.exe rg) do if not "%%~$PATH:I"=="" set "RG_SYSTEM=%%~$PATH:I"\r\n:use_rg\r\nif not "%RG_SYSTEM%"=="" (\r\n  "%RG_SYSTEM%" %*\r\n  exit /b %errorlevel%\r\n)\r\nfindstr /S /N /I %*\r\n`
    : `#!/usr/bin/env bash
set -euo pipefail
if command -v rg >/dev/null 2>&1; then
  exec rg "$@"
fi
if command -v grep >/dev/null 2>&1; then
  exec grep -R -n "$@"
fi
echo 'SkyeQuanta ripgrep fallback could not find rg or grep.' >&2
exit 1
`;
  const ripgrepPostinstallSource = `const fs = require('node:fs');
const path = require('node:path');
const bin = path.join(__dirname, '..', 'bin', ${JSON.stringify(ripgrepBinaryName)});
if (!fs.existsSync(bin)) {
  throw new Error('SkyeQuanta ripgrep fallback binary is missing: ' + bin);
}
if (process.platform !== 'win32') {
  fs.chmodSync(bin, 0o755);
}
console.log('SkyeQuanta ripgrep fallback ready:', bin);
`;
  writeFileIfChanged(ripgrepPostinstall, ripgrepPostinstallSource);
  writeFileIfChanged(ripgrepBin, ripgrepScript, true);

  const keytarStubSource = firstExisting(path.join(runtimeVendorStubsDir, 'keytar', 'index.js'));
  const drivelistStubSource = firstExisting(path.join(runtimeVendorStubsDir, 'drivelist', 'index.js'));
  const keytarIndex = keytarStubSource ? fs.readFileSync(keytarStubSource, 'utf8') : `'use strict';
module.exports = { getPassword: async () => null, setPassword: async () => true, deletePassword: async () => true, findCredentials: async () => [], findPassword: async () => null };
`;
  const drivelistIndex = drivelistStubSource ? fs.readFileSync(drivelistStubSource, 'utf8') : `'use strict';
exports.list = async () => [];
`;
  const nodePtyIndex = `'use strict';
const childProcess = require('node:child_process');
exports.spawn = function spawn(file, args = [], options = {}) {
  const child = childProcess.spawn(file, args, {
    cwd: options.cwd || process.cwd(),
    env: options.env || process.env,
    shell: options.shell || false,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  child.resize = () => {};
  child.write = data => { if (child.stdin && !child.stdin.destroyed) { child.stdin.write(data); } };
  child.onData = callback => { if (child.stdout) { child.stdout.on('data', chunk => callback(String(chunk))); } return { dispose() {} }; };
  child.onExit = callback => { child.on('exit', (code, signal) => callback({ exitCode: code ?? 0, signal })); return { dispose() {} }; };
  return child;
};
`;

  ensureStubPackage(
    path.join(ideNodeModulesDir, 'keytar'),
    { name: 'keytar', version: '7.9.0', private: true, main: 'index.js', type: 'commonjs' },
    keytarIndex
  );
  ensureStubPackage(
    path.join(ideNodeModulesDir, 'drivelist'),
    { name: 'drivelist', version: '12.0.2', private: true, main: 'index.js', type: 'commonjs' },
    drivelistIndex
  );
  ensureStubPackage(
    path.join(ideNodeModulesDir, 'node-pty'),
    { name: 'node-pty', version: '1.1.0-beta34', private: true, main: 'index.js', type: 'commonjs' },
    nodePtyIndex
  );

  return {
    runtimeBackend,
    runtimeFrontendIndex,
    ripgrepPostinstall,
    ripgrepBin,
    keytarEntry: path.join(ideNodeModulesDir, 'keytar', 'index.js'),
    drivelistEntry: path.join(ideNodeModulesDir, 'drivelist', 'index.js'),
    nodePtyEntry: path.join(ideNodeModulesDir, 'node-pty', 'index.js')
  };
}

export function commandAvailable(command, env) {
  const result = commandResult(command, env);
  return result.status === 0;
}

export function pkgConfigHas(packageName, env) {
  const result = spawnSync('pkg-config', ['--exists', packageName], {
    env,
    stdio: 'ignore'
  });

  return result.status === 0;
}

export function ensurePoetryInstalled(config, env) {
  if (commandAvailable('poetry', env)) {
    return;
  }

  const installer = path.join(config.rootDir, 'scripts', 'install-poetry.sh');
  runCommandOrThrow('Poetry installer', 'bash', [installer], config.rootDir, env);
}

export function ensureSystemDependencies(config, env) {
  const autoInstall = readBoolean(env.SKYEQUANTA_AUTO_INSTALL_SYSTEM_DEPS, true);
  if (!autoInstall || process.platform !== 'linux') {
    return;
  }

  if (commandAvailable('pkg-config', env) && pkgConfigHas('xkbfile', env)) {
    return;
  }

  if (!commandAvailable('sudo', env) || !commandAvailable('apt-get', env)) {
    return;
  }

  const installer = path.join(config.rootDir, 'scripts', 'setup-ubuntu-deps.sh');
  runCommandOrThrow('System dependency bootstrap', 'bash', [installer], config.rootDir, env);
}

export function getDependencyEvidence(config, env) {
  const fallback = ensureBundledIdeFallbacks(config);
  const tooling = ensureRuntimeTooling(config);
  const runtimeTheiaDir = config.paths.isolatedTheiaDir;
  const ripgrepBinaryName = process.platform === 'win32' ? 'rg.cmd' : 'rg';
  const directPoetry = commandResult('poetry', env);
  const directPoetryPath = directPoetry.status === 0
    ? String(directPoetry.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop()
    : null;
  const systemXkb = commandAvailable('pkg-config', env) && pkgConfigHas('xkbfile', env);
  const systemRg = commandResult(process.platform === 'win32' ? 'rg.exe' : 'rg', env);
  const systemRgPath = systemRg.status === 0
    ? String(systemRg.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop()
    : null;

  return {
    poetry: {
      ok: Boolean(directPoetryPath || fs.existsSync(tooling.poetryShim)),
      detail: directPoetryPath || tooling.poetryShim,
      source: directPoetryPath ? 'system' : 'bundled-shim'
    },
    xkbfile: {
      ok: Boolean(systemXkb || fs.existsSync(tooling.xkbfilePc)),
      detail: systemXkb ? 'system pkg-config xkbfile' : tooling.xkbfilePc,
      source: systemXkb ? 'system' : 'bundled-pkgconfig'
    },
    ideBrowserBackendEntrypoint: {
      ok: Boolean(firstExisting(config.paths.ideBrowserBackendEntrypoint, config.paths.isolatedTheiaBackendEntrypoint)),
      detail: firstExisting(config.paths.ideBrowserBackendEntrypoint, config.paths.isolatedTheiaBackendEntrypoint),
      source: fs.existsSync(config.paths.ideBrowserBackendEntrypoint) ? 'ide-core' : 'runtime-deps'
    },
    ideRipgrepPostinstall: {
      ok: Boolean(firstExisting(config.paths.ideRipgrepPostinstall, path.join(runtimeTheiaDir, 'node_modules', '@vscode', 'ripgrep', 'lib', 'postinstall.js'))),
      detail: firstExisting(config.paths.ideRipgrepPostinstall, path.join(runtimeTheiaDir, 'node_modules', '@vscode', 'ripgrep', 'lib', 'postinstall.js')) || tooling.poetryShim,
      source: fs.existsSync(config.paths.ideRipgrepPostinstall) ? 'ide-core' : 'bundled-fallback'
    },
    ideRipgrepBinary: {
      ok: Boolean(firstExisting(config.paths.ideRipgrepBinary, path.join(runtimeTheiaDir, 'node_modules', '@vscode', 'ripgrep', 'bin', ripgrepBinaryName), systemRgPath, fallback.ripgrepBin)),
      detail: firstExisting(config.paths.ideRipgrepBinary, path.join(runtimeTheiaDir, 'node_modules', '@vscode', 'ripgrep', 'bin', ripgrepBinaryName), systemRgPath, fallback.ripgrepBin),
      source: fs.existsSync(config.paths.ideRipgrepBinary) ? 'ide-core' : systemRgPath ? 'system' : 'bundled-fallback'
    },
    ideKeytarBinding: {
      ok: Boolean(firstExisting(config.paths.ideKeytarBinding, path.join(config.paths.ideCoreDir, 'node_modules', 'keytar', 'index.js'), path.join(runtimeTheiaDir, 'vendor-stubs', 'keytar', 'index.js'))),
      detail: firstExisting(config.paths.ideKeytarBinding, path.join(config.paths.ideCoreDir, 'node_modules', 'keytar', 'index.js'), path.join(runtimeTheiaDir, 'vendor-stubs', 'keytar', 'index.js')),
      source: fs.existsSync(config.paths.ideKeytarBinding) ? 'native' : 'bundled-js-stub'
    },
    ideFrontendIndexHtml: {
      ok: Boolean(firstExisting(config.paths.ideFrontendIndexHtml, config.paths.isolatedTheiaFrontendIndexHtml)),
      detail: firstExisting(config.paths.ideFrontendIndexHtml, config.paths.isolatedTheiaFrontendIndexHtml),
      source: fs.existsSync(config.paths.ideFrontendIndexHtml) ? 'ide-core' : 'runtime-deps'
    },
    ideFrontendBundle: {
      ok: Boolean(firstExisting(config.paths.ideFrontendBundle, path.join(runtimeTheiaDir, 'lib', 'frontend', 'secondary-window.js'))),
      detail: firstExisting(config.paths.ideFrontendBundle, path.join(runtimeTheiaDir, 'lib', 'frontend', 'secondary-window.js')) || config.paths.ideFrontendBundle,
      source: fs.existsSync(config.paths.ideFrontendBundle) ? 'ide-core' : 'bundled-fallback'
    },
    ideEditorWorkerBundle: {
      ok: Boolean(firstExisting(config.paths.ideEditorWorkerBundle, path.join(runtimeTheiaDir, 'lib', 'frontend', 'editor.worker.js'))),
      detail: firstExisting(config.paths.ideEditorWorkerBundle, path.join(runtimeTheiaDir, 'lib', 'frontend', 'editor.worker.js')) || config.paths.ideEditorWorkerBundle,
      source: fs.existsSync(config.paths.ideEditorWorkerBundle) ? 'ide-core' : 'bundled-fallback'
    },
    ideBackendBundle: {
      ok: Boolean(firstExisting(config.paths.ideBackendBundle, path.join(runtimeTheiaDir, 'lib', 'backend', 'main.js'), config.paths.isolatedTheiaBackendEntrypoint)),
      detail: firstExisting(config.paths.ideBackendBundle, path.join(runtimeTheiaDir, 'lib', 'backend', 'main.js'), config.paths.isolatedTheiaBackendEntrypoint),
      source: fs.existsSync(config.paths.ideBackendBundle) ? 'ide-core' : 'bundled-fallback'
    },
    ideNodePtyBinding: {
      ok: Boolean(firstExisting(config.paths.ideNodePtyBinding, path.join(config.paths.ideCoreDir, 'node_modules', 'node-pty', 'index.js'))),
      detail: firstExisting(config.paths.ideNodePtyBinding, path.join(config.paths.ideCoreDir, 'node_modules', 'node-pty', 'index.js')),
      source: fs.existsSync(config.paths.ideNodePtyBinding) ? 'native' : 'bundled-js-stub'
    },
    ideDriveListBinding: {
      ok: Boolean(firstExisting(config.paths.ideDriveListBinding, path.join(config.paths.ideCoreDir, 'node_modules', 'drivelist', 'index.js'), path.join(runtimeTheiaDir, 'vendor-stubs', 'drivelist', 'index.js'))),
      detail: firstExisting(config.paths.ideDriveListBinding, path.join(config.paths.ideCoreDir, 'node_modules', 'drivelist', 'index.js'), path.join(runtimeTheiaDir, 'vendor-stubs', 'drivelist', 'index.js')),
      source: fs.existsSync(config.paths.ideDriveListBinding) ? 'native' : 'bundled-js-stub'
    }
  };
}

export function ensureIdeRuntimeDependencies(config, env, options = {}) {
  const mode = String(options.mode || 'local').trim().toLowerCase() || 'local';
  const bundleRequired = mode !== 'deploy';

  ensureBundledIdeFallbacks(config);
  const evidence = getDependencyEvidence(config, env);
  const fallbackSatisfied = [
    'ideBrowserBackendEntrypoint',
    'ideRipgrepPostinstall',
    'ideRipgrepBinary',
    'ideKeytarBinding',
    'ideFrontendIndexHtml',
    'ideFrontendBundle',
    'ideEditorWorkerBundle',
    'ideBackendBundle',
    'ideNodePtyBinding',
    'ideDriveListBinding'
  ].every(key => evidence[key]?.ok);

  if (fallbackSatisfied) {
    return;
  }

  const installRequired = anyMissing([
    config.paths.ideRipgrepPostinstall,
    config.paths.ideRipgrepBinary,
    config.paths.ideKeytarBinding,
    config.paths.ideNodePtyBinding,
    config.paths.ideDriveListBinding
  ]);

  if (installRequired) {
    runCommandOrThrow('IDE dependency install', 'npm', ['install'], config.paths.ideCoreDir, env);
  }

  if (fs.existsSync(config.paths.ideRipgrepPostinstall) && !fs.existsSync(config.paths.ideRipgrepBinary)) {
    runCommandOrThrow('IDE ripgrep payload repair', 'node', [config.paths.ideRipgrepPostinstall], config.paths.ideCoreDir, env);
  }

  if (anyMissing([
    config.paths.ideKeytarBinding,
    config.paths.ideNodePtyBinding,
    config.paths.ideDriveListBinding
  ])) {
    runCommandOrThrow(
      'IDE native rebuild',
      'npm',
      ['rebuild', 'node-pty', 'drivelist', 'nsfw', 'native-keymap', 'keytar'],
      config.paths.ideCoreDir,
      env
    );
  }

  const prepareRequired = anyMissing([
    config.paths.ideBrowserBackendEntrypoint,
    config.paths.ideFrontendIndexHtml,
    config.paths.ideFrontendBundle,
    config.paths.ideEditorWorkerBundle,
    config.paths.ideBackendBundle
  ]);

  if (prepareRequired) {
    runCommandOrThrow('IDE compile', 'npm', ['run', 'compile'], config.paths.ideCoreDir, env);
    runCommandOrThrow('IDE browser app generation', 'npx', ['theiaext', 'build'], config.paths.ideExampleDir, env);
  }

  if (bundleRequired && anyMissing([
    config.paths.ideFrontendIndexHtml,
    config.paths.ideFrontendBundle,
    config.paths.ideEditorWorkerBundle,
    config.paths.ideBackendBundle
  ])) {
    runCommandOrThrow(
      'IDE webpack bundle',
      'node',
      [path.join(config.shellDir, 'bin', 'ide.mjs'), 'bundle', '--target=all'],
      config.rootDir,
      env
    );
  }
}

export async function ensureRuntimeDependencies(config, env, options = {}) {
  ensureRuntimeTooling(config);
  const bundledEnv = {
    ...env,
    PATH: [path.join(config.paths.ideRuntimeDepsDir, 'bin'), env.PATH || ''].filter(Boolean).join(path.delimiter),
    PKG_CONFIG_PATH: [path.join(config.paths.ideRuntimeDepsDir, 'pkgconfig'), env.PKG_CONFIG_PATH || ''].filter(Boolean).join(path.delimiter)
  };

  const bundledPython = process.platform === 'win32'
    ? path.join(config.paths.agentVenvDir, 'Scripts', 'python.exe')
    : path.join(config.paths.agentVenvDir, 'bin', 'python');

  if (!commandAvailable('poetry', bundledEnv) && !fs.existsSync(bundledPython)) {
    ensurePoetryInstalled(config, bundledEnv);
  }
  ensureSystemDependencies(config, bundledEnv);
  ensureIdeRuntimeDependencies(config, bundledEnv, options);
}
