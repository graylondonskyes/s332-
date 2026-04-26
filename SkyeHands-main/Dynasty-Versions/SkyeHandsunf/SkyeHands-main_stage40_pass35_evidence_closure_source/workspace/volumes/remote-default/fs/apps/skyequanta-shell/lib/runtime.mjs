import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { readEnvFiles } from './dotenv.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFileIfChanged(filePath, contents) {
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8') === contents) {
    return;
  }

  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, contents, 'utf8');
}

function ensureFile(filePath, contents) {
  if (fs.existsSync(filePath)) {
    return;
  }

  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, contents, 'utf8');
}

function ensureExecutable(filePath) {
  if (!filePath || !fs.existsSync(filePath) || process.platform === 'win32') {
    return false;
  }

  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return false;
    }
    const currentMode = stat.mode & 0o777;
    const desiredMode = currentMode | 0o755;
    if (currentMode !== desiredMode) {
      fs.chmodSync(filePath, desiredMode);
      return true;
    }
  } catch {
    // Non-fatal: permission repair is best-effort when archives strip execute bits.
  }
  return false;
}

function listFiles(dirPath) {
  if (!dirPath || !fs.existsSync(dirPath)) {
    return [];
  }

  try {
    return fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(entry => entry.isFile())
      .map(entry => path.join(dirPath, entry.name));
  } catch {
    return [];
  }
}

function readJsonIfExists(filePath, fallback = null) {
  if (!filePath || !fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function normalizeWorkspaceRuntimeTable(payload) {
  const workspaces = {};
  if (payload && typeof payload === 'object' && payload.workspaces && typeof payload.workspaces === 'object' && !Array.isArray(payload.workspaces)) {
    Object.assign(workspaces, payload.workspaces);
  }
  if (Array.isArray(payload?.runtimes)) {
    for (const runtime of payload.runtimes) {
      const workspaceId = String(runtime?.workspaceId || '').trim();
      if (workspaceId) {
        workspaces[workspaceId] = runtime;
      }
    }
  }
  return {
    version: Number.parseInt(String(payload?.version || '1'), 10) || 1,
    workspaces
  };
}

export function repairArchiveStrippedRuntimeDependencies(config) {
  const touched = [];
  const checked = [];
  const candidateFiles = new Set();
  const unixBinDirs = [
    path.join(config.paths.agentVenvDir, 'bin'),
    path.join(config.paths.isolatedTheiaDir, 'node_modules', '.bin'),
    path.join(config.paths.isolatedTheiaDir, 'node_modules', '@theia', 'cli', 'bin')
  ];

  for (const dirPath of unixBinDirs) {
    for (const filePath of listFiles(dirPath)) {
      candidateFiles.add(filePath);
    }
  }

  [
    path.join(config.rootDir, 'START_HERE.sh'),
    path.join(config.rootDir, 'skyequanta'),
    config.paths.remoteExecutorScript,
    config.paths.isolatedTheiaCli,
    config.paths.isolatedTheiaExtCli,
    config.paths.ideRipgrepBinary
  ].filter(Boolean).forEach(filePath => candidateFiles.add(filePath));

  for (const filePath of candidateFiles) {
    if (!fs.existsSync(filePath)) {
      continue;
    }
    checked.push(filePath);
    if (ensureExecutable(filePath)) {
      touched.push(filePath);
    }
  }

  return {
    version: 1,
    at: new Date().toISOString(),
    checkedCount: checked.length,
    repairedCount: touched.length,
    checked,
    touched
  };
}

function ensureRuntimeClosureFiles(config, runtimePaths) {
  const runtimeTable = normalizeWorkspaceRuntimeTable(readJsonIfExists(runtimePaths.remoteExecutorRuntimesFile, null));
  writeFileIfChanged(runtimePaths.remoteExecutorRuntimesFile, `${JSON.stringify(runtimeTable, null, 2)}
`);
  const repairSummary = repairArchiveStrippedRuntimeDependencies(config);
  writeFileIfChanged(
    path.join(runtimePaths.runtimeDir, 'runtime-dependency-repair.json'),
    `${JSON.stringify(repairSummary, null, 2)}
`
  );
  return { runtimeTable, repairSummary };
}

function createSecret() {
  return crypto.randomBytes(32).toString('hex');
}

export function getRuntimePaths(config) {
  return {
    runtimeDir: path.join(config.rootDir, '.skyequanta'),
    runtimeEnvFile: path.join(config.rootDir, '.skyequanta', 'runtime.env'),
    workspaceDir: path.join(config.rootDir, 'workspace'),
    cacheDir: path.join(config.rootDir, '.skyequanta', 'cache'),
    fileStoreDir: path.join(config.rootDir, '.skyequanta', 'file-store'),
    ideConfigDir: path.join(config.rootDir, '.skyequanta', 'ide-config'),
    ideConfigPluginsDir: path.join(config.rootDir, '.skyequanta', 'ide-config', 'plugins'),
    idePluginsDir: path.join(config.paths.ideCoreDir, 'plugins'),
    ideDeployedPluginsDir: path.join(config.rootDir, '.skyequanta', 'ide-config', 'deployedPlugins'),
    ideBackendSettingsFile: path.join(config.rootDir, '.skyequanta', 'ide-config', 'backend-settings.json'),
    sessionStoreFile: path.join(config.rootDir, '.skyequanta', 'sessions.json'),
    governancePolicyFile: path.join(config.rootDir, '.skyequanta', 'governance-policy.json'),
    governanceSecretMigrationFile: path.join(config.rootDir, '.skyequanta', 'governance-secret-migration.json'),
    founderLaneDeclarationFile: path.join(config.rootDir, '.skyequanta', 'founder-lane-declarations.json'),
    providerVaultFile: path.join(config.rootDir, '.skyequanta', 'provider-vault.json'),
    workspaceProviderBindingsFile: path.join(config.rootDir, '.skyequanta', 'workspace-provider-bindings.json'),
    auditLogFile: path.join(config.rootDir, '.skyequanta', 'audit-log.json'),
    snapshotRootDir: path.join(config.rootDir, '.skyequanta', 'snapshots'),
    snapshotIndexFile: path.join(config.rootDir, '.skyequanta', 'workspace-snapshots.json'),
    snapshotRetentionPolicyFile: path.join(config.rootDir, '.skyequanta', 'snapshot-retention.json'),
    workspaceSchedulerPolicyFile: path.join(config.rootDir, '.skyequanta', 'workspace-scheduler-policy.json'),
    workspaceSchedulerStateFile: path.join(config.rootDir, '.skyequanta', 'workspace-scheduler-state.json'),
    remoteExecutorDir: path.join(config.rootDir, '.skyequanta', 'remote-executor'),
    remoteExecutorStateFile: path.join(config.rootDir, '.skyequanta', 'remote-executor', 'executor-state.json'),
    remoteExecutorRuntimesFile: path.join(config.rootDir, '.skyequanta', 'remote-executor', 'workspace-runtimes.json'),
    remoteExecutorLogFile: path.join(config.rootDir, '.skyequanta', 'remote-executor', 'executor.log'),
    workspaceRuntimeRootDir: path.join(config.rootDir, '.skyequanta', 'workspace-runtime'),
    agentConfigSource: path.join(config.rootDir, 'config', 'agent', 'config.toml'),
    agentConfigTarget: path.join(config.paths.agentCoreDir, 'config.toml'),
    rootEnvFile: path.join(config.rootDir, '.env'),
    localEnvFile: path.join(config.rootDir, '.env.local')
  };
}

export function ensureRuntimeState(config, baseEnv = process.env) {
  const runtimePaths = getRuntimePaths(config);

  ensureDirectory(runtimePaths.runtimeDir);
  ensureDirectory(runtimePaths.workspaceDir);
  ensureDirectory(runtimePaths.cacheDir);
  ensureDirectory(runtimePaths.fileStoreDir);
  ensureDirectory(runtimePaths.ideConfigDir);
  ensureDirectory(runtimePaths.ideConfigPluginsDir);
  ensureDirectory(runtimePaths.idePluginsDir);
  ensureDirectory(runtimePaths.ideDeployedPluginsDir);
  ensureDirectory(runtimePaths.snapshotRootDir);
  ensureDirectory(runtimePaths.remoteExecutorDir);
  ensureDirectory(runtimePaths.workspaceRuntimeRootDir);
  ensureDirectory(config.paths.workspaceVolumeRootDir);
  ensureDirectory(config.paths.workspaceRetentionRootDir);
  ensureDirectory(config.paths.workspaceSecretsRootDir);
  ensureDirectory(config.paths.workspacePrebuildRootDir);
  writeFileIfChanged(runtimePaths.ideBackendSettingsFile, '{}\n');
  ensureFile(runtimePaths.remoteExecutorStateFile, '{\n  "version": 1,\n  "running": false,\n  "lastStartedAt": null,\n  "lastStoppedAt": null,\n  "lastRunSummary": null,\n  "lastError": null\n}\n');
  ensureFile(runtimePaths.remoteExecutorRuntimesFile, '{\n  "version": 1,\n  "workspaces": {}\n}\n');
  ensureFile(runtimePaths.remoteExecutorLogFile, '');
  ensureFile(runtimePaths.sessionStoreFile, '{\n  "version": 1,\n  "sessions": []\n}\n');
  ensureFile(runtimePaths.governancePolicyFile, JSON.stringify({
    version: 1,
    limits: {
      maxWorkspaces: config.governance?.limits?.maxWorkspaces || 16,
      maxSessions: config.governance?.limits?.maxSessions || 256,
      maxForwardedPortsPerWorkspace: config.governance?.limits?.maxForwardedPortsPerWorkspace || 16,
      maxSnapshotsPerWorkspace: config.governance?.limits?.maxSnapshotsPerWorkspace || 20,
      maxSnapshotBytes: config.governance?.limits?.maxSnapshotBytes || 5 * 1024 * 1024 * 1024,
      maxAuditEvents: config.governance?.limits?.maxAuditEvents || 2000
    }
  }, null, 2) + '\n');
  ensureFile(runtimePaths.auditLogFile, '{\n  "version": 1,\n  "events": []\n}\n');
  ensureFile(runtimePaths.snapshotIndexFile, '{\n  "version": 1,\n  "snapshots": []\n}\n');
  ensureFile(runtimePaths.snapshotRetentionPolicyFile, JSON.stringify({
    version: 1,
    defaults: {
      maxSnapshots: config.governance?.limits?.maxSnapshotsPerWorkspace || 20,
      maxAgeDays: Number.parseInt(String(process.env.SKYEQUANTA_SNAPSHOT_RETENTION_MAX_AGE_DAYS || ''), 10) || 30
    },
    tenants: {},
    workspaces: {}
  }, null, 2) + '\n');
  ensureFile(runtimePaths.workspaceSchedulerPolicyFile, JSON.stringify({
    version: 1,
    enabled: String(process.env.SKYEQUANTA_SCHEDULER_ENABLED || 'true').trim().toLowerCase() !== 'false',
    intervalMs: Number.parseInt(String(process.env.SKYEQUANTA_SCHEDULER_INTERVAL_MS || ''), 10) || 60000,
    healthTimeoutMs: Number.parseInt(String(process.env.SKYEQUANTA_SCHEDULER_HEALTH_TIMEOUT_MS || ''), 10) || 3000,
    maxRestartsPerRun: Number.parseInt(String(process.env.SKYEQUANTA_SCHEDULER_MAX_RESTARTS_PER_RUN || ''), 10) || 3,
    restartCooldownMs: Number.parseInt(String(process.env.SKYEQUANTA_SCHEDULER_RESTART_COOLDOWN_MS || ''), 10) || 300000,
    cleanupExpiredSessions: String(process.env.SKYEQUANTA_SCHEDULER_CLEANUP_EXPIRED_SESSIONS || 'true').trim().toLowerCase() !== 'false',
    retentionCleanupEnabled: String(process.env.SKYEQUANTA_SCHEDULER_RETENTION_CLEANUP_ENABLED || 'true').trim().toLowerCase() !== 'false',
    retentionCleanupEveryRuns: Number.parseInt(String(process.env.SKYEQUANTA_SCHEDULER_RETENTION_CLEANUP_EVERY_RUNS || ''), 10) || 5,
    historyMaxEntries: Number.parseInt(String(process.env.SKYEQUANTA_SCHEDULER_HISTORY_MAX_ENTRIES || ''), 10) || 500
  }, null, 2) + '\n');
  ensureFile(runtimePaths.workspaceSchedulerStateFile, JSON.stringify({
    version: 1,
    running: false,
    lastStartedAt: null,
    lastStoppedAt: null,
    lastRunAt: null,
    lastCompletedAt: null,
    lastRunSummary: null,
    totalRuns: 0,
    totalRemediations: 0,
    totalSessionCleanups: 0,
    totalRetentionCleanups: 0,
    lastError: null,
    history: [],
    workspaces: {}
  }, null, 2) + '\n');

  ensureRuntimeClosureFiles(config, runtimePaths);

  const sourceConfig = fs.readFileSync(runtimePaths.agentConfigSource, 'utf8');
  writeFileIfChanged(runtimePaths.agentConfigTarget, sourceConfig);

  const fileEnv = readEnvFiles([
    runtimePaths.rootEnvFile,
    runtimePaths.localEnvFile,
    runtimePaths.runtimeEnvFile
  ]);

  if (!baseEnv.OH_SECRET_KEY && !fileEnv.OH_SECRET_KEY) {
    writeFileIfChanged(
      runtimePaths.runtimeEnvFile,
      `OH_SECRET_KEY=${createSecret()}\n`
    );
  }

  return runtimePaths;
}

export function loadShellEnv(config, baseEnv = process.env) {
  const runtimePaths = getRuntimePaths(config);
  const fileEnv = readEnvFiles([
    runtimePaths.rootEnvFile,
    runtimePaths.localEnvFile,
    runtimePaths.runtimeEnvFile
  ]);

  return {
    ...fileEnv,
    THEIA_CONFIG_DIR: runtimePaths.ideConfigDir,
    ...baseEnv
  };
}