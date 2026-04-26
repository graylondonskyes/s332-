import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGateRuntimeConfig } from '../lib/gate-config.mjs';
import { buildControlPlaneCatalog, buildProductIdentity, buildRuntimeContract } from '../lib/runtime-contract.mjs';

const shellBinDir = path.dirname(fileURLToPath(import.meta.url));
const shellDir = path.resolve(shellBinDir, '..');
const rootDir = path.resolve(shellDir, '..', '..');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

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

function readPort(value, fallback, name) {
  if (value === undefined) {
    return fallback;
  }

  const port = Number.parseInt(String(value), 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port for ${name}: ${value}`);
  }

  return port;
}


function readCsv(value) {
  return String(value || '')
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);
}

function readUrl(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return null;
  }

  return normalized.replace(/\/+$/, '');
}

export function getStackConfig(env = process.env) {
  const identity = readJson(path.join(rootDir, 'branding', 'identity.json'));
  const host = env.SKYEQUANTA_HOST || '127.0.0.1';

  const config = {
    companyName: identity.companyName,
    productName: identity.productName,
    aiDisplayName: identity.aiDisplayName,
    componentNames: identity.componentNames,
    developmentMode: readBoolean(env.SKYEQUANTA_DEV, false),
    host,
    rootDir,
    shellDir,
    paths: {
      agentCoreDir: path.join(rootDir, 'platform', 'agent-core'),
      agentFrontendDir: path.join(rootDir, 'platform', 'agent-core', 'frontend'),
      agentServerAppDir: path.join(shellDir, 'python'),
      ideCoreDir: path.join(rootDir, 'platform', 'ide-core'),
      ideRuntimeDepsDir: path.join(rootDir, '.skyequanta', 'runtime-deps'),
      isolatedTheiaDir: path.join(rootDir, '.skyequanta', 'runtime-deps', 'theia-browser'),
      ideExampleDir: path.join(rootDir, 'platform', 'ide-core', 'examples', 'browser'),
      isolatedTheiaPackageJson: path.join(rootDir, '.skyequanta', 'runtime-deps', 'theia-browser', 'package.json'),
      npmCacheDir: path.join(rootDir, '.skyequanta', 'runtime-deps', '.npm-cache'),
      agentVenvDir: path.join(rootDir, '.skyequanta', 'runtime-deps', 'agent-venv'),
      isolatedTheiaCli: path.join(rootDir, '.skyequanta', 'runtime-deps', 'theia-browser', 'node_modules', '.bin', process.platform === 'win32' ? 'theia.cmd' : 'theia'),
      isolatedTheiaExtCli: path.join(rootDir, '.skyequanta', 'runtime-deps', 'theia-browser', 'node_modules', '.bin', process.platform === 'win32' ? 'theiaext.cmd' : 'theiaext'),
      isolatedTheiaBackendEntrypoint: path.join(rootDir, '.skyequanta', 'runtime-deps', 'theia-browser', 'src-gen', 'backend', 'main.js'),
      isolatedTheiaFrontendIndexHtml: path.join(rootDir, '.skyequanta', 'runtime-deps', 'theia-browser', 'lib', 'frontend', 'index.html'),
      ideCliEntrypoint: path.join(rootDir, 'platform', 'ide-core', 'dev-packages', 'cli', 'lib', 'theia.js'),
      ideBrowserBackendEntrypoint: path.join(rootDir, 'platform', 'ide-core', 'examples', 'browser', 'src-gen', 'backend', 'main.js'),
      ideWebpackConfig: path.join(rootDir, 'platform', 'ide-core', 'examples', 'browser', 'webpack.config.js'),
      ideRipgrepPostinstall: path.join(rootDir, 'platform', 'ide-core', 'node_modules', '@vscode', 'ripgrep', 'lib', 'postinstall.js'),
      ideRipgrepBinary: path.join(rootDir, 'platform', 'ide-core', 'node_modules', '@vscode', 'ripgrep', 'bin', process.platform === 'win32' ? 'rg.exe' : 'rg'),
      ideKeytarBinding: path.join(rootDir, 'platform', 'ide-core', 'node_modules', 'keytar', 'build', 'Release', 'keytar.node'),
      ideFrontendIndexHtml: path.join(rootDir, 'platform', 'ide-core', 'examples', 'browser', 'lib', 'frontend', 'index.html'),
      ideFrontendBundle: path.join(rootDir, 'platform', 'ide-core', 'examples', 'browser', 'lib', 'frontend', 'secondary-window.js'),
      ideEditorWorkerBundle: path.join(rootDir, 'platform', 'ide-core', 'examples', 'browser', 'lib', 'frontend', 'editor.worker.js'),
      ideBackendBundle: path.join(rootDir, 'platform', 'ide-core', 'examples', 'browser', 'lib', 'backend', 'main.js'),
      ideNodePtyBinding: path.join(rootDir, 'platform', 'ide-core', 'node_modules', 'node-pty', 'build', 'Release', 'pty.node'),
      ideDriveListBinding: path.join(rootDir, 'platform', 'ide-core', 'node_modules', 'drivelist', 'build', 'Release', 'drivelist.node'),
      workspaceEnvExample: path.join(rootDir, 'config', 'env.example'),
      workspaceProvisionManifest: [
        'README.md',
        'package.json',
        'Makefile',
        '.devcontainer',
        'branding',
        'config',
        'apps/skyequanta-shell',
        'scripts',
        'docs/CODESPACES_REPLACEMENT_EXECUTION_DIRECTIVES.md'
      ],
      remoteExecutorDir: path.join(rootDir, '.skyequanta', 'remote-executor'),
      remoteExecutorStateFile: path.join(rootDir, '.skyequanta', 'remote-executor', 'executor-state.json'),
      remoteExecutorLogFile: path.join(rootDir, '.skyequanta', 'remote-executor', 'executor.log'),
      remoteExecutorRuntimesFile: path.join(rootDir, '.skyequanta', 'remote-executor', 'workspace-runtimes.json'),
      remoteExecutorScript: path.join(shellDir, 'bin', 'remote-executor.mjs'),
      workspaceVolumeRootDir: path.join(rootDir, 'workspace', 'volumes'),
      workspaceRetentionRootDir: path.join(rootDir, 'workspace', 'retention'),
      workspaceSecretsRootDir: path.join(rootDir, 'workspace', 'secrets'),
      workspacePrebuildRootDir: path.join(rootDir, 'workspace', 'prebuilds')
    },
    agentBackend: {
      host,
      port: readPort(env.SKYEQUANTA_AGENT_PORT, 3000, 'SKYEQUANTA_AGENT_PORT')
    },
    bridge: {
      host,
      port: readPort(env.SKYEQUANTA_BRIDGE_PORT, 3020, 'SKYEQUANTA_BRIDGE_PORT')
    },
    remoteExecutor: {
      host,
      port: readPort(env.SKYEQUANTA_REMOTE_EXECUTOR_PORT, 3320, 'SKYEQUANTA_REMOTE_EXECUTOR_PORT')
    },
    gateRuntime: loadGateRuntimeConfig(rootDir, env),
    auth: {
      adminToken: String(env.SKYEQUANTA_ADMIN_TOKEN || env.OH_SECRET_KEY || '').trim(),
      sessionTtlMs: Number.parseInt(String(env.SKYEQUANTA_SESSION_TTL_MS || ''), 10) || 2 * 60 * 60 * 1000
    },
    governance: {
      limits: {
        maxWorkspaces: Number.parseInt(String(env.SKYEQUANTA_LIMIT_MAX_WORKSPACES || ''), 10) || 16,
        maxSessions: Number.parseInt(String(env.SKYEQUANTA_LIMIT_MAX_SESSIONS || ''), 10) || 256,
        maxForwardedPortsPerWorkspace: Number.parseInt(String(env.SKYEQUANTA_LIMIT_MAX_FORWARDED_PORTS || ''), 10) || 16,
        maxSnapshotsPerWorkspace: Number.parseInt(String(env.SKYEQUANTA_LIMIT_MAX_SNAPSHOTS || ''), 10) || 20,
        maxSnapshotBytes: Number.parseInt(String(env.SKYEQUANTA_LIMIT_MAX_SNAPSHOT_BYTES || ''), 10) || 5 * 1024 * 1024 * 1024,
        maxAuditEvents: Number.parseInt(String(env.SKYEQUANTA_LIMIT_MAX_AUDIT_EVENTS || ''), 10) || 2000
      }
    },
    lifecycle: {
      idleTimeoutMs: Number.parseInt(String(env.SKYEQUANTA_IDLE_TIMEOUT_MS || ''), 10) || 30 * 60 * 1000,
      maxRuntimeAgeMs: Number.parseInt(String(env.SKYEQUANTA_MAX_RUNTIME_AGE_MS || ''), 10) || 24 * 60 * 60 * 1000,
      retentionDays: Number.parseInt(String(env.SKYEQUANTA_RETENTION_DAYS || ''), 10) || 14,
      defaultMachineProfile: String(env.SKYEQUANTA_MACHINE_PROFILE || 'standard').trim() || 'standard',
      secretAllowlist: readCsv(env.SKYEQUANTA_SECRET_ALLOWLIST || env.SKYEQUANTA_WORKSPACE_SECRET_ALLOWLIST),
      machineProfiles: {
        small: { name: 'small', cpu: 2, memoryMb: 4096, diskGb: 20 },
        standard: { name: 'standard', cpu: 4, memoryMb: 8192, diskGb: 40 },
        large: { name: 'large', cpu: 8, memoryMb: 16384, diskGb: 80 }
      }
    },
    ide: {
      host,
      port: readPort(env.SKYEQUANTA_IDE_PORT, 3010, 'SKYEQUANTA_IDE_PORT')
    }
  };

  config.gate = {
    url: config.gateRuntime.gate.url,
    token: config.gateRuntime.gate.token,
    model: config.gateRuntime.gate.model
  };

  return config;
}

export function getInternalUrls(config) {
  return {
    ide: `http://${config.ide.host}:${config.ide.port}`,
    agentBackend: `http://${config.agentBackend.host}:${config.agentBackend.port}`,
    agentApiDocs: `http://${config.agentBackend.host}:${config.agentBackend.port}/docs`,
    gate: config.gate.url,
    bridge: `http://${config.bridge.host}:${config.bridge.port}`,
    remoteExecutor: `http://${config.remoteExecutor.host}:${config.remoteExecutor.port}`
  };
}

export function getPublicUrls(config) {
  const internalUrls = getInternalUrls(config);

  return {
    ide: internalUrls.bridge,
    agentBackend: `${internalUrls.bridge}/api/agent`,
    agentApiDocs: `${internalUrls.bridge}/api/agent/docs`,
    gateApi: `${internalUrls.bridge}/api/gate`,
    bridge: internalUrls.bridge,
    runtimeContract: `${internalUrls.bridge}/api/runtime-contract`,
    productIdentity: `${internalUrls.bridge}/api/product/identity`,
    surfaceIdentity: `${internalUrls.bridge}/api/surface-identity`,
    status: `${internalUrls.bridge}/api/status`
  };
}

export function getProductIdentity(config) {
  return buildProductIdentity(config, getPublicUrls(config));
}

export function getRuntimeContract(config) {
  return buildRuntimeContract(config, getPublicUrls(config));
}

export function getControlPlaneCatalog(config) {
  return buildControlPlaneCatalog(config, getPublicUrls(config));
}

export function getPublicSummary(config) {
  const urls = getPublicUrls(config);
  const runtimeContract = getRuntimeContract(config);
  const productIdentity = getProductIdentity(config);

  return {
    companyName: config.companyName,
    productName: config.productName,
    aiDisplayName: config.aiDisplayName,
    host: config.host,
    web: {
      port: config.bridge.port,
      url: urls.ide,
      status: urls.status,
      runtimeContract: urls.runtimeContract,
      productIdentity: urls.productIdentity,
      surfaceIdentity: urls.surfaceIdentity
    },
    agentBackend: {
      url: urls.agentBackend,
      docs: urls.agentApiDocs
    },
    gate: {
      configured: Boolean(config.gate.url),
      url: urls.gateApi,
      model: config.gate.model
    },
    bridge: {
      port: config.bridge.port,
      url: urls.bridge
    },
    productIdentity,
    runtimeContract
  };
}

export function withLocalBinPath(env = process.env) {
  const localBin = path.join(env.HOME || process.env.HOME || '', '.local', 'bin');
  if (!localBin) {
    return { ...env };
  }

  const currentPath = env.PATH || '';
  const pathEntries = currentPath.split(':').filter(Boolean);
  if (pathEntries.includes(localBin)) {
    return { ...env };
  }

  return {
    ...env,
    PATH: currentPath ? `${localBin}:${currentPath}` : localBin
  };
}