import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getStackConfig } from './config.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function summarize(result) {
  return {
    ok: result.status === 0,
    status: result.status,
    signal: result.signal,
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim()
  };
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    ...options
  });
}

function firstExisting(paths) {
  for (const candidate of paths) {
    if (candidate && fs.existsSync(candidate)) {
      return path.resolve(candidate);
    }
  }
  return null;
}

const config = getStackConfig();
const runtimeDepsDir = config.paths.ideRuntimeDepsDir;
const outFile = path.join(config.rootDir, 'docs', 'proof', 'STAGE_2_DEPENDENCY_LANES.json');
const theiaCandidates = [
  process.env.SKYEQUANTA_THEIA_CLI || null,
  config.paths.isolatedTheiaCli,
  path.join(config.paths.ideExampleDir, 'node_modules', '.bin', process.platform === 'win32' ? 'theia.cmd' : 'theia'),
  path.join(config.paths.ideCoreDir, 'node_modules', '.bin', process.platform === 'win32' ? 'theia.cmd' : 'theia')
].filter(Boolean);
const resolvedTheiaCli = firstExisting(theiaCandidates);
const theiaBackendCandidates = [
  config.paths.isolatedTheiaBackendEntrypoint,
  config.paths.ideBrowserBackendEntrypoint,
  config.paths.ideBackendBundle
].filter(Boolean);
const resolvedTheiaBackend = firstExisting(theiaBackendCandidates);
const venvPython = process.platform === 'win32'
  ? path.join(runtimeDepsDir, 'agent-venv', 'Scripts', 'python.exe')
  : path.join(runtimeDepsDir, 'agent-venv', 'bin', 'python');
const pythonCommand = fs.existsSync(venvPython) ? venvPython : (process.env.SKYEQUANTA_PYTHON_COMMAND || 'python3');
const agentEnv = {
  ...process.env,
  PYTHONPATH: [config.paths.agentCoreDir, config.paths.agentServerAppDir, process.env.PYTHONPATH || ''].filter(Boolean).join(path.delimiter),
  OPENHANDS_SUPPRESS_BANNER: '1'
};
const routerImport = summarize(run(pythonCommand, ['-c', [
  'import sys',
  `sys.path.insert(0, ${JSON.stringify(config.paths.agentCoreDir)})`,
  `sys.path.insert(0, ${JSON.stringify(config.paths.agentServerAppDir)})`,
  'from openhands.app_server.v1_router import router',
  'assert router is not None',
  'print("ok")'
].join('; ')], { env: agentEnv }));
const resolvedTheiaFrontend = firstExisting([config.paths.isolatedTheiaFrontendIndexHtml, path.join(config.paths.ideExampleDir, 'lib', 'frontend', 'index.html')]);
const report = {
  proof: 'stage-2-dependency-lanes',
  generatedAt: new Date().toISOString(),
  theia: {
    candidates: theiaCandidates,
    resolvedCli: resolvedTheiaCli,
    backendCandidates: theiaBackendCandidates,
    resolvedBackend: resolvedTheiaBackend,
    resolvedFrontend: resolvedTheiaFrontend,
    fullTheiaRuntime: Boolean(resolvedTheiaCli && resolvedTheiaBackend && resolvedTheiaFrontend),
    installCommands: [
      'node apps/skyequanta-shell/bin/repair-stage2b.mjs --install-theia --build-theia'
    ]
  },
  openHands: {
    pythonCommand,
    fullOpenHandsRuntime: Boolean(routerImport.ok),
    routerImport,
    installCommands: [
      'node apps/skyequanta-shell/bin/repair-stage2b.mjs --install-openhands'
    ]
  }
};
ensureDirectory(path.dirname(outFile));
fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}
`, 'utf8');
console.log(JSON.stringify({ ok: true, outFile, theia: report.theia.fullTheiaRuntime, openHands: report.openHands.fullOpenHandsRuntime }, null, 2));
