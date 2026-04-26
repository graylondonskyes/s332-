#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

function readArg(argv, name, fallback = null) {
  const index = argv.indexOf(name);
  return index === -1 ? fallback : (argv[index + 1] ?? fallback);
}
function hasArg(argv, name) { return argv.includes(name); }
function readJson(filePath) { try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; } }
function proofPass(payload) { return Boolean(payload?.pass ?? payload?.passed ?? payload?.ok); }
function tailLines(text, count = 20) { return String(text || '').split(/\r?\n/).filter(Boolean).slice(-count); }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function main() {
  const argv = process.argv.slice(2);
  const script = readArg(argv, '--script');
  const artifact = readArg(argv, '--artifact');
  const timeoutMs = Number.parseInt(readArg(argv, '--timeout-ms', '180000'), 10) || 180000;
  const graceMs = Number.parseInt(readArg(argv, '--grace-ms', '2000'), 10) || 2000;
  if (!script || !artifact) {
    console.error('Missing required --script and --artifact arguments.');
    process.exit(2);
  }
  const cwd = process.cwd();
  const scriptPath = path.resolve(cwd, script);
  const artifactPath = path.resolve(cwd, artifact);
  const strict = hasArg(argv, '--strict');
  const passthrough = [];
  const extraIndex = argv.indexOf('--');
  if (extraIndex !== -1) passthrough.push(...argv.slice(extraIndex + 1));

  const artifactBefore = fs.existsSync(artifactPath) ? fs.statSync(artifactPath).mtimeMs : 0;
  const startedAt = Date.now();
  let stdout = '';
  let stderr = '';
  const child = spawn(process.execPath, [scriptPath, ...(strict ? ['--strict'] : []), ...passthrough], {
    cwd,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', chunk => { stdout += String(chunk); });
  child.stderr.on('data', chunk => { stderr += String(chunk); });

  let artifactPayload = null;
  let artifactReady = false;
  while (Date.now() - startedAt < timeoutMs) {
    if (fs.existsSync(artifactPath)) {
      const stat = fs.statSync(artifactPath);
      artifactPayload = readJson(artifactPath);
      const artifactFresh = artifactBefore > 0 ? stat.mtimeMs > artifactBefore + 1 : stat.mtimeMs >= startedAt - 1000;
      artifactReady = artifactFresh && proofPass(artifactPayload);
      if (artifactReady && child.exitCode === null) {
        child.kill('SIGTERM');
        await sleep(graceMs);
        if (child.exitCode === null) child.kill('SIGKILL');
        break;
      }
    }
    if (child.exitCode !== null) break;
    await sleep(250);
  }
  if (child.exitCode === null) {
    child.kill('SIGTERM');
    await sleep(graceMs);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
  await new Promise(resolve => child.once('close', resolve));
  artifactPayload = readJson(artifactPath);
  const pass = proofPass(artifactPayload);
  console.log(JSON.stringify({
    ok: pass,
    script: path.relative(cwd, scriptPath),
    artifact: path.relative(cwd, artifactPath),
    exitCode: child.exitCode,
    signalCode: child.signalCode,
    artifactReady,
    artifactPass: pass,
    artifactGeneratedAt: artifactPayload?.generatedAt || null,
    stdoutTail: tailLines(stdout),
    stderrTail: tailLines(stderr)
  }, null, 2));
  process.exit(pass ? 0 : 1);
}
main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
