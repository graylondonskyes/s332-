import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function readString(value) {
  return String(value ?? '').trim();
}

function readBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  const normalized = readString(value).toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function shellQuote(value) {
  const stringValue = String(value ?? '');
  if (!stringValue) return "''";
  if (/^[A-Za-z0-9_./:=+\-]+$/.test(stringValue)) return stringValue;
  return `'${stringValue.replace(/'/g, `'\\''`)}'`;
}

function resolveBinary(command) {
  const result = spawnSync('bash', ['-lc', `command -v ${shellQuote(command)} || true`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  });
  const resolved = String(result.stdout || '').trim().split(/\r?\n/).filter(Boolean)[0] || null;
  return resolved && fs.existsSync(resolved) ? resolved : null;
}

function sanitizeSegment(value) {
  return readString(value).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'shared';
}

function normalizePaths(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : [values])
    .map(value => readString(value))
    .filter(Boolean)
    .map(value => path.resolve(value)))).sort();
}

function readKernelEnabled() {
  const candidates = [
    '/sys/module/apparmor/parameters/enabled',
    '/sys/kernel/security/apparmor/enabled'
  ];
  for (const candidate of candidates) {
    try {
      const value = fs.readFileSync(candidate, 'utf8').trim();
      if (value === 'Y' || value.toLowerCase().startsWith('yes')) return true;
    } catch {}
  }
  try {
    return fs.existsSync('/sys/kernel/security/apparmor/profiles');
  } catch {
    return false;
  }
}

function readLoadedProfiles() {
  const candidates = [
    '/sys/kernel/security/apparmor/profiles',
    '/sys/kernel/security/apparmor/policy/profiles'
  ];
  for (const candidate of candidates) {
    try {
      return fs.readFileSync(candidate, 'utf8');
    } catch {}
  }
  return '';
}

export function isAppArmorProfileLoaded(profileName) {
  const target = readString(profileName);
  if (!target) return false;
  return readLoadedProfiles()
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .some(line => line === target || line.startsWith(`${target} `) || line.startsWith(`${target} (`));
}

export function detectAppArmorPolicySupport(env = process.env) {
  const isLinux = process.platform === 'linux';
  const kernelEnabled = isLinux && readKernelEnabled();
  return {
    isLinux,
    kernelEnabled,
    aaExec: isLinux ? resolveBinary(readString(env.SKYEQUANTA_AA_EXEC_BIN) || 'aa-exec') : null,
    parser: isLinux ? resolveBinary(readString(env.SKYEQUANTA_APPARMOR_PARSER_BIN) || 'apparmor_parser') : null,
    profilesFile: isLinux
      ? ['/sys/kernel/security/apparmor/profiles', '/sys/kernel/security/apparmor/policy/profiles'].find(item => fs.existsSync(item)) || null
      : null
  };
}

export function buildAppArmorProfileName(workspaceId, label) {
  return `skyequanta-${sanitizeSegment(workspaceId)}-${sanitizeSegment(label)}`;
}

export function renderAppArmorProfile(options = {}) {
  const profileName = buildAppArmorProfileName(options.workspaceId || 'shared', options.label || 'runtime');
  const workspacePaths = normalizePaths([options.workspaceDir, ...(options.allowedWritePaths || [])]);
  const readPaths = normalizePaths(options.allowedReadPaths || []);
  const readRules = [
    '/usr/bin/** mr,',
    '/usr/local/bin/** mr,',
    '/bin/** mr,',
    '/lib/** mr,',
    '/lib64/** mr,',
    '/etc/ld.so.cache r,',
    ...readPaths.map(item => `${item.replace(/ /g, '\\040')}/** mr,`)
  ];
  const writeRules = workspacePaths.map(item => `${item.replace(/ /g, '\\040')}/** rwk,`);
  return {
    profileName,
    text: [
      'abi <abi/4.0>,',
      'include <tunables/global>',
      '',
      `profile ${profileName} flags=(attach_disconnected,mediate_deleted) {`,
      '  include <abstractions/base>',
      ...readRules.map(line => `  ${line}`),
      ...writeRules.map(line => `  ${line}`),
      '  deny network raw,',
      '  deny network packet,',
      '  deny /proc/*/mem rw,',
      '  deny /sys/** rwklx,',
      '}'
    ].join('\n') + '\n'
  };
}

export function writeAppArmorProfileBundle(rootDir, options = {}) {
  const support = detectAppArmorPolicySupport(options.env || process.env);
  const rendered = renderAppArmorProfile(options);
  const bundleDir = path.join(rootDir, '.skyequanta', 'cache', 'apparmor', rendered.profileName);
  ensureDirectory(bundleDir);
  const profileFile = path.join(bundleDir, `${rendered.profileName}.apparmor`);
  const compiledFile = path.join(bundleDir, `${rendered.profileName}.bin`);
  const metadataFile = path.join(bundleDir, 'APPARMOR_PROFILE_METADATA.json');
  fs.writeFileSync(profileFile, rendered.text, 'utf8');
  let compile = { ok: false, status: null, stderr: '', stdout: '', reason: 'parser_unavailable' };
  if (support.parser) {
    const result = spawnSync(support.parser, ['-Q', '-K', '-o', compiledFile, profileFile], {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024
    });
    compile = {
      ok: result.status === 0 && fs.existsSync(compiledFile),
      status: result.status,
      stderr: String(result.stderr || ''),
      stdout: String(result.stdout || ''),
      reason: result.status === 0 ? 'compiled' : 'compile_failed'
    };
  }
  const metadata = {
    generatedAt: new Date().toISOString(),
    profileName: rendered.profileName,
    workspaceId: sanitizeSegment(options.workspaceId || 'shared'),
    label: sanitizeSegment(options.label || 'runtime'),
    profileFile,
    compiledFile: fs.existsSync(compiledFile) ? compiledFile : null,
    support,
    compile,
    requestedWorkspaceDir: options.workspaceDir ? path.resolve(options.workspaceDir) : null
  };
  fs.writeFileSync(metadataFile, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  return {
    ok: compile.ok,
    bundleDir,
    profileFile,
    compiledFile: metadata.compiledFile,
    metadataFile,
    profileName: rendered.profileName,
    support,
    compile,
    metadata
  };
}

export function loadAppArmorProfileBundle(bundle, options = {}) {
  const support = options.support || bundle?.support || detectAppArmorPolicySupport(options.env || process.env);
  if (!bundle?.profileFile) {
    return { ok: false, status: null, stdout: '', stderr: '', reason: 'profile_missing', loaded: false };
  }
  if (!(support.isLinux && support.kernelEnabled && support.parser)) {
    return {
      ok: false,
      status: null,
      stdout: '',
      stderr: '',
      reason: !support.isLinux ? 'not_linux' : (!support.kernelEnabled ? 'kernel_disabled' : 'parser_unavailable'),
      loaded: false
    };
  }
  const result = spawnSync(support.parser, ['-r', bundle.profileFile], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024
  });
  const loaded = result.status === 0 && isAppArmorProfileLoaded(bundle.profileName);
  return {
    ok: loaded,
    status: result.status,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
    reason: loaded ? 'loaded' : (result.status === 0 ? 'profile_not_visible' : 'load_failed'),
    loaded
  };
}

export function prepareAppArmorExecutionPolicy(rootDir, options = {}) {
  const requestedProfile = readString(options.requestedProfile || options.env?.SKYEQUANTA_RUNTIME_APPARMOR_PROFILE || process.env.SKYEQUANTA_RUNTIME_APPARMOR_PROFILE);
  const strict = readBoolean(options.strict ?? options.env?.SKYEQUANTA_RUNTIME_APPARMOR_STRICT ?? process.env.SKYEQUANTA_RUNTIME_APPARMOR_STRICT, false);
  if (!requestedProfile || requestedProfile.toLowerCase() === 'off') {
    return {
      enabled: false,
      active: false,
      strict,
      reason: 'disabled',
      bundle: null,
      wrapperCommand: null,
      wrapperArgs: []
    };
  }
  const bundle = writeAppArmorProfileBundle(rootDir, options);
  const support = bundle.support;
  let active = false;
  let reason = 'kernel_disabled';
  let load = { ok: false, status: null, stdout: '', stderr: '', reason: 'not_attempted', loaded: false };
  if (!bundle.ok) {
    reason = bundle.compile.reason || 'compile_failed';
  } else if (!(support.isLinux && support.kernelEnabled && support.aaExec && support.parser)) {
    if (!support.isLinux) reason = 'not_linux';
    else if (!support.kernelEnabled) reason = 'kernel_disabled';
    else if (!support.aaExec) reason = 'aa_exec_unavailable';
    else if (!support.parser) reason = 'parser_unavailable';
  } else {
    load = loadAppArmorProfileBundle(bundle, { support, env: options.env || process.env });
    active = Boolean(load.ok);
    reason = load.reason || (active ? 'ready' : 'load_failed');
  }
  if (!active && strict) {
    throw new Error(`Runtime AppArmor strict mode failed: ${reason}`);
  }
  return {
    enabled: true,
    active,
    strict,
    reason,
    profileName: bundle.profileName,
    bundle,
    support,
    load,
    wrapperCommand: active ? support.aaExec : null,
    wrapperArgs: active ? ['-p', bundle.profileName, '--'] : []
  };
}
