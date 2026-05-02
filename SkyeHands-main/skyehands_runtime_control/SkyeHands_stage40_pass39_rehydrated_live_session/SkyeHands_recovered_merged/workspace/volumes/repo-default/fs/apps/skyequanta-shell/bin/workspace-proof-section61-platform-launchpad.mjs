#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { assertCheck } from './provider-proof-helpers.mjs';
import {
  resetPlatformLaunchpadStore,
  registerPlatformFromSource,
  loadPlatformRegistry,
  loadRegisteredPlatform,
  buildLaunchPlan,
  launchStaticPlatformProfile,
  writeLaunchpadSurface,
  summarizeRegisteredPlatformByPath
} from '../lib/platform-launchpad.mjs';

function writeFixturePlatform(platformDir) {
  fs.rmSync(platformDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(platformDir, 'nested-launcher'), { recursive: true });
  fs.writeFileSync(path.join(platformDir, 'index.html'), '<!doctype html><html><head><title>Fixture Platform Root</title></head><body><h1>Fixture Platform Root</h1></body></html>');
  fs.writeFileSync(path.join(platformDir, 'nested-launcher', 'index.html'), '<!doctype html><html><head><title>Fixture Nested Launcher</title></head><body><h1>Fixture Nested Launcher</h1></body></html>');
  fs.writeFileSync(path.join(platformDir, 'package.json'), JSON.stringify({
    name: 'fixture-platform',
    private: true,
    version: '1.0.0',
    scripts: {
      'runtime:service': 'node ./integration/runtime-service.js',
      'smoke:fixture': 'node ./scripts/smoke.mjs'
    }
  }, null, 2));
  fs.mkdirSync(path.join(platformDir, 'integration'), { recursive: true });
  fs.mkdirSync(path.join(platformDir, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(platformDir, 'integration', 'runtime-service.js'), 'console.log("fixture runtime service");\n');
  fs.writeFileSync(path.join(platformDir, 'scripts', 'smoke.mjs'), 'console.log("fixture smoke");\n');
}

async function main() {
  const baseConfig = getStackConfig(process.env);
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section61-platform-launchpad.mjs');

  const versionStamp = JSON.parse(fs.readFileSync(path.join(config.rootDir, 'docs', 'VERSION_STAMP.json'), 'utf8'));
  const outputDir = path.join(config.rootDir, 'dist', 'section61', 'platform-launchpad');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_61_PLATFORM_LAUNCHPAD.json');
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  resetPlatformLaunchpadStore(config);

  const fixtureSourceDir = path.join(outputDir, 'fixture-platform-source');
  writeFixturePlatform(fixtureSourceDir);
  const fixtureRegistration = registerPlatformFromSource(config, {
    sourceDir: path.relative(config.rootDir, fixtureSourceDir),
    slug: 'fixture-platform',
    displayName: 'Fixture Platform'
  });
  const fixtureManifest = loadRegisteredPlatform(config, 'fixture-platform');
  const fixturePlan = buildLaunchPlan(config, 'fixture-platform', 'root-static-surface');
  const fixtureLaunch = await launchStaticPlatformProfile(config, 'fixture-platform', 'root-static-surface', { port: 8821 });
  const fixtureFetch = await fetch(`${fixtureLaunch.baseUrl}/index.html`).then(async response => ({ ok: response.ok, status: response.status, text: await response.text() }));
  await fixtureLaunch.stop();

  const fixtureCanonicalDir = path.join(config.rootDir, 'platform', 'user-platforms', 'fixture-platform');
  fs.rmSync(fixtureCanonicalDir, { recursive: true, force: true });
  const runtimeRegistryFile = path.join(config.rootDir, '.skyequanta', 'platform-launchpad', 'registry.json');
  const canonicalRegistryFile = path.join(config.rootDir, 'platform', 'user-platforms', 'REGISTRY.json');
  for (const registryFile of [runtimeRegistryFile, canonicalRegistryFile]) {
    const registry = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
    registry.platforms = (registry.platforms || []).filter(item => item.slug !== 'fixture-platform');
    fs.writeFileSync(registryFile, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
  }

  const aeSource = path.join(config.rootDir, 'platform', 'user-platforms', 'skye-account-executive-commandhub-s0l26-0s', 'source');
  const aeRegistration = registerPlatformFromSource(config, {
    sourceDir: path.relative(config.rootDir, aeSource),
    slug: 'skye-account-executive-commandhub-s0l26-0s',
    displayName: 'Skye Account Executive CommandHub s0l26-0s'
  });
  const aeManifest = loadRegisteredPlatform(config, 'skye-account-executive-commandhub-s0l26-0s');
  const aeSurface = writeLaunchpadSurface(path.join(outputDir, 'ae-commandhub-launchpad.html'), { manifest: aeManifest });
  const aeSummary = summarizeRegisteredPlatformByPath(config, aeSource);
  const aeStaticProfileId = 'ae-central-command-pack-credentialhub-launcher-static-surface';
  const aeStaticPlan = buildLaunchPlan(config, 'skye-account-executive-commandhub-s0l26-0s', aeStaticProfileId);
  const aeRuntimePlan = buildLaunchPlan(config, 'skye-account-executive-commandhub-s0l26-0s', 'skyeaccountexecutive-commandhub-s0l26-0s-runtime-service');
  const aeLaunch = await launchStaticPlatformProfile(config, 'skye-account-executive-commandhub-s0l26-0s', aeStaticProfileId, { port: 8822 });
  const aeFetch = await fetch(`${aeLaunch.baseUrl}/index.html`).then(async response => ({ ok: response.ok, status: response.status, text: await response.text() }));
  await aeLaunch.stop();

  const registry = loadPlatformRegistry(config);
  const checks = [
    assertCheck(fixtureManifest.summary.launchProfileCount >= 2 && fixtureManifest.summary.readyLaunchProfileCount >= 2, 'Create a canonical platform intake lane so future platforms always live under platform/user-platforms/<slug>/source and become registrable from one SkyeHands lane', { fixtureManifest }),
    assertCheck(fixturePlan.ok === true && fixtureFetch.ok === true && fixtureFetch.text.includes('Fixture Platform Root'), 'Prove SkyeHands can generate and execute a real static launch plan for an imported platform instead of only writing docs about launchability', { fixturePlan, fixtureFetch }),
    assertCheck(aeManifest.summary.launchProfileCount >= 2 && aeManifest.summary.branchAppCount >= 4, 'Ingest the added SkyeAccountExecutive CommandHub platform into the canonical lane and preserve its nested launcher and branch-app depth', { aeManifest }),
    assertCheck(aeStaticPlan.ok === true && aeFetch.ok === true && aeFetch.text.includes('AE Central Command Pack'), 'Prove the imported AE CommandHub platform is actually launchable from SkyeHands through a real generated launch plan and live static preview fetch', { aeStaticPlan, aeFetch }),
    assertCheck(aeRuntimePlan.ok === false && aeRuntimePlan.reason === 'script target missing', 'Deny fake runtime-service launch claims loudly when package scripts point to missing backing files', { aeRuntimePlan }),
    assertCheck((registry.platforms || []).length === 1 && registry.platforms[0]?.slug === 'skye-account-executive-commandhub-s0l26-0s' && aeSummary?.slug === 'skye-account-executive-commandhub-s0l26-0s', 'Write canonical platform registry records that deep scan and valuation lanes can consume by source path without polluting the live intake lane with proof fixtures', { registry, aeSummary }),
    assertCheck(fs.existsSync(aeSurface.filePath) && fs.readFileSync(aeSurface.filePath, 'utf8').includes('Launch profiles'), 'Generate an operator-facing launchpad surface showing ready and denied profiles for the imported platform', { surfaceFile: path.relative(config.rootDir, aeSurface.filePath) })
  ];

  const payload = {
    generatedAt: new Date().toISOString(),
    pass: checks.every(item => item.pass),
    checks,
    evidence: {
      fixtureRegistration: {
        manifestFile: path.relative(config.rootDir, fixtureRegistration.manifestFile),
        summary: fixtureRegistration.manifest.summary
      },
      fixturePlan,
      fixtureFetch,
      aeRegistration: {
        manifestFile: path.relative(config.rootDir, aeRegistration.manifestFile),
        summary: aeRegistration.manifest.summary
      },
      aeStaticPlan,
      aeRuntimePlan,
      aeFetch,
      registry,
      aeSummary
    },
    artifactReferences: {
      aeLaunchpadSurfaceFile: path.relative(config.rootDir, aeSurface.filePath),
      runtimeRegistryFile: '.skyequanta/platform-launchpad/registry.json',
      canonicalRegistryFile: 'platform/user-platforms/REGISTRY.json',
      aeManifestFile: 'platform/user-platforms/skye-account-executive-commandhub-s0l26-0s/skyehands.platform.json',
      intakeReadme: 'platform/user-platforms/PUT_FUTURE_PLATFORMS_HERE.md'
    },
    smokeCommand: 'bash scripts/smoke-section61-platform-launchpad.sh',
    modelVersion: versionStamp.modelVersion,
    runtimeVersion: versionStamp.runtimeVersion,
    directiveVersion: versionStamp.directiveVersion
  };

  const written = writeProofJson(proofFile, payload, config, 'workspace-proof-section61-platform-launchpad.mjs');
  console.log(JSON.stringify(written, null, 2));
  if (!written.pass) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
