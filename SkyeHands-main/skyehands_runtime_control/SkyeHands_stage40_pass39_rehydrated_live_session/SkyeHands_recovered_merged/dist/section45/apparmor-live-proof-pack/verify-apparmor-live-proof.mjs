#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

function readJson(filePath, fallback = null) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}
function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}
function resolveBinary(command) {
  const result = spawnSync('bash', ['-lc', 'command -v ' + command + ' || true'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const value = String(result.stdout || '').trim().split(/\r?\n/).filter(Boolean)[0] || null;
  return value && fs.existsSync(value) ? value : null;
}
function detectSupport() {
  const isLinux = process.platform === 'linux';
  let kernelEnabled = false;
  for (const candidate of ['/sys/module/apparmor/parameters/enabled', '/sys/kernel/security/apparmor/enabled']) {
    try {
      const value = fs.readFileSync(candidate, 'utf8').trim();
      if (value === 'Y' || value.toLowerCase().startsWith('yes')) kernelEnabled = true;
    } catch {}
  }
  if (!kernelEnabled) {
    try { kernelEnabled = fs.existsSync('/sys/kernel/security/apparmor/profiles'); } catch {}
  }
  return {
    isLinux,
    kernelEnabled,
    aaExec: isLinux ? resolveBinary('aa-exec') : null,
    parser: isLinux ? resolveBinary('apparmor_parser') : null,
    node: resolveBinary('node')
  };
}
function loadManifest(packDir) {
  return readJson(path.join(packDir, 'APPARMOR_LIVE_PROOF_PACK.json'), null);
}
function verifyPack(packDir) {
  const manifest = loadManifest(packDir);
  if (!manifest) return { ok: false, reason: 'manifest_missing', packDir };
  const files = [];
  for (const entry of manifest.files || []) {
    const filePath = path.join(packDir, entry.relativePath);
    const exists = fs.existsSync(filePath);
    files.push({ relativePath: entry.relativePath, exists, sha256: exists ? sha256File(filePath) : null, expectedSha256: entry.sha256 });
  }
  const missing = files.filter(item => !item.exists).map(item => item.relativePath);
  const mismatched = files.filter(item => item.exists && item.sha256 !== item.expectedSha256).map(item => item.relativePath);
  return { ok: missing.length === 0 && mismatched.length === 0, reason: missing.length ? 'missing_files' : (mismatched.length ? 'hash_mismatch' : 'verified'), manifest, files, missing, mismatched, support: detectSupport() };
}
function executeLive(packDir, manifest, support) {
  if (!(support.isLinux && support.kernelEnabled && support.aaExec && support.parser && support.node)) {
    return { ok: false, reason: !support.isLinux ? 'not_linux' : (!support.kernelEnabled ? 'kernel_disabled' : (!support.aaExec ? 'aa_exec_unavailable' : (!support.parser ? 'parser_unavailable' : 'node_unavailable'))), support };
  }
  const runtimeDir = path.join(packDir, 'runtime');
  fs.mkdirSync(runtimeDir, { recursive: true });
  const workspaceDir = path.join(runtimeDir, 'workspace');
  const forbiddenDir = path.join(runtimeDir, 'forbidden');
  fs.mkdirSync(workspaceDir, { recursive: true });
  fs.mkdirSync(forbiddenDir, { recursive: true });
  const allowedFile = path.join(workspaceDir, 'allowed.txt');
  const forbiddenFile = path.join(forbiddenDir, 'forbidden.txt');
  fs.writeFileSync(allowedFile, 'section45-allowed\n', 'utf8');
  fs.writeFileSync(forbiddenFile, 'section45-forbidden\n', 'utf8');
  const profileFile = path.join(packDir, manifest.profileFileRelativePath || 'policy/profile.apparmor');
  const parser = spawnSync(support.parser, ['-r', profileFile], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const script = [
    "import fs from 'node:fs';",
    "const payload = {};",
    "payload.current = fs.readFileSync('/proc/self/attr/current', 'utf8').trim();",
    "payload.allowed = fs.readFileSync(process.env.SECTION45_ALLOWED_FILE, 'utf8').trim();",
    "try { fs.readFileSync(process.env.SECTION45_FORBIDDEN_FILE, 'utf8'); payload.forbiddenRead = 'unexpected-success'; } catch (error) { payload.forbiddenRead = error && (error.code || error.message) || 'blocked'; }",
    "console.log(JSON.stringify(payload));"
  ].join('\n');
  const result = spawnSync(support.aaExec, ['-p', manifest.profileName, '--', support.node, '--input-type=module', '-e', script], {
    cwd: workspaceDir,
    env: { ...process.env, SECTION45_ALLOWED_FILE: allowedFile, SECTION45_FORBIDDEN_FILE: forbiddenFile },
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024
  });
  let payload = null;
  const lines = String(result.stdout || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try { payload = JSON.parse(lines[index]); break; } catch {}
  }
  const forbiddenBlocked = String(payload?.forbiddenRead || '').toUpperCase() !== 'UNEXPECTED-SUCCESS';
  return {
    ok: parser.status === 0 && result.status === 0 && Boolean(payload?.current) && String(payload.current).includes(manifest.profileName) && payload?.allowed === 'section45-allowed' && forbiddenBlocked,
    reason: parser.status === 0 && result.status === 0 ? 'executed' : 'execution_failed',
    parser: { status: parser.status, stdout: String(parser.stdout || ''), stderr: String(parser.stderr || '') },
    result: { status: result.status, stdout: String(result.stdout || ''), stderr: String(result.stderr || '') },
    payload,
    forbiddenBlocked,
    support
  };
}
const packDir = process.cwd();
const verify = verifyPack(packDir);
const execute = process.argv.includes('--execute');
const payload = { generatedAt: new Date().toISOString(), verify, live: null, pass: verify.ok };
if (execute) {
  payload.live = executeLive(packDir, verify.manifest || {}, verify.support || detectSupport());
  payload.pass = verify.ok && payload.live.ok;
}
console.log(JSON.stringify(payload, null, 2));
process.exit(payload.pass ? 0 : 1);
