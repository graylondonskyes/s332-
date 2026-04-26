import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getStackConfig } from './config.mjs';

function ensureDir(dirPath) { fs.mkdirSync(dirPath, { recursive: true }); }
function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: 'utf8', ...options });
}
function findPython(venvDir) {
  return process.platform === 'win32' ? path.join(venvDir, 'Scripts', 'python.exe') : path.join(venvDir, 'bin', 'python');
}

const config = getStackConfig();
const depsRoot = path.join(config.rootDir, '.skyequanta', 'runtime-deps');
const proofDir = path.join(config.rootDir, 'docs', 'proof');
ensureDir(depsRoot);
ensureDir(proofDir);

const ideInstall = run('npm', ['install', '--no-fund', '--no-audit'], {
  cwd: config.paths.ideCoreDir,
  env: { ...process.env, PUPPETEER_SKIP_DOWNLOAD: '1', PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' }
});

const agentVenv = path.join(depsRoot, 'agent-venv');
if (!fs.existsSync(findPython(agentVenv))) {
  run('python3', ['-m', 'venv', agentVenv], { cwd: config.rootDir });
}
const agentPython = findPython(agentVenv);
const agentInstall = run(agentPython, ['-m', 'pip', 'install', 'fastapi', 'uvicorn', 'orjson', 'pydantic', 'python-multipart'], { cwd: config.rootDir });

const report = {
  proof: 'stage-2-dependency-lanes',
  generatedAt: new Date().toISOString(),
  ide: {
    command: 'npm install --no-fund --no-audit',
    cwd: config.paths.ideCoreDir,
    status: ideInstall.status,
    stdoutTail: String(ideInstall.stdout || '').split(/\r?\n/).filter(Boolean).slice(-40),
    stderrTail: String(ideInstall.stderr || '').split(/\r?\n/).filter(Boolean).slice(-40),
    nodeModulesPresent: fs.existsSync(path.join(config.paths.ideCoreDir, 'node_modules'))
  },
  agent: {
    venv: agentVenv,
    python: agentPython,
    status: agentInstall.status,
    stdoutTail: String(agentInstall.stdout || '').split(/\r?\n/).filter(Boolean).slice(-40),
    stderrTail: String(agentInstall.stderr || '').split(/\r?\n/).filter(Boolean).slice(-40),
    foundationPackagesInstalled: agentInstall.status === 0
  }
};

const outFile = path.join(proofDir, 'STAGE_2_DEPENDENCY_LANES.json');
fs.writeFileSync(outFile, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ ok: ideInstall.status === 0 && agentInstall.status === 0, outFile }, null, 2));
