import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

import { detectAppArmorPolicySupport, prepareAppArmorExecutionPolicy } from './apparmor-policy.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeText(filePath, value) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, String(value), 'utf8');
  return filePath;
}

function writeJson(filePath, payload) {
  return writeText(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function shellQuote(value) {
  const stringValue = String(value ?? '');
  if (!stringValue) return "''";
  if (/^[A-Za-z0-9_./:=+\-]+$/.test(stringValue)) return stringValue;
  return `'${stringValue.replace(/'/g, `'\\''`)}'`;
}

function buildStandaloneVerifierSource() {
  return `#!/usr/bin/env node
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
  const value = String(result.stdout || '').trim().split(/\\r?\\n/).filter(Boolean)[0] || null;
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
  fs.writeFileSync(allowedFile, 'section45-allowed\\n', 'utf8');
  fs.writeFileSync(forbiddenFile, 'section45-forbidden\\n', 'utf8');
  const profileFile = path.join(packDir, manifest.profileFileRelativePath || 'policy/profile.apparmor');
  const parser = spawnSync(support.parser, ['-r', profileFile], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const script = [
    \"import fs from 'node:fs';\",
    \"const payload = {};\",
    \"payload.current = fs.readFileSync('/proc/self/attr/current', 'utf8').trim();\",
    \"payload.allowed = fs.readFileSync(process.env.SECTION45_ALLOWED_FILE, 'utf8').trim();\",
    \"try { fs.readFileSync(process.env.SECTION45_FORBIDDEN_FILE, 'utf8'); payload.forbiddenRead = 'unexpected-success'; } catch (error) { payload.forbiddenRead = error && (error.code || error.message) || 'blocked'; }\",
    \"console.log(JSON.stringify(payload));\"
  ].join('\\n');
  const result = spawnSync(support.aaExec, ['-p', manifest.profileName, '--', support.node, '--input-type=module', '-e', script], {
    cwd: workspaceDir,
    env: { ...process.env, SECTION45_ALLOWED_FILE: allowedFile, SECTION45_FORBIDDEN_FILE: forbiddenFile },
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024
  });
  let payload = null;
  const lines = String(result.stdout || '').split(/\\r?\\n/).map(line => line.trim()).filter(Boolean);
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
`;
}

function buildRunnerScript() {
  return `#!/usr/bin/env bash
set -euo pipefail
PACK_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PACK_DIR"
node verify-apparmor-live-proof.mjs --execute
`;
}

export function buildAppArmorLiveProofPack(rootDir, options = {}) {
  const workspaceId = String(options.workspaceId || 'section45');
  const label = String(options.label || 'apparmor-live-proof');
  const workspaceDir = path.resolve(options.workspaceDir || path.join(rootDir, 'dist', 'section45', 'apparmor-workspace'));
  const support = detectAppArmorPolicySupport(options.env || process.env);
  const policy = prepareAppArmorExecutionPolicy(rootDir, {
    env: { ...process.env, ...(options.env || {}), SKYEQUANTA_RUNTIME_APPARMOR_PROFILE: 'strict', SKYEQUANTA_RUNTIME_APPARMOR_STRICT: '0' },
    workspaceId,
    label,
    workspaceDir,
    requestedProfile: 'strict',
    strict: false
  });
  const packDir = path.join(rootDir, 'dist', 'section45', 'apparmor-live-proof-pack');
  const policyDir = path.join(packDir, 'policy');
  const runtimeDir = path.join(packDir, 'runtime');
  ensureDirectory(policyDir);
  ensureDirectory(runtimeDir);
  const copied = [];
  const bundleFiles = [
    ['profile.apparmor', policy.bundle?.profileFile],
    ['APPARMOR_PROFILE_METADATA.json', policy.bundle?.metadataFile],
    ['profile.bin', policy.bundle?.compiledFile]
  ].filter(([, source]) => source && fs.existsSync(source));
  for (const [targetName, source] of bundleFiles) {
    const target = path.join(policyDir, targetName);
    fs.copyFileSync(source, target);
    copied.push(target);
  }
  const verifierFile = path.join(packDir, 'verify-apparmor-live-proof.mjs');
  const runnerFile = path.join(packDir, 'run-apparmor-live-proof.sh');
  const readmeFile = path.join(packDir, 'README.md');
  const expectationFile = path.join(packDir, 'APPARMOR_LIVE_PROOF_EXPECTATIONS.json');
  writeText(verifierFile, buildStandaloneVerifierSource());
  writeText(runnerFile, buildRunnerScript());
  fs.chmodSync(verifierFile, 0o755);
  fs.chmodSync(runnerFile, 0o755);
  const expectations = {
    profileName: policy.profileName,
    requires: {
      linux: true,
      kernelEnabled: true,
      aaExec: true,
      parser: true,
      node: true
    },
    assertions: [
      'profile loads through apparmor_parser',
      'aa-exec launches node under the generated profile',
      'allowed workspace file stays readable',
      'forbidden path read is blocked',
      '/proc/self/attr/current includes the generated profile name'
    ]
  };
  writeJson(expectationFile, expectations);
  writeText(readmeFile, `# AppArmor Live Proof Pack\n\nThis pack is generated from the current SkyeHands repo and is meant to be executed on an AppArmor-capable Linux host.\n\nRun:\n\n\`\`\`bash\n./run-apparmor-live-proof.sh\n\`\`\`\n\nOr verify integrity only:\n\n\`\`\`bash\nnode verify-apparmor-live-proof.mjs\n\`\`\`\n`);
  const manifest = {
    generatedAt: new Date().toISOString(),
    workspaceId,
    label,
    profileName: policy.profileName,
    packVersion: 'section45-live-proof-pack-v1',
    profileFileRelativePath: 'policy/profile.apparmor',
    runtimePolicy: {
      enabled: policy.enabled,
      active: policy.active,
      reason: policy.reason,
      strict: policy.strict
    },
    supportSnapshot: support,
    commands: {
      verifyIntegrity: 'node verify-apparmor-live-proof.mjs',
      executeLive: './run-apparmor-live-proof.sh'
    },
    files: []
  };
  const manifestFile = path.join(packDir, 'APPARMOR_LIVE_PROOF_PACK.json');
  const candidateFiles = [
    verifierFile,
    runnerFile,
    readmeFile,
    expectationFile,
    ...copied
  ];
  manifest.files = candidateFiles.map(filePath => ({
    relativePath: normalizePath(path.relative(packDir, filePath)),
    sha256: sha256File(filePath)
  }));
  writeJson(manifestFile, manifest);
  const finalManifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  writeJson(manifestFile, finalManifest);
  const verification = verifyAppArmorLiveProofPack(packDir);
  return {
    ok: verification.ok,
    packDir,
    manifestFile,
    verifierFile,
    runnerFile,
    readmeFile,
    expectationFile,
    manifest: finalManifest,
    policy: {
      enabled: policy.enabled,
      active: policy.active,
      reason: policy.reason,
      profileName: policy.profileName,
      bundle: policy.bundle ? {
        profileFile: policy.bundle.profileFile,
        compiledFile: policy.bundle.compiledFile,
        metadataFile: policy.bundle.metadataFile
      } : null
    },
    support,
    verification
  };
}

export function verifyAppArmorLiveProofPack(packDir) {
  const manifestFile = path.join(packDir, 'APPARMOR_LIVE_PROOF_PACK.json');
  if (!fs.existsSync(manifestFile)) {
    return { ok: false, reason: 'manifest_missing', packDir, missing: ['APPARMOR_LIVE_PROOF_PACK.json'], mismatched: [] };
  }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const missing = [];
  const mismatched = [];
  const files = [];
  for (const entry of manifest.files || []) {
    const filePath = path.join(packDir, entry.relativePath);
    const exists = fs.existsSync(filePath);
    const sha256 = exists ? sha256File(filePath) : null;
    files.push({ relativePath: entry.relativePath, exists, sha256, expectedSha256: entry.sha256 });
    if (!exists) missing.push(entry.relativePath);
    else if (sha256 !== entry.sha256) mismatched.push(entry.relativePath);
  }
  return {
    ok: missing.length === 0 && mismatched.length === 0,
    reason: missing.length ? 'missing_files' : (mismatched.length ? 'hash_mismatch' : 'verified'),
    manifest,
    missing,
    mismatched,
    files
  };
}

export function runAppArmorLiveProofPackVerifier(packDir, options = {}) {
  const verifierFile = path.join(packDir, 'verify-apparmor-live-proof.mjs');
  if (!fs.existsSync(verifierFile)) {
    return { ok: false, reason: 'verifier_missing', verifierFile, status: null, stdout: '', stderr: '' };
  }
  const args = [verifierFile];
  if (options.execute) args.push('--execute');
  const result = spawnSync(process.execPath, args, { cwd: packDir, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  let payload = null;
  try { payload = JSON.parse(String(result.stdout || '{}')); } catch {}
  return {
    ok: result.status === 0 && Boolean(payload?.pass),
    status: result.status,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
    payload
  };
}
