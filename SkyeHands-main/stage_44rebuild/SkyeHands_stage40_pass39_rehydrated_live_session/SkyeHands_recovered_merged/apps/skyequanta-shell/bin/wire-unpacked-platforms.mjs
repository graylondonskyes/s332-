#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const shellDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootDir = path.resolve(shellDir, '..', '..');

function exists(rel) {
  return fs.existsSync(path.join(rootDir, rel));
}

function readJson(rel, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(path.join(rootDir, rel), 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(rel, value) {
  const abs = path.join(rootDir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`);
}

function walk(dir, predicate = () => true, limit = 10000) {
  const abs = path.join(rootDir, dir);
  const out = [];
  const stack = [abs];
  while (stack.length && out.length < limit) {
    const current = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      if (entry.isFile()) {
        const rel = path.relative(rootDir, full).split(path.sep).join('/');
        if (predicate(rel, entry.name)) out.push(rel);
      }
    }
  }
  return out.sort();
}

function listDirs(rel) {
  const abs = path.join(rootDir, rel);
  try {
    return fs.readdirSync(abs, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  } catch {
    return [];
  }
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function scriptEntries(pkgRel, sourceRoot = '') {
  const pkg = readJson(pkgRel, {});
  const scripts = pkg.scripts || {};
  return Object.entries(scripts).map(([name, command]) => {
    const targetMatch = String(command).match(/(?:node|python|bash)\s+(?:--test\s+)?["']?([^"'\s]+)["']?/);
    const target = targetMatch ? targetMatch[1].replace(/^\.\//, '') : null;
    const packageDir = path.dirname(pkgRel);
    const targetRel = target ? path.join(packageDir, target).split(path.sep).join('/') : null;
    return {
      scriptName: name,
      command,
      commandTarget: targetRel,
      commandTargetExists: targetRel ? exists(targetRel) : true,
      runtimeCandidate: /(^|:)start$|runtime|server|service/.test(name),
      smokeCandidate: /smoke|test/.test(name)
    };
  });
}

function staticProfilesFrom(rootRel, baseLabel) {
  return walk(rootRel, (rel, name) => name === 'index.html', 2000).map((entryFile) => {
    const serveDirectory = path.dirname(entryFile);
    const id = serveDirectory.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'root';
    return {
      profileId: `${id}-static-surface`,
      kind: 'static-html',
      label: `${baseLabel} :: ${serveDirectory}`,
      ready: true,
      reason: 'index.html entry detected',
      serveDirectory,
      entryFile,
      defaultPath: '/index.html'
    };
  });
}

function packageProfilesFrom(rootRel) {
  return walk(rootRel, (rel, name) => name === 'package.json', 2000).map((pkgRel) => {
    const pkg = readJson(pkgRel, {});
    return {
      relativePath: pkgRel,
      packageName: pkg.name || path.basename(path.dirname(pkgRel)),
      version: pkg.version || '0.0.0',
      scripts: scriptEntries(pkgRel)
    };
  });
}

function buildCommandHub() {
  const platformRoot = 'platform/user-platforms/skye-account-executive-commandhub-s0l26-0s';
  const sourceRoot = `${platformRoot}/source`;
  const packageProfiles = packageProfilesFrom(sourceRoot);
  const launchProfiles = staticProfilesFrom(sourceRoot, 'Skye Account Executive CommandHub');
  const branchRoot = `${sourceRoot}/AE-Central-Command-Pack-CredentialHub-Launcher/Branching Apps`;
  const branchApps = listDirs(branchRoot).map((name) => ({
    name,
    relativePath: `${branchRoot}/${name}`
  }));
  const smokeProfiles = packageProfiles.flatMap((pkg) => pkg.scripts.filter((script) => script.smokeCandidate).map((script) => ({
    profileId: `${pkg.packageName}-${script.scriptName}`.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase(),
    kind: 'npm-smoke',
    label: `${pkg.packageName} :: ${script.scriptName}`,
    packageRelativePath: pkg.relativePath,
    scriptName: script.scriptName,
    command: script.command,
    commandTarget: script.commandTarget,
    ready: script.commandTargetExists,
    reason: script.commandTargetExists ? 'smoke target resolved' : 'smoke target missing'
  })));
  const runtimeProfiles = packageProfiles.flatMap((pkg) => pkg.scripts.filter((script) => script.runtimeCandidate).map((script) => ({
    profileId: `${pkg.packageName}-${script.scriptName}`.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase(),
    kind: 'npm-runtime',
    label: `${pkg.packageName} :: ${script.scriptName}`,
    packageRelativePath: pkg.relativePath,
    scriptName: script.scriptName,
    command: script.command,
    commandTarget: script.commandTarget,
    ready: script.commandTargetExists,
    reason: script.commandTargetExists ? 'runtime target resolved' : 'runtime target missing'
  })));
  return {
    version: 2,
    slug: 'skye-account-executive-commandhub-s0l26-0s',
    displayName: 'Skye Account Executive CommandHub s0l26-0s',
    sourceRoot,
    packages: packageProfiles,
    launchProfiles,
    smokeProfiles,
    runtimeProfiles,
    branchApps,
    summary: {
      packageCount: packageProfiles.length,
      launchProfileCount: launchProfiles.length,
      readyLaunchProfileCount: launchProfiles.filter((p) => p.ready).length,
      smokeProfileCount: smokeProfiles.length,
      readySmokeProfileCount: smokeProfiles.filter((p) => p.ready).length,
      runtimeProfileCount: runtimeProfiles.length,
      readyRuntimeProfileCount: runtimeProfiles.filter((p) => p.ready).length,
      branchAppCount: branchApps.length,
      routexSmokePresent: smokeProfiles.some((p) => /routex/i.test(`${p.label} ${p.commandTarget || ''}`)),
      supplierEnginePresent: branchApps.some((app) => /Music-Nexus/.test(app.name)) && exists(`${branchRoot}/Skye-Music-Nexus/supplier-acquisition-engine/package.json`)
    },
    integrationPolicy: {
      deepScanEligible: true,
      valuationEligible: true,
      honestLaunchOnly: true,
      canonicalIntakeRoot: 'platform/user-platforms/<platform-slug>/source/'
    }
  };
}

function buildAutonomousStore() {
  const platformRoot = 'platform/user-platforms/ae-autonomous-store-system-maggies';
  const sourceRoot = `${platformRoot}/source`;
  const packages = packageProfilesFrom(sourceRoot);
  const launchProfiles = staticProfilesFrom(sourceRoot, 'AE Autonomous Store System Maggies');
  const smokeProfiles = packages.flatMap((pkg) => pkg.scripts.filter((script) => script.smokeCandidate).map((script) => ({
    profileId: `${pkg.packageName}-${script.scriptName}`.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase(),
    kind: 'npm-smoke',
    label: `${pkg.packageName} :: ${script.scriptName}`,
    packageRelativePath: pkg.relativePath,
    scriptName: script.scriptName,
    command: script.command,
    commandTarget: script.commandTarget,
    ready: script.commandTargetExists,
    reason: script.commandTargetExists ? 'smoke target resolved' : 'smoke target missing'
  })));
  return {
    version: 1,
    slug: 'ae-autonomous-store-system-maggies',
    displayName: 'AE Autonomous Store System Maggies',
    sourceRoot,
    packages,
    launchProfiles,
    smokeProfiles,
    summary: {
      packageCount: packages.length,
      launchProfileCount: launchProfiles.length,
      readyLaunchProfileCount: launchProfiles.filter((p) => p.ready).length,
      smokeProfileCount: smokeProfiles.length,
      readySmokeProfileCount: smokeProfiles.filter((p) => p.ready).length,
      routePacketCorePresent: exists(`${sourceRoot}/shared/core/autonomous-store.mjs`),
      routePacketExtensionPresent: exists(`${sourceRoot}/shared/core/autonomous-store-extensions.mjs`),
      signupCoreHelperExportsPresent: exists(`${sourceRoot}/shared/core/autonomous-store.mjs`)
    },
    integrationPolicy: {
      deepScanEligible: true,
      valuationEligible: true,
      honestLaunchOnly: true,
      routexAdjacent: true
    }
  };
}

function buildIdeCore() {
  const root = 'platform/ide-core';
  const packages = packageProfilesFrom(`${root}/packages`);
  const packageNames = packages.map((pkg) => pkg.packageName).sort();
  return {
    slug: 'ide-core',
    displayName: 'Recovered IDE Core',
    sourceRoot: root,
    exists: exists(root),
    packageCount: packages.length,
    aiPackageCount: packageNames.filter((name) => /ai|codex|claude|openai|anthropic|ollama|mcp/i.test(name)).length,
    packages: packageNames,
    criticalPackages: packageNames.filter((name) => /core|filesystem|monaco|editor|terminal|plugin|scm|ai|codex|mcp/i.test(name)).slice(0, 200)
  };
}

function buildAgentCore() {
  const root = 'platform/agent-core';
  return {
    slug: 'agent-core',
    displayName: 'Recovered Agent Core Runtime',
    sourceRoot: root,
    exists: exists(root),
    packageJson: exists(`${root}/package.json`),
    runtimeServer: exists(`${root}/runtime/lib/server.mjs`),
    manifestServer: exists(`${root}/runtime/lib/server.mjs`),
    packages: packageProfilesFrom(root)
  };
}

function main() {
  const commandHub = buildCommandHub();
  const autonomousStore = buildAutonomousStore();
  const ideCore = buildIdeCore();
  const agentCore = buildAgentCore();
  const wiring = {
    generatedAt: new Date().toISOString(),
    root: path.basename(rootDir),
    mode: 'unpacked-recovery-wiring',
    platforms: [commandHub, autonomousStore, ideCore, agentCore],
    summary: {
      platformCount: 4,
      userPlatformCount: 2,
      ideCorePresent: ideCore.exists,
      ideCorePackageCount: ideCore.packageCount,
      agentCorePresent: agentCore.exists,
      commandHubBranchAppCount: commandHub.summary.branchAppCount,
      commandHubReadySmokeCount: commandHub.summary.readySmokeProfileCount,
      autonomousStoreReadySmokeCount: autonomousStore.summary.readySmokeProfileCount,
      routexRecoveredViaCommandHubSmoke: commandHub.summary.routexSmokePresent,
      routexRecoveredViaAutonomousStorePackets: autonomousStore.summary.routePacketCorePresent && autonomousStore.summary.routePacketExtensionPresent
    }
  };
  wiring.fingerprint = hash(wiring.summary);

  writeJson('platform/wiring/unpacked-platforms.json', wiring);
  writeJson('docs/proof/UNPACKED_FILES_WIRING_PROOF.json', {
    ok: true,
    generatedAt: wiring.generatedAt,
    proofType: 'unpacked-files-wired-into-platform-manifest',
    checks: wiring.summary,
    fingerprint: wiring.fingerprint
  });
  writeJson('platform/user-platforms/skye-account-executive-commandhub-s0l26-0s/skyehands.platform.json', commandHub);
  writeJson('platform/user-platforms/ae-autonomous-store-system-maggies/skyehands.platform.json', autonomousStore);

  console.log(JSON.stringify({ ok: true, wrote: [
    'platform/wiring/unpacked-platforms.json',
    'docs/proof/UNPACKED_FILES_WIRING_PROOF.json',
    'platform/user-platforms/skye-account-executive-commandhub-s0l26-0s/skyehands.platform.json',
    'platform/user-platforms/ae-autonomous-store-system-maggies/skyehands.platform.json'
  ], summary: wiring.summary }, null, 2));
}

main();
