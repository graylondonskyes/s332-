import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { detectAppArmorPolicySupport, prepareAppArmorExecutionPolicy } from './apparmor-policy.mjs';
import { buildRuntimeSandboxLaunch } from './runtime-sandbox.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function parseLastJson(stdout) {
  const lines = String(stdout || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]);
    } catch {}
  }
  return null;
}

export function runAppArmorCapabilityGate(rootDir, options = {}) {
  const workspaceDir = path.resolve(options.workspaceDir || path.join(rootDir, 'dist', 'section45', 'apparmor-workspace'));
  const forbiddenDir = path.resolve(options.forbiddenDir || path.join(rootDir, 'dist', 'section45', 'apparmor-forbidden'));
  ensureDirectory(workspaceDir);
  ensureDirectory(forbiddenDir);
  const allowedFile = path.join(workspaceDir, 'allowed.txt');
  const forbiddenFile = path.join(forbiddenDir, 'forbidden.txt');
  fs.writeFileSync(allowedFile, 'section45-allowed\n', 'utf8');
  fs.writeFileSync(forbiddenFile, 'section45-forbidden\n', 'utf8');
  const env = {
    ...process.env,
    ...(options.env || {}),
    SKYEQUANTA_RUNTIME_SANDBOX_MODE: 'process',
    SKYEQUANTA_RUNTIME_LIMITS_ENABLED: '0',
    SKYEQUANTA_RUNTIME_APPARMOR_PROFILE: 'strict',
    SKYEQUANTA_RUNTIME_APPARMOR_STRICT: '0'
  };
  const support = detectAppArmorPolicySupport(env);
  const policy = prepareAppArmorExecutionPolicy(rootDir, {
    env,
    workspaceId: options.workspaceId || 'section45',
    label: options.label || 'apparmor-live-proof',
    workspaceDir,
    requestedProfile: env.SKYEQUANTA_RUNTIME_APPARMOR_PROFILE,
    strict: false
  });
  const capability = {
    support,
    policy: {
      enabled: policy.enabled,
      active: policy.active,
      reason: policy.reason,
      profileName: policy.profileName,
      load: policy.load || null,
      bundle: policy.bundle ? {
        profileFile: policy.bundle.profileFile,
        compiledFile: policy.bundle.compiledFile,
        metadataFile: policy.bundle.metadataFile
      } : null
    },
    workspaceDir,
    forbiddenFile
  };
  if (!policy.active) {
    return {
      ok: true,
      mode: 'capability-gate',
      capability,
      enforcement: null,
      note: 'Host is not AppArmor-capable for live enforcement; lane now fails closed with explicit reason.'
    };
  }
  const script = [
    "import fs from 'node:fs';",
    'const payload = {};',
    'payload.current = fs.readFileSync(\'/proc/self/attr/current\', \'utf8\').trim();',
    'payload.allowed = fs.readFileSync(process.env.SECTION45_ALLOWED_FILE, \'utf8\').trim();',
    'try {',
    '  fs.readFileSync(process.env.SECTION45_FORBIDDEN_FILE, \'utf8\');',
    '  payload.forbiddenRead = \"unexpected-success\";',
    '} catch (error) {',
    '  payload.forbiddenRead = error && (error.code || error.message) || \"blocked\";',
    '}',
    'console.log(JSON.stringify(payload));'
  ].join('\n');
  const launch = buildRuntimeSandboxLaunch('node', ['--input-type=module', '-e', script], {
    env: { ...env, SECTION45_ALLOWED_FILE: allowedFile, SECTION45_FORBIDDEN_FILE: forbiddenFile, SKYEQUANTA_RUNTIME_APPARMOR_STRICT: '1' },
    rootDir,
    cwd: workspaceDir,
    workspaceId: options.workspaceId || 'section45',
    label: options.label || 'apparmor-live-proof'
  });
  const result = spawnSync(launch.command, launch.args, {
    cwd: launch.cwd,
    env: { ...env, ...(launch.envAdditions || {}), SECTION45_ALLOWED_FILE: allowedFile, SECTION45_FORBIDDEN_FILE: forbiddenFile, SKYEQUANTA_RUNTIME_APPARMOR_STRICT: '1' },
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024
  });
  const payload = parseLastJson(result.stdout);
  const current = String(payload?.current || '');
  const forbiddenBlocked = String(payload?.forbiddenRead || '').toUpperCase() !== 'UNEXPECTED-SUCCESS';
  return {
    ok: result.status === 0 && Boolean(launch.appArmor?.active) && current.includes(launch.appArmor.profileName) && payload?.allowed === 'section45-allowed' && forbiddenBlocked,
    mode: 'live-enforcement',
    capability,
    enforcement: {
      launch: { command: launch.command, args: launch.args, appArmor: launch.appArmor },
      result: { status: result.status, signal: result.signal, stdout: String(result.stdout || ''), stderr: String(result.stderr || '') },
      payload,
      current,
      forbiddenBlocked
    }
  };
}
