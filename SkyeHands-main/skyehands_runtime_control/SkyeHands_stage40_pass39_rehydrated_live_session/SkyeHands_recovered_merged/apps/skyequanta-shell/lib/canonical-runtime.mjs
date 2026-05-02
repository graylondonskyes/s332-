import path from 'node:path';

function rel(rootDir, targetPath) {
  return path.relative(rootDir, targetPath).replace(/\\/g, '/');
}

export function getCanonicalRuntimePaths(config) {
  const operatorCliEntry = path.join(config.rootDir, 'skyequanta.mjs');
  const operatorCliShell = path.join(config.rootDir, 'skyequanta');
  const startHereEntry = path.join(config.rootDir, 'START_HERE.sh');
  const launcherEntry = path.join(config.shellDir, 'bin', 'launch.mjs');
  const bridgeEntry = path.join(config.shellDir, 'bin', 'bridge.mjs');
  const bridgeLibrary = path.join(config.shellDir, 'lib', 'bridge.mjs');
  const executorEntry = path.join(config.shellDir, 'bin', 'remote-executor.mjs');
  const workspaceManagerEntry = path.join(config.shellDir, 'lib', 'workspace-manager.mjs');
  const proofRunnerEntry = path.join(config.shellDir, 'bin', 'workspace-proof-section3-truthpath.mjs');
  const deployRunnerEntry = path.join(config.shellDir, 'bin', 'doctor.mjs');

  return {
    authoritativePathId: 'skyequanta-operator-cli-path',
    operatorCli: {
      label: 'authoritative public operator cli',
      command: './skyequanta',
      entry: rel(config.rootDir, operatorCliEntry),
      shellWrapper: rel(config.rootDir, operatorCliShell)
    },
    startHere: {
      label: 'authoritative one-command operator path',
      command: './START_HERE.sh',
      entry: rel(config.rootDir, startHereEntry),
      equivalent: './skyequanta operator-green --json'
    },
    launcher: {
      label: 'authoritative launcher',
      command: './skyequanta start',
      compatibilityAlias: 'npm run start',
      entry: rel(config.rootDir, launcherEntry)
    },
    bridgeRuntime: {
      label: 'authoritative bridge/runtime surface',
      command: './skyequanta bridge:start',
      compatibilityAlias: 'npm run bridge:start',
      entry: rel(config.rootDir, bridgeEntry),
      library: rel(config.rootDir, bridgeLibrary),
      publicUrl: `http://${config.bridge.host}:${config.bridge.port}`
    },
    executor: {
      label: 'authoritative executor lane',
      command: 'node apps/skyequanta-shell/bin/remote-executor.mjs',
      entry: rel(config.rootDir, executorEntry)
    },
    workspaceManager: {
      label: 'authoritative workspace manager',
      entry: rel(config.rootDir, workspaceManagerEntry)
    },
    proofRunner: {
      label: 'authoritative truth-path proof runner',
      command: './skyequanta proof:truthpath --strict',
      compatibilityAlias: 'npm run workspace:proof:section3',
      entry: rel(config.rootDir, proofRunnerEntry)
    },
    deployRunner: {
      label: 'authoritative deploy-readiness runner',
      command: './skyequanta doctor --mode deploy --probe-active --json',
      compatibilityAlias: 'npm run doctor',
      entry: rel(config.rootDir, deployRunnerEntry)
    },
    docs: {
      label: 'canonical runtime map',
      entry: 'docs/CANONICAL_RUNTIME_PATHS.md'
    }
  };
}

export function printCanonicalRuntimeBanner(config, invokedBy, options = {}) {
  const paths = getCanonicalRuntimePaths(config);
  const stream = options.stream || console;
  const lines = [
    'CANONICAL RUNTIME PATH',
    `- invoked by: ${invokedBy}`,
    `- public operator cli: ${paths.operatorCli.command} -> ${paths.operatorCli.entry}`,
    `- one-command operator path: ${paths.startHere.command} -> ${paths.startHere.entry}`,
    `- launcher: ${paths.launcher.command} -> ${paths.launcher.entry}`,
    `- bridge/runtime: ${paths.bridgeRuntime.command} -> ${paths.bridgeRuntime.entry}`,
    `- workspace manager: ${paths.workspaceManager.entry}`,
    `- executor: ${paths.executor.entry}`,
    `- proof runner: ${paths.proofRunner.entry}`,
    `- deploy runner: ${paths.deployRunner.entry}`,
    `- docs: ${paths.docs.entry}`
  ];

  for (const line of lines) {
    stream.log(line);
  }

  return paths;
}

export function attachCanonicalRuntimeProof(payload, config, invokedBy) {
  return {
    ...payload,
    canonicalRuntime: {
      invokedBy,
      ...getCanonicalRuntimePaths(config)
    }
  };
}

export function assertLegacyEntrypointAllowed(config, entrypointName) {
  if (process.env.SKYEQUANTA_INTERNAL_RUNTIME_INVOCATION === '1' || process.env.SKYEQUANTA_ALLOW_LEGACY_RUNTIME === '1') {
    return;
  }

  const paths = getCanonicalRuntimePaths(config);
  const message = [
    `canonical_runtime_guard: '${entrypointName}' is quarantined and cannot be launched directly.`,
    `Use ${paths.launcher.command} for the product launcher, ${paths.bridgeRuntime.command} for the product bridge/runtime surface, or ${paths.startHere.command} for the one-command operator path.`,
    `See ${paths.docs.entry} for the authoritative command map.`
  ].join(' ');
  throw new Error(message);
}
